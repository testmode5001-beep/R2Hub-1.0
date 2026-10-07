// Anexos: os arquivos são gravados na pasta do cliente na rede (Etapa 1);
// o banco guarda apenas nome, caminho, versão e data.
//
// Pedido cuja pasta o designer ainda não confirmou guarda os arquivos na
// pasta de anexos do hub (anexos-pendentes.server) — eles vão para a pasta do
// cliente no "Iniciar criação" (confirmarPastaCliente, em pedidos.functions).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, getDb, uuid } from "@/server/db.server";
import { requirePerm, temPerm, type AuthUser } from "@/server/auth.server";
import { audit } from "@/server/audit.server";
import { notifyUsers, usersWithRoles } from "@/server/notify.server";
import { clientePastaFullPath } from "@/server/clientes.server";
import { listClienteFiles, saveClienteFile } from "@/server/files.server";
import { ehPendente, lerArquivoDoAnexo, removerPendente, salvarPendente } from "@/server/anexos-pendentes.server";

// ~35 MB de arquivo → ~47 MB em base64.
const MAX_BASE64 = 50_000_000;

const MIME_POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

function podeVerTodos(user: AuthUser) {
  return user.role === "admin" || user.permissions.includes("pedidos.ver_todos");
}

function getPedidoComAcesso(user: AuthUser, pedidoId: string) {
  const db = getDb();
  const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(pedidoId) as
    | Record<string, unknown>
    | undefined;
  if (!pedido) throw new Error("Pedido não encontrado.");
  if (!podeVerTodos(user) && pedido.vendedor_id !== user.id) {
    throw new Error("Sem acesso a este pedido.");
  }
  return pedido;
}

/** O cliente (e a pasta) que o pedido já tem — ou null, quando o designer
    ainda não confirmou qual é.
    Antes, sem cliente, esta função CRIAVA a pasta pelo nome digitado: era a
    mesma porta das duplicatas ("Toninho Sorvetes - Renata"), aberta por
    outro caminho — bastava anexar ou abrir a lista de arquivos. Agora ela só
    lê; quem cria é o confirmarPastaCliente, com o designer escolhendo. */
function clienteConfirmado(pedido: Record<string, unknown>) {
  if (!pedido.cliente_id) return null;
  const cli = getDb()
    .prepare("SELECT * FROM clientes WHERE id = ?")
    .get(pedido.cliente_id as string) as { id: string; nome: string; pasta: string } | undefined;
  return cli ?? null;
}

export const uploadAnexo = createServerFn({ method: "POST" })
  .validator(
    z.object({
      pedidoId: z.string().min(1),
      tipo: z.enum(["anexo", "referencia", "faca", "arte", "logo"]),
      nome: z.string().min(1),
      dataBase64: z.string().min(1).max(MAX_BASE64),
      /* false nos arquivos que sobem junto com o pedido novo (o "Pedido
         criado" já conta) e na arte que vai com a entrega (a linha "Arte vN
         enviada" já conta). O resto entra no Histórico. */
      registrar: z.boolean().optional(),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    /* A arte sobe com a entrega (Design criado) ou como arte final: quem pode
       entregar arte pode subir o arquivo dela. O modelo do designer não tem
       anexo.upload, e a entrega falhava no primeiro arquivo (simulação de
       28/09/2026). O resto continua pedindo anexo.upload. */
    const sobeArte = data.tipo === "arte" && (temPerm(user, "design.enviar_arte") || temPerm(user, "design.arquivo_final"));
    if (!sobeArte) requirePerm(user, "anexo.upload");
    const db = getDb();
    const pedido = getPedidoComAcesso(user, data.pedidoId);
    /* cancelado não se altera, nem por arquivo (a trava era só da tela) */
    if (pedido.status === "cancelado") throw new Error("Pedido cancelado não recebe arquivo. Reative o pedido antes.");
    /* finalizado só o administrador altera, arquivo inclusive (simulação 3) */
    if (pedido.status === "concluido" && user.role !== "admin") throw new Error("Pedido finalizado só o administrador altera.");
    const cliente = clienteConfirmado(pedido);

    const conteudo = Buffer.from(data.dataBase64, "base64");
    /* com pasta confirmada, direto nela; sem, espera no hub até o designer
       iniciar a criação */
    const { fullPath, nomeSalvo } = cliente
      ? saveClienteFile(clientePastaFullPath(cliente.pasta), data.tipo, data.nome, conteudo)
      : salvarPendente(data.pedidoId, data.nome, conteudo);

    const { versao } = db
      .prepare(
        "SELECT COALESCE(MAX(versao), 0) + 1 AS versao FROM pedido_anexos WHERE pedido_id = ? AND tipo = ?",
      )
      .get(data.pedidoId, data.tipo) as { versao: number };

    const id = uuid();
    const ts = agora();
    db.prepare(
      "INSERT INTO pedido_anexos (id, pedido_id, user_id, tipo, nome, path, versao, created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).run(id, data.pedidoId, user.id, data.tipo, nomeSalvo, fullPath, versao, ts);

    /* Anexo que chega depois do envio aparece no Histórico: antes ficava só
       na auditoria, e ninguém sabia que tinha arquivo novo (simulação de
       28/09/2026). A arte final anexada sem mudar a etapa também. */
    if (data.registrar !== false) {
      db.prepare(
        "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
      ).run(uuid(), data.pedidoId, user.id, user.nome, data.tipo === "arte" ? "arte_final" : "anexo",
        data.tipo === "arte" ? `Arte final anexada: ${nomeSalvo}` : `Anexo novo: ${nomeSalvo}`, ts);
    }

    /* Com registrar false o aviso também sai de outro lugar ("Nova
       solicitação" do pedido criado, "Pedido atualizado" da entrega da arte).
       Avisar arquivo a arquivo mandava "Arte enviada" para a vendedora mesmo
       quando a entrega falhava no arquivo seguinte. */
    /* o número na frente, como nos outros avisos: o mesmo cliente tem vários
       pedidos (simulação 3, 30/09/2026) */
    const nn = `#${String(pedido.numero ?? "").padStart(2, "0")}`;
    if (data.registrar === false) {
      /* sem aviso próprio */
    } else if (data.tipo === "arte") {
      notifyUsers(
        [pedido.vendedor_id as string, ...usersWithRoles(["gestor", "admin"])],
        user.id,
        "Arte enviada",
        `${nn} · ${pedido.cliente}: ${nomeSalvo} (v${versao})`,
        `/pedido/${data.pedidoId}`,
      );
    } else {
      const alvos = pedido.designer_id
        ? [pedido.designer_id as string]
        : usersWithRoles(["designer", "gestor", "admin"]);
      notifyUsers(
        alvos,
        user.id,
        "Novo anexo",
        `${nn} · ${pedido.cliente}: ${nomeSalvo}`,
        `/pedido/${data.pedidoId}`,
      );
    }

    audit({ id: user.id, nome: user.nome }, "anexo.upload", "pedido_anexos", id, {
      pedido: pedido.numero,
      tipo: data.tipo,
      arquivo: nomeSalvo,
      caminho: fullPath,
      versao,
    });

    return { id, nome: nomeSalvo, path: fullPath, versao };
  });

export const downloadAnexo = createServerFn({ method: "POST" })
  .validator(z.object({ anexoId: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "anexo.baixar");
    const db = getDb();
    const anexo = db
      .prepare("SELECT * FROM pedido_anexos WHERE id = ?")
      .get(data.anexoId) as { pedido_id: string; nome: string; path: string } | undefined;
    if (!anexo) throw new Error("Anexo não encontrado.");
    getPedidoComAcesso(user, anexo.pedido_id);

    const conteudo = lerArquivoDoAnexo(anexo.path);
    const ext = anexo.nome.split(".").pop()?.toLowerCase() ?? "";
    return {
      nome: anexo.nome,
      mime: MIME_POR_EXTENSAO[ext] ?? "application/octet-stream",
      dataBase64: conteudo.toString("base64"),
    };
  });

export const deleteAnexo = createServerFn({ method: "POST" })
  .validator(z.object({ anexoId: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "anexo.excluir");
    const db = getDb();
    const anexo = db
      .prepare("SELECT * FROM pedido_anexos WHERE id = ?")
      .get(data.anexoId) as
      | { id: string; pedido_id: string; user_id: string | null; nome: string; path: string; tipo: string }
      | undefined;
    if (!anexo) throw new Error("Anexo não encontrado.");
    const pedido = getPedidoComAcesso(user, anexo.pedido_id);
    /* as mesmas travas de anexar: cancelado não se altera e finalizado só o
       administrador (a tela oferecia o × nos dois; simulação 3, 30/09/2026) */
    if (pedido.status === "cancelado") throw new Error("Pedido cancelado não se altera. Reative o pedido antes.");
    if (pedido.status === "concluido" && user.role !== "admin") throw new Error("Pedido finalizado só o administrador altera.");

    // Pode tirar da lista: quem enviou, quem tem etapa de design, ou quem edita tudo.
    const podeApagar =
      anexo.user_id === user.id ||
      user.role === "admin" ||
      user.permissions.includes("pedidos.status_design") ||
      user.permissions.includes("pedidos.editar_todos");
    if (!podeApagar) throw new Error("Sem permissão para tirar este anexo do pedido.");

    /* Tira só o VÍNCULO. O arquivo continua na pasta do cliente: o hub não
       apaga nada em \\server\Arte\Clientes (ver a regra em files.server.ts).
       Aquele acervo é de anos e às vezes é o único exemplar da arte.
       Exceção: anexo que ainda esperava na pasta do HUB (pedido sem pasta
       confirmada). Ali não é o share, e deixar o arquivo seria lixo que
       ninguém acha — ele sai junto com o vínculo. */
    db.prepare("DELETE FROM pedido_anexos WHERE id = ?").run(data.anexoId);
    const pendente = ehPendente(anexo.path);
    if (pendente) {
      try { removerPendente(anexo.path); } catch { /* já não estava lá */ }
    }

    audit({ id: user.id, nome: user.nome }, "anexo.desvincular", "pedido_anexos", anexo.id, {
      pedido: pedido.numero,
      tipo: anexo.tipo,
      arquivo: anexo.nome,
      caminho: anexo.path,
      observacao: pendente ? "arquivo ainda na pasta do hub, removido" : "arquivo mantido na pasta do cliente",
    });
    return { ok: true, arquivoMantido: pendente ? null : anexo.path };
  });

export const listPastaCliente = createServerFn({ method: "POST" })
  .validator(z.object({ pedidoId: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const pedido = getPedidoComAcesso(user, data.pedidoId);
    const cliente = clienteConfirmado(pedido);
    /* pasta ainda não confirmada pelo design: não há o que listar — e
       listar não pode ser motivo para criar */
    if (!cliente) return { caminho: null, arquivos: [] };
    const caminho = clientePastaFullPath(cliente.pasta);
    return { caminho, arquivos: listClienteFiles(caminho) };
  });
