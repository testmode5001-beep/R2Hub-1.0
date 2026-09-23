// Miniatura de PDF desenhada por nós (pdf.js → canvas → PNG).
// Motivo: o visualizador nativo do navegador só funciona dentro de <iframe>/<embed>
// e nem sempre pinta (extensão desligada, política do host). Renderizando a
// primeira página como imagem, o desenho da faca aparece em qualquer lugar —
// inclusive no cartão da lista.
let libPromise: Promise<typeof import("pdfjs-dist")> | null = null;

/** pdf.js só no navegador (usa DOM/worker) — daí o import dinâmico.
    Exportado porque a leitura da nota da clicheria usa a mesma biblioteca
    (e o mesmo worker, carregado uma vez só). */
export async function libPdfJs() {
  if (!libPromise) {
    libPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return libPromise;
}

const cache = new Map<string, string>();

/**
 * TODAS as páginas do PDF como imagens, na ordem — para ver o arquivo inteiro
 * sem depender do visualizador do navegador (que na intranet às vezes abre
 * preto, e aí o arquivo "não existe" para quem está olhando).
 *
 * `maximo` é um freio: PDF de catálogo com 200 páginas travaria a aba.
 */
export async function pdfPaginas(url: string, largura: number, maximo = 12): Promise<{ imagens: string[]; total: number }> {
  const pdfjs = await libPdfJs();
  const doc = await pdfjs.getDocument({ url }).promise;
  try {
    const total = doc.numPages;
    const imagens: string[] = [];
    for (let n = 1; n <= Math.min(total, maximo); n++) {
      const pagina = await doc.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const vp = pagina.getViewport({ scale: largura / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Sem canvas para desenhar o PDF.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvas, canvasContext: ctx, viewport: vp }).promise;
      imagens.push(canvas.toDataURL("image/png"));
    }
    return { imagens, total };
  } finally {
    void doc.cleanup();
  }
}

/**
 * Primeira página do PDF como data URL PNG, com a largura pedida.
 * `chave` identifica o arquivo no cache (o mesmo desenho não é redesenhado).
 */
export async function pdfPrimeiraPagina(url: string, largura: number, chave = url): Promise<string> {
  const idCache = `${chave}@${largura}`;
  const pronto = cache.get(idCache);
  if (pronto) return pronto;

  const pdfjs = await libPdfJs();
  const doc = await pdfjs.getDocument({ url }).promise;
  try {
    const pagina = await doc.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const vp = pagina.getViewport({ scale: largura / base.width });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Sem canvas para desenhar o PDF.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pagina.render({ canvas, canvasContext: ctx, viewport: vp }).promise;

    const png = canvas.toDataURL("image/png");
    cache.set(idCache, png);
    return png;
  } finally {
    void doc.cleanup();
  }
}
