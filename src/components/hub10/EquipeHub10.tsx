// Equipe no molde do hub atual (Augusto, 02/10/2026: "a página equipe também
// para o novo design"; decisão dele: mesma estrutura, no v4). O conteúdo e as
// ações são os da Equipe antiga (EquipeV1a): pessoas, cargos e logs;
// permissões por pessoa, com o que difere do padrão do cargo; criar,
// renomear, resetar senha, encerrar sessões, ativar e excluir; cargos como
// modelos de permissão. Muda a casca, e tudo mora na grade (a lição das
// Preferências, que ele recusou fora dela):
// - a página no cinza, sem a faixa preta, com a barra do 1.0 no topo;
// - dois painéis brancos da linha 9 à 51, como as etapas da Solicitação: o
//   das pessoas (ou dos cargos) com 440 na c1, a largura do cartão v4, e o do
//   miolo da c7 à c23, com o texto na c8 e as permissões em três colunas que
//   começam na c8, na c13 e na c18;
// - os logs num painel só, da c1 à c23, com as colunas na c2, c6 e c14 e o
//   "Quando" terminando na c22;
// - no pé, "Equipe" em Fraunces 104 com a tinta na c1 e a base na linha 63,
//   as abas em pílula (a aberta acesa no amarelo do hub) e a ação de criar
//   terminando na c23, como o "Sair" das etapas.
// As listas compridas (pessoas, permissões, logs) rolam dentro do painel, com
// o aviso de que há mais embaixo.
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { AMARELO, BarraTopoHub10, FR, FUNDO_PAGINA, INTER, LINHA_DA_GRADE_HUB, NIVEL, PRETO, PalcoFixo, useEscDoTopo, vigiarRolagem } from "./ChromeHub10";
import { tituloDoPeV4 } from "./CapaV4Hub10";
import { ACERTO_IN, baseFraunces, baseInter, folga, folgaFR, folgaIN } from "./grade-hub10";
import { AvisoV1a } from "../v1a/HubV1a";
import { GRUPOS, type Cargo, type LogEquipe, type Usuario } from "../v1a/EquipeV1a";
import { STATUS_LABELS } from "@/lib/api/pedidos.functions";
import { criarBusca } from "@/lib/busca";
import { erroLegivel } from "@/lib/erro-legivel";
import type { SessionUser } from "@/lib/session";
import { PALETA } from "@/lib/paleta-hub";

const LG = LINHA_DA_GRADE_HUB;
/** os painéis das etapas: da linha 9 à 51 */
const TOPO = 9 * LG;
const PE_PAINEL = 51 * LG;
/** o painel da lista (pessoas ou cargos): 440 na c1, a tinta 48 para dentro, como no cartão v4 */
const LISTA = { x: 80, w: 440, tinta: 128 };
/** o painel do miolo: da c7 à c23, a tinta na c8 e as três colunas na c8, c13 e c18 */
const MIOLO = { x: 560, w: 1280, tinta: 640, fim: 1760 };
const CINZA = "#8f8f8f";
const CINZA_FORTE = "#5b595b";
const LINHA_SUAVE = "rgba(37,36,37,.12)";
const VERMELHO = PALETA.perigo;
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const PILULA_ALT = 44.04;
const PILULA_BORDA = 2.21;
const SOMBRA = "7px 7px 42px rgba(0,0,0,.2)";

const PAINEL: CSSProperties = { position: "absolute", top: TOPO, height: PE_PAINEL - TOPO, background: "#fff", borderRadius: 20, boxShadow: SOMBRA };
const LIMPO: CSSProperties = { background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer", color: PRETO, textAlign: "left" };
/** a pílula do pé das etapas: 44 de altura, 0,85 acima da linha 63 */
const PILULA_PE: CSSProperties = {
  position: "absolute", top: 63 * LG - 0.85 - PILULA_ALT, height: PILULA_ALT, boxSizing: "border-box", border: `${PILULA_BORDA}px solid ${PRETO}`, borderRadius: 999,
  display: "flex", alignItems: "center", justifyContent: "center", padding: "2px 26px 0", fontFamily: INTER, fontSize: 20.5, fontWeight: 500,
  letterSpacing: "-.014em", color: PRETO, whiteSpace: "nowrap", cursor: "pointer", zIndex: 3,
};
/** a pílula pequena de dentro do painel (cargo, ações) */
const pilula = (acesa: boolean, extra?: CSSProperties): CSSProperties => ({
  display: "inline-flex", alignItems: "center", height: 36, boxSizing: "border-box", padding: "1px 16px 0", border: `1.5px solid ${PRETO}`, borderRadius: 999,
  background: acesa ? AMARELO : undefined, color: PRETO, fontFamily: INTER, fontSize: 16, fontWeight: 500, letterSpacing: "-.01em", whiteSpace: "nowrap", cursor: "pointer", ...extra,
});
/* os campos das caixas: os da caixa "Design criado" */
const CAMPO: CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#fff", border: "1.5px solid #d9d8d6", borderRadius: 11, padding: "12px 14px",
  fontFamily: INTER, fontSize: 18, fontWeight: 600, lineHeight: 1.2, color: PRETO, outline: "none",
};
const ROTULO_CAMPO: CSSProperties = { display: "block", fontFamily: INTER, fontSize: 13, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#8a8a8a", marginBottom: 8 };

/** Fraunces com a tinta da 1ª letra em x e a base em `base`. */
function frEm(texto: string, corpo: number, x: number, base: number): CSSProperties {
  return {
    position: "absolute", left: x - folgaFR(corpo, texto.charAt(0)), top: base - baseFraunces(corpo, corpo),
    ...FR, fontSize: corpo, lineHeight: `${corpo}px`, letterSpacing: "-.02em", whiteSpace: "nowrap", color: PRETO,
  };
}
/** Inter com a tinta da 1ª letra em x e a base da 1ª linha em `base`. */
function interEm(texto: string, corpo: number, x: number, base: number, lh: number, peso = 400, italico = false): CSSProperties {
  const c = texto.charAt(0);
  const f = italico ? folga(`italic ${peso} ${corpo}px Inter`, c, 1) + (ACERTO_IN[`${corpo}/${peso}i${c}`] ?? 0.8) : folgaIN(peso, corpo, c);
  return {
    position: "absolute", left: x - f, top: base - baseInter(corpo, lh),
    fontFamily: INTER, fontSize: corpo, fontWeight: peso, fontStyle: italico ? "italic" : "normal", lineHeight: `${lh}px`, color: PRETO,
  };
}

/** A caixa de marcar das permissões: acesa no amarelo do hub. */
function Marca({ on }: { on: boolean }) {
  return (
    <span aria-hidden style={{ flex: "none", width: 22, height: 22, boxSizing: "border-box", display: "grid", placeItems: "center", borderRadius: 6, background: on ? AMARELO : "#fff", border: `1.5px solid ${on ? PRETO : "#cfcccd"}` }}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={on ? PRETO : "transparent"} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 12.5 4 4 8-9" /></svg>
    </span>
  );
}

/* Os logs em português da fábrica (simulação 5, 05/10/2026): a aba mostrava a
   chave crua da auditoria ("anexo.upload", "pedido.criar") e o detalhe como o
   banco guarda, com o caminho da máquina. Cada ação conhecida ganha a frase de
   quem fez; a desconhecida vira texto a partir da própria chave. Onde há um
   segundo item, ele é a área da pílula: a rota tira a área do começo da chave,
   e "login", "logout" e "cargo.*" caíam em "Sistema". */
const ACOES_LOG: Record<string, string | [string, string]> = {
  login: ["Entrou no hub", "Sessões"], logout: ["Saiu do hub", "Sessões"],
  "usuario.primeira_senha": "Trocou a senha provisória", "usuario.trocar_senha": "Trocou a própria senha",
  "pedido.criar": "Criou pedido", "pedido.editar": "Editou pedido", "pedido.status": "Moveu pedido", "pedido.excluir": "Excluiu pedido",
  "pedido.perguntar": "Fez pergunta", "pedido.responder": "Respondeu pergunta", "pedido.comentar": "Comentou no pedido",
  "pedido.responder_cliente": "Respondeu o cliente", "pedido.prova_enviar": "Enviou prova de impressão", "pedido.transferir": "Transferiu carteira",
  "pedido.confirmar_pasta": "Confirmou a pasta do cliente", "pedido.aguardar_cliente": "Marcou aguardando cliente", "pedido.cliente_respondeu": "Registrou a resposta do cliente",
  "anexo.upload": "Anexou arquivo", "anexo.desvincular": "Desvinculou anexo", "anexo.excluir": "Tirou anexo do pedido",
  "cliche.registrar": "Registrou a chegada do clichê", "cliche.corrigir": "Corrigiu a chegada do clichê", "cliche.solicitar": "Solicitou clichê",
  "cliche.refazer_antigo": "Cadastrou refação de clichê", "cliche.voltar_clicheria": "Voltou o pedido para a clicheria", "cliche.motivo_criar": "Criou motivo de clichê",
  "cliente.criar_pasta": "Criou pasta do cliente", "cliente.usar_pasta": "Usou pasta existente",
  "usuario.criar": "Criou usuário", "usuario.editar": "Editou usuário", "usuario.excluir": "Excluiu usuário",
  "usuario.resetar_senha": "Resetou senha", "usuario.forcar_logout": "Encerrou sessões",
  "permissao.alterar": "Mudou permissão", "permissao.aplicar_template": "Aplicou padrão do cargo",
  "cargo.criar": ["Criou cargo", "Administração"], "cargo.editar": ["Editou modelo do cargo", "Administração"], "cargo.excluir": ["Excluiu cargo", "Administração"],
  "faca.enviar_afiacao": "Enviou faca para afiação", "faca.receber": "Recebeu faca da afiação", "faca.solicitar_nova": "Pediu faca nova",
  "faca.nova_pedida": "Marcou faca nova como pedida", "faca.nova_pedida_desfeita": "Desmarcou faca nova pedida", "faca.marcar_morta": "Marcou faca como morta",
  "faca.restaurar": "Restaurou faca", "faca.catalogo_add": "Incluiu faca no catálogo", "faca.secao_add": "Criou seção de facas", "faca.substrato_criar": "Criou substrato de faca",
  "home.editar": "Editou a Home", "home.video": "Trocou o vídeo da Home", "central.video": "Trocou o vídeo da Central", "pagina.video": "Trocou o vídeo de uma página",
  "video.upload": "Enviou vídeo", "papel.upload": "Enviou papel de parede", "pantone.atualizar": "Atualizou a tabela Pantone",
  "arquivo.semear": "Carregou o cadastro do Arquivo", "arquivo.excluir": "Excluiu pasta do cadastro do Arquivo",
  "cadastro.criar": "Criou cadastro", "cadastro.excluir": "Excluiu cadastro", "sugestao.enviar": "Enviou sugestão", "leitura.registrar": "Registrou leitura de OP",
};
/* os rótulos do ROTULO_CAMPO de pedidos.functions.ts, que lá não é exportado */
const CAMPO_PEDIDO: Record<string, string> = {
  cliente: "Cliente", materia: "Matéria-prima", larg_materia: "Bobina", largura: "Largura", altura: "Altura", forma: "Forma",
  cores: "Número de cores", cores_desc: "Cores", carreiras: "Carreiras", descricao: "Briefing", link_ref: "Link de referência",
  tarja_verso: "Tarja no verso", verniz: "Verniz", cold_stamp: "Cold stamp", picote: "Picote", urgente: "Urgência", faca_cod: "Faca", faca_nova: "Faca nova",
};
/* o que entra no detalhe, nesta ordem; o resto (tipo, versão, e-mail, caminho) é técnico */
const CAMPOS_LOG = ["cliente", "nomeAgora", "nome", "pasta", "arquivo", "livro", "usuario", "username", "role", "cargo", "permissao", "label", "op", "medida", "substrato", "tela", "video", "titulo", "motivo", "observacao"];

/** O detalhe chega da rota (hub.tsx) como o JSON sem chaves nem aspas e
    cortado em 90 letras: "pedido:3,tipo:anexo,arquivo:textos.txt,caminho:C:\\Users\\...".
    Aqui ele volta a campos. */
function camposDoLog(bruto: string | null | undefined): Record<string, string> {
  const s = (bruto ?? "").trim();
  const partes = s ? s.split(/,(?=[A-Za-z_]\w*:)/) : [];
  const campos: Record<string, string> = {};
  partes.forEach((p, i) => {
    const k = p.indexOf(":");
    if (k < 1) return;
    const chave = p.slice(0, k);
    let v = p.slice(k + 1);
    /* o último campo pode ter chegado pela metade (o corte de 90 da rota); se
       o corte caiu no nome do campo seguinte (",motivoLiv"), o valor está inteiro */
    let cortado = i === partes.length - 1 && s.length >= 90;
    const inteiro = cortado ? /^(.*),(?:[A-Za-z_]\w*)?$/.exec(v) : null;
    if (inteiro) { v = inteiro[1]; cortado = false; }
    /* desfaz o escape do JSON: a quebra de linha vira espaço e a barra dupla, uma barra */
    v = v.replace(/\\(.)/g, (_, ch: string) => (ch === "n" || ch === "t" ? " " : ch)).trim();
    /* caminho da máquina não aparece: fica só o nome do fim, e nada se o caminho veio cortado */
    if (v.includes("\\") || chave === "pasta" || chave === "caminho") v = cortado ? "" : v.split("\\").filter(Boolean).pop() ?? "";
    else if (cortado && v) v += "…";
    campos[chave] = v;
  });
  return campos;
}

/** A ação como quem fez diria: "Anexou arquivo", "Revogou permissão". */
function acaoDoLog(acao: string, c: Record<string, string>): string {
  if (acao === "permissao.alterar" && c.habilitada) return c.habilitada.startsWith("t") ? "Liberou permissão" : "Revogou permissão";
  if (acao === "usuario.editar") {
    const campo = Object.keys(c).find((k) => c[k].startsWith("de:"));
    if (campo === "ativo" && c.para) return c.para.startsWith("t") ? "Ativou usuário" : "Desativou usuário";
    if (campo === "role") return "Trocou o cargo";
    if (campo === "nome") return "Renomeou usuário";
  }
  const t = ACOES_LOG[acao];
  if (t) return typeof t === "string" ? t : t[0];
  const [area, ...resto] = acao.split(".");
  const frase = (resto.length ? `${area}: ${resto.join(" ")}` : area).replace(/_/g, " ").trim();
  return frase ? frase.charAt(0).toUpperCase() + frase.slice(1) : "Ação sem nome";
}

/** O detalhe legível: o pedido como o hub escreve (#03), o arquivo, a pessoa, a etapa. */
function detalheDoLog(acao: string, c: Record<string, string>, rotuloCargo: (nome: string) => string, rotuloPerm: (chave: string) => string): string {
  const seta = (de?: string, para?: string) => (de || para ? `${de || "?"} → ${para || "?"}` : "");
  const etapa = (k?: string) => (k ? STATUS_LABELS[k] ?? k : "");
  if (acao === "pedido.status") return seta(etapa(c.de), etapa(c.para));
  if (acao === "pedido.transferir") return seta(c.de, c.para);
  if (acao === "pedido.editar" || acao === "usuario.editar") {
    /* a mudança vem como "campo:de:antes,para:depois" */
    const mudou = Object.keys(c).filter((k) => c[k].startsWith("de:"));
    if (acao === "pedido.editar") return mudou.map((k) => CAMPO_PEDIDO[k] ?? k.replace(/_/g, " ")).join(" · ");
    const campo = mudou[0];
    if (!campo || campo === "ativo") return "";
    const antes = c[campo].slice(3);
    return campo === "role" ? seta(rotuloCargo(antes), rotuloCargo(c.para ?? "")) : seta(antes, c.para);
  }
  if (acao === "arquivo.semear" && c.total) return `${c.total} pastas`;
  const partes: string[] = [];
  /* "numero" é o do pedido, menos nas facas e na solicitação de clichê antiga, que têm numeração própria */
  const num = c.pedido ?? (acao.startsWith("faca.") || (acao === "cliche.solicitar" && !c.codigo) ? undefined : c.numero);
  if (num && /^\d+$/.test(num)) partes.push(`#${num.padStart(2, "0")}`);
  if (acao === "pedido.perguntar" && c.para) partes.push(`para ${c.para}`);
  let textos = 0;
  for (const k of CAMPOS_LOG) {
    const v = c[k];
    if (!v || textos === 3) continue;
    const texto = k === "username" ? `@${v}` : k === "role" || k === "cargo" ? rotuloCargo(v) : k === "permissao" ? rotuloPerm(v) : v;
    /* a pasta do cliente costuma ter o nome dele: não repete */
    if (partes.includes(texto)) continue;
    textos++;
    partes.push(texto);
  }
  return partes.join(" · ");
}

type Aba = "usuarios" | "cargos" | "logs";
type Form = { tipo: "usuario" | "nome" | "senha" | "cargo"; alvo?: Usuario; cargo?: Cargo };
type Confirmar = { tipo: "usuario"; alvo: Usuario } | { tipo: "desativar"; alvo: Usuario } | { tipo: "cargo"; cargo: Cargo };

export function EquipeHub10({
  profile, aoNavegar, onNova, onLogout, disponiveis, children,
  usuarios, cargos: cargosReais, logs, permissoesTodas,
  aoTrocarCargo, aoTogglePermissao, aoAplicarPadrao, aoAtivar, aoExcluirUsuario,
  aoForcarLogout, aoRenomear, aoResetarSenha, aoCriarUsuario, aoSalvarCargo, aoExcluirCargo,
}: {
  profile: SessionUser;
  aoNavegar: (pagina: string) => void;
  onNova?: () => void;
  onLogout: () => void;
  disponiveis?: string[];
  /** caixas hospedadas pela rota, desenhadas dentro do palco */
  children?: ReactNode;
  usuarios?: Usuario[];
  cargos?: Cargo[];
  logs?: LogEquipe[];
  /** as chaves de permissão que existem no servidor; sem elas não há editor de permissões */
  permissoesTodas?: string[];
  aoTrocarCargo?: (id: string, cargo: string) => Promise<unknown>;
  aoTogglePermissao?: (id: string, permissao: string, ligar: boolean) => Promise<unknown>;
  aoAplicarPadrao?: (id: string) => Promise<unknown>;
  aoAtivar?: (id: string, ativo: boolean) => Promise<unknown>;
  aoExcluirUsuario?: (id: string) => Promise<unknown>;
  aoForcarLogout?: (id: string) => Promise<unknown>;
  aoRenomear?: (id: string, nome: string) => Promise<unknown>;
  aoResetarSenha?: (id: string, senha: string) => Promise<unknown>;
  aoCriarUsuario?: (d: { nome: string; username: string; senha: string; cargo: string }) => Promise<unknown>;
  aoSalvarCargo?: (d: { nome: string; label: string; permissoes: string[]; novo: boolean }) => Promise<unknown>;
  aoExcluirCargo?: (nome: string) => Promise<unknown>;
}) {
  const USUARIOS = usuarios ?? [];
  const CARGOS = cargosReais ?? [];
  const LOGS = logs ?? [];
  const carregando = !usuarios;

  /* Editar permissão exige `permissoes.gerenciar`, e é ela que libera o
     catálogo de chaves; sem o catálogo não há nada verdadeiro a mostrar no
     editor (a regra da Equipe antiga). */
  const podeMexerEmPerms = !!permissoesTodas;
  const CHAVES = new Set(permissoesTodas ?? []);
  const GRUPOS_VIS = GRUPOS.map((g) => ({ ...g, permissoes: g.permissoes.filter(([k]) => CHAVES.has(k)) })).filter((g) => g.permissoes.length);
  const TOTAL = permissoesTodas?.length ?? 0;
  const cargoDe = (nome: string) => CARGOS.find((c) => c.nome === nome) ?? { nome, label: nome || "Sem cargo", sistema: false, perms: [] as string[] };

  const permsIniciais = () => USUARIOS.reduce<Record<string, string[]>>((m, u) => ({ ...m, [u.id]: (u.perms ?? cargoDe(u.cargo).perms).slice() }), {});
  const [aba, setAba] = useState<Aba>("usuarios");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [selCargo, setSelCargo] = useState<string | null>(null);
  const [cargos, setCargos] = useState<Record<string, string>>({});
  const [perms, setPerms] = useState<Record<string, string[]>>({});
  const [aviso, setAviso] = useState<{ texto: string; tipo: "ok" | "alerta" } | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [confirmar, setConfirmar] = useState<Confirmar | null>(null);

  /* o servidor é a fonte da verdade: a cada recarga a tela volta ao que ele tem */
  const assinatura = JSON.stringify(USUARIOS.map((u) => [u.id, u.cargo, (u.perms ?? []).join(",")])) + JSON.stringify(CARGOS.map((c) => [c.nome, c.perms.length]));
  useEffect(() => {
    setCargos(USUARIOS.reduce((a, u) => ({ ...a, [u.id]: u.cargo }), {}));
    setPerms(permsIniciais());
    setSel((s) => (s && USUARIOS.some((u) => u.id === s) ? s : USUARIOS[0]?.id ?? null));
    setSelCargo((s) => (s && CARGOS.some((c) => c.nome === s) ? s : CARGOS[0]?.nome ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  const avisar = (texto: string, tipo: "ok" | "alerta" = "ok") => setAviso({ texto, tipo });
  const falhou = (e: unknown) => avisar(erroLegivel(e, "Não foi possível salvar."), "alerta");

  /* Marcar antes de o servidor confirmar deixa a resposta imediata; se ele
     recusar, a marca volta (em tela de permissão, um visto que não vale é
     grave). */
  const desfazer = (id: string, chaves: string[], ligar: boolean) => (e: unknown) => {
    falhou(e);
    setPerms((s) => {
      const atual = new Set(s[id] ?? []);
      chaves.forEach((k) => (ligar ? atual.delete(k) : atual.add(k)));
      return { ...s, [id]: [...atual] };
    });
  };
  const togglePerm = (id: string, p: string) => {
    const ligar = !(perms[id] ?? []).includes(p);
    setPerms((s) => { const a = s[id] ?? []; return { ...s, [id]: a.includes(p) ? a.filter((x) => x !== p) : [...a, p] }; });
    if (aoTogglePermissao) Promise.resolve(aoTogglePermissao(id, p, ligar)).catch(desfazer(id, [p], ligar));
  };
  const setGrupo = (id: string, chaves: string[], ligar: boolean) => {
    const atuais = new Set(perms[id] ?? []);
    const mudar = chaves.filter((k) => atuais.has(k) !== ligar);
    setPerms((s) => { const a = new Set(s[id] ?? []); chaves.forEach((k) => (ligar ? a.add(k) : a.delete(k))); return { ...s, [id]: [...a] }; });
    if (aoTogglePermissao) {
      /* se a 3ª falhar, só as que faltaram voltam: as aceitas continuam */
      const feitas: string[] = [];
      mudar.reduce((p, k) => p.then(() => Promise.resolve(aoTogglePermissao(id, k, ligar)).then(() => { feitas.push(k); })), Promise.resolve())
        .catch((e) => desfazer(id, mudar.filter((k) => !feitas.includes(k)), ligar)(e));
    }
  };

  const casa = criarBusca(busca);
  const lista = USUARIOS.filter((u) => casa(u.nome, u.username, cargoDe(cargos[u.id] ?? u.cargo).label));
  const usos: Record<string, number> = {};
  USUARIOS.forEach((u) => { const c = cargos[u.id] ?? u.cargo; usos[c] = (usos[c] || 0) + 1; });
  const ativos = USUARIOS.filter((u) => u.ativo).length;

  const selUser = USUARIOS.find((u) => u.id === sel) ?? null;
  const selPerms = selUser ? perms[selUser.id] ?? [] : [];
  const cargoSel = cargoDe(selUser ? cargos[selUser.id] ?? selUser.cargo : "");
  const selAdmin = cargoSel.nome === "admin";
  const cargoAberto = CARGOS.find((c) => c.nome === selCargo) ?? null;
  /* O Administrador entra em tudo no servidor, qualquer que seja a lista do
     cargo (auth.server.ts: o cargo "admin" passa direto em toda permissão). A
     aba Cargos contava a lista e mostrava 74 de 76, menos que o Gestor,
     enquanto a ficha da pessoa dizia acesso total (simulação 5, 05/10/2026). */
  const acessoTotal = (nome: string) => nome === "admin";
  const cargoAbertoTotal = !!cargoAberto && acessoTotal(cargoAberto.nome);
  const rotuloCargo = (nome: string) => cargoDe(nome).label;
  const rotuloPerm = (chave: string) => {
    for (const g of GRUPOS) for (const [k, rotulo] of g.permissoes) if (k === chave) return rotulo;
    return chave;
  };
  const naoEditavel = () => avisar("Administrador tem acesso total e não é editável.", "alerta");
  const desvio = (() => {
    if (!selUser) return "";
    if (selAdmin) return "Administrador do sistema, com acesso total.";
    const extra = selPerms.filter((p) => !cargoSel.perms.includes(p)).length;
    const falta = cargoSel.perms.filter((p) => !selPerms.includes(p)).length;
    if (!extra && !falta) return `Igual ao padrão do cargo ${cargoSel.label}.`;
    const partes = [extra ? `${extra} a mais` : "", falta ? `${falta} ${falta === 1 ? "revogada" : "revogadas"}` : ""].filter(Boolean);
    return `${partes.join(" e ")} em relação ao padrão do cargo ${cargoSel.label}.`;
  })();

  /* pé: as abas depois do título, e a ação de criar na c23 */
  const tituloRef = useRef<HTMLDivElement | null>(null);
  const [fimTitulo, setFimTitulo] = useState(80 + 360);
  useEffect(() => {
    const el = tituloRef.current;
    if (!el) return;
    let vivo = true;
    void document.fonts?.ready.then(() => { if (vivo && el.isConnected) setFimTitulo(el.offsetLeft + el.offsetWidth); });
    return () => { vivo = false; };
  }, []);
  const xAbas = Math.max(480 - PILULA_BORDA / 2, Math.ceil(fimTitulo + 44));

  const fecharForm = useCallback(() => setForm(null), []);
  const fecharConfirmar = useCallback(() => setConfirmar(null), []);
  useEscDoTopo(!!form, NIVEL.caixa, fecharForm);
  useEscDoTopo(!!confirmar, NIVEL.caixa + 1, fecharConfirmar);

  const acaoConta = (rotulo: string, onClick: () => void, perigo = false) => (
    <button key={rotulo} type="button" onClick={onClick} className="np4-pilula" style={pilula(false, perigo ? { borderColor: VERMELHO, color: VERMELHO } : undefined)}>{rotulo}</button>
  );

  return (
    <PalcoFixo>
      <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: FUNDO_PAGINA, zIndex: 0 }} />
      <div style={{ position: "absolute", inset: 0 }} inert={!!form || !!confirmar}>

        {/* pessoas */}
        {aba === "usuarios" && (
          <>
            <div aria-hidden style={{ ...PAINEL, left: LISTA.x, width: LISTA.w, zIndex: 2 }} />
            <div style={{ ...frEm("Pessoas", 40, LISTA.tinta, 14 * LG), zIndex: 3 }}>Pessoas</div>
            <div style={{ ...interEm("0", 18, LISTA.tinta, 16 * LG, 24), color: CINZA, whiteSpace: "nowrap", zIndex: 3 }}>
              {carregando ? "Lendo a equipe…" : `${ativos} ${ativos === 1 ? "ativa" : "ativas"} de ${USUARIOS.length}`}
            </div>
            <label style={{ position: "absolute", left: LISTA.tinta, top: 18 * LG, width: LISTA.w - 96, height: 37, boxSizing: "border-box", display: "flex", alignItems: "center", background: FUNDO_PAGINA, borderRadius: 6, cursor: "text", zIndex: 3 }}>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="PESQUISA" aria-label="Pesquisar pessoa" spellCheck={false} autoComplete="off"
                style={{ width: "100%", height: "100%", border: "none", outline: "none", background: "none", textAlign: busca ? "left" : "center", padding: busca ? "0 14px" : 0,
                  font: `600 14px/1 ${INTER}`, letterSpacing: busca ? 0 : ".08em", color: PRETO }} />
            </label>
            <div ref={vigiarRolagem} className="p10-rola" role="listbox" aria-label="Pessoas"
              style={{ position: "absolute", left: LISTA.tinta - 12, top: 21.5 * LG, width: LISTA.w - 96 + 24, height: PE_PAINEL - 21.5 * LG - 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, zIndex: 3, ["--fundo" as string]: "#fff" } as CSSProperties}>
              {lista.map((u) => {
                const on = u.id === sel;
                const cg = cargoDe(cargos[u.id] ?? u.cargo);
                return (
                  <button key={u.id} type="button" role="option" aria-selected={on} onClick={() => setSel(u.id)} className={on ? undefined : "p10-linha"}
                    style={{ ...LIMPO, flex: "none", display: "flex", alignItems: "center", gap: 12, minHeight: 3 * LG, padding: "6px 12px", borderRadius: 10, background: on ? AMARELO : "transparent", opacity: u.ativo ? 1 : 0.55 }}>
                    <span aria-hidden style={{ flex: "none", width: 32, height: 32, borderRadius: 999, display: "grid", placeItems: "center", background: on ? PRETO : FUNDO_PAGINA, color: on ? AMARELO : PRETO, fontFamily: INTER, fontSize: 15, fontWeight: 700 }}>
                      {(u.nome || "?").charAt(0).toUpperCase()}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: INTER, fontSize: 18, fontWeight: 600, lineHeight: "22px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {u.nome}{u.eu ? <span style={{ fontWeight: 400, color: CINZA_FORTE }}> (você)</span> : null}
                      </span>
                      <span style={{ display: "block", fontFamily: INTER, fontSize: 14, lineHeight: "18px", color: CINZA_FORTE, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        @{u.username}, {cg.label}{u.ativo ? "" : ", inativa"}{u.sessoes > 0 ? `, ${u.sessoes} ${u.sessoes === 1 ? "sessão aberta" : "sessões abertas"}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
              {!carregando && !lista.length && (
                <span style={{ padding: "10px 12px", fontFamily: INTER, fontSize: 16, color: CINZA }}>{busca ? "Ninguém com esse nome ou login." : "Nenhuma pessoa cadastrada."}</span>
              )}
            </div>

            {/* a pessoa escolhida: conta, cargo e permissões */}
            <div aria-hidden style={{ ...PAINEL, left: MIOLO.x, width: MIOLO.w, zIndex: 1 }} />
            {selUser ? (
              <>
                <div style={{ ...frEm(selUser.nome, 48, MIOLO.tinta, 14 * LG), maxWidth: 820, overflow: "hidden", textOverflow: "ellipsis", zIndex: 3 }} title={selUser.nome}>{selUser.nome}</div>
                {podeMexerEmPerms && (
                  <div style={{ position: "absolute", right: 1920 - MIOLO.fim, top: 14 * LG - baseFraunces(48, 48), ...FR, fontSize: 48, lineHeight: "48px", letterSpacing: "-.02em", whiteSpace: "nowrap", zIndex: 3 }}
                    title="Permissões ligadas de todas as que existem">
                    {selAdmin ? TOTAL : selPerms.length}<span style={{ color: CINZA }}>/{TOTAL}</span>
                  </div>
                )}
                <div style={{ ...interEm("@", 18, MIOLO.tinta, 16 * LG, 24), width: MIOLO.fim - MIOLO.tinta, color: CINZA_FORTE, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", zIndex: 3 }}>
                  @{selUser.username}{selUser.ativo ? "" : ", inativa"}. {desvio}
                </div>

                {/* o cargo (a pessoa não troca o próprio; o de administrador é do sistema) */}
                <div style={{ position: "absolute", left: MIOLO.tinta, top: 18 * LG, width: MIOLO.fim - MIOLO.tinta, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, zIndex: 3 }}>
                  <span style={{ fontFamily: INTER, fontSize: 16, fontWeight: 600, marginRight: 6 }}>Cargo</span>
                  {CARGOS.map((c) => {
                    const on = c.nome === cargoSel.nome;
                    const travado = selUser.eu || c.nome === "admin" || cargoSel.nome === "admin";
                    return (
                      <button key={c.nome} type="button" aria-pressed={on} disabled={on}
                        onClick={() => {
                          if (selUser.eu) { avisar("Você não troca o próprio cargo.", "alerta"); return; }
                          if (c.nome === "admin" || cargoSel.nome === "admin") { avisar("O cargo Administrador é do sistema e não troca por aqui.", "alerta"); return; }
                          setCargos((s) => ({ ...s, [selUser.id]: c.nome }));
                          setPerms((s) => ({ ...s, [selUser.id]: c.perms.slice() }));
                          if (aoTrocarCargo) Promise.resolve(aoTrocarCargo(selUser.id, c.nome)).then(() => avisar(`${selUser.nome} agora é ${c.label}.`)).catch(falhou);
                        }}
                        className="np4-pilula" style={pilula(on, { cursor: on ? "default" : "pointer", opacity: travado && !on ? 0.4 : 1 })}>{c.label}</button>
                    );
                  })}
                </div>
                {/* as ações da conta */}
                <div style={{ position: "absolute", left: MIOLO.tinta, top: 21.5 * LG, width: MIOLO.fim - MIOLO.tinta, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, zIndex: 3 }}>
                  {acaoConta("Nome", () => setForm({ tipo: "nome", alvo: selUser }))}
                  {acaoConta("Resetar senha", () => setForm({ tipo: "senha", alvo: selUser }))}
                  {selUser.sessoes > 0 && !selUser.eu && acaoConta("Encerrar sessões", () => {
                    if (!aoForcarLogout) return;
                    Promise.resolve(aoForcarLogout(selUser.id)).then(() => avisar(`Sessões de ${selUser.nome} encerradas.`)).catch(falhou);
                  })}
                  {acaoConta(selUser.ativo ? "Desativar" : "Ativar", () => {
                    if (!aoAtivar) return;
                    if (selUser.eu) { avisar("Você não pode desativar a si mesmo.", "alerta"); return; }
                    /* Desativar tira a pessoa do hub e derruba as sessões dela:
                       pede confirmação, como o Excluir. Ativar volta direto
                       (simulação 5, 05/10/2026). */
                    if (selUser.ativo) { setConfirmar({ tipo: "desativar", alvo: selUser }); return; }
                    Promise.resolve(aoAtivar(selUser.id, true)).then(() => avisar(`${selUser.nome} ativada.`)).catch(falhou);
                  })}
                  {acaoConta("Excluir", () => {
                    if (selUser.eu) { avisar("Você não pode excluir a si mesmo.", "alerta"); return; }
                    setConfirmar({ tipo: "usuario", alvo: selUser });
                  }, true)}
                </div>

                {/* as permissões, por grupo, em três colunas (c8, c13, c18) */}
                {podeMexerEmPerms ? (
                  <>
                    <div style={{ ...frEm("Permissões", 32, MIOLO.tinta, 26 * LG), zIndex: 3 }}>Permissões</div>
                    <div style={{ position: "absolute", right: 1920 - MIOLO.fim, top: 26 * LG - 30, display: "flex", gap: 8, zIndex: 3 }}>
                      <button type="button" className="np4-pilula" style={pilula(false)} onClick={() => {
                        if (selAdmin) { naoEditavel(); return; }
                        setPerms((s) => ({ ...s, [selUser.id]: cargoSel.perms.slice() }));
                        if (aoAplicarPadrao) Promise.resolve(aoAplicarPadrao(selUser.id)).then(() => avisar(`Padrão do cargo ${cargoSel.label} aplicado a ${selUser.nome}.`)).catch(falhou);
                      }}>Aplicar padrão do cargo</button>
                      <button type="button" className="np4-pilula" style={pilula(false)} onClick={() => { if (selAdmin) { naoEditavel(); return; } setGrupo(selUser.id, selPerms.slice(), false); }}>Revogar tudo</button>
                    </div>
                    <div ref={vigiarRolagem} className="p10-rola"
                      style={{ position: "absolute", left: MIOLO.tinta, top: 28 * LG, width: MIOLO.fim - MIOLO.tinta, height: PE_PAINEL - 28 * LG - 24, overflowY: "auto", zIndex: 3, ["--fundo" as string]: "#fff" } as CSSProperties}>
                      <div style={{ columnCount: 3, columnGap: 80 }}>
                        {GRUPOS_VIS.map((g) => {
                          const chaves = g.permissoes.map((p) => p[0]);
                          const ligadas = chaves.filter((k) => selAdmin || selPerms.includes(k)).length;
                          const todas = ligadas === chaves.length;
                          return (
                            <section key={g.titulo} style={{ breakInside: "avoid", paddingBottom: 22 }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                                <span style={{ fontFamily: INTER, fontSize: 17, fontWeight: 700 }}>{g.titulo}</span>
                                <span style={{ fontFamily: INTER, fontSize: 15, color: CINZA }}>{ligadas}/{chaves.length}</span>
                                <button type="button" onClick={() => { if (selAdmin) { naoEditavel(); return; } setGrupo(selUser.id, chaves, !todas); }} className="p10-flat"
                                  style={{ ...LIMPO, marginLeft: "auto", fontFamily: INTER, fontSize: 14, color: CINZA_FORTE, textDecoration: "underline", textUnderlineOffset: 3 }}>{todas ? "Desmarcar todas" : "Marcar todas"}</button>
                              </div>
                              {g.permissoes.map(([k, rotulo]) => {
                                const on = selAdmin || selPerms.includes(k);
                                const difere = !selAdmin && on !== cargoSel.perms.includes(k);
                                return (
                                  <button key={k} type="button" role="checkbox" aria-checked={on} title={k} onClick={() => { if (selAdmin) { naoEditavel(); return; } togglePerm(selUser.id, k); }}
                                    className="p10-linha" style={{ ...LIMPO, display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "5px 6px", borderRadius: 8 }}>
                                    <Marca on={on} />
                                    <span style={{ flex: 1, minWidth: 0, fontFamily: INTER, fontSize: 15, lineHeight: "19px" }}>
                                      {rotulo}
                                      {difere && <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: VERMELHO }}>{on ? "Fora do padrão do cargo" : "Revogada do padrão do cargo"}</span>}
                                    </span>
                                  </button>
                                );
                              })}
                            </section>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ ...interEm("S", 18, MIOLO.tinta, 27 * LG, 24), width: MIOLO.fim - MIOLO.tinta, color: CINZA, zIndex: 3 }}>
                    Seu acesso não inclui mexer nas permissões. A lista e as ações da conta continuam aqui.
                  </div>
                )}
              </>
            ) : (
              <div style={{ ...interEm(carregando ? "L" : "E", 20, MIOLO.tinta, 14 * LG, 28), color: CINZA, zIndex: 3 }}>{carregando ? "Lendo a equipe…" : "Escolha uma pessoa na lista."}</div>
            )}
          </>
        )}

        {/* cargos */}
        {aba === "cargos" && (
          <>
            <div aria-hidden style={{ ...PAINEL, left: LISTA.x, width: LISTA.w, zIndex: 2 }} />
            <div style={{ ...frEm("Cargos", 40, LISTA.tinta, 14 * LG), zIndex: 3 }}>Cargos</div>
            <div style={{ ...interEm("0", 18, LISTA.tinta, 16 * LG, 24), color: CINZA, whiteSpace: "nowrap", zIndex: 3 }}>
              {CARGOS.length} {CARGOS.length === 1 ? "cargo" : "cargos"}, {CARGOS.filter((c) => c.sistema).length} do sistema
            </div>
            <div ref={vigiarRolagem} className="p10-rola" role="listbox" aria-label="Cargos"
              style={{ position: "absolute", left: LISTA.tinta - 12, top: 18 * LG, width: LISTA.w - 96 + 24, height: PE_PAINEL - 18 * LG - 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, zIndex: 3, ["--fundo" as string]: "#fff" } as CSSProperties}>
              {CARGOS.map((c) => {
                const on = c.nome === selCargo;
                return (
                  <button key={c.nome} type="button" role="option" aria-selected={on} onClick={() => setSelCargo(c.nome)} className={on ? undefined : "p10-linha"}
                    style={{ ...LIMPO, flex: "none", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 3 * LG, padding: "6px 12px", borderRadius: 10, background: on ? AMARELO : "transparent" }}>
                    <span style={{ fontFamily: INTER, fontSize: 18, fontWeight: 600, lineHeight: "22px" }}>{c.label}</span>
                    <span style={{ fontFamily: INTER, fontSize: 14, lineHeight: "18px", color: CINZA_FORTE }}>
                      {usos[c.nome] || 0} {(usos[c.nome] || 0) === 1 ? "pessoa" : "pessoas"}, {acessoTotal(c.nome) ? "acesso total" : `${c.perms.length} de ${TOTAL || "?"} permissões`}{c.sistema ? ", do sistema" : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            <div aria-hidden style={{ ...PAINEL, left: MIOLO.x, width: MIOLO.w, zIndex: 1 }} />
            {cargoAberto ? (
              <>
                <div style={{ ...frEm(cargoAberto.label, 48, MIOLO.tinta, 14 * LG), zIndex: 3 }}>{cargoAberto.label}</div>
                <div style={{ ...interEm(String(usos[cargoAberto.nome] || 0), 18, MIOLO.tinta, 16 * LG, 24), color: CINZA_FORTE, whiteSpace: "nowrap", zIndex: 3 }}>
                  {usos[cargoAberto.nome] || 0} {(usos[cargoAberto.nome] || 0) === 1 ? "pessoa tem" : "pessoas têm"} este cargo.{" "}
                  {cargoAbertoTotal ? `Acesso total${TOTAL ? ` (${TOTAL} de ${TOTAL})` : ""}.` : `${cargoAberto.perms.length} de ${TOTAL || "?"} permissões no modelo.`}
                  {cargoAberto.sistema ? " Cargo do sistema: não se edita nem se exclui." : ""}
                </div>
                <div style={{ ...interEm("O", 18, MIOLO.tinta, 18.5 * LG, 24), width: MIOLO.fim - MIOLO.tinta, color: CINZA, zIndex: 3 }}>
                  {cargoAbertoTotal
                    ? "O Administrador não depende do modelo: o hub libera tudo para quem tem este cargo, e as permissões dele não se ajustam na aba Usuários."
                    : "O cargo é um modelo de permissões: é o que a pessoa recebe ao ser criada ou no “Aplicar padrão do cargo”. Depois, cada pessoa pode ser ajustada na aba Usuários."}
                </div>
                <div style={{ position: "absolute", left: MIOLO.tinta, top: 21.5 * LG, display: "flex", gap: 8, zIndex: 3 }}>
                  {/* cargo do sistema não se edita nem se exclui: o servidor recusa os dois (updateRole e deleteRole).
                      A cor da borda vai sempre: tirar só ela, com o border da pílula, faz o React reclamar na troca de cargo. */}
                  <button type="button" className="np4-pilula" disabled={cargoAberto.sistema}
                    style={pilula(false, cargoAberto.sistema ? { borderColor: "#cfcccd", color: "#b3b1b3", cursor: "not-allowed" } : { borderColor: PRETO })}
                    onClick={() => setForm({ tipo: "cargo", cargo: cargoAberto })}>Editar modelo</button>
                  <button type="button" className="np4-pilula" disabled={cargoAberto.sistema || !aoExcluirCargo}
                    style={pilula(false, cargoAberto.sistema ? { borderColor: "#cfcccd", color: "#b3b1b3", cursor: "not-allowed" } : { borderColor: VERMELHO, color: VERMELHO })}
                    onClick={() => setConfirmar({ tipo: "cargo", cargo: cargoAberto })}>Excluir cargo</button>
                </div>
                <div style={{ ...frEm("O que o modelo inclui", 32, MIOLO.tinta, 26 * LG), zIndex: 3 }}>O que o modelo inclui</div>
                <div ref={vigiarRolagem} className="p10-rola"
                  style={{ position: "absolute", left: MIOLO.tinta, top: 28 * LG, width: MIOLO.fim - MIOLO.tinta, height: PE_PAINEL - 28 * LG - 24, overflowY: "auto", zIndex: 3, ["--fundo" as string]: "#fff" } as CSSProperties}>
                  <div style={{ columnCount: 3, columnGap: 80 }}>
                    {GRUPOS_VIS.map((g) => {
                      const n = g.permissoes.filter(([k]) => cargoAbertoTotal || cargoAberto.perms.includes(k)).length;
                      return (
                        <section key={g.titulo} style={{ breakInside: "avoid", paddingBottom: 22 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                            <span style={{ fontFamily: INTER, fontSize: 17, fontWeight: 700 }}>{g.titulo}</span>
                            <span style={{ fontFamily: INTER, fontSize: 15, color: CINZA }}>{n}/{g.permissoes.length}</span>
                          </div>
                          {g.permissoes.map(([k, rotulo]) => {
                            const on = cargoAbertoTotal || cargoAberto.perms.includes(k);
                            return (
                              <div key={k} title={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 6px" }}>
                                <Marca on={on} />
                                <span style={{ flex: 1, minWidth: 0, fontFamily: INTER, fontSize: 15, lineHeight: "19px", color: on ? PRETO : CINZA }}>{rotulo}</span>
                              </div>
                            );
                          })}
                        </section>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ ...interEm("N", 20, MIOLO.tinta, 14 * LG, 28), color: CINZA, zIndex: 3 }}>{carregando ? "Lendo os cargos…" : "Nenhum cargo cadastrado."}</div>
            )}
          </>
        )}

        {/* logs: um painel só, da c1 à c23 */}
        {aba === "logs" && (
          <>
            <div aria-hidden style={{ ...PAINEL, left: 80, width: 1760, zIndex: 1 }} />
            {(["Quem", "Ação", "Detalhe"] as const).map((t, i) => (
              <div key={t} style={{ ...interEm(t, 16, [160, 480, 1120][i], 14 * LG, 20, 600), color: CINZA_FORTE, zIndex: 3 }}>{t}</div>
            ))}
            <div style={{ position: "absolute", right: 1920 - 1760, top: 14 * LG - baseInter(16, 20), fontFamily: INTER, fontSize: 16, fontWeight: 600, lineHeight: "20px", color: CINZA_FORTE, zIndex: 3 }}>Quando</div>
            <div ref={vigiarRolagem} className="p10-rola"
              style={{ position: "absolute", left: 136, top: 15.5 * LG, width: 1760 - 136 + 24, height: PE_PAINEL - 15.5 * LG - 24, overflowY: "auto", zIndex: 3, ["--fundo" as string]: "#fff" } as CSSProperties}>
              {LOGS.map((l, i) => {
                const acao = String(l.acao ?? "");
                const campos = camposDoLog(l.detalhe);
                const conhecida = ACOES_LOG[acao];
                const grupo = Array.isArray(conhecida) ? conhecida[1] : l.grupo;
                const detalhe = detalheDoLog(acao, campos, rotuloCargo, rotuloPerm);
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "320px 640px 1fr auto", alignItems: "center", minHeight: 3 * LG, padding: "0 24px", borderTop: i ? `1px solid ${LINHA_SUAVE}` : "none" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span aria-hidden style={{ flex: "none", width: 28, height: 28, borderRadius: 999, display: "grid", placeItems: "center", background: FUNDO_PAGINA, fontFamily: INTER, fontSize: 13, fontWeight: 700 }}>{(l.quem || "?").charAt(0).toUpperCase()}</span>
                      <span style={{ minWidth: 0, fontFamily: INTER, fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.quem}</span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{ flex: "none", padding: "4px 10px", borderRadius: 999, background: grupo === "Administração" ? AMARELO : FUNDO_PAGINA, fontFamily: INTER, fontSize: 13, fontWeight: 600 }}>{grupo}</span>
                      <span style={{ minWidth: 0, fontFamily: INTER, fontSize: 16, color: CINZA_FORTE, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{acaoDoLog(acao, campos)}</span>
                    </span>
                    {/* meia coluna (40) entre o detalhe e a data: antes o texto cortado encostava nela */}
                    <span style={{ minWidth: 0, paddingRight: 40, fontFamily: INTER, fontSize: 15, color: CINZA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={detalhe || undefined}>{detalhe}</span>
                    <span style={{ fontFamily: INTER, fontSize: 15, color: CINZA, whiteSpace: "nowrap", textAlign: "right" }}>{l.quando}</span>
                  </div>
                );
              })}
              {!LOGS.length && <div style={{ padding: "12px 24px", fontFamily: INTER, fontSize: 16, color: CINZA }}>Nenhum registro de auditoria para mostrar.</div>}
            </div>
          </>
        )}

        {/* o pé */}
        <div ref={tituloRef} style={tituloDoPeV4("Equipe")}>Equipe</div>
        <div role="tablist" aria-label="Equipe" style={{ position: "absolute", left: xAbas, top: 63 * LG - 0.85 - PILULA_ALT, display: "flex", gap: 29, zIndex: 3 }}>
          {([["usuarios", "Usuários"], ["cargos", "Cargos"], ["logs", "Logs"]] as const).map(([k, rot]) => (
            <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className="np4-pilula"
              style={{ ...PILULA_PE, position: "static", minWidth: 143.29, background: aba === k ? AMARELO : undefined }}>{rot}</button>
          ))}
        </div>
        {aba !== "logs" && (
          <button type="button" onClick={() => setForm(aba === "cargos" ? { tipo: "cargo" } : { tipo: "usuario" })} className="np4-pilula"
            style={{ ...PILULA_PE, right: 1920 - (1840 + PILULA_BORDA / 2) }}>{aba === "cargos" ? "Criar cargo" : "Criar usuário"}</button>
        )}
      </div>

      {form && (
        <FormEquipe form={form} cargos={CARGOS} grupos={GRUPOS_VIS} fechar={fecharForm}
          aoConfirmar={(d) => {
            const fim = (msg: string) => { setForm(null); avisar(msg); };
            if (form.tipo === "nome" && form.alvo && aoRenomear) return Promise.resolve(aoRenomear(form.alvo.id, d.nome!)).then(() => fim("Nome atualizado.")).catch(falhou);
            if (form.tipo === "senha" && form.alvo && aoResetarSenha) return Promise.resolve(aoResetarSenha(form.alvo.id, d.senha!)).then(() => fim(`Senha de ${form.alvo!.nome} redefinida.`)).catch(falhou);
            if (form.tipo === "usuario" && aoCriarUsuario) {
              return Promise.resolve(aoCriarUsuario({ nome: d.nome!, username: d.username!, senha: d.senha!, cargo: d.cargo! })).then(() => fim(`${d.nome} criada.`)).catch(falhou);
            }
            if (form.tipo === "cargo" && aoSalvarCargo) {
              return Promise.resolve(aoSalvarCargo({ nome: d.cargoNome!, label: d.label!, permissoes: d.permissoes ?? [], novo: !form.cargo }))
                .then(() => { if (!form.cargo) setSelCargo(d.cargoNome!); fim(`Cargo ${d.label} salvo.`); }).catch(falhou);
            }
            fim("Ação indisponível nesta tela.");
            return Promise.resolve();
          }} />
      )}

      {confirmar && (
        <div onClick={fecharConfirmar} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: NIVEL.caixa + 1, background: "rgba(37,36,37,.78)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={confirmar.tipo === "desativar" ? "Confirmar desativação" : "Confirmar exclusão"}
            style={{ width: 560, boxSizing: "border-box", background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, padding: "40px 44px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)" }}>
            <div style={{ ...FR, fontSize: 34, lineHeight: 1.1, letterSpacing: "-.02em" }}>
              {confirmar.tipo === "cargo" ? `Excluir o cargo ${confirmar.cargo.label}?` : `${confirmar.tipo === "desativar" ? "Desativar" : "Excluir"} ${confirmar.alvo.nome}?`}
            </div>
            <div style={{ fontFamily: INTER, fontSize: 17, lineHeight: 1.5, color: CINZA_FORTE }}>
              {confirmar.tipo === "cargo" ? "O cargo sai da lista. Não tem como desfazer."
                : confirmar.tipo === "usuario" ? `A conta @${confirmar.alvo.username} sai do hub. Não tem como desfazer.`
                  /* o servidor encerra as sessões abertas ao desativar (updateUsuario) e não apaga nada */
                  : `A conta @${confirmar.alvo.username} não entra mais no hub até ser ativada de novo.${confirmar.alvo.sessoes > 0
                    ? (confirmar.alvo.sessoes === 1 ? " A sessão aberta é encerrada na hora." : ` As ${confirmar.alvo.sessoes} sessões abertas são encerradas na hora.`)
                    : ""} Nada se apaga: pedidos e histórico continuam.`}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <button type="button" onClick={fecharConfirmar} className="p10-flat" autoFocus
                style={{ height: 50, padding: "0 24px", border: `2px solid ${PRETO}`, borderRadius: 999, background: "none", color: PRETO, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>Voltar</button>
              {/* desativar se desfaz no Ativar: botão preto; o vermelho fica para o que não volta (guia, 4.9) */}
              <button type="button" className="p10-flat"
                onClick={() => {
                  const c = confirmar;
                  setConfirmar(null);
                  if (c.tipo === "desativar" && aoAtivar) Promise.resolve(aoAtivar(c.alvo.id, false)).then(() => avisar(`${c.alvo.nome} desativada.`)).catch(falhou);
                  if (c.tipo === "usuario" && aoExcluirUsuario) Promise.resolve(aoExcluirUsuario(c.alvo.id)).then(() => avisar(`${c.alvo.nome} excluída.`)).catch(falhou);
                  if (c.tipo === "cargo" && aoExcluirCargo) Promise.resolve(aoExcluirCargo(c.cargo.nome)).then(() => avisar(`Cargo ${c.cargo.label} excluído.`)).catch(falhou);
                }}
                style={{ height: 50, padding: "0 26px", border: "none", borderRadius: 999, background: confirmar.tipo === "desativar" ? PRETO : VERMELHO, color: confirmar.tipo === "desativar" ? "#fff" : PALETA.perigoTinta, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>
                {confirmar.tipo === "desativar" ? "Desativar" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {aviso && <AvisoV1a texto={aviso.texto} tipo={aviso.tipo} onFechar={() => setAviso(null)} />}
      {children}
      <BarraTopoHub10 profile={profile} paginaAtiva="Equipe" aoNavegar={aoNavegar} onNova={onNova} onLogout={onLogout} disponiveis={disponiveis} fundo="transparent" />
    </PalcoFixo>
  );
}

/* as caixas da Equipe: criar usuário, nome, senha e cargo */
type DadosForm = { nome?: string; username?: string; senha?: string; cargo?: string; cargoNome?: string; label?: string; permissoes?: string[] };

function FormEquipe({ form, cargos, grupos, fechar, aoConfirmar }: {
  form: Form;
  cargos: Cargo[];
  grupos: { titulo: string; permissoes: [string, string][] }[];
  fechar: () => void;
  aoConfirmar: (d: DadosForm) => Promise<unknown>;
}) {
  const editandoCargo = form.tipo === "cargo";
  const [nome, setNome] = useState(form.alvo?.nome ?? "");
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [cargo, setCargo] = useState(cargos.find((c) => !c.sistema)?.nome ?? cargos.find((c) => c.nome !== "admin")?.nome ?? "");
  const [label, setLabel] = useState(form.cargo?.label ?? "");
  const [cargoNome, setCargoNome] = useState(form.cargo?.nome ?? "");
  const [permissoes, setPermissoes] = useState<string[]>(form.cargo?.perms.slice() ?? []);
  const [salvando, setSalvando] = useState(false);

  const titulo = form.tipo === "usuario" ? "Criar usuário"
    : form.tipo === "nome" ? "Alterar nome"
      : form.tipo === "senha" ? "Resetar senha"
        : form.cargo ? "Editar modelo do cargo" : "Criar cargo";
  const valido = form.tipo === "usuario"
    ? nome.trim().length >= 2 && /^[a-z0-9._-]{3,40}$/i.test(username.trim()) && senha.length >= 6 && !!cargo
    : form.tipo === "nome" ? nome.trim().length >= 2
      : form.tipo === "senha" ? senha.length >= 6
        : label.trim().length >= 2 && /^[a-z0-9_-]{2,30}$/i.test(cargoNome.trim());

  function confirmar() {
    if (!valido || salvando) return;
    setSalvando(true);
    aoConfirmar({ nome: nome.trim(), username: username.trim(), senha, cargo, cargoNome: cargoNome.trim(), label: label.trim(), permissoes }).finally(() => setSalvando(false));
  }

  return (
    <div onClick={fechar} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: NIVEL.caixa, background: "rgba(37,36,37,.78)" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={titulo}
        style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: editandoCargo ? 1060 : 720, maxHeight: 960, boxSizing: "border-box",
          display: "flex", flexDirection: "column", gap: 20, background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)",
          padding: "28px 42px 32px", fontFamily: INTER, color: PRETO }}>
        <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, lineHeight: 1.2, letterSpacing: ".16em", textTransform: "uppercase", color: "#8a8a8a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {form.alvo ? `Equipe · ${form.alvo.nome} · @${form.alvo.username}` : "Equipe"}
            </div>
            <div style={{ ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 96", fontSize: 44, lineHeight: 1, letterSpacing: "-.035em", marginTop: 10 }}>{titulo}</div>
          </div>
          <button type="button" onClick={fechar} aria-label="Fechar" className="p10-flat"
            style={{ flex: "none", width: 46, height: 46, boxSizing: "border-box", padding: 0, display: "grid", placeItems: "center", background: "transparent", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" aria-hidden><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
          {(form.tipo === "usuario" || form.tipo === "nome") && (
            <label><span style={ROTULO_CAMPO}>Nome completo</span><input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Marina Alves" style={CAMPO} /></label>
          )}
          {form.tipo === "usuario" && (
            <label><span style={ROTULO_CAMPO}>Usuário (login)</span><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="marina" autoCapitalize="none" style={CAMPO} /></label>
          )}
          {(form.tipo === "usuario" || form.tipo === "senha") && (
            <label>
              <span style={ROTULO_CAMPO}>{form.tipo === "senha" ? "Nova senha" : "Senha inicial"}</span>
              <input autoFocus={form.tipo === "senha"} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mínimo 6 caracteres" autoComplete="new-password" style={CAMPO} />
              <span style={{ display: "block", marginTop: 8, fontSize: 14, lineHeight: 1.4, color: CINZA }}>A senha é guardada com hash: ninguém consegue vê-la depois, só redefinir.</span>
            </label>
          )}
          {form.tipo === "usuario" && (
            <div>
              <span style={ROTULO_CAMPO}>Cargo</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {cargos.filter((c) => c.nome !== "admin").map((c) => (
                  <button key={c.nome} type="button" aria-pressed={cargo === c.nome} onClick={() => setCargo(c.nome)} className="np4-pilula" style={pilula(cargo === c.nome)}>{c.label}</button>
                ))}
              </div>
            </div>
          )}
          {editandoCargo && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <label><span style={ROTULO_CAMPO}>Nome exibido</span><input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Clicheria" style={CAMPO} /></label>
                <label>
                  <span style={ROTULO_CAMPO}>Identificador</span>
                  <input value={cargoNome} onChange={(e) => setCargoNome(e.target.value)} readOnly={!!form.cargo} placeholder="clicheria" style={{ ...CAMPO, opacity: form.cargo ? 0.6 : 1 }} />
                </label>
              </div>
              <div style={{ minHeight: 0 }}>
                <span style={ROTULO_CAMPO}>Permissões do modelo ({permissoes.length})</span>
                <div className="p10-trilha" style={{ maxHeight: 470, overflowY: "auto", columnCount: 3, columnGap: 28, paddingRight: 4 }}>
                  {grupos.map((g) => (
                    <section key={g.titulo} style={{ breakInside: "avoid", paddingBottom: 14 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{g.titulo}</div>
                      {g.permissoes.map(([k, rot]) => {
                        const on = permissoes.includes(k);
                        return (
                          <button key={k} type="button" role="checkbox" aria-checked={on} title={k} onClick={() => setPermissoes((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
                            className="p10-linha" style={{ ...LIMPO, display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "4px 4px", borderRadius: 7 }}>
                            <Marca on={on} />
                            <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: "18px" }}>{rot}</span>
                          </button>
                        );
                      })}
                    </section>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ flex: "none", display: "flex", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
          <button type="button" onClick={fechar} className="p10-flat"
            style={{ height: 50, padding: "0 24px", border: `2px solid ${PRETO}`, borderRadius: 999, background: "none", color: PRETO, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>Voltar</button>
          <button type="button" onClick={confirmar} disabled={!valido || salvando} className="p10-flat"
            style={{ height: 50, padding: "0 28px", border: "none", borderRadius: 999, background: valido ? PRETO : "#cfcccd", color: "#fff", fontFamily: INTER, fontSize: 18, fontWeight: 600,
              cursor: valido && !salvando ? "pointer" : "not-allowed" }}>{salvando ? "Salvando…" : titulo}</button>
        </div>
      </div>
    </div>
  );
}
