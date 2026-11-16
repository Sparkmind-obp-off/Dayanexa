import { useState } from "react";
import { Link } from "react-router-dom";
import { dt, idr, useApi, useGet, usePublic } from "./lib/api";
import { useSession } from "./lib/session";
import { Form, type FieldDef } from "./components/Form";
import { ActionButton, Badge, Q, Section, Stat, Table, Tabs, short } from "./components/ui";

const post = (api: ReturnType<typeof useApi>, path: string, json: unknown = {}) => api(path, { method: "POST", json });
const patch = (api: ReturnType<typeof useApi>, path: string, json: unknown) => api(path, { method: "PATCH", json });
function NewPanel({ title, fields, submit, label = "Simpan", perm }: { title: string; fields: FieldDef[]; submit: (v: any) => Promise<unknown>; label?: string; perm?: string }) {
  const { can } = useSession();
  if (perm && !can(perm)) return null;
  return <details className="card"><summary>{title}</summary><div style={{ marginTop: 14 }}><Form fields={fields} submit={submit} label={label} /></div></details>;
}
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v}`);

// 1. Executive Command
export function Executive() {
  const q = useGet<any>("/metrics/executive", { refetchInterval: 60_000 });
  return <Q q={q}>{(m) => <div className="stack" style={{ gap: 18 }}>
    <div className="grid g4">
      <Stat label="Verified Economic Resolution" value={m.northStar.verifiedEconomicResolutions} note={m.northStar.definition} />
      <Stat label="Pendapatan terverifikasi" value={idr(m.verifiedRevenueMinor)} note="Hanya dari jurnal ledger yang diposting" />
      <Stat label="Demand tervalidasi" value={m.pipeline.validatedDemand} note={`${m.pipeline.demandHypotheses} hipotesis menunggu`} />
      <Stat label="Misi aktif" value={m.pipeline.activeMissions} note={`${m.pipeline.awaitingAcceptance} menunggu penerimaan`} />
    </div>
    <div className="grid g3">
      <div className="card"><h3>Perlu perhatian</h3><dl className="kv"><dt>Persetujuan tertunda</dt><dd><Link to="/app/w/governance">{m.attention.pendingApprovals}</Link></dd><dt>Sengketa terbuka</dt><dd>{m.attention.openDisputes}</dd><dt>Rekonsiliasi pembayaran</dt><dd><Link to="/app/w/ledger">{m.attention.paymentsNeedingReconciliation}</Link></dd></dl></div>
      <div className="card"><h3>Pipeline</h3><dl className="kv"><dt>Sinyal</dt><dd>{m.pipeline.signals}</dd><dt>Hipotesis</dt><dd>{m.pipeline.demandHypotheses}</dd><dt>Peluang terbuka</dt><dd>{m.pipeline.openOpportunities}</dd></dl></div>
      <div className="card"><h3>Integritas</h3><dl className="kv"><dt>Intent mock</dt><dd>{m.integrity.mockPaymentIntents} (dikecualikan dari pendapatan)</dd><dt>Trial balance</dt><dd>{m.integrity.ledger.balanced ? <Badge v="success" /> : <Badge v="failure" />} D {idr(m.integrity.ledger.debits)} / K {idr(m.integrity.ledger.credits)}</dd></dl></div>
    </div>
    <Section title="Funnel misi"><Table rows={m.missionFunnel} empty="Belum ada misi" cols={[{ h: "Status", r: (r: any) => <Badge v={r.status} /> }, { h: "Jumlah", r: (r: any) => r.n }]} /></Section>
    <div className="small dim">Per {dt(m.asOf)} · dihitung langsung dari catatan kanonik, tanpa angka placeholder.</div>
  </div>}</Q>;
}

// 2. Market Radar
export function MarketRadar() {
  const api = useApi();
  const [tab, setTab] = useState("Sinyal");
  const signals = useGet<any>("/signals?limit=100");
  const sources = useGet<any>("/sources");
  const providers = useGet<any>("/providers");
  return <div>
    <Tabs tabs={["Sinyal", "Discovery", "Sumber", "Provider"]} value={tab} onChange={setTab} />
    {tab === "Sinyal" && <><NewPanel perm="intel:write" title="+ Catat sinyal manual" fields={[{ name: "title", label: "Judul", required: true }, { name: "url", label: "URL sumber", type: "url" }, { name: "content", label: "Isi / kutipan", type: "textarea", required: true }]} submit={(v) => post(api, "/signals", v).then(() => signals.refetch())} />
      <div className="alert small" style={{ margin: "12px 0" }}>Sinyal adalah observasi, bukan bukti demand. Klasifikasi AI (Workers AI) adalah inferensi.</div>
      <Q q={signals}>{(d) => <Table rows={d.items} empty="Belum ada sinyal" cols={[
        { h: "Sinyal", r: (s: any) => <div><div>{s.title}</div>{s.url && <a className="small" href={s.url} target="_blank" rel="noreferrer">{s.url.slice(0, 60)}</a>}</div> },
        { h: "Provider", r: (s: any) => <span className="small">{s.provider_id} · {s.collection_method}</span> }, { h: "Status", r: (s: any) => <Badge v={s.status} /> },
        { h: "Klasifikasi AI", r: (s: any) => { const c = s.classification_json ? JSON.parse(s.classification_json) : null; return c ? <span className="small">{c.is_demand_signal ? "kebutuhan" : "bukan"} · {c.category} · {c.confidence}%</span> : <span className="dim">—</span>; } },
        { h: "Ditangkap", r: (s: any) => <span className="small">{dt(s.captured_at)}</span> },
        { h: "", r: (s: any) => <div className="row">{s.status !== "discarded" && <ActionButton run={() => post(api, `/signals/${s.id}/classify`).then(() => signals.refetch())}>Klasifikasi AI</ActionButton>}{s.status !== "discarded" && <ActionButton cls="btn ghost sm" run={() => post(api, `/signals/${s.id}/discard`).then(() => signals.refetch())}>Buang</ActionButton>}</div> },
      ]} />}</Q></>}
    {tab === "Discovery" && <div className="grid g2">
      <div className="card"><h3>Pencarian (Tavily)</h3><p className="small muted">Batas kredit harian ditegakkan server. Tidak ada fallback berbayar.</p><Form label="Cari" fields={[{ name: "query", label: "Query", required: true, full: true, placeholder: "contoh: UMKM butuh aplikasi kasir offline" }, { name: "maxResults", label: "Maks hasil (1-10)", type: "number", defaultValue: 5 }, { name: "depth", label: "Kedalaman", type: "select", options: [{ value: "basic", label: "basic (1 kredit)" }, { value: "advanced", label: "advanced (2 kredit)" }] }]} submit={(v) => post(api, "/discovery/search", v)} successText="Selesai — sinyal baru ada di tab Sinyal." /></div>
      <div className="card"><h3>Ekstraksi halaman (Firecrawl)</h3><p className="small muted">Hanya URL publik (proteksi SSRF). Hormati ketentuan situs.</p><Form label="Ekstrak" cols={1} fields={[{ name: "url", label: "URL", type: "url", required: true }]} submit={(v) => post(api, "/discovery/extract", v)} successText="Halaman diekstrak menjadi sinyal." /></div>
      <div className="card" style={{ gridColumn: "1/-1" }}><h3>Koleksi spesifik (Apify / Scrape.ly)</h3><p className="small muted">Nonaktif secara default. Actor harus di-review & masuk allowlist pemilik; biaya dibatasi per run. Jalankan sebagai benchmark untuk memilih provider.</p>
        <Form label="Jalankan" fields={[{ name: "provider", label: "Provider", type: "select", options: [{ value: "apify", label: "Apify" }, { value: "scrapely", label: "Scrape.ly" }] }, { name: "actorId", label: "Actor ID (user~actor)", required: true }, { name: "sourceLabel", label: "Label sumber", required: true }, { name: "maxItems", label: "Maks item", type: "number", defaultValue: 10 }, { name: "benchmark", label: "Jalankan sebagai benchmark", type: "checkbox", defaultValue: true }]} submit={(v) => post(api, "/discovery/actor-run", { ...v, input: {} })} /></div>
    </div>}
    {tab === "Sumber" && <><NewPanel perm="intel:write" title="+ Daftarkan sumber" fields={[{ name: "name", label: "Nama", required: true }, { name: "kind", label: "Jenis", type: "select", options: ["search", "website", "platform", "customer", "partner", "manual"].map((v) => ({ value: v, label: v })) }, { name: "baseUrl", label: "URL dasar", type: "url" }, { name: "termsNote", label: "Catatan ketentuan & izin penggunaan", type: "textarea", required: true }]} submit={(v) => post(api, "/sources", v).then(() => sources.refetch())} />
      <div style={{ marginTop: 12 }}><Q q={sources}>{(d) => <Table rows={d.items} empty="Belum ada sumber" cols={[{ h: "Nama", r: (s: any) => s.name }, { h: "Jenis", r: (s: any) => s.kind }, { h: "Ketentuan", r: (s: any) => <span className="small clip">{s.terms_note}</span> }, { h: "Status", r: (s: any) => <Badge v={s.status} /> },
        { h: "", r: (s: any) => <ActionButton run={() => patch(api, `/sources/${s.id}`, { status: s.status === "active" ? "paused" : "active" }).then(() => sources.refetch())}>{s.status === "active" ? "Jeda" : "Aktifkan"}</ActionButton> }]} />}</Q></div></>}
    {tab === "Provider" && <Q q={providers}>{(d) => <>
      <Table rows={d.providers} cols={[{ h: "Provider", r: (p: any) => <b>{p.id}</b> }, { h: "Layer", r: (p: any) => p.layer }, { h: "Peran", r: (p: any) => <span className="small">{p.role}</span> }, { h: "Konfigurasi", r: (p: any) => <Badge v={p.configured ? "success" : "pending"} /> }, { h: "Aktif", r: (p: any) => <Badge v={p.enabled ? "active" : "draft"} /> }, { h: "Mode", r: (p: any) => <span className="small">{p.mode}</span> }, { h: "Cap harian", r: (p: any) => p.dailyCap ?? "—" }, { h: "Fallback", r: (p: any) => <span className="small">{p.fallback}</span> }, { h: "Catatan", r: (p: any) => <span className="small dim">{p.notes}</span> }]} />
      <Section title="Pemakaian 30 hari"><Table rows={d.usage} empty="Belum ada pemakaian" cols={[{ h: "Hari", r: (u: any) => u.day }, { h: "Provider", r: (u: any) => u.provider_id }, { h: "Status", r: (u: any) => <Badge v={u.status} /> }, { h: "Panggilan", r: (u: any) => u.calls }, { h: "Unit", r: (u: any) => `${u.units} ${u.unit_type}` }]} /></Section>
    </>}</Q>}
  </div>;
}

// 3. Demand Intelligence
export function DemandIntel() {
  const api = useApi();
  const q = useGet<any>("/demands?limit=100");
  const [open, setOpen] = useState<string | null>(null);
  return <div className="stack">
    <NewPanel perm="intel:write" title="+ Hipotesis demand baru (dari pasar)" fields={[{ name: "title", label: "Judul", required: true }, { name: "segment", label: "Segmen" }, { name: "problem", label: "Masalah", type: "textarea", required: true }, { name: "desiredOutcome", label: "Hasil diinginkan", type: "textarea" }, { name: "urgency", label: "Urgensi", type: "select", options: [{ value: "medium", label: "medium" }, { value: "low", label: "low" }, { value: "high", label: "high" }] }]} submit={(v) => post(api, "/demands", { ...v, signalIds: [] }).then(() => q.refetch())} />
    <Q q={q}>{(d) => <Table rows={d.items} empty="Belum ada demand" cols={[
      { h: "Demand", r: (x: any) => <button className="btn ghost sm" onClick={() => setOpen(open === x.id ? null : x.id)}>{x.title}</button> }, { h: "Asal", r: (x: any) => <Badge v={x.origin} /> }, { h: "Status", r: (x: any) => <Badge v={x.status} /> },
      { h: "Bukti", r: (x: any) => <span className="small">+{x.supporting_evidence} / −{x.contradicting_evidence}</span> }, { h: "Confidence", r: (x: any) => pct(x.demand_confidence) }, { h: "Dibuat", r: (x: any) => <span className="small">{dt(x.created_at)}</span> }]} />}</Q>
    {open && <DemandDetail id={open} onChange={() => q.refetch()} />}
  </div>;
}
function DemandDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const api = useApi();
  const q = useGet<any>(`/demands/${id}`);
  const signals = useGet<any>("/signals?limit=100");
  return <Q q={q}>{(d) => <div className="card stack">
    <div className="row between"><h3>{d.demand.title}</h3><Badge v={d.demand.status} /></div><p className="pre muted" style={{ margin: 0 }}>{d.demand.problem}</p>
    {d.demand.desired_outcome && <div className="small"><b>Hasil:</b> {d.demand.desired_outcome}</div>}
    <Section title="Bukti"><Table rows={d.evidence} empty="Belum ada bukti" cols={[{ h: "Sikap", r: (e: any) => <Badge v={e.stance === "supports" ? "success" : "failure"} /> }, { h: "Sinyal", r: (e: any) => e.url ? <a href={e.url} target="_blank" rel="noreferrer">{e.title}</a> : e.title }, { h: "Catatan", r: (e: any) => e.note }, { h: "Provider", r: (e: any) => <span className="small">{e.provider_id}</span> }]} /></Section>
    <div className="grid g2">
      <div className="card"><h3>Tautkan bukti</h3><Form label="Tautkan" cols={1} fields={[{ name: "signalId", label: "Sinyal", type: "select", options: (signals.data?.items ?? []).filter((s: any) => s.status !== "discarded").map((s: any) => ({ value: s.id, label: s.title.slice(0, 70) })) }, { name: "stance", label: "Sikap", type: "select", options: [{ value: "supports", label: "Mendukung" }, { value: "contradicts", label: "Membantah" }] }, { name: "note", label: "Catatan", required: true }]} submit={(v) => post(api, `/demands/${id}/evidence`, v).then(() => { q.refetch(); onChange(); })} /></div>
      <div className="card"><h3>Transisi status</h3><p className="small muted">Validasi butuh ≥2 bukti pendukung dari ≥2 sumber berbeda + confidence + alasan.</p><Form label="Terapkan" cols={1} fields={[{ name: "to", label: "Ke", type: "select", options: ["DEMAND_EVIDENCE_PENDING", "DEMAND_VALIDATED", "DEFERRED", "REJECTED"].map((v) => ({ value: v, label: v })) }, { name: "demandConfidence", label: "Confidence (0-100, untuk validasi)", type: "number" }, { name: "reason", label: "Alasan", type: "textarea", required: true }]} submit={(v) => post(api, `/demands/${id}/transition`, v).then(() => { q.refetch(); onChange(); })} /></div>
    </div>
    <Section title="Riwayat"><Table rows={d.transitions} cols={[{ h: "Dari", r: (t: any) => <Badge v={t.from_state} /> }, { h: "Ke", r: (t: any) => <Badge v={t.to_state} /> }, { h: "Alasan", r: (t: any) => t.reason }, { h: "Waktu", r: (t: any) => dt(t.created_at) }]} /></Section>
  </div>}</Q>;
}

// 4. Opportunity Universe
export function Opportunities() {
  const api = useApi();
  const q = useGet<any>("/opportunities?limit=100");
  const demands = useGet<any>("/demands?limit=200");
  const [open, setOpen] = useState<string | null>(null);
  return <div className="stack">
    <NewPanel perm="intel:write" title="+ Peluang dari demand tervalidasi" fields={[{ name: "demandId", label: "Demand tervalidasi", type: "select", options: (demands.data?.items ?? []).filter((x: any) => x.status === "DEMAND_VALIDATED").map((x: any) => ({ value: x.id, label: x.title })) }, { name: "title", label: "Judul", required: true }, { name: "summary", label: "Ringkasan", type: "textarea", required: true }]} submit={(v) => post(api, "/opportunities", v).then(() => q.refetch())} />
    <Q q={q}>{(d) => <Table rows={d.items} empty="Belum ada peluang" cols={[{ h: "Peluang", r: (o: any) => <button className="btn ghost sm" onClick={() => setOpen(open === o.id ? null : o.id)}>{o.title}</button> }, { h: "Status", r: (o: any) => <Badge v={o.status} /> },
      { h: "Demand / Komersial / Kelayakan / Strategis", r: (o: any) => <span className="mono small">{pct(o.demand_confidence)} / {pct(o.commercial_potential)} / {pct(o.execution_feasibility)} / {pct(o.strategic_value)}</span> }, { h: "Risiko", r: (o: any) => o.risk_level ? <Badge v={o.risk_level === "low" ? "success" : o.risk_level === "medium" ? "pending" : "failure"} /> : "—" }, { h: "Metode", r: (o: any) => <span className="small">{o.assessment_method ?? "—"}</span> }]} />}</Q>
    {open && <OpportunityDetail id={open} onChange={() => q.refetch()} />}
  </div>;
}
function OpportunityDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const api = useApi();
  const q = useGet<any>(`/opportunities/${id}`);
  const [draft, setDraft] = useState<any>(null);
  const [key, setKey] = useState(0);
  return <Q q={q}>{(d) => <div className="card stack">
    <div className="row between"><h3>{d.opportunity.title}</h3><Badge v={d.opportunity.status} /></div><p className="muted" style={{ margin: 0 }}>{d.opportunity.summary}</p>
    <div className="grid g2">
      <div className="card"><div className="row between"><h3>Penilaian (5 dimensi terpisah)</h3><ActionButton run={async () => { const r = await post(api, `/opportunities/${id}/ai-assist`) as any; setDraft({ ...r.draft, traceId: r.traceId }); setKey((k) => k + 1); }}>Draft AI</ActionButton></div>
        {draft && <div className="alert warn small">Draft Workers AI dimuat ke formulir. Wajib ditinjau manusia. Bukti kurang: {draft.missing_evidence?.join("; ") || "—"}</div>}
        <Form key={key} label="Simpan penilaian" fields={[
          { name: "demandConfidence", label: "Demand confidence", type: "number", required: true, defaultValue: draft?.demand_confidence ?? "" }, { name: "commercialPotential", label: "Potensi komersial", type: "number", required: true, defaultValue: draft?.commercial_potential ?? "" },
          { name: "executionFeasibility", label: "Kelayakan eksekusi", type: "number", required: true, defaultValue: draft?.execution_feasibility ?? "" }, { name: "strategicValue", label: "Nilai strategis", type: "number", required: true, defaultValue: draft?.strategic_value ?? "" },
          { name: "riskLevel", label: "Risiko", type: "select", options: ["low", "medium", "high", "critical"].map((v) => ({ value: v, label: v })), defaultValue: draft?.risk_level ?? "medium" }, { name: "rationale", label: "Alasan", type: "textarea", required: true, defaultValue: draft?.rationale ?? "" }]}
          submit={(v) => post(api, `/opportunities/${id}/assessments`, { ...v, inferenceTraceId: draft?.traceId ?? null }).then(() => { setDraft(null); q.refetch(); onChange(); })} /></div>
      <div className="card"><h3>Transisi</h3><Form label="Terapkan" cols={1} fields={[{ name: "to", label: "Ke", type: "select", options: ["SOLUTION_DESIGNED", "CAPABILITY_ASSESSMENT", "CAPABILITY_READY", "CAPABILITY_GAP_IDENTIFIED", "CAPABILITY_FORMATION_PLANNED", "COMMERCIAL_MODEL_DESIGNED", "OFFER_READY", "DEFERRED", "REJECTED", "CLOSED"].map((v) => ({ value: v, label: v })) }, { name: "reason", label: "Alasan", type: "textarea", required: true }]} submit={(v) => post(api, `/opportunities/${id}/transition`, v).then(() => { q.refetch(); onChange(); })} />
        <h3 style={{ marginTop: 18 }}>Solusi baru</h3><Form label="Tambah solusi" cols={1} fields={[{ name: "title", label: "Judul", required: true }, { name: "kind", label: "Jenis", type: "select", options: ["service", "product", "software", "package", "managed_outcome", "partner"].map((v) => ({ value: v, label: v })) }, { name: "description", label: "Deskripsi", type: "textarea", required: true }, { name: "feasibilityNote", label: "Catatan kelayakan", type: "textarea" }]} submit={(v) => post(api, `/opportunities/${id}/solutions`, v).then(() => q.refetch())} /></div>
    </div>
    <Section title="Riwayat penilaian"><Table rows={d.assessments} empty="Belum dinilai" cols={[{ h: "D/K/E/S", r: (a: any) => <span className="mono small">{a.demand_confidence}/{a.commercial_potential}/{a.execution_feasibility}/{a.strategic_value}</span> }, { h: "Risiko", r: (a: any) => a.risk_level }, { h: "Metode", r: (a: any) => a.method }, { h: "Alasan", r: (a: any) => <span className="small">{a.rationale}</span> }, { h: "Waktu", r: (a: any) => dt(a.created_at) }]} /></Section>
    <Section title="Solusi"><Table rows={d.solutions} empty="Belum ada solusi" cols={[{ h: "Solusi", r: (s: any) => s.title }, { h: "Jenis", r: (s: any) => s.kind }, { h: "Status", r: (s: any) => <Badge v={s.status} /> }]} /></Section>
  </div>}</Q>;
}

// 5. Solution Studio
export function Solutions() {
  const api = useApi();
  const q = useGet<any>("/solutions");
  return <Q q={q}>{(d) => <div className="stack">
    <Table rows={d.items} empty="Belum ada solusi — tambahkan dari Opportunity Universe" cols={[{ h: "Solusi", r: (s: any) => <div><b>{s.title}</b><div className="small muted clip">{s.description}</div></div> }, { h: "Peluang", r: (s: any) => <span className="small">{s.opportunity_title}</span> }, { h: "Jenis", r: (s: any) => s.kind }, { h: "Gap terbuka", r: (s: any) => s.open_gaps }, { h: "Status", r: (s: any) => <Badge v={s.status} /> },
      { h: "", r: (s: any) => <div className="row">{s.status !== "approved" && <ActionButton run={() => patch(api, `/solutions/${s.id}`, { status: "approved" }).then(() => q.refetch())}>Setujui</ActionButton>}{s.status !== "rejected" && <ActionButton cls="btn ghost sm" run={() => patch(api, `/solutions/${s.id}`, { status: "rejected" }).then(() => q.refetch())}>Tolak</ActionButton>}</div> }]} />
    <NewPanel perm="intel:write" title="+ Catat gap kapabilitas pada solusi" fields={[{ name: "solutionId", label: "Solusi", type: "select", options: d.items.map((s: any) => ({ value: s.id, label: s.title })) }, { name: "capabilityName", label: "Kapabilitas", required: true }, { name: "resolution", label: "Resolusi", type: "select", options: ["build", "reuse", "compose", "acquire", "integrate", "partner", "contributor", "defer", "reject"].map((v) => ({ value: v, label: v })) }, { name: "plan", label: "Rencana", type: "textarea", required: true }]} submit={({ solutionId, ...v }) => post(api, `/solutions/${solutionId}/gaps`, v).then(() => q.refetch())} />
  </div>}</Q>;
}

// 6. Capability Foundry
export function Capabilities() {
  const api = useApi();
  const q = useGet<any>("/capabilities");
  return <Q q={q}>{(d) => <div className="stack">
    <NewPanel perm="intel:write" title="+ Daftarkan kapabilitas" fields={[{ name: "name", label: "Nama", required: true }, { name: "kind", label: "Jenis", type: "select", options: ["agent", "tool", "provider", "human", "process", "software"].map((v) => ({ value: v, label: v })) }, { name: "description", label: "Deskripsi", type: "textarea", required: true }, { name: "limitsNote", label: "Batasan" }, { name: "costNote", label: "Catatan biaya" }]} submit={(v) => post(api, "/capabilities", v).then(() => q.refetch())} />
    <Section title="Inventaris"><Table rows={d.items} empty="Belum ada kapabilitas" cols={[{ h: "Nama", r: (c: any) => c.name }, { h: "Jenis", r: (c: any) => c.kind }, { h: "Batasan", r: (c: any) => <span className="small">{c.limits_note ?? "—"}</span> }, { h: "Kesiapan", r: (c: any) => <Badge v={c.readiness} /> },
      { h: "", r: (c: any) => <select style={{ width: 130 }} value={c.readiness} onChange={(e) => patch(api, `/capabilities/${c.id}`, { readiness: e.target.value }).then(() => q.refetch())}>{["planned", "building", "ready", "retired"].map((v) => <option key={v}>{v}</option>)}</select> }]} /></Section>
    <Section title="Gap kapabilitas"><Table rows={d.gaps} empty="Tidak ada gap" cols={[{ h: "Kapabilitas", r: (g: any) => g.capability_name }, { h: "Solusi", r: (g: any) => <span className="small">{g.solution_title}</span> }, { h: "Resolusi", r: (g: any) => g.resolution }, { h: "Rencana", r: (g: any) => <span className="small">{g.plan}</span> }, { h: "Status", r: (g: any) => <Badge v={g.status} /> },
      { h: "", r: (g: any) => <select style={{ width: 120 }} value={g.status} onChange={(e) => patch(api, `/gaps/${g.id}`, { status: e.target.value }).then(() => q.refetch())}>{["open", "planned", "resolved", "rejected"].map((v) => <option key={v}>{v}</option>)}</select> }]} /></Section>
  </div>}</Q>;
}

// 7. Product & Service Catalog
export function CatalogWs() {
  const api = useApi();
  const q = useGet<any>("/products");
  const subs = useGet<any>("/subscriptions");
  return <div className="stack">
    <NewPanel perm="catalog:write" title="+ Produk / layanan baru" fields={[{ name: "name", label: "Nama", required: true }, { name: "kind", label: "Jenis", type: "select", options: ["service", "product", "package", "solution", "managed", "subscription"].map((v) => ({ value: v, label: v })) }, { name: "description", label: "Deskripsi", type: "textarea", required: true }]} submit={(v) => post(api, "/products", v).then(() => q.refetch())} />
    <Q q={q}>{(d) => <Table rows={d.items} empty="Belum ada produk" cols={[{ h: "Produk", r: (p: any) => <div><b>{p.name}</b><div className="small muted clip">{p.description}</div></div> }, { h: "Jenis", r: (p: any) => p.kind }, { h: "Status", r: (p: any) => <Badge v={p.status} /> }, { h: "Publik", r: (p: any) => p.is_public ? <Badge v="published" /> : "—" },
      { h: "", r: (p: any) => <div className="row">{p.status !== "active" && <ActionButton run={() => patch(api, `/products/${p.id}`, { status: "active" }).then(() => q.refetch())}>Aktifkan</ActionButton>}{p.status === "active" && <ActionButton run={() => patch(api, `/products/${p.id}`, { isPublic: !p.is_public }).then(() => q.refetch())}>{p.is_public ? "Sembunyikan" : "Publikasikan"}</ActionButton>}</div> }]} />}</Q>
    <Section title="Langganan SaaS (Free / Pro / Plus)"><Q q={subs}>{(d) => <Table rows={d.items} empty="Belum ada langganan" cols={[{ h: "Organisasi", r: (s: any) => s.org_name }, { h: "Paket", r: (s: any) => s.plan_code }, { h: "Status", r: (s: any) => <Badge v={s.status} /> }, { h: "Pembayaran", r: (s: any) => s.payment_status ? <span className="row"><Badge v={s.payment_status} /><Badge v={s.mode} /></span> : "—" }, { h: "Berakhir", r: (s: any) => dt(s.current_period_end) }]} />}</Q></Section>
  </div>;
}

// 8. Agent Workforce
export function Agents() {
  const api = useApi();
  const q = useGet<any>("/agents");
  const ai = useGet<any>("/ai/status");
  return <div className="stack">
    <Q q={ai}>{(a) => <div className="grid g4">
      <Stat label="Provider default" value={a.status.defaultProvider} note={a.status.workersAi.bindingPresent ? "binding env.AI aktif" : "binding env.AI tidak ada"} />
      <Stat label="Neuron hari ini" value={Number(a.totals?.neurons_today ?? 0).toFixed(1)} note={`budget ${a.status.workersAi.dailyNeuronBudget}/hari (estimasi)`} />
      <Stat label="Neuron bulan ini" value={Number(a.totals?.neurons_month ?? 0).toFixed(1)} note={`budget ${a.status.workersAi.monthlyNeuronBudget}/bulan`} />
      <Stat label="GroqCloud" value={a.status.groq.enabled ? "aktif" : "nonaktif"} note="tidak pernah jadi fallback otomatis" />
    </div>}</Q>
    <NewPanel perm="mission:write" title="+ Daftarkan agen" fields={[{ name: "name", label: "Nama", required: true }, { name: "taskProfile", label: "Task profile", type: "select", options: ["classification", "extraction", "reasoning", "generation"].map((v) => ({ value: v, label: v })) }, { name: "purpose", label: "Tujuan", type: "textarea", required: true }, { name: "dailyNeuronBudget", label: "Budget neuron harian", type: "number", defaultValue: 500 }, { name: "escalationRule", label: "Aturan eskalasi ke manusia", type: "textarea", required: true }]} submit={(v) => post(api, "/agents", { ...v, allowedTools: [] }).then(() => q.refetch())} />
    <Q q={q}>{(d) => <Table rows={d.items} empty="Belum ada agen" cols={[{ h: "Agen", r: (a: any) => <div><b>{a.name}</b><div className="small muted">{a.purpose}</div></div> }, { h: "Profil", r: (a: any) => a.task_profile }, { h: "Budget", r: (a: any) => a.daily_neuron_budget }, { h: "Eskalasi", r: (a: any) => <span className="small">{a.escalation_rule}</span> }, { h: "Status", r: (a: any) => <Badge v={a.status} /> },
      { h: "", r: (a: any) => <ActionButton run={() => patch(api, `/agents/${a.id}`, { status: a.status === "active" ? "paused" : "active" }).then(() => q.refetch())}>{a.status === "active" ? "Jeda" : "Aktifkan"}</ActionButton> }]} />}</Q>
    <Q q={ai}>{(a) => <Section title="Jejak inferensi terbaru"><Table rows={a.traces} empty="Belum ada inferensi" cols={[{ h: "Waktu", r: (t: any) => <span className="small">{dt(t.created_at)}</span> }, { h: "Profil", r: (t: any) => t.task_profile }, { h: "Model", r: (t: any) => <span className="mono small">{t.model_id}</span> }, { h: "Status", r: (t: any) => <Badge v={t.status} /> }, { h: "Kebijakan", r: (t: any) => <span className="small">{t.policy_decision}</span> }, { h: "Neuron", r: (t: any) => `${Number(t.estimated_neurons).toFixed(2)}${t.usage_estimated ? " (est.)" : ""}` }, { h: "Latensi", r: (t: any) => t.latency_ms ? `${t.latency_ms} ms` : "—" }]} /></Section>}</Q>
  </div>;
}

// 9. Execution Control
export function Execution() {
  const api = useApi();
  const q = useGet<any>("/missions");
  const offers = useGet<any>("/offers");
  const agents = useGet<any>("/agents");
  const users = useGet<any>("/users");
  const [open, setOpen] = useState<string | null>(null);
  return <div className="stack">
    <NewPanel perm="mission:write" title="+ Rencanakan misi dari penawaran yang diterima" fields={[{ name: "offerId", label: "Penawaran diterima", type: "select", options: (offers.data?.items ?? []).filter((o: any) => o.status === "accepted").map((o: any) => ({ value: o.id, label: o.title })) }, { name: "title", label: "Judul misi", required: true }, { name: "budgetMinor", label: "Budget (IDR)", type: "money" }]} submit={(v) => post(api, "/missions", v).then(() => q.refetch())} />
    <Q q={q}>{(d) => <Table rows={d.items} empty="Belum ada misi" cols={[{ h: "Misi", r: (m: any) => <button className="btn ghost sm" onClick={() => setOpen(open === m.id ? null : m.id)}>{m.title}</button> }, { h: "Status", r: (m: any) => <Badge v={m.status} /> }, { h: "Tugas", r: (m: any) => `${m.tasks_done}/${m.task_count}` }, { h: "Pembayaran", r: (m: any) => m.payment_status ? <span className="row"><Badge v={m.payment_status} /><Badge v={m.payment_mode} /></span> : "—" }, { h: "Tenggat", r: (m: any) => <span className="small">{dt(m.due_at)}</span> }, { h: "", r: (m: any) => <Link className="btn sm" to={`/app/missions/${m.id}`}>Detail</Link> }]} />}</Q>
    {open && <div className="card stack"><h3>Kendali misi {short(open)}</h3><div className="grid g2">
      <div className="card"><h3>Tambah tugas</h3><Form label="Tambah" fields={[{ name: "title", label: "Judul", required: true }, { name: "executorType", label: "Pelaksana", type: "select", options: [{ value: "agent", label: "Agen AI" }, { value: "human", label: "Kontributor" }] },
        { name: "agentId", label: "Agen (jika AI)", type: "select", options: [{ value: "", label: "—" }, ...(agents.data?.items ?? []).filter((a: any) => a.status === "active").map((a: any) => ({ value: a.id, label: a.name }))] },
        { name: "assigneeUserId", label: "Kontributor terverifikasi", type: "select", options: [{ value: "", label: "—" }, ...(users.data?.items ?? []).filter((u: any) => u.contributor?.status === "verified").map((u: any) => ({ value: u.id, label: u.display_name ?? u.email }))] },
        { name: "compensationMinor", label: "Kompensasi (IDR, wajib untuk manusia)", type: "money" }, { name: "dueDays", label: "Tenggat (hari)", type: "number", defaultValue: 7 }, { name: "description", label: "Deskripsi", type: "textarea", required: true }, { name: "acceptanceCriteria", label: "Kriteria penerimaan", type: "textarea", required: true }]}
        submit={(v) => post(api, `/missions/${open}/tasks`, v).then(() => q.refetch())} /></div>
      <div className="stack">
        <div className="card"><h3>Transisi</h3><Form label="Terapkan" cols={1} fields={[{ name: "to", label: "Ke", type: "select", options: ["TASKS_DECOMPOSED", "RESOURCES_ASSIGNED", "EXECUTING", "QUALITY_REVIEW", "NEEDS_HUMAN_REVIEW", "SUSPENDED", "FAILED", "CANCELLED"].map((v) => ({ value: v, label: v })) }, { name: "reason", label: "Alasan", required: true }]} submit={(v) => post(api, `/missions/${open}/transition`, v).then(() => q.refetch())} /></div>
        <MissionTasks id={open} />
      </div>
    </div></div>}
  </div>;
}
function MissionTasks({ id }: { id: string }) {
  const api = useApi();
  const q = useGet<any>(`/missions/${id}`);
  const review = async (t: any, status: "done" | "in_progress") => { const note = window.prompt(status === "done" ? "Catatan penerimaan (opsional):" : "Revisi yang diminta:") ?? undefined; if (status === "in_progress" && !note) return; await patch(api, `/tasks/${t.id}`, { status, note: note || null }); q.refetch(); };
  return <Q q={q}>{(d) => <div className="card"><h3>Tugas</h3><Table rows={d.tasks} empty="Belum ada tugas" cols={[
    { h: "Tugas", r: (t: any) => <div><b>{t.title}</b><div className="small dim">{t.executor_type === "human" ? `${t.assignee_name ?? "—"} · ${idr(t.compensation_minor)}` : t.agent_name ?? "agen"}</div>{t.submission_note && <div className="small muted pre">Hasil: {t.submission_note}</div>}</div> },
    { h: "Status", r: (t: any) => <span className="row"><Badge v={t.status} />{t.contributor_decision && <Badge v={t.contributor_decision} />}</span> },
    { h: "", r: (t: any) => ["done", "cancelled"].includes(t.status) ? null : <div className="row">
      {t.status === "review" && t.executor_type === "human" ? <><ActionButton cls="btn primary sm" confirm={t.compensation_minor ? `Menerima hasil akan memposting payable ${idr(t.compensation_minor)} ke ledger. Lanjutkan?` : undefined} run={() => review(t, "done")}>Terima hasil</ActionButton><ActionButton cls="btn ghost sm" run={() => review(t, "in_progress")}>Minta revisi</ActionButton></>
        : <ActionButton confirm={t.executor_type === "human" && t.compensation_minor ? "Menerima tugas ini akan memposting kewajiban bayar kontributor ke ledger. Lanjutkan?" : undefined} run={() => review(t, "done")}>Terima selesai</ActionButton>}
      <ActionButton cls="btn ghost sm" run={() => patch(api, `/tasks/${t.id}`, { status: "cancelled" }).then(() => q.refetch())}>Batal</ActionButton></div> }]} /></div>}</Q>;
}

// 10. Commercial Control
export function Commercial() {
  const api = useApi();
  const q = useGet<any>("/offers");
  const demands = useGet<any>("/demands?limit=200");
  const opps = useGet<any>("/opportunities?limit=200");
  const quoteFields: FieldDef[] = [{ name: "title", label: "Judul", required: true, full: true },
    { name: "scope", label: "Ruang lingkup", type: "textarea", required: true }, { name: "deliverables", label: "Hasil (deliverables)", type: "textarea", required: true }, { name: "assumptions", label: "Asumsi", type: "textarea" }, { name: "exclusions", label: "Tidak termasuk", type: "textarea", required: true },
    { name: "acceptanceCriteria", label: "Kriteria penerimaan", type: "textarea", required: true }, { name: "revisionPolicy", label: "Kebijakan revisi", type: "textarea", defaultValue: "Maksimal 2 putaran revisi dalam ruang lingkup." }, { name: "refundTerms", label: "Syarat refund & sengketa", type: "textarea", required: true }, { name: "paymentTerms", label: "Jadwal pembayaran", type: "textarea", defaultValue: "100% di muka setelah penawaran disetujui." },
    { name: "serviceLayer", label: "Layer", type: "select", options: [{ value: "project", label: "B — Proyek sekali" }, { value: "managed", label: "C — Managed Operations (kontrak berulang terpisah)" }] },
    { name: "priceMinor", label: "Harga (IDR)", type: "money", required: true }, { name: "taxMinor", label: "Pajak (IDR)", type: "money", defaultValue: 0 }, { name: "estimatedDirectCostMinor", label: "Estimasi biaya langsung (IDR)", type: "money", defaultValue: 0, hint: "AI/provider + kompensasi kontributor + kontingensi" },
    { name: "minMarginBps", label: "Margin minimum (basis poin)", type: "number", defaultValue: 3000 }, { name: "deliveryDays", label: "Waktu pengerjaan (hari)", type: "number", required: true }, { name: "validDays", label: "Berlaku (hari)", type: "number", defaultValue: 14 }];
  const margin = (o: any) => o.price_minor ? Math.floor(((o.price_minor - (o.estimated_direct_cost_minor ?? 0)) * 10000) / o.price_minor) / 100 : 0;
  return <div className="stack">
    <NewPanel perm="commercial:write" title="+ Susun penawaran berversi (untuk demand tervalidasi)" fields={[{ name: "demandId", label: "Demand tervalidasi", type: "select", options: (demands.data?.items ?? []).filter((d: any) => d.status === "DEMAND_VALIDATED").map((d: any) => ({ value: d.id, label: `${d.title} (${d.origin})` })) },
      { name: "opportunityId", label: "Peluang (opsional)", type: "select", options: [{ value: "", label: "—" }, ...(opps.data?.items ?? []).map((o: any) => ({ value: o.id, label: o.title }))] }, ...quoteFields]}
      submit={(v) => post(api, "/offers", v).then(() => q.refetch())} />
    <Q q={q}>{(d) => <Table rows={d.items} empty="Belum ada penawaran" cols={[{ h: "Penawaran", r: (o: any) => <div><b>{o.title}</b> <span className="badge">v{o.version}</span><div className="small dim">{o.customer_name} · {o.service_layer}</div></div> }, { h: "Total", r: (o: any) => idr(o.price_minor + o.tax_minor) },
      { h: "Margin est.", r: (o: any) => <span className={margin(o) * 100 < o.min_margin_bps ? "badge bad" : "badge ok"}>{margin(o)}%</span> }, { h: "Status", r: (o: any) => <Badge v={o.status} /> }, { h: "Sidik", r: (o: any) => <span className="mono small dim">{o.snapshot_hash ? o.snapshot_hash.slice(0, 10) : "—"}</span> }, { h: "Berlaku", r: (o: any) => <span className="small">{dt(o.valid_until)}</span> },
      { h: "", r: (o: any) => <div className="row">
        {o.status === "draft" && <ActionButton run={async () => { const low = margin(o) * 100 < o.min_margin_bps; const reason = low ? window.prompt(`Margin ${margin(o)}% di bawah kebijakan ${o.min_margin_bps / 100}%. Alasan pengecualian:`) : null; if (low && !reason) return; await post(api, `/offers/${o.id}/request-publication`, { reason }); q.refetch(); }}>Bekukan & minta otorisasi</ActionButton>}
        {!["accepted", "draft", "authorization_pending"].includes(o.status) && <ActionButton cls="btn ghost sm" run={async () => { const p = window.prompt("Harga baru (IDR) untuk versi berikutnya (kosongkan bila sama):"); await post(api, `/offers/${o.id}/revise`, p ? { priceMinor: Number(p.replace(/\D/g, "")) } : {}); q.refetch(); }}>Versi baru</ActionButton>}
        {["draft", "authorization_pending", "published"].includes(o.status) && <ActionButton cls="btn ghost sm" confirm="Tarik penawaran ini?" run={() => post(api, `/offers/${o.id}/withdraw`).then(() => q.refetch())}>Tarik</ActionButton>}</div> }]} />}</Q>
    <div className="small dim">Ketentuan dibekukan (snapshot + SHA-256) saat diajukan; publikasi butuh persetujuan pengguna lain (maker-checker). Pelanggan hanya dapat menyetujui versi dengan sidik yang sama. Harga paket adalah hipotesis; harga final hanya dari penawaran yang diterima.</div>
  </div>;
}

// 11. Quality & Delivery
export function Delivery() {
  const api = useApi();
  const q = useGet<any>("/missions");
  const disputes = useGet<any>("/disputes");
  return <div className="stack">
    <Q q={q}>{(d) => { const rows = d.items.filter((m: any) => ["QUALITY_REVIEW", "READY_FOR_DELIVERY", "AWAITING_ACCEPTANCE", "DISPUTED"].includes(m.status)); return <Table rows={rows} empty="Tidak ada misi di tahap kualitas/delivery" cols={[{ h: "Misi", r: (m: any) => <Link to={`/app/missions/${m.id}`}>{m.title}</Link> }, { h: "Status", r: (m: any) => <Badge v={m.status} /> },
      { h: "Aksi", r: (m: any) => m.status === "QUALITY_REVIEW" ? <div className="row"><ActionButton run={() => post(api, `/missions/${m.id}/review`, { decision: "approved", notes: "Memenuhi kriteria penerimaan" }).then(() => q.refetch())}>Lulus QA</ActionButton><ActionButton cls="btn ghost sm" run={() => post(api, `/missions/${m.id}/review`, { decision: "changes_requested", notes: "Perlu revisi" }).then(() => q.refetch())}>Minta revisi</ActionButton></div>
        : m.status === "READY_FOR_DELIVERY" ? <ActionButton run={async () => { const note = window.prompt("Catatan delivery untuk pelanggan (min. 10 karakter):"); if (!note) return; await post(api, `/missions/${m.id}/deliver`, { note }); q.refetch(); }}>Kirim ke pelanggan</ActionButton>
        : <span className="small dim">menunggu pelanggan</span> }]} />; }}</Q>
    <Section title="Sengketa"><Q q={disputes}>{(d) => <Table rows={d.items} empty="Tidak ada sengketa" cols={[{ h: "Misi", r: (x: any) => x.mission_title }, { h: "Alasan", r: (x: any) => <span className="small">{x.reason}</span> }, { h: "Status", r: (x: any) => <Badge v={x.status} /> }, { h: "Dibuka", r: (x: any) => dt(x.created_at) },
      { h: "", r: (x: any) => x.status === "open" ? <ActionButton run={async () => { const resolution = window.prompt("Resolusi:"); if (!resolution) return; await post(api, `/disputes/${x.id}/resolve`, { status: "resolved", resolution }); disputes.refetch(); }}>Selesaikan</ActionButton> : null }]} />}</Q></Section>
  </div>;
}

// 12. Economic Ledger
export function Ledger() {
  const api = useApi();
  const [tab, setTab] = useState("Pembayaran");
  const intents = useGet<any>("/payments/intents?limit=100");
  const events = useGet<any>("/payments/events?limit=100");
  const accounts = useGet<any>("/ledger/accounts");
  const journals = useGet<any>("/ledger/journals?limit=50");
  const econ = useGet<any>("/economics/missions");
  const payouts = useGet<any>("/payouts");
  const refunds = useGet<any>("/refunds");
  const gw = useGet<any>("/payments/providers");
  const invoices = useGet<any>("/invoices");
  const cfg = usePublic<any>("/config");
  const sandboxAllowed = cfg.data && cfg.data.environment !== "production";
  return <div>
    <Tabs tabs={["Pembayaran", "Invoice", "Webhook", "Akun & jurnal", "Ekonomi misi", "Payout & refund", "Gateway"]} value={tab} onChange={setTab} />
    {tab === "Pembayaran" && <Q q={intents}>{(d) => <Table rows={d.items} empty="Belum ada pembayaran" cols={[{ h: "Order", r: (p: any) => <span className="mono small">{p.merchant_order_id}</span> }, { h: "Untuk", r: (p: any) => p.purpose === "subscription" ? `Langganan ${p.plan_code}` : p.offer_title }, { h: "Jumlah", r: (p: any) => idr(p.amount) }, { h: "Gateway", r: (p: any) => p.provider }, { h: "Mode", r: (p: any) => <Badge v={p.mode} /> }, { h: "Status", r: (p: any) => <Badge v={p.status} /> }, { h: "Verifikasi", r: (p: any) => <span className="small">{dt(p.verified_at)}</span> },
      { h: "", r: (p: any) => <div className="row">{p.mode === "live" && <ActionButton run={() => post(api, `/payments/intents/${p.id}/reconcile`).then(() => intents.refetch())}>Rekonsiliasi</ActionButton>}{p.mode === "live" && p.status === "SUCCEEDED" && <ActionButton cls="btn ghost sm" run={async () => { const reason = window.prompt("Alasan refund:"); if (!reason) return; await post(api, `/payments/intents/${p.id}/refunds`, { amount: p.amount, reason }); }}>Ajukan refund</ActionButton>}
        {["PENDING", "RECONCILIATION_REQUIRED"].includes(p.status) && <ActionButton cls="btn ghost sm" run={async () => { const target = window.prompt("Resolusi manual (SUCCEEDED / FAILED / EXPIRED):", "FAILED"); if (!target) return; const evidence = window.prompt("Bukti / alasan (min. 10 karakter, mis. referensi mutasi bank):"); if (!evidence) return; await post(api, `/payments/intents/${p.id}/manual-resolution`, { target: target.toUpperCase(), evidence }); alert("Diajukan. Pengguna lain dengan izin approval:decide harus menyetujui."); }}>Resolusi manual</ActionButton>}
        {sandboxAllowed && p.mode === "mock" && p.status === "PENDING" && <ActionButton cls="btn ghost sm" run={() => post(api, `/payments/intents/${p.id}/simulate`, { status: "SUCCEEDED" }).then(() => intents.refetch())}>Simulasi sukses (sandbox)</ActionButton>}</div> }]} />}</Q>}
    {tab === "Invoice" && <Q q={invoices}>{(d) => <Table rows={d.items} empty="Belum ada invoice" cols={[{ h: "Nomor", r: (i: any) => <span className="mono small">{i.number}</span> }, { h: "Jenis", r: (i: any) => <Badge v={i.kind} /> }, { h: "Pelanggan", r: (i: any) => i.org_name }, { h: "Subtotal", r: (i: any) => idr(i.subtotal_minor) }, { h: "Pajak", r: (i: any) => idr(i.tax_minor) }, { h: "Total", r: (i: any) => idr(i.total_minor) }, { h: "Status", r: (i: any) => <Badge v={i.status} /> }, { h: "Mode", r: (i: any) => <Badge v={i.mode} /> }, { h: "Terbit", r: (i: any) => <span className="small">{dt(i.issued_at)}</span> }]} />}</Q>}
    {tab === "Webhook" && <Q q={events}>{(d) => <Table rows={d.items} empty="Belum ada event webhook" cols={[{ h: "Diterima", r: (e: any) => <span className="small">{dt(e.received_at)}</span> }, { h: "Gateway", r: (e: any) => e.provider }, { h: "Order", r: (e: any) => <span className="mono small">{e.merchant_order_id}</span> }, { h: "Status", r: (e: any) => <Badge v={e.normalized_status} /> }, { h: "Jumlah", r: (e: any) => idr(e.amount) }, { h: "Hasil", r: (e: any) => <span className="small">{e.processing_outcome}</span> }, { h: "Hash", r: (e: any) => <span className="mono small dim">{e.payload_hash.slice(0, 10)}</span> }]} />}</Q>}
    {tab === "Akun & jurnal" && <div className="stack">
      <Q q={accounts}>{(d) => <><div className={`alert ${d.trialBalance.balanced ? "ok" : "bad"}`}>Trial balance: debit {idr(d.trialBalance.debits)} · kredit {idr(d.trialBalance.credits)} — {d.trialBalance.balanced ? "seimbang" : "TIDAK SEIMBANG"}</div>
        <Table rows={d.items} cols={[{ h: "Kode", r: (a: any) => a.code }, { h: "Akun", r: (a: any) => a.name }, { h: "Tipe", r: (a: any) => a.account_type }, { h: "Saldo", r: (a: any) => idr(a.balance), cls: "right" }]} /></>}</Q>
      <NewPanel perm="ledger:write" title="+ Jurnal manual (harus seimbang)" fields={[{ name: "reference", label: "Referensi unik", required: true }, { name: "description", label: "Deskripsi", required: true }, { name: "debitAccount", label: "Akun debit", type: "select", options: (accounts.data?.items ?? []).map((a: any) => ({ value: a.id, label: `${a.code} ${a.name}` })) }, { name: "creditAccount", label: "Akun kredit", type: "select", options: (accounts.data?.items ?? []).map((a: any) => ({ value: a.id, label: `${a.code} ${a.name}` })) }, { name: "amount", label: "Jumlah (IDR)", type: "money", required: true }]}
        submit={(v) => post(api, "/ledger/journals", { reference: v.reference, description: v.description, lines: [{ accountId: v.debitAccount, direction: "debit", amount: v.amount }, { accountId: v.creditAccount, direction: "credit", amount: v.amount }] }).then(() => { journals.refetch(); accounts.refetch(); })} />
      <Q q={journals}>{(d) => <Table rows={d.items} empty="Belum ada jurnal" cols={[{ h: "Waktu", r: (j: any) => <span className="small">{dt(j.posted_at)}</span> }, { h: "Sumber", r: (j: any) => <span className="small">{j.source_type}</span> }, { h: "Deskripsi", r: (j: any) => j.description }, { h: "Entri", r: (j: any) => <div className="small">{j.entries.map((e: any) => <div key={e.id}>{e.direction === "debit" ? "D" : "K"} {e.code} {idr(e.amount)}</div>)}</div> }, { h: "Status", r: (j: any) => <Badge v={j.status === "posted" ? "success" : "canceled"} /> },
        { h: "", r: (j: any) => j.status === "posted" && j.source_type !== "reversal" ? <ActionButton cls="btn ghost sm" run={async () => { const reason = window.prompt("Alasan pembalikan:"); if (!reason) return; await post(api, `/ledger/journals/${j.id}/reverse`, { reason }); journals.refetch(); accounts.refetch(); }}>Balik</ActionButton> : null }]} />}</Q>
    </div>}
    {tab === "Ekonomi misi" && <Q q={econ}>{(d) => <Table rows={d.items} empty="Belum ada misi" cols={[{ h: "Misi", r: (m: any) => m.title }, { h: "Status", r: (m: any) => <Badge v={m.status} /> }, { h: "Harga", r: (m: any) => idr(m.price_minor) }, { h: "Dibayar (terverifikasi)", r: (m: any) => idr(m.verified_paid) }, { h: "Pendapatan diakui", r: (m: any) => idr(m.recognized_revenue) }, { h: "Biaya langsung", r: (m: any) => idr(m.direct_costs) }, { h: "Margin kotor", r: (m: any) => m.gross_margin === null ? <span className="dim">belum diakui</span> : idr(m.gross_margin) }]} />}</Q>}
    {tab === "Payout & refund" && <div className="stack">
      <Section title="Payout kontributor" sub="Payout otomatis nonaktif. Setelah disetujui, catat referensi transfer eksternal."><Q q={payouts}>{(d) => <Table rows={d.items} empty="Belum ada payout" cols={[{ h: "Kontributor", r: (p: any) => p.contributor_name }, { h: "Tugas", r: (p: any) => p.task_title }, { h: "Jumlah", r: (p: any) => idr(p.amount) }, { h: "Status", r: (p: any) => <Badge v={p.status} /> }, { h: "Ref", r: (p: any) => p.external_reference ?? "—" },
        { h: "", r: (p: any) => p.status === "approved" ? <ActionButton run={async () => { const externalReference = window.prompt("Referensi transfer bank:"); if (!externalReference) return; await post(api, `/payouts/${p.id}/mark-paid`, { externalReference }); payouts.refetch(); }}>Tandai dibayar</ActionButton> : null }]} />}</Q>
        <NewPanel perm="ledger:write" title="+ Ajukan payout untuk tugas yang diterima" fields={[{ name: "taskId", label: "ID tugas", required: true }]} submit={(v) => post(api, "/payouts", v).then(() => payouts.refetch())} /></Section>
      <Section title="Refund"><Q q={refunds}>{(d) => <Table rows={d.items} empty="Belum ada refund" cols={[{ h: "Order", r: (r: any) => <span className="mono small">{r.merchant_order_id}</span> }, { h: "Jumlah", r: (r: any) => idr(r.amount) }, { h: "Alasan", r: (r: any) => r.reason }, { h: "Status", r: (r: any) => <Badge v={r.status} /> }]} />}</Q></Section>
    </div>}
    {tab === "Gateway" && <Q q={gw}>{(d) => <><div className={`alert ${d.liveLocked ? "warn" : "ok"}`}>Mode pembayaran: <b>{d.mode}</b>{d.liveLocked && " — live dikunci. Butuh PAYMENTS_MODE=live dan PAYMENT_LIVE_ENABLED=true plus kredensial merchant terverifikasi."}</div>
      <Table rows={d.gateways} cols={[{ h: "Gateway", r: (g: any) => <b>{g.id}</b> }, { h: "Terkonfigurasi", r: (g: any) => <Badge v={g.configured ? "success" : "pending"} /> }, { h: "Live", r: (g: any) => <Badge v={g.liveEnabled ? "live" : "mock"} /> }, { h: "Kapabilitas", r: (g: any) => <span className="small">{["collection", "statusInquiry", "webhook", "refund", "payout", "split"].filter((k) => g.capabilities[k]).join(", ") || "—"}</span> }, { h: "Verifikasi kontrak", r: (g: any) => <span className="small">{g.capabilities.verification}</span> }, { h: "Catatan", r: (g: any) => <span className="small dim">{g.capabilities.notes}</span> }]} /></>}</Q>}
  </div>;
}

// 13. Intelligence & Learning
export function Learning() {
  const api = useApi();
  const q = useGet<any>("/metrics/learning");
  const missions = useGet<any>("/missions");
  return <Q q={q}>{(d) => <div className="stack">
    <Section title="Kinerja AI per task profile"><Table rows={d.aiPerformance} empty="Belum ada inferensi" cols={[{ h: "Profil", r: (r: any) => r.task_profile }, { h: "Model", r: (r: any) => <span className="mono small">{r.model_id}</span> }, { h: "Panggilan", r: (r: any) => r.calls }, { h: "Sukses", r: (r: any) => r.ok }, { h: "Output invalid", r: (r: any) => r.invalid }, { h: "Latensi rata-rata", r: (r: any) => r.avg_latency_ms ? `${r.avg_latency_ms} ms` : "—" }, { h: "Neuron", r: (r: any) => r.neurons }]} /></Section>
    <Section title="Kinerja provider"><Table rows={d.providerPerformance} empty="Belum ada pemakaian provider" cols={[{ h: "Provider", r: (r: any) => r.provider_id }, { h: "Panggilan", r: (r: any) => r.calls }, { h: "Sukses", r: (r: any) => r.ok }, { h: "Gagal/ditolak", r: (r: any) => r.not_ok }, { h: "Latensi", r: (r: any) => r.avg_latency_ms ? `${r.avg_latency_ms} ms` : "—" }, { h: "Unit", r: (r: any) => `${r.units ?? 0} ${r.unit_type ?? ""}` }]} /></Section>
    <Section title="Hasil demand"><Table rows={d.demandOutcomes} empty="Belum ada demand" cols={[{ h: "Asal", r: (r: any) => r.origin }, { h: "Status", r: (r: any) => <Badge v={r.status} /> }, { h: "Jumlah", r: (r: any) => r.n }]} /></Section>
    <NewPanel perm="mission:write" title="+ Catat pembelajaran misi" fields={[{ name: "missionId", label: "Misi", type: "select", options: (missions.data?.items ?? []).map((m: any) => ({ value: m.id, label: `${m.title} (${m.status})` })) }, { name: "summary", label: "Ringkasan", type: "textarea", required: true }, { name: "whatWorked", label: "Yang berhasil", type: "textarea" }, { name: "whatFailed", label: "Yang gagal", type: "textarea" }]} submit={({ missionId, ...v }) => post(api, `/missions/${missionId}/learning`, v).then(() => q.refetch())} />
    <Section title="Catatan pembelajaran"><Table rows={d.records} empty="Belum ada catatan" cols={[{ h: "Misi", r: (r: any) => r.mission_title ?? "—" }, { h: "Ringkasan", r: (r: any) => r.summary }, { h: "Berhasil", r: (r: any) => <span className="small">{r.what_worked ?? "—"}</span> }, { h: "Gagal", r: (r: any) => <span className="small">{r.what_failed ?? "—"}</span> }, { h: "Waktu", r: (r: any) => dt(r.created_at) }]} /></Section>
  </div>}</Q>;
}

// 14. Governance & Audit
export function Governance() {
  const api = useApi();
  const { can, me } = useSession();
  const [tab, setTab] = useState("Persetujuan");
  const approvals = useGet<any>("/approvals?status=pending");
  const audit = useGet<any>("/audit?limit=100");
  const users = useGet<any>(can("roles:manage") ? "/users" : null);
  const support = useGet<any>("/support/queue?status=open");
  const privacy = useGet<any>(can("roles:manage") ? "/privacy/queue" : null);
  return <div>
    <Tabs tabs={["Persetujuan", "Pengguna & peran", "Dukungan", "Privasi", "Audit"]} value={tab} onChange={setTab} />
    {tab === "Dukungan" && <Q q={support}>{(d) => <Table rows={d.items} empty="Tidak ada tiket terbuka" cols={[{ h: "Subjek", r: (t: any) => <div><b>{t.subject}</b><div className="small muted pre">{t.body}</div></div> }, { h: "Pelanggan", r: (t: any) => <span className="small">{t.display_name ?? t.email}<br />{t.org_name}</span> }, { h: "Terkait", r: (t: any) => <span className="small">{t.related_type ?? "—"} {t.related_id ?? ""}</span> }, { h: "Dibuat", r: (t: any) => <span className="small">{dt(t.created_at)}</span> },
      { h: "", r: (t: any) => <ActionButton run={async () => { const reply = window.prompt("Balasan untuk pelanggan:"); if (!reply) return; await post(api, `/support/${t.id}/reply`, { reply, close: window.confirm("Tutup tiket?") }); support.refetch(); }}>Balas</ActionButton> }]} />}</Q>}
    {tab === "Privasi" && (can("roles:manage") ? <Q q={privacy}>{(d) => <Table rows={d.items} empty="Tidak ada permintaan" cols={[{ h: "Pengguna", r: (r: any) => r.display_name ?? r.email ?? r.user_id }, { h: "Status", r: (r: any) => <Badge v={r.status} /> }, { h: "Catatan", r: (r: any) => <span className="small">{r.note ?? "—"}</span> }, { h: "Dibuat", r: (r: any) => dt(r.created_at) },
      { h: "", r: (r: any) => ["received", "in_review"].includes(r.status) ? <div className="row"><ActionButton cls="btn danger sm" confirm="Anonimkan profil pengguna ini? Catatan keuangan/audit tetap disimpan." run={() => post(api, `/privacy/${r.id}/decide`, { decision: "completed", note: "Disetujui pemilik" }).then(() => privacy.refetch())}>Anonimkan</ActionButton><ActionButton cls="btn ghost sm" run={async () => { const note = window.prompt("Alasan penolakan:"); if (!note) return; await post(api, `/privacy/${r.id}/decide`, { decision: "rejected", note }); privacy.refetch(); }}>Tolak</ActionButton></div> : null }]} />}</Q> : <div className="alert">Butuh izin roles:manage.</div>)}
    {tab === "Persetujuan" && <Q q={approvals}>{(d) => <Table rows={d.items} empty="Tidak ada persetujuan tertunda" cols={[{ h: "Aksi", r: (a: any) => <b>{a.action}</b> }, { h: "Sumber daya", r: (a: any) => <span className="small">{a.resource_type} {short(a.resource_id)}</span> }, { h: "Detail", r: (a: any) => <span className="mono small">{a.payload_json}</span> }, { h: "Diminta oleh", r: (a: any) => a.requested_by_name ?? short(a.requested_by) }, { h: "Waktu", r: (a: any) => <span className="small">{dt(a.created_at)}</span> },
      { h: "", r: (a: any) => can("approval:decide") ? (a.requested_by === me?.user?.id ? <span className="small dim">tidak boleh menyetujui sendiri</span> : <div className="row"><ActionButton cls="btn primary sm" run={async () => { const note = window.prompt("Catatan persetujuan:") ?? ""; if (note.length < 3) throw new Error("Catatan minimal 3 karakter"); await post(api, `/approvals/${a.id}/decide`, { decision: "approved", note }); approvals.refetch(); }}>Setujui</ActionButton><ActionButton cls="btn ghost sm" run={async () => { const note = window.prompt("Alasan penolakan:") ?? ""; if (note.length < 3) throw new Error("Alasan minimal 3 karakter"); await post(api, `/approvals/${a.id}/decide`, { decision: "rejected", note }); approvals.refetch(); }}>Tolak</ActionButton></div>) : null }]} />}</Q>}
    {tab === "Pengguna & peran" && (can("roles:manage") ? <Q q={users}>{(d) => <Table rows={d.items} empty="Belum ada pengguna" cols={[{ h: "Pengguna", r: (u: any) => <div><b>{u.display_name ?? "—"}</b><div className="small dim">{u.email}{u.email_verified ? " ✓" : ""}</div></div> }, { h: "Status", r: (u: any) => <Badge v={u.status} /> }, { h: "Peran", r: (u: any) => <span className="small">{u.roles.join(", ")}</span> }, { h: "Kontributor", r: (u: any) => u.contributor ? <Badge v={u.contributor.status} /> : "—" },
      { h: "Kelola", r: (u: any) => <div className="row">
        <select style={{ width: 150 }} defaultValue="" onChange={async (e) => { const v = e.target.value; e.target.value = ""; if (!v) return; const [action, role] = v.split(":"); try { await post(api, `/users/${u.id}/roles`, { role, action }); users.refetch(); } catch (err) { alert((err as Error).message); } }}>
          <option value="">Ubah peran…</option>{["owner", "operator", "analyst", "finance", "contributor"].map((r) => <option key={r} value={`${u.roles.includes(r) ? "revoke" : "grant"}:${r}`}>{u.roles.includes(r) ? `Cabut ${r}` : `Beri ${r}`}</option>)}</select>
        {u.contributor?.status === "pending" && <ActionButton run={() => post(api, `/contributors/${u.id}/verify`, { status: "verified" }).then(() => users.refetch())}>Verifikasi kontributor</ActionButton>}
        {u.id !== me?.user?.id && <ActionButton cls="btn ghost sm" confirm={`${u.status === "active" ? "Tangguhkan" : "Aktifkan"} pengguna ini?`} run={() => post(api, `/users/${u.id}/status`, { status: u.status === "active" ? "suspended" : "active", reason: "Tindakan operator" }).then(() => users.refetch())}>{u.status === "active" ? "Tangguhkan" : "Aktifkan"}</ActionButton>}
      </div> }]} />}</Q> : <div className="alert">Butuh izin roles:manage.</div>)}
    {tab === "Audit" && <Q q={audit}>{(d) => <Table rows={d.items} empty="Belum ada event audit" cols={[{ h: "Waktu", r: (a: any) => <span className="small">{dt(a.created_at)}</span> }, { h: "Aktor", r: (a: any) => <span className="small">{a.actor_type} {short(a.actor_user_id)}</span> }, { h: "Aksi", r: (a: any) => <b className="small">{a.action}</b> }, { h: "Sumber daya", r: (a: any) => <span className="small">{a.resource_type} {short(a.resource_id)}</span> }, { h: "Hasil", r: (a: any) => <Badge v={a.outcome} /> }, { h: "Metadata", r: (a: any) => <span className="mono small dim clip" title={a.metadata_json}>{a.metadata_json}</span> }]} />}</Q>}
  </div>;
}


// 15. Admin & Resource Control Center — owner-only operational overview.
export function AdminControl() {
  const api = useApi();
  const [tab, setTab] = useState("Ringkasan");
  const customers = useGet<any>("/customers");
  const users = useGet<any>("/users");
  const providers = useGet<any>("/providers");
  const benchmarks = useGet<any>("/discovery/benchmarks");
  const policies = useGet<any>("/admin/provider-policies");
  const accounts = useGet<any>("/admin/provider-accounts");
  const actorRegistry = useGet<any>("/admin/actors");
  const ai = useGet<any>("/ai/status");
  const health = usePublic<any>("/health");
  const contributors = (users.data?.items ?? []).filter((u: any) => u.contributor);
  const usd = (micros: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format((micros ?? 0) / 1_000_000);
  const customerItems = customers.data?.items ?? [];
  const providerItems = providers.data?.providers ?? [];
  const usageItems = providers.data?.usage ?? [];
  const actorItems = benchmarks.data?.items ?? [];
  return <div className="stack">
    <div className="alert warn small">Pusat kontrol administratif. Data dan tindakan dibatasi oleh izin owner. Perubahan provider, budget, Actor, dan infrastruktur belum dapat dilakukan dari dashboard sampai policy API persisten selesai dibangun.</div>
    <Tabs tabs={["Ringkasan", "Pelanggan", "Kontributor", "Provider & biaya", "Akun provider", "Actor", "Actor registry", "Cloudflare & CI"]} value={tab} onChange={setTab} />
    {tab === "Ringkasan" && <div className="stack">
      <div className="grid g4">
        <Stat label="Organisasi pelanggan" value={customerItems.length} note="Organisasi tercatat di D1" />
        <Stat label="Kontributor" value={contributors.length} note="Profil kontributor terdaftar" />
        <Stat label="Provider terdaftar" value={providerItems.length} note="Termasuk provider opsional" />
        <Stat label="Benchmark Actor" value={actorItems.length} note="Riwayat run yang tercatat" />
      </div>
      <div className="grid g2">
        <div className="card"><h3>Identitas & data</h3><dl className="kv"><dt>Pengguna terdaftar</dt><dd>{users.data?.items?.length ?? "—"}</dd><dt>Kontributor menunggu verifikasi</dt><dd>{contributors.filter((u: any) => u.contributor?.status === "pending").length}</dd><dt>Kontributor terverifikasi</dt><dd>{contributors.filter((u: any) => u.contributor?.status === "verified").length}</dd><dt>Organisasi pelanggan</dt><dd>{customerItems.length}</dd></dl><p className="small"><Link to="/app/w/governance">Buka Governance & Audit</Link></p></div>
        <div className="card"><h3>Resource & biaya</h3><dl className="kv"><dt>Provider aktif</dt><dd>{providerItems.filter((p: any) => p.enabled).length}</dd><dt>Baris pemakaian 30 hari</dt><dd>{usageItems.length}</dd><dt>Actor benchmark</dt><dd>{actorItems.length}</dd><dt>AI default</dt><dd>{ai.data?.status?.defaultProvider ?? "—"}</dd></dl><p className="small"><Link to="/app/w/market-radar">Buka Market Radar</Link> · <Link to="/app/w/ledger">Buka Economic Ledger</Link></p></div>
      </div>
    </div>}
    {tab === "Pelanggan" && <div className="stack">
      <Section title="Organisasi pelanggan" sub="Daftar organisasi dan jumlah request. Detail billing, suspend organisasi, dan ekspor terkontrol memerlukan endpoint admin khusus.">
        <Q q={customers}>{(d) => <Table rows={d.items} empty="Belum ada organisasi pelanggan" cols={[{ h: "Organisasi", r: (o: any) => <b>{o.name}</b> }, { h: "Jenis", r: (o: any) => o.kind }, { h: "Request", r: (o: any) => o.requests }, { h: "ID", r: (o: any) => <span className="mono small">{short(o.id)}</span> }]} />}</Q>
      </Section>
      <p className="small muted">Riwayat request, quote, invoice, pembayaran, misi, dukungan dan privasi tetap tersedia melalui workspace Governance, Commercial Control, Delivery dan Economic Ledger.</p>
    </div>}
    {tab === "Kontributor" && <Section title="Pengelolaan kontributor" sub="Verifikasi dan penangguhan menggunakan API governance yang sudah tersedia.">
      <Q q={users}>{(d) => <Table rows={d.items.filter((u: any) => u.contributor)} empty="Belum ada profil kontributor" cols={[
        { h: "Kontributor", r: (u: any) => <div><b>{u.display_name ?? "—"}</b><div className="small dim">{u.email ?? u.id}</div></div> },
        { h: "Status", r: (u: any) => <Badge v={u.contributor.status} /> },
        { h: "Keahlian", r: (u: any) => <span className="small">{u.contributor.headline ?? "—"}</span> },
        { h: "Tindakan", r: (u: any) => <div className="row">{u.contributor.status === "pending" && <ActionButton run={() => post(api, `/contributors/${u.id}/verify`, { status: "verified", note: "Diverifikasi dari Admin Control Center" }).then(() => users.refetch())}>Verifikasi</ActionButton>}{u.contributor.status === "verified" && <ActionButton cls="btn danger sm" confirm="Tangguhkan kontributor ini?" run={() => post(api, `/contributors/${u.id}/verify`, { status: "suspended", note: "Penangguhan oleh owner" }).then(() => users.refetch())}>Tangguhkan</ActionButton>}</div> },
      ]} />}</Q>
    </Section>}
    {tab === "Provider & biaya" && <div className="stack">
      <div className="alert warn small">Pemantauan tersedia; pengubahan budget dan aktivasi provider belum dibuka. Batas saat ini berasal dari konfigurasi server/environment dan hard-stop yang sudah ada. Tidak ada paid fallback otomatis.</div>
      <Section title="Provider registry" sub="Konfigurasi ditampilkan sebagai status saja; nilai secret tidak pernah dikirim ke browser.">
        <Q q={providers}>{(d) => <Table rows={d.providers} empty="Belum ada provider" cols={[
          { h: "Provider", r: (p: any) => <b>{p.id}</b> }, { h: "Layer", r: (p: any) => p.layer },
          { h: "Terkonfigurasi", r: (p: any) => <Badge v={p.configured ? "success" : "pending"} /> },
          { h: "Aktif", r: (p: any) => <Badge v={p.enabled ? "active" : "draft"} /> },
          { h: "Mode", r: (p: any) => <span className="small">{p.mode}</span> },
          { h: "Cap harian", r: (p: any) => p.dailyCap ?? "Belum ditetapkan" },
          { h: "Satuan", r: (p: any) => p.billingUnit },
        ]} />}</Q>
      </Section>
      <Section title="Biaya & pemakaian provider" sub="Biaya USD ditampilkan terpisah dari biaya misi IDR. Angka biaya tetap mengikuti status estimasi/realisasi sumber.">
        <Q q={providers}>{(d) => <Table rows={d.usage} empty="Belum ada pemakaian tercatat" cols={[
          { h: "Tanggal", r: (u: any) => u.day }, { h: "Provider", r: (u: any) => u.provider_id },
          { h: "Status", r: (u: any) => <Badge v={u.status} /> }, { h: "Panggilan", r: (u: any) => u.calls },
          { h: "Unit", r: (u: any) => `${u.units} ${u.unit_type}` },
          { h: "Biaya tercatat", r: (u: any) => usd(u.cost_usd_micros) },
        ]} />}</Q>
      </Section>
      <p className="small"><Link to="/app/w/learning">Lihat analitik provider</Link> · <Link to="/app/w/ledger">Lihat biaya langsung dan ledger misi</Link></p>
    </div>}
    {tab === "Akun provider" && <div className="stack">
      <div className="alert warn small">Profil akun hanya menyimpan nama binding secret, bukan token. Token wajib ditambahkan melalui Cloudflare Worker/Pages Secrets. Rotasi akun hanya untuk akun yang sah dan sesuai ketentuan provider; bukan untuk menghindari limit atau kuota gratis.</div>
      <NewPanel title="+ Daftarkan akun provider yang diotorisasi" fields={[
        {name:"providerId",label:"Provider",type:"select",options:[{value:"apify",label:"Apify"},{value:"scrapely",label:"Scrape.ly"},{value:"tavily",label:"Tavily"},{value:"firecrawl",label:"Firecrawl"},{value:"groq",label:"Groq"}]},
        {name:"label",label:"Nama akun/workspace",required:true},
        {name:"secretBinding",label:"Nama binding secret",type:"select",options:["APIFY_API_TOKEN","APIFY_API_TOKEN_2","APIFY_API_TOKEN_3","SCRAPELY_API_KEY","SCRAPELY_API_KEY_2","SCRAPELY_API_KEY_3","TAVILY_API_KEY","TAVILY_API_KEY_2","FIRECRAWL_API_KEY","FIRECRAWL_API_KEY_2","GROQ_API_KEY","GROQ_API_KEY_2"].map(x=>({value:x,label:x}))},
        {name:"ownershipStatus",label:"Otorisasi",type:"select",options:[{value:"pending",label:"Menunggu verifikasi"},{value:"authorized",label:"Diotorisasi"},{value:"revoked",label:"Dicabut"}]},
        {name:"accountStatus",label:"Status",type:"select",options:[{value:"paused",label:"Jeda"},{value:"active",label:"Aktif"},{value:"exhausted",label:"Kuota habis"},{value:"disabled",label:"Nonaktif"}]},
        {name:"planName",label:"Paket provider",defaultValue:"free"},
        {name:"billingMode",label:"Model tagihan",type:"select",options:[{value:"free",label:"Gratis"},{value:"prepaid",label:"Prepaid"},{value:"subscription",label:"Langganan"},{value:"payg",label:"Pay as you go"}]},
        {name:"dailyUnitCap",label:"Batas unit harian",type:"number",defaultValue:0},
        {name:"monthlyUnitCap",label:"Batas unit bulanan",type:"number",defaultValue:0},
        {name:"dailyCostUsdMicros",label:"Batas biaya harian (USD micros)",type:"number",defaultValue:0},
        {name:"monthlyCostUsdMicros",label:"Batas biaya bulanan (USD micros)",type:"number",defaultValue:0},
        {name:"termsReviewedAt",label:"Tanggal review terms (ISO)",placeholder:"2026-11-16T00:00:00Z"},
        {name:"notes",label:"Catatan",type:"textarea"}
      ]} submit={(v)=>post(api,"/admin/provider-accounts",v).then(()=>accounts.refetch())} />
      <Section title="Akun provider terdaftar" sub="Metadata akun dan kapasitas yang dicatat owner. Ketersediaan token belum diverifikasi otomatis.">
        <Q q={accounts}>{d=><Table rows={d.items} empty="Belum ada akun provider" cols={[
          {h:"Provider / akun",r:(x:any)=><div><b>{x.provider_id} · {x.label}</b><div className="small dim">{x.secret_binding}</div></div>},
          {h:"Otorisasi",r:(x:any)=><Badge v={x.ownership_status}/>},{h:"Status",r:(x:any)=><Badge v={x.account_status}/>},
          {h:"Paket",r:(x:any)=>x.plan_name},{h:"Tagihan",r:(x:any)=>x.billing_mode},
          {h:"Cap unit H/B",r:(x:any)=>`${x.daily_unit_cap}/${x.monthly_unit_cap}`},
          {h:"Tindakan",r:(x:any)=><div className="row"><ActionButton run={()=>patch(api,`/admin/provider-accounts/${x.id}`,{accountStatus:"active"}).then(()=>accounts.refetch())}>Aktifkan</ActionButton><ActionButton cls="btn danger sm" run={()=>patch(api,`/admin/provider-accounts/${x.id}`,{accountStatus:"paused"}).then(()=>accounts.refetch())}>Jeda</ActionButton></div>}
        ]}/>}</Q>
      </Section>
    </div>}
    {tab === "Actor registry" && <div className="stack">
      <div className="alert warn small">Actor baru berstatus draft. Hanya Actor yang telah ditinjau terms, privasi, input schema, harga dan batas run yang boleh disetujui. Persetujuan registry belum otomatis mengaktifkan jalur eksekusi produksi.</div>
      <NewPanel title="+ Daftarkan Actor" fields={[
        {name:"providerId",label:"Provider",type:"select",options:[{value:"apify",label:"Apify"},{value:"scrapely",label:"Scrape.ly"}]},
        {name:"actorId",label:"Actor ID (username~actor)",required:true},
        {name:"displayName",label:"Nama Actor",required:true},
        {name:"sourcePlatform",label:"Platform sumber",required:true},
        {name:"purpose",label:"Tujuan",type:"textarea",required:true},
        {name:"inputSchema",label:"Input schema JSON",type:"textarea",defaultValue:"{}"},
        {name:"outputMapping",label:"Output mapping JSON",type:"textarea",defaultValue:"{}"},
        {name:"pricingModel",label:"Model harga",defaultValue:"unknown"},
        {name:"termsReviewedAt",label:"Tanggal review terms (ISO)"},
        {name:"privacyReviewedAt",label:"Tanggal review privasi (ISO)"},
        {name:"perRunCostUsdMicros",label:"Cap biaya per run (USD micros)",type:"number",defaultValue:0},
        {name:"dailyCostUsdMicros",label:"Cap biaya harian (USD micros)",type:"number",defaultValue:0},
        {name:"monthlyCostUsdMicros",label:"Cap biaya bulanan (USD micros)",type:"number",defaultValue:0},
        {name:"maxItems",label:"Maksimum item",type:"number",defaultValue:10},
        {name:"timeoutSeconds",label:"Timeout detik",type:"number",defaultValue:120},
        {name:"concurrencyLimit",label:"Concurrency",type:"number",defaultValue:1}
      ]} submit={(v)=>post(api,"/admin/actors",{...v,inputSchema:JSON.parse(v.inputSchema||"{}"),outputMapping:JSON.parse(v.outputMapping||"{}")}).then(()=>actorRegistry.refetch())}/>
      <Section title="Registry Actor" sub="Status draft/review/approved/paused/rejected disimpan persisten di D1.">
        <Q q={actorRegistry}>{d=><Table rows={d.items} empty="Belum ada Actor terdaftar" cols={[
          {h:"Actor",r:(x:any)=><div><b>{x.display_name}</b><div className="small mono">{x.provider_id}/{x.actor_id}</div></div>},
          {h:"Sumber",r:(x:any)=>x.source_platform},{h:"Status",r:(x:any)=><Badge v={x.status}/>},
          {h:"Batas run",r:(x:any)=>x.max_items},{h:"Biaya/run",r:(x:any)=>usd(x.per_run_cost_usd_micros)},
          {h:"Tindakan",r:(x:any)=><div className="row"><ActionButton run={()=>patch(api,`/admin/actors/${x.id}`,{status:"review"}).then(()=>actorRegistry.refetch())}>Review</ActionButton><ActionButton run={()=>patch(api,`/admin/actors/${x.id}`,{status:"approved"}).then(()=>actorRegistry.refetch())}>Setujui</ActionButton><ActionButton cls="btn danger sm" run={()=>patch(api,`/admin/actors/${x.id}`,{status:"paused"}).then(()=>actorRegistry.refetch())}>Jeda</ActionButton></div>}
        ]}/>}</Q>
      </Section>
    </div>}
    {tab === "Actor" && <Section title="Riwayat Actor Apify / Scrape.ly" sub="Riwayat benchmark saat ini. Registry Actor yang dapat diedit, schema input, review terms dan budget per Actor menjadi implementasi berikutnya.">
      <Q q={benchmarks}>{(d) => <Table rows={d.items} empty="Belum ada benchmark Actor" cols={[
        { h: "Sumber", r: (b: any) => b.source_label }, { h: "Provider", r: (b: any) => b.provider_id },
        { h: "Actor ID", r: (b: any) => <span className="mono small">{b.actor_id}</span> },
        { h: "Item", r: (b: any) => b.items_returned }, { h: "Diterima", r: (b: any) => b.items_accepted ?? "—" },
        { h: "Biaya", r: (b: any) => usd(b.cost_usd_micros) }, { h: "Hasil", r: (b: any) => <Badge v={b.success ? "success" : "failure"} /> },
        { h: "Waktu", r: (b: any) => dt(b.created_at) },
      ]} />}</Q>
    </Section>}
    {tab === "Cloudflare & CI" && <div className="stack">
      <Section title="Runtime & bindings" sub="Status binding berasal dari health endpoint produksi yang aman dibaca. Ini bukan bukti backup/restore atau ketahanan workflow.">
        {health.data ? <div className="grid g3">
          {Object.entries(health.data.bindings ?? {}).map(([key, value]) => <div className="card" key={key}><div className="small muted">{key.toUpperCase()}</div><Badge v={value ? "success" : "failure"} /> <b>{value ? "Tersedia" : "Tidak tersedia"}</b></div>)}
          <div className="card"><div className="small muted">Environment</div><b>{health.data.environment}</b></div>
          <div className="card"><div className="small muted">Clerk webhook secret</div><Badge v={health.data.identity?.clerkWebhookSecret ? "success" : "pending"} /></div>
          <div className="card"><div className="small muted">Payments</div><Badge v={health.data.payments?.mode === "live" ? "warning" : "success"} /> {health.data.payments?.mode}</div>
        </div> : <div className="alert">Health endpoint belum dapat dibaca.</div>}
      </Section>
      <Section title="Workers AI">
        <Q q={ai}>{(d) => <div className="grid g3"><Stat label="Provider default" value={d.status.defaultProvider} /><Stat label="Binding AI" value={d.status.workersAi.bindingPresent ? "Tersedia" : "Tidak ada"} /><Stat label="Panggilan hari ini" value={d.totals.calls_today ?? 0} /></div>}</Q>
      </Section>
      <div className="alert warn small">CI aktif di .github/workflows/ci.yml. Status run, deployment commit, D1 backup/restore, R2 lifecycle, Queues dan Workflows belum ditarik ke dashboard; tidak ditampilkan sebagai PASS tanpa pemeriksaan nyata.</div>
    </div>}
  </div>;
}
