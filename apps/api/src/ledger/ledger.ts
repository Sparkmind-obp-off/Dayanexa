import { fail } from "../lib/http";
import { newId } from "../lib/ids";

export interface JournalLine { accountId: string; direction: "debit" | "credit"; amount: number; currency?: string }
export interface JournalInput { sourceType: string; sourceId: string; description: string; lines: JournalLine[]; createdBy?: string | null; reversesJournalId?: string | null }

/** Validates a journal: ≥2 lines, positive integer minor units, balanced per currency. */
export function validateJournal(lines: JournalLine[]): void {
  if (lines.length < 2) fail(400, "JOURNAL_TOO_FEW_LINES");
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!Number.isSafeInteger(line.amount) || line.amount <= 0) fail(400, "JOURNAL_INVALID_AMOUNT", "Amounts must be positive integer minor units.");
    if (line.direction !== "debit" && line.direction !== "credit") fail(400, "JOURNAL_INVALID_DIRECTION");
    const cur = line.currency ?? "IDR";
    totals.set(cur, (totals.get(cur) ?? 0) + (line.direction === "debit" ? line.amount : -line.amount));
  }
  for (const [cur, net] of totals) if (net !== 0) fail(400, "JOURNAL_UNBALANCED", `Journal is unbalanced in ${cur} by ${net}.`);
}

/** Idempotent posting keyed by (sourceType, sourceId); atomic via D1 batch. Returns existing journal on replay. */
export async function postJournal(d: D1Database, input: JournalInput): Promise<{ journalId: string; duplicate: boolean }> {
  validateJournal(input.lines);
  const existing = await d.prepare("SELECT id FROM ledger_journals WHERE source_type=? AND source_id=?").bind(input.sourceType, input.sourceId).first<{ id: string }>();
  if (existing) return { journalId: existing.id, duplicate: true };
  const accounts = new Set((await d.prepare("SELECT id FROM ledger_accounts WHERE is_active=1").all<{ id: string }>()).results.map((r) => r.id));
  for (const line of input.lines) if (!accounts.has(line.accountId)) fail(400, "JOURNAL_UNKNOWN_ACCOUNT", line.accountId);
  const journalId = newId("jnl");
  await d.batch([
    d.prepare("INSERT INTO ledger_journals (id,source_type,source_id,status,description,reverses_journal_id,created_by) VALUES (?,?,?,'posted',?,?,?)")
      .bind(journalId, input.sourceType, input.sourceId, input.description.slice(0, 300), input.reversesJournalId ?? null, input.createdBy ?? null),
    ...input.lines.map((l) => d.prepare("INSERT INTO ledger_entries (id,journal_id,account_id,direction,amount,currency) VALUES (?,?,?,?,?,?)")
      .bind(newId("ent"), journalId, l.accountId, l.direction, l.amount, l.currency ?? "IDR")),
  ]);
  return { journalId, duplicate: false };
}

/** Never edits a posted journal: posts a mirrored reversal and marks the original reversed. */
export async function reverseJournal(d: D1Database, journalId: string, reason: string, actor: string | null) {
  const j = await d.prepare("SELECT id,status,description FROM ledger_journals WHERE id=?").bind(journalId).first<{ id: string; status: string; description: string }>();
  if (!j) fail(404, "JOURNAL_NOT_FOUND");
  if (j!.status !== "posted") fail(409, "JOURNAL_ALREADY_REVERSED");
  const lines = (await d.prepare("SELECT account_id,direction,amount,currency FROM ledger_entries WHERE journal_id=?").bind(journalId).all<{ account_id: string; direction: "debit" | "credit"; amount: number; currency: string }>()).results;
  const result = await postJournal(d, {
    sourceType: "reversal", sourceId: journalId, description: `Reversal of ${journalId}: ${reason}`.slice(0, 300), createdBy: actor, reversesJournalId: journalId,
    lines: lines.map((l) => ({ accountId: l.account_id, amount: l.amount, currency: l.currency, direction: l.direction === "debit" ? "credit" : "debit" })),
  });
  await d.prepare("UPDATE ledger_journals SET status='reversed' WHERE id=? AND status='posted'").bind(journalId).run();
  return result;
}

export async function accountBalances(d: D1Database) {
  const rows = await d.prepare(`SELECT a.id,a.code,a.name,a.account_type,a.currency,
      COALESCE(SUM(CASE WHEN e.direction='debit' THEN e.amount ELSE 0 END),0) AS debits,
      COALESCE(SUM(CASE WHEN e.direction='credit' THEN e.amount ELSE 0 END),0) AS credits
    FROM ledger_accounts a LEFT JOIN ledger_entries e ON e.account_id=a.id GROUP BY a.id ORDER BY a.code`).all<Record<string, number | string>>();
  return rows.results.map((r) => {
    const debitNormal = r.account_type === "asset" || r.account_type === "expense";
    const balance = debitNormal ? Number(r.debits) - Number(r.credits) : Number(r.credits) - Number(r.debits);
    return { ...r, balance };
  });
}

export async function trialBalance(d: D1Database) {
  const row = await d.prepare(`SELECT COALESCE(SUM(CASE WHEN direction='debit' THEN amount END),0) AS debits, COALESCE(SUM(CASE WHEN direction='credit' THEN amount END),0) AS credits FROM ledger_entries`).first<{ debits: number; credits: number }>();
  return { debits: row?.debits ?? 0, credits: row?.credits ?? 0, balanced: (row?.debits ?? 0) === (row?.credits ?? 0) };
}
