// "Design criado" — a caixa com que o designer entrega a arte.
// Fonte: hub-1.0/devolver-arte-modal.dc.html (o componente que o
// `Pedido 1.0.dc.html` importa como "Devolver-arte-modal").
//
// Substitui a DevolverArteModalV1a DENTRO da geração 1.0; as telas V1a
// continuam com a caixa antiga, que tem o "é uma pergunta" que elas usam.
//
// Diferenças conscientes em relação ao protótipo:
//
//  · Anexar abre o seletor de arquivos de verdade e guarda os File; no
//    protótipo era um contador que só subia.
//  · A versão sugerida vem de quem chama (conta as artes já entregues no
//    pedido), em vez de ler um histórico de brinquedo.
//  · As sugestões de cor saem de `sugestoesPantone`, a mesma busca que a
//    tabela Pantone do hub usa, e o botão redondo abre essa tabela.
//  · Anexar a prova em PDF preenche as cores com a legenda "Cores" dela
//    (cores-da-prova.ts), com volta para o que estava.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { juntarCores, lerCoresDaProva, type LeituraDaProva } from "@/lib/cores-da-prova";
import { de2000, nomeDaBusca, tipoDoCodigo } from "@/lib/nomes-de-cor";
import { PANTONE_SC } from "../v1a/dados/pantone";
import { corDoNome, prefixoPantone, sugestoesPantone } from "../v1a/dados/pantone-busca";
import { FR, INTER, NIVEL, PRETO, useEscDoTopo } from "./ChromeHub10";
import { PantoneHub10 } from "./PantoneHub10";
import { PALETA } from "@/lib/paleta-hub";

type Sugestao = Pick<ReturnType<typeof sugestoesPantone>[number], "codigo" | "nome" | "hex">;
/* o código, o hex e o Lab de cada cor do livro (o mesmo formato que o
   servidor usa para a tabela embutida, CorPantone) */
type CorDoLivro = { c: string; h: string; l: [number, number, number] };
const LIVRO: readonly CorDoLivro[] = PANTONE_SC.map((c) => c as CorDoLivro);

/* Nome de cor de referência ("amarelo ouro", "azul royal", "verde bandeira"):
   as Pantones mais parecidas com as referências do nome, da mais perto à mais
   longe, pelo ΔE2000 no Lab do livro e até o raio do nome. É a busca por nome
   da tela Pantones (PantonesHub10 e src/lib/nomes-de-cor), aqui nas seis da
   lista. Antes só o código sugeria e o nome ficava como texto livre
   (simulação 5, 05/10/2026). Como lá, metálico só entra nos nomes de metal, e
   nome de metal ou de neon mostra só os dele. A conta sai uma vez por nome. */
const SUGESTOES_DO_NOME = 6;
const pertoDoNome = new Map<string, Sugestao[]>();
function sugestoesDoNome(consulta: string): Sugestao[] | null {
  const n = nomeDaBusca(consulta);
  if (n?.tipo !== "ancora") return null;
  const pronta = pertoDoNome.get(n.termo);
  if (pronta) return pronta;
  const refs = n.refs
    .map((r) => LIVRO.find((c) => c.c.toUpperCase() === r.toUpperCase()))
    .filter((c): c is CorDoLivro => !!c);
  const perto: { c: CorDoLivro; d: number }[] = [];
  for (const c of LIVRO) {
    const t = tipoDoCodigo(c.c);
    if (n.somente === "metalicos" ? t !== "metalico" : n.somente === "neons" ? t !== "neon" : t === "metalico") continue;
    let d = Infinity;
    for (const r of refs) d = Math.min(d, de2000(r.l, c.l));
    if (d <= n.raio) perto.push({ c, d });
  }
  perto.sort((a, b) => a.d - b.d);
  const lista = perto.slice(0, SUGESTOES_DO_NOME).map(({ c }) => ({ codigo: c.c, nome: prefixoPantone(c.c), hex: c.h.toUpperCase() }));
  pertoDoNome.set(n.termo, lista);
  return lista;
}

const MAX_CORES = 7;
/* A caixa cresce até deixar livre, em cima e embaixo, a altura da barra do
   topo (112). Com 600, os avisos da leitura da prova (Leitura incerta, Pantone
   fora da legenda) empurravam o "Adicionar cor" para baixo da faixa de Anexos
   e observações (simulação 5, 05/10/2026). */
const ALTURA_MAXIMA = 1080 - 2 * 112;
const AMARELO = PALETA.amareloForte;
const ROXO = "#a4a2f0";
const CINZA = "#8a8a8a";
const BORDA_CAMPO = "#d9d8d6";

export type DesignCriado = { versao: string; cores: string[]; obs: string; arquivos: File[] };

const CAMPO: CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#fff",
  border: `1.5px solid ${BORDA_CAMPO}`, borderRadius: 11, padding: "12px 14px",
  font: `600 18px/1.2 ${INTER}`, color: PRETO, outline: "none",
};
const FAIXA: CSSProperties = {
  flex: "none", width: "100%", textAlign: "left", display: "flex", alignItems: "center",
  justifyContent: "space-between", gap: 16, padding: "15px 42px", border: 0,
  borderBottom: `1.5px solid ${PRETO}`, cursor: "pointer",
};
const TITULO_FAIXA: CSSProperties = {
  fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 40",
  fontWeight: 600, fontSize: 27, letterSpacing: "-.02em", color: PRETO, whiteSpace: "nowrap",
};

/** Avisos da leitura da prova: amarelam, não impedem (o mesmo da caixa
    "Clichê chegou"). */
function Aviso({ texto }: { texto: string }) {
  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", gap: 9, background: PALETA.amarelo, border: `1px solid ${PRETO}`, borderRadius: 12, padding: "10px 14px", font: `600 15px/1.4 ${INTER}`, color: PRETO }}>
      <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" style={{ flex: "none", marginTop: 2 }}>
        <path d="M12 4 2.5 20h19z" /><line x1="12" y1="10" x2="12" y2="14" /><line x1="12" y1="17" x2="12" y2="17" />
      </svg>
      <span>{texto}</span>
    </div>
  );
}

/* A leitura da prova tem prazo: se o OCR travar (idioma que não carrega), a
   caixa avisa em vez de ficar "lendo" para sempre. */
const PRAZO_DA_LEITURA = 90_000;
function comPrazo<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((ok, falha) => {
    const t = setTimeout(() => falha(new Error("A leitura passou do prazo.")), ms);
    p.then((v) => { clearTimeout(t); ok(v); }, (e: unknown) => { clearTimeout(t); falha(e); });
  });
}

/** Tira a cor i e puxa as bolinhas das seguintes uma casa para trás. Sem isso,
    remover a primeira cor deixava cada bolinha na cor errada. */
const semACor = (h: Record<number, string>, i: number): Record<number, string> =>
  Object.fromEntries(Object.entries(h)
    .filter(([k]) => Number(k) !== i)
    .map(([k, v]) => [Number(k) > i ? Number(k) - 1 : Number(k), v]));

function Chevron({ aberto }: { aberto: boolean }) {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "none", transform: aberto ? undefined : "rotate(-90deg)", transition: "transform .14s ease" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function DesignCriadoHub10({ pedido, versaoSugerida = "v1", fechar, onEnviar }: {
  pedido: { num?: string; cliente?: string; spec?: string; coresNomes?: string[] };
  /** "v2" quando já houve uma entrega, e assim por diante */
  versaoSugerida?: string;
  fechar: () => void;
  /** a caixa espera a promessa: fecha quem chamou, no sucesso; no erro ela
      fica aberta com tudo o que foi preenchido */
  onEnviar: (d: DesignCriado) => Promise<unknown> | void;
}) {
  const p = pedido || {};
  const coresIniciais = (() => {
    const nomes = (p.coresNomes ?? []).filter((x) => String(x ?? "").trim());
    /* Sem corte aqui: o teto de 7 vale para ACRESCENTAR cor, não para
       esconder as que o pedido já traz. Um pedido de 8 cores abria a caixa
       com 7 e a oitava sumia sem aviso — e ia embora na entrega. */
    if (nomes.length) return nomes;
    const n = parseInt((String(p.spec ?? "").match(/(\d+)\s*cores?/i) ?? [])[1], 10);
    if (Number.isFinite(n) && n > 0) return Array.from({ length: Math.min(n, MAX_CORES) }, () => "");
    return ["", ""];
  })();

  const [versao, setVersao] = useState(versaoSugerida);
  const [cores, setCores] = useState<string[]>(coresIniciais);
  /* As cores que vêm do pedido já com a amostra: "Preto", "Branco" e o
     Pantone escrito saíam cinza até alguém escolher de novo na lista
     (simulação 3, 30/09/2026). */
  const [hex, setHex] = useState<Record<number, string>>(() => {
    const h: Record<number, string> = {};
    coresIniciais.forEach((nome, i) => { const c = corDoNome(nome); if (c) h[i] = c; });
    return h;
  });
  const [obs, setObs] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  /* As duas seções fechadas ao abrir, como no projeto — ver o comentário
     gêmeo na ClicheChegouHub10. */
  const [secao, setSecao] = useState<null | "cores" | "recado">(null);
  const [sugIdx, setSugIdx] = useState<number | null>(null);
  /* Onde a lista de sugestões abre, no palco. Ela mora fora do cartão: dentro
     dele (overflow hidden, seção com rolagem) a lista saía cortada, e com uma
     ou duas cores não aparecia quase nada (simulação de 28/09/2026). */
  const [sugPos, setSugPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);
  const veuRef = useRef<HTMLDivElement | null>(null);
  const posDaLista = (el: HTMLElement) => {
    const v = veuRef.current?.getBoundingClientRect();
    if (!v || !v.width) return null;
    const s = v.width / 1920;
    const r = el.getBoundingClientRect();
    const left = (r.left - v.left) / s, width = r.width / s;
    const abaixo = (v.bottom - r.bottom) / s;
    /* perto do pé do palco, abre para cima */
    return abaixo < 300 ? { left, width, bottom: (v.bottom - r.top) / s + 6 } : { left, width, top: (r.bottom - v.top) / s + 6 };
  };
  const [pantoneIdx, setPantoneIdx] = useState<number | null>(null);
  /* a cor que o "Adicionar cor" acabou de pôr já recebe o cursor: com a lista
     rolando, ela entra à vista em vez de nascer escondida embaixo
     (simulação 5, 05/10/2026) */
  const [novaCor, setNovaCor] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  /* registrar sem arquivo de arte: pergunta uma vez antes (no rodapé) */
  const [semArte, setSemArte] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const entrada = useRef<HTMLInputElement | null>(null);

  /* Cores da prova: anexou o PDF, o hub lê a legenda "Cores" e preenche a
     lista (Augusto, 29/09/2026). Como na nota da clicheria, nada é sem volta:
     o que estava antes fica guardado para desfazer. */
  const [lendoCores, setLendoCores] = useState<string | null>(null);
  const [leitura, setLeitura] = useState<{ arquivo: string; conferir: string[]; foraDaLegenda: string[] } | null>(null);
  const [antesDaLeitura, setAntesDaLeitura] = useState<{ cores: string[]; hex: Record<number, string> } | null>(null);
  const [avisoLeitura, setAvisoLeitura] = useState("");
  /* A leitura leva alguns segundos e dá para anexar de novo no meio. Cada
     leitura tem um número; uma mais velha só não preenche se uma mais nova
     JÁ preencheu. Anexar a arte final durante a leitura da prova não joga a
     prova fora (revisão de 30/09/2026). */
  const vezDaLeitura = useRef(0);
  const vezAplicada = useRef(0);
  const lendoAgora = useRef(0);
  /* o que está na tela quando a leitura termina, não quando começou */
  const atuais = useRef({ cores, hex });
  useEffect(() => { atuais.current = { cores, hex }; });

  const lerCores = async (fs: File[]) => {
    const pdfs = fs.filter((f) => /\.(pdf|ai)$/i.test(f.name) || f.type === "application/pdf");
    if (!pdfs.length) return;
    const vez = ++vezDaLeitura.current;
    lendoAgora.current++;
    setAvisoLeitura("");
    let aviso = "";
    try {
      for (const f of pdfs) {
        setLendoCores(f.name);
        let r: LeituraDaProva;
        try {
          r = await comPrazo(lerCoresDaProva(f), PRAZO_DA_LEITURA);
        } catch (e) {
          console.warn("Leitura das cores da prova", f.name, e);
          aviso = `Não consegui ler as cores de ${f.name}. Preencha as cores à mão.`;
          continue;
        }
        if (r.ok) {
          /* uma leitura mais nova já preencheu, ou o design já está indo */
          if (vez < vezAplicada.current || emVoo.current) return;
          vezAplicada.current = vez;
          const novos: Record<number, string> = {};
          r.cores.forEach((nome, i) => { const h = corDoNome(nome); if (h) novos[i] = h; });
          setAntesDaLeitura({ cores: atuais.current.cores, hex: atuais.current.hex });
          setCores(r.cores);
          setHex(novos);
          /* a tabela ou as sugestões abertas escreveriam na casa da lista velha */
          setPantoneIdx(null);
          setSugIdx(null);
          setLeitura({ arquivo: f.name, conferir: r.conferir, foraDaLegenda: r.foraDaLegenda });
          setAvisoLeitura("");
          setSecao("cores");
          return;
        }
        if (r.motivo === "sem-legenda") aviso = `Não achei a legenda de cores em ${f.name}. Preencha as cores à mão.`;
      }
      if (aviso && vez > vezAplicada.current) setAvisoLeitura(aviso);
    } finally {
      lendoAgora.current--;
      if (lendoAgora.current === 0) setLendoCores(null);
    }
  };

  const desfazerLeitura = () => {
    if (antesDaLeitura) { setCores(antesDaLeitura.cores); setHex(antesDaLeitura.hex); }
    setAntesDaLeitura(null);
    setLeitura(null);
  };

  const preenchidas = cores.map((c) => c.trim()).filter(Boolean);
  /* Lendo a prova, registrar espera: o servidor receberia a lista de antes e
     a caixa trocaria a lista depois do clique (revisão de 30/09/2026). */
  const valido = preenchidas.length > 0 && !enviando && !lendoCores;

  /* Esc fecha, como em toda caixa do hub. */
  /* ESC fecha só esta caixa — não o painel do pedido atrás dela. */
  useEscDoTopo(true, NIVEL.caixa, fechar);

  /* Ref, não estado: `setEnviando` só vale no render seguinte, e dois
     cliques colados mandavam duas vezes. */
  const emVoo = useRef(false);
  /* Sem arquivo de arte: tem cliente que não precisa, então não trava, mas
     lembra antes de registrar (Augusto, 28/09/2026). O rodapé troca de
     texto e oferece anexar ali mesmo. */
  const enviar = (semArquivoMesmo = false) => {
    if (!valido || emVoo.current) return;
    if (!arquivos.length && !semArquivoMesmo) { setSemArte(true); return; }
    emVoo.current = true;
    setEnviando(true);
    setErroEnvio("");
    /* A caixa espera o servidor. Antes ela fechava no clique: se a entrega
       falhava, versão, cores, recado e arquivos se perdiam, e um segundo
       clique mandava duas vezes. */
    void Promise.resolve(onEnviar({ versao, cores: preenchidas, obs, arquivos }))
      .catch((e: unknown) => setErroEnvio(e instanceof Error ? e.message : "Não deu para registrar o design."))
      .finally(() => { emVoo.current = false; setEnviando(false); });
  };

  /* A bolinha acompanha o nome digitado: trocar "P 2314 C" por outro código
     deixava a bolinha da cor antiga. */
  const trocarCor = (i: number, v: string) => {
    setCores(cores.map((c, j) => (j === i ? v : c)));
    const h = corDoNome(v);
    setHex((atual) => (h ? { ...atual, [i]: h } : Object.fromEntries(Object.entries(atual).filter(([k]) => Number(k) !== i))));
  };
  const escolherHex = (i: number, nome: string, cor?: string) => {
    setCores(cores.map((c, j) => (j === i ? nome : c)));
    setHex((h) => (cor ? { ...h, [i]: cor } : Object.fromEntries(Object.entries(h).filter(([k]) => Number(k) !== i))));
  };

  const sugestoesDe = (valor: string): Sugestao[] => {
    const v = valor.trim();
    if (!v) return [];
    const achados = sugestoesPantone(v, 6);
    if (achados.some((s) => s.nome.toLowerCase() === v.toLowerCase())) return [];
    /* nome de cor de referência: as Pantones mais parecidas (ver sugestoesDoNome) */
    return sugestoesDoNome(v) ?? achados;
  };

  const resumo = lendoCores
    ? "Esperando a leitura das cores da prova…"
    : valido || preenchidas.length
      ? `${preenchidas.length} ${preenchidas.length === 1 ? "cor" : "cores"} · ${preenchidas.join(", ")}`
      : "Cores, design e observações";
  const previaRecado = obs.trim()
    ? (obs.trim().length > 46 ? `${obs.trim().slice(0, 46)}…` : obs.trim())
    : "opcional";

  return (
    <div onClick={fechar} ref={veuRef}
      /* O véu cobre o PALCO INTEIRO (1920×1080), não só a faixa do
         detalhe: estas caixas são filhas do palco, e com 616 sobrava a barra
         do topo e a faixa preta de baixo acesas — e o cartão, centrado em
         616, subia por cima do menu. */
      style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: 68, background: "rgba(37,36,37,.78)" }}>
      {pantoneIdx !== null && (
        <div onClick={(e) => e.stopPropagation()}>
          <PantoneHub10 valor={cores[pantoneIdx] ?? ""}
            fechar={() => setPantoneIdx(null)}
            onEscolher={(nome, cor) => { escolherHex(pantoneIdx, nome, cor); setPantoneIdx(null); }} />
        </div>
      )}

      {sugIdx !== null && sugPos && secao === "cores" && (() => {
        const sugs = sugestoesDe(cores[sugIdx] ?? "");
        if (!sugs.length) return null;
        const i = sugIdx;
        return (
          <div onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", left: sugPos.left, width: sugPos.width, top: sugPos.top, bottom: sugPos.bottom, zIndex: 5, display: "flex", flexDirection: "column", gap: 2, background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 12, padding: 6, boxShadow: "0 22px 44px -18px rgba(0,0,0,.5)" }}>
            {sugs.map((s) => (
              <button key={s.codigo} onMouseDown={(e) => { e.preventDefault(); escolherHex(i, s.nome, s.hex); setSugIdx(null); }}
                style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", border: 0, background: "transparent", borderRadius: 8, padding: "9px 10px", cursor: "pointer", textAlign: "left" }}>
                <span style={{ flex: "none", width: 22, height: 22, borderRadius: 6, boxShadow: `inset 0 0 0 1.5px ${PRETO}`, background: s.hex }} />
                <span style={{ flex: 1, font: `600 16px/1 ${INTER}`, color: PRETO, whiteSpace: "nowrap" }}>{s.nome}</span>
              </button>
            ))}
          </div>
        );
      })()}

      <div onClick={(e) => e.stopPropagation()}
        style={{ boxSizing: "border-box", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 720, maxHeight: ALTURA_MAXIMA, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)", fontFamily: INTER, color: PRETO }}>

        {/* ————— cabeçalho ————— */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "26px 42px 20px", flex: "none" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: `700 14px/1.25 ${INTER}`, letterSpacing: ".04em", textTransform: "uppercase", color: CINZA }}>
              {`${p.num ? `${p.num} · ` : ""}${p.cliente ?? ""}`}
            </div>
            <div style={{ ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 96", fontSize: 44, lineHeight: 1, letterSpacing: "-.035em", marginTop: 10, whiteSpace: "nowrap" }}>Design criado</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
              <span style={{ font: `800 12.5px/1 ${INTER}`, letterSpacing: ".12em", textTransform: "uppercase", color: CINZA }}>Versão</span>
              <input value={versao} onChange={(e) => setVersao(e.target.value)} placeholder="v3" aria-label="Versão da arte"
                style={{ width: 40, textAlign: "left", boxSizing: "border-box", padding: 0, border: "none", background: "none", font: `800 18px/1 ${INTER}`, color: PRETO, outline: "none" }} />
            </div>
            <button onClick={fechar} className="p10-flat" aria-label="Fechar"
              style={{ width: 46, height: 46, display: "grid", placeItems: "center", background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          </div>
        </div>

        {/* ————— cores ————— */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <button onClick={() => setSecao(secao === "cores" ? null : "cores")} className="p10-flat"
            style={{ ...FAIXA, background: AMARELO, borderTop: `1.5px solid ${PRETO}` }}>
            <span style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              <Chevron aberto={secao === "cores"} />
              <span style={TITULO_FAIXA}>Cores usadas na arte</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
              {lendoCores ? (
                <span style={{ font: `600 15.5px/1.3 ${INTER}`, color: PRETO, opacity: .75, whiteSpace: "nowrap" }}>lendo as cores da prova…</span>
              ) : (<>
              {preenchidas.length > 0 && (
                <span style={{ display: "flex", gap: 5 }}>
                  {cores.map((v, i) => (v.trim() ? (
                    <span key={i} style={{ flex: "none", width: 20, height: 20, borderRadius: 6, boxShadow: `inset 0 0 0 1.5px ${PRETO}`, background: hex[i] ?? BORDA_CAMPO }} />
                  ) : null))}
                </span>
              )}
              {/* "8 de 7" não quer dizer nada: passando do teto, o contador
                  passa a dizer só quantas são. O teto continua valendo para
                  acrescentar. */}
              <span style={{ font: `800 15px/1 ${INTER}`, color: PRETO }}>
                {cores.length > MAX_CORES
                  ? `${preenchidas.length} ${preenchidas.length === 1 ? "cor" : "cores"}`
                  : `${preenchidas.length} de ${MAX_CORES}`}
              </span>
              </>)}
            </span>
          </button>

          {/* O "Adicionar cor" fica fora da área que rola: se a lista ainda
              passar da caixa, as cores rolam e o botão continua inteiro à
              vista (simulação 5, 05/10/2026). */}
          {secao === "cores" && (
            <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div onScroll={() => { const el = document.activeElement as HTMLElement | null; if (sugIdx !== null && el?.tagName === "INPUT") setSugPos(posDaLista(el)); }} style={{ minHeight: 0, overflowY: "auto", boxSizing: "border-box", padding: "20px 42px 0" }}>
                {leitura && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
                      <span style={{ minWidth: 0, font: `600 15px/1.4 ${INTER}`, color: CINZA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        Lidas da legenda de {leitura.arquivo}.
                      </span>
                      <button onClick={desfazerLeitura} className="p10-flat"
                        style={{ flex: "none", background: "none", border: "none", padding: 0, cursor: "pointer", font: `600 15px/1 ${INTER}`, color: CINZA, textDecoration: "underline" }}>
                        Voltar às cores de antes
                      </button>
                    </div>
                    {leitura.conferir.length > 0 && (
                      <Aviso texto={`Leitura incerta: ${juntarCores(leitura.conferir)}. Confira na prova.`} />
                    )}
                    {leitura.foraDaLegenda.length > 0 && (
                      <Aviso texto={`O arquivo também tem ${juntarCores(leitura.foraDaLegenda)}, que não ${leitura.foraDaLegenda.length === 1 ? "está" : "estão"} na legenda.`} />
                    )}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px" }}>
                  {cores.map((valor, i) => {
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        {hex[i] && <span style={{ flex: "none", width: 42, height: 42, borderRadius: 12, boxShadow: `inset 0 0 0 1.5px ${PRETO}`, background: hex[i] }} />}
                        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                          {/* Digitar reabre a lista: depois de escolher uma
                              sugestão o cursor fica no campo, e escrever outro
                              nome ali não mostrava mais nada (simulação 5,
                              05/10/2026). */}
                          <input value={valor}
                            onChange={(e) => { trocarCor(i, e.target.value); if (sugIdx !== i) { setSugIdx(i); setSugPos(posDaLista(e.currentTarget)); } }}
                            autoFocus={novaCor === i}
                            onFocus={(ev) => { setSugIdx(i); setSugPos(posDaLista(ev.currentTarget)); if (novaCor !== null) setNovaCor(null); }}
                            onBlur={() => setTimeout(() => setSugIdx((atual) => (atual === i ? null : atual)), 120)}
                            placeholder={`Cor ${i + 1} · nome ou Pantone`} aria-label={`Cor ${i + 1}`}
                            style={CAMPO}
                            onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setSugIdx(null); } }} />
                        </div>
                        <button onClick={() => setPantoneIdx(i)} title="Tabela Pantone Solid Coated" aria-label={`Tabela Pantone para a cor ${i + 1}`} className="p10-flat"
                          style={{ flex: "none", width: 44, height: 44, display: "grid", placeItems: "center", border: `1.5px solid ${PRETO}`, background: "#fff", borderRadius: 999, cursor: "pointer" }}>
                          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a4 4 0 1 1 0-8h4.5a4.5 4.5 0 0 0 0-5z" /></svg>
                        </button>
                        {cores.length > 1 && (
                          <button onClick={() => { setCores(cores.filter((_, j) => j !== i)); setHex(semACor(hex, i)); }}
                            title="Remover cor" aria-label={`Remover a cor ${i + 1}`} className="p10-flat"
                            style={{ flex: "none", width: 44, height: 44, display: "grid", placeItems: "center", background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
                            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ flex: "none", padding: "14px 42px 22px" }}>
                {cores.length < MAX_CORES ? (
                  <button onClick={() => { setNovaCor(cores.length); setCores([...cores, ""]); }} className="p10-flat"
                    style={{ display: "flex", alignItems: "center", gap: 8, border: `1.5px dashed ${PRETO}`, background: "none", borderRadius: 999, padding: "12px 18px", cursor: "pointer", font: `700 16px/1 ${INTER}`, color: PRETO }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={3} strokeLinecap="round"><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                    Adicionar cor
                  </button>
                ) : (
                  <div style={{ font: `600 14px/1.4 ${INTER}`, color: CINZA }}>Máximo de {MAX_CORES} cores por arte.</div>
                )}
              </div>
            </div>
          )}

          {/* ————— anexos e observações ————— */}
          <button onClick={() => setSecao(secao === "recado" ? null : "recado")} className="p10-flat"
            style={{ ...FAIXA, background: ROXO }}>
            {/* o título não encolhe: encolhendo, ele passava por cima da
                primeira letra da prévia */}
            <span style={{ display: "flex", alignItems: "center", gap: 14, flex: "none" }}>
              <Chevron aberto={secao === "recado"} />
              <span style={TITULO_FAIXA}>Anexos e observações</span>
            </span>
            <span style={{ flex: 1, minWidth: 0, textAlign: "right", font: `600 15.5px/1.3 ${INTER}`, color: PRETO, opacity: .75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{previaRecado}</span>
          </button>

          {secao === "recado" && (
            <div style={{ minHeight: 0, overflowY: "auto", padding: "20px 42px 22px" }}>
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} aria-label="Observações"
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); enviar(); } }}
                placeholder="Ex.: ajustei a tabela nutricional para 7 pt e converti a logo em curvas."
                style={{ width: "100%", height: 112, resize: "none", boxSizing: "border-box", background: "#fff", border: `1.5px solid ${BORDA_CAMPO}`, borderRadius: 12, padding: "14px 16px", font: `500 17.5px/1.5 ${INTER}`, color: PRETO, outline: "none" }} />
              <button onClick={() => entrada.current?.click()} className="p10-flat"
                style={{ width: "100%", marginTop: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "none", border: `1.5px dashed ${PRETO}`, borderRadius: 12, padding: 16, cursor: "pointer" }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V5.5" /><path d="m8 9.5 4-4 4 4" /><path d="M4.5 16v3.5h15V16" /></svg>
                <span style={{ font: `600 16.5px/1.4 ${INTER}`, color: PRETO, textAlign: "center" }}>
                  {arquivos.length
                    ? `${arquivos.length} ${arquivos.length === 1 ? "arquivo anexado" : "arquivos anexados"} · clique para anexar mais`
                    : "Anexar a arte final (PDF, AI, CDR). Vai para a pasta do cliente"}
                </span>
              </button>
              {/* Os arquivos, um por linha, com o × para tirar o que entrou
                  por engano. Antes só se via "4 arquivos anexados" e a saída
                  era cancelar a entrega inteira (simulação 3, 30/09/2026). */}
              {arquivos.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {arquivos.map((f, i) => (
                    <div key={`${f.name}-${f.size}-${f.lastModified}`} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, font: `500 15px/1.3 ${INTER}`, color: PRETO }}>
                      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={f.name}>{f.name}</span>
                      <button onClick={() => setArquivos(arquivos.filter((_, j) => j !== i))} className="p10-flat" aria-label={`Tirar ${f.name}`}
                        style={{ flex: "none", width: 24, height: 24, display: "grid", placeItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {lendoCores && (
                <div style={{ marginTop: 12, font: `600 15px/1.4 ${INTER}`, color: CINZA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Lendo as cores de {lendoCores}…
                </div>
              )}
              {!lendoCores && avisoLeitura && <Aviso texto={avisoLeitura} />}
            </div>
          )}
        </div>

        {/* o seletor de arquivo fica fora das seções: o "Anexar arte" do
            rodapé abre ele mesmo com a seção fechada */}
        <input ref={entrada} type="file" multiple style={{ display: "none" }}
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []); e.target.value = "";
            if (!fs.length) return;
            /* o mesmo arquivo de novo (para reler as cores) não vira um segundo anexo */
            const novos = fs.filter((f) => !arquivos.some((a) => a.name === f.name && a.size === f.size && a.lastModified === f.lastModified));
            setArquivos([...arquivos, ...novos]); setSemArte(false); void lerCores(fs);
          }} />

        {erroEnvio && (
          <div role="alert" style={{ flex: "none", padding: "12px 42px", background: PALETA.perigo, color: PALETA.perigoTinta, font: `600 15px/1.4 ${INTER}` }}>{erroEnvio}</div>
        )}

        {/* ————— rodapé ————— */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 22, padding: "18px 25px", background: PRETO, flex: "none" }}>
          {semArte ? (
            <>
              <div style={{ minWidth: 0, font: `600 16px/1.45 ${INTER}`, color: "#f1f1f1", marginLeft: 20 }}>Nenhum arquivo de arte anexado. Tem cliente que não precisa; se houver arte, anexe.</div>
              <div style={{ display: "flex", alignItems: "center", gap: 11, flex: "none" }}>
                <button onClick={() => { setSecao("recado"); entrada.current?.click(); }} className="p10-flat"
                  style={{ border: "1.5px solid #555355", borderRadius: 999, padding: "14px 24px", cursor: "pointer", font: `700 17px/1 ${INTER}`, background: "none", color: "#f1f1f1", whiteSpace: "nowrap" }}>Anexar arte</button>
                <button onClick={() => enviar(true)} disabled={!valido}
                  style={{ border: `1.5px solid ${PRETO}`, borderRadius: 999, padding: "14px 28px", cursor: valido ? "pointer" : "not-allowed", font: `800 17px/1 ${INTER}`, whiteSpace: "nowrap", background: AMARELO, color: PRETO }}>
                  {enviando ? "Registrando…" : lendoCores ? "Lendo as cores…" : "Registrar sem arte"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ minWidth: 0, font: `600 16px/1.45 ${INTER}`, color: "#c9c8c6", marginLeft: 20 }}>{resumo}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 11, flex: "none" }}>
                <button onClick={fechar} className="p10-flat"
                  style={{ border: "1.5px solid #555355", borderRadius: 999, padding: "14px 24px", cursor: "pointer", font: `700 17px/1 ${INTER}`, background: "none", color: "#f1f1f1" }}>Cancelar</button>
                <button onClick={() => enviar()} disabled={!valido}
                  style={{ border: `1.5px solid ${valido ? PRETO : "#4a484a"}`, borderRadius: 999, padding: "14px 28px", cursor: valido ? "pointer" : "not-allowed", font: `800 17px/1 ${INTER}`, whiteSpace: "nowrap", background: valido ? AMARELO : "#4a484a", color: valido ? PRETO : CINZA }}>
                  {enviando ? "Registrando…" : lendoCores ? "Lendo as cores…" : "Registrar design"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
