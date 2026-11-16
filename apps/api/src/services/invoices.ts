import { newId } from "../lib/ids";

/** Invoices are separate documents from quotes and payment intents. Subscription and project invoices never mix. */
export function invoiceNumber(kind: "subscription" | "project" | "managed", now = new Date()) {
  const prefix = kind === "subscription" ? "DXS" : kind === "managed" ? "DXM" : "DXP";
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${ymd}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function invoiceStatement(d: D1Database, x: { orgId: string; kind: "subscription" | "project" | "managed"; subscriptionId?: string | null; offerId?: string | null; paymentIntentId: string; description: string; subtotal: number; tax: number; mode: "mock" | "live" }) {
  return d.prepare(`INSERT INTO invoices (id,number,org_id,kind,subscription_id,offer_id,payment_intent_id,description,subtotal_minor,tax_minor,total_minor,mode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(newId("inv"), invoiceNumber(x.kind), x.orgId, x.kind, x.subscriptionId ?? null, x.offerId ?? null, x.paymentIntentId, x.description.slice(0, 200), x.subtotal, x.tax, x.subtotal + x.tax, x.mode);
}

export async function invoiceForIntent(d: D1Database, paymentIntentId: string) {
  return d.prepare("SELECT id,kind,subtotal_minor,tax_minor,total_minor,status FROM invoices WHERE payment_intent_id=?").bind(paymentIntentId)
    .first<{ id: string; kind: string; subtotal_minor: number; tax_minor: number; total_minor: number; status: string }>();
}
