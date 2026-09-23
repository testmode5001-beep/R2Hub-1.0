// Versão publicada, para a página avisar quem está com a antiga aberta.
//
// Sem isso o rebuild trocava o endereço dos arquivos e quem não recarregava
// tomava erro ao navegar (ou seguia usando uma tela com bug já corrigido) —
// e o aviso dependia de alguém lembrar de pedir F5 no sino.
import { createServerFn } from "@tanstack/react-start";

import { marcaDoBuild } from "@/server/build.server";

/** Sem middleware de sessão de propósito: é dado público e precisa responder
    até para quem está com a sessão expirada na tela. */
export const getVersaoServidor = createServerFn({ method: "GET" }).handler(async () => ({
  marca: marcaDoBuild(),
}));
