import { useState, type FormEvent, type ReactNode } from "react";
import { humanError } from "../lib/api";
import { Spinner } from "./ui";

export interface FieldDef {
  name: string; label: string; type?: "text" | "textarea" | "number" | "money" | "select" | "checkbox" | "url" | "tel";
  options?: { value: string; label: string }[]; required?: boolean; placeholder?: string; hint?: string; full?: boolean; defaultValue?: string | number | boolean;
}
/** Generic validated form. Values are typed (number/money → integer) before submit; server revalidates everything. */
export function Form({ fields, submit, label = "Simpan", onDone, intro, cols = 2, resetOnSuccess = true, successText = "Tersimpan." }: {
  fields: FieldDef[]; submit: (v: Record<string, any>) => Promise<unknown>; label?: string; onDone?: (r: unknown) => void; intro?: ReactNode; cols?: 1 | 2; resetOnSuccess?: boolean; successText?: string;
}) {
  const init = () => Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? (f.type === "checkbox" ? false : f.type === "select" ? f.options?.[0]?.value ?? "" : "")]));
  const [values, setValues] = useState<Record<string, any>>(init);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [ok, setOk] = useState(false);
  const set = (k: string, v: any) => setValues((s) => ({ ...s, [k]: v }));
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null); setOk(false);
    const out: Record<string, any> = {};
    for (const f of fields) {
      const v = values[f.name];
      if (f.type === "number" || f.type === "money") { if (v === "" || v === null) { if (f.required) return setErr(new Error(`${f.label} wajib diisi`)); continue; } const n = Number(String(v).replace(/[^\d-]/g, "")); if (!Number.isSafeInteger(n)) return setErr(new Error(`${f.label} harus bilangan bulat`)); out[f.name] = n; }
      else if (f.type === "checkbox") out[f.name] = Boolean(v);
      else { const t = String(v ?? "").trim(); if (!t) { if (f.required) return setErr(new Error(`${f.label} wajib diisi`)); out[f.name] = null; } else out[f.name] = t; }
    }
    setBusy(true);
    try { const r = await submit(out); setOk(true); if (resetOnSuccess) setValues(init()); onDone?.(r); } catch (e2) { setErr(e2); } finally { setBusy(false); }
  };
  return <form onSubmit={onSubmit} className="stack">
    {intro}
    <div className={`grid ${cols === 2 ? "g2" : ""}`}>{fields.map((f) => <div key={f.name} className="field" style={f.full || f.type === "textarea" ? { gridColumn: "1 / -1" } : undefined}>
      {f.type !== "checkbox" && <label htmlFor={`f-${f.name}`}>{f.label}{f.required && " *"}</label>}
      {f.type === "textarea" ? <textarea id={`f-${f.name}`} value={values[f.name]} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />
        : f.type === "select" ? <select id={`f-${f.name}`} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        : f.type === "checkbox" ? <label className="row small" style={{ gap: 8, color: "var(--text)" }}><input type="checkbox" style={{ width: "auto" }} checked={values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />{f.label}{f.required && " *"}</label>
        : <input id={`f-${f.name}`} type={f.type === "money" || f.type === "number" ? "text" : f.type ?? "text"} inputMode={f.type === "money" || f.type === "number" ? "numeric" : undefined} value={values[f.name]} placeholder={f.placeholder ?? (f.type === "money" ? "contoh: 150000 (IDR)" : undefined)} onChange={(e) => set(f.name, e.target.value)} />}
      {f.hint && <span className="hint">{f.hint}</span>}
    </div>)}</div>
    {err ? <div className="alert bad">{humanError(err)}</div> : null}
    {ok ? <div className="alert ok">{successText}</div> : null}
    <div><button className="btn primary" disabled={busy}>{busy ? <Spinner /> : label}</button></div>
  </form>;
}
