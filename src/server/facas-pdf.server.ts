// Desenhos técnicos das facas (PDF). Ficam no share, ao lado dos vídeos de fundo:
// \\server\Arte\Clientes\Modelos\Design\R2 Hub\Facas (e \Mortas para as baixadas).
// O navegador não lê o share direto, então o app serve o arquivo sob demanda.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

/**
 * A pasta ONDE A EQUIPE SALVA, não uma cópia.
 *
 * Até 12/08/2026 o hub lia `...\Modelos\Design\R2 Hub\Facas`, uma cópia feita
 * na migração. Quem desenhava uma faca nova salvava no lugar de sempre
 * (`Relação de Ferramentais\facas`) e o desenho nunca chegava ao hub — foi o
 * caso da FAC0274.01. Cópia que alguém precisa lembrar de atualizar é cópia
 * que fica velha; o hub agora lê a original.
 */
export function facasPdfDir(): string {
  return (
    process.env.FACAS_PDF_DIR ??
    "\\\\server\\Arte\\Clientes\\Relação de Ferramentais\\facas"
  );
}

const PASTA_MORTAS = "Mortas";
/** Nome de arquivo puro: sem barra, sem "..", sem caminho — path traversal fica de fora. */
const NOME_OK = /^[A-Za-z0-9._ -]+\.pdf$/i;
/** Teto por arquivo: os desenhos do acervo têm ~700 KB; 30 MB é folga de sobra. */
const MAX_MB = 30;

const pdfsDe = (dir: string): string[] => {
  try {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((n) => n.toLowerCase().endsWith(".pdf"));
  } catch {
    return []; // share fora do ar: a tela cai no desenho gerado pela medida
  }
};

/**
 * Desenhos disponíveis, separando os que estão na subpasta "Mortas".
 *
 * A distinção importa: a tela mostra como "a classificar" todo desenho sem
 * faca cadastrada, e sem separar isso incluía as 66 facas APOSENTADAS da
 * subpasta — 132 itens onde deviam ser 66. Faca na pasta Mortas não é
 * desenho novo esperando cadastro; é arquivo morto.
 *
 * Nome repetido nas duas pastas conta como VIVO (está na pasta de trabalho).
 */
export function listarPdfsFacas(): { todos: string[]; mortas: string[] } {
  const raiz = facasPdfDir();
  const naRaiz = pdfsDe(raiz);
  const naMortas = pdfsDe(path.join(raiz, PASTA_MORTAS));
  const daRaiz = new Set(naRaiz.map((n) => n.toLowerCase()));
  return {
    todos: [...new Set([...naRaiz, ...naMortas])],
    mortas: naMortas.filter((n) => !daRaiz.has(n.toLowerCase())),
  };
}

/* ————— Miniaturas (PNG da 1ª página) —————
   Quem desenha é o navegador (pdf.js); aqui só guardamos o resultado, para os
   próximos acessos custarem ~20 KB em vez de baixar o PDF inteiro de novo. */
const PASTA_MINI = ".miniaturas";
/** PNG de 320px do acervo dá ~20 KB; 2 MB é teto de segurança. */
const MAX_MINI_MB = 2;

const miniaturaPath = (arquivo: string) =>
  path.join(facasPdfDir(), PASTA_MINI, `${arquivo}.png`);

/** Nomes dos desenhos que já têm miniatura pronta (guardadas como <arquivo>.pdf.png). */
export function listarMiniaturas(): string[] {
  const dir = path.join(facasPdfDir(), PASTA_MINI);
  try {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((n) => n.toLowerCase().endsWith(".pdf.png"))
      .map((n) => n.slice(0, -".png".length));
  } catch {
    return [];
  }
}

/** Onde o desenho está (pasta de trabalho ou Mortas), ou `null`. */
function caminhoDoPdf(arquivo: string): string | null {
  const raiz = facasPdfDir();
  for (const dir of [raiz, path.join(raiz, PASTA_MORTAS)]) {
    const alvo = path.join(dir, arquivo);
    if (existsSync(alvo)) return alvo;
  }
  return null;
}

/**
 * Miniatura pronta, ou `null` se ainda não foi desenhada — OU se ficou velha.
 *
 * O desenho é corrigido no Illustrator e salvo por cima (foi o caso da
 * 099.01.pdf em 14/08/2026, que perdeu a serrilha): a miniatura guardada
 * continuava mostrando o desenho antigo, e alguém teria que apagar o PNG à mão
 * a cada correção. Comparando a data do PNG com a do PDF, miniatura mais velha
 * que o desenho é tratada como inexistente — o navegador redesenha e regrava
 * sozinho, sem ninguém pedir.
 */
export function lerMiniatura(arquivo: string): Buffer | null {
  if (!NOME_OK.test(arquivo)) return null;
  const alvo = miniaturaPath(arquivo);
  if (!existsSync(alvo)) return null;
  try {
    const pdf = caminhoDoPdf(arquivo);
    if (pdf && statSync(pdf).mtimeMs > statSync(alvo).mtimeMs) return null;
    return readFileSync(alvo);
  } catch {
    return null;
  }
}

/** Guarda a miniatura desenhada pelo navegador. Só aceita PNG de verdade. */
export function gravarMiniatura(arquivo: string, png: Buffer): boolean {
  if (!NOME_OK.test(arquivo)) return false;
  if (png.length > MAX_MINI_MB * 1024 * 1024) return false;
  // assinatura PNG: 89 50 4E 47
  if (png.length < 8 || png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) return false;
  // só para desenho que existe no acervo — não vira depósito de arquivo solto
  if (!existsSync(path.join(facasPdfDir(), arquivo)) && !existsSync(path.join(facasPdfDir(), PASTA_MORTAS, arquivo))) {
    return false;
  }
  try {
    mkdirSync(path.join(facasPdfDir(), PASTA_MINI), { recursive: true });
    writeFileSync(miniaturaPath(arquivo), png);
    return true;
  } catch {
    return false; // share só-leitura: segue desenhando no navegador
  }
}

/** Lê um desenho pelo nome do arquivo. `null` = não existe ou nome inválido. */
export function lerPdfFaca(arquivo: string): Buffer | null {
  if (!NOME_OK.test(arquivo)) return null;
  const alvo = caminhoDoPdf(arquivo);
  if (!alvo) return null;
  if (statSync(alvo).size > MAX_MB * 1024 * 1024) return null;
  return readFileSync(alvo);
}
