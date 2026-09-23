// Primeira senha do dono da conta. Quem entra com a senha provisória criada
// pelo gestor cai aqui e não sai antes de definir a própria — nenhuma tela do
// hub abre no meio do caminho (o /hub e a página do celular mandam para cá).
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { definirPrimeiraSenha } from "@/lib/api/auth.functions";
import { getStoredSession, setStoredSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/trocar-senha")({
  ssr: false,
  head: () => ({ meta: [{ title: "Crie sua senha — R2 Hub" }] }),
  component: TrocarSenhaPage,
});

const INK = "#252425";
const AMARELO = "#ffe815";

function TrocarSenhaPage() {
  const navigate = useNavigate();
  const sessao = getStoredSession();
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const curta = nova.length > 0 && nova.length < 6;
  const diferente = confirma.length > 0 && nova !== confirma;
  const valido = nova.length >= 6 && nova === confirma;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || salvando) return;
    setSalvando(true);
    setErro("");
    try {
      await definirPrimeiraSenha({ data: { novaSenha: nova } });
      if (sessao) setStoredSession(sessao.token, { ...sessao.user, precisaTrocarSenha: false });
      navigate({ to: "/hub", search: { tela: "home" } });
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : "Não deu para gravar a senha.");
      setSalvando(false);
    }
  }

  const campo = {
    width: "100%", background: "#f1f1f1", border: "2px solid #f1f1f1", borderRadius: 10,
    padding: "13px 14px", font: "600 16px/1 Inter,sans-serif", color: INK, outline: "none",
  } as const;
  const rotulo = {
    display: "block", font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".1em",
    textTransform: "uppercase" as const, color: "#8d8b8d", marginBottom: 7,
  };

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#f1f1f1", padding: 24, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ font: "800 13px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d", marginBottom: 12 }}>R2 Hub · primeiro acesso</div>
        <form onSubmit={salvar} style={{ background: "#fff", borderRadius: 14, padding: "26px 24px", boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 26px 50px -34px rgba(0,0,0,.35)" }}>
          <h1 style={{ font: "800 24px/1.15 Inter,sans-serif", color: INK, margin: 0 }}>Crie a sua senha</h1>
          <p style={{ font: "400 14.5px/1.5 Inter,sans-serif", color: "#5c5a5c", margin: "10px 0 20px" }}>
            {sessao?.user?.nome ? `${sessao.user.nome.split(" ")[0]}, a ` : "A "}
            senha que você usou para entrar foi criada pelo gestor e serve só desta vez.
            Defina uma que só você saiba — ela vale a partir de agora.
          </p>

          <label style={rotulo}>Nova senha</label>
          <input type="password" value={nova} onChange={(e) => setNova(e.target.value)} autoFocus
            style={{ ...campo, borderColor: curta ? "#c0392b" : nova ? AMARELO : "#f1f1f1" }} placeholder="pelo menos 6 caracteres" />
          {curta && <div style={{ font: "500 13px/1.3 Inter,sans-serif", color: "#c0392b", marginTop: 6 }}>Curta demais: use 6 caracteres ou mais.</div>}

          <label style={{ ...rotulo, marginTop: 16 }}>Repita a nova senha</label>
          <input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)}
            style={{ ...campo, borderColor: diferente ? "#c0392b" : confirma && !diferente ? AMARELO : "#f1f1f1" }} placeholder="para conferir" />
          {diferente && <div style={{ font: "500 13px/1.3 Inter,sans-serif", color: "#c0392b", marginTop: 6 }}>As duas não são iguais.</div>}

          {erro && <div style={{ font: "600 13.5px/1.4 Inter,sans-serif", color: "#c0392b", marginTop: 14 }}>{erro}</div>}

          <button type="submit" disabled={!valido || salvando}
            style={{ width: "100%", marginTop: 22, background: valido ? AMARELO : "#e8e8e8", border: 0, borderRadius: 10, padding: "15px 16px", cursor: valido && !salvando ? "pointer" : "not-allowed", font: "800 16px/1 Inter,sans-serif", color: valido ? INK : "#b3b1b3" }}>
            {salvando ? "Gravando…" : "Salvar e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
