import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/** Minimal D1 adapter over node:sqlite with the real migrations applied — for integration tests only. */
export function makeD1() {
  const db = new DatabaseSync(":memory:");
  const dir = path.resolve(__dirname, "../apps/api/migrations");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  const norm = (a: unknown[]) => a.map((v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v)) as never[];
  const stmt = (sql: string, params: unknown[] = []) => {
    const s: any = {
      sql, params,
      bind: (...p: unknown[]) => stmt(sql, p),
      first: async () => (db.prepare(sql).get(...norm(params)) as unknown) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...norm(params)) }),
      run: async () => { const r = db.prepare(sql).run(...norm(params)); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
    };
    return s;
  };
  // Real D1 executes each batch as one server-side transaction; serialize them here like D1 does.
  let chain: Promise<unknown> = Promise.resolve();
  const runBatch = async (list: any[]) => { db.exec("BEGIN"); try { const out = []; for (const s of list) out.push(await s.run()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; } };
  const d1 = {
    prepare: (sql: string) => stmt(sql),
    batch: (list: any[]) => { const next = chain.then(() => runBatch(list)); chain = next.catch(() => undefined); return next; },
  };
  return { d1: d1 as unknown as D1Database, raw: db };
}
