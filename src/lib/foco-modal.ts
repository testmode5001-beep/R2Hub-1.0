// Foco preso no modal aberto ("focus trap"). Um único ouvinte global, irmão do
// instalarEscDosModais: acha o overlay de maior z-index entre os abertos
// (.r2modal ou [data-modal-esc]) e mantém o Tab circulando dentro dele.
//
// Sem isso o Tab continua andando pela tela DE TRÁS — que está visível mas
// bloqueada pelo fundo escuro: quem usa teclado ou leitor de tela some do
// modal sem perceber e passa a digitar em campos que ninguém vê.
//
// Com modais empilhados (Pantone sobre Devolver arte sobre Pedido) o alvo é
// sempre o de cima, pelo mesmo critério do ESC — por isso os dois arquivos
// precisam concordar sobre quem está no topo.
const FOCAVEIS = [
  "a[href]", "area[href]", "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])", "select:not([disabled])",
  "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

function overlayDoTopo(): HTMLElement | null {
  const abertos = Array.from(document.querySelectorAll<HTMLElement>(".r2modal, [data-modal-esc]"));
  if (!abertos.length) return null;
  let topo = abertos[0];
  for (const el of abertos) {
    const z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
    const zTopo = parseInt(getComputedStyle(topo).zIndex, 10) || 0;
    if (z >= zTopo) topo = el; // empate: o mais recente no DOM vence
  }
  return topo;
}

/** Focáveis VISÍVEIS do overlay — um campo escondido não pode receber o Tab. */
function focaveisDe(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>(FOCAVEIS))
    .filter((e) => e.offsetWidth > 0 || e.offsetHeight > 0 || e === document.activeElement);
}

export function instalarFocoDosModais(): () => void {
  let atual: HTMLElement | null = null;
  /** quem tinha o foco antes de o primeiro modal abrir — para devolver depois */
  let anterior: HTMLElement | null = null;
  let agendado = false;

  const conferir = () => {
    const topo = overlayDoTopo();
    if (topo === atual) return;
    if (!atual && topo) anterior = document.activeElement as HTMLElement | null;
    atual = topo;

    if (topo) {
      /* Se algum campo já se focou sozinho (autoFocus dos diálogos), respeita:
         mandar o foco para o primeiro botão tiraria a pessoa do textarea. */
      if (!topo.contains(document.activeElement)) {
        const alvo = focaveisDe(topo)[0];
        if (alvo) alvo.focus();
        else { topo.tabIndex = -1; topo.focus(); }
      }
      return;
    }
    /* fechou tudo: o foco volta para o elemento que abriu o modal */
    if (anterior && document.contains(anterior)) anterior.focus();
    anterior = null;
  };

  /* O DOM muda a cada render do hub; conferir no quadro seguinte junta todas
     as mutações de uma vez e evita varrer a árvore a cada tecla digitada. */
  const agendar = () => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => { agendado = false; conferir(); });
  };

  const aoTecla = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const topo = overlayDoTopo();
    if (!topo) return;
    const lista = focaveisDe(topo);
    if (!lista.length) { e.preventDefault(); return; }
    const primeiro = lista[0], ultimo = lista[lista.length - 1];
    const foco = document.activeElement as HTMLElement | null;
    if (!foco || !topo.contains(foco)) {
      e.preventDefault();
      (e.shiftKey ? ultimo : primeiro).focus();
      return;
    }
    if (e.shiftKey && foco === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && foco === ultimo) { e.preventDefault(); primeiro.focus(); }
  };

  const observador = new MutationObserver(agendar);
  observador.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("keydown", aoTecla, true);
  conferir();

  return () => {
    observador.disconnect();
    document.removeEventListener("keydown", aoTecla, true);
  };
}
