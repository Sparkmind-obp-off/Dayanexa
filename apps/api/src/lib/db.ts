import type { Env } from "../env";
import { fail } from "./http";

export function db(env: Env): D1Database {
  if (!env.DB) fail(503, "DATABASE_NOT_CONFIGURED", "D1 binding DB is not configured for this environment.");
  return env.DB!;
}
export async function one<T>(d: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  return (await d.prepare(sql).bind(...params).first<T>()) ?? null;
}
export async function many<T>(d: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const res = await d.prepare(sql).bind(...params).all<T>();
  return res.results ?? [];
}
export async function exec(d: D1Database, sql: string, ...params: unknown[]) {
  return d.prepare(sql).bind(...params).run();
}
export async function mustFind<T>(d: D1Database, sql: string, code: string, ...params: unknown[]): Promise<T> {
  const row = await one<T>(d, sql, ...params);
  if (!row) fail(404, code);
  return row!;
}
export const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
