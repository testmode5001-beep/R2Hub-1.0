// Nova arte (modal) — v3. Fonte: handoff `Nova-arte-modal v3.dc.html`.
//
// O formulário de uma página virou QUATRO ETAPAS (briefing → especificações →
// cores e acabamento → revisão). O motivo é o do handoff: a solicitação de
// design chegava pela metade e a arte parava para perguntar. Agora cada etapa
// diz o que falta, a revisão final lista as pendências e o rodapé não deixa
// avançar sem os obrigatórios daquela etapa.
//
// Diferenças do protótipo, de propósito:
//   · anexo é arquivo DE VERDADE (input file) — o protótipo usava nomes falsos;
//   · pastas, facas, Pantone e histórico vêm do hub, não de `window.R2`;
//   · o palco 1560×900 escala dentro do EstagioV1a, não da janela.
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { listPastasClientes } from "@/lib/api/clientes.functions";
import { AMARELO, INK, MONO, fr } from "../HubV1a";
import { COR_SISTEMA, FACAS } from "../dados/facas";
import { FG_SOBRE } from "../dados/facas-cilindro";
import { PANTONE_SC } from "../dados/pantone";
import { sugestoesPantone } from "../dados/pantone-busca";
import type { CadastrosV1a, TipoCadastro } from "../dados/cadastros";
import { PantoneModalV1a } from "./PantoneModalV1a";

/** O que a rota recebe para criar o pedido de verdade. */
export type NovaSolicitacaoDados = {
  cliente: string; medida: string; substrato: string; cores: string[]; obs: string; origem: string;
  /** arquivos escolhidos no formulário — a rota anexa ao pedido recém-criado */
  arquivos?: File[];
  /** faca escolhida no catálogo — a rota registra no briefing (não há coluna própria) */
  facaCod?: string;
  /** pasta da rede escolhida na lista; vazio = criar uma nova com o nome digitado */
  pasta?: string;
  /** campos completos do formulário — o que o createPedido do back-end precisa */
  detalhes?: {
    materia: string; largMateria: string; largura: string; altura: string; forma: string;
    cores: string; coresDesc: string; carreiras: string; descricao: string; linkRef: string;
    /** "1" quando a etiqueta leva tarja no verso */
    tarjaVerso?: string;
    /** "1" quando leva verniz */
    verniz?: string;
    /** "1" quando leva cold stamp */
    coldStamp?: string;
    /** "1" quando leva picote (corte pontilhado) */
    picote?: string;
  };
};

const MATERIAS = ["Papel couché", "Polietileno", "Cartão couché", "Térmico", "BOPP térmico", "BOPP metalizado", "BOPP Matte", "BOPP brilho", "BOPP removível", "Nylon resinado"];
const FORMAS = ["Retangular", "Quadrada", "Oval/Elipse", "Recorte especial", "Redonda", "GAP"];
const CORES_OPTS = ["1", "2", "3", "4", "4+PANT", "CMYK"];
const CHAVE = "r2-nova-arte-rascunho";
/** folga entre carreiras e nas bordas — o esqueleto que a faca deixa */
const ESQUELETO = 1.5;

type CampoObrigatorio = "cliente" | "descricao" | "largura" | "altura" | "carreiras" | "forma" | "materia" | "largMateria" | "cores";
const ETAPAS: { titulo: string; sub: string; campos: CampoObrigatorio[] }[] = [
  { titulo: "Briefing", sub: "O que precisa ser criado, com anexos e referências.", campos: ["cliente", "descricao"] },
  { titulo: "Especificações", sub: "Medidas e material que a produção precisa.", campos: ["largura", "altura", "carreiras", "forma", "materia", "largMateria"] },
  { titulo: "Cores e acabamento", sub: "Quantas cores, quais, e o que muda a montagem do clichê.", campos: ["cores"] },
  { titulo: "Revisão", sub: "Confira antes de mandar para a fila do design.", campos: [] },
];
const ROTULOS: Record<CampoObrigatorio, string> = {
  cliente: "Cliente", descricao: "Briefing", largura: "Largura", altura: "Altura",
  carreiras: "Carreiras", forma: "Formato", materia: "Material", largMateria: "Largura da bobina", cores: "Número de cores",
};

/** O que a rota devolve depois de criar o pedido de verdade. */
type Retorno = { num?: string; aviso?: string };

type Faca = { cod: string; medida: string; sistema: string; secao: string };
/** `file` presente = arquivo escolhido de verdade; ausente = item ilustrativo
    (faca do catálogo) que não sobe para o servidor. */
type Anexo = { nome: string; tam?: string; file?: File };

const INP: CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#f4f4f4", border: "2px solid #f4f4f4", borderRadius: 8,
  padding: "11px 13px", font: "600 15px/1.2 Inter,sans-serif", color: INK, outline: "none",
};
const CARD: CSSProperties = { background: "#fff", borderRadius: 14, padding: "22px 24px", display: "flex", flexDirection: "column", minHeight: 0 };
const TIT_CARD: CSSProperties = { font: "800 17px/1.15 Inter,sans-serif", letterSpacing: "-.01em" };
const EYEBROW: CSSProperties = { font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" };

const nf = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return r === Math.round(r) ? String(Math.round(r)) : r.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
};
const numDe = (v: string) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 9999) : 0;
};
/** maior trecho em comum entre dois nomes — usado para "pasta parecida" */
function comum(a: string, b: string) {
  const x = a.toLowerCase(), y = b.toLowerCase();
  let melhor = 0;
  const linha = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    let ant = 0;
    for (let j = 1; j <= y.length; j++) {
      const guarda = linha[j];
      linha[j] = x[i - 1] === y[j - 1] ? ant + 1 : 0;
      if (linha[j] > melhor) melhor = linha[j];
      ant = guarda;
    }
  }
  return melhor;
}
const hexPantone = (codigo: string) => {
  const alvo = String(codigo || "").trim().toLowerCase();
  const achou = PANTONE_SC.find((p) => p.c.toLowerCase() === alvo);
  return achou ? achou.h.toUpperCase() : "#d6d5d6";
};
const hexDaCor = (nome: string) => {
  const limpo = String(nome || "").replace(/^pantone\s+/i, "").trim();
  const direto = hexPantone(limpo);
  if (direto !== "#d6d5d6") return direto;
  const sug = sugestoesPantone(nome, 1);
  return sug[0]?.hex ?? "#d6d5d6";
};

export function NovaArteModalV1a({ onFechar, onEnviar, aoCriar, cadastros, podeCadastrar, aoCadastrar, pedidos = [] }: {
  onFechar: () => void;
  onEnviar: (cliente: string) => void;
  /** Precisa DEVOLVER a promessa: a tela de sucesso só aparece quando o
      servidor confirma, e o rascunho só é apagado aí. `aviso` traz o que deu
      errado depois da criação (anexo que não subiu, por exemplo). */
  aoCriar?: (dados: NovaSolicitacaoDados) => Retorno | void | Promise<Retorno | void>;
  /** listas compartilhadas (tabela `cadastros`) que somam às opções fixas */
  cadastros?: CadastrosV1a;
  /** cadastro.materiais / cadastro.medidas / cadastro.cores */
  podeCadastrar?: { materiais?: boolean; medidas?: boolean; cores?: boolean };
  aoCadastrar?: (tipo: TipoCadastro, nome: string, extra?: string | null) => Promise<unknown>;
  /** pedidos já carregados na rota — alimentam "Já pediu antes", os materiais
      mais usados e o uso de cada cor. Sem eles a modal só perde essas dicas. */
  pedidos?: any[];
}) {
  const [etapa, setEtapa] = useState(0);
  const [tentadas, setTentadas] = useState<number[]>([]);
  const [tocados, setTocados] = useState<string[]>([]);

  const [cliente, setCliente] = useState("");
  const [pasta, setPasta] = useState("");
  const [pastas, setPastas] = useState<string[]>([]);
  const [listaAberta, setListaAberta] = useState(false);
  const [materia, setMateria] = useState("");
  const [extrasMat, setExtrasMat] = useState<string[]>([]);
  const [novaMatAberta, setNovaMatAberta] = useState(false);
  const [novaMat, setNovaMat] = useState("");
  const [largMateria, setLargMateria] = useState("");
  const [largura, setLargura] = useState("");
  const [altura, setAltura] = useState("");
  const [forma, setForma] = useState("");
  const [cores, setCores] = useState("");
  const [coresDesc, setCoresDesc] = useState("");
  const [carreiras, setCarreiras] = useState("");
  const [descricao, setDescricao] = useState("");
  const [linkRef, setLinkRef] = useState("");
  const [obsMateria, setObsMateria] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [tarjaVerso, setTarjaVerso] = useState("Não");
  const [verniz, setVerniz] = useState("Não");
  const [coldStamp, setColdStamp] = useState("Não");
  const [picote, setPicote] = useState("Não");

  const [facaBusca, setFacaBusca] = useState("");
  const [facaCod, setFacaCod] = useState("");
  const [abaPantone, setAbaPantone] = useState<"tabela" | "usados">("tabela");
  const [pantoneBusca, setPantoneBusca] = useState("");
  const [sugAberta, setSugAberta] = useState(false);
  const [pantoneAberto, setPantoneAberto] = useState(false);

  const [rascunhoEm, setRascunhoEm] = useState("");
  const [bannerRascunho, setBannerRascunho] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [numeroPedido, setNumeroPedido] = useState("");
  /** o que deu errado DEPOIS de o pedido existir (anexo que não subiu) */
  const [avisoEnvio, setAvisoEnvio] = useState("");
  const [toast, setToast] = useState("");

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const palcoRef = useRef<HTMLDivElement>(null);
  const cartaoRef = useRef<HTMLDivElement>(null);

  const aviso = (t: string) => {
    setToast(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  /* ————— palco 1560×900 escalado para caber no que sobrou do estágio ————— */
  useEffect(() => {
    const ajustar = () => {
      const pai = palcoRef.current, card = cartaoRef.current;
      if (!pai || !card) return;
      const s = Math.min(1, (pai.clientWidth - 40) / 1560, (pai.clientHeight - 40) / 900);
      card.style.transform = `scale(${s})`;
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    if (palcoRef.current) ro.observe(palcoRef.current);
    if (document.fonts?.ready) void document.fonts.ready.then(ajustar);
    return () => ro.disconnect();
  }, []);

  /* ————— pastas reais da rede ————— */
  useEffect(() => {
    let vivo = true;
    listPastasClientes()
      .then((r: any) => { if (vivo) setPastas(r?.pastas ?? []); })
      .catch(() => { if (vivo) setPastas([]); });   // sem lista: dá para criar nova mesmo assim
    return () => { vivo = false; };
  }, []);

  /* ————— rascunho: recupera ao abrir ————— */
  useEffect(() => {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (!bruto) return;
      const r = JSON.parse(bruto) as { em?: string; dados?: Record<string, any> };
      const d = r?.dados;
      if (!d) return;
      /* Briefing que só tem o esqueleto do modelo não é briefing — recuperar
         isso faria a etapa 1 parecer preenchida e o design receberia títulos
         vazios. */
      const soEsqueleto = /^\s*(o que o cliente pediu:|o que é para alterar:|refer[êe]ncia:|produto:|na pr[áa]tica:|anexei:)\s*$/i;
      const brief = typeof d.descricao === "string" && d.descricao.split("\n").every((li: string) => !li.trim() || soEsqueleto.test(li)) ? "" : (d.descricao ?? "");
      setCliente(d.cliente ?? ""); setPasta(d.pasta ?? "");
      setMateria(d.materia ?? ""); setLargMateria(d.largMateria ?? "");
      setLargura(d.largura ?? ""); setAltura(d.altura ?? "");
      setForma(d.forma ?? ""); setCores(d.cores ?? ""); setCoresDesc(d.coresDesc ?? "");
      setCarreiras(d.carreiras ?? ""); setDescricao(brief); setLinkRef(d.linkRef ?? "");
      setObsMateria(d.obsMateria ?? ""); setFacaCod(d.facaCod ?? "");
      setTarjaVerso(d.tarjaVerso ?? "Não"); setVerniz(d.verniz ?? "Não");
      setColdStamp(d.coldStamp ?? "Não"); setPicote(d.picote ?? "Não");
      setEtapa(typeof d.etapa === "number" ? d.etapa : 0);
      setRascunhoEm(r.em ?? ""); setBannerRascunho(true);
    } catch { /* rascunho ilegível: começa limpo */ }
  }, []);

  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(autoTimer.current); }, []);

  const agora = () => {
    const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} às ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  /* Os ANEXOS ficam de fora do rascunho: `File` não sobrevive ao JSON e voltar
     com uma lista de nomes sem arquivo faria a tela prometer anexo que o
     servidor nunca receberia. */
  const guardar = (silencioso: boolean) => {
    const dados = {
      cliente, materia, largMateria, largura, altura, forma, cores, coresDesc, carreiras,
      obsMateria, descricao, linkRef, tarjaVerso, verniz, coldStamp, picote, pasta, etapa,
      /* a faca fica no rascunho: sem ela o formulário voltava com largura e
         altura preenchidas e a faca escolhida sumida, sem nada avisando */
      facaCod,
    };
    const em = agora();
    try { localStorage.setItem(CHAVE, JSON.stringify({ em, dados })); } catch { /* storage bloqueado */ }
    setRascunhoEm(em);
    if (!silencioso) aviso("Rascunho salvo — pode fechar e voltar depois");
  };
  const guardarRef = useRef(guardar);
  guardarRef.current = guardar;
  const autoGuardar = () => {
    clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => guardarRef.current(true), 1500);
  };

  /* ————— validação por etapa ————— */
  const valores: Record<CampoObrigatorio, string> = {
    cliente, descricao, largura, altura, carreiras, forma, materia, largMateria, cores,
  };
  const vazio = (k: CampoObrigatorio) => String(valores[k] ?? "").trim().length === 0;
  const faltamNa = (i: number) => ETAPAS[i].campos.filter(vazio);
  const erro = (k: CampoObrigatorio) => {
    const i = ETAPAS.findIndex((e) => e.campos.includes(k));
    return vazio(k) && (tentadas.includes(i) || tocados.includes(k));
  };
  const tocar = (k: CampoObrigatorio) => () => setTocados((t) => (t.includes(k) ? t : [...t, k]));
  const lab = (k: CampoObrigatorio, margem = "0 0 8px"): CSSProperties =>
    ({ display: "block", font: "600 14px/1 Inter,sans-serif", color: erro(k) ? "#c42b26" : "#5c5a5c", margin: margem });
  const inpErro = (k: CampoObrigatorio): CSSProperties =>
    (erro(k) ? { borderColor: "#c42b26", background: "#fdf0ef" } : {});
  const faltamAqui = faltamNa(etapa);
  const totalFaltam = ETAPAS.reduce((n, _e, i) => n + faltamNa(i).length, 0);
  const ultima = etapa === ETAPAS.length - 1;

  const chipStyle = (on: boolean, err: boolean, altura2: number | "auto" = 38): CSSProperties => ({
    width: "100%",
    ...(altura2 === "auto" ? { height: "100%", minHeight: 38 } : { height: altura2 }),
    display: "flex", alignItems: "center", justifyContent: "center",
    border: `2px solid ${on ? INK : err ? "#e8b3b1" : "#f4f4f4"}`, cursor: "pointer", borderRadius: 999,
    padding: "0 10px", font: "600 13px/1 Inter,sans-serif", overflow: "hidden", textOverflow: "ellipsis",
    whiteSpace: "nowrap", background: on ? INK : err ? "#fdf0ef" : "#f4f4f4", color: on ? AMARELO : "#5c5a5c",
    transition: "filter .12s ease",
  });

  /* ————— cliente: pasta da rede ————— */
  const chave = cliente.trim().toLowerCase();
  const parecidas = useMemo(() => {
    const v = cliente.trim();
    if (v.length < 2) return [];
    return pastas.filter((p) => {
      if (p.toLowerCase() === v.toLowerCase()) return false;
      const c = comum(p, v);
      return c >= 5 && c >= Math.max(p.length, v.length) / 2;
    }).slice(0, 3);
  }, [cliente, pastas]);
  const avisoCliente = useMemo(() => {
    const v = cliente.trim();
    if (v.length < 2) return { tipo: "dica" as const, texto: "A pasta na rede vem do nome do cliente — anexos e artes vão para lá." };
    if (pasta) return { tipo: "ok" as const, texto: `Os arquivos vão para a pasta ${pasta}, que já existe na rede.` };
    const exata = pastas.find((p) => p.toLowerCase() === v.toLowerCase());
    if (exata) return { tipo: "alerta" as const, acao: exata, texto: `Já existe a pasta ${exata} na rede. Confira se é o mesmo cliente.` };
    if (parecidas.length) return { tipo: "alerta" as const, texto: `Vai criar a pasta ${v}, mas já existe ${parecidas.join(", ")}.` };
    return { tipo: "novo" as const, texto: `Cliente novo: a pasta ${v} será criada na rede.` };
  }, [cliente, pasta, pastas, parecidas]);

  /* ————— histórico do cliente (pedidos já carregados na rota) ————— */
  const historico = useMemo(() => {
    if (chave.length < 2) return [];
    return pedidos
      .filter((p) => String(p.cliente ?? "").toLowerCase().includes(chave))
      .slice(0, 10)
      .map((p) => ({
        num: `#${String(p.numero).padStart(2, "0")}`,
        medida: p.tipo === "cliche" ? `CÓD ${p.codigo_produto ?? "—"}` : `${p.largura}x${p.altura} mm`,
        detalhe: `${p.materia ?? "—"} · ${p.cores ?? "?"} cores · ${p.status}`,
      }));
  }, [pedidos, chave]);

  /* ————— cores nomeadas ————— */
  const coresAtuais = useMemo(() => {
    const vistos: Record<string, boolean> = {};
    return coresDesc.split(",").map((x) => x.trim()).filter((nome) => {
      if (!nome || vistos[nome.toLowerCase()]) return false;
      vistos[nome.toLowerCase()] = true;
      return true;
    }).map((nome) => ({ nome, hex: hexDaCor(nome) }));
  }, [coresDesc]);
  const addCor = (nome: string) => {
    const atuais = coresDesc.split(",").map((x) => x.trim()).filter(Boolean);
    if (atuais.some((c) => c.toLowerCase() === nome.toLowerCase())) return;
    setCoresDesc(atuais.concat([nome]).join(", "));
    autoGuardar();
  };
  const removerCor = (i: number) => {
    setCoresDesc(coresAtuais.filter((_x, j) => j !== i).map((x) => x.nome).join(", "));
    autoGuardar();
  };
  const clientesDaCor = (nome: string) => {
    const alvo = nome.trim().toLowerCase();
    const nomes: string[] = [];
    for (const p of pedidos) {
      const lista = String(p.cores_desc ?? "").split(/[,;]/).map((c: string) => c.trim().toLowerCase());
      if (!lista.includes(alvo)) continue;
      const cli = String(p.cliente ?? "").trim();
      if (cli && !nomes.includes(cli)) nomes.push(cli);
    }
    return nomes;
  };
  const usadosNaFabrica = useMemo(() => {
    const conta: Record<string, number> = {};
    for (const p of pedidos) {
      for (const c of String(p.cores_desc ?? "").split(/[,;]/)) {
        const nome = c.trim();
        if (!nome) continue;
        conta[nome] = (conta[nome] ?? 0) + 1;
      }
    }
    const usados = Object.keys(conta)
      .map((nome) => ({ nome, vezes: conta[nome], hex: hexDaCor(nome) }))
      .sort((a, b) => b.vezes - a.vezes);
    if (usados.length) return usados.slice(0, 12);
    return ["485 C", "185 C", "300 C", "877 C", "355 C", "021 C", "2945 C", "032 C", "1235 C", "476 C", "Black 6 C", "424 C"]
      .map((c) => ({ nome: `Pantone ${c}`, vezes: 0, hex: hexPantone(c) }));
  }, [pedidos]);
  const sugCor = useMemo(() => {
    const v = coresDesc.split(",").pop()!.trim();
    if (v.length < 1) return [];
    const achados = sugestoesPantone(v, 5);
    if (achados.some((s) => s.nome.toLowerCase() === v.toLowerCase())) return [];
    return achados;
  }, [coresDesc]);

  /* ————— facas ————— */
  const facaSel = facaCod ? (FACAS as Faca[]).find((f) => f.cod === facaCod) ?? null : null;
  const facasFiltradas = useMemo(() => {
    const q = facaBusca.trim().toLowerCase().replace(/\s/g, "");
    return (FACAS as Faca[])
      .filter((f) => !q || `${f.cod} ${f.medida}`.toLowerCase().replace(/\s/g, "").includes(q))
      .slice(0, 40);
  }, [facaBusca]);
  const escolherFaca = (f: Faca) => {
    const nums = String(f.medida).match(/[\d]+(?:,[\d]+)?/g) ?? [];
    setFacaCod(f.cod); setFacaBusca("");
    if (nums[0]) setLargura(nums[0]);
    if (nums[1]) setAltura(nums[1]);
    autoGuardar();
    /* A faca NÃO vira anexo: entrava na lista como `faca-xxx.pdf` sem arquivo
       nenhum, o envio filtrava por `file` e o PDF nunca subia — a tela dizia
       "anexada" e o designer não recebia nada. O que viaja é o CÓDIGO, no
       briefing; a modal do pedido abre o desenho direto do acervo. */
    aviso(`Faca ${f.cod} escolhida — o código vai no briefing`);
  };

  /* ————— aproveitamento da bobina ————— */
  const bob = numDe(largMateria);
  const larg = numDe(largura);
  const alt = numDe(altura);
  const nCarr = Math.max(1, numDe(carreiras) || 1);
  const usado = (larg + 3) * nCarr;
  const sobra = bob > 0 ? bob - usado : 0;
  const excedeBobina = bob > 0 && usado > bob;
  const pronta = larg > 0 && numDe(carreiras) > 0;
  const cabem = bob > 0 && larg > 0 ? Math.floor(bob / (larg + 3)) : 0;
  const previa = useMemo(() => {
    const L = 268, HMAX = 196;
    const n = Math.max(1, Math.min(12, numDe(carreiras) || 1));
    const total = Math.max(usado, bob) || 1;
    const esc = L / total;
    const redondo = /redonda|oval/i.test(forma);
    const wEt = Math.max(2, larg * esc);
    const hEt = Math.max(44, Math.min(HMAX, larg > 0 && alt > 0 ? Math.min(L, wEt) * (alt / larg) : 96));
    const fino = wEt < 9;
    return {
      L, esc, hEt,
      blocos: Array.from({ length: n }, () => ({
        flex: "none" as const, alignSelf: "center" as const,
        width: Math.min(L, wEt), height: hEt, background: "#fff",
        border: `${fino ? 1 : 2}px solid ${INK}`,
        borderRadius: redondo ? 999 : fino ? 1 : 4, boxSizing: "border-box" as const,
      })),
      larguraUsada: Math.min(L, usado * esc),
      folga: Math.max(0.5, ESQUELETO * esc),
      pctUsado: bob > 0 ? Math.max(1, Math.min(100, (usado / bob) * 100)) : 100,
    };
  }, [carreiras, usado, bob, forma, larg, alt]);
  /* "Melhor bobina: X mm · N carreiras · N% de refugo" saiu daqui (28/08):
     aparecia junto do alerta de excesso e do "cabem N carreiras", três
     conselhos numéricos ao mesmo tempo, e sugeria trocar a bobina sem saber
     o que existe no estoque. O que fica é o que a pessoa consegue conferir:
     quanto está usando, quanto sobra e se excede. */

  /* ————— Pantone da grade ————— */
  const pantoneGrade = useMemo(() => {
    const marcadas = coresAtuais.map((c) => c.nome.toLowerCase());
    const marcado = (nome: string) => marcadas.includes(nome.toLowerCase());
    if (abaPantone === "usados") {
      const grade = usadosNaFabrica.map((u) => ({
        nome: u.nome, hex: u.hex, marcado: marcado(u.nome),
        nota: u.vezes > 0 ? `${u.vezes} ${u.vezes > 1 ? "pedidos" : "pedido"}` : "usada por clientes",
      }));
      for (const p of PANTONE_SC.slice(0, 40)) {
        if (grade.length >= 12) break;
        const nome = `Pantone ${p.c}`;
        if (grade.some((g) => g.nome.toLowerCase() === nome.toLowerCase())) continue;
        grade.push({ nome, hex: p.h.toUpperCase(), marcado: marcado(nome), nota: "da tabela" });
      }
      return grade;
    }
    const q = pantoneBusca.trim().toLowerCase().replace(/^pantone\s+/, "");
    const achados = q ? PANTONE_SC.filter((p) => p.c.toLowerCase().includes(q)).slice(0, 24) : PANTONE_SC.slice(0, 24);
    return achados.map((p) => ({ nome: `Pantone ${p.c}`, hex: p.h.toUpperCase(), marcado: marcado(`Pantone ${p.c}`), nota: p.h.toUpperCase() }));
  }, [abaPantone, pantoneBusca, coresAtuais, usadosNaFabrica]);

  /* ————— checklist do briefing ————— */
  const modeloLinhas = useMemo(() => ([
    ["O que o cliente te pediu?", /cliente pediu:|pediu:/i, "com as palavras dele"],
    ["O que é para alterar?", /alterar:|na pr[áa]tica:/i, "o que muda na etiqueta: tamanho, cor, posição, o que sai"],
    ["Ele te deu alguma referência?", /refer[êe]ncia:|anexei:/i, "sempre peça uma referência ou mande um modelo nosso"],
  ] as [string, RegExp, string][]).map(([rotulo, re, exemplo]) => {
    const m = descricao.match(re);
    const ok = !!m && descricao.slice(descricao.indexOf(m[0]) + m[0].length).split("\n")[0].trim().length > 2;
    return { rotulo, exemplo, ok };
  }), [descricao]);

  /* ————— navegação e envio ————— */
  const irPara = (i: number) => setEtapa(i);
  function avancar() {
    const faltam = faltamNa(etapa);
    if (faltam.length) {
      setTentadas((t) => (t.includes(etapa) ? t : [...t, etapa]));
      aviso(`Faltam: ${faltam.map((k) => ROTULOS[k]).join(", ")}`);
      return;
    }
    if (etapa < ETAPAS.length - 1) { setEtapa(etapa + 1); return; }
    const pendentes = ETAPAS.map((_e, j) => j).filter((j) => faltamNa(j).length > 0);
    if (pendentes.length) {
      setEtapa(pendentes[0]);
      setTentadas((t) => Array.from(new Set([...t, ...pendentes])));
      aviso(`Ainda faltam campos na etapa ${pendentes[0] + 1}`);
      return;
    }
    void enviar();
  }
  async function enviar() {
    if (enviando) return;
    /* Sem quem crie o pedido não existe envio: seguir daqui mostraria a tela
       de sucesso e apagaria o rascunho sem nada ter sido gravado. */
    if (!aoCriar) { aviso("Esta tela está sem ligação com o servidor — nada foi enviado."); return; }
    setEnviando(true);
    const nomes = coresAtuais.map((c) => c.nome);
    const listaCores = nomes.length
      ? nomes
      : (() => { const n = parseInt(cores, 10); return Number.isFinite(n) ? Array.from({ length: n }, (_x, i) => `Cor ${i + 1}`) : ["Preto"]; })();
    const dados: NovaSolicitacaoDados = {
      cliente: cliente.trim(),
      medida: `${largura || "?"}x${altura || "?"}`,
      substrato: materia || "—",
      cores: listaCores,
      obs: [descricao, tarjaVerso === "Sim" ? "tarja no verso" : "", verniz === "Sim" ? "verniz" : "", coldStamp === "Sim" ? "cold stamp" : "", picote === "Sim" ? "picote" : ""].filter(Boolean).join(" · "),
      origem: "vendas",
      arquivos: anexos.map((a) => a.file).filter((f): f is File => !!f),
      facaCod,
      pasta,
      detalhes: {
        materia, largMateria, largura, altura, forma, cores, coresDesc, carreiras,
        descricao: [descricao, obsMateria ? `Observações do material: ${obsMateria}` : ""].filter(Boolean).join("\n"),
        linkRef,
        tarjaVerso: tarjaVerso === "Sim" ? "1" : "0",
        verniz: verniz === "Sim" ? "1" : "0",
        coldStamp: coldStamp === "Sim" ? "1" : "0",
        picote: picote === "Sim" ? "1" : "0",
      },
    };
    try {
      /* só depois que o servidor confirma: o rascunho é apagado aqui, não
         antes — se o envio falhar, tudo o que foi digitado continua no lugar */
      const r = (await Promise.resolve(aoCriar?.(dados))) as Retorno | void;
      try { localStorage.removeItem(CHAVE); } catch { /* storage bloqueado */ }
      setNumeroPedido(r?.num ? String(r.num) : "");
      setAvisoEnvio(r?.aviso ?? "");
      setEnviado(true);
      onEnviar(cliente.trim());
    } catch (e: unknown) {
      aviso(e instanceof Error ? e.message : "Não deu para enviar a solicitação.");
    } finally {
      setEnviando(false);
    }
  }
  function limpar() {
    try { localStorage.removeItem(CHAVE); } catch { /* storage bloqueado */ }
    setEtapa(0); setTentadas([]); setTocados([]);
    setCliente(""); setPasta(""); setMateria(""); setLargMateria(""); setLargura(""); setAltura("");
    setForma(""); setCores(""); setCoresDesc(""); setCarreiras(""); setDescricao(""); setLinkRef("");
    setObsMateria(""); setAnexos([]); setFacaCod("");
    setTarjaVerso("Não"); setVerniz("Não"); setColdStamp("Não"); setPicote("Não");
    setEnviado(false); setNumeroPedido(""); setAvisoEnvio(""); setBannerRascunho(false); setRascunhoEm("");
    setFacaBusca(""); setPantoneBusca(""); setAbaPantone("tabela");
  }

  function salvarNovaMat() {
    const nome = novaMat.trim();
    if (!nome) { setNovaMatAberta(false); return; }
    setExtrasMat((x) => (x.includes(nome) ? x : [...x, nome]));
    setMateria(nome); setNovaMat(""); setNovaMatAberta(false);
    autoGuardar();
    if (podeCadastrar?.materiais && aoCadastrar) void aoCadastrar("material", nome).catch(() => {});
    aviso(`${nome} adicionada às matérias-primas`);
  }

  /* materiais = os fixos + os cadastrados na tabela `cadastros` + os digitados
     agora no "+ nova" (que só viram cadastro se a pessoa tiver permissão) */
  const materiasTodas = MATERIAS
    .concat((cadastros?.materiais ?? []).map((m) => m.nome).filter((m) => !MATERIAS.includes(m)))
    .concat(extrasMat.filter((m) => !MATERIAS.includes(m)));
  const formasTodas = FORMAS;

  const resumir = (txt: string, max: number) => {
    const limpo = txt.replace(/\s+/g, " ").trim();
    return limpo.length > max ? `${limpo.slice(0, max).trim()}…` : limpo;
  };
  const listaTxt = (arr: string[], max: number) => (arr.length <= max ? arr.join(", ") : `${arr.slice(0, max).join(", ")} +${arr.length - max}`);
  const val = (v: string, txt?: string) => ({
    valor: String(v ?? "").trim().length === 0 ? "a preencher" : (txt ?? v),
    falta: String(v ?? "").trim().length === 0,
  });
  const revisao = [
    { titulo: "Cliente e briefing", etapa: 0, itens: [
      { rotulo: "Cliente", ...val(cliente) },
      { rotulo: "Pasta na rede", ...val(cliente, pasta || (cliente ? `criar ${cliente}` : "")) },
      { rotulo: "Briefing", ...val(descricao, resumir(descricao, 90)) },
      { rotulo: "Anexos", ...val("ok", anexos.length ? listaTxt(anexos.map((x) => x.nome), 3) : "nenhum") },
    ] },
    { titulo: "Medidas e material", etapa: 1, itens: [
      { rotulo: "Etiqueta", ...val(largura && altura ? "ok" : "", `${largura || "?"} × ${altura || "?"} mm`) },
      { rotulo: "Carreiras", ...val(carreiras) },
      { rotulo: "Formato", ...val(forma) },
      { rotulo: "Material", ...val(materia) },
      { rotulo: "Largura da bobina", ...val(largMateria, largMateria ? `${largMateria} mm` : "") },
      /* a faca deixou de virar anexo falso: aparece aqui, que é onde a pessoa
         confere se o que escolheu no catálogo vai junto */
      { rotulo: "Faca", ...val("ok", facaCod || "sem faca do catálogo") },
    ] },
    { titulo: "Cores", etapa: 2, itens: [
      { rotulo: "Número de cores", ...val(cores) },
      { rotulo: "Cores nomeadas", ...val("ok", coresDesc ? listaTxt(coresDesc.split(", "), 3) : "não informadas") },
    ] },
    { titulo: "Acabamentos", etapa: 2, itens: [
      { rotulo: "Tarja no verso", ...val("ok", tarjaVerso) },
      { rotulo: "Verniz", ...val("ok", verniz) },
      { rotulo: "Cold stamp", ...val("ok", coldStamp) },
      { rotulo: "Picote", ...val("ok", picote) },
    ] },
  ];
  const pendencias = [0, 1, 2].flatMap((i) => faltamNa(i).map((k) => ({ rotulo: ROTULOS[k], etapaNome: ETAPAS[i].titulo, i })));

  return (
    <div ref={palcoRef} className="r2modal"
      style={{ position: "absolute", inset: 0, zIndex: 60, display: "grid", placeItems: "center", background: "rgba(37,36,37,.52)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", borderRadius: 14, overflow: "hidden" }}>
      <div ref={cartaoRef} role="dialog" aria-modal="true" aria-labelledby="nv-titulo"
        style={{ width: 1560, height: 900, flex: "none", transformOrigin: "center center", display: "grid", gridTemplateColumns: "292px 1fr", background: "#f1f1f1", borderRadius: 16, boxShadow: "0 50px 100px -30px rgba(0,0,0,.55)", overflow: "hidden" }}>

        {/* ————— Rail ————— */}
        <aside style={{ background: INK, padding: "28px 22px", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: "none", font: "600 12px/1.25 Inter,sans-serif", letterSpacing: ".02em", color: "#8d8b8d" }}>Solicitação de design</div>
          <div style={{ flex: "none", ...fr(72, 700), fontSize: 38, lineHeight: 1, letterSpacing: "-.03em", marginTop: 44, overflowWrap: "anywhere", color: cliente.trim() ? "#f1f1f1" : "#5c5a5c" }}>
            {cliente.trim() || "Nome do cliente"}
          </div>

          <div style={{ flex: "none", marginTop: 22 }}>
            <label htmlFor="nv-cliente" style={{ display: "block", ...EYEBROW, color: erro("cliente") ? AMARELO : "#8d8b8d", marginBottom: 9 }}>Cliente *</label>
            <div style={{ position: "relative" }}>
              <input id="nv-cliente" autoComplete="off" value={cliente} placeholder="Nome do cliente"
                onChange={(e) => { setCliente(e.target.value); setPasta(""); setListaAberta(true); autoGuardar(); }}
                onFocus={() => setListaAberta(true)}
                onBlur={() => { tocar("cliente")(); setTimeout(() => setListaAberta(false), 140); }}
                style={{ width: "100%", boxSizing: "border-box", background: "#302f30", border: `2px solid ${erro("cliente") ? AMARELO : "#302f30"}`, borderRadius: 9, padding: "11px 12px", font: "600 15px/1.2 Inter,sans-serif", color: "#f1f1f1", outline: "none" }} />
              {listaAberta && chave.length >= 2 && (
                <div className="r2sc" style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 20, maxHeight: 220, overflow: "auto", display: "flex", flexDirection: "column", gap: 2, background: "#fff", borderRadius: 10, padding: 6, boxShadow: "0 24px 44px -18px rgba(0,0,0,.55)" }}>
                  {pastas.filter((p) => p.toLowerCase().includes(chave)).slice(0, 20).map((nome) => (
                    <button key={nome} className="r2row" onMouseDown={(e) => { e.preventDefault(); setCliente(nome); setPasta(nome); setListaAberta(false); autoGuardar(); }}
                      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", border: 0, background: "transparent", borderRadius: 7, padding: "9px 10px", cursor: "pointer", textAlign: "left" }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2.4h7.4a2 2 0 0 1 2 2v8.1a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></svg>
                      <span className="truncate" style={{ flex: 1, minWidth: 0, font: "600 13.5px/1 Inter,sans-serif", color: INK }}>{nome}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={avisoCliente.tipo === "dica"
              ? { display: "flex", alignItems: "flex-start", gap: 9, marginTop: 12, font: "400 13px/1.45 Inter,sans-serif", color: "#b3b1b3" }
              : { display: "flex", alignItems: "center", gap: 9, marginTop: 12, borderRadius: 9, padding: "11px 12px", font: "500 13px/1.45 Inter,sans-serif", background: avisoCliente.tipo === "alerta" ? AMARELO : "#f4f4f4", color: INK }}>
              {avisoCliente.texto}
            </div>
            {"acao" in avisoCliente && avisoCliente.acao && (
              <button onClick={() => { setPasta(avisoCliente.acao as string); setListaAberta(false); }}
                style={{ width: "100%", marginTop: 8, border: 0, background: AMARELO, color: INK, borderRadius: 999, padding: "8px 12px", cursor: "pointer", font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".05em", textTransform: "uppercase" }}>
                Usar esta pasta
              </button>
            )}
          </div>

          <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 2, marginTop: 24 }}>
            {ETAPAS.map((e, i) => {
              const faltam = faltamNa(i).length;
              const atual = i === etapa;
              const ok = i === 3 ? totalFaltam === 0 : faltam === 0;
              return (
                <button key={e.titulo} onClick={() => irPara(i)} className="r2step"
                  style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", border: 0, borderRadius: 10, padding: "11px 12px", cursor: "pointer", background: atual ? "#302f30" : "transparent", transition: "background .12s ease" }}>
                  <span style={{ flex: "none", width: 24, height: 24, display: "grid", placeItems: "center", borderRadius: 999, font: "700 12px/1 Inter,sans-serif", background: ok ? AMARELO : atual ? "#f1f1f1" : "#3a393a", color: ok || atual ? INK : "#8d8b8d" }}>
                    {ok ? "✓" : String(i + 1)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3, textAlign: "left" }}>
                    <span style={{ font: "700 14.5px/1.1 Inter,sans-serif", letterSpacing: "-.01em", color: atual ? "#f1f1f1" : "#c9c7c9" }}>{e.titulo}</span>
                    <span style={{ font: "500 12px/1.1 Inter,sans-serif", color: ok ? "#8d8b8d" : AMARELO }}>
                      {i === 3
                        ? (totalFaltam === 0 ? "pronto para enviar" : `${totalFaltam} em aberto`)
                        : (ok ? "completo" : `${faltam} campo${faltam > 1 ? "s" : ""} faltando`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", marginTop: 26 }}>
            <div style={{ flex: "none", ...EYEBROW, marginBottom: 12 }}>Já pediu antes</div>
            {chave.length < 2 && <div style={{ font: "400 13px/1.5 Inter,sans-serif", color: "#8d8b8d" }}>Digite o cliente para ver os pedidos anteriores dele.</div>}
            {chave.length >= 2 && historico.length === 0 && <div style={{ font: "400 13px/1.5 Inter,sans-serif", color: "#8d8b8d" }}>Nenhum pedido anterior no hub.</div>}
            <div className="r2sc" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {historico.map((h) => (
                <div key={h.num} style={{ background: "#302f30", borderRadius: 9, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ font: `600 12px/1 ${MONO}`, color: AMARELO }}>{h.num}</span>
                    <span className="truncate" style={{ flex: 1, minWidth: 0, font: "600 13.5px/1.2 Inter,sans-serif", color: "#f1f1f1" }}>{h.medida}</span>
                  </div>
                  <div style={{ font: "400 12px/1.35 Inter,sans-serif", color: "#8d8b8d", marginTop: 4 }}>{h.detalhe}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: "none", marginTop: 22 }}>
            <div style={{ font: "500 12.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>{rascunhoEm ? `Rascunho salvo ${rascunhoEm}` : "Rascunho ainda não salvo"}</div>
            <button onClick={() => guardar(false)} className="r2chip"
              style={{ width: "100%", marginTop: 10, border: "1.5px solid #4a494a", background: "transparent", borderRadius: 999, padding: "10px 14px", cursor: "pointer", font: "700 12px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", color: "#f1f1f1" }}>
              Salvar rascunho
            </button>
          </div>
        </aside>

        {/* ————— Conteúdo ————— */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
          <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "28px 30px 20px" }}>
            <div style={{ minWidth: 0 }}>
              <div style={EYEBROW}>Etapa {etapa + 1} de 4</div>
              <div id="nv-titulo" style={{ ...fr(96, 700), fontSize: 34, lineHeight: 1, letterSpacing: "-.03em", marginTop: 9, color: INK }}>{ETAPAS[etapa].titulo}</div>
              <div style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d", marginTop: 8 }}>{ETAPAS[etapa].sub}</div>
            </div>
            {/* `data-esc-fechar`: é por este botão que o ESC global do hub
                (lib/esc-modal) fecha a modal. Sem a marca ele clicaria no
                fundo — e o fundo aqui NÃO fecha, de propósito, para um clique
                fora não jogar fora um formulário de quatro etapas. */}
            <button onClick={onFechar} aria-label="Fechar" data-esc-fechar className="r2ic"
              style={{ width: 38, height: 38, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          </div>

          {bannerRascunho && (
            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, background: AMARELO, borderRadius: 10, padding: "11px 16px", margin: "0 30px 14px" }}>
              <span style={{ flex: 1, font: "500 14px/1.3 Inter,sans-serif", color: INK }}>Retomamos o rascunho de {rascunhoEm || "antes"}.</span>
              <button onClick={limpar} style={{ flex: "none", border: 0, background: INK, color: AMARELO, borderRadius: 999, padding: "8px 14px", cursor: "pointer", font: "700 12px/1 Inter,sans-serif", letterSpacing: ".05em", textTransform: "uppercase" }}>Começar do zero</button>
              <button onClick={() => setBannerRascunho(false)} aria-label="Dispensar" style={{ flex: "none", width: 24, height: 24, display: "grid", placeItems: "center", background: "transparent", border: 0, cursor: "pointer" }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, padding: "0 30px" }}>

            {/* ————— Etapa 1 — Briefing ————— */}
            {etapa === 0 && (
              <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "1.35fr 0.65fr", gap: 14 }}>
                <div style={{ background: "#fff", borderRadius: 14, display: "grid", gridTemplateColumns: "1fr 316px", minHeight: 0, overflow: "hidden" }}>
                  <div style={{ display: "flex", flexDirection: "column", minHeight: 0, padding: "22px 24px" }}>
                    <div style={{ ...TIT_CARD, marginBottom: 16 }}>Briefing da arte</div>
                    <label htmlFor="nv-brief" style={lab("descricao")}>Descreva o que o cliente precisa, de forma organizada *</label>
                    <textarea id="nv-brief" value={descricao} placeholder="Descreva de forma organizada e fácil de entender o que o cliente precisa"
                      onChange={(e) => { setDescricao(e.target.value); autoGuardar(); }} onBlur={tocar("descricao")}
                      style={{ ...INP, flex: 1, minHeight: 0, resize: "none", lineHeight: 1.5, ...inpErro("descricao") }} />
                    <div style={{ font: "500 12.5px/1.4 Inter,sans-serif", marginTop: 10, color: erro("descricao") ? "#c42b26" : "#b3b1b3" }}>
                      {erro("descricao") ? "Sem briefing o design volta a perguntar — descreva ao menos o essencial." : "Quanto mais claro aqui, menos idas e voltas depois."}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", minHeight: 0, background: "#fafafa", padding: "22px 22px 20px" }}>
                    <div style={{ font: "800 12px/1.15 Inter,sans-serif", letterSpacing: ".02em", color: INK, marginBottom: 16 }}>Responda estas três perguntas</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                      {modeloLinhas.map((m) => (
                        <div key={m.rotulo} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                          <span style={{ flex: "none", width: 17, height: 17, display: "grid", placeItems: "center", borderRadius: 999, font: "700 10px/1 Inter,sans-serif", color: INK, background: m.ok ? AMARELO : "#ececec" }}>{m.ok ? "✓" : ""}</span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ font: "600 12.5px/1.2 Inter,sans-serif", color: m.ok ? INK : "#8d8b8d" }}>{m.rotulo}</span>
                            <span style={{ display: "block", font: "400 11.5px/1.4 Inter,sans-serif", color: "#b3b1b3", marginTop: 2 }}>{m.exemplo}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{ flex: 1, minHeight: 8 }} />
                    <button onClick={() => { setDescricao("O que o cliente pediu: \nO que é para alterar: \nReferência: "); autoGuardar(); }} className="r2chip"
                      style={{ flex: "none", border: "2px solid #ececec", background: "#fff", borderRadius: 999, padding: "10px 14px", cursor: "pointer", whiteSpace: "nowrap", font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".05em", textTransform: "uppercase", color: "#5c5a5c" }}>
                      Usar como referência
                    </button>
                  </div>
                </div>

                <div style={{ minHeight: 0, background: "#fff", borderRadius: 14, padding: "22px 24px", display: "flex", flexDirection: "column" }}>
                  <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <span style={{ ...TIT_CARD, whiteSpace: "nowrap" }}>Anexos e referências</span>
                    <span style={{ font: "500 13.5px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>opcional</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ font: "600 13px/1 Inter,sans-serif", color: "#8d8b8d", whiteSpace: "nowrap" }}>
                      {anexos.length === 0 ? "nenhum arquivo" : `${anexos.length} ${anexos.length > 1 ? "arquivos" : "arquivo"}`}
                    </span>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "250px 1fr", gap: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <input ref={fileRef} type="file" multiple hidden
                        onChange={(e) => {
                          const fs = Array.from(e.target.files ?? []);
                          if (fs.length) {
                            setAnexos((a) => a.concat(fs.map((f) => ({
                              nome: f.name,
                              tam: f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`,
                              file: f,
                            }))));
                          }
                          e.target.value = "";
                        }} />
                      <button onClick={() => fileRef.current?.click()}
                        style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "#fafafa", border: "2px dashed #d6d5d6", borderRadius: 10, padding: 14, cursor: "pointer" }}>
                        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V5.5" /><path d="m8 9.5 4-4 4 4" /><path d="M4.5 15.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" /></svg>
                        <span style={{ font: "600 13.5px/1.4 Inter,sans-serif", color: "#5c5a5c", textAlign: "center" }}>Anexar arquivo</span>
                      </button>
                      <input value={linkRef} onChange={(e) => { setLinkRef(e.target.value); autoGuardar(); }} style={{ ...INP, flex: "none" }} placeholder="Link de referência" />
                    </div>
                    <div style={{ minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      {anexos.length === 0 ? (
                        <div style={{ height: "100%", display: "grid", placeItems: "center", background: "#fafafa", borderRadius: 10, font: "500 14px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>Nada anexado ainda.</div>
                      ) : (
                        <div style={{ height: "100%", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gridTemplateRows: "repeat(3,1fr)", gap: 6 }}>
                          {anexos.slice(0, anexos.length > 12 ? 11 : 12).map((a, i) => (
                            <div key={`${a.nome}-${i}`} title={a.tam ? `${a.nome} · ${a.tam}` : a.nome} style={{ display: "flex", alignItems: "center", gap: 7, background: "#f4f4f4", borderRadius: 8, padding: "0 8px 0 10px", minHeight: 0 }}>
                              <span className="truncate" style={{ flex: 1, minWidth: 0, font: "500 12.5px/1.2 Inter,sans-serif", color: INK }}>{a.nome}</span>
                              <button onClick={() => setAnexos((x) => x.filter((_y, j) => j !== i))} aria-label="Remover anexo"
                                style={{ width: 20, height: 20, display: "grid", placeItems: "center", background: "transparent", border: 0, cursor: "pointer" }}>
                                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.8} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                              </button>
                            </div>
                          ))}
                          {anexos.length > 12 && (
                            <div style={{ display: "grid", placeItems: "center", background: "#ececec", borderRadius: 8, font: "700 12px/1 Inter,sans-serif", color: "#5c5a5c" }}>+{anexos.length - 11}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ————— Etapa 2 — Especificações ————— */}
            {etapa === 1 && (
              <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 1fr 320px", gap: 14 }}>
                <div style={CARD}>
                  <div style={{ ...TIT_CARD, marginBottom: 16 }}>Medidas da etiqueta</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                    {([["Largura", "largura", "80", largura, setLargura], ["Altura", "altura", "60", altura, setAltura], ["Carreiras", "carreiras", "2", carreiras, setCarreiras]] as const).map(([label, k, ph, v, set]) => (
                      <div key={k}>
                        <label style={lab(k as CampoObrigatorio)}>{label} *</label>
                        <input value={v} placeholder={ph} onBlur={tocar(k as CampoObrigatorio)}
                          onChange={(e) => { (set as (s: string) => void)(e.target.value); autoGuardar(); }}
                          style={{ ...INP, ...inpErro(k as CampoObrigatorio) }} />
                      </div>
                    ))}
                  </div>
                  <label style={lab("forma", "22px 0 10px")}>Formato *</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>
                    {formasTodas.map((f) => (
                      <button key={f} className="r2chip" onClick={() => { setForma(f); autoGuardar(); }} style={chipStyle(forma === f, erro("forma"))}>{f}</button>
                    ))}
                  </div>
                  <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", marginTop: 22 }}>
                    <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                      <span style={{ font: "600 14px/1 Inter,sans-serif", color: "#5c5a5c" }}>Faca do catálogo</span>
                      <span style={{ font: "400 12px/1 Inter,sans-serif", color: "#b3b1b3" }}>preenche as medidas</span>
                    </div>
                    {facaSel ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, background: INK, borderRadius: 9, padding: "10px 10px 10px 13px" }}>
                        <span className="truncate" style={{ flex: 1, minWidth: 0, font: "700 14px/1.2 Inter,sans-serif", color: "#f1f1f1" }}>{facaSel.medida}</span>
                        <span style={{ font: `500 12px/1 ${MONO}`, color: "#8d8b8d" }}>{facaSel.cod}</span>
                        <button onClick={() => setFacaCod("")} aria-label="Remover faca" style={{ flex: "none", width: 22, height: 22, display: "grid", placeItems: "center", background: "transparent", border: 0, cursor: "pointer" }}>
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.8} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                        </button>
                      </div>
                    ) : (
                      <input value={facaBusca} onChange={(e) => setFacaBusca(e.target.value)} style={{ ...INP, flex: "none" }} placeholder="Buscar código ou medida (ex.: 80x60)" />
                    )}
                    <div className="r2sc" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                      {!facaSel && facasFiltradas.map((f) => {
                        const bg = COR_SISTEMA[f.sistema as keyof typeof COR_SISTEMA] || "#d6d5d6";
                        return (
                          <button key={f.cod} className="r2row" onClick={() => escolherFaca(f)}
                            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", border: 0, background: "transparent", borderRadius: 8, padding: "8px 9px", cursor: "pointer" }}>
                            <span style={{ flex: "none", font: "700 10px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "5px 8px", borderRadius: 999, whiteSpace: "nowrap", background: bg, color: FG_SOBRE(bg) }}>{f.sistema}</span>
                            <span className="truncate" style={{ flex: 1, minWidth: 0, font: "600 13.5px/1.2 Inter,sans-serif", textAlign: "left", color: INK }}>{f.medida}</span>
                            <span style={{ flex: "none", font: `500 11.5px/1 ${MONO}`, color: "#b3b1b3" }}>{f.cod}</span>
                          </button>
                        );
                      })}
                      {!facaSel && facasFiltradas.length === 0 && (
                        <div style={{ padding: "14px 2px", font: "400 13px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>Nenhuma faca com esse filtro — pode digitar as medidas à mão acima.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={CARD}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span style={{ ...TIT_CARD, whiteSpace: "nowrap" }}>Matéria-prima</span>
                    <span style={{ flex: 1 }} />
                    {!novaMatAberta && (
                      <button onClick={() => setNovaMatAberta(true)} className="r2chip"
                        style={{ flex: "none", height: 26, display: "flex", alignItems: "center", border: "1.5px dashed #dcdbdc", background: "transparent", cursor: "pointer", borderRadius: 999, padding: "0 11px", font: "700 11px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", color: "#8d8b8d", whiteSpace: "nowrap" }}>+ nova</button>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>
                    {materiasTodas.map((m) => (
                      <button key={m} className="r2chip" onClick={() => { setMateria(m); autoGuardar(); }} style={chipStyle(materia === m, erro("materia"), 40)}>{m}</button>
                    ))}
                  </div>
                  {novaMatAberta && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <input value={novaMat} onChange={(e) => setNovaMat(e.target.value)} placeholder="Nome da matéria-prima"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); salvarNovaMat(); } }}
                        style={{ ...INP, flex: 1, height: 40, padding: "0 14px" }} />
                      <button onClick={salvarNovaMat} className="r2chip" style={{ flex: "none", height: 40, border: 0, background: AMARELO, borderRadius: 999, padding: "0 16px", cursor: "pointer", font: "700 12px/1 Inter,sans-serif", letterSpacing: ".05em", textTransform: "uppercase", color: INK }}>Adicionar</button>
                    </div>
                  )}
                  <label style={lab("largMateria", "18px 0 8px")}>Largura da bobina (mm) *</label>
                  <input value={largMateria} placeholder="Ex.: 620" onBlur={tocar("largMateria")}
                    onChange={(e) => { setLargMateria(e.target.value); autoGuardar(); }}
                    style={{ ...INP, ...inpErro("largMateria") }} />
                  <div style={{ font: "400 12.5px/1.5 Inter,sans-serif", color: "#b3b1b3", marginTop: 10 }}>
                    A largura da bobina define quantas carreiras cabem — confira o estoque antes de prometer prazo.
                  </div>
                  <label style={{ display: "block", font: "600 14px/1 Inter,sans-serif", color: "#5c5a5c", margin: "18px 0 8px" }}>Observações</label>
                  {/* `minHeight: 0` no textarea: é ele quem absorve a folga da
                      coluna. Com um piso fixo aqui, a soma dos blocos passava
                      da altura do card e a coluna vazava para fora do modal. */}
                  <textarea value={obsMateria} onChange={(e) => { setObsMateria(e.target.value); autoGuardar(); }}
                    style={{ ...INP, flex: 1, minHeight: 0, resize: "none", lineHeight: 1.5 }} />
                </div>

                <div style={CARD}>
                  <div style={{ ...TIT_CARD, marginBottom: 4 }}>Aproveitamento da bobina</div>
                  <div style={{ font: "400 12.5px/1.4 Inter,sans-serif", color: "#b3b1b3", marginBottom: 18 }}>Quantas etiquetas cabem lado a lado.</div>
                  <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                    <div style={{ ...fr(48, 700), fontSize: 22, lineHeight: 1.1, letterSpacing: "-.02em", color: pronta ? INK : "#b3b1b3" }}>
                      {pronta ? (cabem > 0 ? `${nCarr} de ${cabem} ${cabem > 1 ? "carreiras" : "carreira"}` : `${nCarr} ${nCarr > 1 ? "carreiras" : "carreira"}`) : "Preencha largura e carreiras"}
                    </div>
                    <div style={{ font: "500 13px/1.4 Inter,sans-serif", color: "#8d8b8d", marginTop: 6 }}>
                      {!pronta ? "A prévia mostra quantas etiquetas cabem lado a lado." : bob > 0 ? `em bobina de ${nf(bob)} mm` : "informe a largura da bobina"}
                    </div>

                    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", marginTop: 14 }}>
                      <div style={{ width: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ flex: "none", width: 1, height: 7, background: "#dcdbdc" }} />
                          <span style={{ flex: 1, height: 1, background: "#ececec" }} />
                          <span style={{ flex: "none", font: `600 10.5px/1 ${MONO}`, letterSpacing: ".04em", color: "#8d8b8d", whiteSpace: "nowrap" }}>{pronta ? `${nf(bob > 0 ? bob : usado)} mm` : "—"}</span>
                          <span style={{ flex: "none", width: 1, height: 7, background: "#dcdbdc" }} />
                        </div>
                        <div style={{ display: "flex", alignItems: "stretch", justifyContent: "flex-start", width: "100%", height: pronta ? previa.hEt + 16 : 112, borderRadius: 8, overflow: "hidden", background: "#f4f4f4" }}>
                          {pronta ? (
                            <>
                              <div style={{ alignSelf: "stretch", flex: "none", width: previa.larguraUsada, maxWidth: "100%", ...(bob > 0 && sobra < 0 ? { boxShadow: "inset -3px 0 0 #c42b26" } : {}), display: "flex", alignItems: "center", justifyContent: "space-between", gap: previa.folga, padding: previa.folga, background: AMARELO, boxSizing: "border-box" }}>
                                {previa.blocos.map((b, i) => <div key={i} style={b} />)}
                              </div>
                              {bob > 0 && sobra > 0 && (
                                <div style={{ flex: "1 1 0", minWidth: 0, alignSelf: "stretch", display: "grid", placeItems: "center", padding: 4, overflow: "hidden", background: "repeating-linear-gradient(135deg,#e4e3e4 0 6px,#f0f0f0 6px 12px)" }}>
                                  <span style={{ maxWidth: "100%", overflow: "hidden", font: "600 11px/1 Inter,sans-serif", color: "#5c5a5c", whiteSpace: "nowrap" }}>
                                    {sobra * previa.esc > 104 ? `sobra ${nf(sobra)} mm` : ""}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{ flex: 1, height: 96, borderRadius: 8, border: "2px dashed #dcdbdc" }} />
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 11 }}>
                        <span style={{ flex: "none", width: 14, height: 11, marginTop: 2, borderRadius: 3, background: AMARELO }} />
                        <span style={{ flex: 1, minWidth: 0, font: "500 12px/1.3 Inter,sans-serif", color: "#8d8b8d" }}>
                          {pronta ? `${nCarr}× ${nf(larg)} mm + esqueleto` : "Etiquetas"}
                        </span>
                        <span style={{ flex: "none", font: "700 12.5px/1.3 Inter,sans-serif", color: INK, whiteSpace: "nowrap" }}>
                          {pronta ? `${nf(usado)} mm${bob > 0 ? ` · ${Math.round(previa.pctUsado)}%` : ""}` : "—"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 6 }}>
                        <span style={{ flex: "none", width: 14, height: 11, borderRadius: 3, background: "repeating-linear-gradient(135deg,#e4e3e4 0 4px,#f0f0f0 4px 8px)" }} />
                        <span style={{ flex: 1, minWidth: 0, font: "500 12px/1.3 Inter,sans-serif", color: "#8d8b8d" }}>
                          {bob > 0 && pronta && sobra < 0 ? "Excede a bobina" : "Sobra"}
                        </span>
                        <span style={{ flex: "none", whiteSpace: "nowrap", font: "700 12.5px/1.3 Inter,sans-serif", color: bob > 0 && pronta && sobra < 0 ? "#c42b26" : "#8d8b8d" }}>
                          {bob > 0 && pronta ? `${nf(Math.abs(sobra))} mm` : "informe a bobina"}
                        </span>
                      </div>

                      {excedeBobina && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 12, background: AMARELO, borderRadius: 9, padding: "10px 12px", font: "600 12.5px/1.35 Inter,sans-serif", color: INK }}>
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><path d="M12 4.5 21 19.5H3z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>
                          <span>As carreiras somam {nf(usado)} mm e a bobina tem {nf(bob)} mm. Reduza carreiras ou peça bobina maior.</span>
                        </div>
                      )}
                      {pronta && cabem > nCarr && (
                        <button onClick={() => { setCarreiras(String(cabem)); autoGuardar(); }} className="r2chip"
                          style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", marginTop: 12, background: "#f4f4f4", border: 0, borderRadius: 9, padding: "10px 12px", cursor: "pointer", textAlign: "left", font: "600 12.5px/1.35 Inter,sans-serif", color: INK }}>
                          Cabem {cabem} carreiras nesta bobina — usar {cabem} reduz o refugo.
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ————— Etapa 3 — Cores e acabamento ————— */}
            {etapa === 2 && (
              <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 380px", gap: 14 }}>
                <div style={CARD}>
                  <div style={{ ...TIT_CARD, marginBottom: 16 }}>Cores de impressão</div>
                  <label style={lab("cores")}>Número de cores *</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6 }}>
                    {CORES_OPTS.map((c) => (
                      <button key={c} className="r2chip" onClick={() => { setCores(c); autoGuardar(); }} style={chipStyle(cores === c, erro("cores"), 42)}>{c}</button>
                    ))}
                  </div>
                  <label style={{ display: "block", font: "600 14px/1 Inter,sans-serif", color: "#5c5a5c", margin: "22px 0 8px" }}>Cores nomeadas</label>
                  <div style={{ position: "relative" }}>
                    <input value={coresDesc} placeholder="Ex.: 485, Pantone 185 C, preto"
                      onChange={(e) => { setCoresDesc(e.target.value); setSugAberta(true); autoGuardar(); }}
                      onFocus={() => setSugAberta(true)} onBlur={() => setTimeout(() => setSugAberta(false), 140)}
                      style={INP} />
                    {sugAberta && sugCor.length > 0 && (
                      <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 8, display: "flex", flexDirection: "column", gap: 2, background: "#fff", borderRadius: 10, padding: 6, boxShadow: "0 20px 40px -18px rgba(0,0,0,.45), 0 0 0 1px #ececec" }}>
                        {sugCor.map((s) => (
                          <button key={s.nome} className="r2row"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              const partes = coresDesc.split(",");
                              partes[partes.length - 1] = ` ${s.nome}`;
                              setSugAberta(false);
                              setCoresDesc(partes.join(",").replace(/^\s+/, ""));
                              autoGuardar();
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: 0, background: "transparent", borderRadius: 7, padding: "8px 9px", cursor: "pointer", textAlign: "left" }}>
                            <span style={{ flex: "none", width: 20, height: 20, borderRadius: 6, boxShadow: "inset 0 0 0 1px rgba(37,36,37,.14)", background: s.hex }} />
                            <span style={{ flex: 1, font: "600 14px/1 Inter,sans-serif", whiteSpace: "nowrap", color: INK }}>{s.nome}</span>
                            <span style={{ font: `500 12px/1 ${MONO}`, color: "#b3b1b3" }}>{s.hex}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", marginTop: 22 }}>
                    <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      {(["tabela", "usados"] as const).map((k) => (
                        <button key={k} onClick={() => setAbaPantone(k)}
                          style={{ border: 0, borderRadius: 999, padding: "9px 14px", cursor: "pointer", whiteSpace: "nowrap", font: "700 12px/1 Inter,sans-serif", letterSpacing: ".03em", background: abaPantone === k ? INK : "#f4f4f4", color: abaPantone === k ? AMARELO : "#5c5a5c" }}>
                          {k === "usados" ? "Usados por clientes" : "Buscar na tabela"}
                        </button>
                      ))}
                      <span style={{ flex: 1 }} />
                      {coresAtuais.length > 0 && (
                        <button onClick={() => { setCoresDesc(""); autoGuardar(); }}
                          style={{ border: 0, background: "transparent", cursor: "pointer", whiteSpace: "nowrap", font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".05em", textTransform: "uppercase", color: "#8d8b8d", textDecoration: "underline", textUnderlineOffset: 3 }}>
                          Desmarcar todas
                        </button>
                      )}
                      <button onClick={() => setPantoneAberto(true)}
                        style={{ border: 0, background: "transparent", cursor: "pointer", whiteSpace: "nowrap", font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".05em", textTransform: "uppercase", color: "#8d8b8d", textDecoration: "underline", textUnderlineOffset: 3 }}>
                        Tabela completa
                      </button>
                    </div>
                    {abaPantone === "tabela" && (
                      <input value={pantoneBusca} onChange={(e) => setPantoneBusca(e.target.value)} style={{ ...INP, flex: "none", marginBottom: 10 }} placeholder="Buscar código: 485, 185 C, Reflex…" />
                    )}
                    <div className="r2sc" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                        {pantoneGrade.map((p) => (
                          <button key={p.nome} className="r2row" onClick={() => addCor(p.nome)}
                            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", border: `2px solid ${p.marcado ? INK : "#f4f4f4"}`, background: p.marcado ? "#f4f4f4" : "#fff", borderRadius: 9, padding: "7px 9px", cursor: "pointer" }}>
                            <span style={{ flex: "none", width: 26, height: 26, borderRadius: 7, boxShadow: "inset 0 0 0 1px rgba(37,36,37,.16)", background: p.hex }} />
                            <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                              <span className="truncate" style={{ display: "block", font: "600 12.5px/1.15 Inter,sans-serif", color: INK }}>{p.nome}</span>
                              <span style={{ display: "block", font: "500 11px/1.15 Inter,sans-serif", color: "#b3b1b3", marginTop: 3 }}>{p.nota}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                      {pantoneGrade.length === 0 && (
                        <div style={{ padding: "16px 2px", font: "400 13px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>
                          {abaPantone === "usados" ? "Nenhum Pantone usado ainda pelos clientes." : "Nenhum código encontrado."}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
                  <div style={{ flex: "none", background: "#fff", borderRadius: 14, padding: "22px 24px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
                      <span style={TIT_CARD}>Acabamentos</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {([
                        { titulo: "Tarja no verso", ajuda: "impressão no liner", v: tarjaVerso, set: setTarjaVerso },
                        { titulo: "Verniz", ajuda: "acabamento da superfície", v: verniz, set: setVerniz },
                        { titulo: "Cold stamp", ajuda: "metalização a frio", v: coldStamp, set: setColdStamp },
                        { titulo: "Picote", ajuda: "corte pontilhado para destaque", v: picote, set: setPicote },
                      ] as const).map((ac) => (
                        <div key={ac.titulo} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", font: "700 14px/1.15 Inter,sans-serif", color: INK }}>{ac.titulo}</span>
                            <span style={{ display: "block", font: "400 12px/1.3 Inter,sans-serif", color: "#b3b1b3", marginTop: 3 }}>{ac.ajuda}</span>
                          </span>
                          <span style={{ flex: "none", display: "flex", gap: 5 }}>
                            {["Não", "Sim"].map((label) => {
                              const on = ac.v === label;
                              return (
                                <button key={label} className="r2chip" onClick={() => { ac.set(label); autoGuardar(); }}
                                  style={{ width: 62, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${on ? INK : "#f4f4f4"}`, cursor: "pointer", borderRadius: 999, font: "600 13px/1 Inter,sans-serif", background: on ? INK : "#f4f4f4", color: on ? AMARELO : "#5c5a5c" }}>
                                  {label}
                                </button>
                              );
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ flex: 1, minHeight: 0, background: "#fff", borderRadius: 14, padding: "22px 24px", display: "flex", flexDirection: "column" }}>
                    <div style={{ flex: "none", ...EYEBROW, marginBottom: 12 }}>Cores deste pedido</div>
                    {coresAtuais.length === 0 && (
                      <div style={{ font: "500 14px/1.5 Inter,sans-serif", color: "#b3b1b3" }}>
                        {cores ? `${cores} cor(es) — nomeie para o design não escolher por aproximação.` : "Nenhuma cor escolhida ainda."}
                      </div>
                    )}
                    <div style={{ minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 5 }}>
                      {coresAtuais.slice(0, 8).map((c, idx) => {
                        const clientes = clientesDaCor(c.nome);
                        const primeiro = clientes[0];
                        const extra = clientes.length > 1 ? ` e mais ${clientes.length - 1}` : "";
                        return (
                          <div key={c.nome} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <span style={{ flex: "none", width: 24, height: 24, borderRadius: 7, boxShadow: "inset 0 0 0 1px rgba(37,36,37,.16)", background: c.hex }} />
                            <span className="truncate" style={{ flex: "none", width: 104, font: "700 12.5px/1.2 Inter,sans-serif", color: INK }}>{c.nome}</span>
                            <span className="truncate" style={{ flex: 1, minWidth: 0, font: "500 11.5px/1.3 Inter,sans-serif", color: primeiro ? "#5c5a5c" : "#b3b1b3" }}>
                              {primeiro ? primeiro + extra : "primeira vez"}
                            </span>
                            <button onClick={() => removerCor(idx)} aria-label="Remover cor" style={{ flex: "none", width: 18, height: 18, display: "grid", placeItems: "center", background: "transparent", border: 0, cursor: "pointer" }}>
                              <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#b3b1b3" strokeWidth={3} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                            </button>
                          </div>
                        );
                      })}
                      {coresAtuais.length > 8 && (
                        <div style={{ font: "600 12px/1.2 Inter,sans-serif", color: "#8d8b8d", marginTop: 3 }}>+{coresAtuais.length - 8} outras cores nomeadas</div>
                      )}
                    </div>
                    <div style={{ flex: 1, minHeight: 6 }} />
                    <div style={{ font: "400 13px/1.5 Inter,sans-serif", color: "#b3b1b3", marginTop: 16 }}>
                      Cada cor extra é um clichê a mais. Sem o código Pantone o design escolhe por aproximação e a cor pode sair diferente da embalagem anterior.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ————— Etapa 4 — Revisão ————— */}
            {etapa === 3 && (
              /* `minmax(0,1fr)` e não `minmax(min-content,1fr)`: com o mínimo
                 em min-content a linha não encolhe abaixo do conteúdo, e uma
                 lista comprida de pendências (formulário vazio = 9 itens)
                 empurrava a grade para fora do modal, por baixo do rodapé.
                 Agora as linhas cedem e quem rola é a lista, dentro do card. */
              <div style={{ height: "100%", display: "grid", gridTemplateColumns: "repeat(2,1fr)", gridTemplateRows: "repeat(3,minmax(0,1fr))", gap: 14, minHeight: 0 }}>
                {revisao.map((bloco) => (
                  /* Espaçamento apertado de propósito: os quatro cards têm
                     conteúdo de tamanho FIXO (no máximo 5 linhas) e não podem
                     precisar de rolagem. O aperto é o que garante que caibam
                     mesmo com o banner de rascunho ocupando uma faixa no topo. */
                  <div key={bloco.titulo} style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", minHeight: 0 }}>
                    <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ font: "700 10.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d", whiteSpace: "nowrap" }}>{bloco.titulo}</span>
                      <span style={{ flex: 1 }} />
                      <button onClick={() => irPara(bloco.etapa)} className="r2chip"
                        style={{ border: 0, background: "transparent", borderRadius: 999, padding: "4px 0", cursor: "pointer", font: "700 11px/1 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "#b3b1b3", textDecoration: "underline", textUnderlineOffset: 3 }}>
                        editar
                      </button>
                    </div>
                    <div className="r2sc" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 8 }}>
                      {bloco.itens.map((it) => (
                        <div key={it.rotulo} style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                          <span style={{ flex: "0 0 112px", font: "500 12px/1.3 Inter,sans-serif", color: "#b3b1b3" }}>{it.rotulo}</span>
                          <span className="truncate" title={it.valor} style={{ flex: 1, minWidth: 0, font: "600 14px/1.3 Inter,sans-serif", letterSpacing: "-.005em", color: it.falta ? "#c42b26" : INK }}>{it.valor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div style={{ gridColumn: "1 / -1", minHeight: 0, display: "grid", gridTemplateColumns: pendencias.length ? "1fr 1fr" : "1fr", gap: 14 }}>
                  {pendencias.length > 0 && (
                    <div style={{ background: AMARELO, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", minHeight: 0 }}>
                      <div style={{ flex: "none", font: "800 15px/1.15 Inter,sans-serif", letterSpacing: "-.01em", color: INK }}>Falta preencher antes de enviar</div>
                      {/* Duas colunas: com o formulário vazio são 9 pendências,
                          e em coluna única elas não cabiam no card — sobrava
                          rolagem justamente na lista que a pessoa precisa ler
                          inteira antes de enviar. */}
                      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gridAutoRows: "min-content", alignContent: pendencias.length > 4 ? "start" : "center", gap: "4px 8px", padding: "10px 0" }}>
                        {pendencias.map((p) => (
                          <button key={p.rotulo} onClick={() => irPara(p.i)} className="r2row"
                            style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, border: 0, background: "transparent", borderRadius: 8, padding: "6px 8px", cursor: "pointer", textAlign: "left" }}>
                            <span className="truncate" style={{ flex: 1, minWidth: 0, font: "700 13px/1.2 Inter,sans-serif", color: INK }}>{p.rotulo}</span>
                            <span style={{ flex: "none", font: "600 11px/1.2 Inter,sans-serif", color: "#6b6300", whiteSpace: "nowrap" }}>{p.etapaNome}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", minHeight: 0 }}>
                    <div style={{ flex: "none", font: "800 15px/1.15 Inter,sans-serif", letterSpacing: "-.01em", color: INK }}>Depois de enviar</div>
                    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, padding: "10px 0" }}>
                      {[
                        "O pedido entra na fila do design com a pasta do cliente já criada na rede.",
                        "O designer só recebe o que está aqui — se faltar informação, a arte para e volta para você.",
                        "A arte volta para sua aprovação antes de seguir para o clichê.",
                      ].map((texto, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                          <span style={{ flex: "none", width: 18, font: `700 12px/1.4 ${MONO}`, color: "#b3b1b3" }}>{i + 1}</span>
                          <span style={{ flex: 1, minWidth: 0, font: "500 13px/1.4 Inter,sans-serif", color: "#5c5a5c" }}>{texto}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "20px 30px 26px" }}>
            <span style={{ flex: 1, minWidth: 0, font: "500 14px/1.4 Inter,sans-serif", color: faltamAqui.length && tentadas.includes(etapa) ? "#c42b26" : "#8d8b8d" }}>
              {faltamAqui.length
                ? `Faltam nesta etapa: ${faltamAqui.map((k) => ROTULOS[k]).join(", ")}`
                : totalFaltam === 0 ? "Tudo pronto — a arte entra na fila do design." : `Etapa completa. Ainda faltam ${totalFaltam} campos em outras etapas.`}
            </span>
            <button onClick={onFechar} className="r2chip" style={{ background: "transparent", border: 0, borderRadius: 8, padding: "14px 18px", font: "600 14.5px/1 Inter,sans-serif", color: "#8d8b8d", cursor: "pointer" }}>Cancelar</button>
            <button onClick={() => { if (etapa > 0) irPara(etapa - 1); }} className="r2chip"
              style={{ border: "2px solid #e0dfe0", background: "transparent", borderRadius: 8, padding: "13px 20px", font: "600 14.5px/1 Inter,sans-serif", color: etapa === 0 ? "#c9c7c9" : INK, cursor: etapa === 0 ? "not-allowed" : "pointer" }}>
              Voltar
            </button>
            <button onClick={avancar} disabled={enviando} className="r2chip"
              style={{ border: 0, borderRadius: 8, padding: "15px 26px", whiteSpace: "nowrap", font: "700 14.5px/1 Inter,sans-serif", cursor: enviando ? "progress" : "pointer", opacity: enviando ? 0.6 : 1, background: ultima ? AMARELO : INK, color: ultima ? INK : AMARELO }}>
              {enviando ? "Enviando…" : ultima ? "Enviar solicitação" : "Continuar"}
            </button>
          </div>
        </div>

        {enviado && (
          <div style={{ position: "absolute", inset: 0, zIndex: 90, display: "grid", placeItems: "center", background: "rgba(37,36,37,.62)" }}>
            <div style={{ width: 520, background: "#fff", borderRadius: 16, padding: 40, textAlign: "center" }}>
              <div style={{ width: 58, height: 58, borderRadius: 999, background: AMARELO, display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
                <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
              </div>
              <div style={{ ...fr(72, 700), fontSize: 30, lineHeight: 1.05, letterSpacing: "-.02em", color: INK }}>
                {numeroPedido ? `Pedido ${numeroPedido} criado` : "Solicitação enviada"}
              </div>
              <div style={{ font: "400 15px/1.55 Inter,sans-serif", color: "#5c5a5c", marginTop: 12 }}>
                {cliente || "O cliente"} · {largura || "?"}×{altura || "?"} mm. Está na fila do design com status Aguardando Design.
              </div>
              {!!avisoEnvio && (
                <div style={{ marginTop: 14, background: "#fdf0ef", borderRadius: 10, padding: "12px 14px", font: "500 13.5px/1.5 Inter,sans-serif", color: "#c42b26", textAlign: "left" }}>
                  {avisoEnvio}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 26 }}>
                <button onClick={limpar} className="r2chip" style={{ border: "2px solid #e6e6e6", background: "transparent", borderRadius: 8, padding: "14px 20px", font: "600 15px/1 Inter,sans-serif", color: INK, cursor: "pointer" }}>Nova solicitação</button>
                <button onClick={onFechar} className="r2chip" style={{ border: 0, background: INK, color: AMARELO, borderRadius: 8, padding: "14px 22px", font: "700 15px/1 Inter,sans-serif", cursor: "pointer" }}>Fechar</button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div role="status" style={{ position: "absolute", left: "calc(50% + 146px)", bottom: 92, transform: "translateX(-50%)", zIndex: 95, background: INK, color: "#f1f1f1", borderRadius: 999, padding: "13px 22px", font: "600 14px/1 Inter,sans-serif", whiteSpace: "nowrap" }}>
            {toast}
          </div>
        )}
      </div>

      {/* `multiplo`: um pedido leva VÁRIAS cores, e fechar a tabela a cada
          escolha obrigava a reabrir para a próxima. Assim ela segue aberta,
          acumula, e quem fecha é o botão "Pronto · N" dela mesma. */}
      {pantoneAberto && (
        <PantoneModalV1a
          multiplo
          fechar={() => setPantoneAberto(false)}
          onEscolher={(nome: string) => addCor(nome)}
        />
      )}
    </div>
  );
}
