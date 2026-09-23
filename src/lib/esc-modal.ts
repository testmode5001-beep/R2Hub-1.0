// ESC fecha o modal aberto. Um único ouvinte global: acha o overlay de maior
// z-index entre os abertos (classe .r2modal ou atributo data-modal-esc) e o
// fecha — clicando no botão marcado com data-esc-fechar quando o modal não
// fecha por clique no fundo (formulários e confirmações), ou simulando o
// clique no próprio fundo nos demais. Com modais empilhados (visualizador de
// anexo sobre o pedido, por exemplo) o ESC fecha um por vez, do topo para baixo.
export function instalarEscDosModais(): () => void {
  const aoTecla = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    const abertos = Array.from(document.querySelectorAll<HTMLElement>(".r2modal, [data-modal-esc]"));
    if (!abertos.length) return;
    let topo = abertos[0];
    for (const el of abertos) {
      const z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
      const zTopo = parseInt(getComputedStyle(topo).zIndex, 10) || 0;
      if (z >= zTopo) topo = el; // empate: o mais recente no DOM vence
    }
    const botao = topo.querySelector<HTMLElement>("[data-esc-fechar]");
    (botao ?? topo).click();
    e.preventDefault();
  };
  window.addEventListener("keydown", aoTecla);
  return () => window.removeEventListener("keydown", aoTecla);
}
