import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { dt, humanError, idr, newIdemKey, useApi, useGet } from "../lib/api";
import { useSession } from "../lib/session";
import { Form } from "../components/Form";
import { ActionButton, Badge, Empty, Q, Section, Table } from "../components/ui";

const GATEWAYS = [{ value: "midtrans", label: "Midtrans (Snap)" }, { value: "xendit", label: "Xendit (Invoice)" }, { value: "duitku", label: "Duitku" }, { value: "faspay", label: "Faspay" }];
const STATE_LABEL: Record<string, string> = {
  NONE: "—", DEMAND_HYPOTHESIS_CREATED: "Request diterima", DEMAND_EVIDENCE_PENDING: "Validasi bukti", DEMAND_VALIDATED: "Kebutuhan tervalidasi", DEFERRED: "Ditunda", REJECTED: "Tidak dilanjutkan",
  MISSION_PLANNED: "Misi direncanakan", TASKS_DECOMPOSED: "Tugas disusun", RESOURCES_ASSIGNED: "Pelaksana ditugaskan", EXECUTING: "Dikerjakan", QUALITY_REVIEW: "Quality review", READY_FOR_DELIVERY: "Siap dikirim",
  DELIVERED: "Dikirim", AWAITING_ACCEPTANCE: "Menunggu penerimaan Anda", ACCEPTED: "Diterima", DISPUTED: "Disengketakan", SETTLEMENT_COMPLETED: "Penyelesaian", CLOSED: "Ditutup",
};
const EVENT_LABEL: Record<string, string> = { "offer.accepted": "Anda menyetujui penawaran", "payment_intent.created": "Pembayaran dibuat", "payment.status_changed": "Status pembayaran berubah" };

/** Onboarding: consent to current terms + privacy, workspace name. Required before using the portal. */
export function Onboarding() {
  const { me, refetch } = useSession();
  const api = useApi();
  return <div className="auth-wrap"><div className="card stack" style={{ maxWidth: 560, width: "100%" }}>
    <div className="eyebrow">Selamat datang di DAYANEXA</div><h2 style={{ fontSize: 22 }}>Lengkapi profil Anda</h2>
    <p className="muted small" style={{ margin: 0 }}>Kami mencatat persetujuan Anda (versi {me?.termsVersion}). Data disimpan sesuai Kebijakan Privasi; Anda dapat mengekspor atau meminta penghapusan kapan saja.</p>
    <Form cols={1} label="Mulai" resetOnSuccess={false} successText="Tersimpan."
      fields={[{ name: "displayName", label: "Nama tampilan", defaultValue: me?.user?.display_name ?? "" },
        { name: "workspaceName", label: "Nama workspace / bisnis", required: true, defaultValue: me?.organizations?.[0]?.name ?? "" },
        { name: "acceptTerms", label: "Saya menyetujui Syarat Layanan dan Kebijakan Refund", type: "checkbox", required: true },
        { name: "acceptPrivacy", label: "Saya menyetujui Kebijakan Privasi", type: "checkbox", required: true }]}
      submit={async (v) => { if (!v.acceptTerms || !v.acceptPrivacy) throw new Error("Persetujuan wajib dicentang."); const r = await api("/onboarding", { method: "POST", json: v }); refetch(); return r; }} />
    <div className="row small"><Link to="/terms" target="_blank">Syarat</Link><Link to="/privacy" target="_blank">Privasi</Link><Link to="/refund-policy" target="_blank">Refund</Link></div>
  </div></div>;
}

/** Customer request detail: ID, status, next action, timeline, versioned quotes, payment, invoices, missions, support. */
export function RequestDetail() {
  const { id } = useParams();
  const q = useGet<any>(`/requests/${id}`);
  const { me } = useSession();
  const api = useApi();
  const [payFor, setPayFor] = useState<string | null>(null);
  return <Q q={q}>{(d) => { const r = d.demand; const n = d.next; return <div className="stack" style={{ gap: 6 }}>
    <div className="card stack">
      <div className="row between"><div><div className="eyebrow">Request <span className="mono">{r.id}</span></div><h2 style={{ fontSize: 20, marginTop: 4 }}>{r.title}</h2><div className="small dim">Diajukan {dt(r.created_at)} · urgensi {r.urgency}</div></div><Badge v={r.status} /></div>
      <div className={`alert ${n.actor === "customer" ? "warn" : n.actor === "none" ? "ok" : ""}`}><b>{n.actor === "customer" ? "Tindakan Anda: " : n.actor === "dayanexa" ? "Sedang ditangani DAYANEXA: " : "Status: "}</b>{n.label}{n.link && <> <Link to={n.link}>Buka</Link></>}</div>
      {r.validation_note && <div className="small"><b>Catatan validasi:</b> {r.validation_note}</div>}
    </div>
    {d.offers.length > 0 && <Section title="Penawaran (versi)" sub="Setujui hanya versi yang Anda tinjau. Harga ditetapkan server dan tidak berubah setelah disetujui.">
      {d.offers.map((o: any) => { const pay = d.payments.find((p: any) => p.offer_id === o.id); return <div className="card stack" key={o.id} style={{ opacity: o.status === "withdrawn" ? 0.6 : 1 }}>
        <div className="row between"><h3>{o.title} <span className="badge">v{o.version}</span> {o.service_layer === "managed" && <span className="badge info">Managed</span>}</h3><Badge v={o.status} /></div>
        <dl className="kv"><dt>Ruang lingkup</dt><dd className="pre">{o.scope}</dd><dt>Hasil</dt><dd className="pre">{o.deliverables}</dd>{o.assumptions && <><dt>Asumsi</dt><dd className="pre">{o.assumptions}</dd></>}<dt>Tidak termasuk</dt><dd className="pre">{o.exclusions}</dd>
          <dt>Kriteria penerimaan</dt><dd className="pre">{o.acceptance_criteria}</dd>{o.revision_policy && <><dt>Revisi</dt><dd className="pre">{o.revision_policy}</dd></>}<dt>Refund & sengketa</dt><dd className="pre">{o.refund_terms}</dd>
          {o.payment_terms && <><dt>Pembayaran</dt><dd className="pre">{o.payment_terms}</dd></>}<dt>Waktu pengerjaan</dt><dd>{o.delivery_days} hari</dd>
          <dt>Harga</dt><dd>{idr(o.price_minor)} + pajak {idr(o.tax_minor)} = <b>{idr(o.price_minor + o.tax_minor)}</b></dd><dt>Berlaku s/d</dt><dd>{dt(o.valid_until)}</dd>
          <dt>Sidik versi</dt><dd className="mono small dim">{o.snapshot_hash?.slice(0, 16)}…</dd></dl>
        <div className="row">
          {o.status === "published" && <ActionButton cls="btn primary sm" confirm={`Saya menyetujui penawaran versi ${o.version} (${idr(o.price_minor + o.tax_minor)}) beserta ruang lingkup, syarat revisi, refund dan sengketa.`} run={() => api(`/offers/${o.id}/accept`, { method: "POST", json: { confirmTerms: true, snapshotHash: o.snapshot_hash } }).then(() => q.refetch())}>Setujui versi {o.version}</ActionButton>}
          {o.status === "accepted" && (!pay || ["FAILED", "EXPIRED"].includes(pay.status)) && <button className="btn primary sm" onClick={() => setPayFor(o.id)}>Bayar {idr(o.price_minor + o.tax_minor)}</button>}
          {pay && <span className="row small">Pembayaran <span className="mono">{pay.merchant_order_id}</span>: <Badge v={pay.status} /> <Badge v={pay.mode} />{pay.checkout_url && pay.status === "PENDING" && <a className="btn sm" href={pay.checkout_url} target="_blank" rel="noreferrer">Lanjutkan pembayaran</a>}</span>}
        </div>
        {payFor === o.id && <div className="card" style={{ background: "#0b1120" }}><Form label="Buat pembayaran" successText="Pembayaran dibuat."
          fields={[{ name: "provider", label: "Gateway", type: "select", options: GATEWAYS }, { name: "customerName", label: "Nama pada tagihan", required: true, defaultValue: me?.user?.display_name ?? "" }, { name: "customerPhone", label: "No. HP (opsional)", type: "tel" }]}
          submit={async (v) => { const res = await api<any>("/payments/intents", { method: "POST", json: { offerId: o.id, ...v }, headers: { "idempotency-key": newIdemKey() } }); if (res.checkout_url) window.open(res.checkout_url, "_blank", "noopener"); setPayFor(null); q.refetch(); return res; }}
          intro={<p className="small muted" style={{ margin: 0 }}>Jumlah diambil dari penawaran yang Anda setujui. Status "berhasil" hanya setelah gateway mengirim konfirmasi terverifikasi — redirect browser bukan bukti bayar. Bila pembayaran live belum aktif, dibuat pembayaran <b>mode uji</b> tanpa tagihan.</p>} /></div>}
      </div>; })}
    </Section>}
    {d.invoices.length > 0 && <Section title="Invoice proyek"><Table rows={d.invoices} cols={[{ h: "Nomor", r: (i: any) => <span className="mono small">{i.number}</span> }, { h: "Total", r: (i: any) => idr(i.total_minor) }, { h: "Status", r: (i: any) => <Badge v={i.status} /> }, { h: "Mode", r: (i: any) => <Badge v={i.mode} /> }, { h: "Terbit", r: (i: any) => dt(i.issued_at) }]} /></Section>}
    {d.missions.length > 0 && <Section title="Misi"><Table rows={d.missions} cols={[{ h: "Misi", r: (m: any) => <Link to={`/app/missions/${m.id}`}>{m.title}</Link> }, { h: "Status", r: (m: any) => <Badge v={m.status} /> }, { h: "Tenggat", r: (m: any) => dt(m.due_at) }]} /></Section>}
    <Section title="Linimasa"><div className="card"><ol className="timeline-v">
      {[...d.timeline.map((t: any) => ({ at: t.created_at, label: STATE_LABEL[t.to_state] ?? t.to_state, note: t.reason, kind: t.entity_type })), ...d.events.map((e: any) => ({ at: e.created_at, label: EVENT_LABEL[e.action] ?? e.action, note: null, kind: "event" }))]
        .sort((a, b) => String(a.at).localeCompare(String(b.at))).map((e, i) => <li key={i}><span className="small dim">{dt(e.at)}</span> <b>{e.label}</b>{e.note && <span className="small muted"> — {e.note}</span>}</li>)}
    </ol></div></Section>
    <Section title="Dukungan untuk request ini">
      {d.tickets.map((t: any) => <div className="card small" key={t.id}><div className="row between"><b>{t.subject}</b><Badge v={t.status} /></div>{t.staff_reply && <p className="muted" style={{ margin: "6px 0 0" }}>Balasan: {t.staff_reply}</p>}</div>)}
      <details className="card"><summary>Ajukan pertanyaan / kendala</summary><div style={{ marginTop: 12 }}><Form cols={1} label="Kirim" fields={[{ name: "subject", label: "Subjek", required: true }, { name: "body", label: "Pesan", type: "textarea", required: true }]}
        submit={(v) => api("/support", { method: "POST", json: { ...v, relatedType: "demand", relatedId: r.id } }).then((x) => { q.refetch(); return x; })} /></div></details>
    </Section>
  </div>; }}</Q>;
}

export function SupportPage() {
  const q = useGet<any>("/support");
  const api = useApi();
  return <div className="grid g2" style={{ alignItems: "start" }}>
    <div className="card"><h3>Hubungi dukungan</h3><Form cols={1} label="Kirim tiket" successText="Tiket terkirim. Balasan akan muncul di notifikasi."
      fields={[{ name: "subject", label: "Subjek", required: true }, { name: "relatedType", label: "Terkait", type: "select", options: [{ value: "other", label: "Umum" }, { value: "demand", label: "Request" }, { value: "payment", label: "Pembayaran" }, { value: "subscription", label: "Langganan" }, { value: "mission", label: "Misi" }] }, { name: "relatedId", label: "ID terkait (opsional)" }, { name: "body", label: "Pesan", type: "textarea", required: true }]}
      submit={(v) => api("/support", { method: "POST", json: v }).then((x) => { q.refetch(); return x; })} /></div>
    <Q q={q} empty={(d: any) => d.items.length === 0 && "Belum ada tiket"}>{(d: any) => <div className="stack">{d.items.map((t: any) => <div className="card stack" key={t.id} style={{ gap: 6 }}>
      <div className="row between"><b>{t.subject}</b><Badge v={t.status} /></div><div className="small dim">{dt(t.created_at)}{t.related_id ? ` · ${t.related_type} ${t.related_id}` : ""}</div>
      <p className="small muted pre" style={{ margin: 0 }}>{t.body}</p>{t.staff_reply && <div className="alert ok small">Balasan ({dt(t.replied_at)}): {t.staff_reply}</div>}</div>)}</div>}</Q>
  </div>;
}

export function PrivacyPage() {
  const api = useApi();
  const q = useGet<any>("/privacy/requests");
  const [err, setErr] = useState<unknown>(null);
  const exportData = async () => {
    setErr(null);
    try { const data = await api("/privacy/export"); const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `dayanexa-data-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href); q.refetch(); }
    catch (e) { setErr(e); }
  };
  return <div className="grid g2" style={{ alignItems: "start" }}>
    <div className="card stack"><h3>Ekspor data saya</h3><p className="muted small" style={{ margin: 0 }}>Unduh salinan JSON profil, request, penawaran, pembayaran, invoice, misi, dan tiket dukungan Anda.</p>
      {err ? <div className="alert bad">{humanError(err)}</div> : null}<button className="btn" onClick={exportData}>Unduh data (JSON)</button></div>
    <div className="card stack"><h3>Minta penghapusan akun</h3><p className="muted small" style={{ margin: 0 }}>Ditinjau oleh pemilik. Profil dianonimkan; catatan keuangan & audit yang wajib disimpan tetap dipertahankan sesuai hukum.</p>
      <Form cols={1} label="Kirim permintaan" fields={[{ name: "reason", label: "Alasan (opsional)", type: "textarea" }, { name: "confirm", label: "Saya memahami konsekuensinya", type: "checkbox", required: true }]}
        submit={async (v) => { if (!v.confirm) throw new Error("Centang konfirmasi."); const r = await api("/privacy/delete-request", { method: "POST", json: v }); q.refetch(); return r; }} /></div>
    <Section title="Riwayat permintaan"><Q q={q}>{(d: any) => <Table rows={d.items} empty="Belum ada permintaan" cols={[{ h: "Jenis", r: (r: any) => r.kind }, { h: "Status", r: (r: any) => <Badge v={r.status} /> }, { h: "Dibuat", r: (r: any) => dt(r.created_at) }, { h: "Selesai", r: (r: any) => dt(r.completed_at) }]} />}</Q></Section>
  </div>;
}

/** Contributor: visible compensation before acceptance; accept/decline; submit; payable → paid only from ledger. */
export function ContributorTasks() {
  const api = useApi();
  const tasks = useGet<any>("/contributor/tasks");
  const earnings = useGet<any>("/contributor/earnings");
  const refresh = () => { tasks.refetch(); earnings.refetch(); };
  return <div className="stack">
    <Q q={earnings}>{(e: any) => <div className="grid g4">
      <div className="card stat"><span>Komitmen (belum payable)</span><strong>{idr(e.committed_not_yet_payable)}</strong><small>tugas diterima, belum lolos review</small></div>
      <div className="card stat"><span>Payable tercatat</span><strong>{idr(e.payable_total)}</strong><small>diposting ke ledger</small></div>
      <div className="card stat"><span>Disetujui, belum ditransfer</span><strong>{idr(e.approved_unpaid)}</strong></div>
      <div className="card stat"><span>Sudah dibayar</span><strong>{idr(e.paid_total)}</strong><small>dengan referensi transfer</small></div>
    </div>}</Q>
    <Q q={tasks} empty={(d: any) => d.items.length === 0 && "Belum ada tugas yang ditugaskan"}>{(d: any) => <div className="stack">{d.items.map((t: any) => <div className="card stack" key={t.id} style={{ gap: 8 }}>
      <div className="row between"><strong>{t.title}</strong><span className="row"><Badge v={t.status} />{t.contributor_decision && <Badge v={t.contributor_decision} />}</span></div>
      <div className="small dim">Misi: {t.mission_title} · tenggat {dt(t.due_at)}</div>
      <p className="small muted pre" style={{ margin: 0 }}>{t.description}</p><div className="small"><b>Kriteria penerimaan:</b> {t.acceptance_criteria}</div>
      <div className="row small"><b>Kompensasi: {idr(t.compensation_minor)}</b>{t.payable_posted ? <Badge v="payable" /> : null}{t.payout_status && <>· payout <Badge v={t.payout_status} />{t.payout_reference && <span className="mono dim">ref {t.payout_reference}</span>}</>}</div>
      {t.review_note && <div className="alert small">Catatan review: {t.review_note}</div>}
      {!t.contributor_decision && t.status === "todo" && <div className="row">
        <ActionButton cls="btn primary sm" confirm={`Saya menerima ruang lingkup, kriteria, tenggat, dan kompensasi ${idr(t.compensation_minor)} untuk tugas ini.`} run={() => api(`/contributor/tasks/${t.id}/decision`, { method: "POST", json: { decision: "accepted" } }).then(refresh)}>Terima tugas</ActionButton>
        <ActionButton cls="btn ghost sm" confirm="Tolak tugas ini?" run={() => api(`/contributor/tasks/${t.id}/decision`, { method: "POST", json: { decision: "declined" } }).then(refresh)}>Tolak</ActionButton></div>}
      {t.contributor_decision === "accepted" && ["todo", "in_progress", "blocked"].includes(t.status) && <div className="stack">
        <div className="row">{t.status !== "in_progress" && <ActionButton run={() => api(`/contributor/tasks/${t.id}/status`, { method: "POST", json: { status: "in_progress" } }).then(refresh)}>Mulai</ActionButton>}
          <ActionButton cls="btn ghost sm" run={() => api(`/contributor/tasks/${t.id}/status`, { method: "POST", json: { status: "blocked" } }).then(refresh)}>Laporkan kendala</ActionButton></div>
        <details><summary className="small">Kirim hasil kerja</summary><Form cols={1} label="Kirim untuk review" fields={[{ name: "note", label: "Ringkasan hasil & tautan", type: "textarea", required: true }]} submit={(v) => api(`/contributor/tasks/${t.id}/submit`, { method: "POST", json: v }).then(refresh)} /></details>
      </div>}
    </div>)}</div>}</Q>
  </div>;
}

/** Operator queues — every state has an owner and a next action. */
export function OpsQueues() {
  const q = useGet<any>("/ops/queues", { refetchInterval: 60_000 });
  return <Q q={q}>{(d: any) => { const active = d.queues.filter((x: any) => x.items.length); return <div className="stack">
    <div className="grid g4">{d.queues.map((x: any) => <Link key={x.key} to={x.link} className="card stat" style={{ textDecoration: "none" }}><span>{x.label}</span><strong>{x.items.length}</strong><small>pemilik: {x.owner}</small></Link>)}</div>
    {active.length === 0 ? <div className="card"><Empty title="Semua antrean kosong" /></div> : active.map((x: any) => <Section key={x.key} title={`${x.label} (${x.items.length})`} actions={<Link className="btn sm" to={x.link}>Kerjakan</Link>}>
      <Table rows={x.items.slice(0, 8)} cols={Object.keys(x.items[0]).filter((k) => !["submission_note", "payload_json"].includes(k)).slice(0, 5).map((k) => ({ h: k, r: (r: any) => <span className="small">{/(_at$)/.test(k) ? dt(r[k]) : /amount/.test(k) ? idr(r[k]) : String(r[k] ?? "—")}</span> }))} />
    </Section>)}
  </div>; }}</Q>;
}
