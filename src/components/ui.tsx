import { useState, type ReactNode } from "react";
import { humanError } from "../lib/api";

export const Spinner = () => <span className="spinner" aria-label="Memuat" />;
export function Loading({ label = "Memuat data…" }: { label?: string }) { return <div className="state"><Spinner /><div className="small" style={{ marginTop: 8 }}>{label}</div></div>; }
export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div className="alert bad row between"><span>{humanError(error)}</span>{retry && <button className="btn sm" onClick={retry}>Coba lagi</button>}</div>;
}
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <div className="state"><div style={{ fontWeight: 700, color: "#cdd6e8" }}>{title}</div>{hint && <div className="small" style={{ marginTop: 6 }}>{hint}</div>}{action && <div style={{ marginTop: 12 }}>{action}</div>}</div>;
}
/** Renders loading / error / empty / success for any query. */
export function Q<T>({ q, empty, children }: { q: { isLoading: boolean; error: unknown; data: T | undefined; refetch: () => unknown }; empty?: (d: T) => boolean | string; children: (d: T) => ReactNode }) {
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  if (!q.data) return null;
  const e = empty?.(q.data);
  if (e) return <Empty title={typeof e === "string" ? e : "Belum ada data"} hint="Data ditampilkan hanya dari catatan nyata di sistem." />;
  return <>{children(q.data)}</>;
}

const TONE: Record<string, string> = {
  SUCCEEDED: "ok", active: "ok", accepted: "ok", ACCEPTED: "ok", DEMAND_VALIDATED: "ok", published: "ok", verified: "ok", approved: "ok", done: "ok", ready: "ok", resolved: "ok", SETTLEMENT_COMPLETED: "ok", CLOSED: "ok", LEARNING_RECORDED: "ok", paid_externally: "ok", success: "ok", OFFER_READY: "ok", CAPABILITY_READY: "ok", classified: "info",
  PENDING: "warn", pending: "warn", approval_pending: "warn", authorization_pending: "warn", AWAITING_ACCEPTANCE: "warn", DEMAND_EVIDENCE_PENDING: "warn", in_progress: "info", EXECUTING: "info", QUALITY_REVIEW: "info", review: "info", RECONCILIATION_REQUIRED: "warn", REFUND_PENDING: "warn", open: "warn", building: "info", planned: "info", draft: "",
  FAILED: "bad", EXPIRED: "bad", REJECTED: "bad", rejected: "bad", DISPUTED: "bad", disputed: "bad", CANCELLED: "bad", canceled: "bad", withdrawn: "bad", expired: "bad", blocked: "bad", suspended: "bad", failure: "bad", denied: "bad", invalid_output: "bad", discarded: "bad", mock: "warn", live: "ok",
};
export const Badge = ({ v }: { v: string | null | undefined }) => v ? <span className={`badge ${TONE[v] ?? ""}`}>{String(v).replace(/_/g, " ")}</span> : <span className="dim">—</span>;
export const Stat = ({ label, value, note }: { label: string; value: ReactNode; note?: string }) => <div className="card stat"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
export function Section({ title, sub, actions, children }: { title: string; sub?: string; actions?: ReactNode; children: ReactNode }) {
  return <section className="stack" style={{ marginBottom: 26 }}><div className="row between"><div><h3 style={{ fontSize: 17 }}>{title}</h3>{sub && <div className="muted small">{sub}</div>}</div>{actions}</div>{children}</section>;
}

export interface Col<T> { h: string; r: (row: T) => ReactNode; cls?: string }
export function Table<T>({ rows, cols, empty = "Belum ada data" }: { rows: T[]; cols: Col<T>[]; empty?: string }) {
  if (!rows.length) return <div className="card"><Empty title={empty} hint="Hanya catatan nyata yang ditampilkan — tidak ada data contoh." /></div>;
  return <div className="card pad0 tablewrap"><table><thead><tr>{cols.map((c) => <th key={c.h} className={c.cls}>{c.h}</th>)}</tr></thead>
    <tbody>{rows.map((row, i) => <tr key={i}>{cols.map((c) => <td key={c.h} className={c.cls}>{c.r(row)}</td>)}</tr>)}</tbody></table></div>;
}

/** Button that runs an async action with pending + error + success feedback. */
export function ActionButton({ run, children, cls = "btn sm", confirm, done }: { run: () => Promise<unknown>; children: ReactNode; cls?: string; confirm?: string; done?: string }) {
  const [state, setState] = useState<{ busy: boolean; err: unknown; ok: boolean }>({ busy: false, err: null, ok: false });
  return <span className="row" style={{ gap: 6 }}>
    <button className={cls} disabled={state.busy} onClick={async () => {
      if (confirm && !window.confirm(confirm)) return;
      setState({ busy: true, err: null, ok: false });
      try { await run(); setState({ busy: false, err: null, ok: true }); } catch (e) { setState({ busy: false, err: e, ok: false }); }
    }}>{state.busy ? <Spinner /> : children}</button>
    {state.err ? <span className="small" style={{ color: "var(--bad)" }}>{humanError(state.err)}</span> : null}
    {state.ok && done ? <span className="small" style={{ color: "var(--ok)" }}>{done}</span> : null}
  </span>;
}
export const short = (id: string | null | undefined) => (id ? <span className="mono dim small" title={id}>{id.slice(0, 4)}…{id.slice(-6)}</span> : <span className="dim">—</span>);
export function Tabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (t: string) => void }) {
  return <div className="tabs" role="tablist">{tabs.map((t) => <button key={t} role="tab" aria-selected={value === t} className={value === t ? "on" : ""} onClick={() => onChange(t)}>{t}</button>)}</div>;
}
