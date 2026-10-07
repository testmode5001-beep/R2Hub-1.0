// Equipe (Usuários e permissões) — v1a. Fonte: design_handoff_r2_hub/telas/Usuarios.dc.html.
// 3 abas: Usuários (cards + painel de permissões por grupo, com desvio vs.
// padrão do cargo), Cargos (modelos de permissão) e Logs (auditoria).
// A rota injeta os dados reais (usuarios/cargos/logs/permissoesTodas) e as
// ações; sem eles a tela roda com os dados de demonstração do protótipo.
// As permissões do protótipo que ainda não existem no backend são filtradas
// pela lista real — por isso alguns grupos somem no modo real.
// Senha nunca é exibida (o banco só guarda o hash): o gestor usa "Resetar senha".
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { criarBusca } from "@/lib/busca";
import {
  AMARELO, AvisoV1a, EstagioV1a, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr,
} from "./HubV1a";

export const GRUPOS: { titulo: string; permissoes: [string, string][] }[] = [
  { titulo: "Pedidos", permissoes: [["pedidos.criar", "Criar solicitações"], ["pedidos.ver_proprios", "Ver as próprias solicitações"], ["pedidos.ver_todos", "Ver todas as solicitações"], ["pedidos.editar_proprios", "Editar as próprias solicitações"], ["pedidos.editar_todos", "Editar qualquer solicitação"], ["pedidos.prioridade", "Definir urgência e prioridade"], ["pedidos.reabrir", "Reativar pedido cancelado ou reabrir concluído"], ["pedidos.transferir", "Transferir carteira de clientes"], ["pedidos.excluir", "Excluir solicitações"]] },
  { titulo: "Arte e design", permissoes: [["pedidos.status_design", "Executar etapas de design"], ["design.assumir", "Assumir pedido na fila"], ["design.enviar_arte", "Enviar arte para aprovação"], ["design.revisar", "Registrar revisão pedida"], ["design.arquivo_final", "Liberar arquivo final"], ["design.medidas", "Alterar medidas e faca do pedido"]] },
  { titulo: "Aprovação do cliente", permissoes: [["tab.cliches", "Aba Aprovação"], ["pedidos.aprovar", "Aprovar / pedir revisão"], ["aprovacao.reprovar", "Reprovar e devolver ao design"]] },
  { titulo: "Clichês", permissoes: [["tab.solicitar_cliche", "Aba Solicitar Clichê"], ["cliche.solicitar", "Solicitar clichê ao fornecedor"], ["cliche.registrar", "Registrar chegada de clichê"], ["cliche.reposicao", "Pedir reposição de clichê"], ["cliche.motivo_criar", "Criar motivo de solicitação"], ["cliche.valor_ver", "Ver valores de clichê"], ["cliche.valor_editar", "Lançar / editar valores"]] },
  { titulo: "Facas e afiação", permissoes: [["tab.afiacao", "Aba Afiação"], ["faca.enviar_afiacao", "Enviar faca para afiação"], ["faca.receber", "Receber faca da afiação"], ["faca.comprar", "Registrar compra de faca"], ["faca.substrato_criar", "Criar substrato de faca"], ["faca.custo_ver", "Ver custos de faca e afiação"], ["faca.marcar_morta", "Marcar faca como morta"]] },
  { titulo: "Clientes e cadastros", permissoes: [["tab.clientes", "Aba Clientes (pastas da rede)"], ["cliente.criar_pasta", "Criar pasta de cliente"], ["cliente.editar", "Editar dados do cliente"], ["cadastro.medidas", "Cadastrar medidas"], ["cadastro.materiais", "Cadastrar matéria-prima"], ["cadastro.cores", "Cadastrar cores e Pantone"]] },
  { titulo: "Arquivos", permissoes: [["tab.arquivos", "Aba Arquivos (acervo de pastas)"], ["anexo.upload", "Enviar arquivos"], ["anexo.baixar", "Baixar arquivo original"], ["anexo.excluir", "Apagar anexos"]] },
  { titulo: "Calculadoras", permissoes: [["calc.desenvolvimento", "Calculadora de Facas"], ["calc.comparativo", "Comparativo de Facas"], ["calc.diametro", "Facas por Diâmetro"], ["calc.distorcao", "Distorção do Clichê"], ["calc.valor", "Valor Clichê"], ["calc.bobinas", "Bobinas"], ["calc.substrato", "Largura do Substrato"], ["calc.caixa", "Etiquetas por Caixa"], ["calc.metragem", "Metragem do rolo"], ["calc.valoretiqueta", "Valor da etiqueta"], ["calc.tinta", "Consumo de tinta"], ["calc.gabarito", "Baixar gabarito da faca (SVG 1:1)"]] },
  { titulo: "Painel de produção", permissoes: [["tab.painel", "Aba Painel"], ["tab.op", "Aba OP (leitura de ordem)"], ["painel.carregar_os", "Carregar OS na máquina"], ["painel.rodar", "Iniciar, pausar e retomar"], ["painel.finalizar", "Finalizar produção"], ["painel.cancelar", "Cancelar produção"], ["painel.maquinas", "Adicionar e remover máquinas"], ["painel.custos_ver", "Visualizar custo"], ["painel.custos", "Editar custos por hora"]] },
  { titulo: "Relatórios", permissoes: [["apontamentos.ver", "Ver os relatórios"], ["apontamentos.financeiro", "Ver gastos e valores"], ["apontamentos.exportar", "Exportar relatórios"]] },
  { titulo: "Administração básica", permissoes: [["usuarios.criar_departamento", "Cadastrar contas do próprio departamento"]] },
  { titulo: "Administração", permissoes: [["usuarios.gerenciar", "Gerenciar usuários"], ["senha.ver_todas", "Ver a senha de qualquer usuário"], ["permissoes.gerenciar", "Gerenciar permissões"], ["cargos.gerenciar", "Criar e editar cargos"], ["sessoes.forcar_logout", "Forçar logout de sessões"], ["auditoria.ver", "Ver auditoria"], ["config.sistema", "Configurações do sistema"]] },
];

const TODAS_PROTOTIPO = GRUPOS.reduce<string[]>((a, g) => a.concat(g.permissoes.map((p) => p[0])), []);
const TODAS = TODAS_PROTOTIPO;
const doGrupo = (titulo: string) => (GRUPOS.find((g) => g.titulo === titulo)?.permissoes ?? []).map((p) => p[0]);

export type Cargo = { nome: string; label: string; sistema: boolean; perms: string[] };
const CARGOS_DEMO: Cargo[] = [
  { nome: "gestor", label: "Gestor", sistema: true, perms: TODAS.slice() },
  { nome: "design", label: "Design", sistema: true, perms: ["pedidos.criar", "pedidos.ver_proprios", "pedidos.ver_todos", "pedidos.editar_proprios", "pedidos.editar_todos", "pedidos.prioridade", "cliente.criar_pasta", "cadastro.medidas", "cadastro.cores", "tab.cliches", "tab.solicitar_cliche", "cliche.solicitar", "cliche.reposicao", "apontamentos.ver"].concat(doGrupo("Arte e design"), doGrupo("Calculadoras"), doGrupo("Arquivos"), ["tab.painel"]) },
  { nome: "comercial", label: "Comercial", sistema: true, perms: ["pedidos.criar", "pedidos.ver_proprios", "pedidos.ver_todos", "pedidos.editar_proprios", "pedidos.prioridade", "tab.cliches", "pedidos.aprovar", "aprovacao.responder_cliente", "aprovacao.prova_enviar", "aprovacao.reprovar", "cliente.criar_pasta", "cliente.editar", "anexo.upload", "anexo.baixar", "calc.caixa", "calc.bobinas"] },
  { nome: "clicheria", label: "Clicheria", sistema: false, perms: ["pedidos.ver_todos", "tab.cliches", "anexo.baixar", "cadastro.materiais"].concat(doGrupo("Clichês"), ["calc.distorcao", "calc.valor", "apontamentos.ver"]) },
  { nome: "afiacao", label: "Afiação", sistema: false, perms: ["pedidos.ver_todos", "cadastro.medidas", "calc.desenvolvimento", "calc.diametro", "calc.comparativo", "calc.substrato", "calc.gabarito"].concat(doGrupo("Facas e afiação")) },
  { nome: "producao", label: "Produção", sistema: false, perms: ["pedidos.ver_todos", "tab.afiacao", "faca.enviar_afiacao", "faca.receber", "anexo.baixar", "calc.substrato", "calc.caixa", "calc.bobinas", "apontamentos.ver", "tab.painel", "painel.carregar_os", "painel.rodar", "painel.finalizar", "painel.cancelar", "painel.custos_ver"] },
];

export type Usuario = { id: string; nome: string; username: string; cargo: string; ativo: boolean; sessoes: number; eu: boolean; extra?: string[]; remove?: string[]; perms?: string[] };
const USUARIOS_DEMO: Usuario[] = [
  { id: "u1", nome: "Danilo Ribeiro", username: "danilo", cargo: "gestor", ativo: true, sessoes: 2, eu: true },
  { id: "u2", nome: "Marina Alves", username: "marina", cargo: "design", ativo: true, sessoes: 1, eu: false, extra: ["pedidos.aprovar"] },
  { id: "u3", nome: "Rafael Souza", username: "rafa", cargo: "design", ativo: true, sessoes: 0, eu: false, remove: ["pedidos.editar_todos"] },
  { id: "u4", nome: "Bianca Costa", username: "bianca", cargo: "comercial", ativo: true, sessoes: 1, eu: false },
  { id: "u5", nome: "Simone Prado", username: "simone", cargo: "comercial", ativo: true, sessoes: 0, eu: false, extra: ["apontamentos.ver"] },
  { id: "u6", nome: "Elaine Dias", username: "elaine", cargo: "clicheria", ativo: true, sessoes: 1, eu: false },
  { id: "u7", nome: "Jussara Lima", username: "jussara", cargo: "afiacao", ativo: false, sessoes: 0, eu: false },
];

export type LogEquipe = { quem: string; grupo: string; acao: string; detalhe: string; quando: string };
const LOGS_DEMO: [string, string, string, string, string][] = [
  ["Danilo Ribeiro", "Administração", "Alterou permissão", "marina · +pedidos.aprovar", "27/07/26 10:12"],
  ["Marina Alves", "Pedidos", "Mudou status", "#0412 · arte enviada", "27/07/26 09:48"],
  ["Bianca Costa", "Pedidos", "Criou pedido", "#0412 · Mercado Bom Preço", "27/07/26 09:12"],
  ["Danilo Ribeiro", "Administração", "Aplicou padrão de cargo", "rafa · Design", "26/07/26 18:30"],
  ["Elaine Dias", "Clichês", "Registrou chegada de clichê", "#0409 · 1,70 mm", "26/07/26 17:55"],
  ["Marina Alves", "Clichês", "Solicitou clichê", "#0411 · alteração de arte", "26/07/26 17:40"],
  ["Sistema", "Sessões", "Forçou logout", "jussara · 1 sessão", "26/07/26 16:02"],
  ["Danilo Ribeiro", "Administração", "Criou cargo", "Afiação", "26/07/26 15:20"],
  ["Rafael Souza", "Facas", "Enviou faca p/ afiação", "#0404 · 60×40", "26/07/26 14:10"],
  ["Bianca Costa", "Sessões", "Entrou no sistema", "IP 187.0.14.22", "26/07/26 08:31"],
  ["Danilo Ribeiro", "Administração", "Resetou senha", "simone", "25/07/26 17:44"],
  ["Simone Prado", "Pedidos", "Aprovou / pediu revisão", "#0407 · aprovado", "25/07/26 15:22"],
];

export function EquipeV1a({
  profile, versao, aoNavegar, onNova, onLogout, disponiveis, children,
  usuarios, cargos: cargosReais, logs, permissoesTodas,
  aoTrocarCargo, aoTogglePermissao, aoAplicarPadrao, aoAtivar, aoExcluirUsuario,
  aoForcarLogout, aoRenomear, aoResetarSenha, aoCriarUsuario, aoSalvarCargo, aoExcluirCargo,
}: {
  profile: { nome: string; role?: string };
  versao: string;
  aoNavegar?: (pagina: string) => void;
  onNova?: () => void;
  onLogout?: () => void;
  disponiveis?: string[];
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
  /** dados reais — sem eles a tela roda com os dados do protótipo */
  usuarios?: Usuario[];
  cargos?: Cargo[];
  logs?: LogEquipe[];
  /** chaves de permissão que existem no backend (filtra as do protótipo) */
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
  const real = Array.isArray(usuarios);
  const USUARIOS = usuarios ?? USUARIOS_DEMO;
  const CARGOS = cargosReais ?? CARGOS_DEMO;
  const LOGS: [string, string, string, string, string][] = logs
    ? logs.map((l) => [l.quem, l.grupo, l.acao, l.detalhe, l.quando] as [string, string, string, string, string])
    : LOGS_DEMO;

  /* Editar permissão exige `permissoes.gerenciar`, e é essa permissão que
     libera a rota a buscar o catálogo de chaves. Sem ela o componente caía no
     catálogo do PROTÓTIPO: a pessoa via nomes de permissão que não existem e,
     ao marcar, o servidor recusava a chave. Quem não pode editar não vê o
     editor — não é escondido para punir, é que não há nada verdadeiro a
     mostrar ali. */
  const podeMexerEmPerms = !real || !!permissoesTodas;

  /* No modo real só existem as permissões do backend. */
  const CHAVES_VALIDAS = permissoesTodas ? new Set(permissoesTodas) : null;
  const GRUPOS_VIS = (CHAVES_VALIDAS
    ? GRUPOS.map((g) => ({ ...g, permissoes: g.permissoes.filter(([k]) => CHAVES_VALIDAS.has(k)) })).filter((g) => g.permissoes.length)
    : GRUPOS);
  const TODAS_VIS = permissoesTodas ?? TODAS;

  const cargoDe = (nome: string) => CARGOS.find((c) => c.nome === nome) ?? CARGOS[0] ?? { nome: "", label: "—", sistema: false, perms: [] };

  function permsIniciais(): Record<string, string[]> {
    const m: Record<string, string[]> = {};
    USUARIOS.forEach((u) => {
      if (u.perms) { m[u.id] = u.perms.slice(); return; }
      const base = new Set(cargoDe(u.cargo).perms);
      (u.extra ?? []).forEach((p) => base.add(p));
      (u.remove ?? []).forEach((p) => base.delete(p));
      m[u.id] = [...base];
    });
    return m;
  }

  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<"usuarios" | "cargos" | "logs">("usuarios");
  const [sel, setSel] = useState(() => USUARIOS[0]?.id ?? "u2");
  const [cargos, setCargos] = useState<Record<string, string>>(() => USUARIOS.reduce((a, u) => ({ ...a, [u.id]: u.cargo }), {}));
  const [perms, setPerms] = useState<Record<string, string[]>>(permsIniciais);
  const [aviso, setAviso] = useState("");
  const [form, setForm] = useState<null | { tipo: "usuario" | "nome" | "senha" | "cargo"; alvo?: Usuario; cargo?: Cargo }>(null);

  /* Modo real: o servidor é a fonte da verdade — ressincroniza a cada refetch. */
  const assinatura = real ? JSON.stringify(USUARIOS.map((u) => [u.id, u.cargo, (u.perms ?? []).join(",")])) : "";
  useEffect(() => {
    if (!real) return;
    setCargos(USUARIOS.reduce((a, u) => ({ ...a, [u.id]: u.cargo }), {}));
    setPerms(permsIniciais());
    setSel((s) => (USUARIOS.some((u) => u.id === s) ? s : USUARIOS[0]?.id ?? s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, real]);

  const selUser = USUARIOS.find((u) => u.id === sel) ?? USUARIOS[0];
  const selPerms = perms[selUser?.id] ?? [];
  const cargoSel = cargoDe(cargos[selUser?.id]);
  const selAdmin = real && cargoSel.nome === "admin";
  const podeVerSenhas = false; // a senha real é hash — só dá para resetar

  function falhou(e: unknown) {
    setAviso(e instanceof Error ? e.message : "Não foi possível salvar.");
  }

  /* Marcar na tela antes de o servidor confirmar deixa a resposta imediata,
     MAS se o servidor recusar o visto continuava marcado — e a pessoa saía
     achando que concedeu uma permissão que não existe. Em tela de permissão
     isso é grave, então o erro desfaz a marca. */
  const desfazer = (id: string, chaves: string[], ligar: boolean) => (e: unknown) => {
    falhou(e);
    setPerms((s) => {
      const atual = new Set(s[id] ?? []);
      chaves.forEach((k) => (ligar ? atual.delete(k) : atual.add(k)));   // volta ao anterior
      return { ...s, [id]: [...atual] };
    });
  };

  const togglePerm = (id: string, p: string) => {
    const ligar = !(perms[id] ?? []).includes(p);
    setPerms((s) => {
      const atual = s[id] ?? [];
      return { ...s, [id]: atual.includes(p) ? atual.filter((x) => x !== p) : [...atual, p] };
    });
    if (aoTogglePermissao) Promise.resolve(aoTogglePermissao(id, p, ligar)).catch(desfazer(id, [p], ligar));
  };
  const setGrupo = (id: string, chaves: string[], ligar: boolean) => {
    const atuais = new Set(perms[id] ?? []);
    const mudar = chaves.filter((k) => atuais.has(k) !== ligar);
    setPerms((s) => {
      const atual = new Set(s[id] ?? []);
      chaves.forEach((k) => (ligar ? atual.add(k) : atual.delete(k)));
      return { ...s, [id]: [...atual] };
    });
    if (aoTogglePermissao) {
      /* Guarda quem já passou: se a 3ª falhar, só as que faltaram voltam
         atrás — desfazer as que o servidor aceitou seria mentira também. */
      const feitas: string[] = [];
      mudar.reduce(
        (p, k) => p.then(() => Promise.resolve(aoTogglePermissao(id, k, ligar)).then(() => { feitas.push(k); })),
        Promise.resolve(),
      ).catch((e) => desfazer(id, mudar.filter((k) => !feitas.includes(k)), ligar)(e));
    }
  };

  const casa = criarBusca(busca);
  const lista = USUARIOS.filter((u) => casa(u.nome, u.username, cargoDe(cargos[u.id]).label));

  const usos: Record<string, number> = {};
  USUARIOS.forEach((u) => { const c = cargos[u.id]; usos[c] = (usos[c] || 0) + 1; });

  const selDesvio = (() => {
    if (selAdmin) return "administrador do sistema · acesso total (não editável)";
    const extra = selPerms.filter((p) => !cargoSel.perms.includes(p)).length;
    const falta = cargoSel.perms.filter((p) => !selPerms.includes(p)).length;
    return extra || falta
      ? `${extra ? `+${extra} a mais` : ""}${extra && falta ? " · " : ""}${falta ? `−${falta} revogadas` : ""} vs. padrão do cargo`
      : `igual ao padrão do cargo ${cargoSel.label}`;
  })();

  const acaoBtn = (label: string, onClick?: () => void, destrutivo = false, principal = false) => (
    <button key={label} type="button" className="r2chip" onClick={onClick ?? (() => { /* backend futuro */ })}
      style={{ flex: principal ? "1 1 auto" : "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${destrutivo ? "#f0d3d3" : principal ? INK : "#f1f1f1"}`, background: principal ? INK : "#fff", cursor: "pointer", borderRadius: 7, padding: "10px 13px", font: "600 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", color: destrutivo ? "#b4342f" : principal ? AMARELO : "#5c5a5c" }}>
      {label}
    </button>
  );

  return (
    <EstagioV1a>
      <TopbarV1a nome={String(profile.nome || "").trim().split(/\s+/)[0] || ""} busca={busca} aoBuscar={setBusca} onSair={onLogout} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch", marginTop: 14 }}>
        <RailV1a ativo="Equipe" permitidas={disponiveis} aoNavegar={(l) => aoNavegar?.(l)} onNovo={() => onNova?.()} versao={versao} />

        <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "0 6px 2px" }}>
            <div>
              <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>Administração</div>
              <h1 style={{ ...fr(144, 900), fontSize: 56, lineHeight: 1, letterSpacing: "-.02em", textIndent: "-.045em", whiteSpace: "nowrap", color: INK, margin: "8px 0 0" }}>Equipe</h1>
              <div style={{ font: "400 16px/1 Inter,sans-serif", color: "#8d8b8d", marginTop: 12 }}>
                {USUARIOS.filter((u) => u.ativo).length} pessoas ativas · {CARGOS.length} cargos · {TODAS_VIS.length} permissões controladas
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {([["usuarios", "Usuários"], ["cargos", "Cargos"], ["logs", "Logs"]] as const).map(([id, label]) => (
                <button key={id} type="button" className="r2chip" onClick={() => setAba(id)}
                  style={{ border: 0, cursor: "pointer", borderRadius: 7, padding: "15px 19px", font: "600 15px/1 Inter,sans-serif", whiteSpace: "nowrap", background: aba === id ? INK : "#fff", color: aba === id ? AMARELO : "#5c5a5c" }}>
                  {label}
                </button>
              ))}
              <span style={{ width: 2, height: 34, background: "#e4e4e4", borderRadius: 999, margin: "0 4px" }} />
              <button type="button" className="r2chip"
                onClick={() => setForm(aba === "cargos" ? { tipo: "cargo" } : { tipo: "usuario" })}
                style={{ display: "flex", alignItems: "center", gap: 10, background: AMARELO, border: 0, borderRadius: 7, padding: "15px 19px", cursor: "pointer", font: "700 15px/1 Inter,sans-serif", color: INK }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M15.5 20v-1.5a3.5 3.5 0 0 0-3.5-3.5H7a3.5 3.5 0 0 0-3.5 3.5V20" /><circle cx="9.5" cy="8" r="3.5" /><path d="M18 8.5v5" /><path d="M15.5 11h5" /></svg>
                <span style={{ lineHeight: "17px" }}>{aba === "cargos" ? "Criar cargo" : "Criar usuário"}</span>
              </button>
            </div>
          </div>

          {aba === "usuarios" && (
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "grid", gridTemplateColumns: "0.95fr 2.3fr", gap: 12, alignItems: "start" }}>
              {/* cards de usuário */}
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {lista.map((u) => {
                  const cg = cargoDe(cargos[u.id]);
                  const qtd = (perms[u.id] ?? []).length;
                  const desvio = qtd - cg.perms.length;
                  const selecionado = u.id === sel;
                  return (
                    <div key={u.id} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px 12px", border: `2px solid ${selecionado ? INK : "#fff"}`, boxShadow: SOMBRA_CARD, opacity: u.ativo ? 1 : 0.55 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <span style={{ flex: "none", width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 999, background: selecionado ? AMARELO : INK, color: selecionado ? INK : AMARELO, font: "800 18px/1 Inter,sans-serif" }}>{u.nome[0]}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                            <span style={{ ...fr(72, 700), fontSize: 21, lineHeight: 1.1, letterSpacing: "-.02em", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.nome}</span>
                            {u.eu && <span style={{ font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "#b3b1b3", whiteSpace: "nowrap" }}>você</span>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px 8px", marginTop: 7, minWidth: 0 }}>
                            <span style={{ flex: "none", font: `500 14.5px/1 ${MONO}`, color: "#8d8b8d" }}>@{u.username}</span>
                            <span style={{ font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", padding: "7px 12px 6px", borderRadius: 999, whiteSpace: "nowrap", background: u.ativo ? "#f1f1f1" : INK, color: u.ativo ? "#5c5a5c" : AMARELO }}>{u.ativo ? "Ativo" : "Inativo"}</span>
                            <span style={{ flex: "none", font: "600 13.5px/1 Inter,sans-serif", whiteSpace: "nowrap", color: u.sessoes > 0 ? "#1f8f4e" : "#b3b1b3" }}>
                              {u.sessoes > 0 ? `● ${u.sessoes} ${u.sessoes === 1 ? "sessão ativa" : "sessões ativas"}` : "sem sessão"}
                            </span>
                          </div>
                        </div>
                        <div style={{ flex: "0 0 auto", maxWidth: 190, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                          <span style={{ font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "8px 14px 7px", borderRadius: 999, whiteSpace: "nowrap", background: selecionado ? AMARELO : "#f1f1f1", color: INK }}>{cg.label}</span>
                          <span style={{ font: "400 13.5px/1.35 Inter,sans-serif", color: "#b3b1b3", textAlign: "right" }}>
                            {real && cg.nome === "admin"
                              ? "acesso total do sistema"
                              : `${qtd} de ${TODAS_VIS.length} permissões${desvio === 0 ? " · padrão do cargo" : desvio > 0 ? ` · +${desvio} fora do padrão` : ` · ${desvio} do padrão`}`}
                          </span>
                        </div>
                      </div>
                      {selecionado && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 11, paddingTop: 10, borderTop: "1px solid #f1f1f1" }}>
                          <span style={{ flex: "none", alignSelf: "center", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#b3b1b3", marginRight: 3 }}>Cargo</span>
                          {CARGOS.map((c) => (
                            <button key={c.nome} type="button" className="r2chip"
                              onClick={() => {
                                if (u.eu || c.nome === cg.nome) return;
                                if (real && (c.nome === "admin" || cg.nome === "admin")) { setAviso("O cargo Administrador é do sistema. Troque pelo painel de usuários."); return; }
                                setCargos((s) => ({ ...s, [u.id]: c.nome }));
                                setPerms((s) => ({ ...s, [u.id]: c.perms.slice() }));
                                setSel(u.id);
                                if (aoTrocarCargo) Promise.resolve(aoTrocarCargo(u.id, c.nome)).then(() => setAviso(`${u.nome} agora é ${c.label}.`)).catch(falhou);
                              }}
                              style={{ border: 0, cursor: u.eu ? "default" : "pointer", borderRadius: 999, padding: "8px 12px", font: "600 13.5px/1 Inter,sans-serif", whiteSpace: "nowrap", opacity: u.eu && c.nome !== cg.nome ? 0.35 : 1, background: c.nome === cg.nome ? INK : "#f1f1f1", color: c.nome === cg.nome ? AMARELO : "#8d8b8d" }}>
                              {c.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 11, paddingTop: 10, borderTop: "1px solid #f1f1f1" }}>
                        {podeMexerEmPerms && acaoBtn(selecionado ? "Editando permissões" : "Permissões", () => setSel(u.id), false, true)}
                        {acaoBtn("Nome", () => setForm({ tipo: "nome", alvo: u }))}
                        {acaoBtn(podeVerSenhas ? "Ver senha" : "Resetar senha", () => setForm({ tipo: "senha", alvo: u }))}
                        {u.sessoes > 0 && !u.eu && acaoBtn("Logout", () => {
                          if (!aoForcarLogout) return;
                          Promise.resolve(aoForcarLogout(u.id)).then(() => setAviso(`Sessões de ${u.nome} encerradas.`)).catch(falhou);
                        })}
                        {acaoBtn(u.ativo ? "Desativar" : "Ativar", () => {
                          if (!aoAtivar) return;
                          if (u.eu) { setAviso("Você não pode desativar a si mesmo."); return; }
                          Promise.resolve(aoAtivar(u.id, !u.ativo)).then(() => setAviso(`${u.nome} ${u.ativo ? "desativado" : "ativado"}.`)).catch(falhou);
                        })}
                        {acaoBtn("Excluir", () => {
                          if (!aoExcluirUsuario) return;
                          if (u.eu) { setAviso("Você não pode excluir a si mesmo."); return; }
                          if (!window.confirm(`Excluir ${u.nome} (@${u.username})? Esta ação não pode ser desfeita.`)) return;
                          Promise.resolve(aoExcluirUsuario(u.id)).then(() => setAviso(`${u.nome} excluído.`)).catch(falhou);
                        }, true)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* painel de permissões — só existe com o catálogo real em mãos */}
              {podeMexerEmPerms && <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: INK, borderRadius: 12, padding: "20px 22px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 3.5 19 6v6.2c0 4-2.9 6.9-7 8.3-4.1-1.4-7-4.3-7-8.3V6z" /><path d="M9.5 12.2l2 2 3.2-3.6" /></svg>
                    <span style={{ flex: 1, font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>Permissões de</span>
                    <span style={{ font: "600 14.5px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>{cargoSel.label}{cargoSel.nome === "gestor" ? " · acesso total" : ""}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginTop: 14 }}>
                    <span style={{ ...fr(96, 700), fontSize: 34, lineHeight: 1, letterSpacing: "-.03em", color: AMARELO }}>{selUser?.nome}</span>
                    <span style={{ font: "800 26px/1 Inter,sans-serif", letterSpacing: "-.03em", color: "#f1f1f1", whiteSpace: "nowrap" }}>{selAdmin ? TODAS_VIS.length : selPerms.length}/{TODAS_VIS.length}</span>
                  </div>
                  <div style={{ font: "500 14.5px/1.4 Inter,sans-serif", color: "#b3b1b3", marginTop: 11 }}>{selDesvio}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button type="button" className="r2chip" onClick={() => {
                      if (selAdmin) { setAviso("Administrador tem acesso total (não editável)."); return; }
                      setPerms((s) => ({ ...s, [selUser.id]: cargoSel.perms.slice() }));
                      if (aoAplicarPadrao) Promise.resolve(aoAplicarPadrao(selUser.id)).then(() => setAviso(`Padrão do cargo ${cargoSel.label} aplicado a ${selUser.nome}.`)).catch(falhou);
                    }}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, background: "transparent", border: "2px solid #4a484a", borderRadius: 7, padding: "12px 14px", cursor: "pointer", font: "600 14.5px/1 Inter,sans-serif", color: "#f1f1f1" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" /><path d="M19.5 3.5V6H17" /></svg>
                      <span style={{ lineHeight: "15px" }}>Aplicar padrão do cargo</span>
                    </button>
                    <button type="button" className="r2chip" onClick={() => {
                      if (selAdmin) { setAviso("Administrador tem acesso total (não editável)."); return; }
                      setGrupo(selUser.id, selPerms.slice(), false);
                    }}
                      style={{ flex: "none", background: "transparent", border: "2px solid #4a484a", borderRadius: 7, padding: "12px 16px", cursor: "pointer", font: "600 14.5px/1 Inter,sans-serif", color: "#f1f1f1", whiteSpace: "nowrap" }}>
                      Revogar tudo
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, alignItems: "start" }}>
                  {GRUPOS_VIS.map((g) => {
                    const chaves = g.permissoes.map((p) => p[0]);
                    const ativas = chaves.filter((k) => selAdmin || selPerms.includes(k)).length;
                    const todas = ativas === chaves.length;
                    return (
                      <div key={g.titulo} style={{ minWidth: 0, background: "#fff", borderRadius: 12, padding: "15px 16px 13px", boxShadow: SOMBRA_CARD }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                          <span style={{ font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>{g.titulo}</span>
                          <span style={{ flex: 1, height: 2, background: "#f1f1f1", borderRadius: 999 }} />
                          <span style={{ font: "600 13.5px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>{ativas}/{chaves.length}</span>
                          <button type="button" className="r2chip" onClick={() => {
                            if (selAdmin) { setAviso("Administrador tem acesso total (não editável)."); return; }
                            setGrupo(selUser.id, chaves, !todas);
                          }}
                            style={{ flex: "none", background: "#f1f1f1", border: 0, borderRadius: 999, padding: "6px 10px", cursor: "pointer", font: "600 12.5px/1 Inter,sans-serif", color: "#5c5a5c", whiteSpace: "nowrap" }}>
                            {todas ? "Desmarcar todas" : "Marcar todas"}
                          </button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {g.permissoes.map(([k, label]) => {
                            const on = selAdmin || selPerms.includes(k);
                            const padrao = cargoSel.perms.includes(k);
                            const difere = !selAdmin && on !== padrao;
                            return (
                              <button key={k} type="button" className="r2row" onClick={() => {
                                if (selAdmin) { setAviso("Administrador tem acesso total (não editável)."); return; }
                                togglePerm(selUser.id, k);
                              }}
                                style={{ display: "flex", alignItems: "center", gap: 9, background: on ? "#fafafa" : "#fff", border: `2px solid ${on ? "#f1f1f1" : "#f6f6f6"}`, borderRadius: 7, padding: "7px 10px", cursor: "pointer", width: "100%" }}>
                                <span style={{ flex: "none", width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: 6, background: on ? AMARELO : "#fff", border: `2px solid ${on ? AMARELO : "#dcdbdc"}` }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={on ? INK : "transparent"} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 12.5 4 4 8-9" /></svg>
                                </span>
                                <span style={{ flex: 1, minWidth: 0, font: "600 14.5px/1.25 Inter,sans-serif", color: INK, textAlign: "left" }}>{label}</span>
                                <span style={{ flex: "none", whiteSpace: "nowrap", font: difere ? "700 11px/1 Inter,sans-serif" : `500 11px/1 ${MONO}`, color: difere ? "#b4342f" : "#b3b1b3" }}>
                                  {difere ? (on ? "+ fora do padrão" : "− revogada") : k}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>}
            </div>
          )}

          {aba === "cargos" && (
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, background: AMARELO, borderRadius: 12, padding: "16px 20px" }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.5" /><path d="M12 7.8v.4" /></svg>
                <span style={{ flex: 1, font: "500 15px/1.4 Inter,sans-serif", color: INK }}>
                  O cargo é um <strong style={{ fontWeight: 800 }}>modelo de permissões</strong>: define o que a pessoa recebe ao ser criada ou ao usar “aplicar padrão”. Depois, cada usuário pode ser ajustado individualmente.
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, alignItems: "start" }}>
                {CARGOS.map((c) => (
                  <div key={c.nome} style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ ...fr(72, 700), flex: 1, minWidth: 0, fontSize: 24, lineHeight: 1.1, letterSpacing: "-.02em", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</span>
                      {c.sistema && <span style={{ flex: "none", font: "800 12.5px/1 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", padding: "7px 12px 6px", borderRadius: 999, background: INK, color: AMARELO, whiteSpace: "nowrap" }}>sistema</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f1f1" }}>
                      <span style={{ flex: 1, font: "500 15px/1.2 Inter,sans-serif", color: "#5c5a5c" }}>Pessoas com o cargo</span>
                      <span style={{ font: `700 15px/1 ${MONO}`, color: INK }}>{usos[c.nome] || 0}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
                      <span style={{ flex: 1, font: "500 15px/1.2 Inter,sans-serif", color: "#5c5a5c" }}>Permissões no modelo</span>
                      <span style={{ font: `700 15px/1 ${MONO}`, color: INK }}>{c.perms.length} de {TODAS_VIS.length}</span>
                    </div>
                    <div style={{ font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#b3b1b3", margin: "16px 0 9px" }}>Inclui</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {GRUPOS_VIS.map((g) => {
                        const n = g.permissoes.filter((p) => c.perms.includes(p[0])).length;
                        const cheio = n === g.permissoes.length;
                        return (
                          <span key={g.titulo} style={{ font: "600 13.5px/1 Inter,sans-serif", padding: "7px 10px", borderRadius: 999, whiteSpace: "nowrap", background: n === 0 ? "#fff" : cheio ? AMARELO : "#f1f1f1", border: `2px solid ${n === 0 ? "#f1f1f1" : "transparent"}`, color: n === 0 ? "#b3b1b3" : INK }}>
                            {g.titulo} {n}/{g.permissoes.length}
                          </span>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
                      <button type="button" className="r2chip" onClick={() => setForm({ tipo: "cargo", cargo: c })}
                        style={{ flex: 1, background: "#f1f1f1", border: 0, borderRadius: 7, padding: "11px 12px", cursor: "pointer", font: "600 14.5px/1 Inter,sans-serif", color: INK }}>Editar modelo</button>
                      <button type="button" className="r2chip"
                        onClick={() => {
                          if (c.sistema || !aoExcluirCargo) return;
                          if (!window.confirm(`Excluir o cargo ${c.label}?`)) return;
                          Promise.resolve(aoExcluirCargo(c.nome)).then(() => setAviso(`Cargo ${c.label} excluído.`)).catch(falhou);
                        }}
                        style={{ flex: "none", background: "#fff", border: `2px solid ${c.sistema ? "#f6f6f6" : "#f0d3d3"}`, borderRadius: 7, padding: "11px 14px", cursor: c.sistema ? "not-allowed" : "pointer", font: "600 14.5px/1 Inter,sans-serif", color: c.sistema ? "#c9c8c9" : "#b4342f" }}>
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aba === "logs" && (
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#fff", borderRadius: 12, padding: "18px 20px 14px", boxShadow: SOMBRA_CARD }}>
              <div style={{ display: "grid", gridTemplateColumns: "190px 1fr 260px 150px", gap: 12, padding: "0 8px 10px", borderBottom: "2px solid #f1f1f1" }}>
                {["Quem", "Ação", "Detalhe", "Quando"].map((l, i) => (
                  <span key={l} style={{ font: "700 12.5px/1.2 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", color: "#8d8b8d", textAlign: i === 3 ? "right" : "left" }}>{l}</span>
                ))}
              </div>
              {LOGS.map(([quem, grupo, acaoTxt, detalhe, quando], i) => (
                <div key={i} className="r2row" style={{ display: "grid", gridTemplateColumns: "190px 1fr 260px 150px", gap: 12, alignItems: "center", minHeight: 52, padding: "9px 8px", borderRadius: 6, background: i % 2 ? "#fafafa" : "transparent" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ flex: "none", width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 999, background: INK, color: AMARELO, font: "800 14.5px/1 Inter,sans-serif" }}>{quem[0]}</span>
                    <span style={{ minWidth: 0, font: "600 15px/1.2 Inter,sans-serif", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{quem}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <span style={{ flex: "none", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "7px 12px 6px", borderRadius: 999, whiteSpace: "nowrap", background: grupo === "Administração" ? AMARELO : "#f1f1f1", color: INK }}>{grupo}</span>
                    <span style={{ minWidth: 0, font: "500 15px/1.2 Inter,sans-serif", color: "#5c5a5c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acaoTxt}</span>
                  </span>
                  <span style={{ minWidth: 0, font: `500 14.5px/1.2 ${MONO}`, color: "#8d8b8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detalhe}</span>
                  <span style={{ font: "500 14.5px/1.2 Inter,sans-serif", color: "#b3b1b3", textAlign: "right", whiteSpace: "nowrap" }}>{quando}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {form && (
        <FormEquipe
          form={form}
          cargos={CARGOS}
          grupos={GRUPOS_VIS}
          fechar={() => setForm(null)}
          aoConfirmar={(d) => {
            const fim = (msg: string) => { setForm(null); setAviso(msg); };
            if (form.tipo === "nome" && form.alvo && aoRenomear) {
              return Promise.resolve(aoRenomear(form.alvo.id, d.nome!)).then(() => fim("Nome atualizado.")).catch(falhou);
            }
            if (form.tipo === "senha" && form.alvo && aoResetarSenha) {
              return Promise.resolve(aoResetarSenha(form.alvo.id, d.senha!)).then(() => fim(`Senha de ${form.alvo!.nome} redefinida.`)).catch(falhou);
            }
            if (form.tipo === "usuario" && aoCriarUsuario) {
              return Promise.resolve(aoCriarUsuario({ nome: d.nome!, username: d.username!, senha: d.senha!, cargo: d.cargo! }))
                .then(() => fim(`${d.nome} criado.`)).catch(falhou);
            }
            if (form.tipo === "cargo" && aoSalvarCargo) {
              return Promise.resolve(aoSalvarCargo({ nome: d.cargoNome!, label: d.label!, permissoes: d.permissoes ?? [], novo: !form.cargo }))
                .then(() => fim(`Cargo ${d.label} salvo.`)).catch(falhou);
            }
            fim("Ação disponível quando a tela estiver ligada ao servidor.");
            return Promise.resolve();
          }}
        />
      )}
      {aviso && <AvisoV1a texto={aviso} onFechar={() => setAviso("")} />}
      {children}
    </EstagioV1a>
  );
}

/* ————— Formulários da Equipe (criar usuário, nome, senha e cargo) ————— */
type DadosForm = { nome?: string; username?: string; senha?: string; cargo?: string; cargoNome?: string; label?: string; permissoes?: string[] };

function FormEquipe({ form, cargos, grupos, fechar, aoConfirmar }: {
  form: { tipo: "usuario" | "nome" | "senha" | "cargo"; alvo?: Usuario; cargo?: Cargo };
  cargos: Cargo[];
  grupos: { titulo: string; permissoes: [string, string][] }[];
  fechar: () => void;
  aoConfirmar: (d: DadosForm) => Promise<unknown>;
}) {
  const editandoCargo = form.tipo === "cargo";
  const [nome, setNome] = useState(form.alvo?.nome ?? "");
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [cargo, setCargo] = useState(cargos.find((c) => !c.sistema)?.nome ?? cargos[0]?.nome ?? "");
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

  const INP = {
    width: "100%", boxSizing: "border-box" as const, background: "#f1f1f1", border: "2px solid #f1f1f1",
    borderRadius: 7, padding: "12px 14px", font: "600 15px/1.2 Inter,sans-serif", color: INK, outline: "none",
  };
  const ROT = { display: "block", font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase" as const, color: "#8d8b8d", margin: "0 0 8px" };

  function confirmar() {
    if (!valido || salvando) return;
    setSalvando(true);
    aoConfirmar({ nome: nome.trim(), username: username.trim(), senha, cargo, cargoNome: cargoNome.trim(), label: label.trim(), permissoes })
      .finally(() => setSalvando(false));
  }

  return (
    <div onClick={fechar}
      className="r2modal" style={{ position: "absolute", inset: 0, zIndex: 64, display: "flex", alignItems: "center", justifyContent: "center", padding: 36, background: "rgba(37,36,37,.52)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", borderRadius: 14 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: editandoCargo ? 900 : 520, maxHeight: "100%", overflow: "auto", background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 18 }}>
          <div>
            <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>Equipe</div>
            <div style={{ ...fr(96, 700), fontSize: 32, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 10 }}>{titulo}</div>
            {form.alvo && <div style={{ font: "500 14.5px/1 Inter,sans-serif", color: "#8d8b8d", marginTop: 10 }}>{form.alvo.nome} · @{form.alvo.username}</div>}
          </div>
          <button onClick={fechar} className="pm-ic" style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
          </button>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          {(form.tipo === "usuario" || form.tipo === "nome") && (
            <div>
              <span style={ROT}>Nome completo</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Marina Alves" style={INP} />
            </div>
          )}
          {form.tipo === "usuario" && (
            <div>
              <span style={ROT}>Usuário (login)</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="marina" autoCapitalize="none" style={INP} />
            </div>
          )}
          {(form.tipo === "usuario" || form.tipo === "senha") && (
            <div>
              <span style={ROT}>{form.tipo === "senha" ? "Nova senha" : "Senha inicial"}</span>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mínimo 6 caracteres" style={INP} />
              <div style={{ font: "400 13px/1.4 Inter,sans-serif", color: "#b3b1b3", marginTop: 8 }}>
                A senha é guardada com hash: ninguém consegue vê-la depois, só redefinir.
              </div>
            </div>
          )}
          {form.tipo === "usuario" && (
            <div>
              <span style={ROT}>Cargo</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {cargos.filter((c) => c.nome !== "admin").map((c) => (
                  <button key={c.nome} type="button" onClick={() => setCargo(c.nome)} className="r2chip"
                    style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 13px", font: "600 13.5px/1 Inter,sans-serif", background: cargo === c.nome ? INK : "#f1f1f1", color: cargo === c.nome ? AMARELO : "#8d8b8d" }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {editandoCargo && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <span style={ROT}>Nome exibido</span>
                  <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Clicheria" style={INP} />
                </div>
                <div>
                  <span style={ROT}>Identificador</span>
                  <input value={cargoNome} onChange={(e) => setCargoNome(e.target.value)} readOnly={!!form.cargo}
                    placeholder="clicheria" style={{ ...INP, opacity: form.cargo ? 0.6 : 1 }} />
                </div>
              </div>
              <div>
                <span style={ROT}>Permissões do modelo ({permissoes.length})</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, maxHeight: 320, overflow: "auto" }}>
                  {grupos.map((g) => (
                    <div key={g.titulo} style={{ background: "#fafafa", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#8d8b8d", marginBottom: 9 }}>{g.titulo}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {g.permissoes.map(([k, lab]) => {
                          const on = permissoes.includes(k);
                          return (
                            <button key={k} type="button" className="r2row"
                              onClick={() => setPermissoes((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
                              style={{ display: "flex", alignItems: "center", gap: 9, background: "transparent", border: 0, padding: "5px 2px", cursor: "pointer", width: "100%", textAlign: "left" }}>
                              <span style={{ flex: "none", width: 20, height: 20, display: "grid", placeItems: "center", borderRadius: 5, background: on ? AMARELO : "#fff", border: `2px solid ${on ? AMARELO : "#dcdbdc"}` }}>
                                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={on ? INK : "transparent"} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 12.5 4 4 8-9" /></svg>
                              </span>
                              <span style={{ flex: 1, minWidth: 0, font: "500 14px/1.25 Inter,sans-serif", color: INK }}>{lab}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={fechar} className="pm-act"
            style={{ flex: "none", border: 0, borderRadius: 7, padding: "14px 18px", cursor: "pointer", font: "600 15px/1 Inter,sans-serif", background: "#fff", color: "#5c5a5c" }}>
            Cancelar
          </button>
          <button onClick={confirmar} className="pm-act" disabled={!valido || salvando}
            style={{ flex: 1, border: 0, borderRadius: 7, padding: 14, cursor: valido && !salvando ? "pointer" : "not-allowed", opacity: valido && !salvando ? 1 : 0.45, font: "700 15px/1 Inter,sans-serif", background: INK, color: AMARELO }}>
            {salvando ? "Salvando…" : titulo}
          </button>
        </div>
      </div>
    </div>
  );
}
