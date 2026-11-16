import { base64Url, fromBase64Url, hmacHex, safeEqual } from "../lib/crypto";

/** Short-lived HMAC token: base64url(artifactId.expiry).hexsig */
export async function signArtifactToken(secret: string, artifactId: string, ttlSeconds: number): Promise<string> {
  const payload = `${artifactId}.${Math.floor(Date.now() / 1000) + ttlSeconds}`;
  return `${base64Url(payload)}.${await hmacHex("SHA-256", secret, payload)}`;
}
export async function verifyArtifactToken(secret: string, token: string): Promise<string | null> {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  let payload: string;
  try { payload = fromBase64Url(encoded); } catch { return null; }
  if (!safeEqual(await hmacHex("SHA-256", secret, payload), sig)) return null;
  const [id, exp] = payload.split(".");
  if (!id || Number(exp) < Math.floor(Date.now() / 1000)) return null;
  return id;
}
