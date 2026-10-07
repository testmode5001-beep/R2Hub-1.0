// Resultados da busca do TOPO — a que vale para o hub inteiro, não só para a
// tela aberta (era a queixa: procurar um pedido estando na Home não achava
// nada). Cai abaixo do campo, agrupada por onde a coisa mora.
//
// Os catálogos pesados (facas e Pantone) entram por `import()` na primeira
// busca: não faz sentido carregar 3.223 cores para quem só abre a Home.
import { useEffect, useMemo, useRef, useState } from "react";

import { criarBusca, normalizarBusca } from "@/lib/busca";
import { semearBusca } from "@/lib/busca-semente";

const INK = "#252425";
const MONO = "ui-monospace, Menlo, monospace";

export type PedidoBusca = {
  id: string; numero: number; cliente: string; status: string;
  medida?: string; substrato?: string; tipo?: string;
};

type FacaLeve = { cod: string; medida: string; sistema: string; secao: string };
type CorLeve = { codigo: string; hex: string };
/** Pasta do arquivo FÍSICO: nome do cliente, número e onde está guardada. */
type PastaLeve = { nome: string; codigo: number; gaveta: string; pasta: string; vaga: boolean };

type Achado =
  | { grupo: "Pedidos"; chave: string; titulo: string; detalhe: string; acao: () => void }
  | { grupo: "Clientes"; chave: string; titulo: string; detalhe: string; acao: () => void }
  | { grupo: "Arquivo"; chave: string; titulo: string; detalhe: string; acao: () => void }
  | { grupo: "Facas"; chave: string; titulo: string; detalhe: string; acao: () => void }
  | { grupo: "Pantone"; chave: string; titulo: string; detalhe: string; cor: string; acao: () => void }
  | { grupo: "Páginas"; chave: string; titulo: string; detalhe: string; acao: () => void };

const LIMITE_GRUPO = 5;

export function BuscaGlobalV1a({ consulta, pedidos, paginas, aoAbrirPedido, aoNavegar, aoFechar, alinhar = "esquerda" }: {
  consulta: string;
  /** "direita": a caixa cresce para a esquerda do campo (no 1.0 o campo fica
      perto da borda e a caixa saía da tela) */
  alinhar?: "esquerda" | "direita";
  pedidos?: PedidoBusca[];
  /** páginas que esta pessoa pode abrir (o rail já filtra por permissão) */
  paginas?: string[];
  aoAbrirPedido?: (id: string) => void;
  aoNavegar?: (pagina: string) => void;
  aoFechar: () => void;
}) {
  const [facas, setFacas] = useState<FacaLeve[] | null>(null);
  const [cores, setCores] = useState<CorLeve[] | null>(null);
  /* Nomes das pastas de cliente na rede. Vem do servidor (não é catálogo em
     código como facas e Pantone), e só para quem pode abrir a tela Clientes. */
  const [clientes, setClientes] = useState<string[] | null>(null);
  /* Arquivo físico: 1.900 pastas nas gavetas. Também vem do banco, e também só
     para quem pode abrir a tela (vendas não vê o acervo desde 14/08/2026). */
  const [arquivo, setArquivo] = useState<PastaLeve[] | null>(null);
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const podeClientes = !!paginas?.includes("Clientes");
  const podeArquivo = !!paginas?.includes("Arquivos");

  /* catálogos sob demanda — uma vez por sessão da página */
  useEffect(() => {
    let vivo = true;
    if (!facas) {
      void import("./dados/facas").then((m) => {
        if (vivo) setFacas(m.FACAS.map((f: any) => ({ cod: f.cod, medida: f.medida, sistema: f.sistema, secao: f.secao })));
      }).catch(() => { /* sem catálogo: os outros grupos seguem */ });
    }
    if (!cores) {
      void import("./dados/pantone").then((m) => {
        if (vivo) setCores(m.PANTONE_SC.map((c: any) => ({ codigo: c.c, hex: c.h })));
      }).catch(() => { /* idem */ });
    }
    if (!clientes && podeClientes) {
      void import("@/lib/api/clientes.functions")
        .then((m) => m.listPastasClientes())
        .then((r: { pastas: string[] }) => { if (vivo) setClientes(r.pastas ?? []); })
        .catch(() => { if (vivo) setClientes([]); /* rede fora: os outros grupos seguem */ });
    }
    if (!arquivo && podeArquivo) {
      void import("@/lib/api/arquivo.functions")
        .then((m) => m.listArquivo())
        .then((r: { linhas: Record<string, unknown>[] }) => {
          if (!vivo) return;
          setArquivo((r.linhas ?? []).map((l) => ({
            nome: String(l.nome ?? ""),
            codigo: Number(l.codigo ?? 0),
            gaveta: String(l.gaveta ?? ""),
            pasta: String(l.pasta ?? ""),
            vaga: !!l.vaga,
          })));
        })
        .catch(() => { if (vivo) setArquivo([]); });
    }
    return () => { vivo = false; };
  }, [facas, cores, clientes, podeClientes, arquivo, podeArquivo]);

  /* Esc fecha; Enter abre o primeiro; clique fora fecha.
     O Esc é marcado como usado: sem isso ele seguia para a pilha de ESC das
     telas 1.0 e fechava também o painel aberto atrás da busca (simulação de
     28/09/2026). */
  const primeiro = useRef<(() => void) | null>(null);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); aoFechar(); }
      if (e.key === "Enter" && primeiro.current) { e.preventDefault(); primeiro.current(); }
    };
    const clique = (e: MouseEvent) => {
      const el = caixaRef.current;
      if (el && !el.contains(e.target as Node)) aoFechar();
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("mousedown", clique);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("mousedown", clique);
    };
  }, [aoFechar]);

  const achados = useMemo<Achado[]>(() => {
    const q = consulta.trim();
    if (q.length < 2) return [];
    const casa = criarBusca(q);
    const lista: Achado[] = [];

    /* O que bate por inteiro vem antes do que só começa igual, e este antes
       do que só contém: "286" era a 286 C perdida entre 2860, 2865...; "#4"
       era o #42 atrás do #04. A ordem do catálogo fica dentro de cada nível. */
    const qJunto = normalizarBusca(q).replace(/ /g, "").replace(/^#/, "");
    const nivelPara = (qj: string) => (codigo: string) => {
      const c = normalizarBusca(codigo).replace(/ /g, "").replace(/^#/, "");
      if (c === qj || c.replace(/c$/, "") === qj) return 0;
      /* palavra inteira também é exata: "021" é a Orange 021 C */
      if (normalizarBusca(codigo).replace(/ c$/, "").split(" ").includes(qj)) return 0;
      return c.startsWith(qj) ? 1 : 2;
    };
    const nivel = nivelPara(qJunto);
    /* O Pantone escrito como o hub escreve ("P 286 C", do Copiar e do Design
       criado) ou por extenso ("Pantone 286"): o prefixo não faz parte do
       código da tabela, e sem tirar ele nada casava (simulação 3, 30/09/2026). */
    const qCor = q.replace(/^\s*(?:pantone|p)\s+(?=\S)/i, "");
    const casaCor = criarBusca(qCor);
    const nivelCor = nivelPara(normalizarBusca(qCor).replace(/ /g, "").replace(/^#/, ""));
    /* A faca serve deitada: "30x40" é a 40×30 (como no Ver todos e no Novo
       pedido; o topo só achava na ordem escrita). */
    const deitada = (m?: string) => {
      const x = /^\s*([\d.,]+)\s*[x×]\s*([\d.,]+)/i.exec(m ?? "");
      return x ? `${x[2]}x${x[1]}` : undefined;
    };
    const primeiroOsExatos = <T,>(itens: T[], codigo: (x: T) => string, nivelDe: (x: T) => number = (x) => nivel(codigo(x))) =>
      itens.map((x, i) => ({ x, i, n: nivelDe(x) }))
        .sort((a, b) => a.n - b.n || a.i - b.i)
        .map((o) => o.x);
    /* Hex só quando a busca é um hex de verdade: "#42" é o pedido 42, e não
       as cores cujo hex começa com #42. */
    const buscaHex = /^#?[0-9a-f]{6}$/i.test(q) || /^#[0-9a-f]*[a-f][0-9a-f]*$/i.test(q);

    /* as duas grafias do número: "#2" e "#02" (é como o hub escreve) */
    const numeroDigitado = /^\d+$/.test(qJunto) ? Number(qJunto) : null;
    primeiroOsExatos((pedidos ?? []).filter((p) => (numeroDigitado != null && p.numero === numeroDigitado) ||
      casa(`#${p.numero}`, `#${String(p.numero).padStart(2, "0")}`, String(p.numero), p.cliente, p.status, p.medida, deitada(p.medida), p.substrato, p.tipo)),
    (p) => String(p.numero), (p) => (numeroDigitado != null && p.numero === numeroDigitado ? 0 : 1)).forEach((p) => {
      if (lista.filter((a) => a.grupo === "Pedidos").length >= LIMITE_GRUPO) return;
      lista.push({
        grupo: "Pedidos",
        chave: "p" + p.id,
        titulo: `#${String(p.numero).padStart(2, "0")} · ${p.cliente || "sem cliente"}`,
        detalhe: [p.status, p.medida, p.substrato].filter(Boolean).join(" · "),
        acao: () => { aoFechar(); aoAbrirPedido?.(p.id); },
      });
    });

    /* A pasta do cliente na rede. Vem logo depois dos pedidos porque é o que
       mais se procura: "santa luzia" quase sempre é "cadê a arte dela". */
    (clientes ?? []).forEach((nome) => {
      if (lista.filter((a) => a.grupo === "Clientes").length >= LIMITE_GRUPO) return;
      if (!casa(nome)) return;
      lista.push({
        grupo: "Clientes",
        chave: "cl" + nome,
        titulo: nome,
        detalhe: "pasta na rede · artes do cliente",
        acao: () => { aoFechar(); semearBusca(nome); aoNavegar?.("Clientes"); },
      });
    });

    /* Arquivo físico: acha pelo nome, pelo número (1061), pela pasta (A5-1061)
       e pela gaveta ("gaveta b" lista as pastas dela). Pasta vaga entra também
       — quem procura onde GUARDAR uma pasta nova precisa achar as vazias. */
    (arquivo ?? []).forEach((p) => {
      if (lista.filter((a) => a.grupo === "Arquivo").length >= LIMITE_GRUPO) return;
      if (!casa(p.nome, String(p.codigo), p.pasta, p.gaveta)) return;
      lista.push({
        grupo: "Arquivo",
        chave: "ar" + p.pasta + p.codigo,
        titulo: p.vaga ? `${p.pasta || p.codigo} · pasta vaga` : p.nome || String(p.codigo),
        detalhe: [p.pasta, p.gaveta].filter(Boolean).join(" · ") || "sem gaveta",
        acao: () => { aoFechar(); semearBusca(p.vaga ? p.pasta : p.nome); aoNavegar?.("Arquivos"); },
      });
    });

    /* Medida digitada: a faca exata vem primeiro, depois a que começa igual, por
       último a deitada, como na tela Facas (simulação 5: "100x50" trazia a
       50×100 antes da 100×50). Sem medida, vale o nível do código. */
    const soMedida = (m?: string) => normalizarBusca(m ?? "").replace(/ /g, "").replace(/×/g, "x");
    const medidaQ = /^\s*[\d.,]+\s*[x×]\s*[\d.,]+/i.test(q) ? soMedida(q) : "";
    const nivelFaca = (f: FacaLeve) => {
      if (!medidaQ) return nivel(f.cod);
      const m = soMedida(f.medida);
      if (m === medidaQ) return 0;
      if (m.startsWith(medidaQ)) return 1;
      const dt = soMedida(deitada(f.medida));
      return dt === medidaQ || dt.startsWith(medidaQ) ? 2 : 3;
    };
    primeiroOsExatos((facas ?? []).filter((f) => casa(f.cod, f.medida, deitada(f.medida), f.sistema, f.secao)), (f) => f.cod, nivelFaca).forEach((f) => {
      if (lista.filter((a) => a.grupo === "Facas").length >= LIMITE_GRUPO) return;
      lista.push({
        grupo: "Facas",
        chave: "f" + f.cod,
        titulo: f.medida,
        detalhe: `${f.cod} · ${f.sistema}${f.secao ? " · " + f.secao : ""}`,
        acao: () => { aoFechar(); semearBusca(f.cod); aoNavegar?.("Facas"); },
      });
    });

    primeiroOsExatos((cores ?? []).filter((c) => casaCor(c.codigo, buscaHex ? c.hex : undefined)), (c) => c.codigo, (c) => nivelCor(c.codigo)).forEach((c) => {
      if (lista.filter((a) => a.grupo === "Pantone").length >= LIMITE_GRUPO) return;
      lista.push({
        grupo: "Pantone",
        chave: "c" + c.codigo,
        titulo: c.codigo,
        detalhe: c.hex,
        cor: c.hex,
        acao: () => { aoFechar(); semearBusca(c.codigo); aoNavegar?.("Pantone"); },
      });
    });

    (paginas ?? []).forEach((pg) => {
      if (lista.filter((a) => a.grupo === "Páginas").length >= 3) return;
      if (!casa(pg)) return;
      lista.push({
        grupo: "Páginas",
        chave: "t" + pg,
        titulo: pg,
        detalhe: "abrir a página",
        acao: () => { aoFechar(); aoNavegar?.(pg); },
      });
    });

    return lista;
  }, [consulta, pedidos, clientes, arquivo, facas, cores, paginas, aoAbrirPedido, aoNavegar, aoFechar]);

  primeiro.current = achados.length ? achados[0].acao : null;

  if (consulta.trim().length < 2) return null;

  const grupos = ["Pedidos", "Clientes", "Arquivo", "Facas", "Pantone", "Páginas"] as const;
  const carregando = !facas || !cores || (podeClientes && !clientes) || (podeArquivo && !arquivo);

  return (
    <div ref={caixaRef}
      style={{
        position: "absolute", top: "calc(100% + 8px)", ...(alinhar === "direita" ? { right: 0 } : { left: 0 }), width: 520, zIndex: 40,
        maxHeight: 460, overflowY: "auto", background: "#fff", borderRadius: 12, padding: 8,
        boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 40px 70px -30px rgba(0,0,0,.45)",
      }}>
      {achados.length === 0 && (
        <div style={{ padding: "18px 14px", font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>
          {carregando ? "Procurando no hub inteiro…" : `Nada encontrado para "${consulta.trim()}".`}
        </div>
      )}

      {grupos.map((g) => {
        const doGrupo = achados.filter((a) => a.grupo === g);
        if (!doGrupo.length) return null;
        return (
          <div key={g} style={{ marginBottom: 4 }}>
            <div style={{ font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#b3b1b3", padding: "10px 12px 8px" }}>{g}</div>
            {doGrupo.map((a) => (
              <button key={a.chave} onClick={a.acao} className="r2chip"
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "transparent", border: 0, borderRadius: 8, padding: "10px 12px", cursor: "pointer" }}>
                {a.grupo === "Pantone" && (
                  <span style={{ flex: "none", width: 26, height: 26, borderRadius: 6, background: a.cor, boxShadow: "inset 0 0 0 1px rgba(37,36,37,.14)" }} />
                )}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", font: "700 15px/1.2 Inter,sans-serif", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.titulo}</span>
                  <span style={{ display: "block", font: `400 13px/1.3 ${MONO}`, color: "#8d8b8d", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detalhe}</span>
                </span>
                <span style={{ flex: "none", width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: 999, background: "#f1f1f1" }}>
                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 17.5 17.5 6.5" /><path d="M9.5 6.5h8v8" /></svg>
                </span>
              </button>
            ))}
          </div>
        );
      })}

      {achados.length > 0 && (
        <div style={{ borderTop: "1px solid #f1f1f1", margin: "6px 4px 2px", padding: "10px 8px 6px", font: "400 12.5px/1.3 Inter,sans-serif", color: "#b3b1b3" }}>
          Enter abre o primeiro · Esc fecha · pedido abre na hora, faca e cor abrem a página já filtrada
        </div>
      )}
    </div>
  );
}
