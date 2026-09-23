// Hash de senha com scrypt (nativo do Node) — sem dependências externas.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384, r = 8, p = 1, KEYLEN = 32;

export function hashPassword(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, KEYLEN, { N, r, p }).toString("hex");
  return `scrypt$${N}.${r}.${p}$${salt}$${hash}`;
}

export function verifyPassword(senha: string, stored: string): boolean {
  try {
    const [algo, params, salt, hash] = stored.split("$");
    if (algo !== "scrypt") return false;
    const [n2, r2, p2] = params.split(".").map(Number);
    const calc = scryptSync(senha, salt, KEYLEN, { N: n2, r: r2, p: p2 });
    return timingSafeEqual(calc, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}
