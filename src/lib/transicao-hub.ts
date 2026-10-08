// A transição entre as páginas do hub (Augusto, 07/10/2026: "vamos adicionar
// transições entre as páginas do hub"). Ele provou ao vivo, no hub de teste,
// Subir, Deslizar, Cortina e Esmaecer ("gostei da transição subir e escada"),
// depois três escadas, e ficou com a Escada com mola ("vamos ficar com a
// transição escada com mola"): cada cartão sobe sozinho, um depois do outro,
// passa um pouco do lugar e assenta; o pé e o resto da página sobem juntos.
//
// Só a página entra: a barra do topo fica parada (data-barra-topo). A primeira
// página do carregamento não anima (veio pronta do servidor). Quem pediu
// movimento reduzido no sistema não vê. A animação usa "backwards": acabou, o
// cartão volta ao transform dele (o do hover).

let jaEntrou = false;
/* no hub de teste o React (modo estrito) roda o efeito de montagem duas vezes
   no mesmo palco: a segunda não é navegação (a primeira página animava;
   revisão de código de 07/10/2026) */
const palcosQueEntraram = new WeakSet<HTMLElement>();
const CLASSE = "h10-entra-mola";

/** Põe a entrada no palco que acabou de montar (chamado antes de pintar). */
export function entrarNaPagina(palco: HTMLElement | null) {
  if (!palco || typeof window === "undefined" || palcosQueEntraram.has(palco)) return;
  palcosQueEntraram.add(palco);
  const primeira = !jaEntrou;
  jaEntrou = true;
  if (primeira) return;
  palco.classList.add(CLASSE);
  /* a classe sai quando as animações da entrada acabam, e não num relógio
     fixo de 1,8 s: na gravação dos tutoriais em câmera lenta
     (Animation.setPlaybackRate) o relógio cortava a mola no meio. O relógio
     longo fica de reserva. */
  const tirar = () => palco.classList.remove(CLASSE);
  const reserva = window.setTimeout(tirar, 12000);
  requestAnimationFrame(() => {
    const minhas = palco.getAnimations({ subtree: true }).filter((a) =>
      a instanceof CSSAnimation && (a.animationName === "h10-sobe" || a.animationName === "h10-cartao-mola"));
    const fim = () => { window.clearTimeout(reserva); tirar(); };
    if (!minhas.length) { fim(); return; }
    void Promise.allSettled(minhas.map((a) => a.finished)).then(fim);
  });
}

/* o que não tem cartão dentro (o pé, o título, a Home) sobe junto; cada
   cartão sobe sozinho, com o atraso da escada */
const SEM_CARTAO = `.${CLASSE} > :not([data-barra-topo]):not(:has(.pd4-cartao))`;
const CSS = `
@keyframes h10-sobe { from { opacity: 0; transform: translateY(32px); } }
@keyframes h10-cartao-mola { from { opacity: 0; transform: translateY(96px) scale(.96); } }
${SEM_CARTAO} { animation: h10-sobe .5s cubic-bezier(.2,.8,.2,1) .12s backwards; }
.${CLASSE} .pd4-cartao { animation: h10-cartao-mola .78s cubic-bezier(.34,1.42,.62,1) backwards; }
${[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `.${CLASSE} .pd4-cartao:nth-child(${n}) { animation-delay: ${((n - 1) * 0.09).toFixed(2)}s; }`).join("\n")}
@media (prefers-reduced-motion: reduce) {
  .${CLASSE}, .${CLASSE} * { animation: none !important; }
}`;

/* a folha de estilo vai no <head> (como a da paleta): o React confere o que é
   dele na hidratação e não mexe nela; troca inteira a cada recarga do módulo */
if (typeof window !== "undefined") {
  let s = document.getElementById("r2-transicao");
  if (!s) {
    s = document.createElement("style");
    s.id = "r2-transicao";
    document.head.appendChild(s);
  }
  s.textContent = CSS;
  /* a folha e o Alt+T do teste das transições saem (a escolha está feita) */
  document.getElementById("r2-transicao-teste")?.remove();
  const w = window as unknown as { __r2TransicaoTecla?: (ev: KeyboardEvent) => void };
  if (w.__r2TransicaoTecla) {
    window.removeEventListener("keydown", w.__r2TransicaoTecla);
    delete w.__r2TransicaoTecla;
  }
  try { localStorage.removeItem("r2hub.teste.transicao"); } catch { /* sem armazenamento: nada a limpar */ }
}
