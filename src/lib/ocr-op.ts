// OCR de OP no navegador — compartilhado entre a página do celular (foto) e a
// tela de Leitura do desktop (quadro da câmera). tesseract.js com worker e
// idioma servidos pelo próprio hub em /tesseract — funciona sem internet.

/**
 * Foto de celular vem com 12 megapixels — o OCR não precisa disso e a memória
 * do aparelho não aguenta: reduz para 2000px no maior lado antes de ler.
 * Se qualquer passo falhar, devolve a imagem original (melhor tentar do que
 * desistir).
 */
const LADO_MAX = 2000;
async function reduzirImagem(imagem: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(imagem);
    const maior = Math.max(bitmap.width, bitmap.height);
    if (maior <= LADO_MAX) { bitmap.close?.(); return imagem; }
    const k = LADO_MAX / maior;
    const tela = document.createElement("canvas");
    tela.width = Math.round(bitmap.width * k);
    tela.height = Math.round(bitmap.height * k);
    const g = tela.getContext("2d");
    if (!g) { bitmap.close?.(); return imagem; }
    g.drawImage(bitmap, 0, 0, tela.width, tela.height);
    bitmap.close?.();
    const menor = await new Promise<Blob | null>((ok) => tela.toBlob(ok, "image/jpeg", 0.92));
    return menor || imagem;
  } catch {
    return imagem;
  }
}

/** OCR da imagem — carregado sob demanda; devolve o texto cru reconhecido. */
export async function lerImagemOP(imagem: Blob, aoProgresso: (pct: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const pronta = await reduzirImagem(imagem);
  const worker = await createWorker("por", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract",
    langPath: "/tesseract",
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") aoProgresso(Math.round(m.progress * 100));
    },
  });
  try {
    const r = await worker.recognize(pronta);
    return r.data.text || "";
  } finally {
    await worker.terminate();
  }
}
