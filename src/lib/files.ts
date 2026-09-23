// Utilitários de arquivo no navegador (upload/download em base64 + caminhos de rede).
import { toast } from "sonner";

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.onerror = () => reject(r.error ?? new Error("Falha ao ler arquivo"));
    r.readAsDataURL(file);
  });
}

export function base64ToBlob(dataBase64: string, mime: string): Blob {
  const bin = atob(dataBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function salvarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function abrirBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** \\server\Arte\Clientes\X → file://server/Arte/Clientes/X (requer política do Edge p/ intranet). */
export function toFileUrl(caminho: string): string {
  const barras = caminho.replace(/\\/g, "/");
  // UNC (//server/...) vira file://server/...; caminho local (C:/...) vira file:///C:/...
  return barras.startsWith("//") ? "file:" + barras : "file:///" + barras;
}

export async function copiarTexto(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success("Caminho copiado!");
  } catch {
    toast.error("Não foi possível copiar. Selecione e copie manualmente: " + texto);
  }
}

export function fmtTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
