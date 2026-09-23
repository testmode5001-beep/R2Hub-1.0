import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { clearStoredSession, getStoredSession, setStoredSession } from "@/lib/session";
import { getMe } from "@/lib/api/auth.functions";

// Revalida a sessão no servidor no máximo 1x por minuto por navegação.
let ultimaChecagem = 0;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const sessao = getStoredSession();
    if (!sessao) throw redirect({ to: "/auth" });

    if (Date.now() - ultimaChecagem > 60_000) {
      try {
        const { user } = await getMe();
        setStoredSession(sessao.token, user);
        ultimaChecagem = Date.now();
      } catch {
        clearStoredSession();
        throw redirect({ to: "/auth" });
      }
    }
    return { user: getStoredSession()!.user };
  },
  component: () => <Outlet />,
});
