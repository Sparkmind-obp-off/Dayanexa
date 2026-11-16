// Applies every D1 migration in order to an in-memory SQLite and verifies schema invariants.
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const dir = "apps/api/migrations";
const files = readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
const db = new DatabaseSync(":memory:");
for (const f of files) { db.exec(readFileSync(`${dir}/${f}`, "utf8")); console.log(`applied ${f}`); }
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
const required = ["users", "organizations", "memberships", "user_roles", "approvals", "audit_events", "signals", "demands", "demand_evidence", "opportunities", "opportunity_assessments",
  "solutions", "capabilities", "capability_gaps", "products", "offers", "agents", "missions", "tasks", "artifacts", "deliveries", "disputes", "lifecycle_transitions",
  "provider_usage", "inference_traces", "payment_intents", "payment_events", "refunds", "payout_requests", "cost_records", "ledger_accounts", "ledger_journals", "ledger_entries", "subscriptions"];
const missing = required.filter((t) => !tables.includes(t));
if (missing.length) { console.error("missing tables:", missing); process.exit(1); }
const accounts = db.prepare("SELECT COUNT(*) AS n FROM ledger_accounts").get().n;
if (accounts < 9) { console.error("ledger accounts not seeded"); process.exit(1); }
console.log(`OK: ${files.length} migrations, ${tables.length} tables, ${accounts} ledger accounts`);
