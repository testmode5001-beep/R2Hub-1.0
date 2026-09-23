// Anexa o token de sessão a toda chamada de server function.
// Registrado como functionMiddleware global em src/start.ts.
import { createMiddleware } from "@tanstack/react-start";

import { getToken } from "./session";

export const attachAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = getToken();
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});
