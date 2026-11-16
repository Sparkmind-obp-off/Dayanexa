import { useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
type Init = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit };
export type Api = <T = any>(path: string, init?: Init) => Promise<T>;

/** Typed fetch against the DAYANEXA API with the short-lived Clerk session token. Tokens are never persisted. */
export function useApi(): Api {
  const { getToken } = useAuth();
  return useCallback(async <T = any>(path: string, init: Init = {}): Promise<T> => {
    const token = await getToken();
    const headers = new Headers(init.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    let body = init.body;
    if (init.json !== undefined) { headers.set("content-type", "application/json"); body = JSON.stringify(init.json); }
    const res = await fetch(`/api/v1${path}`, { ...init, headers, body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? `HTTP_${res.status}`, data?.error?.message ?? res.statusText, data?.error?.details);
    return data as T;
  }, [getToken]) as Api;
}

export async function publicGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`/api/v1${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? `HTTP_${res.status}`, data?.error?.message ?? res.statusText);
  return data as T;
}
export function usePublic<T = any>(path: string) {
  return useQuery<T, ApiError>({ queryKey: ["public", path], queryFn: () => publicGet<T>(path) });
}
export function useGet<T = any>(path: string | null, opts: { refetchInterval?: number } = {}) {
  const api = useApi();
  return useQuery<T, ApiError>({ queryKey: [path], queryFn: () => api<T>(path!), enabled: Boolean(path), refetchInterval: opts.refetchInterval });
}
/** Mutation invalidating all cached queries on success so every list reflects server truth. */
export function useAction<V = any, R = any>(fn: (api: Api, vars: V) => Promise<R>) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<R, ApiError, V>({ mutationFn: (v) => fn(api, v), onSuccess: () => qc.invalidateQueries() });
}

export const idr = (minor: number | null | undefined) =>
  minor === null || minor === undefined ? "—" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(minor));
export const dt = (v: string | null | undefined) => (v ? new Date(v.includes("T") ? v : v.replace(" ", "T") + "Z").toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—");
export const newIdemKey = () => crypto.randomUUID();
export const humanError = (e: unknown) => {
  if (e instanceof ApiError) {
    const map: Record<string, string> = {
      DATABASE_NOT_CONFIGURED: "Database produksi belum aktif. Pemilik perlu mengaktifkan Cloudflare D1.",
      AUTH_NOT_CONFIGURED: "Verifikasi Clerk belum dikonfigurasi di server.",
      UNAUTHENTICATED: "Sesi Anda berakhir. Silakan masuk kembali.",
      FORBIDDEN: "Anda tidak memiliki izin untuk aksi ini.",
      PLAN_LIMIT_REACHED: e.message, RATE_LIMITED: "Terlalu banyak permintaan. Coba lagi sebentar.",
    };
    return map[e.code] ?? `${e.message} (${e.code})`;
  }
  return e instanceof Error ? e.message : "Terjadi kesalahan.";
};
