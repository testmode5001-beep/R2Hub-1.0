// Arquivos, Hub 1.0.
//
// O arquivo físico de clichês: as pastas nas gavetas de A a P, que são as que
// a fábrica usa, e os registros antigos (gavetas Q a W e as siglas do sistema
// antigo), que ficam juntos numa faixa só (Augusto, 25/09/2026). A gaveta A é
// dividida em nove subgavetas, A1 a A9: elas são a gaveta A, não registro
// antigo. A V1a era um painel de cartões arredondados com chips, busca em
// pílula e modal escuro: vocabulário de modal.
//
// Capa: a estrutura da Pantones, pedido do Augusto. O bloco da busca à
// esquerda e as faixas verticais encostadas, uma por gaveta, com o círculo da
// contagem em cima, a letra no lugar do nome da cor e a seta embaixo; são 17
// faixas, e a fileira rola de lado. As cores são o "Espectro do hub", que ele
// escolheu entre cinco paletas no hub de teste (28/09/2026). Desde 02/10/2026
// no molde do rework v4 ("página arquivos também", só a capa; ele escolheu a
// mesma estrutura): o bloco da busca é um painel branco da c1 à c9, as faixas
// são cartões de 160 com raio e sombra a partir da c9 (7 à vista), a ficha é
// um cartão da c9 à c23, e a faixa preta saiu: o título vai para o pé, com as
// contagens à direita e o "Baixar inativas" em pílula (CapaV4Hub10).
//
// Dentro: o modelo do Novo pedido (a faixa preta e o bloco da busca ficam; só
// as faixas saem) e, no lugar delas, SÓ a ficha do cliente. No dia a dia a
// pessoa digita o cliente e quer ver o número; lista fixa, vizinhas e
// histórico só atrapalhavam (Augusto, 28/09/2026). Quando a busca acha mais
// de uma pasta, a ficha mostra a primeira com "1 de 5", as setas passam de
// uma para outra e "Ver todas" abre a lista inteira na camada do "Ver todos"
// de Pedidos, com a pesquisa dela. Clicar numa faixa (ou numa contagem da
// faixa preta) abre direto essa camada, com as pastas da gaveta.
//
// A faixa preta segue o padrão de Pedidos e Aprovações: o título e as
// contagens em duas linhas de texto (Augusto, 28/09/2026).
//
// A ficha segue a disciplina da referência que o Augusto trouxe: duas bordas
// (tudo à esquerda em 80; o × e os números à direita em 80), só três tamanhos
// de letra (o nome enorme, os números grandes, os detalhes pequenos), três
// grupos com respiro entre eles, e no pé três faixas de 72 com filete em
// cima, as mesmas para as duas colunas: à esquerda os detalhes, à direita
// Gaveta, Pasta e Consultas, com rótulo e número na mesma linha de base.
//
// Regra 60/30/10 (telas novas): o neutro é a barra, o bloco da busca e a faixa
// preta; as faixas e a ficha são a secundária; o preto fica nos círculos, nas
// setas, na pílula de ação e no que está ligado.
//
// Consulta: registrada sozinha quando a pasta é aberta: Enter no campo, clique
// no "Ver todas", semente de outra tela com resultado único, ou a ficha parada
// na tela por 2,5 s (a pessoa leu o número), desde que ela seja a única achada
// ou tenha sido escolhida com as setas. Digitar e passar com as setas não conta
// até parar; a mesma pasta de novo em menos de 30 minutos não conta.
//
// Cadastro: a migração gravou a data de cadastro do sistema antigo como uma
// consulta. A tela mostra essa data como "Cadastro" (Augusto, 28/09/2026); o
// dado no banco fica como está.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as KeyboardEventReact, PointerEvent as PointerEventReact, ReactNode } from "react";

import { AMARELO, AMARELO_MAIS, BarraTopoHub10, FECHAR_DA_LISTA, FECHAR_X, FR, FUNDO, FUNDO_PAGINA, FUNDO_PESQUISA, INTER, LINHA_DA_GRADE_HUB, NIVEL, PRETO, PalcoFixo, RAIO_DA_PESQUISA, textoNaGrade, tituloDaLista, useEscDoTopo } from "./ChromeHub10";
import { baseInter } from "./grade-hub10";
import { CAPA_V4, ResumoDoPeV4, TrilhaV4, tituloDoPeV4 } from "./CapaV4Hub10";
import { criarBusca } from "@/lib/busca";
import { colherBusca, espiarBusca } from "@/lib/busca-semente";
import { salvarBlob } from "@/lib/files";
import type { SessionUser } from "@/lib/session";
import { PALETA } from "@/lib/paleta-hub";

/* ————— medidas e tintas (as de Pantones, Ferramentais e Pedidos) ————— */
const CINZA = "#8f8f8f";
const TINTA2 = "#5b595b";
const TINTA3 = "#6f6d6f";
/* texto pequeno sobre os tons do espectro: passa de 4,5:1 até no lilás */
const TINTA_TOM = "#3c3a3c";
const MARCA: CSSProperties = { fontSize: 18, fontWeight: 600, color: CINZA, whiteSpace: "nowrap" };
const TITULO: CSSProperties = { ...FR, fontSize: 56, lineHeight: "56px", letterSpacing: "-.04em" };

/* A capa (v4): o painel da busca vai da c1 à c9 (640) e cada faixa tem 2
   colunas (160), como em Pantones; cabem 7, as outras chegam pela rolagem.
   O que fica no pé do painel e das faixas (exemplos, campo, letra, seta)
   desce o que o cartão v4 cresceu (720 contra os 616 da faixa preta). */
const HERO_L = 640;
const FAIXA = 160;
const FAIXAS_X = 80 + HERO_L;
const DESCE = CAPA_V4.altura - 616;
/* a pílula do pé: a do pé da Solicitação (44 de altura, borda 2,21, 0,85
   acima da linha 63) */
const PILULA_PE_ALT = 44.04;
const TOPO_PILULA_PE = CAPA_V4.basePe - 0.85 - PILULA_PE_ALT;
const PILULA_DO_PE: CSSProperties = {
  position: "absolute", top: TOPO_PILULA_PE, height: PILULA_PE_ALT, boxSizing: "border-box", padding: "2px 22px 0", border: `2.21px solid ${PRETO}`,
  borderRadius: 999, display: "flex", alignItems: "center", font: `500 20.5px/1 ${INTER}`, letterSpacing: "-.014em", color: PRETO, cursor: "pointer", whiteSpace: "nowrap", zIndex: 3,
};
/* As gavetas em uso na fábrica. Todo o resto é registro antigo. */
const LETRAS = "ABCDEFGHIJKLMNOP".split("");
/* "Espectro do hub": as faixas em degradê pelas cores do hub, de A a P
   (amarelo, verde, azul e lilás). A cor só segue a ordem das gavetas, não quer
   dizer nada além disso; por isso o lilás no fim não conta como o "elemento
   lilás" da regra de cor. Os registros antigos ficam em cinza, fora dele. */
const ESPECTRO = PALETA.espectro;
const TOM_ANTIGAS = "#e4e4e4";
const tomDaLetra = (letra: string) => ESPECTRO[Math.max(0, LETRAS.indexOf(letra.toUpperCase()))];

/* ————— a ficha (no lugar das faixas: o cartão v4 de 1120 × 720, da c9 à
   c23) —————
   Duas margens de 80; a coluna da esquerda vai de 80 a 520 e a da direita de
   600 a 1040 (440 + 80 + 440). O × e o nome começam na linha de 58 (a linha
   de cabeçalho dos painéis do hub). O pé são três faixas de 72, de 448 a 664,
   com 56 de respiro embaixo (era 1280 × 616 com a faixa preta). */
const FICHA_W = 1120;
const M = 80;
const COL_DIR = 600;
const FAIXA_PE = 72;
const PE_TOPO = 448;
/* Fraunces: a linha de maiúscula fica a 13,4% do corpo abaixo do topo da
   caixa com esta entrelinha (medido no DOM). O nome começa ali, na linha do ×. */
const NOME_GRANDE = { fs: 88, lh: 84, topo: 47 };
const NOME_MEDIO = { fs: 72, lh: 70, topo: 49 };

/* ————— o "Ver todas" (a camada do "Ver todos" de Pedidos) —————
   Na grade (Augusto, 29/09/2026: "ajustar ao grid"): cada linha da lista tem
   quatro linhas da grade (64,48; eram 64) e as colunas começam em c1, c3,
   c15 e c19, terminando na c23. */
const LINHA_VT = 4 * LINHA_DA_GRADE_HUB;
const COLUNAS_VT = "160px 960px 320px 320px";
/* quanto o texto de uma linha sobe para a base cair duas linhas da grade
   abaixo do topo dela (medido no hub de teste) */
const ACERTO_LINHA_VT = 12;

const DIA = 1000 * 60 * 60 * 24;
const DOIS_ANOS = DIA * 365 * 2;
const TRINTA_DIAS = DIA * 30;
const MEIA_HORA = 1000 * 60 * 30;
/* a ficha parada na tela por este tempo conta como consulta */
const LEU = 2500;
/* Exemplos que existem no arquivo (conferidos no banco em 25/09/2026). */
const EXEMPLOS = ["padaria", "1104", "O-2204"];

type Pasta = {
  id: string; nome: string; codigo: number; gaveta: string; pasta: string; obs: string;
  vaga: boolean; consultas: string[];
};
type Gaveta = { k: string; rot: string; total: number };
/* "usar": uma pasta vaga que ganha cliente (o número é reaproveitado) */
type Form = { modo: "nova"; nome: string } | { modo: "editar"; pasta: Pasta } | { modo: "usar"; pasta: Pasta } | null;

/* ————— ajudantes ————— */
const fmt = (n: number) => n.toLocaleString("pt-BR");
const letraDe = (gaveta: string) => gaveta.replace(/^GAVETA\s*/i, "").trim() || "?";
/** A gaveta do móvel (A a P) onde a pasta fica, ou null se é registro antigo.
    A gaveta A é dividida em nove: as subgavetas A1 a A9 têm dez pastas cada,
    de 1005 a 1103, e a gaveta B começa em 1104 (conferido no banco em
    28/09/2026). */
function gavetaDoMovel(gaveta: string): string | null {
  const m = /^GAVETA ([A-P])$/i.exec(gaveta.trim()) ?? /^GAVETA (A)[1-9]$/i.exec(gaveta.trim());
  return m ? m[1].toUpperCase() : null;
}
/** Tudo que não é uma das gavetas de A a P. */
const ehAntiga = (gaveta: string) => gavetaDoMovel(gaveta) === null;
const tomDaGaveta = (gaveta: string) => { const l = gavetaDoMovel(gaveta); return l ? tomDaLetra(l) : TOM_ANTIGAS; };
const porLetra = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true });
const recorteDaGaveta = (gaveta: string) => gavetaDoMovel(gaveta) ?? "antigas";

/** "A1 A2 … A9 CB DS Q R … W" → "A1 a A9 · CB · DS · Q a W". */
function resumirGavetas(codigos: string[]): string {
  const ordem = [...new Set(codigos)].sort(porLetra);
  const segue = (a: string, b: string) => {
    const ma = /^([A-Z])(\d)$/.exec(a), mb = /^([A-Z])(\d)$/.exec(b);
    if (ma && mb) return ma[1] === mb[1] && Number(mb[2]) === Number(ma[2]) + 1;
    if (/^[A-Z]$/.test(a) && /^[A-Z]$/.test(b)) return b.charCodeAt(0) === a.charCodeAt(0) + 1;
    return false;
  };
  const partes: string[] = [];
  for (let i = 0; i < ordem.length;) {
    let j = i;
    while (j + 1 < ordem.length && segue(ordem[j], ordem[j + 1])) j++;
    if (j - i >= 2) partes.push(`${ordem[i]} a ${ordem[j]}`); else partes.push(...ordem.slice(i, j + 1));
    i = j + 1;
  }
  return partes.join(" · ");
}

const p2 = (n: number) => String(n).padStart(2, "0");
const dataBR = (ms: number) => { const d = new Date(ms); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`; };
const horaBR = (ms: number) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const isoLocal = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const diasEntre = (ms: number, agora: number) => Math.floor((new Date(agora).setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / DIA);
function haQuanto(ms: number, agora: number): string {
  const dias = diasEntre(ms, agora);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
  const anos = Math.floor(dias / 365);
  return anos <= 1 ? "há 1 ano" : `há ${anos} anos`;
}
/** "hoje às 09:27", "ontem às 16:43", "há 3 dias (25/09/26)". */
const quandoFoi = (ms: number, agora: number) =>
  `${haQuanto(ms, agora)}${diasEntre(ms, agora) <= 1 ? ` às ${horaBR(ms)}` : ` (${dataBR(ms)})`}`;
/** "23/12/2003": data antiga vai com o ano inteiro. */
const dataCompleta = (ms: number) => { const d = new Date(ms); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`; };

/* A migração gravou a data de cadastro de 73 pastas do sistema antigo como
   uma consulta às 09:00 (de 2003 a 2008) e repetiu a data na observação, com
   um dia a menos por causa do fuso ("Cadastro de 22/12/03 · administrador").
   Isso é o cadastro, não uma consulta: o hub só registra consultas desde
   2026 (a primeira é de 12/08/2026, conferido nos dois bancos em 28/09/2026).
   A tela separa as duas coisas; o dado no banco fica como está. */
const ehCadastroMigrado = (c: string) => c < "2026";
const OBS_DO_CADASTRO = /^Cadastro de \d{2}\/\d{2}\/\d{2}( · .+)?$/;
/** Datas das consultas de verdade, da mais recente para a mais antiga. */
function consultasDe(p: Pasta): number[] {
  return p.consultas.filter((c) => !ehCadastroMigrado(c)).map((c) => new Date(c).getTime())
    .filter((t) => !Number.isNaN(t)).sort((a, b) => b - a);
}
/** A data de cadastro que veio do sistema antigo, se houver. */
function cadastroDe(p: Pasta): number | null {
  const c = p.consultas.find(ehCadastroMigrado);
  const t = c ? new Date(c).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
}
/* A observação migrada do sistema antigo vem com travessão ("Pasta vaga — …"):
   na tela vira vírgula, como o resto do hub. O dado no banco fica como está. */
const semTravessao = (s: string) => s.replace(/\s+[—–]\s+/g, ", ");
/** A observação de verdade: a que só repete o cadastro migrado não conta. */
const obsDe = (p: Pasta) => (OBS_DO_CADASTRO.test(p.obs.trim()) ? "" : semTravessao(p.obs.trim()));
const nomeDe = (p: Pasta) => (p.vaga ? `Pasta ${p.pasta}` : p.nome || `Pasta ${p.pasta}`);

/** linha de arquivo_pastas → Pasta */
function daLinha(r: any): Pasta {
  let consultas: string[] = [];
  try { consultas = JSON.parse(r.consultas_json) || []; } catch { consultas = []; }
  return {
    id: String(r.id), nome: String(r.nome ?? ""), codigo: Number(r.codigo) || 0,
    gaveta: String(r.gaveta ?? ""), pasta: String(r.pasta ?? ""), obs: String(r.obs ?? ""),
    vaga: !!r.vaga, consultas,
  };
}
/** registro da base migrada → Pasta (só quando o banco está vazio ou fora do ar) */
function daBase(r: any): Pasta {
  const g = String(r.gaveta || "").replace(/^GAVETA\s*/i, "");
  const cadastro = r.cadastro ? new Date(`${r.cadastro}T12:00`).getTime() : NaN;
  return {
    id: r.id, nome: r.nome, codigo: r.num || 0, gaveta: r.gaveta,
    pasta: `${g}-${String(r.num || 0).padStart(2, "0")}`,
    obs: r.vaga ? "Pasta vaga, baixada no sistema antigo" : (!Number.isNaN(cadastro) ? `Cadastro de ${dataBR(cadastro)}${r.user ? " · " + String(r.user).toLowerCase() : ""}` : ""),
    vaga: !!r.vaga,
    consultas: r.cadastro ? [r.cadastro + "T09:00"] : [],
  };
}

/* Quem digita "1104" quer a pasta 1104, e não a 11040 nem "MERCADO 1104":
   número exato, etiqueta exata, número que começa, nome que começa, o resto. */
function relevancia(p: Pasta, termo: string): number {
  const q = termo.trim().toUpperCase();
  const dig = q.replace(/\D/g, "");
  if (dig && dig === q && String(p.codigo) === dig) return 0;
  if (p.pasta.toUpperCase() === q) return 0;
  if (dig && dig === q && String(p.codigo).startsWith(dig)) return 1;
  const nome = p.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const qn = q.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (nome.startsWith(qn)) return 2;
  if (nome.split(/\s+/).some((w) => w.startsWith(qn))) return 3;
  return 4;
}

/** Botão redondo de contorno (as setas e o ×), no tamanho da linha de 58. */
function Redondo({ rotulo, aoClicar, tam = 46, children }: { rotulo: string; aoClicar: () => void; tam?: number; children: ReactNode }) {
  return (
    <button onClick={aoClicar} className="p10-flat" aria-label={rotulo} title={rotulo}
      style={{ flex: "none", width: tam, height: tam, boxSizing: "border-box", padding: 0, display: "grid", placeItems: "center",
        background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer", color: PRETO }}>
      {children}
    </button>
  );
}

/* ————— a página ————— */
export function ArquivosHub10({ profile, aoNavegar, onNova, onLogout, disponiveis, podeEditar = false }: {
  profile: SessionUser;
  aoNavegar: (label: string) => void;
  onNova?: () => void;
  onLogout: () => void;
  disponiveis?: string[];
  /** cliente.editar: cadastrar, editar e tirar pasta do arquivo */
  podeEditar?: boolean;
}) {
  /* ————— as pastas ————— */
  const [pastas, setPastas] = useState<Pasta[] | null>(null);
  /* "base": o servidor não respondeu e a tela mostra a base migrada, só para
     consulta (nada do que se fizer nela seria gravado). */
  const [origem, setOrigem] = useState<"banco" | "base">("banco");
  const [agora, setAgora] = useState(() => Date.now());

  const puxar = useCallback(async () => {
    const m = await import("@/lib/api/arquivo.functions");
    const r = (await m.listArquivo()) as { linhas?: any[] };
    const linhas = r?.linhas ?? [];
    if (linhas.length) { setPastas(linhas.map(daLinha)); setOrigem("banco"); return; }
    /* Banco vazio (primeira vez): semeia com a base migrada, como a V1a fazia. */
    const { REGISTROS } = await import("../v1a/dados/arquivo");
    const base = (REGISTROS as any[]).map(daBase);
    await m.semearArquivo({ data: { pastas: base } });
    const novo = (await m.listArquivo()) as { linhas?: any[] };
    setPastas((novo?.linhas ?? []).map(daLinha));
    setOrigem("banco");
  }, []);
  useEffect(() => {
    let vivo = true;
    puxar().catch(async () => {
      if (!vivo) return;
      try {
        const { REGISTROS } = await import("../v1a/dados/arquivo");
        if (vivo) { setPastas((REGISTROS as any[]).map(daBase)); setOrigem("base"); }
      } catch { if (vivo) { setPastas([]); setOrigem("base"); } }
    });
    return () => { vivo = false; };
  }, [puxar]);
  const soLeitura = origem === "base";
  const soLeituraRef = useRef(soLeitura);
  soLeituraRef.current = soLeitura;
  const editavel = podeEditar && !soLeitura;

  const todas = pastas ?? [];
  const carregando = pastas === null;
  const todasRef = useRef<Pasta[]>(todas);
  todasRef.current = todas;

  /* ————— as gavetas ————— */
  const { principais, antigas, codigosAntigos } = useMemo(() => {
    const total = new Map<string, number>();
    let nAntigas = 0;
    const codigos = new Set<string>();
    for (const p of todas) {
      const l = gavetaDoMovel(p.gaveta);
      if (!l) { nAntigas++; codigos.add(letraDe(p.gaveta).toUpperCase()); }
      else total.set(l, (total.get(l) ?? 0) + 1);
    }
    /* as 16 gavetas sempre, mesmo a que ficar vazia: é o móvel da fábrica */
    const principais: Gaveta[] = LETRAS.map((l) => ({ k: l, rot: `Gaveta ${l}`, total: total.get(l) ?? 0 }));
    const antigas: Gaveta | null = nAntigas ? { k: "antigas", rot: "Registros antigos", total: nAntigas } : null;
    return { principais, antigas, codigosAntigos: resumirGavetas([...codigos]) };
  }, [todas]);

  const ultimaDe = useCallback((p: Pasta) => consultasDe(p)[0] ?? null, []);
  const inativa = useCallback((p: Pasta) => {
    if (p.vaga) return true;
    const u = ultimaDe(p);
    return u != null && agora - u > DOIS_ANOS;
  }, [agora, ultimaDe]);
  const recente = useCallback((p: Pasta) => { const u = ultimaDe(p); return u != null && agora - u <= TRINTA_DIAS; }, [agora, ultimaDe]);
  const nInativas = useMemo(() => todas.filter(inativa).length, [todas, inativa]);
  const nRecentes = useMemo(() => todas.filter(recente).length, [todas, recente]);
  const situacaoDe = useCallback((p: Pasta) => (p.vaga ? "Vaga, sem cliente" : inativa(p) ? "Inativa" : "Em uso"), [inativa]);

  /* ————— estado da página ————— */
  const [semente] = useState(() => colherBusca().trim());
  const [busca, setBusca] = useState("");
  /* o que se vê sem busca: uma gaveta (A a P), "antigas", "todas", "recentes"
     ou "inativas"; null é a capa */
  const [recorte, setRecorte] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  /* a camada "Ver todas": de onde ela foi aberta decide para onde o × volta */
  const [verTodas, setVerTodas] = useState<null | "capa" | "ficha">(null);
  const [anuncio, setAnuncio] = useState("");
  const [falhaConsulta, setFalhaConsulta] = useState<string | null>(null);
  /* Tirar do arquivo pede duas confirmações (Augusto, 28/09/2026) */
  const [tirando, setTirando] = useState<{ id: string; fase: "pergunta" | "certeza" | "tirando"; erro: string } | null>(null);
  /* quando a pergunta apareceu: um clique duplo (ou o Enter segurado) não
     passa pelas duas confirmações de uma vez */
  const perguntouEm = useRef(0);
  const [form, setForm] = useState<Form>(null);
  const [recado, setRecado] = useState("");

  const heroRef = useRef<HTMLInputElement | null>(null);
  /* quem abriu a caixa de cadastro ou o "Ver todas", para o foco voltar a ele */
  const origemForm = useRef<HTMLElement | null>(null);
  const origemVer = useRef<HTMLElement | null>(null);
  const buscaRef = useRef(busca);
  buscaRef.current = busca;

  /* ————— o que a busca ou o recorte acham ————— */
  const q = busca.trim();
  const dentro = !!q || recorte !== null;
  const achados = useMemo(() => {
    if (q) {
      /* a busca procura SEMPRE no arquivo inteiro */
      const casa = criarBusca(q);
      return todas.filter((p) => casa(p.nome, String(p.codigo), p.pasta))
        .map((p) => ({ p, r: relevancia(p, q) })).sort((a, b) => a.r - b.r || a.p.codigo - b.p.codigo).map((x) => x.p);
    }
    if (recorte === null) return [];
    const l = recorte === "todas" ? [...todas]
      : recorte === "antigas" ? todas.filter((p) => ehAntiga(p.gaveta))
        : recorte === "recentes" ? todas.filter(recente)
          : recorte === "inativas" ? todas.filter(inativa)
            : todas.filter((p) => gavetaDoMovel(p.gaveta) === recorte);
    if (recorte === "recentes") l.sort((a, b) => (ultimaDe(b) ?? 0) - (ultimaDe(a) ?? 0) || a.codigo - b.codigo);
    else l.sort((a, b) => a.codigo - b.codigo);
    return l;
  }, [todas, q, recorte, inativa, recente, ultimaDe]);
  const n = achados.length;

  const sel = (selId ? achados.find((p) => p.id === selId) : null) ?? achados[0] ?? null;
  const selRef = useRef<Pasta | null>(null);
  selRef.current = sel;
  const achadosRef = useRef<Pasta[]>(achados);
  achadosRef.current = achados;
  const posSel = sel ? achados.findIndex((p) => p.id === sel.id) : -1;

  /* ————— a consulta, registrada sozinha ao abrir ————— */
  const registradas = useRef(new Map<string, number>());
  const registrarConsulta = useCallback(async (p: Pasta) => {
    if (soLeituraRef.current) return;
    const ms = Date.now();
    const antes = registradas.current.get(p.id);
    if (antes && ms - antes < MEIA_HORA) return;
    registradas.current.set(p.id, ms);
    const iso = isoLocal(ms);
    setPastas((l) => (l ?? []).map((x) => (x.id === p.id ? { ...x, consultas: [iso, ...x.consultas].slice(0, 50) } : x)));
    setAgora(ms);
    setFalhaConsulta((f) => (f === p.id ? null : f));
    try {
      const m = await import("@/lib/api/arquivo.functions");
      const r = await m.registrarConsulta({ data: { id: p.id, quando: iso } });
      if (!r.ok) throw new Error("pasta não encontrada");
    } catch {
      registradas.current.delete(p.id);
      setPastas((l) => (l ?? []).map((x) => (x.id === p.id ? { ...x, consultas: x.consultas.filter((c, i) => !(i === 0 && c === iso)) } : x)));
      setFalhaConsulta(p.id);
      setAnuncio("A consulta não foi gravada.");
    }
  }, []);
  /* a ficha parada na tela é uma pasta lida: conta como consulta. Só quando
     ela é sem dúvida a procurada: a única que a busca achou, ou uma que a
     pessoa escolheu (setas, clique). Com várias achadas, a primeira aparece
     sozinha enquanto se digita e contava sem ser a procurada (simulação de
     28/09/2026: "hortifruti" registrou a HORTIFRUTI ROBRU). */
  useEffect(() => {
    if (!dentro || verTodas || !sel) return;
    if (!selId && n !== 1) return;
    const p = sel;
    const t = setTimeout(() => void registrarConsulta(p), LEU);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dentro, verTodas, sel?.id, selId, n, q, registrarConsulta]);

  /* ————— entrar e sair ————— */
  const abrirVerTodas = (de: "capa" | "ficha", el: HTMLElement | null) => { origemVer.current = el; setVerTodas(de); };
  /* faixa, ou número da faixa preta: abre direto a lista daquela gaveta */
  const abrirRecorte = (k: string, el: HTMLElement | null) => {
    setBusca(""); setRecorte(k); setSelId(null); setTirando(null);
    abrirVerTodas("capa", el);
  };
  const fecharVerTodas = useCallback(() => {
    setVerTodas((de) => {
      /* aberta da capa e fechada sem escolher: volta para a capa */
      if (de === "capa") setRecorte(null);
      return null;
    });
    requestAnimationFrame(() => {
      const o = origemVer.current;
      if (o && document.contains(o)) o.focus(); else heroRef.current?.focus();
    });
  }, []);
  const escolherNaLista = (id: string) => {
    setSelId(id); setTirando(null); setVerTodas(null);
    const p = todasRef.current.find((x) => x.id === id);
    if (p) void registrarConsulta(p);
    requestAnimationFrame(() => heroRef.current?.focus());
  };
  /* ESC e o × tiram uma camada: primeiro a busca, depois o recorte */
  const voltar = useCallback(() => {
    setTirando(null); setSelId(null);
    if (buscaRef.current.trim()) setBusca(""); else setRecorte(null);
    requestAnimationFrame(() => heroRef.current?.focus());
  }, []);
  const voltarTudo = () => { setBusca(""); setRecorte(null); setSelId(null); setTirando(null); requestAnimationFrame(() => heroRef.current?.focus()); };
  useEscDoTopo(dentro && !verTodas, NIVEL.painel, voltar);

  /* Semente (a busca do topo ou o "Pasta …" da Pantones): a pessoa escolheu
     uma pasta em outra tela. Entra direto nela; se ela for uma só, isso é
     abrir a pasta e conta como consulta. */
  const plantar = (s: string) => {
    const casa = criarBusca(s);
    const acham = todasRef.current.filter((p) => casa(p.nome, String(p.codigo), p.pasta));
    if (!acham.length) return false;
    setBusca(s); setRecorte(null); setSelId(null); setTirando(null); setVerTodas(null);
    requestAnimationFrame(() => heroRef.current?.focus());
    if (acham.length === 1) void registrarConsulta(acham[0]);
    return true;
  };
  const sementeUsada = useRef(false);
  useEffect(() => {
    if (carregando || sementeUsada.current || !semente) return;
    sementeUsada.current = true;
    plantar(semente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando]);
  /* A mesma coisa estando JÁ nesta página (a tela não remonta). Espera um
     instante: se o destino for outra página, esta desmonta antes. */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const aoSemear = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        const s = espiarBusca().trim();
        if (!s) return;
        const casa = criarBusca(s);
        if (!todasRef.current.some((p) => casa(p.nome, String(p.codigo), p.pasta))) return;
        colherBusca();
        plantar(s);
      }, 200);
    };
    window.addEventListener("hub:semente", aoSemear);
    return () => { window.removeEventListener("hub:semente", aoSemear); if (t) clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ————— passar de uma pasta para outra ————— */
  const andar = (passo: number) => {
    const l = achadosRef.current;
    if (!l.length) return;
    const atual = selRef.current ? l.findIndex((p) => p.id === selRef.current!.id) : -1;
    const i = Math.max(0, Math.min(l.length - 1, (atual < 0 ? 0 : atual) + passo));
    if (l[i].id !== selRef.current?.id) setTirando(null);
    setSelId(l[i].id);
  };
  const mudarBusca = (v: string) => { setBusca(v); setSelId(null); setTirando(null); };
  const teclaCampo = (e: KeyboardEventReact<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!dentro) abrirRecorte("todas", e.currentTarget);
      else { const s = selRef.current; if (s) void registrarConsulta(s); }
      return;
    }
    if (!dentro) return;
    if (e.key === "ArrowDown") { e.preventDefault(); andar(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); andar(-1); }
  };

  /* Digitar em qualquer lugar é buscar: a letra vai para o campo. O campo do
     topo, a caixa de cadastro e o "Ver todas" ficam de fora. */
  useEffect(() => {
    if (form || verTodas) return;
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const campo = !!alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT" || alvo.isContentEditable);
      if (campo || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (e.key === "/") { e.preventDefault(); heroRef.current?.focus(); return; }
      if (e.key.length === 1 && e.key !== " ") {
        e.preventDefault();
        setBusca((b) => b + e.key); setSelId(null); setTirando(null);
        heroRef.current?.focus();
        /* o cursor no fim do que já estava escrito */
        requestAnimationFrame(() => { const el = heroRef.current; if (el) el.setSelectionRange(el.value.length, el.value.length); });
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [form, verTodas]);

  /* ————— cadastro ————— */
  const perguntarTirar = (fase: "pergunta" | "certeza") => {
    const p = selRef.current;
    if (!p) return;
    perguntouEm.current = Date.now();
    setTirando({ id: p.id, fase, erro: "" });
  };
  /* meio segundo depois de a pergunta aparecer, o clique vale */
  const cedoDemais = () => Date.now() - perguntouEm.current < 500;
  const tirarDoArquivo = async () => {
    const p = selRef.current;
    if (!p || !tirando || tirando.fase !== "certeza" || !editavel || cedoDemais()) return;
    setTirando({ id: p.id, fase: "tirando", erro: "" });
    try {
      const m = await import("@/lib/api/arquivo.functions");
      await m.excluirPasta({ data: { id: p.id } });
      const l = achadosRef.current;
      const i = l.findIndex((x) => x.id === p.id);
      const proxima = l[i + 1] ?? l[i - 1] ?? null;
      setPastas((ls) => (ls ?? []).filter((x) => x.id !== p.id));
      setSelId(proxima?.id ?? null);
      setTirando(null);
      /* o botão que tinha o foco sumiu */
      heroRef.current?.focus();
      setAnuncio(`${nomeDe(p)} saiu do arquivo`);
    } catch (e) {
      setTirando({ id: p.id, fase: "certeza", erro: e instanceof Error ? e.message : "Não deu para tirar a pasta do arquivo." });
    }
  };
  const cancelarTirar = useCallback(() => setTirando(null), []);
  useEscDoTopo(!!tirando && tirando.fase !== "tirando", NIVEL.verTodos, cancelarTirar);

  const baixarInativas = () => {
    const linhas = todas.filter(inativa).sort((a, b) => a.codigo - b.codigo).map((p) => {
      const u = ultimaDe(p);
      return [p.nome, String(p.codigo || ""), p.gaveta, p.pasta, p.vaga ? "vaga" : "sem consulta ha 2+ anos", u ? dataBR(u) : ""];
    });
    const esc = (v: string) => `"${String(v).replace(/"/g, "\"\"")}"`;
    const csv = ["nome;codigo;gaveta;pasta;situacao;ultima_consulta"].concat(linhas.map((l) => l.map(esc).join(";"))).join("\r\n");
    salvarBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "pastas-inativas.csv");
    setRecado(`${fmt(linhas.length)} pastas inativas em pastas-inativas.csv.`);
  };

  const abrirCadastro = (el: HTMLElement, nome = "") => { origemForm.current = el; setForm({ modo: "nova", nome }); };
  /* usada: uma pasta vaga que ganhou cliente */
  const aoSalvar = (p: Pasta, nova: boolean, usada = false) => {
    setPastas((l) => {
      const ls = l ?? [];
      return nova ? [p, ...ls] : ls.map((x) => (x.id === p.id ? p : x));
    });
    /* a pasta nova já entra com a consulta de hoje: não conta outra agora */
    if (nova || usada) registradas.current.set(p.id, Date.now());
    setForm(null);
    setBusca(""); setRecorte(recorteDaGaveta(p.gaveta)); setSelId(p.id); setTirando(null); setVerTodas(null);
    requestAnimationFrame(() => heroRef.current?.focus());
    setAnuncio(nova || usada ? `${nomeDe(p)} entrou no arquivo` : `${nomeDe(p)} atualizada`);
  };

  /* ————— textos ————— */
  const nPastas = (x: number, sing = "pasta", plural = "pastas") => `${fmt(x)} ${x === 1 ? sing : plural}`;
  const tituloLista = q ? `“${q}”`
    : recorte === "todas" ? "Todas as pastas"
      : recorte === "antigas" ? "Registros antigos"
        : recorte === "recentes" ? "Consultadas há pouco"
          : recorte === "inativas" ? "Inativas ou vagas"
            : `Gaveta ${recorte ?? ""}`;
  const subtituloLista = q ? `${nPastas(n, "pasta encontrada", "pastas encontradas")} no arquivo inteiro`
    : recorte === "antigas" ? `${nPastas(n)} · ${codigosAntigos}`
      : recorte === "recentes" ? `${nPastas(n)} consultadas nos últimos 30 dias`
        : recorte === "inativas" ? `${nPastas(n)} vagas ou sem consulta há mais de 2 anos`
          : `${nPastas(n)}, em ordem de número`;
  /* uma contagem da faixa preta: dois dígitos, como em Pedidos, e clicável
     quando a lista dela tem alguma pasta */
  const dois = (x: number) => (x < 10 ? `0${x}` : fmt(x));
  const contagem = (k: string, x: number, sing: string, plural: string) => {
    const texto = `${dois(x)} ${x === 1 ? sing : plural}`;
    return x > 0 ? (
      <button onClick={(e) => abrirRecorte(k, e.currentTarget)} className="pn10-link"
        style={{ padding: 0, border: 0, background: "none", font: "inherit", color: "inherit", cursor: "pointer" }}>{texto}</button>
    ) : <span>{texto}</span>;
  };

  /* ————— a pasta escolhida ————— */
  const ultimaSel = sel ? ultimaDe(sel) : null;
  const nomeSel = sel ? (sel.vaga ? "Pasta vaga" : sel.nome || "Sem nome") : "";
  const tamNome = nomeSel.length <= 30 ? NOME_GRANDE : NOME_MEDIO;
  /* a terceira faixa: a observação de verdade; sem ela, o cadastro que veio
     do sistema antigo */
  const obsSel = sel ? obsDe(sel) : "";
  const cadastroSel = sel ? cadastroDe(sel) : null;
  const terceira: [string, string] = obsSel || cadastroSel == null
    ? ["Observação", obsSel || "Nenhuma"]
    : ["Cadastro", `${dataCompleta(cadastroSel)}, no sistema antigo`];

  /* ————— o pé (v4) —————
     A pílula vem 44 depois do fim do título, nunca antes da c6 (a regra do pé
     da Solicitação); o fim é medido depois que a fonte chega. */
  const tituloPeRef = useRef<HTMLDivElement | null>(null);
  const [fimTituloPe, setFimTituloPe] = useState(80 + 420);
  useEffect(() => {
    const el = tituloPeRef.current;
    if (!el) return;
    let vivo = true;
    void document.fonts?.ready.then(() => { if (vivo && el.isConnected) setFimTituloPe(el.offsetLeft + el.offsetWidth); });
    return () => { vivo = false; };
  }, []);
  const pilulaPeX = Math.max(480 - 2.21 / 2, Math.ceil(fimTituloPe + 44));

  /* ————— as faixas da capa ————— */
  const faixas = antigas ? [...principais, antigas] : principais;
  const PILULA: CSSProperties = { height: 40, boxSizing: "border-box", padding: "0 20px", borderRadius: 999, font: `600 16px/1 ${INTER}`, cursor: "pointer", whiteSpace: "nowrap" };
  const TEXTO_ACAO: CSSProperties = { padding: 0, border: 0, background: "none", font: `500 16px/1 ${INTER}`, color: PRETO, cursor: "pointer", whiteSpace: "nowrap" };
  const xis = <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>;

  return (
    <PalcoFixo>
      {/* a página no cinza do rework, da barra ao pé (sem a faixa preta) */}
      <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: FUNDO_PAGINA, zIndex: 0 }} />
      <div style={{ position: "absolute", inset: 0 }} inert={!!form || !!verTodas}>

        {/* ————— o bloco da busca (8 colunas, neutro): o de Pantones. Fica
            parado quando a ficha entra, para quem está digitando não perder
            o campo de vista ————— */}
        <div style={{ position: "absolute", left: 80, top: CAPA_V4.topo, width: HERO_L, height: CAPA_V4.altura, boxSizing: "border-box", background: "#fff",
          borderRadius: CAPA_V4.raio, boxShadow: CAPA_V4.sombra, zIndex: 4 }}>
          <div style={{ position: "absolute", left: 76, top: 58, height: 22, display: "flex", alignItems: "center", gap: 10, ...MARCA, lineHeight: "22px" }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: PRETO }} />
            Arquivo físico de clichês
          </div>
          <div style={{ position: "absolute", left: 76, top: 111, width: 488, ...TITULO, color: PRETO }}>
            Qual pasta<br />você procura?
          </div>
          <div style={{ position: "absolute", left: 76, top: 437 + DESCE, width: 488, font: `400 20px/28px ${INTER}`, color: TINTA2 }}>
            Pelo cliente, pelo número ou pela etiqueta:
            <div>
              {EXEMPLOS.map((ex, i) => (
                <span key={ex}>
                  {i > 0 && <span style={{ color: CINZA }}> · </span>}
                  <button onClick={() => { mudarBusca(ex); setRecorte(null); heroRef.current?.focus(); }} className="pn10-link" aria-label={`Pesquisar ${ex}`}
                    style={{ padding: 0, border: 0, background: "none", cursor: "pointer", font: `500 20px/28px ${INTER}`, color: PRETO }}>{ex}</button>
                </span>
              ))}
            </div>
          </div>
          {/* o pé do campo no pé das setas das faixas, como em Pantones; no
              painel branco, o campo no cinza da pesquisa da barra */}
          <label style={{ position: "absolute", left: 76, top: 513 + DESCE, width: 480, height: 56, boxSizing: "border-box", display: "flex", alignItems: "center", background: FUNDO_PESQUISA, borderRadius: RAIO_DA_PESQUISA, cursor: "text" }}>
            <input ref={heroRef} value={busca} autoFocus={!semente} onChange={(e) => mudarBusca(e.target.value)} onKeyDown={teclaCampo}
              placeholder="PESQUISA" aria-label="Pesquisar pasta no arquivo" spellCheck={false} autoComplete="off"
              aria-describedby={dentro && sel ? "ar10-ficha-nome" : undefined}
              style={{ flex: 1, minWidth: 0, height: "100%", border: "none", outline: "none", background: "none", textAlign: busca ? "left" : "center",
                padding: busca ? "0 0 0 18px" : 0, font: `600 16px/1 ${INTER}`, letterSpacing: busca ? 0 : ".08em", color: PRETO }} />
            {busca && (
              <button type="button" onClick={() => { mudarBusca(""); heroRef.current?.focus(); }} className="p10-flat" aria-label="Limpar a busca"
                style={{ flex: "none", width: 44, height: "100%", padding: 0, border: 0, background: "none", cursor: "pointer", display: "grid", placeItems: "center" }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            )}
          </label>
        </div>

        {!dentro ? (
          <>
            {/* ————— as gavetas: as faixas de Pantones, com a letra no lugar
                do nome da cor; no v4, cartões de 160 com raio e sombra, a
                partir da c9, e a fileira rola de lado (TrilhaV4) ————— */}
            <TrilhaV4 quantos={carregando ? 1 : faixas.length} inicio={FAIXAS_X} largura={carregando ? 1120 : FAIXA} rotulo="Gavetas do arquivo"
              aoTeclar={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                const botoes = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button.pd4-cartao"));
                const i = botoes.indexOf(document.activeElement as HTMLButtonElement);
                if (i < 0) return;
                e.preventDefault();
                const alvo = botoes[Math.max(0, Math.min(botoes.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)))];
                alvo?.focus();
                alvo?.scrollIntoView({ inline: "nearest", block: "nearest" });
              }}>
              {carregando ? (
                <div style={{ flex: "0 0 1120px", height: CAPA_V4.altura, boxSizing: "border-box", borderRadius: CAPA_V4.raio, background: "#fff", boxShadow: CAPA_V4.sombra,
                  display: "grid", placeItems: "center", font: `400 20px ${INTER}`, color: TINTA3 }}>Carregando as pastas…</div>
              ) : faixas.map((g, i) => {
                const antiga = g.k === "antigas";
                const tom = antiga ? TOM_ANTIGAS : tomDaLetra(g.k);
                return (
                  <button key={g.k} className="pd4-cartao" onClick={(e) => abrirRecorte(g.k, e.currentTarget)}
                    aria-label={`${g.rot}, ${nPastas(g.total)}`} title={antiga ? `Registros antigos: ${codigosAntigos}` : undefined}
                    style={{ position: "relative", flex: `0 0 ${FAIXA}px`, height: CAPA_V4.altura, boxSizing: "border-box", padding: 0, border: 0,
                      borderRadius: CAPA_V4.raio, background: tom, boxShadow: CAPA_V4.sombra, zIndex: i + 1, cursor: "pointer", textAlign: "left", font: "inherit", color: PRETO,
                      ["--tinta" as string]: PRETO, ["--faixa" as string]: tom } as CSSProperties}>
                    <span aria-hidden style={{ position: "absolute", left: 58, top: 47, width: 44, height: 44, borderRadius: 999, background: PRETO, color: "#fff",
                      display: "grid", placeItems: "center", font: `700 14px/1 ${INTER}`, fontVariantNumeric: "tabular-nums" }}>{fmt(g.total)}</span>
                    {antiga ? (
                      /* o nome girado, lendo de baixo para cima, como os de Pantones */
                      <span aria-hidden style={{ position: "absolute", left: 52, top: 122, width: 56, height: 371 + DESCE, writingMode: "vertical-rl", transform: "rotate(180deg)",
                        ...TITULO, whiteSpace: "nowrap" }}>Antigas</span>
                    ) : (
                      /* a letra em pé, com a linha de base onde os nomes de Pantones
                         terminam: Fraunces 112 tem a base a 96,5 do topo da caixa
                         de 112 (medido no DOM) */
                      <span aria-hidden style={{ position: "absolute", left: 0, width: FAIXA, top: 397 + DESCE, height: 112, textAlign: "center",
                        ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 144", fontSize: 112, lineHeight: "112px", letterSpacing: "-.02em" }}>{g.k}</span>
                    )}
                    <span aria-hidden className="pn10-seta" style={{ position: "absolute", left: 58, top: 525 + DESCE, width: 44, height: 44, boxSizing: "border-box",
                      border: `1.5px solid ${PRETO}`, borderRadius: 999, display: "grid", placeItems: "center" }}>
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="7" y1="17" x2="17" y2="7" /><polyline points="8 7 17 7 17 16" />
                      </svg>
                    </span>
                  </button>
                );
              })}
            </TrilhaV4>
          </>
        ) : (
          /* ————— a ficha, no lugar das faixas ————— */
          <section aria-label="Ficha da pasta" style={{ position: "absolute", left: FAIXAS_X, top: CAPA_V4.topo, width: FICHA_W, height: CAPA_V4.altura, boxSizing: "border-box", zIndex: 2,
            background: sel ? tomDaGaveta(sel.gaveta) : "#fff", borderRadius: CAPA_V4.raio, boxShadow: CAPA_V4.sombra, color: PRETO, overflow: "hidden" }}>
            {/* zIndex: o bloco do nome, que vem depois, ocupa a largura toda e
                cobria o × (o clique não chegava nele) */}
            <div style={{ position: "absolute", right: M, top: 58, zIndex: 1 }}>
              <Redondo rotulo="Fechar e voltar às gavetas" aoClicar={voltarTudo}>{xis}</Redondo>
            </div>

            {sel ? (
              <>
                {/* o grupo de cima: o nome, enorme, e a linha de ações embaixo
                    dele, no fluxo (desce junto quando o nome tem duas linhas) */}
                <div style={{ position: "absolute", left: M, right: M, top: tamNome.topo }}>
                  <h2 id="ar10-ficha-nome" title={sel.vaga ? undefined : sel.nome}
                    /* -2: a folga lateral da Fraunces nesse corpo; assim a tinta da
                       primeira letra cai na margem da pílula e dos rótulos (medido).
                       Padding e margem de 14 embaixo: a perna do g/p da última
                       linha passa 12 px da entrelinha (84 no corpo 88) e o
                       limite de 2 linhas cortava; a linha de ações não se mexe. */
                    style={{ margin: "0 0 -14px -2px", paddingBottom: 14, maxWidth: FICHA_W - 2 * M - 46 - 40 + 2, ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 144", fontSize: tamNome.fs, lineHeight: `${tamNome.lh}px`, letterSpacing: "-.035em",
                      color: sel.vaga ? TINTA2 : PRETO, overflowWrap: "anywhere", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" } as CSSProperties}>
                    {nomeSel}
                  </h2>
                <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 24 }}>
                  {tirando?.id === sel.id ? (
                    <>
                      <span role="alert" style={{ font: `500 16px/1.3 ${INTER}`, color: tirando.erro ? PALETA.perigo : PRETO }}>
                        {tirando.erro || (tirando.fase === "pergunta"
                          ? "Tirar esta pasta do arquivo? Apaga só o cadastro no hub."
                          : `Tem certeza? A pasta ${sel.pasta || sel.codigo} sai do arquivo para todos.`)}
                      </span>
                      {/* as chaves remontam o botão a cada passo: o foco vai para ele */}
                      {tirando.fase === "pergunta" ? (
                        <button key="sim" autoFocus onClick={() => { if (!cedoDemais()) perguntarTirar("certeza"); }} className="p10-flat"
                          style={{ ...PILULA, border: `1.5px solid ${PALETA.perigo}`, background: "none", color: PALETA.perigo }}>Sim, tirar</button>
                      ) : (
                        <button key="tirar" autoFocus onClick={() => void tirarDoArquivo()} disabled={tirando.fase === "tirando"} className="p10-flat"
                          style={{ ...PILULA, border: 0, background: PALETA.perigo, color: PALETA.perigoTinta }}>{tirando.fase === "tirando" ? "Tirando…" : "Tirar do arquivo"}</button>
                      )}
                      <button onClick={cancelarTirar} disabled={tirando.fase === "tirando"} className="p10-flat" style={TEXTO_ACAO}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      {editavel && (
                        <>
                          {/* pasta vaga: o primeiro passo é dar a ela um cliente
                              (às vezes o número é reaproveitado, Augusto, 28/09/2026) */}
                          {sel.vaga ? (
                            <>
                              <button onClick={(e) => { origemForm.current = e.currentTarget; setForm({ modo: "usar", pasta: sel }); }} className="p10-flat"
                                style={{ ...PILULA, border: 0, background: PRETO, color: "#fff" }}>Usar esta pasta</button>
                              <button onClick={(e) => { origemForm.current = e.currentTarget; setForm({ modo: "editar", pasta: sel }); }} className="p10-flat" style={TEXTO_ACAO}>Editar cadastro</button>
                            </>
                          ) : (
                            <button onClick={(e) => { origemForm.current = e.currentTarget; setForm({ modo: "editar", pasta: sel }); }} className="p10-flat"
                              style={{ ...PILULA, border: 0, background: PRETO, color: "#fff" }}>Editar cadastro</button>
                          )}
                          <button onClick={() => perguntarTirar("pergunta")} className="p10-flat" style={TEXTO_ACAO}>Tirar do arquivo</button>
                        </>
                      )}
                      {/* a navegação entre os achados, na mesma linha, encostada na margem direita */}
                      {n > 1 && (
                        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                          <span aria-live="polite" style={{ font: `500 16px/1 ${INTER}`, color: TINTA_TOM, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmt(posSel + 1)} de {fmt(n)}</span>
                          <Redondo rotulo="Pasta anterior" aoClicar={() => andar(-1)} tam={40}>
                            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                          </Redondo>
                          <Redondo rotulo="Próxima pasta" aoClicar={() => andar(1)} tam={40}>
                            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                          </Redondo>
                          <button onClick={(e) => abrirVerTodas("ficha", e.currentTarget)} className="p10-flat"
                            style={{ ...PILULA, border: `1.5px solid ${PRETO}`, background: "none", color: PRETO }}>Ver todas</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                </div>

                {/* o pé: três faixas de 72, as mesmas para as duas colunas */}
                {[0, 1, 2].map((i) => (
                  <div key={`fio-${i}`} aria-hidden>
                    <div style={{ position: "absolute", left: M, width: COL_DIR - M - M, top: PE_TOPO + i * FAIXA_PE, height: 1, background: "rgba(0,0,0,.2)" }} />
                    <div style={{ position: "absolute", left: COL_DIR, right: M, top: PE_TOPO + i * FAIXA_PE, height: 1, background: "rgba(0,0,0,.2)" }} />
                  </div>
                ))}
                {/* à esquerda, os detalhes pequenos, um por faixa */}
                {([
                  ["Situação", situacaoDe(sel)],
                  ["Última consulta", ultimaSel == null ? "Nenhuma registrada" : quandoFoi(ultimaSel, agora)],
                  terceira,
                ] as [string, string][]).map(([rot, valor], i) => (
                  <div key={rot} style={{ position: "absolute", left: M, width: COL_DIR - M - M, top: PE_TOPO + i * FAIXA_PE + 1, height: FAIXA_PE - 1,
                    display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, minWidth: 0 }}>
                    <span style={{ font: `500 14px/18px ${INTER}`, color: TINTA_TOM }}>{rot}</span>
                    <span title={valor} style={{ font: `500 18px/24px ${INTER}`, color: PRETO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{valor}</span>
                  </div>
                ))}
                {falhaConsulta === sel.id && (
                  <div role="alert" style={{ position: "absolute", left: M, width: COL_DIR - M - M, top: PE_TOPO - 34, font: `500 15px/1.3 ${INTER}`, color: PALETA.perigo }}>
                    A consulta de agora não foi gravada.
                  </div>
                )}
                {soLeitura && (
                  <div style={{ position: "absolute", left: M, width: COL_DIR - M - M, top: PE_TOPO - 34, font: `400 15px/1.3 ${INTER}`, color: TINTA_TOM }}>
                    Sem o servidor, as consultas não são gravadas.
                  </div>
                )}
                {/* à direita, a resposta: onde está a pasta, grande */}
                {([
                  ["Gaveta", letraDe(sel.gaveta)],
                  ["Pasta", sel.codigo ? String(sel.codigo) : "—"],
                  ["Consultas", fmt(consultasDe(sel).length)],
                ] as [string, string][]).map(([rot, valor], i) => (
                  <div key={rot} style={{ position: "absolute", left: COL_DIR, right: M, top: PE_TOPO + i * FAIXA_PE + 1, height: FAIXA_PE - 1,
                    display: "flex", alignItems: "center" }}>
                    <div style={{ flex: 1, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 24 }}>
                      <span style={{ font: `400 32px/1 ${INTER}`, letterSpacing: "-.02em" }}>{rot}</span>
                      <span style={{ ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 96", fontSize: 52, lineHeight: 1, letterSpacing: "-.03em", fontVariantNumeric: "lining-nums" }}>{valor}</span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              /* nada para mostrar: o mesmo lugar do nome, com o que fazer */
              <div style={{ position: "absolute", left: M - 4, top: NOME_MEDIO.topo, width: FICHA_W - 2 * M - 46 - 40 + 4 }}>
                <h2 style={{ margin: 0, ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 144", fontSize: NOME_MEDIO.fs, lineHeight: `${NOME_MEDIO.lh}px`, letterSpacing: "-.035em", color: PRETO }}>
                  {carregando ? "Carregando as pastas…" : q ? `Nenhuma pasta com “${q}”.` : "Nenhuma pasta aqui."}
                </h2>
                {!carregando && (
                  <p style={{ margin: "20px 0 0 4px", font: `400 20px/1.5 ${INTER}`, color: TINTA3 }}>
                    {q ? "Confira o número ou procure por uma parte do nome." : recorte === "recentes" ? "Nenhuma pasta foi consultada nos últimos 30 dias." : "Esta gaveta está vazia."}
                  </p>
                )}
                {q && editavel && (
                  <button onClick={(e) => abrirCadastro(e.currentTarget, /\d/.test(q) ? "" : q.toUpperCase())} className="p10-flat"
                    style={{ ...PILULA, marginTop: 28, marginLeft: 4, border: `1px solid ${PRETO}`, background: AMARELO_MAIS, color: PRETO }}>Cadastrar pasta nova</button>
                )}
              </div>
            )}
          </section>
        )}

        {/* ————— o pé (v4): o título na c1, a ação em pílula e as contagens à
            direita, terminando na c23. Cada contagem abre a lista dela. ————— */}
        <div ref={tituloPeRef} style={tituloDoPeV4("Arquivos")}>Arquivos</div>
        {!soLeitura && nInativas > 0 && (
          <button onClick={baixarInativas} className="np4-pilula" title="Baixar a lista das pastas inativas e vagas numa planilha (CSV)"
            style={{ ...PILULA_DO_PE, left: pilulaPeX }}>Baixar inativas</button>
        )}
        {/* o Cadastrar, que morava no alto do painel da busca, no pé e na
            c10 (o meio do traço na coluna, como as pílulas de Pedidos) */}
        {editavel && (
          <button onClick={(e) => abrirCadastro(e.currentTarget)} className="np4-pilula" title="Cadastrar uma pasta nova no arquivo"
            style={{ ...PILULA_DO_PE, left: Math.max(800, pilulaPeX + 220) - 2.21 / 2 }}>Cadastrar pasta</button>
        )}
        <ResumoDoPeV4 fim="s" linhas={[
          soLeitura ? "Base migrada, só para consulta: as pastas não vieram do servidor." : undefined,
          recado ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: TINTA2 }}>
              {recado}
              <button onClick={() => setRecado("")} className="p10-flat" aria-label="Dispensar o recado"
                style={{ width: 24, height: 24, padding: 0, border: 0, background: "none", cursor: "pointer", display: "grid", placeItems: "center" }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </span>
          ) : undefined,
          carregando ? "Carregando as pastas…" : (
            <>{contagem("recentes", nRecentes, "consultada nos últimos 30 dias", "consultadas nos últimos 30 dias")}{" · "}{contagem("inativas", nInativas, "inativa ou vaga", "inativas ou vagas")}</>
          ),
          carregando ? undefined : (
            <>{contagem("todas", todas.length, "pasta no total", "pastas no total")}{" · "}{contagem("antigas", antigas?.total ?? 0, "registro antigo", "registros antigos")}</>
          ),
        ]} />
      </div>

      {verTodas && (
        <VerTodas titulo={tituloLista} subtitulo={subtituloLista} lista={achados} selId={sel?.id ?? null} agora={agora}
          situacaoDe={situacaoDe} ultimaDe={ultimaDe} aoEscolher={escolherNaLista} fechar={fecharVerTodas} />
      )}

      {form && (
        <CaixaPasta form={form} todas={todas}
          /* as gavetas de A a P primeiro; os registros antigos no fim */
          gavetas={[...new Set(todas.map((p) => p.gaveta).concat(LETRAS.map((l) => `GAVETA ${l}`)))]
            .sort((a, b) => (ehAntiga(a) ? 1 : 0) - (ehAntiga(b) ? 1 : 0) || porLetra(letraDe(a), letraDe(b)))}
          gavetaSugerida={!q && recorte && LETRAS.includes(recorte) ? `GAVETA ${recorte}` : ""}
          fechar={() => { setForm(null); requestAnimationFrame(() => { const o = origemForm.current; if (o && document.contains(o)) o.focus(); }); }}
          aoSalvar={aoSalvar} />
      )}

      <div className="h10-so-leitor" aria-live="polite">{anuncio}</div>

      {/* a barra transparente: a sombra do cartão no hover passa por baixo dela
          sem corte (como em Pedidos) */}
      <BarraTopoHub10 profile={profile} paginaAtiva="Arquivos" aoNavegar={aoNavegar} onNova={onNova} onLogout={onLogout} disponiveis={disponiveis} fundo="transparent" />
    </PalcoFixo>
  );
}

/* ————— "Ver todas": a camada do "Ver todos" de Pedidos —————
   Cobre o palco inteiro (por cima da barra), título em Fraunces 72, contagem,
   fechar preto de 56, a pesquisa tracejada de Pedidos, cabeçalho fixo com
   filete de 1,5 e linhas de 64. Só as linhas à vista são montadas: "Todas as
   pastas" tem 1.915. A pesquisa filtra a lista que está aberta (a gaveta, as
   recentes...); escolher uma linha fecha a camada e abre a ficha dela. */
function VerTodas({ titulo, subtitulo, lista, selId, agora, situacaoDe, ultimaDe, aoEscolher, fechar }: {
  titulo: string; subtitulo: string; lista: Pasta[]; selId: string | null; agora: number;
  situacaoDe: (p: Pasta) => string; ultimaDe: (p: Pasta) => number | null;
  aoEscolher: (id: string) => void; fechar: () => void;
}) {
  const rolo = useRef<HTMLDivElement | null>(null);
  const [topo, setTopo] = useState(0);
  const [altura, setAltura] = useState(700);
  const pendente = useRef<number | null>(null);
  const [, cutucar] = useState(0);

  /* ————— a pesquisa ————— */
  const [termo, setTermo] = useState("");
  const termoRef = useRef(termo);
  termoRef.current = termo;
  const campo = useRef<HTMLInputElement | null>(null);
  const t = termo.trim();
  /* a relevância do campo da página (número exato primeiro); no empate, a
     ordem da lista */
  const vista = useMemo(() => {
    if (!t) return lista;
    const casa = criarBusca(t);
    return lista.map((p, i) => ({ p, i })).filter(({ p }) => casa(p.nome, String(p.codigo), p.pasta))
      .map((x) => ({ ...x, r: relevancia(x.p, t) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.p);
  }, [lista, t]);
  /* pesquisar leva a lista de volta ao topo */
  const mudarTermo = useCallback((v: string) => {
    setTermo(v);
    if (rolo.current) rolo.current.scrollTop = 0;
    setTopo(0);
  }, []);
  const irAoCampo = () => {
    const el = campo.current;
    if (!el) return;
    el.focus();
    requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
  };
  /* ESC limpa a pesquisa primeiro; com ela vazia, fecha a camada */
  const aoEsc = useCallback(() => {
    if (termoRef.current) { mudarTermo(""); campo.current?.focus(); } else fechar();
  }, [fechar, mudarTermo]);
  useEscDoTopo(true, NIVEL.verTodos, aoEsc);
  /* digitar em qualquer lugar da camada é pesquisar */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const noCampo = !!alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT" || alvo.isContentEditable);
      if (noCampo || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (e.key.length === 1 && e.key !== " ") { e.preventDefault(); mudarTermo(termoRef.current + e.key); irAoCampo(); }
      else if (e.key === "Backspace" && termoRef.current) { e.preventDefault(); mudarTermo(termoRef.current.slice(0, -1)); irAoCampo(); }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [mudarTermo]);
  const teclaCampo = (e: KeyboardEventReact<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); focar(0); }
    /* Enter abre a primeira achada, como o Enter do campo da página */
    else if (e.key === "Enter" && t && vista.length) { e.preventDefault(); aoEscolher(vista[0].id); }
  };

  /* abre na escolhida (ou na primeira), com o foco nela */
  useLayoutEffect(() => {
    const el = rolo.current;
    if (!el) return;
    setAltura(el.clientHeight);
    const i = Math.max(0, lista.findIndex((p) => p.id === selId));
    el.scrollTop = Math.max(0, i * LINHA_VT - el.clientHeight / 2 + LINHA_VT / 2);
    setTopo(el.scrollTop);
    pendente.current = i;
    cutucar((x) => x + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* o foco entra na linha logo depois do render que a monta */
  useLayoutEffect(() => {
    const i = pendente.current;
    if (i == null) return;
    const b = rolo.current?.querySelector<HTMLButtonElement>(`button[data-i="${i}"]`);
    if (b) { pendente.current = null; b.focus({ preventScroll: true }); }
  });
  const focar = (i: number) => {
    const el = rolo.current;
    if (!el || !vista.length) return;
    const alvo = Math.max(0, Math.min(vista.length - 1, i));
    const y = alvo * LINHA_VT;
    if (y < el.scrollTop) el.scrollTop = y;
    else if (y + LINHA_VT > el.scrollTop + el.clientHeight) el.scrollTop = y + LINHA_VT - el.clientHeight;
    setTopo(el.scrollTop);
    pendente.current = alvo;
    cutucar((x) => x + 1);
  };
  const tecla = (e: KeyboardEventReact<HTMLDivElement>) => {
    const atual = Number((document.activeElement as HTMLElement | null)?.dataset?.i ?? -1);
    /* da primeira linha, a seta para cima sobe para a pesquisa */
    if (e.key === "ArrowUp" && atual === 0) { e.preventDefault(); irAoCampo(); return; }
    const passos: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: 10, PageUp: -10 };
    if (e.key in passos) { e.preventDefault(); focar((atual < 0 ? 0 : atual) + passos[e.key]); }
    else if (e.key === "Home") { e.preventDefault(); focar(0); }
    else if (e.key === "End") { e.preventDefault(); focar(vista.length - 1); }
  };

  const primeira = Math.max(0, Math.floor(topo / LINHA_VT) - 6);
  const ultima = Math.min(vista.length, Math.ceil((topo + altura) / LINHA_VT) + 6);
  const nomeDaLinha = (p: Pasta) => (p.vaga ? "Pasta vaga" : p.nome || "Sem nome");
  /* a pesquisa começa na coluna logo depois do título (que muda: "Gaveta A",
     "Todas as pastas"…), com pelo menos 16 px de ar */
  const tituloRef = useRef<HTMLDivElement | null>(null);
  const [buscaX, setBuscaX] = useState(400);
  useLayoutEffect(() => {
    const el = tituloRef.current;
    if (!el) return;
    const x = Math.ceil((el.offsetLeft + el.offsetWidth + 16) / 80) * 80;
    if (x !== buscaX) setBuscaX(x);
  });

  return (
    <div role="dialog" aria-modal="true" aria-label={titulo}
      style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: FUNDO, zIndex: NIVEL.verTodos, color: PRETO, fontFamily: INTER }}>
      {/* Título, pesquisa, contagem e fechar numa linha só (Augusto,
          29/09/2026). A pesquisa vem logo depois do título; a contagem fica
          ao lado do fechar, na altura do centro dele: embaixo do título ela
          acumulava informação no mesmo canto e a tela pesava para a esquerda
          (28/09/2026). Na grade (ChromeHub10, listas "Ver todos"): título na
          c1/linha 7, pesquisa e fechar centrados na linha 5,5, a contagem
          com a tinta na c18 (a linha da pesquisa da barra) e a base na 6. */}
      <div>
        <div ref={tituloRef} style={{ ...tituloDaLista(titulo.charAt(0)), maxWidth: 760, overflow: "hidden", textOverflow: "ellipsis" }}>{titulo}</div>
        {/* a pesquisa: a mesma pílula tracejada do "Ver todos" de Pedidos */}
        <label style={{ position: "absolute", left: buscaX, top: 5.5 * LINHA_DA_GRADE_HUB - 26, boxSizing: "border-box", width: 560, height: 52, border: `1.5px dashed ${PRETO}`, borderRadius: 999, background: "#fff", display: "flex", alignItems: "center", gap: 12, padding: "0 22px", cursor: "text" }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={2.2} strokeLinecap="round" style={{ flex: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" /></svg>
          <input ref={campo} value={termo} onChange={(e) => mudarTermo(e.target.value)} onKeyDown={teclaCampo}
            placeholder="Buscar cliente, número ou etiqueta" aria-label="Pesquisar nesta lista" spellCheck={false} autoComplete="off"
            style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", fontFamily: INTER, fontSize: 17, color: PRETO }} />
          {termo && (
            <button type="button" onClick={() => { mudarTermo(""); campo.current?.focus(); }} className="p10-flat" aria-label="Limpar a pesquisa"
              style={{ flex: "none", width: 28, height: 28, marginRight: -6, padding: 0, border: 0, background: "none", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          )}
        </label>
        <div aria-live="polite" style={{ ...textoNaGrade(1440, 6, 20, 400, (t ? fmt(vista.length) : subtitulo).charAt(0)), color: CINZA }}>
          {t ? `${fmt(vista.length)} de ${fmt(lista.length)} ${lista.length === 1 ? "pasta" : "pastas"}` : subtitulo}
        </div>
        <button onClick={fechar} className="p10-dot" aria-label="Fechar a lista"
          style={{ ...FECHAR_DA_LISTA, width: 56, height: 56, borderRadius: 999, border: `1px solid ${PRETO}`, background: PRETO, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
          <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      {/* o cabeçalho da tabela: três linhas da grade (9 a 12), rótulo com a
          base na 11 e o filete na 12, onde a lista começa */}
      <div style={{ position: "absolute", left: 80, width: 1760, top: 9 * LINHA_DA_GRADE_HUB, height: 3 * LINHA_DA_GRADE_HUB, boxSizing: "border-box",
        paddingTop: 2 * LINHA_DA_GRADE_HUB - baseInter(13, 13), display: "grid", gridTemplateColumns: COLUNAS_VT, alignItems: "start",
        fontSize: 13, lineHeight: "13px", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: CINZA, borderBottom: `1.5px solid ${PRETO}` }}>
        <span>Etiqueta</span><span>Cliente</span><span>Situação</span><span>Última consulta</span>
      </div>
      <div ref={rolo} className="p10-trilha" onScroll={(e) => setTopo(e.currentTarget.scrollTop)} onKeyDown={tecla}
        style={{ position: "absolute", left: 80, width: 1760, top: 12 * LINHA_DA_GRADE_HUB, bottom: 40, overflowY: "auto", overflowX: "hidden", scrollSnapType: "none" }}>
        {vista.length === 0 ? (
          <div style={{ padding: "28px 0", fontSize: 20, color: TINTA3 }}>{t ? `Nenhuma pasta com “${t}” nesta lista.` : "Nenhuma pasta aqui."}</div>
        ) : (
          <div role="listbox" aria-label={titulo} style={{ position: "relative", height: vista.length * LINHA_VT }}>
            {vista.slice(primeira, ultima).map((p, j) => {
              const i = primeira + j;
              const u = ultimaDe(p);
              const on = p.id === selId;
              return (
                <button key={p.id} data-i={i} role="option" aria-selected={on} onClick={() => aoEscolher(p.id)} className="p10-linha ar10-vt"
                  style={{ position: "absolute", left: 0, top: i * LINHA_VT, width: "100%", height: LINHA_VT, boxSizing: "border-box",
                    display: "grid", gridTemplateColumns: COLUNAS_VT, alignItems: "center", padding: `0 0 ${ACERTO_LINHA_VT}px`,
                    border: 0, borderBottom: "1px solid rgba(37,36,37,.12)", background: on ? "rgba(37,36,37,.06)" : "none",
                    textAlign: "left", cursor: "pointer", font: `400 18px/1.2 ${INTER}`, color: PRETO }}>
                  <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{p.pasta || p.codigo || "—"}</span>
                  <span style={{ ...FR, fontSize: 22, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: p.vaga ? TINTA3 : PRETO, marginTop: -3 }}>{nomeDaLinha(p)}</span>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{situacaoDe(p)}</span>
                  <span style={{ color: TINTA2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u == null ? "Nenhuma" : quandoFoi(u, agora)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ————— cadastrar ou editar uma pasta (modal 1.0, como "Atualizar a tabela") ————— */
const CAMPO_MODAL: CSSProperties = {
  width: "100%", height: 46, boxSizing: "border-box", padding: "0 14px", border: "1.5px solid #d9d8d6", borderRadius: 11,
  background: "#fff", font: `500 17px/1 ${INTER}`, color: PRETO, outline: "none",
};
const ROTULO_MODAL: CSSProperties = { display: "block", marginBottom: 8, font: `600 15px/1.2 ${INTER}`, color: TINTA2 };

function CaixaPasta({ form, todas, gavetas, gavetaSugerida, fechar, aoSalvar }: {
  form: NonNullable<Form>; todas: Pasta[]; gavetas: string[]; gavetaSugerida: string;
  fechar: () => void; aoSalvar: (p: Pasta, nova: boolean, usada: boolean) => void;
}) {
  /* a pasta que já existe (editar, ou a vaga que vai ganhar cliente) */
  const [antes, setAntes] = useState<Pasta | null>(form.modo === "nova" ? null : form.pasta);
  /* usando: a pasta vaga ganha um cliente novo; o número é reaproveitado */
  const [usando, setUsando] = useState(form.modo === "usar");
  /* a vaga migrada tem o nome "DESATIVADO": no campo, fica vazio */
  const nomeInicial = form.modo === "nova" ? form.nome
    : form.modo === "usar" || (form.pasta.vaga && /^DESATIVAD[OA]$/i.test(form.pasta.nome.trim())) ? "" : form.pasta.nome;
  const [nome, setNome] = useState(nomeInicial);
  const [numero, setNumero] = useState(antes ? String(antes.codigo || "") : "");
  const [gaveta, setGaveta] = useState(antes?.gaveta ?? gavetaSugerida);
  const [etiqueta, setEtiqueta] = useState(antes?.pasta ?? "");
  const [obs, setObs] = useState(form.modo === "editar" ? obsDe(form.pasta) : "");
  const [vaga, setVaga] = useState(form.modo === "editar" ? form.pasta.vaga : false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const fecharSeLivre = useCallback(() => { if (!salvando) fechar(); }, [salvando, fechar]);
  useEscDoTopo(true, NIVEL.caixa, fecharSeLivre);

  const cod = Number(numero.replace(/\D/g, "")) || 0;
  const etiquetaAuto = gaveta && cod ? `${letraDe(gaveta)}-${cod}` : "";
  const dono = cod ? todas.find((p) => p.codigo === cod && p.id !== antes?.id) ?? null : null;
  /* número de uma pasta VAGA, numa pasta nova: em vez de duplicar, usar a vaga */
  const podeUsar = !!dono && dono.vaga && !antes;
  const aviso = dono ? (dono.vaga
    ? `O número ${cod} é de uma pasta vaga (${dono.pasta}).`
    : `O número ${cod} já é da pasta ${dono.nome} (${dono.pasta}).`) : "";
  const usarVaga = (p: Pasta) => {
    setAntes(p); setUsando(true); setGaveta(p.gaveta); setEtiqueta(p.pasta); setVaga(false); setErro("");
  };
  const falta = !cod ? "Informe o número da pasta." : !gaveta ? "Escolha a gaveta." : !vaga && !nome.trim() ? "Informe o nome do cliente." : "";
  const pode = !falta && !dono && !salvando;
  const titulo = usando ? "Usar pasta vaga" : antes ? "Editar pasta" : "Pasta nova";

  const salvar = async () => {
    if (!pode) { setErro(aviso || falta); return; }
    setSalvando(true); setErro("");
    const p: Pasta = {
      id: antes?.id ?? `c${Date.now()}`,
      nome: vaga && !nome.trim() ? "DESATIVADO" : nome.trim(),
      codigo: cod, gaveta, pasta: etiqueta.trim() || etiquetaAuto, obs: obs.trim(), vaga,
      /* a pasta nova entra com a consulta de hoje, como na V1a; a vaga que
         ganha cliente também (o histórico dela era do cliente antigo) */
      consultas: antes && !usando ? antes.consultas : [isoLocal(Date.now())],
    };
    try {
      const m = await import("@/lib/api/arquivo.functions");
      await m.salvarPasta({ data: p });
      aoSalvar(p, !antes, usando);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para salvar a pasta.");
      setSalvando(false);
    }
  };

  return (
    <div onClick={fecharSeLivre}
      style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: NIVEL.caixa, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(37,36,37,.78)" }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void salvar(); }} role="dialog" aria-modal="true" aria-label={titulo}
        style={{ boxSizing: "border-box", width: 760, background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, overflow: "hidden", boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)", fontFamily: INTER, color: PRETO }}>
        <div style={{ position: "relative", padding: "26px 36px 20px", background: AMARELO, borderBottom: `1px solid ${PRETO}` }}>
          <div style={{ font: `600 16px/1.2 ${INTER}`, color: TINTA2 }}>Arquivo físico</div>
          <div style={{ ...FR, fontSize: 40, lineHeight: 1, letterSpacing: "-.03em", marginTop: 8 }}>{titulo}</div>
          <button type="button" onClick={fecharSeLivre} aria-label="Fechar" style={{ ...FECHAR_X, position: "absolute", right: 28, top: 26 }}>✕</button>
        </div>

        <div style={{ padding: "24px 36px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 20px" }}>
          <label style={{ gridColumn: "1 / -1" }}>
            <span style={ROTULO_MODAL}>Nome do cliente</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder={vaga ? "Pasta vaga" : "Ex.: Padaria São João"} style={CAMPO_MODAL} />
          </label>
          <label>
            <span style={ROTULO_MODAL}>Número</span>
            <input value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Ex.: 2935" style={CAMPO_MODAL} />
          </label>
          <label>
            <span style={ROTULO_MODAL}>Gaveta</span>
            <select value={gaveta} onChange={(e) => setGaveta(e.target.value)} style={{ ...CAMPO_MODAL, cursor: "pointer" }}>
              <option value="">Escolha a gaveta</option>
              {gavetas.map((g) => <option key={g} value={g}>{ehAntiga(g) ? `${letraDe(g)} (registro antigo)` : `Gaveta ${letraDe(g)}`}</option>)}
            </select>
          </label>
          <label>
            <span style={ROTULO_MODAL}>Etiqueta</span>
            <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value.toUpperCase())} placeholder={etiquetaAuto || "Ex.: O-2204"} style={CAMPO_MODAL} />
          </label>
          <label>
            <span style={ROTULO_MODAL}>Observação</span>
            <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: etiqueta de balança 40x40" style={CAMPO_MODAL} />
          </label>
          {/* dando cliente a uma vaga, ela deixa de ser vaga: a caixa sai */}
          {!usando && (
            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", font: `500 17px/1.3 ${INTER}` }}>
              <input type="checkbox" checked={vaga} onChange={(e) => setVaga(e.target.checked)} style={{ width: 20, height: 20, accentColor: PRETO, cursor: "pointer" }} />
              Pasta vaga (sem cliente)
            </label>
          )}
          {(erro || aviso) && (
            <div role="alert" style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 16, font: `500 17px/1.45 ${INTER}`, color: PALETA.perigo }}>
              <span>{erro || aviso}</span>
              {podeUsar && dono && (
                <button type="button" onClick={() => usarVaga(dono)} className="p10-flat"
                  style={{ flex: "none", height: 36, padding: "0 16px", border: `1.5px solid ${PRETO}`, borderRadius: 999, background: "none", color: PRETO, font: `600 15px/1 ${INTER}`, cursor: "pointer", whiteSpace: "nowrap" }}>Usar esta pasta</button>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 36px", background: PRETO }}>
          <span style={{ flex: 1, font: `400 15px/1.4 ${INTER}`, color: "#bdbdbd" }}>
            {usando ? `A pasta ${etiqueta.trim() || etiquetaAuto} passa a ser deste cliente, com a consulta de hoje.`
              : antes ? "Vale para todos na hora." : "A pasta entra no arquivo com a consulta de hoje."}
            {!usando && !etiqueta.trim() && etiquetaAuto ? ` Etiqueta: ${etiquetaAuto}.` : ""}
          </span>
          <button type="button" onClick={fecharSeLivre} disabled={salvando}
            style={{ height: 46, padding: "0 20px", border: "1px solid #555355", borderRadius: 999, background: "none", color: FUNDO, font: `600 16px ${INTER}`, cursor: "pointer" }}>Cancelar</button>
          <button type="submit" disabled={salvando}
            style={{ height: 46, padding: "0 24px", border: 0, borderRadius: 999, background: pode ? AMARELO_MAIS : "#4a484a", color: pode ? PRETO : "#8f8d8f",
              font: `700 16px ${INTER}`, cursor: pode ? "pointer" : "default" }}>{salvando ? "Salvando…" : "Salvar pasta"}</button>
        </div>
      </form>
    </div>
  );
}
