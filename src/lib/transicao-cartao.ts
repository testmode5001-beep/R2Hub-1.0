// Entrar e sair dos cartões (Augusto, 07/10/2026: "adicione transições ao
// entrar e sair dos cards"). Começa em Pedidos: abrir um pedido pelo cartão
// e fechar o pedido aberto. Três jeitos para ele provar no hub de teste, como
// fez com a transição das páginas; Alt+K troca e o nome aparece no canto. O
// escolhido fica (e vai para as capas), os outros saem.
//
// - Cartão à frente: o cartão clicado anda até a c1, onde o cartão do pedido
//   aberto mora, os outros descem e somem, e os painéis sobem um depois do
//   outro com a mola das páginas. Ao fechar, os painéis descem, o cartão
//   volta ao lugar dele na trilha e os outros sobem com a mola.
// - Escada: os cartões da trilha descem em escada e o pedido aberto sobe em
//   escada com a mola (o cartão do pedido e os painéis). Ao fechar, o
//   inverso.
// - Zoom do cartão: o pedido aberto cresce a partir do cartão clicado, e ao
//   fechar encolhe de volta para ele.
//
// Tudo com a Web Animations API, em pixels do palco (1920 x 1080): o palco em
// escala não muda a conta. Movimento reduzido no sistema desliga.

export type JeitoDoCartao = "frente" | "escada" | "zoom";
const JEITOS: JeitoDoCartao[] = ["frente", "escada", "zoom"];
const NOMES: Record<JeitoDoCartao, string> = { frente: "Cartão à frente", escada: "Escada", zoom: "Zoom do cartão" };
const CHAVE = "r2hub.teste.transicaoCartao";

const MOLA = "cubic-bezier(.34,1.42,.62,1)";
const SUAVE = "cubic-bezier(.22,.61,.36,1)";
const CAINDO = "cubic-bezier(.5,0,.75,0)";

/** O jeito valendo agora; null = sem transição (movimento reduzido). */
export function jeitoDoCartao(): JeitoDoCartao | null {
  if (typeof window === "undefined") return null;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;
  if (!import.meta.env.DEV) return "frente";
  try {
    const v = localStorage.getItem(CHAVE) as JeitoDoCartao | null;
    if (v && JEITOS.includes(v)) return v;
  } catch { /* sem armazenamento: fica o primeiro */ }
  return "frente";
}

/** Onde o cartão está no palco (x, y do canto de cima), pelo layout: o transform do hover não conta. */
export function posicaoNaTrilha(trilha: HTMLElement, cartao: HTMLElement) {
  return { x: trilha.offsetLeft + cartao.offsetLeft - trilha.scrollLeft, y: trilha.offsetTop + cartao.offsetTop };
}

const visiveis = (els: Iterable<HTMLElement>) => [...els].filter((c) => c.style.opacity !== "0");
/* as animações daqui têm nome: limpar não cancela a entrada da página (a
   animação CSS da escada com mola) nem a transição do hover */
const ID = "r2-cartao";
const anima = (el: Element, quadros: Keyframe[], opcoes: KeyframeAnimationOptions) => el.animate(quadros, { ...opcoes, id: ID });
const limpar = (els: Iterable<Element>) => { for (const el of els) for (const a of el.getAnimations()) if (a.id === ID) a.cancel(); };

/** Abrir pelo cartão: a trilha sai. Devolve em quantos ms o pedido aberto pode entrar. */
export function sairDaTrilha(trilha: HTMLElement, clicado: HTMLElement, jeito: JeitoDoCartao, destino: { x: number; y: number }): number {
  const todos = visiveis(trilha.querySelectorAll<HTMLElement>(".pd4-cartao"));
  limpar(todos);
  const outros = todos.filter((c) => c !== clicado);
  if (jeito === "frente") {
    outros.forEach((c, i) => anima(c, 
      [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(40px) scale(.97)" }],
      { duration: 240, delay: i * 30, easing: SUAVE, fill: "forwards" }));
    const de = posicaoNaTrilha(trilha, clicado);
    const atual = getComputedStyle(clicado).transform;
    anima(clicado, 
      [{ transform: atual === "none" ? "none" : atual, zIndex: 100001 },
        { transform: `translate(${destino.x - de.x}px, ${destino.y - de.y}px)`, zIndex: 100001 }],
      { duration: 380, easing: SUAVE, fill: "forwards" });
    return 380;
  }
  if (jeito === "escada") {
    todos.forEach((c, i) => anima(c, 
      [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(80px) scale(.96)" }],
      { duration: 260, delay: i * 45, easing: CAINDO, fill: "forwards" }));
    return 260 + Math.max(0, todos.length - 1) * 45;
  }
  outros.forEach((c) => anima(c, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: SUAVE, fill: "forwards" }));
  anima(clicado, 
    [{ opacity: 1, transform: "none", zIndex: 100001 }, { opacity: 0, transform: "scale(1.06)", zIndex: 100001 }],
    { duration: 260, easing: SUAVE, fill: "forwards" });
  return 160;
}

/** Abrir: o pedido aberto entra (a raiz dele acabou de montar). `origem` é o centro do cartão clicado, no palco. */
export function entrarNoCartao(raiz: HTMLElement, jeito: JeitoDoCartao, origem?: { x: number; y: number }) {
  const cartaoDoPedido = raiz.querySelector<HTMLElement>(".pd4-cartao:not(.pdv4-painel)");
  const paineis = visiveis(raiz.querySelectorAll<HTMLElement>(".pdv4-painel"));
  const subir = (els: HTMLElement[], passo: number) => els.forEach((c, i) => anima(c, 
    [{ opacity: 0, transform: "translateY(96px) scale(.96)" }, { opacity: 1, transform: "none" }],
    { duration: 720, delay: i * passo, easing: MOLA, fill: "backwards" }));
  if (jeito === "frente") { subir(paineis, 80); return; }
  if (jeito === "escada") { subir([...(cartaoDoPedido ? [cartaoDoPedido] : []), ...paineis], 85); return; }
  const ox = origem ? origem.x - raiz.offsetLeft : raiz.offsetWidth / 2;
  const oy = origem ? origem.y - raiz.offsetTop : raiz.offsetHeight / 2;
  anima(raiz, 
    [{ opacity: 0, transform: "scale(.88)", transformOrigin: `${ox}px ${oy}px` }, { opacity: 1, transform: "none", transformOrigin: `${ox}px ${oy}px` }],
    { duration: 380, easing: SUAVE, fill: "backwards" });
}

/** Fechar: o pedido aberto sai. Devolve em quantos ms fechar de fato. `destino` é o centro do cartão na trilha. */
export function sairDoCartao(raiz: HTMLElement, jeito: JeitoDoCartao, destino?: { x: number; y: number }): number {
  const cartaoDoPedido = raiz.querySelector<HTMLElement>(".pd4-cartao:not(.pdv4-painel)");
  const paineis = visiveis(raiz.querySelectorAll<HTMLElement>(".pdv4-painel"));
  const descer = (els: HTMLElement[], passo: number, ms: number) => {
    els.forEach((c, i) => anima(c, 
      [{ opacity: 1, transform: getComputedStyle(c).transform === "none" ? "none" : getComputedStyle(c).transform }, { opacity: 0, transform: "translateY(70px) scale(.96)" }],
      { duration: ms, delay: i * passo, easing: CAINDO, fill: "forwards" }));
    return ms + Math.max(0, els.length - 1) * passo;
  };
  if (jeito === "frente") return descer([...paineis].reverse(), 40, 220);
  if (jeito === "escada") return descer([...paineis].reverse().concat(cartaoDoPedido ? [cartaoDoPedido] : []), 45, 240);
  const ox = destino ? destino.x - raiz.offsetLeft : raiz.offsetWidth / 2;
  const oy = destino ? destino.y - raiz.offsetTop : raiz.offsetHeight / 2;
  anima(raiz, 
    [{ opacity: 1, transform: "none", transformOrigin: `${ox}px ${oy}px` }, { opacity: 0, transform: "scale(.88)", transformOrigin: `${ox}px ${oy}px` }],
    { duration: 280, easing: SUAVE, fill: "forwards" });
  return 260;
}

/** Fechar: a trilha volta. Sem `jeito` (fechou por outro caminho), só desfaz a saída. */
export function voltarATrilha(trilha: HTMLElement, cartao: HTMLElement | null, jeito: JeitoDoCartao | null, origem?: { x: number; y: number }) {
  const todos = [...trilha.querySelectorAll<HTMLElement>(".pd4-cartao")];
  limpar(todos);
  if (!jeito) return;
  const vis = visiveis(todos);
  const subir = (els: HTMLElement[], passo: number, atraso = 0) => els.forEach((c, i) => anima(c, 
    [{ opacity: 0, transform: "translateY(70px) scale(.97)" }, { opacity: 1, transform: "none" }],
    { duration: 720, delay: atraso + i * passo, easing: MOLA, fill: "backwards" }));
  if (jeito === "frente" && cartao && origem) {
    const ate = posicaoNaTrilha(trilha, cartao);
    /* o lugar dele pode estar fora da janela (a trilha rolou): ele vai
       sumindo no caminho, em vez de sumir de uma vez na c1 */
    const fica = cartao.style.opacity === "0" ? 0 : 1;
    anima(cartao, 
      [{ transform: `translate(${origem.x - ate.x}px, ${origem.y - ate.y}px)`, opacity: 1, zIndex: 100001 }, { transform: "none", opacity: fica, zIndex: 100001 }],
      { duration: 420, easing: SUAVE });
    subir(vis.filter((c) => c !== cartao), 60, 120);
    return;
  }
  if (jeito === "zoom") {
    vis.forEach((c) => anima(c, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: SUAVE, fill: "backwards" }));
    return;
  }
  subir(vis, 80);
}

/* ————— o teste no hub de teste: Alt+K troca o jeito ————— */
if (typeof window !== "undefined" && import.meta.env.DEV) {
  const w = window as unknown as { __r2CartaoTecla?: (ev: KeyboardEvent) => void };
  if (w.__r2CartaoTecla) window.removeEventListener("keydown", w.__r2CartaoTecla);
  let selo: HTMLDivElement | null = null, tempo = 0;
  w.__r2CartaoTecla = (ev: KeyboardEvent) => {
    if (!ev.altKey || ev.ctrlKey || ev.metaKey || ev.key.toLowerCase() !== "k") return;
    ev.preventDefault();
    const agora = jeitoDoCartao() ?? "frente";
    const prox = JEITOS[(JEITOS.indexOf(agora) + 1) % JEITOS.length];
    try { localStorage.setItem(CHAVE, prox); } catch { /* sem armazenamento: não troca */ }
    if (!selo) {
      selo = document.createElement("div");
      selo.setAttribute("role", "status");
      selo.style.cssText = "position:fixed;left:24px;bottom:24px;z-index:2147483647;background:#000;color:#fff;font:600 16px/1.3 Inter,system-ui,sans-serif;padding:12px 18px;border-radius:999px;pointer-events:none";
      document.body.appendChild(selo);
    }
    selo.textContent = `Entrar e sair dos cartões: ${NOMES[prox]} (Alt+K troca)`;
    selo.style.display = "block";
    window.clearTimeout(tempo);
    tempo = window.setTimeout(() => { if (selo) selo.style.display = "none"; }, 2600);
  };
  window.addEventListener("keydown", w.__r2CartaoTecla);
}
