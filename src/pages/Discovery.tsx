import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Compass, ExternalLink, Layers, Radar, RefreshCw, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { dt, humanError, newIdemKey, useApi, useGet } from "../lib/api";
import { ActionButton, Badge, Empty, Q, Section, Spinner, Stat, Table } from "../components/ui";

/** Member-facing V3 Discovery workspace (docs/31). Tenant-scoped API; no provider keys, Actor IDs or operator controls. */
type Mode = "single" | "multi" | "omni";
interface Source { id: string; name: string; platform: string; sourceType: string; identifier: string | null; description: string | null; categories: string[]; topics: string[]; geography: string; language: string; accessStatus: string; permissionStatus: string; commercialUse: string; collectionMethod: string; provider: string; limitations: string; freshness: string | null; origin: string; runnable: boolean | null; unavailableCode: string | null; unavailableReason: string | null; validation?: any; reviewNote?: string }

const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", VALIDATING: "Validasi", SCOPE_READY: "Siap ditinjau", RESERVED: "Direservasi", QUEUED: "Antre", RUNNING: "Berjalan", RECONCILING: "Rekonsiliasi", COMPLETED: "Selesai", PARTIAL: "Sebagian", FAILED: "Gagal", CANCELLED: "Dibatalkan" };
const LIFECYCLE = ["DRAFT", "VALIDATING", "SCOPE_READY", "RESERVED", "QUEUED", "RUNNING", "RECONCILING"];
const statusBadge = (s: string) => <span className={`badge ${s === "COMPLETED" ? "ok" : s === "PARTIAL" || s === "SCOPE_READY" ? "warn" : s === "FAILED" || s === "CANCELLED" ? "bad" : "info"}`}>{STATUS_LABEL[s] ?? s}</span>;

export function EntitlementPanel({ compact = false }: { compact?: boolean }) {
  const q = useGet<any>("/discovery/entitlement");
  return <Q q={q}>{(e) => {
    if (!e.eligible) return <div className="alert warn small">Kebijakan discovery untuk paket Anda belum aktif.</div>;
    const tone = e.state === "available" ? "ok" : e.state === "pending_capacity" ? "warn" : "bad";
    const label = e.state === "available" ? "Tersedia" : e.state === "pending_capacity" ? "Menunggu kapasitas" : "Terpakai";
    return <div className="card stack" style={{ gap: 8 }} id="discovery-entitlement">
      <div className="row between"><h3 className="row" style={{ gap: 8 }}><ShieldCheck size={16} /> Hak discovery</h3><span className={`badge ${tone}`}>{label}</span></div>
      <div className="grid g3">
        <Stat label="Sisa kampanye" value={e.remaining} note={`dijamin ${e.guaranteedRemaining} · bonus ${e.bonusRemaining}`} />
        <Stat label="Terpakai" value={e.used} note={`per ${e.policy.periodDays} hari bergulir`} />
        <Stat label="Reset berikutnya" value={e.nextResetAt ? new Date(e.nextResetAt).toLocaleDateString("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }) : "—"} note={`kebijakan v${e.policy.version} · paket ${e.plan}`} />
      </div>
      {!compact && <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
        <li>{e.policy.guaranteed} kampanye dijamin per {e.policy.periodDays} hari{e.policy.conditionalBonus ? ` + ${e.policy.conditionalBonus} bonus bersyarat` : ""}. Multi-channel & omni dihitung <b>satu</b> kampanye.</li>
        <li>Maks {e.policy.maxChannels} channel, {e.policy.maxItemsPerJob} item per channel, ulang otomatis maks {e.policy.maxAttemptsPerJob}x per job.</li>
        <li>Retry kampanye yang sama tidak memakai hak baru. Penolakan sebelum dispatch tidak memakai hak.</li>
        {e.bonusReason && <li>{e.bonusReason}</li>}
        {e.state === "pending_capacity" && <li><b>Belum ada rute penyedia yang terdanai.</b> Hak Anda tetap utuh dan tidak dianggap terpenuhi.</li>}
        <li>Gratis untuk member — tidak ada tagihan. Tidak ada data contoh yang ditampilkan sebagai hasil nyata.</li>
      </ul>}
    </div>;
  }}</Q>;
}

export function DiscoveryHome() {
  const list = useGet<any>("/discovery/campaigns", { refetchInterval: 15_000 });
  return <div className="stack" style={{ gap: 20 }}>
    <div className="card row between" style={{ padding: 20 }}>
      <div><div className="eyebrow">V3 · Demand Discovery</div><h2 style={{ fontSize: 20, marginTop: 6 }}>Temukan sinyal demand nyata dari sumber publik</h2>
        <p className="muted small" style={{ margin: "6px 0 0" }}>Satu channel, beberapa channel, atau pilihan otomatis. Semua lewat gateway penyedia yang diatur, dengan provenance lengkap.</p></div>
      <div className="row"><Link className="btn primary" to="/app/discovery/new"><Compass size={15} /> Kampanye baru</Link><Link className="btn" to="/app/discovery/catalog"><Search size={15} /> Katalog sumber</Link></div>
    </div>
    <EntitlementPanel />
    <Section title="Kampanye saya">
      <Q q={list}>{(d) => d.items.length ? <Table rows={d.items} cols={[
        { h: "Kampanye", r: (c: any) => <Link to={`/app/discovery/${c.id}`}>{c.title}</Link> },
        { h: "Mode", r: (c: any) => <span className="badge">{c.mode}</span> },
        { h: "Status", r: (c: any) => statusBadge(c.status) },
        { h: "Channel", r: (c: any) => <span className="small">{c.channels_succeeded + c.channels_empty}/{c.channels_planned} selesai{c.channels_unavailable ? ` · ${c.channels_unavailable} tdk tersedia` : ""}</span> },
        { h: "Bukti unik", r: (c: any) => <span className="small">{c.records_unique} · {c.independent_sources} sumber independen</span> },
        { h: "Dibuat", r: (c: any) => dt(c.created_at) },
      ]} /> : <div className="card"><Empty title="Belum ada kampanye" hint="Mulai dengan menulis brief riset demand Anda." action={<Link className="btn primary" to="/app/discovery/new">Buat kampanye pertama</Link>} /></div>}</Q>
    </Section>
  </div>;
}

function SourcePicker({ selected, onToggle, max, filters }: { selected: string[]; onToggle: (id: string) => void; max: number; filters?: boolean }) {
  const [q, setQ] = useState(""); const [platform, setPlatform] = useState(""); const [geo, setGeo] = useState(""); const [lang, setLang] = useState(""); const [cat, setCat] = useState(""); const [onlyRunnable, setOnlyRunnable] = useState(false);
  const meta = useGet<any>("/discovery/meta");
  const qs = new URLSearchParams(Object.entries({ q, platform, geography: geo, language: lang, category: cat }).filter(([, v]) => v)).toString();
  const cat_ = useGet<any>(`/discovery/catalog${qs ? `?${qs}` : ""}`);
  return <div className="stack">
    {filters !== false && <div className="grid g3">
      <div className="field"><label htmlFor="catalog-search">Cari platform, komunitas, topik</label><input id="catalog-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="contoh: reddit umkm, kaskus, quora" /></div>
      <div className="field"><label>Platform</label><select value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="">Semua</option>{cat_.data?.platforms?.map((p: string) => <option key={p} value={p}>{p}</option>)}</select></div>
      <div className="field"><label>Kategori demand</label><select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Semua</option>{meta.data?.categories?.map((c: any) => <option key={c.code} value={c.code}>{c.label}</option>)}</select></div>
      <div className="field"><label>Geografi</label><select value={geo} onChange={(e) => setGeo(e.target.value)}><option value="">Semua</option>{meta.data?.geographies?.map((g: any) => <option key={g.code} value={g.code}>{g.label}</option>)}</select></div>
      <div className="field"><label>Bahasa</label><select value={lang} onChange={(e) => setLang(e.target.value)}><option value="">Semua</option>{meta.data?.languages?.map((l: any) => <option key={l.code} value={l.code}>{l.label}</option>)}</select></div>
      <label className="row small" style={{ gap: 8, alignSelf: "end", paddingBottom: 10 }}><input type="checkbox" style={{ width: "auto" }} checked={onlyRunnable} onChange={(e) => setOnlyRunnable(e.target.checked)} /> Hanya yang dapat dijalankan</label>
    </div>}
    <Q q={cat_}>{(d) => {
      const items: Source[] = d.items.filter((s: Source) => !onlyRunnable || s.runnable);
      return <>
        <div className="small muted">{d.runnable} dari {d.items.length} sumber dapat dijalankan sekarang. {d.note}</div>
        {items.length ? <div className="grid g2">{items.map((s) => {
          const on = selected.includes(s.id);
          return <div key={s.id} className="card stack source-card" style={{ gap: 6, padding: 14, borderColor: on ? "var(--accent)" : undefined, opacity: s.runnable ? 1 : 0.78 }}>
            <div className="row between"><b>{s.name}</b><span className="row" style={{ gap: 4 }}><span className="badge">{s.platform}</span>{s.origin === "member_hint" && <span className="badge info">usulan Anda</span>}</span></div>
            <div className="small muted">{s.description}</div>
            <div className="row small" style={{ gap: 6, flexWrap: "wrap" }}><span className="badge">{s.geography}</span><span className="badge">{s.language}</span><span className="badge">{s.collectionMethod.replace("_", " ")}</span>
              <span className={`badge ${s.accessStatus === "public" ? "ok" : "warn"}`}>{s.accessStatus}</span><span className={`badge ${s.permissionStatus === "approved" ? "ok" : s.permissionStatus === "rejected" ? "bad" : "warn"}`}>izin: {s.permissionStatus.replace("_", " ")}</span></div>
            <div className="small dim">Batasan: {s.limitations}</div>
            {s.runnable ? <div className="row between"><span className="badge ok">dapat dijalankan</span>
              {max > 0 && <button className={`btn sm ${on ? "primary" : ""}`} disabled={!on && selected.length >= max} onClick={() => onToggle(s.id)}>{on ? "Dipilih" : "Pilih"}</button>}</div>
              : <div className="small" style={{ color: "var(--warn)" }}>Tidak tersedia: {s.unavailableReason}</div>}
          </div>;
        })}</div> : <div className="card"><Empty title="Tidak ada sumber cocok" hint="Ubah filter, atau usulkan sumber publik baru di bawah." /></div>}
      </>;
    }}</Q>
  </div>;
}

function HintForm() {
  const api = useApi();
  const [input, setInput] = useState(""); const [busy, setBusy] = useState(false); const [res, setRes] = useState<any>(null); const [err, setErr] = useState<unknown>(null);
  return <div className="card stack" id="source-hint-form">
    <h3>Usulkan sumber publik</h3>
    <p className="small muted" style={{ margin: 0 }}>Tempel URL publik atau nama komunitas (mis. <span className="mono">r/UMKM</span>). Kami memvalidasi akses publik; URL publik <b>bukan</b> bukti izin pengumpulan. Sumber baru hanya bisa dijalankan setelah review owner. Grup privat, konten berlogin dan pesan pribadi selalu ditolak.</p>
    <div className="row"><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://… atau r/nama-komunitas" />
      <button className="btn" disabled={busy || input.trim().length < 2} onClick={async () => { setBusy(true); setErr(null); setRes(null); try { setRes(await api("/discovery/sources/hints", { method: "POST", json: { input } })); setInput(""); } catch (e) { setErr(e); } finally { setBusy(false); } }}>{busy ? <Spinner /> : "Validasi"}</button></div>
    {err ? <div className="alert bad">{humanError(err)}</div> : null}
    {res && <div className={`alert ${res.validation.ok ? "warn" : "bad"} small`}>
      <b>{res.validation.ok ? "Dicatat — menunggu review izin." : "Ditolak."}</b>{res.duplicate ? " (sudah pernah diusulkan)" : ""}
      <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{res.validation.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
      {res.validation.reachability?.checked && <div className="dim">Cek jangkauan: {res.validation.reachability.note}</div>}
    </div>}
  </div>;
}

export function DiscoveryCatalogPage() {
  return <div className="stack" style={{ gap: 18 }}>
    <div className="alert small">Katalog dapat diperluas tanpa mengubah alur kerja. Tercantum ≠ dapat dijalankan: setiap sumber harus lolos review izin & penggunaan komersial, punya rute penyedia yang siap, dan didanai alokasi program yang disetujui owner.</div>
    <SourcePicker selected={[]} onToggle={() => {}} max={0} />
    <HintForm />
  </div>;
}

export function NewCampaign() {
  const api = useApi(); const nav = useNavigate();
  const meta = useGet<any>("/discovery/meta");
  const ent = useGet<any>("/discovery/entitlement");
  const [mode, setMode] = useState<Mode>("omni");
  const [sel, setSel] = useState<string[]>([]);
  const [b, setB] = useState({ title: "", topic: "", audience: "", keywords: "", categories: [] as string[], customCategory: "", geography: "ID", language: "id", purpose: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const [idem] = useState(newIdemKey);
  const max = mode === "single" ? 1 : mode === "multi" ? ent.data?.policy?.maxChannels ?? 4 : 0;
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : mode === "single" ? [id] : [...s, id]));
  const set = (k: string, v: any) => setB((x) => ({ ...x, [k]: v }));
  const valid = b.title.trim().length >= 4 && b.topic.trim().length >= 10 && (mode === "omni" || (mode === "single" ? sel.length === 1 : sel.length >= 2));
  return <div className="stack" style={{ gap: 18 }}>
    <EntitlementPanel compact />
    <div className="card stack" id="demand-brief">
      <h3>1 · Brief riset demand</h3>
      <div className="grid g2">
        <div className="field"><label>Judul kampanye *</label><input value={b.title} onChange={(e) => set("title", e.target.value)} placeholder="contoh: Kebutuhan kasir offline UMKM" /></div>
        <div className="field"><label>Audiens / segmen</label><input value={b.audience} onChange={(e) => set("audience", e.target.value)} placeholder="contoh: pemilik toko kelontong" /></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label>Masalah / topik yang ingin diteliti *</label><textarea value={b.topic} onChange={(e) => set("topic", e.target.value)} placeholder="Jelaskan dengan bahasa Anda sendiri (min. 10 karakter)." /></div>
        <div className="field"><label>Kata kunci (pisahkan koma, maks 8)</label><input value={b.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder="aplikasi kasir, stok toko" /></div>
        <div className="field"><label>Tujuan riset</label><input value={b.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="contoh: menilai peluang produk" /></div>
        <div className="field"><label>Geografi</label><select value={b.geography} onChange={(e) => set("geography", e.target.value)}>{meta.data?.geographies?.map((g: any) => <option key={g.code} value={g.code}>{g.label}</option>)}</select></div>
        <div className="field"><label>Bahasa</label><select value={b.language} onChange={(e) => set("language", e.target.value)}>{meta.data?.languages?.map((l: any) => <option key={l.code} value={l.code}>{l.label}</option>)}</select></div>
      </div>
      <div className="field"><label>Kategori demand (opsional, maks 5 — membantu, bukan membatasi)</label>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>{meta.data?.categories?.map((c: any) => { const on = b.categories.includes(c.code); return <button key={c.code} type="button" className={`btn sm ${on ? "primary" : ""}`} disabled={!on && b.categories.length >= 5} onClick={() => set("categories", on ? b.categories.filter((x) => x !== c.code) : [...b.categories, c.code])}>{c.label}</button>; })}</div></div>
      {b.categories.includes("custom") && <div className="field"><label>Kategori kustom</label><input value={b.customCategory} onChange={(e) => set("customCategory", e.target.value)} /></div>}
    </div>
    <div className="card stack" id="discovery-mode">
      <h3>2 · Mode discovery</h3>
      <div className="grid g3">{([["single", "Satu channel", "Pilih tepat satu sumber/komunitas.", Radar], ["multi", "Beberapa channel", "Pilih 2+ sumber dalam satu kampanye (tetap satu hak).", Layers], ["omni", "Otomatis / omni", "DAYANEXA memilih sumber yang relevan, diizinkan, siap dan terdanai.", Sparkles]] as const).map(([m, l, h, I]) =>
        <button key={m} type="button" className="card stack" style={{ textAlign: "left", cursor: "pointer", borderColor: mode === m ? "var(--accent)" : undefined, gap: 4 }} onClick={() => { setMode(m); setSel([]); }}><b className="row" style={{ gap: 6 }}><I size={15} />{l}</b><span className="small muted">{h}</span></button>)}</div>
      {mode !== "omni" ? <SourcePicker selected={sel} onToggle={toggle} max={max} /> : <div className="alert small">Sumber dipilih otomatis berdasarkan relevansi brief, cakupan, izin, kesiapan penyedia, kuota dan biaya. Anda akan melihat channel yang diusulkan beserta alasannya sebelum kampanye dijalankan.</div>}
    </div>
    {err ? <div className="alert bad">{humanError(err)}</div> : null}
    <div className="row"><button className="btn primary" disabled={!valid || busy} onClick={async () => {
      setBusy(true); setErr(null);
      try {
        const brief = { title: b.title, topic: b.topic, audience: b.audience || null, keywords: b.keywords.split(",").map((k) => k.trim()).filter((k) => k.length >= 2).slice(0, 8), categories: b.categories, customCategory: b.customCategory || null, geography: b.geography, language: b.language, purpose: b.purpose || null };
        const r = await api<any>("/discovery/campaigns", { method: "POST", json: { mode, sourceIds: sel, brief }, headers: { "idempotency-key": idem } });
        nav(`/app/discovery/${r.campaign.id}`);
      } catch (e) { setErr(e); } finally { setBusy(false); }
    }}>{busy ? <Spinner /> : "Susun ruang lingkup"}</button><span className="small muted">Menyusun ruang lingkup tidak memakai hak discovery dan tidak memanggil penyedia.</span></div>
  </div>;
}

export function CampaignDetail() {
  const { id } = useParams(); const api = useApi(); const nav = useNavigate();
  const q = useGet<any>(id ? `/discovery/campaigns/${id}` : null, { refetchInterval: 8000 });
  const [tab, setTab] = useState<"evidence" | "jobs" | "usage">("evidence");
  const [startErr, setStartErr] = useState<unknown>(null); const [starting, setStarting] = useState(false);
  const [expandIdem] = useState(newIdemKey);
  return <Q q={q}>{(v) => {
    const c = v.campaign; const sc = v.scope ?? {};
    const live = ["RESERVED", "QUEUED", "RUNNING", "RECONCILING"].includes(c.status);
    return <div className="stack" style={{ gap: 18 }}>
      <div className="card stack" style={{ gap: 8 }}>
        <div className="row between"><div><div className="eyebrow">Kampanye {c.mode} · kebijakan v{c.policyVersion ?? "—"}</div><h2 style={{ fontSize: 19, marginTop: 4 }}>{c.title}</h2></div>{statusBadge(c.status)}</div>
        {c.statusReason && <div className="small muted">{c.statusReason}</div>}
        <div className="timeline">{LIFECYCLE.map((s) => { const passed = v.transitions.some((t: any) => t.to_state === s); return <span key={s} className={`t ${passed ? "done" : ""} ${c.status === s ? "now" : ""}`}>{STATUS_LABEL[s]}</span>; })}{!LIFECYCLE.includes(c.status) && statusBadge(c.status)}</div>
        <dl className="kv small"><dt>Topik</dt><dd>{c.brief.topic}</dd><dt>Kata kunci</dt><dd>{c.brief.keywords?.join(", ") || "—"}</dd><dt>Geografi / bahasa</dt><dd>{c.brief.geography} · {c.brief.language}</dd><dt>Kategori</dt><dd>{c.brief.categories?.join(", ") || "—"}</dd>
          <dt>Hak discovery</dt><dd>{v.entitlement ? <><Badge v={v.entitlement.state} /> <span className="small dim">{v.entitlement.kind}{v.entitlement.reason ? ` — ${v.entitlement.reason}` : ""}</span></> : <span className="dim">belum direservasi</span>}</dd>
          {c.parentCampaignId && <><dt>Perluasan dari</dt><dd><Link to={`/app/discovery/${c.parentCampaignId}`}>kampanye induk</Link></dd></>}</dl>
        <div className="row">
          {live && <span className="row small" style={{ gap: 6 }}><Spinner /> Diperbarui otomatis</span>}
          {(c.status === "QUEUED" || c.status === "RUNNING") && <ActionButton run={() => api(`/discovery/campaigns/${c.id}/resume`, { method: "POST", json: {} }).then(() => q.refetch())}><RefreshCw size={14} /> Lanjutkan</ActionButton>}
          {["SCOPE_READY", "RESERVED", "QUEUED", "RUNNING"].includes(c.status) && <ActionButton cls="btn danger sm" confirm="Batalkan kampanye ini? Job yang sudah dikirim tetap dihitung." run={() => api(`/discovery/campaigns/${c.id}/cancel`, { method: "POST", json: {} }).then(() => q.refetch())}><X size={14} /> Batalkan</ActionButton>}
          {["PARTIAL", "FAILED"].includes(c.status) && v.jobs.some((j: any) => ["FAILED", "SKIPPED"].includes(j.status)) && <ActionButton run={() => api(`/discovery/campaigns/${c.id}/retry`, { method: "POST", json: {} }).then(() => q.refetch())}>Ulangi job gagal (tanpa hak baru)</ActionButton>}
          {c.terminal && c.status !== "CANCELLED" && <ActionButton run={async () => { const r = await api<any>(`/discovery/campaigns/${c.id}/expand`, { method: "POST", json: { mode: "omni" }, headers: { "idempotency-key": expandIdem } }); nav(`/app/discovery/${r.campaign.id}`); }}>Perluas brief (kampanye baru)</ActionButton>}
        </div>
      </div>

      {c.status === "SCOPE_READY" && <div className="card stack" id="scope-review">
        <h3>Tinjau ruang lingkup sebelum menjalankan</h3>
        <Table rows={sc.channels ?? []} cols={[{ h: "Channel", r: (x: any) => <b>{x.name}</b> }, { h: "Platform", r: (x: any) => x.platform }, { h: "Metode", r: (x: any) => x.collectionMethod.replace("_", " ") }, { h: "Batas", r: (x: any) => `${sc.maxItemsPerJob} item · ${x.units} ${x.unitType}` }, { h: "Alasan", r: (x: any) => <span className="small">{x.reason}</span> }]} />
        <div className="small">Total sumber daya maksimum: {(sc.totals ?? []).map((t: any) => `${t.units} ${t.unitType} (${t.providerId})`).join(", ")} — direservasi sebelum dispatch, sisa dilepas setelah rekonsiliasi.</div>
        {sc.unavailable?.length > 0 && <details><summary className="small">{sc.unavailable.length} sumber tidak termasuk — lihat alasan</summary><ul className="small muted">{sc.unavailable.map((u: any) => <li key={u.sourceId}><b>{u.name}</b>: {u.reason}</li>)}</ul></details>}
        <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>{(sc.limitations ?? []).map((l: string, i: number) => <li key={i}>{l}</li>)}</ul>
        {startErr ? <div className="alert bad">{humanError(startErr)}</div> : null}
        <div className="row"><button className="btn primary" disabled={starting} onClick={async () => { setStarting(true); setStartErr(null); try { await api(`/discovery/campaigns/${c.id}/start`, { method: "POST", json: { scopeHash: c.scopeHash } }); } catch (e) { setStartErr(e); } finally { setStarting(false); q.refetch(); } }}>{starting ? <><Spinner /> Menjalankan…</> : "Mulai kampanye (pakai 1 hak discovery)"}</button>
          <span className="small muted">Hak hanya terpakai bila penyedia benar-benar menerima pekerjaan.</span></div>
      </div>}
      {c.status === "FAILED" && c.blockedCode === "NO_RUNNABLE_SOURCE" && <div className="alert warn">Tidak ada sumber yang dapat dijalankan untuk brief ini saat ini. Hak discovery Anda tidak terpakai.
        <ul className="small" style={{ margin: "6px 0 0" }}>{(sc.unavailable ?? []).slice(0, 8).map((u: any) => <li key={u.sourceId}><b>{u.name}</b>: {u.reason}</li>)}</ul></div>}

      {(c.terminal || live) && c.status !== "SCOPE_READY" && <>
        <div className="grid g4">
          <Stat label="Channel" value={`${v.coverage.channelsSucceeded + v.coverage.channelsEmpty}/${v.coverage.channelsPlanned}`} note={`${v.coverage.channelsFailed} gagal · ${v.coverage.channelsUnavailable} tidak tersedia`} />
          <Stat label="Rekaman total" value={v.coverage.recordsTotal} note={`${v.coverage.recordsDuplicate} duplikat / salinan`} />
          <Stat label="Bukti unik" value={v.coverage.recordsUnique} note="setelah deduplikasi lintas channel" />
          <Stat label="Sumber independen" value={v.coverage.independentSources} note="komunitas/penerbit berbeda" />
        </div>
        <div className="tabs" role="tablist">{([["evidence", "Bukti & tema"], ["jobs", "Channel & job"], ["usage", "Pemakaian sumber daya"]] as const).map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
        {tab === "evidence" && <EvidencePanel id={c.id} canHandoff={["COMPLETED", "PARTIAL"].includes(c.status)} byChannel={v.coverage.byChannel} />}
        {tab === "jobs" && <Table rows={v.jobs} cols={[
          { h: "Channel", r: (j: any) => <div><b>{j.source_name}</b><div className="small dim">{j.platform} · {j.collection_method.replace("_", " ")}</div></div> },
          { h: "Status", r: (j: any) => <Badge v={j.status} /> }, { h: "Percobaan", r: (j: any) => `${j.attempt}/${j.max_attempts}` },
          { h: "Hasil", r: (j: any) => <span className="small">{j.records_returned} diterima · {j.records_new} baru · {j.records_duplicate} duplikat · {j.records_dropped} difilter</span> },
          { h: "Query", r: (j: any) => <span className="small mono clip" title={j.query}>{j.query || "—"}</span> },
          { h: "Run ID", r: (j: any) => <span className="small mono">{j.provider_run_id ? `${String(j.provider_run_id).slice(0, 12)}…` : "—"}</span> },
          { h: "Catatan", r: (j: any) => <span className="small">{j.reason ?? (j.error_code ?? "")}</span> },
        ]} />}
        {tab === "usage" && <div className="card stack small">
          <dl className="kv"><dt>Direservasi</dt><dd>{v.usage.unitsReserved} unit</dd><dt>Aktual</dt><dd>{v.usage.unitsActual} unit</dd><dt>Biaya aktual</dt><dd>{(v.usage.costActualUsdMicros / 1_000_000).toFixed(4)} USD (ditanggung program DAYANEXA; member tidak ditagih)</dd></dl>
          <Table rows={v.usage.perJob} cols={[{ h: "Job", r: (u: any) => <span className="mono small">{u.jobId.slice(-8)}</span> }, { h: "Penyedia", r: (u: any) => u.provider }, { h: "Unit aktual", r: (u: any) => u.units }]} />
          <div className="muted">Unit sisa reservasi dilepas otomatis setelah rekonsiliasi. Tidak ada rute berbayar tanpa persetujuan owner.</div>
        </div>}
      </>}
    </div>;
  }}</Q>;
}

function EvidencePanel({ id, canHandoff, byChannel }: { id: string; canHandoff: boolean; byChannel: any[] }) {
  const api = useApi(); const nav = useNavigate();
  const [dups, setDups] = useState(false);
  const q = useGet<any>(`/discovery/campaigns/${id}/evidence${dups ? "?duplicates=1" : ""}`);
  const [pick, setPick] = useState<string[]>([]);
  const [title, setTitle] = useState(""); const [problem, setProblem] = useState(""); const [err, setErr] = useState<unknown>(null); const [busy, setBusy] = useState(false);
  const grouped = useMemo(() => { const m = new Map<string, any[]>(); for (const e of q.data?.items ?? []) { const k = e.source_name; m.set(k, [...(m.get(k) ?? []), e]); } return [...m.entries()]; }, [q.data]);
  return <Q q={q}>{(d) => <div className="stack">
    <div className="alert small">{d.note}</div>
    <div className="grid g2">
      <div className="card"><h3>Cakupan per channel</h3><Table rows={byChannel} empty="Belum ada bukti" cols={[{ h: "Channel", r: (r: any) => r.name }, { h: "Rekaman", r: (r: any) => r.records }, { h: "Unik", r: (r: any) => r.unique_records }, { h: "Sumber independen", r: (r: any) => r.independent_sources }]} /></div>
      <div className="card"><h3>Tema yang sering muncul <span className="badge warn">inferensi</span></h3>{d.themes.length ? <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>{d.themes.map((t: any) => <span key={t.term} className="badge" title={`${t.records} rekaman · ${t.independentSources} sumber independen`}>{t.term} · {t.independentSources}</span>)}</div> : <div className="small muted">Belum cukup bukti untuk tema.</div>}
        <p className="small dim">Frekuensi istilah dihitung per sumber independen — bukan prevalensi pasar.</p></div>
    </div>
    <label className="row small" style={{ gap: 8 }}><input type="checkbox" style={{ width: "auto" }} checked={dups} onChange={(e) => setDups(e.target.checked)} /> Tampilkan duplikat & salinan sindikasi</label>
    {grouped.length === 0 && <div className="card"><Empty title="Tidak ada bukti yang lolos filter" hint="Hasil kosong dilaporkan apa adanya — bukan diisi data contoh." /></div>}
    {grouped.map(([name, rows]) => <Section key={name} title={name} sub={`${rows.length} bukti`}>
      {rows.map((e: any) => <article key={e.id} className="card stack evidence-card" style={{ gap: 6, padding: 14 }}>
        <div className="row between"><a href={e.url} target="_blank" rel="noreferrer noopener" className="row" style={{ gap: 6 }}><b>{e.title}</b><ExternalLink size={13} /></a>
          <span className="row" style={{ gap: 4 }}>{e.duplicate_kind !== "unique" && <span className="badge warn">{e.duplicate_kind.replace("_", " ")}</span>}<span className={`badge ${e.signal_kind === "possible_demand_signal" ? "info" : ""}`}>{(e.signal_kind ?? "").replace(/_/g, " ")}</span>
            {canHandoff && e.duplicate_kind === "unique" && <label className="row small" style={{ gap: 4 }}><input type="checkbox" style={{ width: "auto" }} checked={pick.includes(e.signal_id)} onChange={(ev) => setPick((p) => ev.target.checked ? [...p, e.signal_id].slice(0, 20) : p.filter((x) => x !== e.signal_id))} />pilih</label>}</span></div>
        <div className="small" style={{ whiteSpace: "pre-wrap" }}>{String(e.content_excerpt ?? "").slice(0, 420)}{String(e.content_excerpt ?? "").length > 420 ? "…" : ""}</div>
        <details className="small dim"><summary>Provenance</summary><dl className="kv"><dt>URL kanonik</dt><dd className="mono">{e.canonical_url}</dd><dt>Platform / komunitas</dt><dd>{e.platform}{e.community ? ` · ${e.community}` : ""}</dd><dt>Sumber independen</dt><dd className="mono">{e.independent_source_key}</dd>
          <dt>Dikumpulkan</dt><dd>{dt(e.captured_at)}</dd><dt>Dipublikasikan</dt><dd>{e.observed_at ?? "tidak diketahui"}</dd><dt>Penyedia / adapter</dt><dd>{e.provider_id} · {e.adapter}</dd><dt>Metode</dt><dd>{e.collection_method}</dd>
          <dt>Run ID penyedia</dt><dd className="mono">{e.provider_request_id ?? "—"}</dd><dt>Fingerprint</dt><dd className="mono">{String(e.content_hash).slice(0, 16)}…</dd><dt>Kualitas bukti</dt><dd>{e.evidence_quality}</dd>
          <dt>Isyarat (heuristik)</dt><dd>{e.heuristic?.cues?.join(", ") || "—"} {e.heuristic?.categories?.length ? `· kategori: ${e.heuristic.categories.join(", ")}` : ""}</dd></dl></details>
      </article>)}
    </Section>)}
    {canHandoff && <div className="card stack" id="opportunity-handoff">
      <h3>Lanjutkan ke penilaian peluang</h3>
      <p className="small muted" style={{ margin: 0 }}>Buat hipotesis demand dengan bukti terpilih ({pick.length}/20). Ini memakai 1 kuota request paket Anda. Validasi demand tetap proses terpisah oleh tim DAYANEXA.</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul hipotesis" />
      <textarea value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Ringkas masalah/kebutuhan yang Anda lihat dari bukti (min. 20 karakter)" />
      {err ? <div className="alert bad">{humanError(err)}</div> : null}
      <div><button className="btn primary" disabled={busy || !pick.length || title.trim().length < 5 || problem.trim().length < 20} onClick={async () => { setBusy(true); setErr(null); try { const r = await api<any>(`/discovery/campaigns/${id}/handoff`, { method: "POST", json: { title, problem, signalIds: pick } }); nav(`/app/requests/${r.demandId}`); } catch (e) { setErr(e); } finally { setBusy(false); } }}>{busy ? <Spinner /> : "Buat hipotesis demand"}</button></div>
    </div>}
  </div>}</Q>;
}

/** Owner-only governance (rendered inside Admin & Resource Control; server enforces provider:admin). */
export function DiscoveryAdmin() {
  const api = useApi();
  const sources = useGet<any>("/admin/discovery/sources");
  const budgets = useGet<any>("/admin/discovery/budgets");
  const policies = useGet<any>("/admin/discovery/policies");
  const campaigns = useGet<any>("/admin/discovery/campaigns");
  const [rev, setRev] = useState<any>(null);
  const [form, setForm] = useState({ to: "approved", accessStatus: "public", commercialUse: "allowed", days: 90, note: "", confirm: false });
  const [bud, setBud] = useState({ providerId: "tavily", unitType: "credits", monthUnitsCap: 100, perOrgMonthUnitsCap: 5, bonusEnabled: false, days: 30, reason: "" });
  const [err, setErr] = useState<unknown>(null);
  const refetch = () => Promise.all([sources.refetch(), budgets.refetch(), policies.refetch(), campaigns.refetch()]);
  return <div className="stack" style={{ gap: 18 }}>
    <div className="alert warn small">Governance discovery member. Sumber hanya dapat dijalankan setelah Anda mereview metode pengumpulan persis, akses publik, dan penggunaan komersial (maks 180 hari). Anggaran program hanya mendanai kampanye member; batas gateway, kuota terverifikasi dan larangan biaya berbayar tetap berlaku.</div>
    {err ? <div className="alert bad">{humanError(err)}</div> : null}
    <Section title="Review izin sumber" sub="Catatan review bersifat append-only dan teraudit.">
      <Q q={sources}>{(d) => <Table rows={d.items} cols={[
        { h: "Sumber", r: (s: any) => <div><b>{s.name}</b><div className="small dim">{s.platform} · {s.collection_method} · {s.provider_id}{s.origin === "member_hint" ? ` · usulan ${s.submitted_org_name ?? ""}` : ""}</div></div> },
        { h: "Izin", r: (s: any) => <Badge v={s.permission_status} /> }, { h: "Akses", r: (s: any) => s.access_status }, { h: "Komersial", r: (s: any) => s.commercial_use },
        { h: "Kedaluwarsa", r: (s: any) => s.review_expires_at ? dt(s.review_expires_at) : "—" }, { h: "Ketersediaan", r: (s: any) => s.availability },
        { h: "Aksi", r: (s: any) => <div className="row"><button className="btn sm" onClick={() => setRev(s)}>Review</button>
          <ActionButton run={() => api(`/admin/discovery/sources/${s.id}`, { method: "PATCH", json: { availability: s.availability === "available" ? "paused" : "available" } }).then(refetch)}>{s.availability === "available" ? "Jeda" : "Aktifkan"}</ActionButton></div> },
      ]} />}</Q>
      {rev && <div className="card stack">
        <h3>Review: {rev.name}</h3>
        <div className="small muted">{rev.description} — Batasan: {rev.limitations}{rev.validation_json && rev.origin === "member_hint" ? ` · Validasi: ${rev.validation_json}` : ""}</div>
        <div className="grid g3">
          <div className="field"><label>Keputusan</label><select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>{["approved", "rejected", "suspended", "pending_review"].map((x) => <option key={x}>{x}</option>)}</select></div>
          <div className="field"><label>Status akses</label><select value={form.accessStatus} onChange={(e) => setForm({ ...form, accessStatus: e.target.value })}>{["public", "login_required", "private", "restricted", "unknown"].map((x) => <option key={x}>{x}</option>)}</select></div>
          <div className="field"><label>Penggunaan komersial</label><select value={form.commercialUse} onChange={(e) => setForm({ ...form, commercialUse: e.target.value })}>{["allowed", "restricted", "unclear"].map((x) => <option key={x}>{x}</option>)}</select></div>
          <div className="field"><label>Berlaku (hari, ≤180)</label><input value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) || 0 })} /></div>
          <div className="field" style={{ gridColumn: "span 2" }}><label>Catatan review (wajib)</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ketentuan platform & penyedia yang direview, metode, batasan" /></div>
        </div>
        <label className="row small" style={{ gap: 8 }}><input type="checkbox" style={{ width: "auto" }} checked={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.checked })} /> Saya telah mereview metode pengumpulan persis ini terhadap ketentuan platform, penyedia dan hukum yang berlaku.</label>
        <div className="row"><ActionButton cls="btn primary sm" run={async () => { setErr(null); try { await api(`/admin/discovery/sources/${rev.id}/review`, { method: "POST", json: { to: form.to, accessStatus: form.accessStatus, commercialUse: form.commercialUse, expiresAt: form.to === "approved" ? new Date(Date.now() + form.days * 86_400_000).toISOString() : null, note: form.note, collectionMethodConfirmed: form.confirm } }); setRev(null); await refetch(); } catch (e) { setErr(e); throw e; } }}>Simpan review</ActionButton><button className="btn sm ghost" onClick={() => setRev(null)}>Tutup</button></div>
      </div>}
    </Section>
    <Section title="Anggaran program discovery" sub="Alokasi yang disetujui owner per penyedia/bulan, dengan batas per organisasi.">
      <Q q={budgets}>{(d) => <>
        <Table rows={d.usage} empty="Belum ada anggaran aktif — tidak ada kampanye member yang dapat berjalan." cols={[{ h: "Penyedia", r: (b: any) => `${b.providerId} (${b.unitType})` }, { h: "Pemakaian bulan ini", r: (b: any) => `${b.monthUsed}/${b.monthCap}` }, { h: "Headroom", r: (b: any) => `${b.headroomPct}%` }, { h: "Cap per org", r: (b: any) => b.perOrgCap }, { h: "Bonus", r: (b: any) => (b.bonusEnabled ? "aktif" : "nonaktif") }, { h: "Pendanaan", r: (b: any) => b.fundingClass }, { h: "Berakhir", r: (b: any) => dt(b.expiresAt) }]} />
        <Table rows={d.items} empty="—" cols={[{ h: "ID", r: (b: any) => <span className="mono small">{b.id.slice(-8)}</span> }, { h: "Penyedia", r: (b: any) => b.provider_id }, { h: "Status", r: (b: any) => <Badge v={b.status} /> }, { h: "Alasan", r: (b: any) => <span className="small">{b.reason}</span> }, { h: "Aksi", r: (b: any) => b.status === "active" ? <ActionButton cls="btn danger sm" run={() => api(`/admin/discovery/budgets/${b.id}/revoke`, { method: "POST", json: {} }).then(refetch)}>Cabut</ActionButton> : null }]} />
      </>}</Q>
      <div className="card stack">
        <div className="grid g3">
          <div className="field"><label>Penyedia</label><select value={bud.providerId} onChange={(e) => setBud({ ...bud, providerId: e.target.value, unitType: ["apify", "scrapely"].includes(e.target.value) ? "usd_micros" : "credits" })}>{["tavily", "firecrawl", "apify", "scrapely"].map((x) => <option key={x}>{x}</option>)}</select></div>
          <div className="field"><label>Cap unit / bulan</label><input value={bud.monthUnitsCap} onChange={(e) => setBud({ ...bud, monthUnitsCap: Number(e.target.value) || 0 })} /></div>
          <div className="field"><label>Cap per organisasi / bulan</label><input value={bud.perOrgMonthUnitsCap} onChange={(e) => setBud({ ...bud, perOrgMonthUnitsCap: Number(e.target.value) || 0 })} /></div>
          <div className="field"><label>Berlaku (hari, ≤93)</label><input value={bud.days} onChange={(e) => setBud({ ...bud, days: Number(e.target.value) || 0 })} /></div>
          <div className="field" style={{ gridColumn: "span 2" }}><label>Alasan & dasar pendanaan (wajib)</label><input value={bud.reason} onChange={(e) => setBud({ ...bud, reason: e.target.value })} placeholder="contoh: allowance gratis Tavily terverifikasi dashboard 2026-11-16" /></div>
        </div>
        <label className="row small" style={{ gap: 8 }}><input type="checkbox" style={{ width: "auto" }} checked={bud.bonusEnabled} onChange={(e) => setBud({ ...bud, bonusEnabled: e.target.checked })} /> Danai kampanye bonus bersyarat (hanya bila headroom cukup)</label>
        <div><ActionButton cls="btn primary sm" run={async () => { setErr(null); try { await api("/admin/discovery/budgets", { method: "POST", json: { providerId: bud.providerId, unitType: bud.unitType, monthUnitsCap: bud.monthUnitsCap, perOrgMonthUnitsCap: bud.perOrgMonthUnitsCap, bonusEnabled: bud.bonusEnabled, fundingClass: "verified_free_allowance", expiresAt: new Date(Date.now() + bud.days * 86_400_000).toISOString(), reason: bud.reason } }); await refetch(); } catch (e) { setErr(e); throw e; } }}>Setujui alokasi</ActionButton></div>
      </div>
    </Section>
    <Section title="Kebijakan discovery (berversi)">
      <Q q={policies}>{(d) => <Table rows={d.items} cols={[{ h: "Paket", r: (p: any) => p.plan_code }, { h: "Versi", r: (p: any) => `v${p.version}` }, { h: "Status", r: (p: any) => <Badge v={p.status} /> }, { h: "Dijamin / bonus", r: (p: any) => `${p.guaranteed_campaigns} + ${p.conditional_bonus_campaigns}` }, { h: "Periode", r: (p: any) => `${p.period_days} hari` }, { h: "Maks channel / item", r: (p: any) => `${p.max_channels} / ${p.max_items_per_job}` }]} />}</Q>
    </Section>
    <Section title="Kampanye semua tenant (operasi)">
      <Q q={campaigns}>{(d) => <Table rows={d.items} empty="Belum ada kampanye" cols={[{ h: "Org", r: (c: any) => c.org_name }, { h: "Kampanye", r: (c: any) => c.title }, { h: "Status", r: (c: any) => <Badge v={c.status} /> }, { h: "Hak", r: (c: any) => c.entitlement_state ?? "—" }, { h: "Unit res./aktual", r: (c: any) => `${c.units_reserved}/${c.units_actual}` }, { h: "Biaya tak pasti", r: (c: any) => c.unknown_charge_jobs ? <span className="badge bad">{c.unknown_charge_jobs} job</span> : "—" }, { h: "Dibuat", r: (c: any) => dt(c.created_at) }]} />}</Q>
    </Section>
  </div>;
}
