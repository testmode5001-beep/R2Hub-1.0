import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { login } from "@/lib/api/auth.functions";
import { erroLegivel } from "@/lib/erro-legivel";
import { getStoredSession, setStoredSession } from "@/lib/session";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar · R2 Hub" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  /* o erro mora no formulário: era um balão do sonner (herdado do hub
     antigo), que saiu em 05/10/2026 */
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (getStoredSession()) navigate({ to: "/hub", search: { tela: "inicio" } });
  }, [navigate]);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");
    try {
      const { token, user } = await login({ data: { username, senha } });
      setStoredSession(token, user);
      navigate({ to: "/hub", search: { tela: "inicio" } });
    } catch (err: unknown) {
      setErro(erroLegivel(err, "Não deu para entrar. Tente de novo."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center">
      <div className="px-[18px] py-6 max-w-[440px] mx-auto w-full">
        {/* Marca — só "R2 Hub" em negrito, logo acima do chip de login */}
        <div className="font-display text-[22px] font-extrabold tracking-[-0.5px] mb-3 ml-1">R2 Hub</div>
        <div className="bg-card rounded-[14px] p-[26px_22px]" style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.04),0 16px 32px -24px rgba(0,0,0,0.22)" }}>
          <h2 className="font-display text-[21px] font-extrabold mb-1">Olá! tudo bem?</h2>
          <p className="text-muted-foreground text-[13px] mb-[18px]">
            Acesse com seu usuário para continuar.
          </p>
          <form onSubmit={handle} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-[5px] block">Usuário</label>
              <input
                value={username}
                onChange={(e) => { setUsername(e.target.value); setErro(""); }}
                required
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="seu.usuario"
                className="w-full bg-background border-[1.5px] border-border rounded-[10px] px-3 py-[10px] text-sm outline-none focus:border-foreground"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.06em] mb-[5px] block">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => { setSenha(e.target.value); setErro(""); }}
                required
                placeholder="••••••••"
                className="w-full bg-background border-[1.5px] border-border rounded-[10px] px-3 py-[10px] text-sm outline-none focus:border-foreground"
              />
            </div>
            {erro && <p role="alert" className="text-[13px] font-semibold text-destructive">{erro}</p>}
            <button type="submit" disabled={loading} className="w-full mt-2 bg-yellow text-foreground rounded-[10px] py-3 font-bold text-sm flex items-center justify-center gap-[6px] hover:opacity-85 disabled:opacity-40">
              <i className="ti ti-login"></i>
              {loading ? "Aguarde..." : "Entrar"}
            </button>
          </form>
          <p className="mt-4 text-[11px] text-muted-foreground text-center">
            Sem acesso? Peça ao gestor para criar seu usuário.
          </p>
        </div>
      </div>
    </div>
  );
}
