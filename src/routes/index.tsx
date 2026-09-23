import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { getStoredSession } = await import("@/lib/session");
    if (getStoredSession()) throw redirect({ to: "/hub", search: { tela: "home" } });
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
