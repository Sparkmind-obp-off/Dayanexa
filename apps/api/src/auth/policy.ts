import type { Principal, PlatformRole } from "./principal";
import { fail } from "../lib/http";

export type Permission =
  | "workspace:read" | "intel:write" | "provider:run" | "ai:run" | "catalog:write" | "commercial:write"
  | "mission:write" | "delivery:write" | "ledger:read" | "ledger:write" | "governance:read" | "governance:write"
  | "approval:decide" | "roles:manage" | "contributor:work" | "customer:self" | "provider:admin";

const ALL: Permission[] = [
  "workspace:read", "intel:write", "provider:run", "ai:run", "catalog:write", "commercial:write", "mission:write",
  "delivery:write", "ledger:read", "ledger:write", "governance:read", "governance:write", "approval:decide",
  "roles:manage", "contributor:work", "customer:self", "provider:admin",
];

export const ROLE_PERMISSIONS: Record<PlatformRole, Permission[]> = {
  owner: ALL,
  operator: ["workspace:read", "intel:write", "provider:run", "ai:run", "catalog:write", "commercial:write", "mission:write",
    "delivery:write", "ledger:read", "governance:read", "customer:self", "contributor:work"],
  analyst: ["workspace:read", "intel:write", "provider:run", "ai:run", "governance:read", "customer:self"],
  finance: ["workspace:read", "ledger:read", "ledger:write", "governance:read", "customer:self"],
  contributor: ["contributor:work", "customer:self"],
  member: ["customer:self"],
};

export function permissionsOf(principal: Principal): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of principal.roles) for (const p of ROLE_PERMISSIONS[role] ?? []) set.add(p);
  return set;
}
export const can = (principal: Principal, permission: Permission) => permissionsOf(principal).has(permission);
export function assertCan(principal: Principal, permission: Permission) {
  if (!can(principal, permission)) fail(403, "FORBIDDEN", `Missing permission ${permission}.`);
}
/** Tenant isolation: platform staff may cross orgs; everyone else only their own memberships. */
export function assertOrgAccess(principal: Principal, orgId: string | null | undefined) {
  if (can(principal, "workspace:read")) return;
  if (!orgId || !principal.orgIds.includes(orgId)) fail(404, "NOT_FOUND");
}
