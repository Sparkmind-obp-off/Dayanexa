export type PlatformRole = "owner" | "operator" | "analyst" | "finance" | "contributor" | "member";
export const PLATFORM_ROLES: PlatformRole[] = ["owner", "operator", "analyst", "finance", "contributor", "member"];

/** Server-resolved identity. Never constructed from client-supplied claims or metadata. */
export interface Principal {
  userId: string;
  clerkUserId: string;
  email: string | null;
  status: string;
  roles: PlatformRole[];
  orgIds: string[];
  primaryOrgId: string;
}
