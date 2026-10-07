import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

/* A raiz só encaminha: logado vai para o hub (na tela inicial escolhida, pelo
   ?tela=inicio), sem login vai para a entrada. O encaminhamento é depois de
   montar: feito no beforeLoad, ele trocava a página no meio da hidratação e o
   React acusava "Hydration failed" a cada entrada pela raiz (simulação 5,
   05/10/2026). */
export const Route = createFileRoute("/")({
  ssr: false,
  component: Raiz,
});

function Raiz() {
  const navigate = useNavigate();
  useEffect(() => {
    let vivo = true;
    void import("@/lib/session").then(({ getStoredSession }) => {
      if (!vivo) return;
      if (getStoredSession()) navigate({ to: "/hub", search: { tela: "inicio" }, replace: true });
      else navigate({ to: "/auth", replace: true });
    });
    return () => { vivo = false; };
  }, [navigate]);
  return null;
}
