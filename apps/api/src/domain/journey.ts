/**
 * Customer-facing "next action" for a request. Every state has a responsible actor and a next step (V2 Phase 2).
 * Pure function so it is unit-testable and identical in API and UI.
 */
export interface NextAction { actor: "customer" | "dayanexa" | "none"; code: string; label: string; link?: string }
interface OfferLite { id: string; status: string; version: number; valid_until?: string | null }
interface PaymentLite { offer_id: string; status: string; mode: string; checkout_url?: string | null }
interface MissionLite { id: string; offer_id: string; status: string }

export function customerNextAction(x: { demandStatus: string; offers: OfferLite[]; payments: PaymentLite[]; missions: MissionLite[] }): NextAction {
  const mission = x.missions[0];
  if (mission) {
    switch (mission.status) {
      case "AWAITING_ACCEPTANCE": return { actor: "customer", code: "REVIEW_DELIVERY", label: "Tinjau hasil kerja lalu terima atau sengketakan.", link: `/app/missions/${mission.id}` };
      case "DISPUTED": return { actor: "dayanexa", code: "DISPUTE_REVIEW", label: "Sengketa sedang ditinjau operator.", link: `/app/missions/${mission.id}` };
      case "ACCEPTED": case "SETTLEMENT_COMPLETED": case "LEARNING_RECORDED": case "CLOSED": return { actor: "none", code: "COMPLETED", label: "Selesai — hasil telah Anda terima.", link: `/app/missions/${mission.id}` };
      case "CANCELLED": case "FAILED": return { actor: "dayanexa", code: "MISSION_STOPPED", label: "Misi dihentikan. Hubungi dukungan untuk opsi refund/penyelesaian." };
      default: return { actor: "dayanexa", code: "IN_EXECUTION", label: "Misi sedang dikerjakan.", link: `/app/missions/${mission.id}` };
    }
  }
  const accepted = x.offers.find((o) => o.status === "accepted");
  if (accepted) {
    const pay = x.payments.find((p) => p.offer_id === accepted.id);
    if (!pay || ["FAILED", "EXPIRED"].includes(pay.status)) return { actor: "customer", code: "PAY", label: "Lakukan pembayaran untuk penawaran yang telah Anda setujui." };
    if (pay.status === "PENDING") return { actor: "customer", code: "COMPLETE_PAYMENT", label: pay.mode === "mock" ? "Pembayaran dalam mode uji (tanpa tagihan nyata). Menunggu aktivasi pembayaran live." : "Selesaikan pembayaran di halaman gateway." };
    if (pay.status === "RECONCILIATION_REQUIRED") return { actor: "dayanexa", code: "PAYMENT_RECONCILIATION", label: "Pembayaran sedang direkonsiliasi oleh tim keuangan." };
    if (pay.status === "SUCCEEDED") return { actor: "dayanexa", code: "PLAN_MISSION", label: "Pembayaran terverifikasi. Misi sedang direncanakan." };
    return { actor: "dayanexa", code: "PAYMENT_" + pay.status, label: "Status pembayaran sedang diproses." };
  }
  const open = x.offers.find((o) => o.status === "published");
  if (open) return { actor: "customer", code: "REVIEW_QUOTE", label: `Tinjau penawaran versi ${open.version} dan setujui jika sesuai.` };
  switch (x.demandStatus) {
    case "DEMAND_HYPOTHESIS_CREATED": return { actor: "dayanexa", code: "INTAKE", label: "Request diterima. Operator akan meninjau dalam 2 hari kerja." };
    case "DEMAND_EVIDENCE_PENDING": return { actor: "dayanexa", code: "VALIDATION", label: "Kebutuhan sedang divalidasi dengan bukti." };
    case "DEMAND_VALIDATED": return { actor: "dayanexa", code: "QUOTE_PREPARATION", label: "Kebutuhan tervalidasi. Penawaran sedang disusun." };
    case "DEFERRED": return { actor: "dayanexa", code: "DEFERRED", label: "Ditunda — kami akan menghubungi Anda bila ada informasi tambahan yang diperlukan." };
    case "REJECTED": return { actor: "none", code: "DECLINED", label: "Tidak dilanjutkan. Lihat catatan validasi atau hubungi dukungan." };
    default: return { actor: "dayanexa", code: "PROCESSING", label: "Sedang diproses." };
  }
}

/** Gross mission margin check for quotes (V2: compute margin before approving an offer). */
export function quoteMargin(priceMinor: number, estimatedDirectCostMinor: number) {
  const margin = priceMinor - estimatedDirectCostMinor;
  const bps = priceMinor > 0 ? Math.floor((margin * 10_000) / priceMinor) : 0;
  return { margin, bps };
}

/** Canonical quote snapshot (frozen when submitted). Sorted keys → stable hash. */
export function quoteSnapshot(o: Record<string, unknown>) {
  const keys = ["id", "quote_group_id", "version", "customer_org_id", "demand_id", "title", "scope", "deliverables", "exclusions", "assumptions", "acceptance_criteria",
    "refund_terms", "revision_policy", "payment_terms", "service_layer", "delivery_days", "price_minor", "tax_minor", "currency", "valid_days"];
  return JSON.stringify(Object.fromEntries(keys.map((k) => [k, o[k] ?? null])));
}
