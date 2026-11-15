import { verifyToken } from "@clerk/backend";

export interface AuthEnv {
  CLERK_JWT_KEY?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
}
export interface AuthUser { clerkUserId: string }

export async function authenticate(request: Request, env: AuthEnv): Promise<AuthUser | null> {
  const authorization=request.headers.get("authorization") || "";
  const token=authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token || !env.CLERK_JWT_KEY) return null;
  try {
    const claims=await verifyToken(token,{
      jwtKey:env.CLERK_JWT_KEY,
      authorizedParties:env.CLERK_AUTHORIZED_PARTIES?.split(",").map(v=>v.trim()).filter(Boolean)
    });
    const subject=claims.sub;
    return typeof subject === "string" && subject.length > 0 ? {clerkUserId:subject} : null;
  } catch { return null; }
}
