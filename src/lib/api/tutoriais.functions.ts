// Tutoriais da Home: a lista dos vídeos de passo a passo da pasta da rede
// (só leitura; o vídeo em si sai pela rota /tutorial/<arquivo>).
import { createServerFn } from "@tanstack/react-start";

import { requireAuth } from "./auth-middleware";
import { listarTutoriais } from "@/server/tutoriais.server";

export const listTutoriais = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => ({ tutoriais: listarTutoriais() }));
