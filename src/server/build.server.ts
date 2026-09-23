// Marca do build em produção: a data de modificação do próprio servidor
// compilado. Muda a cada `npm run build` e sobrevive a reinício/queda — por
// isso serve para o cliente saber que uma VERSÃO nova foi publicada (e não
// confundir com o vigia só ressuscitando o node).
import { statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

let marca: string | null = null;

export function marcaDoBuild(): string {
  if (marca) return marca;
  try {
    const st = statSync(path.join(process.cwd(), ".output", "server", "index.mjs"));
    marca = String(Math.round(st.mtimeMs));
  } catch {
    marca = "dev"; // em desenvolvimento o hot-reload já troca a página sozinho
  }
  return marca;
}
