// Pop-up "versão nova publicada — atualize".
//
// Por que existe: cada `npm run build` troca o endereço dos arquivos da
// página. Quem fica com a aba aberta de antes toma erro ao navegar e continua
// usando telas com bugs já corrigidos — e o aviso dependia de alguém lembrar
// de pedir F5 pelo sino (que, como vimos, ninguém olha).
//
// Agora a própria página percebe: compara a marca do build que ela carregou
// com a que o servidor está publicando agora.
import { useEffect, useRef, useState } from "react";

import { getVersaoServidor } from "@/lib/api/versao.functions";

const INK = "#252425";
const AMARELO = "#ffe815";

/** De quanto em quanto tempo perguntar ao servidor. */
const INTERVALO_MS = 60_000;
/** Se a pessoa disser "agora não", volta a perguntar depois disto. */
const ADIAR_MS = 10 * 60_000;

export function AvisoVersaoNova() {
  const [mostrar, setMostrar] = useState(false);
  const daPagina = useRef<string | null>(null);
  const adiadoAte = useRef(0);

  useEffect(() => {
    let vivo = true;

    async function conferir() {
      if (!vivo || document.hidden) return;   // aba de fundo: não gasta rede
      try {
        const r = (await getVersaoServidor()) as { marca?: string };
        const marca = String(r?.marca ?? "");
        if (!vivo || !marca || marca === "dev") return;
        if (daPagina.current === null) { daPagina.current = marca; return; }  // 1ª leitura
        if (marca !== daPagina.current && Date.now() >= adiadoAte.current) setMostrar(true);
      } catch {
        /* servidor reiniciando: tenta de novo no próximo ciclo */
      }
    }

    void conferir();
    const t = setInterval(() => void conferir(), INTERVALO_MS);
    // voltar para a aba é o momento mais provável de a pessoa ver o aviso
    const aoFocar = () => void conferir();
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoFocar);
    return () => {
      vivo = false;
      clearInterval(t);
      window.removeEventListener("focus", aoFocar);
      document.removeEventListener("visibilitychange", aoFocar);
    };
  }, []);

  if (!mostrar) return null;

  return (
    <div
      role="alertdialog"
      aria-label="Versão nova do R2 Hub"
      style={{
        position: "fixed", inset: 0, zIndex: 2147483000, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 24,
        background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)",
      }}
    >
      <div style={{
        width: "min(520px, 100%)", background: "#f1f1f1", borderRadius: 14,
        padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ flex: "none", width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 999, background: AMARELO }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11.5a8 8 0 1 0-.7 4.3" /><path d="M20.5 6v5.5H15" />
            </svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: "800 21px/1.2 Inter,sans-serif", letterSpacing: "-.01em", color: INK }}>
              Tem versão nova do hub
            </div>
            <div style={{ font: "400 14px/1.3 Inter,sans-serif", color: "#8d8b8d", marginTop: 3 }}>
              esta página está desatualizada
            </div>
          </div>
        </div>

        <p style={{ font: "400 15.5px/1.5 Inter,sans-serif", color: "#5c5a5c", margin: "18px 0 0" }}>
          Foram publicadas correções enquanto você estava com o hub aberto. Atualize para
          usar a versão nova. Sem isso, algumas telas podem dar erro ou seguir com
          problemas já resolvidos.
        </p>
        <p style={{ font: "400 13.5px/1.45 Inter,sans-serif", color: "#8d8b8d", margin: "10px 0 0" }}>
          Se estiver no meio de um cadastro, clique em <strong>Agora não</strong>, termine e
          atualize em seguida.
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
          <button
            onClick={() => { adiadoAte.current = Date.now() + ADIAR_MS; setMostrar(false); }}
            style={{
              border: 0, borderRadius: 999, padding: "14px 20px", cursor: "pointer",
              font: "700 14.5px/1 Inter,sans-serif", background: "#fff", color: INK,
            }}
          >
            Agora não
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              display: "flex", alignItems: "center", gap: 9, border: 0, borderRadius: 999,
              padding: "14px 22px", cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif",
              background: INK, color: AMARELO,
            }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11.5a8 8 0 1 0-.7 4.3" /><path d="M20.5 6v5.5H15" />
            </svg>
            Atualizar agora
          </button>
        </div>
      </div>
    </div>
  );
}
