/** Canonical lifecycle maps (docs/03-opportunity-lifecycle.md). Invalid transitions fail closed. */
export type TransitionMap = Record<string, readonly string[]>;

export const DEMAND_TRANSITIONS: TransitionMap = {
  DEMAND_HYPOTHESIS_CREATED: ["DEMAND_EVIDENCE_PENDING", "DEFERRED", "REJECTED"],
  DEMAND_EVIDENCE_PENDING: ["DEMAND_VALIDATED", "DEFERRED", "REJECTED"],
  DEFERRED: ["DEMAND_EVIDENCE_PENDING", "REJECTED"],
  DEMAND_VALIDATED: [],
  REJECTED: [],
};

export const OPPORTUNITY_TRANSITIONS: TransitionMap = {
  OPPORTUNITY_CREATED: ["OPPORTUNITY_ASSESSED", "DEFERRED", "REJECTED"],
  OPPORTUNITY_ASSESSED: ["SOLUTION_DESIGNED", "DEFERRED", "REJECTED"],
  SOLUTION_DESIGNED: ["CAPABILITY_ASSESSMENT", "REJECTED"],
  CAPABILITY_ASSESSMENT: ["CAPABILITY_READY", "CAPABILITY_GAP_IDENTIFIED", "REJECTED"],
  CAPABILITY_GAP_IDENTIFIED: ["CAPABILITY_FORMATION_PLANNED", "DEFERRED", "REJECTED"],
  CAPABILITY_FORMATION_PLANNED: ["CAPABILITY_READY", "DEFERRED", "REJECTED"],
  CAPABILITY_READY: ["COMMERCIAL_MODEL_DESIGNED", "REJECTED"],
  COMMERCIAL_MODEL_DESIGNED: ["OFFER_READY", "REJECTED"],
  OFFER_READY: ["CLOSED"],
  DEFERRED: ["OPPORTUNITY_CREATED", "REJECTED"],
  REJECTED: [],
  CLOSED: [],
};

export const MISSION_TRANSITIONS: TransitionMap = {
  MISSION_PLANNED: ["TASKS_DECOMPOSED", "CANCELLED"],
  TASKS_DECOMPOSED: ["RESOURCES_ASSIGNED", "CANCELLED"],
  RESOURCES_ASSIGNED: ["EXECUTING", "CANCELLED"],
  EXECUTING: ["QUALITY_REVIEW", "SUSPENDED", "NEEDS_HUMAN_REVIEW", "FAILED", "CANCELLED"],
  NEEDS_HUMAN_REVIEW: ["EXECUTING", "CANCELLED"],
  SUSPENDED: ["EXECUTING", "CANCELLED"],
  QUALITY_REVIEW: ["EXECUTING", "READY_FOR_DELIVERY"],
  READY_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: ["AWAITING_ACCEPTANCE"],
  AWAITING_ACCEPTANCE: ["ACCEPTED", "DISPUTED"],
  DISPUTED: ["EXECUTING", "ACCEPTED", "CANCELLED"],
  ACCEPTED: ["SETTLEMENT_COMPLETED"],
  SETTLEMENT_COMPLETED: ["LEARNING_RECORDED"],
  LEARNING_RECORDED: ["CLOSED"],
  FAILED: [],
  CANCELLED: [],
  CLOSED: [],
};

/** Mission states that may only be entered through their dedicated, guarded endpoints. */
export const MISSION_DEDICATED_STATES = new Set(["READY_FOR_DELIVERY", "DELIVERED", "AWAITING_ACCEPTANCE", "ACCEPTED", "DISPUTED", "SETTLEMENT_COMPLETED", "LEARNING_RECORDED"]);
export const OPPORTUNITY_DEDICATED_STATES = new Set<string>();

export const isAllowed = (map: TransitionMap, from: string, to: string) => (map[from] ?? []).includes(to);

/** Canonical payment lifecycle; independent of mission/delivery/settlement. */
export const PAYMENT_RANK: Record<string, number> = {
  CREATED: 0, PENDING: 1, RECONCILIATION_REQUIRED: 2, FAILED: 3, EXPIRED: 3, SUCCEEDED: 4,
  REFUND_PENDING: 5, REFUND_FAILED: 6, REFUNDED: 7, DISPUTED: 6,
};
/** Out-of-order protection: never regress a terminal/advanced status (e.g. SUCCEEDED → PENDING). */
export function paymentTransitionAllowed(from: string, to: string): boolean {
  if (from === to) return false;
  if (from === "SUCCEEDED") return ["REFUND_PENDING", "REFUNDED", "DISPUTED", "RECONCILIATION_REQUIRED"].includes(to);
  if (from === "REFUNDED") return false;
  if (from === "FAILED" || from === "EXPIRED") return to === "SUCCEEDED" || to === "RECONCILIATION_REQUIRED"; // late success must be reconciled
  return (PAYMENT_RANK[to] ?? 0) >= (PAYMENT_RANK[from] ?? 0) || to === "RECONCILIATION_REQUIRED";
}
