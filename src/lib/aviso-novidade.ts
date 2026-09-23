// Avisar quem NÃO está olhando para a tela: pedido novo ou pedido que mudou de
// etapa. Duas frentes que funcionam em HTTP puro na rede da empresa (a API de
// notificação do navegador exige HTTPS e por isso não serve aqui):
//
//   1. um bip curto, gerado na hora (sem arquivo de som);
//   2. o TÍTULO da aba piscando — é o que aparece na barra de tarefas de quem
//      está com o hub minimizado.
//
// O som é preferência da máquina (mesma ideia do zoom): quem senta na produção
// quer ouvir; quem está numa sala de reunião, não.

const CHAVE_SOM = "r2hub.avisos.som";

export function somLigado(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(CHAVE_SOM) !== "0"; } catch { return true; }
}

export function definirSom(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE_SOM, ligado ? "1" : "0");
    window.dispatchEvent(new Event("r2hub-som"));
  } catch { /* storage bloqueado */ }
}

/** Bip curto de duas notas. Só sai depois que a pessoa já clicou na página
    alguma vez — é regra do navegador, não dá para contornar. */
export function tocarBip() {
  if (!somLigado()) return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const agora = ctx.currentTime;
    [[880, 0], [1174, 0.12]].forEach(([hz, atraso]) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = hz;
      vol.gain.setValueAtTime(0.0001, agora + atraso);
      vol.gain.exponentialRampToValueAtTime(0.16, agora + atraso + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.11);
      osc.connect(vol).connect(ctx.destination);
      osc.start(agora + atraso);
      osc.stop(agora + atraso + 0.13);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch { /* sem áudio no aparelho */ }
}

/* ————— aviso nativo do Windows (precisa de HTTPS) ————— */
/* Com o hub em https://hub.r2etiquetas.com.br o navegador libera a
   Notification API: o aviso aparece na bandeja do Windows mesmo com o
   navegador minimizado. Em HTTP a API nem existe — aí ficam o bip,
   o título e o ícone piscando. */
export function notificacaoNativaDisponivel(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && "Notification" in window;
}

export function pedirPermissaoNativa(): Promise<NotificationPermission> {
  if (!notificacaoNativaDisponivel()) return Promise.resolve("denied");
  try { return Notification.requestPermission(); } catch { return Promise.resolve("denied"); }
}

export function notificarNativo(aviso: string) {
  if (!notificacaoNativaDisponivel()) return;
  if (Notification.permission !== "granted") return;
  if (!document.hidden && document.hasFocus()) return; // olhando: o toast basta
  try {
    const n = new Notification("R2 Hub", { body: aviso, tag: "r2hub-pedidos" });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* alguns navegadores exigem service worker — segue o resto */ }
}

/* ————— ícone da aba piscando (amarelo ⇄ preto) ————— */
/* O título já muda, mas em aba estreita o que a pessoa vê é o ÍCONE. Ele é
   desenhado na hora num canvas — não depende de arquivo nenhum. */
let iconeOriginal: string | null = null;
let timerIcone: ReturnType<typeof setInterval> | null = null;

function elementoIcone(): HTMLLinkElement {
  let el = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!el) {
    el = document.createElement("link");
    el.rel = "icon";
    document.head.appendChild(el);
  }
  return el;
}

function desenharIcone(fundo: string, frente: string): string {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const g = c.getContext("2d");
  if (!g) return "";
  g.fillStyle = fundo;
  g.beginPath();
  g.roundRect(2, 2, 60, 60, 14);
  g.fill();
  g.fillStyle = frente;
  g.font = "bold 38px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("R2", 32, 35);
  return c.toDataURL("image/png");
}

export function piscarIcone() {
  if (typeof document === "undefined" || timerIcone) return;
  const el = elementoIcone();
  if (iconeOriginal === null) iconeOriginal = el.getAttribute("href");
  const amarelo = desenharIcone("#ffe815", "#252425");
  const preto = desenharIcone("#252425", "#ffe815");
  if (!amarelo || !preto) return;
  let liga = true;
  el.type = "image/png";
  el.href = amarelo;
  timerIcone = setInterval(() => {
    el.href = liga ? preto : amarelo;
    liga = !liga;
  }, 700);
}

export function pararIcone() {
  if (timerIcone) { clearInterval(timerIcone); timerIcone = null; }
  if (iconeOriginal !== null) {
    const el = elementoIcone();
    if (iconeOriginal) el.href = iconeOriginal;
    else el.remove();
    iconeOriginal = null;
  }
}

/* ————— título piscante ————— */
let timer: ReturnType<typeof setInterval> | null = null;
let tituloOriginal = "";
let ouvindoFoco = false;

/** Faz o título da aba alternar com o aviso até a pessoa voltar para a aba. */
export function piscarTitulo(aviso: string) {
  if (typeof document === "undefined") return;
  if (!document.hidden) return;          // está olhando: o toast já resolve
  piscarIcone();
  if (!timer) tituloOriginal = document.title;
  pararTitulo(false);
  let liga = true;
  timer = setInterval(() => {
    document.title = liga ? `🔔 ${aviso}` : tituloOriginal;
    liga = !liga;
  }, 1200);
  document.title = `🔔 ${aviso}`;
  if (!ouvindoFoco) {
    ouvindoFoco = true;
    const voltou = () => { if (!document.hidden) pararTitulo(true); };
    document.addEventListener("visibilitychange", voltou);
    window.addEventListener("focus", voltou);
  }
}

export function pararTitulo(restaurar = true) {
  if (timer) { clearInterval(timer); timer = null; }
  pararIcone();
  if (restaurar && tituloOriginal) document.title = tituloOriginal;
}
