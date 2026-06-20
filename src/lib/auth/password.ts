import bcrypt from "bcryptjs";

/**
 * Password hashing using bcrypt. `bcryptjs` is a pure-JS implementation chosen
 * so it runs without native build steps on Vercel's Node runtime.
 *
 * Cost factor 12 is a sensible 2025 default (OWASP). Raise as hardware improves.
 */
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
