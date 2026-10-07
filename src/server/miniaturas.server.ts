// Miniaturas dos arquivos das pastas de cliente (grade da tela Clientes).
//
// Mesma ideia das facas: quem desenha é o navegador (pdf.js), aqui só guardamos
// o PNG. A de cliente NÃO pode morar na pasta do cliente: seriam 5 mil pastas
// `.miniaturas` no meio das artes originais, e aquele acervo não é nosso para
// encher de arquivo de sistema. Fica aqui do lado do banco, em data/. Desde
// 02/10/2026 a das facas também (data/miniaturas-facas): antes morava ao lado
// do desenho, na Relação de Ferramentais, que é só leitura.
//
// Consequência boa: apagar essa pasta inteira não perde nada. É cache; na pior
// das hipóteses a tela desenha tudo de novo.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

/** PNG de 320px dá ~20 KB; 2 MB é teto de segurança, como nas facas. */
const MAX_MB = 2;

function pastaCache(): string {
  return process.env.MINIATURAS_DIR ?? path.join(process.cwd(), "data", "miniaturas-clientes");
}

/* O nome do arquivo é o hash do caminho: caminho de rede tem acento, espaço,
   vírgula e barra invertida, e nenhum deles sobrevive bem como nome de arquivo.
   Minúsculo antes do hash porque no Windows o caminho não diferencia caixa. */
const chaveDe = (caminhoCompleto: string) =>
  createHash("sha1").update(caminhoCompleto.toLowerCase()).digest("hex");

const arquivoDaMiniatura = (caminhoCompleto: string) =>
  path.join(pastaCache(), `${chaveDe(caminhoCompleto)}.png`);

/**
 * Miniatura pronta, ou `null` se não existe — ou se ficou velha.
 *
 * A comparação de data é a mesma lição das facas: arte corrigida e salva por
 * cima deixava a miniatura antiga na tela, e alguém teria que lembrar de
 * apagar o cache à mão. Miniatura mais velha que o arquivo é tratada como
 * inexistente, e o navegador redesenha sozinho.
 */
export function lerMiniaturaCliente(caminhoCompleto: string): Buffer | null {
  const alvo = arquivoDaMiniatura(caminhoCompleto);
  try {
    if (!existsSync(alvo)) return null;
    if (statSync(caminhoCompleto).mtimeMs > statSync(alvo).mtimeMs) return null;
    return readFileSync(alvo);
  } catch {
    return null;
  }
}

/** Guarda a miniatura desenhada pelo navegador. Só aceita PNG de verdade. */
export function gravarMiniaturaCliente(caminhoCompleto: string, png: Buffer): boolean {
  if (png.length > MAX_MB * 1024 * 1024) return false;
  // assinatura PNG: 89 50 4E 47
  if (png.length < 8 || png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) return false;
  // só para arquivo que existe de verdade — o cache não vira depósito
  if (!existsSync(caminhoCompleto)) return false;
  try {
    mkdirSync(pastaCache(), { recursive: true });
    writeFileSync(arquivoDaMiniatura(caminhoCompleto), png);
    return true;
  } catch {
    return false; // disco cheio ou permissão: a tela desenha de novo na próxima
  }
}
