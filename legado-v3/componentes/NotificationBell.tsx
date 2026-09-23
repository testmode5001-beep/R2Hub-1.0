// Sino de notificações (Etapa 3): contador de não lidas + toasts em tempo real,
// via polling curto no servidor local — funciona sem internet e sem service worker.
// Quando a aba não está em foco, avisa também por notificação do Windows
// (requer permissão do navegador), contador no título da aba e um bip.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { listNotifications, markNotificationsRead } from "@/lib/api/notifications.functions";

type Notif = {
  id: string;
  titulo: string;
  corpo: string | null;
  url: string | null;
  lida: number;
  created_at: string;
};

function fmtQuando(s: string) {
  const diff = Date.now() - new Date(s).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Bip curto de dois tons (WebAudio — sem arquivo de som). */
function tocarBip() {
  try {
    const ctx = new AudioContext();
    const tocar = (freq: number, inicio: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.08, ctx.currentTime + inicio);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + dur);
    };
    tocar(880, 0, 0.15);
    tocar(1175, 0.16, 0.2);
    setTimeout(() => ctx.close(), 800);
  } catch {
    // Sem áudio disponível — segue sem bip.
  }
}

function suportaDesktop() {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Mostra a notificação do sistema operacional (aparece mesmo com a aba em segundo plano). */
function notificarDesktop(n: Notif, aoClicar: (url: string | null) => void) {
  if (!suportaDesktop() || Notification.permission !== "granted") return;
  try {
    const sysN = new Notification(n.titulo, {
      body: n.corpo ?? "",
      icon: "/r2-logo.png",
      tag: `r2hub-${n.id}`,
    });
    sysN.onclick = () => {
      window.focus();
      sysN.close();
      aoClicar(n.url);
    };
  } catch {
    // Alguns navegadores em origem http bloqueiam — o título da aba e o bip cobrem.
  }
}

/** `tamanhoEm` = quando definido, dimensiona o botão do sino em `em` (relativo
    ao font-size herdado) — permite casá-lo com o wordmark da capa. Sem ele,
    mantém o tamanho fixo padrão usado dentro do /app.
    `abrirPara` = para que lado a lista abre. Na capa o sino fica no rodapé,
 *  então a lista precisa subir, senão ficaria fora da tela. */
export function NotificationBell({ abrirPara = "baixo", tamanhoEm, escuro }: { abrirPara?: "baixo" | "cima"; tamanhoEm?: number; escuro?: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [permissao, setPermissao] = useState<NotificationPermission | "unsupported">(() =>
    suportaDesktop() ? Notification.permission : "unsupported",
  );
  // Marca d'água do que já foi visto nesta sessão de tela — evita aviso repetido.
  const vistoAte = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
  });

  const unread = data?.unread ?? 0;
  const items = (data?.items ?? []) as Notif[];

  // Contador no título da aba: "(3) Pedidos — Vendas x Design"
  useEffect(() => {
    const semContador = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = unread > 0 ? `(${unread > 99 ? "99+" : unread}) ${semContador}` : semContador;
  }, [unread]);

  useEffect(() => {
    if (!data) return;
    if (vistoAte.current === null) {
      // Primeira carga: não dispara avisos do passado.
      vistoAte.current = items[0]?.created_at ?? "";
      return;
    }
    const novos = items.filter((n) => n.created_at > (vistoAte.current ?? ""));
    if (novos.length === 0) return;
    vistoAte.current = items[0]?.created_at ?? vistoAte.current;

    tocarBip();
    for (const n of novos.slice(0, 3)) {
      // Toast dentro do sistema (aba visível)...
      toast(n.titulo, { description: n.corpo ?? undefined, icon: "🔔", duration: 6000 });
      // ...e notificação do Windows quando a aba está em segundo plano.
      if (document.hidden) {
        notificarDesktop(n, (url) => { if (url) navigate({ to: url }); });
      }
    }
  }, [data, items, navigate]);

  async function ativarDesktop() {
    if (!suportaDesktop()) return;
    const r = await Notification.requestPermission();
    setPermissao(r);
    if (r === "granted") {
      toast.success("Avisos na área de trabalho ativados!");
      new Notification("R2 Design Hub", {
        body: "Você será avisada(o) mesmo com o Hub em outra aba.",
        icon: "/r2-logo.png",
      });
    } else if (r === "denied") {
      toast.error("O navegador bloqueou os avisos. Libere em: cadeado da barra de endereço → Notificações.");
    }
  }

  async function abrirNotif(n: Notif) {
    setAberto(false);
    if (!n.lida) {
      await markNotificationsRead({ data: { ids: [n.id] } });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    if (n.url) navigate({ to: n.url });
  }

  async function marcarTodas() {
    await markNotificationsRead({ data: { todas: true } });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className={`relative flex items-center justify-center rounded-full ${escuro ? "hover:opacity-75" : "bg-card hover:opacity-80"} ${tamanhoEm ? "" : "w-8 h-8"}`}
        style={escuro
          ? (tamanhoEm ? { width: `${tamanhoEm}em`, height: `${tamanhoEm}em` } : undefined)
          : (tamanhoEm ? { boxShadow: "0 1px 4px rgba(0,0,0,0.09)", width: `${tamanhoEm}em`, height: `${tamanhoEm}em` } : { boxShadow: "0 1px 4px rgba(0,0,0,0.09)" })}
        aria-label="Notificações"
      >
        <i className={`ti ti-bell ${tamanhoEm ? "" : escuro ? "" : "text-[16px]"}`} style={escuro ? { color: "var(--on-rail, #fff)", fontSize: tamanhoEm ? `${tamanhoEm * 0.56}em` : 21 } : (tamanhoEm ? { fontSize: `${tamanhoEm * 0.56}em` } : undefined)}></i>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-white text-[9px] font-extrabold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div
            className={`absolute right-0 ${abrirPara === "cima" ? "bottom-10" : "top-10"} z-50 w-[300px] max-h-[400px] overflow-y-auto bg-card rounded-[14px] p-2`}
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
          >
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
                Notificações
              </span>
              {unread > 0 && (
                <button onClick={marcarTodas} className="text-[10px] font-bold text-muted-foreground hover:text-foreground">
                  Marcar todas como lidas
                </button>
              )}
            </div>

            {permissao === "default" && (
              <button
                onClick={ativarDesktop}
                className="w-full text-left rounded-[10px] px-2 py-2 mb-1 bg-yellow/25 border border-yellow hover:bg-yellow/40"
              >
                <div className="text-[12px] font-bold flex items-center gap-1">
                  <i className="ti ti-bell-ringing"></i>Ativar avisos na área de trabalho
                </div>
                <div className="text-[11px] text-muted-foreground mt-[2px]">
                  Para ser avisada(o) mesmo com o Hub em outra aba do navegador.
                </div>
              </button>
            )}
            {permissao === "denied" && (
              <div className="rounded-[10px] px-2 py-2 mb-1 bg-background border border-border text-[11px] text-muted-foreground">
                <i className="ti ti-bell-off mr-1"></i>
                Avisos da área de trabalho bloqueados. Libere no cadeado da barra de endereço → Notificações.
              </div>
            )}

            {items.length === 0 ? (
              <div className="text-center text-[12px] text-muted-foreground py-6">
                Nenhuma notificação.
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => abrirNotif(n)}
                  className={`w-full text-left rounded-[10px] px-2 py-2 hover:bg-background ${n.lida ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    {!n.lida && <span className="w-2 h-2 rounded-full bg-yellow shrink-0" />}
                    <span className="text-[12px] font-bold flex-1 truncate">{n.titulo}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{fmtQuando(n.created_at)}</span>
                  </div>
                  {n.corpo && <div className="text-[11px] text-muted-foreground mt-[2px] truncate">{n.corpo}</div>}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
