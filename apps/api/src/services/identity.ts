import type { Env } from "../env";
import type { Principal, PlatformRole } from "../auth/principal";
import { PLATFORM_ROLES } from "../auth/principal";
import { fetchClerkUser, isGoogleAccount } from "../auth/clerk";
import { exec, many, one } from "../lib/db";
import { fail, list } from "../lib/http";
import { newId } from "../lib/ids";
import { audit } from "./audit";

interface UserRow { id: string; clerk_user_id: string; email: string | null; status: string; last_seen_at: string | null }

/** Resolves (and on first sight provisions) the internal DAYANEXA user for a verified Clerk subject. */
export async function resolvePrincipal(env: Env, d: D1Database, clerkUserId: string, requestId: string): Promise<Principal> {
  let user = await one<UserRow>(d, "SELECT id,clerk_user_id,email,status,last_seen_at FROM users WHERE clerk_user_id=?", clerkUserId);
  if (!user) user = await provisionUser(env, d, clerkUserId, requestId);
  if (user.status !== "active") fail(403, "ACCOUNT_NOT_ACTIVE", `Account status is ${user.status}.`);
  const last = user.last_seen_at ? Date.parse(user.last_seen_at) : 0;
  if (Date.now() - last > 5 * 60_000) await exec(d, "UPDATE users SET last_seen_at=datetime('now') WHERE id=?", user.id);
  return loadPrincipal(d, user);
}

export async function loadPrincipal(d: D1Database, user: UserRow): Promise<Principal> {
  const roles = (await many<{ role: string }>(d, "SELECT role FROM user_roles WHERE user_id=? AND scope_type='platform'", user.id))
    .map((r) => r.role).filter((r): r is PlatformRole => (PLATFORM_ROLES as string[]).includes(r));
  if (!roles.includes("member")) roles.push("member");
  const orgs = await many<{ org_id: string; kind: string }>(d,
    "SELECT m.org_id, o.kind FROM memberships m JOIN organizations o ON o.id=m.org_id WHERE m.user_id=? AND o.status='active' ORDER BY o.kind='personal' DESC, m.created_at", user.id);
  if (!orgs.length) fail(403, "NO_ORGANIZATION");
  return { userId: user.id, clerkUserId: user.clerk_user_id, email: user.email, status: user.status, roles, orgIds: orgs.map((o) => o.org_id), primaryOrgId: orgs[0].org_id };
}

async function provisionUser(env: Env, d: D1Database, clerkUserId: string, requestId: string): Promise<UserRow> {
  const profile = await fetchClerkUser(env, clerkUserId);
  if (env.APP_ENV === "production" && !profile) fail(503, "IDENTITY_SYNC_UNAVAILABLE", "Could not verify the Clerk user profile.");
  if (profile?.banned) fail(403, "ACCOUNT_NOT_ACTIVE");
  if (env.APP_ENV === "production" && profile && !isGoogleAccount(profile)) fail(403, "GOOGLE_SIGN_IN_REQUIRED", "DAYANEXA hanya menerima login Google.");
  const userId = newId("usr");
  const orgId = newId("org");
  const inserted = await exec(d, `INSERT OR IGNORE INTO users (id,clerk_user_id,email,email_verified,display_name,status,last_synced_at)
    VALUES (?,?,?,?,?,'active',datetime('now'))`, userId, clerkUserId, profile?.email ?? null, profile?.emailVerified ? 1 : 0, profile?.displayName ?? null);
  const user = await one<UserRow>(d, "SELECT id,clerk_user_id,email,status,last_seen_at FROM users WHERE clerk_user_id=?", clerkUserId);
  if (!user) fail(500, "PROVISIONING_FAILED");
  if (inserted.meta.changes > 0) {
    await d.batch([
      d.prepare("INSERT INTO organizations (id,name,kind,created_by) VALUES (?,?,'personal',?)").bind(orgId, profile?.displayName || "Personal workspace", user!.id),
      d.prepare("INSERT INTO memberships (org_id,user_id,role) VALUES (?,?,'owner')").bind(orgId, user!.id),
      d.prepare("INSERT OR IGNORE INTO user_roles (user_id,role,scope_type,scope_id,granted_by) VALUES (?,'member','platform','global','system')").bind(user!.id),
    ]);
    // Bootstrap: the first verified email on the owner allowlist becomes platform owner, exactly once.
    const allow = list(env.BOOTSTRAP_OWNER_EMAILS).map((e) => e.toLowerCase());
    if (profile?.emailVerified && profile.email && allow.includes(profile.email)) {
      const existingOwner = await one(d, "SELECT 1 AS x FROM user_roles WHERE role='owner' AND scope_type='platform'");
      if (!existingOwner) {
        await exec(d, "INSERT OR IGNORE INTO user_roles (user_id,role,scope_type,scope_id,granted_by) VALUES (?,'owner','platform','global','bootstrap')", user!.id);
        await audit(d, { requestId, actorType: "system", action: "role.bootstrap_owner", resourceType: "user", resourceId: user!.id });
      }
    }
    await audit(d, { requestId, actorType: "system", action: "user.provisioned", resourceType: "user", resourceId: user!.id, metadata: { verifiedEmail: profile?.emailVerified ?? false } });
  }
  return user!;
}
