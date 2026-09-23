// Apontamentos — v1a. Fonte: design_handoff_r2_hub/telas/Apontamentos.dc.html
// (sistema de seções secaoDados(): geral · pedidos · aprovação · facas ·
// produção · arquivos · pantone). Valores de gasto usam a BASE de demonstração
// escalada pelo período até existir backend de custos.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import {
  AMARELO, EstagioV1a, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr,
} from "./HubV1a";
import { listPainel } from "@/lib/api/painel.functions";
import { listLeituras } from "@/lib/api/leituras.functions";
import type { Leitura } from "./dados/leituras";
import { REGISTROS } from "./dados/arquivo";

/* ————— base de demonstração (protótipo) escalada pelo período ————— */
const BASE = {
  pedidos: 84,
  cliches: 37,
  gastoCliches: 24_860,
  gastoAfiacao: 2_750,
  facasNovas: [["Fermatec", 3, 4200], ["Rotoflex", 2, 2740], ["Cortag", 1, 1700]] as [string, number, number][],
  facas: [["Enviadas", 12], ["Em afiação", 4], ["Faca nova", 3]] as [string, number][],
  estados: [["Bom", 6], ["Regular", 4], ["Ruim", 3]] as [string, number][],
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const menos = (n: number) => new Date(Date.now() - n * 86_400_000);
const diaBR = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const f = (v: number, dec = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const brlNum = (v: number) => "R$ " + f(v, 2);

const PRESETS = [{ l: "Hoje", d: 0 }, { l: "7 dias", d: 7 }, { l: "30 dias", d: 30 }, { l: "90 dias", d: 90 }];

const APP_PARA_V1A: Record<string, string> = {
  nova: "Aguardando Design", criacao: "Aguardando Design",
  aguardando: "Aguardando aprovação", revisao: "Alteração pedida",
  aprovada: "Design aprovado", cliche: "Clichê solicitado",
  concluido: "Finalizado", cancelado: "Finalizado",
};

const fmtData = (isoStr?: string) => {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
};

/** Resposta de getApontamentos — clichês, facas e produção do período. */
export type ApontamentosDados = {
  pedidos: { qtde: number };
  cliches: { qtde: number; total: number };
  solicitacoesPorMotivo: { motivo: string; qtde: number }[];
  facas: { enviadas: number; em_afiacao: number; novas_solicitadas: number };
  facasGasto: number;
  /** compras de faca do catálogo (facas_extras com valor) no período */
  facasCompradas?: { qtde: number; total: number };
  facasPorEstado: { estado: string; qtde: number }[];
};

type Celula = { v: string; mono?: boolean; forte?: boolean };
const cel = (v: unknown, mono = false, forte = false): Celula => ({
  v: String(v === undefined || v === null || v === "" ? "—" : v), mono, forte,
});

type Secao = {
  label: string;
  kpis: [string, string, string, "claro" | "amarelo" | "escuro", string][];
  titulo: string;
  sub: string;
  cols: [string, string][];
  linhas: Celula[][];
  destaquesTitulo: string;
  destaques: [string, number, string?][];
  nota: string;
  vazioTexto?: string;
};

export function ApontamentosV1a({
  profile, pedidos, versao, aoNavegar, onNova, onLogout, disponiveis, children,
  dados, aoPeriodo, podeFinanceiro = true, podeExportar = true, comBackend = false,
}: {
  profile: { nome: string; role?: string };
  pedidos: any[];
  versao: string;
  aoNavegar?: (pagina: string) => void;
  onNova?: () => void;
  onLogout?: () => void;
  disponiveis?: string[];
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
  /** números reais do período; ausente = protótipo com a BASE escalada */
  dados?: ApontamentosDados;
  /** avisa a rota quando o período muda, para refazer a consulta */
  aoPeriodo?: (de: string, ate: string) => void;
  /** apontamentos.financeiro — sem isso os valores em R$ ficam escondidos */
  podeFinanceiro?: boolean;
  /** apontamentos.exportar — sem isso o botão de relatório não aparece */
  podeExportar?: boolean;
  /** true no app real: sem resposta do servidor a tela mostra zero e avisa,
      em vez de cair na BASE de demonstração (que parece um período de verdade) */
  comBackend?: boolean;
}) {
  /** Sem apontamentos.financeiro a pessoa vê os volumes, não o dinheiro. */
  const brl = (v: number) => (podeFinanceiro ? brlNum(v) : "—");
  const [busca, setBusca] = useState("");
  const [secao, setSecao] = useState("geral");
  const [dias, setDias] = useState(30);
  const [de, setDe] = useState(() => iso(menos(30)));
  const [ate, setAte] = useState(() => iso(new Date()));
  const [erroData, setErroData] = useState("");
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const [producao, setProducao] = useState<any[]>([]);

  useEffect(() => {
    /* As leituras vivem no banco desde a migração 19 — o localStorage antigo
       (r2.leituras.v1) só tinha resíduo deste computador e o relatório
       mostrava 0 leituras com a fila cheia. */
    void (listLeituras() as Promise<any[]>)
      .then((r) => setLeituras((r ?? []) as Leitura[]))
      .catch(() => { /* sem permissão de OP/painel: contagem fica em 0 */ });
    /* A produção apontada vem do banco (era localStorage: o relatório só via
       o que tinha sido apontado NESTE computador). */
    void (listPainel() as Promise<any>)
      .then((r) => setProducao((r?.producao ?? []).map((x: any) => ({
        data: x.created_at, maquina: x.maquina, os: x.os, cliente: x.cliente,
        substrato: x.substrato, medida: x.medida, ms: Number(x.ms) || 0,
        custo: Number(x.custo) || 0, metros: Number(x.metros) || 0, tag: x.tag,
      }))))
      .catch(() => { /* servidor fora: a seção de produção fica vazia */ });
  }, []);

  /* a rota consulta o back-end com o período escolhido aqui */
  const cbPeriodo = useRef(aoPeriodo);
  cbPeriodo.current = aoPeriodo;
  useEffect(() => { cbPeriodo.current?.(de, ate); }, [de, ate]);

  const fator = dias <= 0 ? 0.04 : dias === 7 ? 0.26 : dias === 30 ? 1 : dias === 90 ? 2.7 : Math.max(0.04, dias / 30);
  const esc = (n: number) => Math.max(n > 0 ? 1 : 0, Math.round(n * fator));

  function aplicarDatas(deN: string, ateN: string) {
    const a = new Date(deN + "T00:00:00"), b = new Date(ateN + "T00:00:00");
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) { setDe(deN); setAte(ateN); setErroData("Use o formato AAAA-MM-DD."); return; }
    if (b < a) { setDe(deN); setAte(ateN); setErroData("A data final é anterior à inicial."); return; }
    setDe(deN); setAte(ateN); setDias(Math.round((b.getTime() - a.getTime()) / 86_400_000)); setErroData("");
  }

  /* — adaptação dos pedidos reais do app à forma do protótipo — */
  const peds = pedidos.map((p) => ({
    num: "#" + String(p.numero).padStart(4, "0"),
    cliente: p.cliente,
    origem: p.origem ?? (p.tipo === "cliche" ? "interno" : "vendas"),
    vendedora: p.vendedora ?? "—",
    designer: p.designer ?? "—",
    medida: `${p.largura}×${p.altura}`,
    prazo: fmtData(p.prazo ?? p.created_at),
    status: APP_PARA_V1A[p.status] ?? p.status,
    motivo: p.motivo ?? (p.tipo === "cliche" ? "Reposição" : "Arte nova"),
    tipoEsp: p.tipo_cliche ?? "1,14",
    cores: String(p.cores ?? "—"),
    substrato: p.materia,
    criado: p.created_at,
  }));

  const origemL = (o: string) => (o === "producao" ? "Produção" : o === "interno" ? "Interno" : "Vendas");
  const contar = (arr: any[], chave: (x: any) => string): [string, number][] => {
    const m: Record<string, number> = {};
    arr.forEach((x) => { const k = chave(x) || "—"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  const pastas = REGISTROS as any[];
  const gavetas = contar(pastas, (p) => p.gaveta);

  /* Números reais do período quando a rota manda `dados`; senão a BASE escalada.
     Compra de faca nova ainda não tem lançamento no sistema — no modo real
     entra como 0 e o cartão fala em quantidade, não em dinheiro. */
  const real = !!dados;
  /* Ligado ao back-end e AINDA sem resposta (carregando, ou a consulta falhou):
     aqui NÃO se mostra a BASE de demonstração. Ela é plausível — R$ 24.860 de
     clichê, R$ 2.750 de afiação — e alguém decidiria com base nela achando que
     é o gasto do período. Fora do ar, número nenhum é melhor que número falso. */
  const semResposta = comBackend && !real;
  const ROTULO_ESTADO: Record<string, string> = { bom: "Bom", regular: "Regular", ruim: "Ruim" };
  const zeroOu = (v: number) => (semResposta ? 0 : v);
  const gastoCliches = real ? dados.cliches.total : zeroOu(Math.round(BASE.gastoCliches * fator));
  const gastoAfiacao = real ? dados.facasGasto : zeroOu(Math.round(BASE.gastoAfiacao * fator));
  /* compras de faca vêm do catálogo (facas_extras com valor) — antes era 0 fixo */
  const gastoFacas = real ? Number(dados.facasCompradas?.total ?? 0) : zeroOu(Math.round(BASE.facasNovas.reduce((t, x) => t + x[2], 0) * fator));
  const qtdFacasCompradas = real ? Number(dados.facasCompradas?.qtde ?? 0) : 0;
  const qtdFacasNovas = real ? dados.facas.novas_solicitadas : zeroOu(esc(BASE.facasNovas.reduce((t, x) => t + x[1], 0)));
  const clichesQtde = real ? dados.cliches.qtde : zeroOu(esc(BASE.cliches));
  const facasEnviadas = real ? dados.facas.enviadas : zeroOu(esc(BASE.facas.find((x) => /envia/i.test(x[0]))?.[1] ?? 0));
  const facasEmAfiacao = real ? dados.facas.em_afiacao : zeroOu(esc(BASE.facas.find((x) => /afia/i.test(x[0]))?.[1] ?? 0));
  const estados: [string, number][] = real
    ? dados.facasPorEstado.map((e) => [ROTULO_ESTADO[e.estado] ?? e.estado, e.qtde])
    : semResposta ? [] : BASE.estados.map(([l, v]) => [l, esc(v)]);
  const metros = producao.reduce((t, p) => t + (Number(p.metros) || 0), 0);

  const eventos = peds
    .map((p) => ({ quando: fmtData(p.criado), num: p.num, cliente: p.cliente, texto: `Pedido registrado — ${p.status}`, autor: "—" }))
    .sort((a, b) => String(b.quando).localeCompare(String(a.quando)));

  const pantones: Record<string, { n: number; clientes: string[] }> = {};
  peds.forEach((p) => {
    if (!/pantone/i.test(p.cores)) return;
    const k = p.cores.trim();
    const it = pantones[k] || (pantones[k] = { n: 0, clientes: [] });
    it.n += 1;
    if (!it.clientes.includes(p.cliente)) it.clientes.push(p.cliente);
  });
  const pantoneLista = Object.entries(pantones).sort((a, b) => b[1].n - a[1].n);

  const defs: Record<string, Secao> = {
    geral: {
      label: "Visão geral",
      kpis: [
        ["Pedidos no período", String(real ? dados.pedidos.qtde : peds.length), "todas as origens", "claro", "Pedidos"],
        ["Clichês recebidos", String(clichesQtde), brl(gastoCliches), "amarelo", "Aprovação"],
        ["Ferramental", brl(gastoAfiacao + gastoFacas), real && gastoFacas > 0 ? "afiação + facas compradas" : real ? "afiação no período" : "afiação + facas novas", "claro", "Afiação"],
        ["Produção apontada", f(Math.round(metros)) + " m", `${producao.length} apontamentos`, "escuro", "Fábrica"],
        ["Arquivo físico", f(pastas.length), "pastas cadastradas", "claro", "Arquivos"],
      ],
      titulo: "Últimos movimentos do sistema",
      sub: "cada evento registrado nas páginas do fluxo",
      cols: [["Quando", "150px"], ["Pedido", "84px"], ["Cliente", "1.3fr"], ["Movimento", "2fr"], ["Autor", "1fr"]],
      linhas: eventos.slice(0, 120).map((e) => [cel(e.quando, true), cel(e.num, true), cel(e.cliente, false, true), cel(e.texto), cel(e.autor)]),
      destaquesTitulo: "Volume por seção",
      destaques: [
        ["Pedidos", peds.length],
        ["Clichês", clichesQtde],
        ["Facas em afiação (agora)", facasEmAfiacao],
        ["Facas novas", qtdFacasNovas],
        ["Leituras de produção", leituras.length],
        ["Pantones em uso", pantoneLista.length],
      ],
      nota: "Resumo consolidado de todas as páginas. Escolha uma seção acima para ver os registros detalhados.",
    },
    pedidos: {
      label: "Pedidos",
      kpis: [
        ["Total de pedidos", String(peds.length), "na base", "claro", "Pedidos"],
        ["Em aberto", String(peds.filter((p) => p.status !== "Finalizado").length), "aguardando etapa", "amarelo", "Central"],
        ["Finalizados", String(peds.filter((p) => p.status === "Finalizado").length), "ciclo concluído", "claro", "Pedidos"],
        ["Origens", String(new Set(peds.map((p) => p.origem)).size), "vendas · produção · interno", "escuro", "Pedidos"],
      ],
      titulo: "Pedidos apontados",
      sub: "vindos de Pedidos, Central e Nova solicitação",
      cols: [["Pedido", "84px"], ["Cliente", "1.5fr"], ["Origem", "96px"], ["Vendedora", "1fr"], ["Designer", "1fr"], ["Medida", "88px"], ["Entrega", "92px"], ["Status", "1.1fr"]],
      linhas: peds.map((p) => [cel(p.num, true), cel(p.cliente, false, true), cel(origemL(p.origem)), cel(p.vendedora), cel(p.designer), cel(p.medida, true), cel(p.prazo, true), cel(p.status)]),
      destaquesTitulo: "Pedidos por status",
      destaques: contar(peds, (p) => p.status),
      nota: "Cada linha é um pedido real da base; a página Pedidos é a fonte.",
    },
    aprovacao: {
      label: "Aprovação · clichês",
      kpis: [
        ["Gasto com clichês", brl(gastoCliches), "no período", "claro", "Aprovação"],
        ["Clichês recebidos", String(clichesQtde), "conferidos na R2", "amarelo", "Aprovação"],
        ["Média por clichê", clichesQtde ? brl(Math.round(gastoCliches / clichesQtde)) : "—", "custo unitário", "claro", "Aprovação"],
        ["Na clicheria", String(peds.filter((p) => /clich/i.test(p.status)).length), "aguardando retorno", "escuro", "Aprovação"],
      ],
      titulo: "Solicitações de clichê",
      sub: "alimentado pela página Aprovação",
      cols: [["Pedido", "84px"], ["Cliente", "1.4fr"], ["Motivo", "1.1fr"], ["Espessura", "92px"], ["Cores", "1.4fr"], ["Substrato", "1fr"], ["Status", "1.1fr"]],
      linhas: peds.map((p) => [cel(p.num, true), cel(p.cliente, false, true), cel(p.motivo), cel(p.tipoEsp + " mm", true), cel(p.cores), cel(p.substrato), cel(p.status)]),
      destaquesTitulo: real ? "Solicitações por motivo" : "Gasto por tipo de solicitação",
      destaques: real
        // sem rateio inventado: o sistema guarda o motivo da solicitação, não o custo dela
        ? dados.solicitacoesPorMotivo.map((m) => [m.motivo, m.qtde] as [string, number])
        : (() => {
            const porMotivo = contar(peds, (p) => p.motivo);
            const totalPed = peds.length || 1;
            return porMotivo.map(([motivo, qtd]) => {
              const valor = Math.round(gastoCliches * (qtd / totalPed));
              return [`${motivo} · ${qtd} ${qtd === 1 ? "pedido" : "pedidos"}`, valor, brl(valor)] as [string, number, string];
            });
          })(),
      nota: "Valores de clichê e conferência vêm dos lançamentos da Aprovação.",
    },
    facas: {
      label: "Facas & afiação",
      kpis: [
        ["Enviadas para afiação", `${facasEnviadas} facas`, `${brl(gastoAfiacao)} em serviço externo`, "claro", "Afiação"],
        ["Facas novas", `${qtdFacasNovas} ${qtdFacasNovas === 1 ? "faca" : "facas"}`, real ? (qtdFacasCompradas > 0 ? `${brl(gastoFacas)} em ${qtdFacasCompradas} ${qtdFacasCompradas === 1 ? "compra" : "compras"}` : "solicitadas no retorno") : `${brl(gastoFacas)} em compras`, "amarelo", "Afiação"],
        ["Em afiação", String(facasEmAfiacao), "fora da casa", "claro", "Afiação"],
        ["Retorno bom", (() => { const tot = estados.reduce((t, x) => t + x[1], 0); const bom = estados.find((x) => /bom/i.test(x[0]))?.[1] ?? 0; return tot ? Math.round((bom / tot) * 100) + "%" : "—"; })(), "qualidade no retorno", "escuro", "Afiação"],
      ],
      titulo: "Pedidos com faca",
      sub: "alimentado por Facas e pelo modal de Afiação",
      cols: [["Pedido", "84px"], ["Cliente", "1.5fr"], ["Medida", "96px"], ["Substrato", "1.1fr"], ["Motivo", "1.1fr"], ["Responsável", "1fr"], ["Status", "1.1fr"]],
      linhas: peds.filter((p) => /faca/i.test(p.motivo)).map((p) => [cel(p.num, true), cel(p.cliente, false, true), cel(p.medida, true), cel(p.substrato), cel(p.motivo), cel(p.designer), cel(p.status)]),
      destaquesTitulo: "Estado no retorno",
      destaques: ([["Enviadas para afiação", facasEnviadas]] as [string, number][])
        .concat(estados.map(([l, v]) => ["Retorno " + l.toLowerCase(), v] as [string, number]))
        .concat([[real ? "Facas novas solicitadas" : "Facas novas compradas", qtdFacasNovas]]),
      nota: "Estados seguem a classificação do modal de Afiação: bom, regular e ruim.",
    },
    producao: {
      label: "Produção",
      kpis: [
        ["Metragem apontada", f(Math.round(metros)) + " m", "somando os apontamentos", "amarelo", "Fábrica"],
        ["Leituras", String(leituras.length), "registros da fila", "claro", "OP"],
        ["OS encerradas", String(producao.length), "fechadas no período", "claro", "Fábrica"],
        ["Máquinas", String(new Set(producao.map((p) => p.maquina)).size), "com apontamento", "escuro", "Fábrica"],
      ],
      titulo: "Apontamentos de produção",
      sub: "alimentado por Leitura e Painel",
      cols: [["Quando", "160px"], ["Máquina", "1.2fr"], ["OS", "96px"], ["Metros", "96px"], ["Custo", "110px"], ["Cliente", "1fr"], ["Situação", "1fr"]],
      linhas: producao.map((p) => [
        cel(fmtData(p.data), true), cel(p.maquina, false, true), cel(p.os, true),
        cel(p.metros ? f(Math.round(p.metros)) + " m" : "—", true), cel(p.custo ? brl(Number(p.custo)) : "—", true),
        cel(p.cliente), cel(p.tag === "Finalizado" ? "encerrada" : "cancelada"),
      ]),
      destaquesTitulo: "Apontamentos por máquina",
      destaques: contar(producao, (p) => p.maquina),
      nota: "Cada produção encerrada no Painel aparece aqui, com metros e custo.",
    },
    arquivos: {
      label: "Arquivos",
      kpis: [
        ["Pastas no arquivo", f(pastas.length), "base migrada", "claro", "Arquivos"],
        ["Clientes distintos", f(new Set(pastas.map((p) => p.nome)).size), "nomes cadastrados", "amarelo", "Arquivos"],
        ["Gavetas", String(gavetas.length), "A a W, com subgavetas", "claro", "Arquivos"],
        ["Vagas", f(pastas.filter((p) => p.vaga).length), "pastas baixadas", "escuro", "Arquivos"],
      ],
      titulo: "Pastas do arquivo físico",
      sub: "alimentado pela página Arquivos",
      cols: [["Cliente", "2fr"], ["Gaveta", "1.1fr"], ["Pasta", "96px"], ["Cadastro", "110px"], ["Situação", "1fr"]],
      linhas: pastas.slice(0, 200).map((p) => [cel(p.nome, false, true), cel(p.gaveta), cel(p.num, true), cel(p.cadastro || "—", true), cel(p.vaga ? "vaga" : "ativa")]),
      destaquesTitulo: "Pastas por gaveta",
      destaques: gavetas.slice(0, 8),
      nota: "Mostrando as 200 primeiras pastas; use a página Arquivos para buscar por nome, número ou código.",
    },
    pantone: {
      label: "Pantone",
      kpis: [
        ["Pantones em uso", String(pantoneLista.length), "citados em pedidos", "amarelo", "Pantone"],
        ["Clientes com pantone", String(new Set(pantoneLista.flatMap(([, v]) => v.clientes)).size), "referência de cor", "claro", "Pantone"],
        ["Citações", String(pantoneLista.reduce((t, [, v]) => t + v.n, 0)), "vezes solicitadas", "claro", "Pantone"],
      ],
      titulo: "Pantones usados por cliente",
      sub: "cruzamento de Aprovação com a biblioteca Pantone",
      cols: [["Pantone", "1.1fr"], ["Citações", "96px"], ["Clientes", "3fr"]],
      linhas: pantoneLista.map(([nome, v]) => [cel(nome, false, true), cel(v.n, true), cel(v.clientes.join(" · "))]),
      destaquesTitulo: "Mais pedidos",
      destaques: pantoneLista.slice(0, 6).map(([nome, v]) => [nome, v.n] as [string, number]),
      nota: "A página Pantone tem o filtro “Pantones usados” com o nome do cliente em cada cor.",
    },
  };

  const ordem = ["geral", "pedidos", "aprovacao", "facas", "producao", "arquivos", "pantone"];
  const d = defs[secao] ?? defs.geral;
  const grid: CSSProperties = { display: "grid", gridTemplateColumns: d.cols.map((c) => c[1]).join(" "), alignItems: "center", gap: 14 };
  const maxD = Math.max(1, ...d.destaques.map((x) => Number(x[1]) || 0));

  const subtitulo = semResposta
    ? `${diaBR(new Date(de + "T00:00:00"))} a ${diaBR(new Date(ate + "T00:00:00"))} · carregando os números do período…`
    : `${dias === 0 ? "Um dia" : dias + " dias"} · ${diaBR(new Date(de + "T00:00:00"))} a ${diaBR(new Date(ate + "T00:00:00"))} · ${real ? dados.pedidos.qtde : peds.length} pedidos · ${clichesQtde} clichês · ${brl(gastoCliches + gastoAfiacao)} em ferramental`;

  const celStyle = (c: Celula): CSSProperties => ({
    minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    font: `${c.forte ? 700 : 500} 14px/1.3 ${c.mono ? MONO : "Inter,sans-serif"}`,
    color: c.forte ? INK : "#5c5a5c",
  });

  return (
    <EstagioV1a>
      <TopbarV1a
        nome={String(profile.nome || "").trim().split(/\s+/)[0] || ""}
        busca={busca}
        aoBuscar={setBusca}
       
        onSair={onLogout}
      />
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch", marginTop: 14 }}>
        <RailV1a ativo="Apontamentos" permitidas={disponiveis} aoNavegar={(l) => aoNavegar?.(l)} onNovo={() => onNova?.()} versao={versao} />

        <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "0 6px 14px" }}>
            <div>
              <h1 style={{ ...fr(144, 900), fontSize: 56, lineHeight: 1, letterSpacing: "-.02em", textIndent: "-.045em", whiteSpace: "nowrap", color: INK, margin: 0 }}>Relatórios</h1>
              <div style={{ font: "400 16px/1.35 Inter,sans-serif", color: "#8d8b8d", marginTop: 12, whiteSpace: "nowrap" }}>{subtitulo}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 7, padding: "11px 14px" }}>
                <input value={de} onChange={(e) => aplicarDatas(e.target.value, ate)} style={{ width: 118, border: 0, outline: 0, background: "transparent", font: `600 15px/1 ${MONO}`, color: INK }} />
                <span style={{ font: "500 14.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>até</span>
                <input value={ate} onChange={(e) => aplicarDatas(de, e.target.value)} style={{ width: 118, border: 0, outline: 0, background: "transparent", font: `600 15px/1 ${MONO}`, color: INK }} />
                {erroData && <span style={{ font: "600 13.5px/1 Inter,sans-serif", color: "#c2410c", whiteSpace: "nowrap" }}>{erroData}</span>}
              </div>
              {PRESETS.map((p) => {
                const on = dias === p.d && ate === iso(new Date());
                return (
                  <button key={p.l} type="button" className="r2chip"
                    onClick={() => { setDias(p.d); setDe(iso(menos(p.d))); setAte(iso(new Date())); setErroData(""); }}
                    style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "12px 16px", font: "700 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: on ? INK : "#fff", color: on ? AMARELO : "#5c5a5c" }}>
                    {p.l}
                  </button>
                );
              })}
              <button type="button" className="r2chip" onClick={() => window.print?.()}
                style={{ display: podeExportar ? "flex" : "none", alignItems: "center", gap: 9, background: INK, border: 0, borderRadius: 7, padding: "15px 20px", cursor: "pointer", font: "600 15px/1 Inter,sans-serif", color: AMARELO, whiteSpace: "nowrap" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M7 8.5V3.5h10v5" /><rect x="4" y="8.5" width="16" height="7.5" rx="1.6" /><path d="M7 16h10v4.5H7z" /></svg>
                <span style={{ lineHeight: "16px" }}>Relatório</span>
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            {/* abas de seção */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 6px 12px" }}>
              {ordem.map((k) => {
                const on = secao === k;
                return (
                  <button key={k} type="button" className="r2chip" onClick={() => setSecao(k)}
                    style={{ display: "flex", alignItems: "center", gap: 9, border: 0, cursor: "pointer", borderRadius: 999, padding: "11px 16px", font: "600 15px/1 Inter,sans-serif", whiteSpace: "nowrap", background: on ? INK : "#fff", color: on ? AMARELO : INK, boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
                    <span style={{ lineHeight: 1 }}>{defs[k].label}</span>
                    <span style={{ font: "800 13px/1 Inter,sans-serif", padding: "3px 6px", borderRadius: 999, background: on ? AMARELO : "#f1f1f1", color: INK }}>{defs[k].linhas.length}</span>
                  </button>
                );
              })}
            </div>

            {/* KPIs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
              {d.kpis.map(([rotulo, valor, apoio, tema, destino]) => {
                const escuro = tema === "escuro";
                const amarelo = tema === "amarelo";
                return (
                  <button key={rotulo} type="button" className="r2chip" title={destino ? `Abrir ${destino} para ver os registros` : ""}
                    onClick={() => { if (destino) aoNavegar?.(destino); }}
                    style={{ flex: "1 1 210px", minWidth: 0, textAlign: "left", border: 0, cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between", height: 142, borderRadius: 12, padding: "18px 20px 16px", background: escuro ? INK : amarelo ? AMARELO : "#fff", boxShadow: SOMBRA_CARD }}>
                    <div style={{ font: "700 12px/1.2 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: escuro ? "#8d8b8d" : amarelo ? "#5c5a5c" : "#8d8b8d" }}>{rotulo}</div>
                    <div style={{ font: "800 30px/1 Inter,sans-serif", letterSpacing: "-.03em", color: escuro ? "#f1f1f1" : INK }}>{valor}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                      <span style={{ font: "500 13px/1.3 Inter,sans-serif", color: escuro ? "#8d8b8d" : amarelo ? "#5c5a5c" : "#b3b1b3" }}>{apoio}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ font: "700 15px/1 Inter,sans-serif", color: escuro ? AMARELO : amarelo ? INK : "#b3b1b3" }}>→</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* tabela + destaques */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch" }}>
              <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff", borderRadius: 12, padding: "20px 24px 16px", boxShadow: SOMBRA_CARD }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14, minWidth: 0 }}>
                  <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>{d.titulo}</span>
                  <span style={{ flex: 1, minWidth: 0, font: "400 14px/1 Inter,sans-serif", color: "#b3b1b3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.sub}</span>
                  <span style={{ flex: "none", font: "600 13px/1 Inter,sans-serif", color: "#8d8b8d", whiteSpace: "nowrap" }}>{d.linhas.length} {d.linhas.length === 1 ? "registro" : "registros"}</span>
                </div>
                <div style={{ ...grid, padding: "0 4px 10px", borderBottom: "2px solid #f1f1f1" }}>
                  {d.cols.map((c) => (
                    <span key={c[0]} style={{ font: "700 12px/1.2 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", color: "#8d8b8d", whiteSpace: "nowrap" }}>{c[0]}</span>
                  ))}
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                  {d.linhas.map((celulas, i) => (
                    <div key={i} className="r2row" style={{ ...grid, padding: "12px 4px", borderBottom: "1px solid #f6f6f6", background: i % 2 ? "#fcfcfc" : "#fff" }}>
                      {celulas.map((c, j) => <span key={j} style={celStyle(c)}>{c.v}</span>)}
                    </div>
                  ))}
                  {d.linhas.length === 0 && (
                    <div style={{ padding: "40px 0", font: "400 15px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>Nenhum registro apontado nesta seção.</div>
                  )}
                </div>
              </div>

              <div style={{ flex: "0 0 316px", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
                <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: INK, borderRadius: 12, padding: "20px 22px 18px" }}>
                  <div style={{ font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: AMARELO, marginBottom: 14, whiteSpace: "nowrap" }}>{d.destaquesTitulo}</div>
                  <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                    {d.destaques.map(([label, valor, texto]) => (
                      <div key={label} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
                          <span style={{ flex: 1, minWidth: 0, font: "500 14.5px/1.25 Inter,sans-serif", color: "#c9c8c9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                          <span style={{ flex: "none", font: "800 15px/1 Inter,sans-serif", color: AMARELO, whiteSpace: "nowrap" }}>{texto || f(Number(valor) || 0)}</span>
                        </div>
                        <span style={{ display: "block", height: 8, borderRadius: 999, background: "#3a383a", overflow: "hidden" }}>
                          <span style={{ display: "block", height: "100%", width: `${Math.max(6, Math.round(((Number(valor) || 0) / maxD) * 100))}%`, borderRadius: 999, background: AMARELO }} />
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ font: "400 13px/1.45 Inter,sans-serif", color: "#8d8b8d", marginTop: 14, paddingTop: 14, borderTop: "1px solid #3a383a" }}>{d.nota}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {children}
    </EstagioV1a>
  );
}
