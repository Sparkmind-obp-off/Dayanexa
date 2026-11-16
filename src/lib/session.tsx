import { createContext, useContext, type ReactNode } from "react";
import { useGet, type ApiError } from "./api";

export interface Plan { code: "free" | "pro" | "plus"; name: string; tagline: string; priceMonthly: number; periodDays: number; highlight: boolean; limits: { requestsPerMonth: number; aiAssistsPerMonth: number; seats: number }; features: string[] }
export interface Me {
  user: { id: string; email: string | null; email_verified: number; display_name: string | null; status: string; created_at: string } | null;
  roles: string[]; permissions: string[]; organizations: { id: string; name: string; kind: string; role: string }[]; primaryOrgId: string;
  contributor: { headline: string; skills: string; status: string } | null;
  plan: Plan; subscription: { plan_code: string; status: string; current_period_end: string | null; cancel_at_period_end: number } | null;
  usage: { requests: number; aiAssists: number };
}
interface SessionCtx { me: Me | undefined; can: (p: string) => boolean; isStaff: boolean; loading: boolean; error: ApiError | null; refetch: () => void }
const Ctx = createContext<SessionCtx>({ me: undefined, can: () => false, isStaff: false, loading: true, error: null, refetch: () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const q = useGet<Me>("/me");
  const can = (p: string) => Boolean(q.data?.permissions.includes(p));
  return <Ctx.Provider value={{ me: q.data, can, isStaff: can("workspace:read"), loading: q.isLoading, error: q.error, refetch: () => void q.refetch() }}>{children}</Ctx.Provider>;
}
export const useSession = () => useContext(Ctx);
