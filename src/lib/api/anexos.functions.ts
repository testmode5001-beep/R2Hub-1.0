// Anexos: os arquivos são gravados na pasta do cliente na rede (Etapa 1);
// o banco guarda apenas nome, caminho, versão e data.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, getDb, uuid } from "@/server/db.server";
import { requirePerm, type AuthUser } from "@/server/auth.server";
import { audit } from "@/server/audit.server";
import { notifyUsers, usersWithRoles } from "@/server/notify.server";
import { clientePastaFullPath, ensureCliente } from "@/server/clientes.server";
import { listClienteFiles, readClienteFile, saveClienteFile } from "@/server/files.server";

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

/** Garante que o pedido tem cliente vinculado (pedidos antigos podem não ter). */
function clienteDoPedido(user: AuthUser, pedido: Record<string, unknown>) {
  const db = getDb();
  if (pedido.cliente_id) {
    const cli = db
      .prepare("SELECT * FROM clientes WHERE id = ?")
      .get(pedido.cliente_id as string) as { id: string; nome: string; pasta: string } | undefined;
    if (cli) return cli;
  }
  const cli = ensureCliente({ id: user.id, nome: user.nome }, pedido.cliente as string);
  db.prepare("UPDATE pedidos SET cliente_id = ? WHERE id = ?").run(cli.id, pedido.id as string);
  return cli;
}

export const uploadAnexo = createServerFn({ method: "POST" })
  .validator(
    z.object({
      pedidoId: z.string().min(1),
      tipo: z.enum(["anexo", "referencia", "faca", "arte", "logo"]),
      nome: z.string().min(1),
      dataBase64: z.string().min(1).max(MAX_BASE64),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "anexo.upload");
    const db = getDb();
    const pedido = getPedidoComAcesso(user, data.pedidoId);
    const cliente = clienteDoPedido(user, pedido);

    const conteudo = Buffer.from(data.dataBase64, "base64");
    const { fullPath, nomeSalvo } = saveClienteFile(
      clientePastaFullPath(cliente.pasta),
      data.tipo,
      data.nome,
      conteudo,
    );

    const { versao } = db
      .prepare(
        "SELECT COALESCE(MAX(versao), 0) + 1 AS versao FROM pedido_anexos WHERE pedido_id = ? AND tipo = ?",
      )
      .get(data.pedidoId, data.tipo) as { versao: number };

    const id = uuid();
    db.prepare(
      "INSERT INTO pedido_anexos (id, pedido_id, user_id, tipo, nome, path, versao, created_at) VALUES (?,?,?,?,?,?,?,?)",
    ).run(id, data.pedidoId, user.id, data.tipo, nomeSalvo, fullPath, versao, agora());

    if (data.tipo === "arte") {
      notifyUsers(
        [pedido.vendedor_id as string, ...usersWithRoles(["gestor", "admin"])],
        user.id,
        "Arte enviada",
        `${pedido.cliente} — ${nomeSalvo} (v${versao})`,
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
        `${pedido.cliente} — ${nomeSalvo}`,
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

    const conteudo = readClienteFile(anexo.path);
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

    // Pode tirar da lista: quem enviou, quem tem etapa de design, ou quem edita tudo.
    const podeApagar =
      anexo.user_id === user.id ||
      user.role === "admin" ||
      user.permissions.includes("pedidos.status_design") ||
      user.permissions.includes("pedidos.editar_todos");
    if (!podeApagar) throw new Error("Sem permissão para tirar este anexo do pedido.");

    /* Tira só o VÍNCULO. O arquivo continua na pasta do cliente: o hub não
       apaga nada em \\server\Arte\Clientes (ver a regra em files.server.ts).
       Aquele acervo é de anos e às vezes é o único exemplar da arte. */
    db.prepare("DELETE FROM pedido_anexos WHERE id = ?").run(data.anexoId);

    audit({ id: user.id, nome: user.nome }, "anexo.desvincular", "pedido_anexos", anexo.id, {
      pedido: pedido.numero,
      tipo: anexo.tipo,
      arquivo: anexo.nome,
      caminho: anexo.path,
      observacao: "arquivo mantido na pasta do cliente",
    });
    return { ok: true, arquivoMantido: anexo.path };
  });

export const listPastaCliente = createServerFn({ method: "POST" })
  .validator(z.object({ pedidoId: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const pedido = getPedidoComAcesso(user, data.pedidoId);
    const cliente = clienteDoPedido(user, pedido);
    const caminho = clientePastaFullPath(cliente.pasta);
    return { caminho, arquivos: listClienteFiles(caminho) };
  });
