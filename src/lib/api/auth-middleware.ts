// Middleware de servidor: valida o token de sessão e injeta o usuário no contexto.
// Substitui o requireSupabaseAuth da V2.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { userFromToken, type AuthUser } from "@/server/auth.server";

export type AuthContext = { user: AuthUser; token: string };

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const header = request?.headers?.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("Não autenticado.");

  const user = userFromToken(token);
  if (!user) throw new Error("Sessão expirada. Entre novamente.");

  return next({ context: { user, token } satisfies AuthContext });
});
