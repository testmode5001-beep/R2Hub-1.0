// Aprovação V1a — recriação fiel de `Aprovacao.dc.html` (handoff v1a, hifi):
//   · cabeçalho: título 56px + "prazo médio de retorno" + filtros de e-mail
//   · esquerda (380px, rola): KPIs Aguardando clicheria / E-mail não enviado,
//     filtro por Motivo (orelha 4px + contagem), Pódio de aprovações
//     (clientes/dia), Espessura do clichê (1,14/1,70 com chips de mês) e
//     Cores mais pedidas
//   · centro/direita: faixa "Chegaram da aprovação de arte" (card 612 +
//     verticais 98), aviso de entrada automática + "Lançar manualmente",
//     colunas "Enviados à clicheria" (ações Clichê chegou / Conferir /
//     Reprovar) e "Concluídos" (cards creme #FFFBE0 com total e itens)
//   · modal "Solicitar clichê — E-mail à clicheria": tipo, cores, motivo
//     (com motivo novo), observações, anexos e calculadora de distorção
//     (R = dentes × passo · K = 2π(esp − 0,127)).
//   Ações que dependem de back-end novo (registrar chegada com valores,
//   reprovar → voltar status) ficam sinalizadas no aviso por enquanto.
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { addMotivoCliche, listMotivosCliche } from "@/lib/api/cliches.functions";
import { criarBusca } from "@/lib/busca";
import { prazoDoPedido } from "@/lib/prazo";
import type { SessionUser } from "@/lib/session";
import {
  AMARELO, AvisoV1a, EstagioV1a, FUNDO, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr, nomeEmPe,
} from "./HubV1a";
import { ClicheChegouModalV1a, type RegistroCliche } from "./modais/ClicheChegouModalV1a";

const MOTIVOS = ["Arte nova", "Alteração de arte", "Clichê danificado", "Reposição", "Troca de faca", "Ajuste de cor"];
const ORELHA_MOTIVO: Record<string, string> = {
  "Arte nova": "#d6d5d6", "Alteração de arte": "#8d8b8d", "Clichê danificado": INK,
  "Reposição": "#4a484a", "Troca de faca": AMARELO, "Ajuste de cor": "#b3b1b3",
};
const TIPOS = ["Todos", "1,14", "1,70"] as const;
const EMAILS = ["Todos", "Enviado", "Falhou"] as const;
const POLIESTER = 0.127;
const MODULOS = [
  { nome: "M1 (π)", passo: Math.PI },
  { nome: 'CP 1/8"', passo: 3.175 },
  { nome: 'CP 5/32"', passo: 3.96875 },
  { nome: 'CP 3/16"', passo: 4.7625 },
  { nome: 'CP 1/4"', passo: 6.35 },
];

const DIA_MS = 86_400_000;
const fmt2 = (n: number) => String(n).padStart(2, "0");
const fmtData = (d: Date) => `${fmt2(d.getDate())}/${fmt2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
const brlNum = (n: number) => {
  const [i, d] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 ? "-" : ""}R$ ${i.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${d}`;
};

/* ————— Adaptadores (dados do app → formato do protótipo) ————— */
function specDe(p: any) {
  return p.tipo === "cliche" ? `CÓD ${p.codigo_produto ?? "—"}` : `${p.largura}x${p.altura}`;
}

/** Solicitações na clicheria (paraClicheria): status "cliche" do app. */
function paraSolicitacao(p: any) {
  return {
    raw: p,
    num: `#${String(p.numero).padStart(2, "0")}`,
    cliente: p.cliente as string,
    medida: specDe(p),
    tipo: (p.tipo_cliche ?? "1,14") as string,
    cores: p.cores ? `${p.cores} cores` : "—",
    motivo: (p.motivo ?? (p.tipo === "cliche" ? "Reposição" : "Arte nova")) as string,
    obs: (p.obs ?? "") as string,
    autor: (p.vendedora ?? p.designer ?? "—") as string,
    enviado: p.emailEnviado !== false,
    quando: fmtData(new Date(p.created_at)),
    // ANO-MÊS: só o mês faria agosto do ano passado entrar no chip "Ago" deste ano
    mes: `${new Date(p.created_at).getFullYear()}-${fmt2(new Date(p.created_at).getMonth() + 1)}`,
  };
}

/** Chegadas da aprovação de arte (paraChegadas): status "aprovada". */
function paraChegada(p: any) {
  const prazoDate = prazoDoPedido(p);
  const diff = Math.round((prazoDate.getTime() - Date.now()) / DIA_MS);
  return {
    raw: p,
    num: `#${String(p.numero).padStart(2, "0")}`,
    cliente: p.cliente as string,
    partes: [specDe(p), p.materia ?? "—", p.cores ? `${p.cores} cores` : "—"],
    prazo: fmtData(prazoDate),
    origem: (p.origem ?? "vendas") as "vendas" | "producao" | "interno",
    motivo: (p.motivo ?? "Arte nova") as string,
    tipo: (p.tipo_cliche ?? "1,14") as string,
    atraso: diff < 0,
    dias: Math.abs(diff),
  };
}

/** Concluídos: valor, data e itens vêm do REGISTRO de chegada gravado no banco
    (listPedidos traz o mais recente em cliche_*). Antes daqui saía um valor
    fictício por cor, herdado do protótipo, que não batia com o que tinha sido
    registrado — quem conferisse o card via um número que ninguém digitou.
    Sem registro, não se inventa nada: o card diz que falta lançar. */
function paraConcluido(p: any) {
  const registrado = p.cliche_total != null;
  const d = registrado && p.cliche_data
    ? new Date(`${p.cliche_data}T${(p.cliche_hora ?? "00:00")}:00`)
    : new Date(p.updated_at ?? p.created_at);
  let itens: { descricao: string; valor: number }[] = [];
  if (p.cliche_itens) {
    try { itens = JSON.parse(p.cliche_itens); } catch { itens = []; }
  }
  return {
    raw: p,
    num: `#${String(p.numero).padStart(2, "0")}`,
    cliente: p.cliente as string,
    dataKey: `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}-${fmt2(d.getDate())}`,
    dataLabel: fmtData(d),
    horaLabel: `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}h`,
    itens,
    total: registrado ? Number(p.cliche_total) : 0,
    registrado,
    /* Nome da nota da clicheria guardada com o registro (null = lançado à mão). */
    nota: (p.cliche_nota as string | null) ?? null,
  };
}

/** Rótulo do histograma de cores: "1" → "1 cor", "3" → "3 cores", "CMYK" → "CMYK".
    O campo guarda número OU nome de escala, e "1 cores"/"CMYK cores" não é português. */
function rotuloCores(valor: string): string {
  const n = Number(valor);
  if (Number.isFinite(n) && n > 0) return `${n} ${n === 1 ? "cor" : "cores"}`;
  return valor;
}

/* ————— Tela ————— */
/** Chip de ação dentro do card aberto (herda o contraste do fundo do card). */
const acaoChip = (interno: boolean, prod: boolean) => ({
  border: 0, cursor: "pointer", borderRadius: 999, padding: "8px 13px",
  font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".03em",
  textTransform: "uppercase" as const, whiteSpace: "nowrap" as const,
  background: interno ? AMARELO : prod ? INK : INK,
  color: interno ? INK : AMARELO,
});

export function AprovacaoV1a({
  profile, pedidos, versao, onOpen, aoNavegar, onLogout, aoRegistrarCliche, disponiveis, children,
  podeVerValores = true, podeResponderCliente = false, podeEnviarProva = false,
  aoResponderCliente, aoEnviarProva, aoSolicitarCliche, aoVoltarClicheria,
  aoConcluirSemCliche, podeConcluirSemCliche = false, aoAbrirNota,
  aoCancelarCliche, podeCancelarCliche = false,
}: {
  profile: SessionUser;
  pedidos: any[];
  versao?: string;
  /** cliche.valor_ver — sem isso os valores dos clichês não aparecem */
  podeVerValores?: boolean;
  /** aprovacao.responder_cliente */
  podeResponderCliente?: boolean;
  /** aprovacao.prova_enviar */
  podeEnviarProva?: boolean;
  /** grava a resposta na conversa do pedido (canal "cliente") */
  aoResponderCliente?: (pedidoId: string, texto: string) => Promise<unknown>;
  /** registra no histórico do pedido que a prova de impressão foi enviada */
  aoEnviarProva?: (pedidoId: string, observacao: string) => Promise<unknown>;
  /** envio REAL da solicitação (criarSolicitacaoCliche); `num` liga ao pedido
      quando a modal foi aberta de um card — a rota muda o status para cliche */
  aoSolicitarCliche?: (num: string | undefined, dados: DadosSolicitacaoCliche) => Promise<unknown>;
  onOpen: (id: string) => void;
  aoNavegar: (label: string) => void;
  onLogout: () => void;
  /** grava a chegada do clichê no back-end (registrarCliche) — sem isso fica só local */
  aoRegistrarCliche?: (pedidoId: string, registro: RegistroCliche) => void;
  /** desfaz a chegada: o clichê volta para "enviados à clicheria" (clique errado) */
  aoVoltarClicheria?: (pedidoId: string) => Promise<unknown>;
  /** abre a nota da clicheria guardada no registro de chegada */
  aoAbrirNota?: (pedidoId: string) => Promise<unknown>;
  /** fecha um pedido aprovado que não passa pela clicheria */
  aoConcluirSemCliche?: (pedidoId: string) => Promise<unknown>;
  /** desfaz o envio à clicheria: o pedido volta para "chegaram da aprovação de
      arte" (arrastar o card de volta para a faixa) */
  aoCancelarCliche?: (pedidoId: string) => Promise<unknown>;
  /** pedidos.aprovar — a mesma de aprovar a arte */
  podeCancelarCliche?: boolean;
  /** pedidos.status_design + design.arquivo_final — as mesmas do fluxo de design */
  podeConcluirSemCliche?: boolean;
  disponiveis?: string[];
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
}) {
  /** Sem cliche.valor_ver a pessoa acompanha o fluxo, mas não vê quanto custou. */
  const brl = (n: number) => (podeVerValores ? brlNum(n) : "—");

  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState("");
  const [motivo, setMotivo] = useState("Todos");
  const [tipo] = useState<(typeof TIPOS)[number]>("Todos");
  const [email, setEmail] = useState<(typeof EMAILS)[number]>("Todos");
  const [mes, setMes] = useState(2); // índice na janela de 3 meses (2 = atual)
  const [chegadaIdx, setChegadaIdx] = useState(0);
  const [conferidas, setConferidas] = useState<Record<string, boolean>>({});
  const [concluidoAberto, setConcluidoAberto] = useState<string | null>(null);
  /* confirmação de "voltar para a clicheria" — desfazer não pode ser 1 clique */
  const [voltando, setVoltando] = useState<string | null>(null);
  /* arrastar o card de uma coluna para a outra: mesmo efeito dos botões, mas
     com o gesto que a mão já espera (segurar e puxar para o lado) */
  const [arrastando, setArrastando] = useState<null | { lado: "concluido" | "enviado" | "chegada"; id: string; num: string }>(null);
  /* pedido aprovado que NÃO precisa de clichê: vai direto para concluído,
     pelo botão ou arrastando o card para a faixa "Concluídos". */
  const [semCliche, setSemCliche] = useState<null | { id: string; num: string; cliente: string }>(null);
  const [concluindo, setConcluindo] = useState(false);
  const [alvo, setAlvo] = useState<null | "clicheria" | "concluidos" | "arte">(null);
  /* cancelar o envio à clicheria: a clicheria já recebeu o e-mail, então
     desfazer pede confirmação — igual a concluir sem clichê */
  const [cancelando, setCancelando] = useState<null | { id: string; num: string; cliente: string }>(null);
  const [cancelandoAgora, setCancelandoAgora] = useState(false);
  /* Concluídos: busca própria + quantos cabem por vez (a lista só cresce) */
  const [buscaConcl, setBuscaConcl] = useState("");
  const PAGINA_CONCL = 12;
  const [limiteConcl, setLimiteConcl] = useState(PAGINA_CONCL);
  const [modal, setModal] = useState<null | { cliente?: string; num?: string; motivo?: string; tipo?: string }>(null);
  const [chegou, setChegou] = useState<null | { id: string; num: string; cliente: string; cores: string; registro?: RegistroCliche }>(null);
  const [registros, setRegistros] = useState<Record<string, RegistroCliche>>({});
  const [acao, setAcao] = useState<null | { tipo: "resposta" | "prova"; id: string; cliente: string; num: string }>(null);
  const [acaoTexto, setAcaoTexto] = useState("");
  const [salvandoAcao, setSalvandoAcao] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  function confirmarAcao() {
    if (!acao) return;
    const texto = acaoTexto.trim();
    if (acao.tipo === "resposta" && !texto) { setAviso("Escreva a resposta antes de registrar."); return; }
    const promessa = acao.tipo === "resposta"
      ? aoResponderCliente?.(acao.id, texto)
      : aoEnviarProva?.(acao.id, texto);
    if (!promessa) { setAcao(null); setAviso("Ação sem back-end nesta tela."); return; }
    setSalvandoAcao(true);
    promessa
      .then(() => {
        setAcao(null);
        setAviso(acao.tipo === "resposta"
          ? `Resposta registrada na conversa do ${acao.num}.`
          : `Prova de impressão do ${acao.num} registrada.`);
      })
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para registrar."))
      .finally(() => setSalvandoAcao(false));
  }

  const solicitacoes = useMemo(() => pedidos.filter((p) => p.status === "cliche").map(paraSolicitacao), [pedidos]);
  const chegadas = useMemo(() => pedidos.filter((p) => p.status === "aprovada").map(paraChegada), [pedidos]);
  /* Concluídos: a lista inteira, do mais recente para o mais antigo.
     Havia um `.slice(0, 40)` aqui — passando de 40 registros os mais antigos
     sumiam da tela sem nenhum aviso, e o rodapé continuava dizendo o total.
     Agora quem limita é a paginação lá embaixo, que diz quantos faltam. */
  const concluidos = useMemo(
    () => pedidos.filter((p) => p.status === "concluido").map(paraConcluido)
      .map((c) => {
        const r = registros[c.num];
        if (!r) return c;
        const [ano, mesR, diaR] = r.data.split("-");
        return { ...c, dataKey: r.data, dataLabel: `${diaR}/${mesR}/${ano.slice(2)}`, horaLabel: `${r.hora}h`, itens: r.itens, total: r.total, registrado: true };
      })
      .sort((a, b) => b.dataKey.localeCompare(a.dataKey)),
    [pedidos, registros],
  );
  /* Busca própria da coluna: a do topo filtra "Enviados à clicheria", e usar a
     mesma nos dois lados esvaziaria uma coluna para achar algo na outra. */
  const concluidosVis = useMemo(() => {
    const casa = criarBusca(buscaConcl);
    return concluidos.filter((c) => casa(c.cliente, c.num, c.dataLabel));
  }, [concluidos, buscaConcl]);
  const concluidosNaTela = concluidosVis.slice(0, limiteConcl);
  const faltamConcl = concluidosVis.length - concluidosNaTela.length;

  const vis = useMemo(() => {
    const casa = criarBusca(busca);
    return solicitacoes.filter((s) => {
      const okM = motivo === "Todos" || s.motivo === motivo;
      const okT = tipo === "Todos" || s.tipo === tipo;
      const okE = email === "Todos" || (email === "Enviado" ? s.enviado : !s.enviado);
      const okQ = casa(s.cliente, s.num, s.motivo, s.cores);
      return okM && okT && okE && okQ;
    });
  }, [solicitacoes, busca, motivo, tipo, email]);

  const totalFalhas = solicitacoes.filter((s) => !s.enviado).length;

  /* Pódio: os dias que mais MANDARAM clichê para a clicheria.
     Conta pelo dia da aprovação (`cliche_solicitado_em`), não pelo da chegada —
     senão o trabalho de um dia só apareceria quando o material voltasse, dias
     ou semanas depois, e um dia cheio de aprovações ficava invisível nesse
     meio-tempo. O pedido que ainda está na clicheria JÁ ENTRA: foi aprovado
     naquele dia, tendo voltado ou não.
     UM CLICHÊ = UM PEDIDO enviado. Antes cada COR contava como um clichê, e o
     número saía de uma cadeia de fontes que se contradiziam: para o pedido já
     devolvido valiam os itens que CHEGARAM (o Carnivorous dizia 2 cores e
     voltou com 3, entrando como 3 numa conta sobre o que foi ENVIADO), e para
     o resto valia `cores`, que por sua vez briga com a lista `cores_desc` em
     vários pedidos. Contar envios não depende de nenhum desses campos. */
  const podio = useMemo(() => {
    const por: Record<string, { clientes: string[]; os: number }> = {};
    for (const p of pedidos) {
      const iso = (p as { cliche_solicitado_em?: string | null }).cliche_solicitado_em;
      if (!iso) continue;
      const dia = fmtData(new Date(iso));
      const it = por[dia] ?? (por[dia] = { clientes: [], os: 0 });
      it.os += 1;
      if (!it.clientes.includes(p.cliente)) it.clientes.push(p.cliente);
    }
    return Object.entries(por)
      .sort((a, b) => b[1].os - a[1].os || b[1].clientes.length - a[1].clientes.length)
      .slice(0, 3);
  }, [pedidos]);
  const MEDALHA = [AMARELO, INK, "#e4e4e4"];
  const TINTA = [INK, AMARELO, "#5c5a5c"];

  /* Espessura por mês (janela de 3 meses, contagem real por tipo). */
  const hoje = new Date();
  const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const janelaMeses = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - (2 - i), 1);
    const chave = `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}`;
    const doMes = solicitacoes.filter((s) => s.mes === chave);
    return {
      chip: MESES_PT[d.getMonth()],
      v114: doMes.filter((s) => s.tipo === "1,14").length,
      v170: doMes.filter((s) => s.tipo === "1,70").length,
    };
  });
  const mesAtivo = janelaMeses[mes];
  const totalMes = mesAtivo.v114 + mesAtivo.v170;
  const maxTotalMes = Math.max(1, ...janelaMeses.map((m) => m.v114 + m.v170));

  /* Cores mais pedidas (contagem real do campo cores). */
  const coresTop = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of pedidos) {
      const c = String(p.cores ?? "").trim();
      if (c) m[c] = (m[c] ?? 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([valor, n]) => ({ nome: rotuloCores(valor), n }));
  }, [pedidos]);
  const maxCor = Math.max(1, ...coresTop.map((c) => c.n));

  const CARD_BRANCO = { background: "#fff", borderRadius: 12, boxShadow: SOMBRA_CARD } as const;
  const tituloFaixa = { font: "700 13.5px/1 Inter, sans-serif", letterSpacing: ".14em", textTransform: "uppercase" as const, color: "#8d8b8d", whiteSpace: "nowrap" as const };

  return (
    <EstagioV1a>
      <TopbarV1a
        nome={profile.nome.split(" ")[0]}
        busca={busca}
        aoBuscar={setBusca}
        onSair={onLogout}
        inputRef={buscaRef}
      />

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch" }}>
        <RailV1a
          ativo="Aprovação"
          permitidas={disponiveis}
          aoNavegar={aoNavegar}
          onNovo={() => setModal({})}
          versao={versao}
        />

        <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          {/* Cabeçalho */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 6px 8px" }}>
            <div>
              <h1 className="select-none" style={{ ...fr(144, 900), fontSize: 56, lineHeight: 1, letterSpacing: "-.02em", textIndent: "-.045em", whiteSpace: "nowrap", color: INK, margin: 0 }}>Aprovação</h1>
              <div style={{ font: "400 15px/1 Inter, sans-serif", color: "#8d8b8d", marginTop: 12 }}>Solicitações de clichê enviadas à clicheria</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ font: "400 14.5px/1 Inter, sans-serif", color: "#b3b1b3", whiteSpace: "nowrap", marginRight: 6 }}>prazo médio de retorno: 3 dias</span>
              {EMAILS.map((nome) => {
                const on = email === nome;
                return (
                  <button key={nome} onClick={() => setEmail(nome)} className="r2chip" style={{ flex: "none", border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 14px", font: "600 14.5px/1 Inter, sans-serif", whiteSpace: "nowrap", background: on ? INK : "#fff", color: on ? AMARELO : "#5c5a5c", boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
                    {nome}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch" }}>

            {/* ————— Coluna esquerda (380px, rola) ————— */}
            <div style={{ flex: "0 0 380px", width: 380, minWidth: 0, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, background: AMARELO, borderRadius: 12, padding: "18px 18px 16px" }}>
                  <div style={{ font: "800 34px/1 Inter, sans-serif", letterSpacing: "-.03em", color: INK }}>{solicitacoes.length}</div>
                  <div style={{ font: "600 12.5px/1.3 Inter, sans-serif", color: INK, letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10 }}>Aguardando clicheria</div>
                </div>
                <div style={{ flex: 1, background: INK, borderRadius: 12, padding: "18px 18px 16px" }}>
                  <div style={{ font: "800 34px/1 Inter, sans-serif", letterSpacing: "-.03em", color: "#f1f1f1" }}>{totalFalhas}</div>
                  <div style={{ font: "600 12.5px/1.3 Inter, sans-serif", color: "#b3b1b3", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10 }}>E-mail não enviado</div>
                </div>
              </div>

              {/* Motivo */}
              <div style={{ ...CARD_BRANCO, padding: "20px 22px 16px" }}>
                <div className="select-none" style={{ font: "800 19px/1 Inter, sans-serif", color: INK, marginBottom: 14, letterSpacing: "-.01em" }}>Motivo</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {["Todos", ...MOTIVOS].map((nome) => {
                    const on = motivo === nome;
                    const n = nome === "Todos" ? solicitacoes.length : solicitacoes.filter((s) => s.motivo === nome).length;
                    return (
                      <button key={nome} onClick={() => setMotivo(nome)}
                        style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", border: 0, cursor: "pointer", borderRadius: 6, padding: "11px 12px", font: `${on ? 600 : 500} 14px/1 Inter, sans-serif`, background: on ? INK : "transparent", color: on ? AMARELO : INK }}>
                        <span style={{ flex: "0 0 4px", height: 18, borderRadius: 1, background: ORELHA_MOTIVO[nome] ?? (on ? AMARELO : "#d6d5d6") }} />
                        <span className="truncate" style={{ flex: 1, minWidth: 0, lineHeight: 1 }}>{nome}</span>
                        <span style={{ font: "800 13.5px/1 Inter, sans-serif", padding: "4px 7px", borderRadius: 999, background: on ? "#3a383a" : FUNDO, color: on ? AMARELO : "#5c5a5c" }}>{n}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pódio de aprovações */}
              <div style={{ ...CARD_BRANCO, padding: "20px 22px 18px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                  <span className="select-none truncate" style={{ flex: "1 1 auto", minWidth: 0, font: "800 19px/1 Inter, sans-serif", color: INK, letterSpacing: "-.01em" }}>Pódio</span>
                  <span style={{ flex: "none", font: "400 13px/1 Inter, sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>{podio.length ? "enviados à clicheria por dia" : "sem registros"}</span>
                </div>
                {podio.length === 0 && (
                  <div style={{ font: "400 14.5px/1.4 Inter, sans-serif", color: "#b3b1b3", textWrap: "pretty" as any }}>Nenhum clichê aprovado ainda — os três dias que mais mandaram clichê para a clicheria aparecem aqui.</div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {podio.map(([dia, v], i) => (
                    <div key={dia} style={{ display: "flex", alignItems: "center", gap: 12, background: i === 0 ? "#fffbe0" : "#fafafa", borderRadius: 9, padding: "11px 13px" }}>
                      <span style={{ flex: "0 0 34px", height: 34, display: "grid", placeItems: "center", borderRadius: 999, font: "800 14.5px/1 Inter, sans-serif", background: MEDALHA[i], color: TINTA[i] }}>{i + 1}º</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="truncate" style={{ font: "700 15px/1.2 Inter, sans-serif", color: INK }}>{dia}</div>
                        <div style={{ font: "500 13.5px/1.2 Inter, sans-serif", color: "#8d8b8d", marginTop: 5 }}>
                          {v.clientes.length} {v.clientes.length === 1 ? "cliente" : "clientes"}
                        </div>
                      </div>
                      {/* o número grande é quantos clichês foram MANDADOS para a
                          clicheria no dia — um por pedido enviado */}
                      <span title={`${v.os} ${v.os === 1 ? "clichê enviado" : "clichês enviados"} para a clicheria em ${dia}, de ${v.clientes.length} ${v.clientes.length === 1 ? "cliente" : "clientes"}`}
                        style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 4, font: "800 22px/1 Inter, sans-serif", letterSpacing: "-.02em", color: INK }}>
                        {v.os}
                        <span style={{ font: "600 11.5px/1 Inter, sans-serif", letterSpacing: ".06em", textTransform: "uppercase", color: "#8d8b8d" }}>{v.os === 1 ? "clichê" : "clichês"}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Espessura do clichê */}
              <div style={{ ...CARD_BRANCO, padding: "20px 22px 18px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 12, minWidth: 0 }}>
                  <span className="select-none" style={{ flex: "1 1 auto", minWidth: 150, font: "800 17px/1.15 Inter, sans-serif", color: INK, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>Espessura do clichê</span>
                  <div style={{ display: "flex", flex: "none", gap: 5 }}>
                    {janelaMeses.map((m, i) => {
                      const on = mes === i;
                      return (
                        <button key={m.chip} onClick={() => setMes(i)} className="r2chip" style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "8px 14px 7px", font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".06em", textTransform: "uppercase", background: on ? INK : FUNDO, color: on ? AMARELO : "#8d8b8d" }}>
                          {m.chip}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 34, paddingBottom: 6, marginBottom: 6, borderBottom: `1px solid ${FUNDO}` }}>
                  <span style={{ flex: "0 0 88px", font: "700 15px/1.2 Inter, sans-serif", color: INK, whiteSpace: "nowrap" }}>Total</span>
                  <span style={{ position: "relative", flex: "1 1 auto", height: 24, background: "#e8e8e8", borderRadius: 4, overflow: "hidden" }}>
                    <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, width: `${Math.round(30 + 70 * (totalMes / maxTotalMes))}%`, background: AMARELO, borderRadius: 4 }}>
                      <span style={{ font: "800 13.5px/1 Inter, sans-serif", color: INK }}>{totalMes}</span>
                    </span>
                  </span>
                </div>
                {[{ nome: "1,14 mm", n: mesAtivo.v114 }, { nome: "1,70 mm", n: mesAtivo.v170 }].map((e) => {
                  const m = Math.max(1, mesAtivo.v114, mesAtivo.v170);
                  return (
                    <div key={e.nome} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 30 }}>
                      <span style={{ flex: "0 0 88px", font: "400 15px/1.2 Inter, sans-serif", color: INK, whiteSpace: "nowrap" }}>{e.nome}</span>
                      <span style={{ position: "relative", flex: "1 1 auto", height: 20, background: "#e8e8e8", borderRadius: 3, overflow: "hidden" }}>
                        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 7, width: `${Math.round(34 + 66 * (e.n / m))}%`, background: INK, borderRadius: 3 }}>
                          <span style={{ font: "800 12.5px/1 Inter, sans-serif", color: AMARELO }}>{e.n}</span>
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Cores mais pedidas — `flex: 1 0 auto`: o último card estica
                  até o pé do palco, alinhando a base da coluna com o rail
                  (antes a coluna acabava antes e a linha de baixo ficava
                  serrilhada) */}
              <div style={{ flex: "1 0 auto", display: "flex", flexDirection: "column", ...CARD_BRANCO, padding: "20px 22px 18px" }}>
                <div className="select-none" style={{ font: "800 19px/1 Inter, sans-serif", color: INK, marginBottom: 14, letterSpacing: "-.01em" }}>Cores mais pedidas</div>
                {coresTop.length === 0 && <div style={{ font: "400 14px/1.4 Inter, sans-serif", color: "#b3b1b3" }}>Sem dados ainda.</div>}
                {coresTop.map((c) => (
                  <div key={c.nome} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, minHeight: 30 }}>
                    <span className="truncate" style={{ flex: "0 0 88px", font: "400 15px/1.2 Inter, sans-serif", color: INK, whiteSpace: "nowrap" }}>{c.nome}</span>
                    <span style={{ position: "relative", flex: "1 1 auto", height: 20, background: "#e8e8e8", borderRadius: 3, overflow: "hidden" }}>
                      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 7, width: `${Math.round(38 + 62 * (c.n / maxCor))}%`, background: INK, borderRadius: 3 }}>
                        <span style={{ font: "800 12.5px/1 Inter, sans-serif", color: AMARELO }}>{c.n}</span>
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ————— Centro/direita ————— */}
            <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "0 2px" }}>
                <span className="select-none" style={tituloFaixa}>Chegaram da aprovação de arte</span>
                <span style={{ flex: 1, height: 2, background: "#e4e4e4", borderRadius: 999 }} />
                <span style={{ font: "400 14.5px/1 Inter, sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>clique para lançar na fila</span>
              </div>

              {/* A faixa também RECEBE: card puxado de "Enviados à clicheria"
                  volta para cá e o envio é cancelado — o caminho de volta do
                  mesmo gesto que manda o pedido para a clicheria. */}
              <div
                onDragOver={(e) => { if (podeCancelarCliche && aoCancelarCliche && arrastando?.lado === "enviado") { e.preventDefault(); setAlvo("arte"); } }}
                onDragLeave={() => setAlvo((a2) => (a2 === "arte" ? null : a2))}
                onDrop={(e) => {
                  e.preventDefault();
                  const solto = arrastando;
                  setAlvo(null); setArrastando(null);
                  if (!podeCancelarCliche || !aoCancelarCliche || solto?.lado !== "enviado") return;
                  const s = solicitacoes.find((x) => x.raw.id === solto.id);
                  setCancelando({ id: solto.id, num: solto.num, cliente: s?.cliente ?? "" });
                }}
                style={{ borderRadius: 14, outline: alvo === "arte" ? `3px dashed ${AMARELO}` : "none", outlineOffset: 6, transition: "outline-color .15s ease" }}
              >
              {chegadas.length === 0 ? (
                <div style={{ display: "grid", placeItems: "center", height: 206, background: "#fff", border: "2px dashed #d6d5d6", borderRadius: 12, font: "400 15px/1.4 Inter, sans-serif", color: "#8d8b8d" }}>
                  {alvo === "arte" ? "Solte aqui para cancelar o envio à clicheria." : "Nenhum pedido aprovado esperando lançamento."}
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "flex-start", gap: 10, height: 206 }}>
                  {chegadas.slice(0, 5).map((p, i) => {
                    const aberto = Math.min(chegadaIdx, chegadas.length - 1) === i;
                    const prod = p.origem === "producao";
                    const interno = p.origem === "interno";
                    /* orelha removida: o atraso já aparece no chip "atrasado há Xd".
                       Cor do card = regra da Central: cinza = parado na aprovação. */
                    const cinza = !prod && !interno;
                    const neutro = prod ? "rgba(37,36,37,.12)" : interno ? "#3a383a" : "#fff";
                    const neutroFg = prod ? "#5c5a5c" : interno ? "#b3b1b3" : "#8d8b8d";
                    return (
                      <div
                        key={p.raw.id}
                        className="r2card"
                        draggable={podeConcluirSemCliche}
                        onDragStart={() => setArrastando({ lado: "chegada", id: p.raw.id, num: p.num })}
                        onDragEnd={() => { setArrastando(null); setAlvo(null); }}
                        onClick={() => {
                          if (aberto) setModal({ cliente: p.cliente, num: p.num, motivo: p.motivo, tipo: p.tipo });
                          else setChegadaIdx(i);
                        }}
                        style={{ flex: aberto ? "0 0 612px" : "0 0 98px", position: "relative", textAlign: "left", overflow: "hidden", borderRadius: 15, boxShadow: SOMBRA_CARD, cursor: "pointer", background: prod ? AMARELO : interno ? INK : cinza ? "#e2e0e2" : "#fff" }}
                      >
                        {aberto ? (
                          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "stretch", gap: 22, height: "100%", padding: "18px 20px 16px" }}>
                            <div style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                              <span style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", whiteSpace: "nowrap", color: interno ? "#b3b1b3" : prod ? "rgba(37,36,37,.62)" : "#8d8b8d" }}>
                                {p.num} / {prod ? "PRODUÇÃO" : interno ? "INTERNO" : "VENDAS"}
                              </span>
                              {/* 1 linha com reticências: com os botões novos
                                  (Responder cliente / Prova enviada) os chips
                                  ocupam até 2 fileiras — nome em 2 linhas
                                  estourava a altura e era cortado no meio */}
                              <h3 title={p.cliente} style={{ margin: "auto 0 0", ...fr(96, 700), fontSize: 30, lineHeight: 1.02, letterSpacing: "-.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: interno ? "#f1f1f1" : INK }}>
                                {p.cliente}
                              </h3>
                              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, margin: "14px 0 0 -1px", minWidth: 0 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, padding: "9px 13px", font: `600 12.5px/1 ${MONO}`, letterSpacing: ".12em", textTransform: "uppercase", whiteSpace: "nowrap", border: `1.5px solid ${interno ? "rgba(241,241,241,.5)" : prod ? "rgba(37,36,37,.4)" : "#d6d5d6"}`, color: interno ? "#f1f1f1" : INK }}>
                                  Lançar na fila
                                </span>
                                <span style={{ font: "700 13.5px/1 Inter, sans-serif", letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "8px 13px 7px", borderRadius: 999, background: prod ? "#fff" : interno ? "#3a383a" : "#fff", color: interno ? "#f1f1f1" : INK }}>
                                  {p.motivo}
                                </span>
                                <span style={{ font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "7px 11px 6px", borderRadius: 999, background: p.atraso ? (interno ? AMARELO : INK) : neutro, color: p.atraso ? (interno ? INK : AMARELO) : neutroFg }}>
                                  {p.atraso ? `atrasado há ${p.dias}d` : `entrega em ${p.dias}d`}
                                </span>
                                {/* nem todo pedido aprovado passa pela clicheria
                                    (arte que reaproveita clichê, ajuste que não
                                    grava nada): daqui ele fecha direto */}
                                {podeConcluirSemCliche && (
                                  <button type="button" className="r2chip"
                                    onClick={(ev) => { ev.stopPropagation(); setSemCliche({ id: p.raw.id, num: p.num, cliente: p.cliente }); }}
                                    title="Fecha o pedido sem passar pela clicheria — dá para arrastar o card para “Concluídos” também"
                                    style={{ display: "inline-flex", alignItems: "center", gap: 7, border: 0, cursor: "pointer", borderRadius: 999, padding: "8px 13px 7px", font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap", background: interno ? AMARELO : INK, color: interno ? INK : AMARELO }}>
                                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={interno ? INK : AMARELO} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="m4.5 12.5 5 5 10-11" /></svg>
                                    Concluir sem clichê
                                  </button>
                                )}
                                {/* "Responder cliente" e "Prova enviada" saíram:
                                    o cliente não entra no hub — esse diálogo é
                                    por fora (e-mail/WhatsApp). */}
                              </div>
                            </div>
                            <div style={{ width: 1, alignSelf: "stretch", background: interno ? "rgba(241,241,241,.16)" : prod ? "rgba(37,36,37,.16)" : "#ececec" }} />
                            <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
                              <span style={{ display: "grid", placeItems: "center", flex: "none", width: 26, height: 26, borderRadius: 999, border: `1.5px solid ${interno ? "rgba(241,241,241,.45)" : prod ? "rgba(37,36,37,.35)" : "#d6d5d6"}` }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={interno ? "#f1f1f1" : INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 17.5 17.5 6.5" /><path d="M9.5 6.5h8v8" /></svg>
                              </span>
                              <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "16px 26px", justifyItems: "end" }}>
                                {[["Medida", p.partes[0]], ["Substrato", p.partes[1]], ["Cores", p.partes[2]], ["Entrega", p.prazo]].map(([k, v]) => (
                                  <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                                    <span style={{ font: `600 12.5px/1 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", whiteSpace: "nowrap", color: interno ? "#8d8b8d" : prod ? "rgba(37,36,37,.5)" : "#b3b1b3" }}>{k}</span>
                                    <span style={{ ...fr(48, 700), fontSize: 17, lineHeight: 1, letterSpacing: "-.01em", whiteSpace: "nowrap", color: interno ? "#f1f1f1" : INK }}>{v}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", gap: 12, height: "100%", padding: "16px 6px 14px" }}>
                            <span style={{ font: `600 14.5px/1 ${MONO}`, letterSpacing: ".06em", color: interno ? "#8d8b8d" : "#b3b1b3" }}>{String(i + 1).padStart(2, "0")}</span>
                            <span title={p.cliente} style={{ flex: 1, minHeight: 0, writingMode: "vertical-rl", transform: "rotate(180deg)", ...fr(72, 700), ...nomeEmPe(p.cliente), letterSpacing: "-.02em", textAlign: "left", overflow: "hidden", color: interno ? "#f1f1f1" : INK }}>
                              {p.cliente}
                            </span>
                            <span style={{ width: 7, height: 7, borderRadius: 999, background: p.atraso ? AMARELO : interno ? "#3a383a" : "#e0e0e0" }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>

              {/* Entrada automática */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", background: INK, borderRadius: 8, padding: "14px 16px 14px 18px" }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M3.5 12.5h6l1.5 2.5h2l1.5-2.5h6" /><path d="M3.5 12.5 6 5.5h12l2.5 7v6h-17z" /><path d="M12 3v5" /><path d="m9.5 6 2.5 2.5L14.5 6" /></svg>
                <span style={{ flex: 1, font: "500 15px/1.35 Inter, sans-serif", color: "#f1f1f1" }}>
                  Entrada automática — todo pedido aprovado em <strong style={{ color: AMARELO, fontWeight: 700 }}>Solicitação de arte</strong> cai nesta fila, sem cadastro manual.
                </span>
                <button onClick={() => setModal({})} className="r2chip" style={{ flex: "none", background: "transparent", border: "2px solid #4a484a", borderRadius: 999, padding: "9px 15px", cursor: "pointer", font: "600 14.5px/1 Inter, sans-serif", color: "#f1f1f1", whiteSpace: "nowrap" }}>
                  Lançar manualmente
                </button>
              </div>

              {/* Enviados à clicheria + Concluídos */}
              <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div
                  onDragOver={(e) => { if (arrastando?.lado === "concluido" && aoVoltarClicheria) { e.preventDefault(); setAlvo("clicheria"); } }}
                  onDragLeave={() => setAlvo((a2) => (a2 === "clicheria" ? null : a2))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = arrastando?.lado === "concluido" ? arrastando.id : "";
                    setAlvo(null); setArrastando(null);
                    if (id && aoVoltarClicheria) void aoVoltarClicheria(id);
                  }}
                  style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 10, borderRadius: 14, outline: alvo === "clicheria" ? `3px dashed ${AMARELO}` : "none", outlineOffset: 6, transition: "outline-color .15s ease" }}>
                  <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 10, padding: "6px 2px 0" }}>
                    <span className="select-none" style={tituloFaixa}>Enviados à clicheria</span>
                    <span style={{ flex: 1, height: 2, background: "#e4e4e4", borderRadius: 999 }} />
                    <span style={{ font: "400 14.5px/1 Inter, sans-serif", color: alvo === "clicheria" ? INK : "#b3b1b3", whiteSpace: "nowrap" }}>
                      {alvo === "clicheria"
                        ? "solte aqui para voltar à clicheria"
                        : `${vis.length} na clicheria${vis.length > 4 ? " · role a lista" : ""}`}
                    </span>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 2 }}>
                    {vis.length === 0 && (
                      <div style={{ display: "grid", placeItems: "center", background: "#fff", border: "2px dashed #d6d5d6", borderRadius: 12, padding: 26, font: "400 15px/1.4 Inter, sans-serif", color: "#8d8b8d", textAlign: "center" }}>
                        {solicitacoes.length > 0 ? "Nenhuma solicitação com esse filtro." : "Nada na clicheria — todas as solicitações voltaram."}
                      </div>
                    )}
                    {vis.slice(0, 60).map((s) => {
                      const conferida = !!conferidas[s.num];
                      return (
                        <div key={s.raw.id} className="r2row" onClick={() => onOpen(s.raw.id)}
                          draggable
                          onDragStart={() => setArrastando({ lado: "enviado", id: s.raw.id, num: s.num })}
                          onDragEnd={() => { setArrastando(null); setAlvo(null); }}
                          title="Arraste para Concluídos para registrar a chegada"
                          style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", cursor: "pointer", boxShadow: SOMBRA_CARD, opacity: arrastando?.id === s.raw.id ? 0.45 : 1 }}>
                          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                              <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <span style={{ flex: "none", font: `500 15px/1 ${MONO}`, color: "#8d8b8d" }}>{s.num}</span>
                                <span style={{ flex: "0 0 auto", ...fr(72, 700), fontSize: 22, lineHeight: 1.15, letterSpacing: "-.02em", color: INK }}>{s.cliente}</span>
                                <span style={{ flex: "none", font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "7px 8px 5px", borderRadius: 999, background: FUNDO, color: "#5c5a5c" }}>{s.motivo}</span>
                              </div>
                              <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7 }}>
                                <span style={{ font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "7px 9px 5px", borderRadius: 999, background: s.enviado ? FUNDO : INK, color: s.enviado ? "#5c5a5c" : AMARELO }}>
                                  {s.enviado ? "e-mail enviado" : "e-mail não enviado"}
                                </span>
                                <span style={{ font: "400 14.5px/1 Inter, sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>{s.quando}</span>
                              </div>
                            </div>
                            <div style={{ font: "400 14.5px/1.35 Inter, sans-serif", color: "#5c5a5c", letterSpacing: ".04em", textTransform: "uppercase" }}>
                              {s.medida} · clichê {s.tipo} mm · {s.cores}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <span style={{ flex: 1, minWidth: 140, font: "400 14.5px/1.3 Inter, sans-serif", color: "#8d8b8d" }}>
                                {s.obs ? `${s.obs} · ${s.autor}` : `Sem observação · ${s.autor}`}
                              </span>
                              <div style={{ flex: "none", display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => setChegou({ id: s.raw.id, num: s.num, cliente: s.cliente, cores: s.cores, registro: registros[s.num] })} className="r2chip"
                                  style={{ display: "flex", alignItems: "center", gap: 7, border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 13px", font: "700 13.5px/1 Inter, sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: INK, color: AMARELO, whiteSpace: "nowrap" }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M3.5 12.5h6l1.5 2.5h2l1.5-2.5h6" /><path d="M3.5 12.5 6 5.5h12l2.5 7v6h-17z" /></svg>
                                  Clichê chegou
                                </button>
                                <button onClick={() => setConferidas((c) => ({ ...c, [s.num]: !c[s.num] }))} className="r2chip"
                                  style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 13px", font: "700 13.5px/1 Inter, sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: conferida ? INK : AMARELO, color: conferida ? AMARELO : INK }}>
                                  {conferida ? "Conferida" : "Conferir"}
                                </button>
                                <button onClick={() => setAviso(`Reprovar ${s.num} — volta para Design aprovado (em breve no back-end).`)} className="r2chip"
                                  style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 13px", font: "700 13.5px/1 Inter, sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: FUNDO, color: "#5c5a5c" }}>
                                  Reprovar
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  onDragOver={(e2) => { if (arrastando?.lado === "enviado" || (arrastando?.lado === "chegada" && podeConcluirSemCliche)) { e2.preventDefault(); setAlvo("concluidos"); } }}
                  onDragLeave={() => setAlvo((a2) => (a2 === "concluidos" ? null : a2))}
                  onDrop={(e2) => {
                    e2.preventDefault();
                    const solto = arrastando;
                    setAlvo(null); setArrastando(null);
                    /* card da aprovação de arte: fecha o pedido SEM clichê —
                       confirma antes, porque desfazer pede "reabrir pedido" */
                    if (solto?.lado === "chegada" && podeConcluirSemCliche) {
                      const ch = chegadas.find((x) => x.raw.id === solto.id);
                      if (ch) setSemCliche({ id: ch.raw.id, num: ch.num, cliente: ch.cliente });
                      return;
                    }
                    const alvoNum = solto?.lado === "enviado" ? solto.num : "";
                    const s2 = solicitacoes.find((x) => x.num === alvoNum);
                    // chegada pede data, hora e valores: abre a modal, não grava direto
                    if (s2) setChegou({ id: s2.raw.id, num: s2.num, cliente: s2.cliente, cores: s2.cores, registro: registros[s2.num] });
                  }}
                  style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 10, borderRadius: 14, outline: alvo === "concluidos" ? `3px dashed ${AMARELO}` : "none", outlineOffset: 6, transition: "outline-color .15s ease" }}>
                  <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 10, padding: "6px 2px 0" }}>
                    <span className="select-none" style={tituloFaixa}>Concluídos</span>
                    <span style={{ flex: 1, height: 2, background: "#e4e4e4", borderRadius: 999 }} />
                    <span style={{ font: "400 14.5px/1 Inter, sans-serif", color: alvo === "concluidos" ? INK : "#b3b1b3", whiteSpace: "nowrap" }}>
                      {alvo === "concluidos"
                        ? "solte aqui para registrar a chegada"
                        : concluidos.length === 0
                          ? "aguardando registros"
                          /* contava PEDIDOS e chamava de clichês, enquanto o card
                             de cada pedido conta as cores — dois números com o
                             mesmo nome na mesma tela. Agora diz os dois. */
                          : `${concluidosVis.length} ${concluidosVis.length === 1 ? "pedido" : "pedidos"} · ${concluidosVis.reduce((a, r) => a + r.itens.length, 0)} clichês · ${brl(concluidosVis.reduce((a, r) => a + r.total, 0))}`}
                    </span>
                  </div>
                  {concluidos.length > 0 && (
                    <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "0 2px" }}>
                      <span style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b3b1b3" strokeWidth="2.4" strokeLinecap="round" style={{ position: "absolute", left: 12, pointerEvents: "none" }}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
                        <input
                          value={buscaConcl}
                          onChange={(e) => { setBuscaConcl(e.target.value); setLimiteConcl(PAGINA_CONCL); }}
                          placeholder="Buscar concluído por cliente, nº ou data"
                          style={{ width: "100%", background: "#fff", border: `2px solid ${FUNDO}`, borderRadius: 999, padding: "10px 14px 10px 34px", font: "500 14.5px/1 Inter, sans-serif", color: INK, outline: "none" }}
                        />
                      </span>
                      {buscaConcl && (
                        <button onClick={() => { setBuscaConcl(""); setLimiteConcl(PAGINA_CONCL); }} className="r2chip"
                          style={{ flex: "none", border: 0, background: FUNDO, borderRadius: 999, padding: "10px 14px", cursor: "pointer", font: "600 13.5px/1 Inter, sans-serif", color: "#5c5a5c", whiteSpace: "nowrap" }}>
                          Limpar
                        </button>
                      )}
                    </div>
                  )}
                  <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 2 }}>
                    {concluidos.length === 0 && (
                      <div style={{ display: "grid", placeItems: "center", background: "#fff", border: "2px dashed #d6d5d6", borderRadius: 12, padding: 26, font: "400 15px/1.4 Inter, sans-serif", color: "#8d8b8d", textAlign: "center" }}>
                        Nenhum clichê registrado ainda — use "Clichê chegou" num pedido enviado à clicheria.
                      </div>
                    )}
                    {concluidos.length > 0 && concluidosVis.length === 0 && (
                      <div style={{ display: "grid", placeItems: "center", background: "#fff", border: "2px dashed #d6d5d6", borderRadius: 12, padding: 26, font: "400 15px/1.4 Inter, sans-serif", color: "#8d8b8d", textAlign: "center" }}>
                        Nenhum concluído com “{buscaConcl}”.
                      </div>
                    )}
                    {concluidosNaTela.map((c) => {
                      const aberto = concluidoAberto === c.num;
                      return (
                        <div key={c.raw.id} onClick={() => setConcluidoAberto(aberto ? null : c.num)}
                          draggable={!!aoVoltarClicheria}
                          onDragStart={() => setArrastando({ lado: "concluido", id: c.raw.id, num: c.num })}
                          onDragEnd={() => { setArrastando(null); setAlvo(null); }}
                          title={aoVoltarClicheria ? "Arraste para a clicheria para desfazer o recebimento" : undefined}
                          style={{ display: "flex", flexDirection: "column", gap: 14, cursor: "pointer", background: "#fffbe0", borderRadius: 12, padding: "18px 20px", boxShadow: SOMBRA_CARD, border: "1px solid #f2e6a8", opacity: arrastando?.id === c.raw.id ? 0.45 : 1 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 9, rowGap: 7, flexWrap: "wrap" }}>
                                <span style={{ font: `500 14.5px/1.3 ${MONO}`, color: "#8d8b8d" }}>{c.num}</span>
                                <span style={{ font: "600 15px/1.35 Inter, sans-serif", color: INK }}>{c.cliente}</span>
                                <span style={{ font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "5px 8px 3px", borderRadius: 999, background: AMARELO, color: INK }}>Recebido</span>
                              </div>
                              {!aberto ? (
                                <div style={{ font: "500 13.5px/1.3 Inter, sans-serif", color: "#8d8b8d", marginTop: 10 }}>
                                  {c.registrado
                                    ? `${c.dataLabel} às ${c.horaLabel} · ${c.itens.length} ${c.itens.length === 1 ? "clichê" : "clichês"}`
                                    : "chegada sem valores lançados"}
                                </div>
                              ) : (
                                <>
                                  <div style={{ font: "600 12.5px/1 Inter, sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#b3b1b3", marginTop: 12 }}>Chegada</div>
                                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
                                    <span style={{ ...fr(96, 700), fontSize: 30, lineHeight: 1, letterSpacing: "-.03em", color: INK, whiteSpace: "nowrap" }}>{c.dataLabel}</span>
                                    <span style={{ ...fr(72, 700), fontSize: 20, lineHeight: 1, letterSpacing: "-.02em", color: INK, whiteSpace: "nowrap" }}>{c.horaLabel}</span>
                                  </div>
                                  <div style={{ font: "600 12.5px/1 Inter, sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#b3b1b3", marginTop: 10 }}>
                                    chegou na R2 · {c.itens.length} {c.itens.length === 1 ? "clichê" : "clichês"}
                                  </div>
                                </>
                              )}
                            </div>
                            <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
                              <span style={{ font: "600 12.5px/1 Inter, sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#b3b1b3" }}>Total do clichê</span>
                              {/* sem registro não se mostra R$ 0,00 — zero é um
                                  valor, "a lançar" é a verdade */}
                              <span style={{ font: `800 ${c.registrado ? 22 : 15}px/1 Inter, sans-serif`, letterSpacing: "-.02em", color: c.registrado ? INK : "#b3b1b3", whiteSpace: "nowrap" }}>{c.registrado ? brl(c.total) : "a lançar"}</span>
                              {aberto && (
                                <button onClick={(e) => {
                                  e.stopPropagation();
                                  /* sem registro a modal monta as linhas pelas cores do pedido —
                                     mandar itens vazios abriria um formulário sem nenhuma linha */
                                  const reg = registros[c.num]
                                    ?? (c.registrado ? { data: c.dataKey, hora: c.horaLabel.replace(/h$/, ""), itens: c.itens, total: c.total, notaNome: c.nota } : undefined);
                                  setChegou({ id: c.raw.id, num: c.num, cliente: c.cliente, cores: String(c.raw.cores ?? ""), registro: reg });
                                }} className="r2chip"
                                  style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 13px", font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", background: FUNDO, color: "#5c5a5c" }}>
                                  {c.registrado ? "Editar valores" : "Lançar valores"}
                                </button>
                              )}
                              {/* A nota da clicheria de onde saíram esses valores.
                                  Só aparece quando o registro veio de uma. */}
                              {aberto && c.nota && aoAbrirNota && (
                                <button onClick={(e) => { e.stopPropagation(); void aoAbrirNota(c.raw.id); }}
                                  title={`Abrir ${c.nota}`} className="r2chip"
                                  style={{ display: "flex", alignItems: "center", gap: 6, border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 13px", font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", background: "transparent", color: "#8d8b8d", boxShadow: "inset 0 0 0 1.5px #e2ddb4" }}>
                                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />
                                  </svg>
                                  Nota
                                </button>
                              )}
                              {aberto && aoVoltarClicheria && (
                                voltando === c.raw.id ? (
                                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <button onClick={(e) => {
                                      e.stopPropagation();
                                      setVoltando(null);
                                      void aoVoltarClicheria(c.raw.id);
                                    }} className="r2chip"
                                      style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 13px", font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", background: INK, color: AMARELO }}>
                                      Confirmar
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); setVoltando(null); }} className="r2chip"
                                      style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 11px", font: "600 12.5px/1 Inter, sans-serif", whiteSpace: "nowrap", background: "transparent", color: "#8d8b8d" }}>
                                      cancelar
                                    </button>
                                  </span>
                                ) : (
                                  <button onClick={(e) => { e.stopPropagation(); setVoltando(c.raw.id); }} className="r2chip"
                                    title="Desfazer o recebimento — o pedido volta para a clicheria"
                                    style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 13px", font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", background: "transparent", color: "#8d8b8d", boxShadow: "inset 0 0 0 1.5px #e2ddb4" }}>
                                    ↩ Voltar para a clicheria
                                  </button>
                                )
                              )}
                              <span style={{ font: "700 15px/1 Inter, sans-serif", color: "#8d8b8d" }}>{aberto ? "↙" : "↗"}</span>
                            </div>
                          </div>
                          {aberto && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {c.itens.map((it, j) => (
                                <span key={j} style={{ display: "flex", alignItems: "center", gap: 6, background: "#f6f6f6", borderRadius: 999, padding: "6px 10px", font: "500 12.5px/1 Inter, sans-serif", color: "#8d8b8d", whiteSpace: "nowrap" }}>
                                  {it.descricao}
                                  <span style={{ font: `600 12.5px/1 ${MONO}`, color: "#b3b1b3" }}>{brl(it.valor)}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* o resto da lista sob demanda: sem isto o histórico inteiro
                        virava uma rolagem só — e antes ele nem chegava até aqui,
                        parava nos 40 mais recentes, calado */}
                    {faltamConcl > 0 && (
                      <button onClick={() => setLimiteConcl((n) => n + PAGINA_CONCL)} className="r2chip"
                        style={{ flex: "none", border: 0, background: "#fff", borderRadius: 12, padding: "14px 18px", cursor: "pointer", font: "700 14px/1 Inter, sans-serif", color: INK, boxShadow: SOMBRA_CARD }}>
                        Mostrar mais {Math.min(PAGINA_CONCL, faltamConcl)} · faltam {faltamConcl}
                      </button>
                    )}
                    {faltamConcl === 0 && concluidosVis.length > PAGINA_CONCL && (
                      <span style={{ flex: "none", textAlign: "center", padding: "8px 0 2px", font: "400 13.5px/1 Inter, sans-serif", color: "#b3b1b3" }}>
                        fim da lista · {concluidosVis.length} {concluidosVis.length === 1 ? "pedido" : "pedidos"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <ModalSolicitarCliche
          inicial={modal}
          onFechar={() => setModal(null)}
          onEnviar={(num) => { setModal(null); setAviso(`Solicitação ${num || ""} enviada por e-mail à clicheria.`.replace("  ", " ")); }}
          aoEnviar={aoSolicitarCliche ? (dados) => aoSolicitarCliche(modal.num, dados) : undefined}
        />
      )}
      {/* confirmação — concluir sem clichê */}
      {semCliche && (
        <div onClick={() => setSemCliche(null)} data-modal-esc style={{ position: "absolute", inset: 0, zIndex: 62, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>{semCliche.num} · {semCliche.cliente}</div>
              <div style={{ ...fr(96, 700), fontSize: 36, lineHeight: 1.02, letterSpacing: "-.03em", color: INK, marginTop: 10 }}>Concluir sem clichê</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", font: "400 16px/1.5 Inter, sans-serif", color: "#5c5a5c" }}>
              O pedido é fechado agora, sem passar pela clicheria e sem registro de chegada.
              Ele sai de “Chegaram da aprovação de arte” e entra em Finalizados.
              Para desfazer depois é preciso <strong style={{ color: INK }}>reabrir o pedido</strong>.
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
              <button type="button" className="r2chip" onClick={() => setSemCliche(null)}
                style={{ border: 0, background: "#fff", borderRadius: 7, padding: "15px 22px", font: "600 15px/1 Inter, sans-serif", color: INK, cursor: "pointer" }}>Cancelar</button>
              <button type="button" className="r2chip" disabled={concluindo}
                onClick={() => {
                  if (!aoConcluirSemCliche || concluindo) return;
                  setConcluindo(true);
                  const quem = semCliche;
                  void aoConcluirSemCliche(quem.id)
                    .then(() => { setSemCliche(null); setAviso(`${quem.num} concluído sem clichê.`); })
                    .catch((err: unknown) => setAviso(err instanceof Error ? err.message : "Não deu para concluir o pedido."))
                    .finally(() => setConcluindo(false));
                }}
                style={{ display: "flex", alignItems: "center", gap: 9, border: 0, borderRadius: 7, padding: "15px 22px", font: "700 15px/1 Inter, sans-serif", color: INK, background: AMARELO, cursor: concluindo ? "progress" : "pointer", opacity: concluindo ? 0.6 : 1 }}>
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="m4.5 12.5 5 5 10-11" /></svg>
                {concluindo ? "Concluindo…" : "Concluir pedido"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* confirmação — cancelar o envio à clicheria */}
      {cancelando && (
        <div onClick={() => setCancelando(null)} data-modal-esc style={{ position: "absolute", inset: 0, zIndex: 62, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>{cancelando.num}{cancelando.cliente ? ` · ${cancelando.cliente}` : ""}</div>
              <div style={{ ...fr(96, 700), fontSize: 36, lineHeight: 1.02, letterSpacing: "-.03em", color: INK, marginTop: 10 }}>Cancelar o envio à clicheria</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px", font: "400 16px/1.5 Inter, sans-serif", color: "#5c5a5c" }}>
              O pedido volta para “Chegaram da aprovação de arte” e sai da conta do dia no Pódio.
              O e-mail que já foi para a clicheria <strong style={{ color: INK }}>não se desfaz</strong> — avise a clicheria por fora.
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
              <button type="button" className="r2chip" onClick={() => setCancelando(null)}
                style={{ border: 0, background: "#fff", borderRadius: 7, padding: "15px 22px", font: "600 15px/1 Inter, sans-serif", color: INK, cursor: "pointer" }}>Deixar como está</button>
              <button type="button" className="r2chip" disabled={cancelandoAgora}
                onClick={() => {
                  if (!aoCancelarCliche || cancelandoAgora) return;
                  setCancelandoAgora(true);
                  const quem = cancelando;
                  void Promise.resolve(aoCancelarCliche(quem.id))
                    .then(() => { setCancelando(null); setAviso(`${quem.num} voltou para a aprovação de arte.`); })
                    .catch((err: unknown) => setAviso(err instanceof Error ? err.message : "Não deu para cancelar o envio."))
                    .finally(() => setCancelandoAgora(false));
                }}
                style={{ display: "flex", alignItems: "center", gap: 9, border: 0, borderRadius: 7, padding: "15px 22px", font: "700 15px/1 Inter, sans-serif", color: INK, background: AMARELO, cursor: cancelandoAgora ? "progress" : "pointer", opacity: cancelandoAgora ? 0.6 : 1 }}>
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M9.5 6.5 4 12l5.5 5.5" /><path d="M4 12h11a5 5 0 0 1 5 5v1" /></svg>
                {cancelandoAgora ? "Cancelando…" : "Cancelar o envio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {chegou && (
        <ClicheChegouModalV1a
          num={chegou.num}
          cliente={chegou.cliente}
          cores={chegou.cores}
          registro={chegou.registro}
          fechar={() => setChegou(null)}
          onSalvar={(r) => {
            setRegistros((m) => ({ ...m, [chegou.num]: r }));
            aoRegistrarCliche?.(chegou.id, r);
            setChegou(null);
            setAviso(`Clichê de ${chegou.num} registrado — ${r.itens.length} ${r.itens.length === 1 ? "clichê" : "clichês"} · ${brl(r.total)}`);
          }}
        />
      )}
      {acao && (
        <div className="r2modal" style={{ position: "absolute", inset: 0, zIndex: 62, display: "flex", alignItems: "center", justifyContent: "center", padding: 36, background: "rgba(37,36,37,.52)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", borderRadius: 14 }}>
          <div style={{ width: 620, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>
              {acao.num} · {acao.cliente}
            </div>
            <div style={{ ...fr(96, 700), fontSize: 32, lineHeight: 1, letterSpacing: "-.03em", color: INK, margin: "10px 0 6px" }}>
              {acao.tipo === "resposta" ? "Responder o cliente" : "Prova de impressão enviada"}
            </div>
            <p style={{ font: "400 14px/1.45 Inter, sans-serif", color: "#5c5a5c", margin: "0 0 16px" }}>
              {acao.tipo === "resposta"
                ? "Fica registrado na conversa do pedido como resposta ao cliente, e a equipe é avisada."
                : "Fica registrado no histórico do pedido com a data e quem enviou. A observação é opcional."}
            </p>
            <textarea value={acaoTexto} onChange={(e) => setAcaoTexto(e.target.value)} rows={4}
              placeholder={acao.tipo === "resposta" ? "O que foi respondido ao cliente" : "Observação (opcional) — por onde foi enviada, por exemplo"}
              style={{ width: "100%", resize: "vertical", background: "#fff", border: "2px solid #e0e0e0", borderRadius: 8, padding: "12px 13px", font: "500 15px/1.4 Inter, sans-serif", color: INK, outline: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
              <button onClick={confirmarAcao} disabled={salvandoAcao} className="r2chip"
                style={{ flex: 1, border: 0, borderRadius: 8, padding: "12px 16px", cursor: salvandoAcao ? "wait" : "pointer", font: "700 13.5px/1 Inter, sans-serif", letterSpacing: ".06em", textTransform: "uppercase", background: AMARELO, color: INK, opacity: salvandoAcao ? .6 : 1 }}>
                {acao.tipo === "resposta" ? "Registrar resposta" : "Registrar envio"}
              </button>
              <button onClick={() => setAcao(null)} data-esc-fechar
                style={{ flex: "none", background: "transparent", border: 0, cursor: "pointer", font: "500 14px/1 Inter, sans-serif", color: "#8d8b8d" }}>cancelar</button>
            </div>
          </div>
        </div>
      )}
      {aviso && <AvisoV1a texto={aviso} onFechar={() => setAviso("")} />}
      {children}
    </EstagioV1a>
  );
}

/* ————— Modal "Solicitar clichê — E-mail à clicheria" ————— */
/** Dados que o envio REAL manda para criarSolicitacaoCliche. */
export type DadosSolicitacaoCliche = {
  tipo: "1.70" | "1.14";
  cliente: string | null;
  cores: string[];
  motivo: string;
  observacao: string | null;
  anexos: { nome: string; dataBase64: string }[];
};

function ModalSolicitarCliche({ inicial, onFechar, onEnviar, aoEnviar }: {
  inicial: { cliente?: string; num?: string; motivo?: string; tipo?: string };
  onFechar: () => void;
  onEnviar: (num?: string) => void;
  /** envio real (criarSolicitacaoCliche) — sem ele o botão só avisa (protótipo) */
  aoEnviar?: (dados: DadosSolicitacaoCliche) => Promise<unknown>;
}) {
  const [tipoCliche, setTipoCliche] = useState(inicial.tipo ?? "");
  const [cliente, setCliente] = useState(inicial.cliente ?? "");
  const [cores, setCores] = useState<string[]>([""]);
  const [motivo, setMotivo] = useState(inicial.motivo ?? "");
  const [motivosExtra, setMotivosExtra] = useState<string[]>([]);
  const [criandoMotivo, setCriandoMotivo] = useState(false);
  const [novoMotivo, setNovoMotivo] = useState("");
  const [obs, setObs] = useState("");
  const [anexos, setAnexos] = useState<{ nome: string; tam: string; dataBase64?: string }[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const arquivoRef = useRef<HTMLInputElement>(null);

  /* Motivos cadastrados moram no banco (cliche_motivos) — antes o "adicionar"
     só existia neste navegador e a tabela ficava vazia para sempre. */
  useEffect(() => {
    if (!aoEnviar) return;
    void (listMotivosCliche() as Promise<{ nome: string }[]>)
      .then((r) => setMotivosExtra((r ?? []).map((m) => m.nome).filter((n) => !(MOTIVOS as readonly string[]).includes(n))))
      .catch(() => { /* fica só com a lista fixa */ });
  }, [aoEnviar]);

  function salvarNovoMotivo() {
    const nome = novoMotivo.trim();
    if (nome.length < 2) return;
    const aplicar = () => {
      setMotivosExtra((m) => (m.includes(nome) ? m : [...m, nome]));
      setMotivo(nome);
      setCriandoMotivo(false);
    };
    if (!aoEnviar) { aplicar(); return; }
    addMotivoCliche({ data: { nome } })
      .then(aplicar)
      .catch((e: unknown) => {
        // "já existe" não é problema — só entra na lista e segue
        if (e instanceof Error && /existe/i.test(e.message)) { aplicar(); return; }
        aplicar(); // vale para ESTA solicitação mesmo sem cadastro
        setErroEnvio(e instanceof Error ? `O motivo vale para esta solicitação, mas não foi cadastrado: ${e.message}` : "Motivo não cadastrado no sistema.");
      });
  }

  function anexarArquivos(lista: FileList | null) {
    if (!lista) return;
    Array.from(lista).forEach((f) => {
      const leitor = new FileReader();
      leitor.onload = () => {
        const dataBase64 = String(leitor.result || "").split(",")[1] || "";
        const tam = f.size > 1048576 ? (f.size / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.ceil(f.size / 1024) + " KB";
        setAnexos((a) => a.some((x) => x.nome === f.name) ? a : [...a, { nome: f.name, tam, dataBase64 }]);
      };
      leitor.readAsDataURL(f);
    });
  }

  function enviarReal() {
    if (!aoEnviar) { onEnviar(inicial.num); return; }
    setEnviando(true);
    setErroEnvio("");
    /* A distorção calculada no card ao lado ENTRA na observação: antes a
       pessoa calculava dentro deste formulário e o e-mail à clicheria saía
       sem o número — não ficava registrado em lugar nenhum. */
    const distTxt = dist.pct !== "—"
      ? `Distorção: ${dist.pct}% · ${dentes} dentes ${modulo} · repetição ${dist.r} · impresso ${dist.impresso}${dist.arte !== "—" ? ` · arte corrigida ${dist.arte}` : ""}`
      : "";
    const obsFinal = [obs.trim(), distTxt].filter(Boolean).join("\n") || null;
    aoEnviar({
      tipo: (tipoCliche.replace(",", ".") === "1.14" ? "1.14" : "1.70"),
      cliente: cliente.trim() || null,
      cores: cores.map((c) => c.trim()).filter(Boolean),
      motivo,
      observacao: obsFinal,
      anexos: anexos.filter((a) => a.dataBase64).map((a) => ({ nome: a.nome, dataBase64: a.dataBase64! })),
    })
      .then(() => onEnviar(inicial.num))
      .catch((e: unknown) => setErroEnvio(e instanceof Error ? e.message : "Não deu para enviar a solicitação."))
      .finally(() => setEnviando(false));
  }
  const [dentes, setDentes] = useState("");
  const [modulo, setModulo] = useState(MODULOS[0].nome);
  const [arteMm, setArteMm] = useState("");

  const valida = !!tipoCliche && motivo.length > 0 && cores.length > 0 && cores.every((c) => c.trim().length > 0);

  const nf = (v: number, d: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const dist = (() => {
    const mod = MODULOS.find((m) => m.nome === modulo) ?? MODULOS[0];
    const esp = tipoCliche === "1,70" ? 1.7 : tipoCliche === "1,14" ? 1.14 : null;
    const nd = parseFloat(dentes.replace(",", "."));
    if (!esp || !nd || nd <= 0) {
      return { pct: "—", r: "—", impresso: "—", formula: esp ? "Informe o nº de dentes" : "Escolha o tipo de clichê e o nº de dentes", arte: "—" };
    }
    const R = nd * mod.passo;
    const K = 2 * Math.PI * (esp - POLIESTER);
    const arte = parseFloat(arteMm.replace(",", "."));
    return {
      pct: nf((K / R) * 100, 3),
      r: `${nf(R, 2)} mm`,
      impresso: `${nf(R - K, 2)} mm`,
      formula: `R = ${nf(nd, 0)} × ${nf(mod.passo, 4)} = ${nf(R, 2)} · K = 2π × (${nf(esp, 2)} − 0,127) = ${nf(K, 3)} · % = K/R × 100`,
      arte: arte > 0 ? `${nf(arte * ((R - K) / R), 2)} mm (arte flat)` : "—",
    };
  })();

  const label = { display: "block", font: "600 14.5px/1 Inter, sans-serif", color: "#5c5a5c" } as const;
  const input = { width: "100%", background: FUNDO, border: `2px solid ${FUNDO}`, borderRadius: 7, padding: "13px 15px", font: "400 15px/1.2 Inter, sans-serif", color: INK, outline: "none", boxSizing: "border-box" } as const;
  const cardHead = { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 } as const;
  const cardTitle = { font: "800 19px/1 Inter, sans-serif", letterSpacing: "-.01em", whiteSpace: "nowrap" as const, color: INK };
  const card = { display: "flex", flexDirection: "column" as const, background: "#fff", borderRadius: 12, padding: "22px 24px 20px", boxShadow: SOMBRA_CARD };

  return (
    <div className="r2modal" style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "rgba(37,36,37,.52)", backdropFilter: "blur(4px)" }}>
      <div style={{ width: 900, maxHeight: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18, background: FUNDO, borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>Solicitar clichê</div>
            <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1, letterSpacing: "-.03em", whiteSpace: "nowrap", color: INK, marginTop: 10 }}>E-mail à clicheria</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: INK, background: AMARELO, borderRadius: 999, padding: "8px 12px", whiteSpace: "nowrap" }}>
              Envia para clicheria@r2etiquetas.com.br
            </span>
            <button onClick={onFechar} className="r2ic" data-esc-fechar style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "stretch" }}>
          {/* Dados do clichê */}
          <div style={card}>
            <div style={cardHead}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 3 3 8l9 5 9-5-9-5z" /><path d="M3 12.5l9 5 9-5" /><path d="M3 17l9 5 9-5" /></svg>
              <span style={cardTitle}>Dados do clichê</span>
            </div>
            <label style={{ ...label, marginBottom: 8 }}>Tipo de clichê <span style={{ color: INK }}>*</span></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {["1,70", "1,14"].map((t) => {
                const on = tipoCliche === t;
                return (
                  <button key={t} onClick={() => setTipoCliche(t)} className="r2chip"
                    style={{ width: "100%", border: `2px solid ${on ? INK : FUNDO}`, borderRadius: 7, padding: "12px 14px", font: `${on ? 700 : 600} 13px/1 Inter, sans-serif`, cursor: "pointer", background: on ? INK : FUNDO, color: on ? AMARELO : INK }}>
                    Clichê {t} mm
                  </button>
                );
              })}
            </div>
            <label style={{ ...label, margin: "18px 0 8px" }}>Cliente / referência <span style={{ font: "400 13.5px/1 Inter, sans-serif", color: "#8d8b8d" }}>opcional</span></label>
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ex.: Padaria São João — rótulo bolo" style={input} />
            <label style={{ ...label, margin: "18px 0 8px" }}>Cores <span style={{ color: INK }}>*</span></label>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {cores.map((valor, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    value={valor}
                    onChange={(e) => setCores(cores.map((c, j) => (j === i ? e.target.value : c)))}
                    placeholder={`Cor ${i + 1} (ex.: Pantone 185 ou Ciano)`}
                    style={input}
                  />
                  {cores.length > 1 && (
                    <button onClick={() => setCores(cores.filter((_, j) => j !== i))} title="Remover cor" className="r2ic" style={{ flex: "none", width: 34, height: 34, display: "grid", placeItems: "center", background: FUNDO, border: 0, borderRadius: 6, cursor: "pointer" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.8" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setCores([...cores, ""])} className="r2chip" style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 7, marginTop: 9, background: "transparent", border: "2px dashed #d6d5d6", borderRadius: 999, padding: "8px 13px", font: "600 13.5px/1 Inter, sans-serif", cursor: "pointer", color: "#8d8b8d" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="3" strokeLinecap="round" style={{ flex: "none" }}><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
              Adicionar cor
            </button>
          </div>

          {/* Motivo + obs + anexos */}
          <div style={card}>
            <div style={cardHead}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M20.5 12a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.4-4.1-1L3.5 21l1.6-4.3A8.5 8.5 0 1 1 20.5 12z" /></svg>
              <span style={cardTitle}>Motivo da solicitação</span>
              <span style={{ flex: 1 }} />
              <span style={{ font: "400 13.5px/1 Inter, sans-serif", color: "#8d8b8d" }}>obrigatório</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
              {[...MOTIVOS, ...motivosExtra].map((nome) => {
                const on = motivo === nome;
                return (
                  <button key={nome} onClick={() => setMotivo(nome)} className="r2chip"
                    style={{ display: "block", textAlign: "center", borderRadius: 999, padding: "10px 13px", width: "100%", border: `2px solid ${on ? INK : FUNDO}`, font: `${on ? 700 : 500} 13px/1 Inter, sans-serif`, cursor: "pointer", background: on ? INK : FUNDO, color: on ? AMARELO : INK }}>
                    {nome}
                  </button>
                );
              })}
              {!criandoMotivo && (
                <button onClick={() => { setCriandoMotivo(true); setNovoMotivo(""); }} className="r2chip" title="Adicionar novo motivo"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, padding: "9px 12px", width: "100%", border: "2px dashed #d6d5d6", cursor: "pointer", font: "600 13.5px/1 Inter, sans-serif", whiteSpace: "nowrap", background: "transparent", color: "#8d8b8d" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="3" strokeLinecap="round" style={{ flex: "none" }}><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                  adicionar
                </button>
              )}
            </div>
            {criandoMotivo && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input value={novoMotivo} onChange={(e) => setNovoMotivo(e.target.value)} placeholder="Novo motivo..." style={input} />
                <button onClick={salvarNovoMotivo} className="r2chip"
                  style={{ flex: "none", background: INK, border: 0, borderRadius: 7, padding: "0 20px", font: "700 15px/1 Inter, sans-serif", color: AMARELO, cursor: "pointer" }}>Salvar</button>
                <button onClick={() => setCriandoMotivo(false)} className="r2chip" style={{ flex: "none", width: 48, display: "grid", placeItems: "center", background: FUNDO, border: 0, borderRadius: 7, cursor: "pointer" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                </button>
              </div>
            )}
            <label style={{ ...label, margin: "18px 0 8px" }}>Observações</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Detalhes adicionais para a clicheria..." style={{ ...input, minHeight: 84, resize: "vertical" }} />
            <label style={{ ...label, margin: "18px 0 8px" }}>Anexos</label>
            <input ref={arquivoRef} type="file" multiple style={{ display: "none" }}
              onChange={(e) => { anexarArquivos(e.target.files); e.target.value = ""; }} />
            <button onClick={() => { if (aoEnviar) arquivoRef.current?.click(); else setAnexos([...anexos, { nome: `arquivo-${anexos.length + 1}.pdf`, tam: "1,2 MB" }]); }}
              style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "#fafafa", border: "2px dashed #d6d5d6", borderRadius: 8, padding: 18, cursor: "pointer" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V5.5" /><path d="m8 9.5 4-4 4 4" /><path d="M4.5 15.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" /></svg>
              <span style={{ font: "400 14.5px/1.4 Inter, sans-serif", textAlign: "center", color: "#8d8b8d" }}>Anexar arte/arquivos para a clicheria<br />(vão junto no e-mail)</span>
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {anexos.map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: FUNDO, borderRadius: 6, padding: "9px 12px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5" /></svg>
                  <span className="truncate" style={{ flex: 1, minWidth: 0, font: "500 14.5px/1.2 Inter, sans-serif", color: INK }}>{a.nome}</span>
                  <span style={{ font: "400 13.5px/1 Inter, sans-serif", whiteSpace: "nowrap", color: "#8d8b8d" }}>{a.tam}</span>
                  <button onClick={() => setAnexos(anexos.filter((_, j) => j !== i))} className="r2ic" style={{ flex: "none", width: 22, height: 22, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 4, cursor: "pointer" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.8" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Distorção do clichê */}
          <div style={{ ...card, gridColumn: "1/-1" }}>
            <div style={cardHead}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="8.6" /><path d="M12 3.4v3" /><path d="M12 17.6v3" /><path d="M3.4 12h3" /><path d="M17.6 12h3" /></svg>
              <span style={cardTitle}>Distorção do clichê</span>
              <span style={{ flex: 1 }} />
              <span style={{ font: "400 13.5px/1 Inter, sans-serif", color: "#8d8b8d" }}>usa o tipo de clichê selecionado</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
              <div>
                <label style={{ ...label, marginBottom: 8 }}>Nº de dentes da engrenagem</label>
                <input value={dentes} onChange={(e) => setDentes(e.target.value)} placeholder="96"
                  style={{ ...input, ...fr(96, 700), fontSize: 30, letterSpacing: "-.03em", padding: "10px 16px" }} />
                <label style={{ ...label, margin: "18px 0 8px" }}>Módulo da máquina</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                  {MODULOS.map((m) => {
                    const on = modulo === m.nome;
                    return (
                      <button key={m.nome} onClick={() => setModulo(m.nome)} className="r2chip"
                        style={{ width: "100%", border: `2px solid ${on ? INK : FUNDO}`, borderRadius: 999, padding: "9px 11px", font: `${on ? 700 : 500} 11px/1 Inter, sans-serif`, whiteSpace: "nowrap", cursor: "pointer", background: on ? INK : FUNDO, color: on ? AMARELO : INK }}>
                        {m.nome}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginTop: 20, borderRadius: 10, overflow: "hidden", background: INK }}>
                <div style={{ background: AMARELO, padding: "14px 18px 12px" }}>
                  <div style={{ font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(37,36,37,.6)" }}>Resultado</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 5 }}>
                    <span style={{ ...fr(144, 700), fontSize: 42, lineHeight: 1, letterSpacing: "-.04em", color: INK }}>{dist.pct}</span>
                    <span style={{ font: "700 15px/1 Inter, sans-serif", color: INK }}>% distorção</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <div style={{ padding: "12px 18px", borderRight: "1px solid rgba(255,255,255,.08)" }}>
                    <div style={{ font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.4)", marginBottom: 6 }}>Repetição (R)</div>
                    <div style={{ ...fr(48, 700), fontSize: 20, lineHeight: 1, letterSpacing: "-.02em", color: "#fff" }}>{dist.r}</div>
                  </div>
                  <div style={{ padding: "12px 18px" }}>
                    <div style={{ font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.4)", marginBottom: 6 }}>Tamanho impresso</div>
                    <div style={{ ...fr(48, 700), fontSize: 20, lineHeight: 1, letterSpacing: "-.02em", color: AMARELO }}>{dist.impresso}</div>
                  </div>
                </div>
                <div style={{ padding: "9px 18px", borderTop: "1px solid rgba(255,255,255,.07)", font: `400 12.5px/1.4 ${MONO}`, color: "rgba(255,255,255,.35)" }}>{dist.formula}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
              <span style={{ flex: "none", font: "600 13.5px/1.3 Inter, sans-serif", maxWidth: 96, color: "#5c5a5c" }}>Correção de arte (opcional)</span>
              <input value={arteMm} onChange={(e) => setArteMm(e.target.value)} placeholder="Tamanho no print (mm)" style={input} />
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              <span className="truncate" style={{ flex: 1, minWidth: 0, background: FUNDO, borderRadius: 6, padding: "11px 13px", font: "600 15px/1 Inter, sans-serif", whiteSpace: "nowrap", color: INK }}>{dist.arte}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, font: "400 14.5px/1.4 Inter, sans-serif", color: erroEnvio ? "#c0392b" : "#8d8b8d" }}>
            {erroEnvio || (valida ? "Pronto — o e-mail sai com a arte e as cores anexadas." : "Escolha o tipo, as cores e o motivo.")}
          </span>
          <button onClick={onFechar} className="r2chip" style={{ background: "#fff", border: 0, borderRadius: 7, padding: "15px 22px", font: "600 15px/1 Inter, sans-serif", color: INK, cursor: "pointer" }}>Cancelar</button>
          <button
            onClick={() => { if (valida && !enviando) enviarReal(); }}
            className="r2chip"
            style={{ display: "flex", alignItems: "center", gap: 9, whiteSpace: "nowrap", border: 0, borderRadius: 7, padding: "15px 22px", font: "700 15px/1 Inter, sans-serif", color: INK, background: AMARELO, cursor: valida && !enviando ? "pointer" : "not-allowed", opacity: valida && !enviando ? 1 : 0.45 }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M21 4 3 11l7 3 3 7z" /><path d="M21 4 10 14" /></svg>
            <span style={{ lineHeight: "17px" }}>{enviando ? "Enviando…" : "Enviar solicitação por e-mail"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
