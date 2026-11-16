import type { Context } from "hono";
import { z } from "zod";
import { fail } from "./http";

export async function body<T extends z.ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try { raw = await c.req.json(); } catch { fail(400, "INVALID_JSON"); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) fail(400, "VALIDATION_FAILED", "Request body failed validation.", parsed.error.flatten());
  return parsed.data;
}
export const text = (max: number, min = 1) => z.string().trim().min(min).max(max);
export const optText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);
export const moneyMinor = z.number().int().nonnegative().max(1_000_000_000_000);
export const idParam = (c: Context, name = "id") => {
  const value = c.req.param(name) ?? "";
  if (!/^[a-z]{2,6}_[a-z0-9]{10,40}$/.test(value)) fail(400, "INVALID_ID");
  return value;
};
