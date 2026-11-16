import { base64ToBytes, hmacBase64, safeEqual } from "../lib/crypto";

/** Verifies Clerk (Svix) webhook signatures over the raw body with a 5 minute replay window. */
export async function verifySvixSignature(secret: string, headers: Headers, rawBody: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string | null> {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");
  if (!id || !timestamp || !signatureHeader || !secret) return null;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > 300) return null;
  const key = base64ToBytes(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  const expected = await hmacBase64(key, `${id}.${timestamp}.${rawBody}`);
  const candidates = signatureHeader.split(" ").map((part) => part.split(",")).filter(([v]) => v === "v1").map(([, sig]) => sig);
  return candidates.some((sig) => safeEqual(sig, expected)) ? id : null;
}
