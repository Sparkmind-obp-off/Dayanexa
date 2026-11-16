import { verifyToken } from "@clerk/backend";
import type { Env } from "../env";
import { list } from "../lib/http";

export interface VerifiedSession { clerkUserId: string; sessionId: string | null; }

/** Verifies a Clerk session JWT networklessly against the Production instance PEM key. */
export async function verifySession(token: string, env: Env): Promise<VerifiedSession | null> {
  if (!token || !env.CLERK_JWT_KEY) return null;
  try {
    const claims = await verifyToken(token, {
      jwtKey: env.CLERK_JWT_KEY,
      authorizedParties: list(env.CLERK_AUTHORIZED_PARTIES),
      clockSkewInMs: 10_000,
    }) as unknown as Record<string, unknown>;
    const sub = claims.sub;
    if (typeof sub !== "string" || !sub.startsWith("user_")) return null;
    return { clerkUserId: sub, sessionId: typeof claims.sid === "string" ? claims.sid : null };
  } catch {
    return null;
  }
}

export interface ClerkUserProfile {
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  banned: boolean;
  providers: string[];
}

/** Server-to-server lookup of the Clerk user; the trusted source for email + verification state. */
export async function fetchClerkUser(env: Env, clerkUserId: string): Promise<ClerkUserProfile | null> {
  if (!env.CLERK_SECRET_KEY) return null;
  const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}`, {
    headers: { authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
  });
  if (!res.ok) return null;
  return profileFromClerkUser(await res.json() as Record<string, unknown>);
}

export function profileFromClerkUser(user: Record<string, unknown>): ClerkUserProfile {
  const emails = Array.isArray(user.email_addresses) ? user.email_addresses as Record<string, unknown>[] : [];
  const primary = emails.find((e) => e.id === user.primary_email_address_id) ?? emails[0];
  const verification = primary?.verification as Record<string, unknown> | undefined;
  const name = [user.first_name, user.last_name].filter((v) => typeof v === "string" && v).join(" ");
  return {
    email: typeof primary?.email_address === "string" ? (primary.email_address as string).toLowerCase() : null,
    emailVerified: verification?.status === "verified",
    displayName: name || (typeof user.username === "string" ? user.username : null),
    banned: user.banned === true || user.locked === true,
    providers: (Array.isArray(user.external_accounts) ? user.external_accounts as Record<string, unknown>[] : [])
      .filter((a) => !a.verification || (a.verification as Record<string, unknown>).status === "verified").map((a) => String(a.provider ?? "")),
  };
}

/** Owner decision: production sign-in is Google OAuth only (Clerk Production instance has only oauth_google enabled). */
export const isGoogleAccount = (p: ClerkUserProfile) => p.providers.some((x) => x === "oauth_google" || x === "google");
