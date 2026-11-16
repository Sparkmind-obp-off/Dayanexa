import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { dt, humanError, idr, newIdemKey, useAction, useApi, useGet, usePublic } from "../lib/api";
import { useSession, type Plan } from "../lib/session";
import { Form } from "../components/Form";
import { ActionButton, Badge, Empty, Q, Section, Spinner, Stat, Table } from "../components/ui";

const JOURNEY = ["DEMAND_HYPOTHESIS_CREATED", "DEMAND_EVIDENCE_PENDING", "DEMAND_VALIDATED"];
const GATEWAYS = [{ value: "midtrans", label: "Midtrans (Snap)" }, { value: "xendit", label: "Xendit (Invoice)" }, { value: "duitku", label: "Duitku" }, { value: "faspay", label: "Faspay" }];

export function CustomerHome() {
  const { me, isStaff } = useSession();
  const q = useGet<any>("/requests");
  const name = me?.user?.display_name || me?.user?.email || "Anda";
  return <div className="stack" style={{ gap: 22 }}>
    <div className="card row between" style={{ padding: 22 }}>
      <div><div className="eyebrow">Selamat datang</div><h2 style={{ fontSize: 22, marginTop: 6 }}>Halo, {name}</h2>
        <p className="muted small" style={{ margin: "6px 0 0" }}>Paket <b>{me?.plan.name}</b> · {me?.usage.requests}/{me?.plan.limits.requestsPerMonth} request bulan ini{me?.subscription?.current_period_end ? ` · aktif s/d ${dt(me.subscription.current_period_end)}` : ""}</p></div>
      <div className="row"><Link className="btn primary" to="/app/requests/new">Ajukan kebutuhan <ArrowRight size={15} /></Link>{me?.plan.code === "free" && <Link className="btn" to="/app/billing">Upgrade</Link>}{isStaff && <Link className="btn" to="/app/w/executive">Command center</Link>}</div>
    </div>
    <Q q={q}>{(d) => <>
      <div className="grid g4">
        <Stat label="Request" value={d.demands.length} note="total diajukan" />
        <Stat label="Penawaran terbuka" value={d.offers.filter((o: any) => o.status === "published").length} note="menunggu keputusan Anda" />
        <Stat label="Misi berjalan" value={d.missions.filter((m: any) => !["CLOSED", "CANCELLED", "SETTLEMENT_COMPLETED", "LEARNING_RECORDED"].includes(m.status)).length} />
        <Stat label="Menunggu penerimaan" value={d.missions.filter((m: any) => m.status === "AWAITING_ACCEPTANCE").length} note="perlu tindakan Anda" />
      </div>
      {d.offers.some((o: any) => o.status === "published") && <div className="alert warn row between"><span>Ada penawaran yang menunggu persetujuan Anda.</span><Link className="btn sm" to="/app/requests">Tinjau</Link></div>}
      {d.missions.some((m: any) => m.status === "AWAITING_ACCEPTANCE") && <div className="alert warn row between"><span>Ada hasil kerja yang siap Anda tinjau dan terima.</span><Link className="btn sm" to="/app/requests">Tinjau</Link></div>}
      <Section title="Request terbaru">{d.demands.length ? <Table rows={d.demands.slice(0, 5)} cols={[{ h: "Judul", r: (r: any) => r.title }, { h: "Status", r: (r: any) => <Badge v={r.status} /> }, { h: "Diajukan", r: (r: any) => dt(r.created_at) }]} />
        : <div className="card"><Empty title="Belum ada request" hint="Ceritakan kebutuhan Anda — kami akan memvalidasi dan mengirim penawaran tertulis." action={<Link className="btn primary" to="/app/requests/new">Ajukan kebutuhan pertama</Link>} /></div>}</Section>
    </>}</Q>
  </div>;
}

export function NewRequest() {
  const { me } = useSession();
  const api = useApi();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const service = params.get("service");
  const [raw, setRaw] = useState("");
  const [draft, setDraft] = useState<any>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<unknown>(null);
  const [formKey, setFormKey] = useState(0);
  const aiAllowed = (me?.plan.limits.aiAssistsPerMonth ?? 0) > 0;
  const atLimit = me ? me.usage.requests >= me.plan.limits.requestsPerMonth : false;
  return <div className="grid g2" style={{ alignItems: "start" }}>
    <div className="card">
      {atLimit && <div className="alert warn" style={{ marginBottom: 14 }}>Kuota request paket {me?.plan.name} bulan ini sudah habis. <Link to="/app/billing">Upgrade paket</Link> untuk melanjutkan.</div>}
      {service && <div className="alert" style={{ marginBottom: 14 }}>Layanan yang diminati: <b>{service}</b>. Sebutkan di deskripsi agar operator dapat menyesuaikan penawaran.</div>}
      <Form key={formKey} label="Kirim request" successText="Request terkirim. Kami akan memvalidasi dan menghubungi Anda melalui notifikasi."
        fields={[
          { name: "title", label: "Judul kebutuhan", required: true, full: true, placeholder: "contoh: Otomasi laporan penjualan harian", defaultValue: draft?.title ?? "" },
          { name: "problem", label: "Masalah yang ingin diselesaikan", type: "textarea", required: true, placeholder: "Jelaskan konteks, kendala saat ini, dan dampaknya (min. 20 karakter).", defaultValue: draft ? `${draft.problem}${service ? `\n\nLayanan: ${service}` : ""}` : service ? `Layanan: ${service}\n\n` : "" },
          { name: "desiredOutcome", label: "Hasil yang diharapkan", type: "textarea", defaultValue: draft?.desired_outcome ?? "" },
          { name: "segment", label: "Industri / segmen", defaultValue: draft?.segment ?? "" },
          { name: "urgency", label: "Urgensi", type: "select", options: [{ value: "medium", label: "Sedang" }, { value: "low", label: "Rendah" }, { value: "high", label: "Tinggi" }], defaultValue: draft?.urgency ?? "medium" },
          { name: "budgetHintMinor", label: "Perkiraan anggaran (IDR, opsional)", type: "money", hint: "Hanya indikasi. Harga final ada di penawaran tertulis." },
        ]}
        submit={(v) => api("/requests", { method: "POST", json: v })} onDone={() => setTimeout(() => nav("/app/requests"), 900)} />
    </div>
    <div className="stack">
      <div className="card stack">
        <div className="row"><Sparkles size={16} color="var(--accent2)" /><h3>Bantu saya menyusun request</h3>{!aiAllowed && <span className="badge">Pro / Plus</span>}</div>
        <p className="muted small" style={{ margin: 0 }}>Tulis kebutuhan Anda bebas; Workers AI menyusunnya menjadi draft terstruktur. Anda tetap meninjau sebelum mengirim. AI tidak mengarang angka.</p>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="contoh: tim saya butuh dashboard stok gudang yang update otomatis dari spreadsheet…" disabled={!aiAllowed} />
        {aiErr ? <div className="alert bad">{humanError(aiErr)}</div> : null}
        {aiAllowed ? <button className="btn" disabled={aiBusy || raw.trim().length < 20} onClick={async () => {
          setAiBusy(true); setAiErr(null);
          try { const r = await api<any>("/requests/ai-draft", { method: "POST", json: { text: raw } }); setDraft(r.draft); setFormKey((k) => k + 1); } catch (e) { setAiErr(e); } finally { setAiBusy(false); }
        }}>{aiBusy ? <Spinner /> : "Buat draft"}</button> : <Link className="btn" to="/app/billing">Upgrade untuk bantuan AI</Link>}
        {draft && <div className="alert ok">Draft dimasukkan ke formulir. Periksa dan ubah sebelum mengirim.</div>}
      </div>
      <div className="card small muted"><h3>Apa yang terjadi berikutnya?</h3><ol style={{ lineHeight: 1.9, paddingLeft: 18 }}><li>Request dicatat sebagai hipotesis kebutuhan.</li><li>Operator mengumpulkan bukti dan memvalidasi.</li><li>Anda menerima penawaran tertulis (ruang lingkup, harga, refund).</li><li>Setelah Anda setuju dan membayar, misi dieksekusi.</li><li>Anda menerima atau menyengketakan hasilnya.</li></ol></div>
    </div>
  </div>;
}

export function MyRequests() {
  const q = useGet<any>("/requests");
  const { me } = useSession();
  const api = useApi();
  const [payFor, setPayFor] = useState<string | null>(null);
  return <Q q={q}>{(d) => <div className="stack" style={{ gap: 6 }}>
    <Section title="Penawaran untuk Anda" sub="Setujui hanya jika ruang lingkup, harga, dan syarat refund sudah jelas.">
      {d.offers.length === 0 ? <div className="card"><Empty title="Belum ada penawaran" hint="Penawaran muncul setelah kebutuhan Anda divalidasi dan disetujui secara internal." /></div> :
        d.offers.map((o: any) => {
          const pay = d.payments.find((p: any) => p.offer_id === o.id && p.purpose !== "subscription");
          return <div className="card stack" key={o.id}>
            <div className="row between"><h3>{o.title}</h3><Badge v={o.status} /></div>
            <dl className="kv"><dt>Ruang lingkup</dt><dd className="pre">{o.scope}</dd><dt>Hasil</dt><dd className="pre">{o.deliverables}</dd><dt>Tidak termasuk</dt><dd className="pre">{o.exclusions}</dd>
              <dt>Kriteria penerimaan</dt><dd className="pre">{o.acceptance_criteria}</dd><dt>Syarat refund</dt><dd className="pre">{o.refund_terms}</dd><dt>Waktu pengerjaan</dt><dd>{o.delivery_days} hari</dd>
              <dt>Harga</dt><dd>{idr(o.price_minor)} + pajak {idr(o.tax_minor)} = <b>{idr(o.price_minor + o.tax_minor)}</b></dd><dt>Berlaku s/d</dt><dd>{dt(o.valid_until)}</dd></dl>
            <div className="row">
              {o.status === "published" && <ActionButton cls="btn primary sm" confirm="Saya telah membaca dan menyetujui ruang lingkup, harga, dan syarat refund penawaran ini." run={() => api(`/offers/${o.id}/accept`, { method: "POST", json: { confirmTerms: true } }).then(() => q.refetch())}>Setujui penawaran</ActionButton>}
              {o.status === "accepted" && !pay && <button className="btn primary sm" onClick={() => setPayFor(o.id)}>Bayar {idr(o.price_minor + o.tax_minor)}</button>}
              {pay && <span className="row small">Pembayaran: <Badge v={pay.status} /> <Badge v={pay.mode} />{pay.checkout_url && pay.status === "PENDING" && <a className="btn sm" href={pay.checkout_url} target="_blank" rel="noreferrer">Lanjutkan pembayaran</a>}</span>}
            </div>
            {payFor === o.id && <div className="card" style={{ background: "#0b1120" }}><Form label="Buat pembayaran" cols={2} successText="Intent pembayaran dibuat."
              fields={[{ name: "provider", label: "Gateway", type: "select", options: GATEWAYS }, { name: "customerName", label: "Nama pada tagihan", required: true, defaultValue: me?.user?.display_name ?? "" }, { name: "customerPhone", label: "No. HP (opsional)", type: "tel" }]}
              submit={async (v) => { const r = await api<any>("/payments/intents", { method: "POST", json: { offerId: o.id, ...v }, headers: { "idempotency-key": newIdemKey() } }); if (r.checkout_url) window.open(r.checkout_url, "_blank", "noopener"); setPayFor(null); q.refetch(); return r; }}
              intro={<p className="small muted" style={{ margin: 0 }}>Status hanya menjadi "berhasil" setelah gateway mengirim konfirmasi terverifikasi. Jika pembayaran live belum diaktifkan, sistem membuat intent <b>mock</b> tanpa tagihan nyata.</p>} /></div>}
          </div>;
        })}
    </Section>
    <Section title="Misi & delivery">
      <Table rows={d.missions} empty="Belum ada misi" cols={[
        { h: "Misi", r: (m: any) => <Link to={`/app/missions/${m.id}`}>{m.title}</Link> }, { h: "Status", r: (m: any) => <Badge v={m.status} /> }, { h: "Tenggat", r: (m: any) => dt(m.due_at) },
        { h: "Delivery", r: (m: any) => m.delivery_note ? <span className="small clip" title={m.delivery_note}>{m.delivery_note}</span> : <span className="dim">—</span> },
        { h: "Aksi", r: (m: any) => m.status === "AWAITING_ACCEPTANCE" ? <Link className="btn primary sm" to={`/app/missions/${m.id}`}>Tinjau & terima</Link> : <Link className="btn sm" to={`/app/missions/${m.id}`}>Detail</Link> },
      ]} />
    </Section>
    <Section title="Request saya">
      <Table rows={d.demands} empty="Belum ada request" cols={[{ h: "Judul", r: (r: any) => r.title }, { h: "Urgensi", r: (r: any) => r.urgency }, { h: "Progres", r: (r: any) => <div className="timeline">{JOURNEY.map((s, i) => { const cur = JOURNEY.indexOf(r.status); return <span key={s} className={`t ${i < cur ? "done" : i === cur ? "now" : ""}`}>{["Diterima", "Validasi", "Tervalidasi"][i]}</span>; })}{!JOURNEY.includes(r.status) && <Badge v={r.status} />}</div> }, { h: "Diajukan", r: (r: any) => dt(r.created_at) }]} />
    </Section>
    <Section title="Riwayat pembayaran">
      <Table rows={d.payments} empty="Belum ada pembayaran" cols={[{ h: "Order", r: (p: any) => <span className="mono small">{p.merchant_order_id}</span> }, { h: "Tujuan", r: (p: any) => p.purpose === "subscription" ? `Langganan ${p.plan_code}` : "Penawaran" }, { h: "Jumlah", r: (p: any) => idr(p.amount) }, { h: "Status", r: (p: any) => <Badge v={p.status} /> }, { h: "Mode", r: (p: any) => <Badge v={p.mode} /> }, { h: "Dibuat", r: (p: any) => dt(p.created_at) }]} />
    </Section>
  </div>}</Q>;
}

export function Billing() {
  const q = useGet<any>("/billing");
  const plans = usePublic<{ plans: Plan[] }>("/plans");
  const { me, refetch } = useSession();
  const api = useApi();
  const [choose, setChoose] = useState<Plan | null>(null);
  const [result, setResult] = useState<any>(null);
  const cancel = useAction((a) => a("/billing/cancel", { method: "POST", json: {} }));
  return <div className="stack" style={{ gap: 20 }}>
    <Q q={q}>{(b) => <div className="grid g3">
      <Stat label="Paket aktif" value={b.plan.name} note={b.subscription?.current_period_end ? `berlaku s/d ${dt(b.subscription.current_period_end)}` : b.plan.code === "free" ? "gratis selamanya" : ""} />
      <Stat label="Request bulan ini" value={`${b.usage.requests} / ${b.plan.limits.requestsPerMonth}`} />
      <Stat label="Bantuan AI bulan ini" value={`${b.usage.aiAssists} / ${b.plan.limits.aiAssistsPerMonth}`} note={b.plan.limits.aiAssistsPerMonth ? "Workers AI" : "tersedia di Pro/Plus"} />
    </div>}</Q>
    {result && <div className={`alert ${result.mode === "live" ? "ok" : "warn"}`}>{result.notice ?? (result.checkoutUrl ? "Halaman pembayaran dibuka di tab baru. Paket aktif setelah gateway mengonfirmasi pembayaran." : "Paket diperbarui.")}</div>}
    {plans.data && <div className="grid g3">{plans.data.plans.map((p) => { const current = me?.plan.code === p.code; return <div key={p.code} className={`card price ${p.highlight ? "hl" : ""}`}>
      <div className="row between"><h3 style={{ fontSize: 19 }}>{p.name}</h3>{current && <span className="badge ok">Paket Anda</span>}</div>
      <div className="amt">{p.priceMonthly ? idr(p.priceMonthly) : "Gratis"}<span className="muted small" style={{ fontWeight: 400 }}>{p.priceMonthly ? " / 30 hari" : ""}</span></div>
      <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul><div className="grow" />
      <button className={`btn ${p.highlight ? "primary" : ""}`} disabled={current} onClick={() => { setChoose(p); setResult(null); }}>{current ? "Aktif" : p.priceMonthly ? `Upgrade ke ${p.name}` : "Pindah ke Free"}</button>
    </div>; })}</div>}
    {choose && <div className="card"><h3>Konfirmasi paket {choose.name}</h3>
      <Form label={choose.priceMonthly ? `Bayar ${idr(choose.priceMonthly)}` : "Aktifkan Free"} successText="Diproses."
        fields={choose.priceMonthly ? [{ name: "provider", label: "Gateway pembayaran", type: "select", options: GATEWAYS }, { name: "customerName", label: "Nama pada tagihan", required: true, defaultValue: me?.user?.display_name ?? "" }, { name: "customerPhone", label: "No. HP (opsional)", type: "tel" }]
          : [{ name: "customerName", label: "Nama", required: true, defaultValue: me?.user?.display_name ?? "Pengguna" }]}
        submit={async (v) => { const r = await api<any>("/billing/subscribe", { method: "POST", json: { plan: choose.code, ...v }, headers: { "idempotency-key": newIdemKey() } }); setResult(r); if (r.checkoutUrl) window.open(r.checkoutUrl, "_blank", "noopener"); setChoose(null); q.refetch(); refetch(); return r; }}
        intro={<p className="small muted" style={{ margin: 0 }}>Harga ditetapkan server ({idr(choose.priceMonthly)} / 30 hari), tanpa perpanjangan otomatis. Paket berbayar aktif hanya setelah pembayaran diverifikasi gateway.</p>} /></div>}
    <Q q={q}>{(b) => <Section title="Riwayat langganan" actions={b.subscription && b.plan.code !== "free" && !b.subscription.cancel_at_period_end ? <button className="btn sm danger" onClick={() => window.confirm("Hentikan di akhir periode?") && cancel.mutate(undefined)}>Hentikan di akhir periode</button> : null}>
      <Table rows={b.history} empty="Belum ada riwayat" cols={[{ h: "Paket", r: (s: any) => s.plan_code }, { h: "Status", r: (s: any) => <Badge v={s.status} /> }, { h: "Pembayaran", r: (s: any) => s.payment_status ? <span className="row"><Badge v={s.payment_status} /><Badge v={s.mode} /></span> : "—" }, { h: "Jumlah", r: (s: any) => s.amount ? idr(s.amount) : "—" }, { h: "Periode", r: (s: any) => s.current_period_end ? `${dt(s.current_period_start)} → ${dt(s.current_period_end)}` : "—" }, { h: "", r: (s: any) => s.checkout_url && s.payment_status === "PENDING" ? <a className="btn sm" href={s.checkout_url} target="_blank" rel="noreferrer">Bayar</a> : null }]} />
    </Section>}</Q>
  </div>;
}

export function ContributorPage() {
  const { me, refetch } = useSession();
  const api = useApi();
  const tasks = useGet<any>(me?.contributor ? "/contributor/tasks" : null);
  return <div className="grid g2" style={{ alignItems: "start" }}>
    <div className="card stack">
      <div className="row between"><h3>Profil kontributor</h3>{me?.contributor && <Badge v={me.contributor.status} />}</div>
      <p className="muted small" style={{ margin: 0 }}>Kontributor dilibatkan saat dibutuhkan penilaian spesialis, kehadiran fisik, atau tanggung jawab manusia. Setiap tugas memiliki ruang lingkup, kriteria, tenggat, dan kompensasi yang jelas sebelum dimulai.</p>
      <Form label={me?.contributor ? "Perbarui profil" : "Daftar sebagai kontributor"} resetOnSuccess={false} successText="Profil tersimpan. Menunggu verifikasi operator."
        fields={[{ name: "headline", label: "Keahlian utama", required: true, full: true, defaultValue: me?.contributor?.headline ?? "", placeholder: "contoh: Data analyst & automation" },
          { name: "skills", label: "Keterampilan & pengalaman", type: "textarea", required: true, defaultValue: me?.contributor?.skills ?? "" }, { name: "locale", label: "Lokasi / zona waktu" },
          { name: "acceptTerms", label: "Saya menyetujui Ketentuan Kontributor", type: "checkbox", required: true }]}
        submit={async (v) => { if (!v.acceptTerms) throw new Error("Anda harus menyetujui Ketentuan Kontributor."); const r = await api("/contributor/profile", { method: "POST", json: v }); refetch(); return r; }} />
      <Link to="/contributor-terms" className="small">Baca Ketentuan Kontributor</Link>
    </div>
    <div className="stack"><h3>Tugas saya</h3>
      {!me?.contributor ? <div className="card"><Empty title="Belum terdaftar" hint="Lengkapi profil untuk menerima penugasan." /></div> :
        <Q q={tasks} empty={(d: any) => d.items.length === 0 && "Belum ada tugas yang ditugaskan"}>{(d: any) => <div className="stack">{d.items.map((t: any) => <div className="card stack" key={t.id} style={{ gap: 8 }}>
          <div className="row between"><strong>{t.title}</strong><Badge v={t.status} /></div><div className="small dim">Misi: {t.mission_title} · tenggat {dt(t.due_at)}</div>
          <p className="small muted pre" style={{ margin: 0 }}>{t.description}</p><div className="small"><b>Kriteria:</b> {t.acceptance_criteria}</div>
          <div className="row small"><b>Kompensasi: {idr(t.compensation_minor)}</b>{t.payout_status && <>· pembayaran <Badge v={t.payout_status} /></>}</div>
          {["todo", "in_progress", "blocked"].includes(t.status) && <div className="row">
            {t.status !== "in_progress" && <ActionButton run={() => api(`/contributor/tasks/${t.id}/status`, { method: "POST", json: { status: "in_progress" } }).then(() => tasks.refetch())}>Mulai</ActionButton>}
            <ActionButton cls="btn primary sm" run={() => api(`/contributor/tasks/${t.id}/status`, { method: "POST", json: { status: "review" } }).then(() => tasks.refetch())}>Kirim untuk review</ActionButton>
            <ActionButton cls="btn ghost sm" run={() => api(`/contributor/tasks/${t.id}/status`, { method: "POST", json: { status: "blocked" } }).then(() => tasks.refetch())}>Laporkan kendala</ActionButton></div>}
        </div>)}</div>}</Q>}
    </div>
  </div>;
}

export function Notifications() {
  const q = useGet<any>("/notifications?limit=100");
  const api = useApi();
  return <Q q={q} empty={(d: any) => d.items.length === 0 && "Belum ada notifikasi"}>{(d: any) => <div className="stack">{d.items.map((n: any) =>
    <div key={n.id} className="card row between" style={{ opacity: n.read_at ? 0.6 : 1 }}><div><strong>{n.title}</strong>{n.body && <div className="small muted">{n.body}</div>}<div className="small dim">{dt(n.created_at)}</div></div>
      <div className="row">{n.link && <Link className="btn sm" to={n.link}>Buka</Link>}{!n.read_at && <ActionButton run={() => api(`/notifications/${n.id}/read`, { method: "POST", json: {} }).then(() => q.refetch())}>Tandai dibaca</ActionButton>}</div></div>)}</div>}</Q>;
}
