import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, SignIn, SignUp, UserButton } from "@clerk/clerk-react";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { idr, usePublic } from "../lib/api";
import { Loading, ErrorBox } from "../components/ui";

export function Brand() { return <Link to="/" className="brand"><span className="mark">D</span><span>DAYANEXA<small>OPPORTUNITY OS</small></span></Link>; }

export function PublicLayout() {
  return <>
    <header className="pub-nav"><nav className="in" aria-label="Navigasi utama">
      <Brand />
      <div className="pub-links">
        <NavLink to="/how-it-works">Cara kerja</NavLink><NavLink to="/catalog">Layanan</NavLink><NavLink to="/pricing">Harga</NavLink><NavLink to="/faq">FAQ</NavLink><NavLink to="/contact">Kontak</NavLink>
      </div>
      <div className="grow" />
      <SignedOut><Link className="btn ghost" to="/sign-in">Masuk</Link><Link className="btn primary" to="/sign-up">Mulai gratis</Link></SignedOut>
      <SignedIn><Link className="btn primary" to="/app">Buka aplikasi</Link><UserButton /></SignedIn>
    </nav></header>
    <main id="main"><Outlet /></main>
    <footer className="footer"><div className="wrap cols">
      <div><Brand /><p style={{ maxWidth: 360 }}>Discover demand. Build the capability. Deliver the outcome.</p></div>
      <div className="stack small"><strong style={{ color: "var(--text)" }}>Produk</strong><Link to="/how-it-works">Cara kerja</Link><Link to="/catalog">Layanan</Link><Link to="/pricing">Harga</Link></div>
      <div className="stack small"><strong style={{ color: "var(--text)" }}>Kebijakan</strong><Link to="/terms">Syarat</Link><Link to="/privacy">Privasi</Link><Link to="/refund-policy">Refund & sengketa</Link><Link to="/contributor-terms">Ketentuan kontributor</Link></div>
      <div className="small">© 2026 DAYANEXA · dayanexa.biz.id</div>
    </div></footer>
  </>;
}

const STEPS = [
  ["01", "Kirim kebutuhan", "Ceritakan masalah dan hasil yang Anda inginkan. Request diperlakukan sebagai hipotesis, bukan janji."],
  ["02", "Validasi & penawaran", "Kami memvalidasi kebutuhan dengan bukti, merancang solusi, lalu mengirim penawaran tertulis: ruang lingkup, harga, pengecualian, kriteria terima, syarat refund."],
  ["03", "Eksekusi terkendali", "Agen AI dan kontributor manusia terverifikasi mengeksekusi misi dengan quality gate dan jejak audit."],
  ["04", "Terima & bayar", "Anda menerima atau menyengketakan hasil secara eksplisit. Pembayaran hanya diakui setelah diverifikasi gateway."],
];

export function Landing() {
  return <>
    <section className="wrap hero">
      <div className="stack" style={{ gap: 20 }}>
        <span className="eyebrow row" style={{ gap: 8 }}><Sparkles size={14} /> Agentic Opportunity & Execution OS</span>
        <h1>Temukan kebutuhan nyata.<br /><em>Bentuk kapabilitasnya.</em><br />Kirim hasil yang diterima.</h1>
        <p>DAYANEXA mengubah kebutuhan yang tervalidasi menjadi solusi yang dieksekusi — oleh agen AI dan kontributor terverifikasi — dengan harga transparan dan hasil yang Anda terima secara eksplisit.</p>
        <div className="row"><Link to="/sign-up" className="btn primary lg">Mulai gratis dengan Google <ArrowRight size={16} /></Link><Link to="/pricing" className="btn lg">Lihat harga</Link></div>
        <div className="row small muted" style={{ gap: 18 }}><span className="row" style={{ gap: 6 }}><ShieldCheck size={15} /> Login Google aman (Clerk)</span><span className="row" style={{ gap: 6 }}><CheckCircle2 size={15} /> Tanpa kartu untuk paket Free</span></div>
      </div>
      <div className="flow" aria-label="Alur kerja">{STEPS.map(([n, t, d]) => <div className="step" key={n}><span className="num">{n}</span><div><strong>{t}</strong><div className="small muted" style={{ marginTop: 4 }}>{d}</div></div></div>)}</div>
    </section>
    <section className="section"><div className="wrap">
      <h2>Bukan job board. Bukan chatbot.</h2>
      <p className="lead">Kami tidak mengarang permintaan, testimoni, atau angka pendapatan. Setiap status — pembayaran, eksekusi, penerimaan — ditampilkan apa adanya.</p>
      <div className="grid g3">
        {[["Demand-first", "Bukti pasar mendahului asumsi solusi. Sinyal bukan bukti; validasi butuh bukti dari beberapa sumber."],
          ["Harga transparan", "Penawaran mencantumkan ruang lingkup, hasil, pengecualian, jangka waktu, kriteria penerimaan, dan syarat refund."],
          ["Hasil terverifikasi", "Keberhasilan diukur dari hasil yang Anda terima dan pembayaran yang diverifikasi — bukan aktivitas."]].map(([t, d]) =>
          <div className="card" key={t}><h3>{t}</h3><p className="muted small">{d}</p></div>)}
      </div>
    </div></section>
    <PricingSection compact />
  </>;
}

export function HowItWorks() {
  return <section className="wrap section">
    <h2>Cara kerja DAYANEXA</h2>
    <p className="lead">Satu siklus hidup kanonik dari sinyal hingga hasil yang diselesaikan, dengan persetujuan manusia untuk setiap komitmen eksternal.</p>
    <div className="grid g2">{STEPS.map(([n, t, d]) => <div className="card" key={n}><span className="eyebrow">{n}</span><h3 style={{ marginTop: 8 }}>{t}</h3><p className="muted">{d}</p></div>)}</div>
    <div className="card" style={{ marginTop: 18 }}><h3>Keamanan & kepercayaan</h3><ul className="muted" style={{ lineHeight: 1.9 }}>
      <li>Login hanya melalui Google pada instans Clerk Production.</li><li>Otorisasi berbasis peran ditegakkan di server pada setiap operasi.</li>
      <li>Webhook pembayaran diverifikasi tanda tangannya; redirect browser tidak pernah dianggap bukti bayar.</li>
      <li>Berkas hasil disimpan privat (R2) dan diunduh lewat tautan bertanda tangan berumur pendek.</li><li>Pembukuan double-entry yang seimbang dan tidak dapat diubah; koreksi melalui jurnal pembalik.</li>
    </ul></div>
  </section>;
}

interface PlansResp { plans: { code: string; name: string; tagline: string; priceMonthly: number; highlight: boolean; features: string[]; limits: { requestsPerMonth: number } }[]; servicePackages: { code: string; name: string; kind: string; startingPrice: number; unit: string; deliveryDays: string; summary: string; includes: string[] }[]; note: string }

export function PricingSection({ compact = false }: { compact?: boolean }) {
  const q = usePublic<PlansResp>("/plans");
  const nav = useNavigate();
  return <section className="section"><div className="wrap">
    <h2>Paket berlangganan</h2>
    <p className="lead">Mulai gratis. Upgrade ke Pro atau Plus saat Anda membutuhkan lebih banyak permintaan, bantuan AI, dan operator prioritas. Harga dalam Rupiah, per 30 hari, tanpa perpanjangan otomatis.</p>
    {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} retry={() => q.refetch()} /> :
      <div className="grid g3">{q.data!.plans.map((p) => <article key={p.code} className={`card price ${p.highlight ? "hl" : ""}`}>
        <div className="row between"><h3 style={{ fontSize: 20 }}>{p.name}</h3>{p.highlight && <span className="badge info">Paling populer</span>}</div>
        <div className="muted small">{p.tagline}</div>
        <div><span className="amt">{p.priceMonthly === 0 ? "Gratis" : idr(p.priceMonthly)}</span>{p.priceMonthly > 0 && <span className="muted"> / 30 hari</span>}</div>
        <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
        <div className="grow" />
        <button className={`btn ${p.highlight ? "primary" : ""}`} onClick={() => nav(`/sign-up?plan=${p.code}`)}>{p.priceMonthly === 0 ? "Mulai gratis" : `Pilih ${p.name}`}</button>
      </article>)}</div>}
    {!compact && q.data && <>
      <h2 style={{ marginTop: 50 }}>Layanan & paket solusi</h2>
      <p className="lead">Harga "mulai dari" bersifat indikatif. Harga final selalu ditetapkan dalam penawaran tertulis yang harus Anda setujui sebelum pembayaran.</p>
      <ServiceGrid items={q.data.servicePackages} />
    </>}
  </div></section>;
}

function ServiceGrid({ items }: { items: PlansResp["servicePackages"] }) {
  return <div className="grid g2">{items.map((s) => <article className="card stack" key={s.code} style={{ gap: 10 }}>
    <div className="row between"><h3>{s.name}</h3><span className="badge">{s.kind}</span></div>
    <p className="muted small" style={{ margin: 0 }}>{s.summary}</p>
    <div><span className="muted small">Mulai dari </span><strong style={{ fontSize: 20 }}>{idr(s.startingPrice)}</strong><span className="muted small"> {s.unit} · {s.deliveryDays}</span></div>
    <ul className="muted small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>{s.includes.map((i) => <li key={i}>{i}</li>)}</ul>
    <div><Link className="btn sm" to={`/app/requests/new?service=${s.code}`}>Ajukan kebutuhan</Link></div>
  </article>)}</div>;
}

export function Pricing() { return <PricingSection />; }

export function Catalog() {
  const plans = usePublic<PlansResp>("/plans");
  const live = usePublic<{ items: { id: string; name: string; kind: string; description: string }[] }>("/catalog");
  return <section className="wrap section">
    <h2>Katalog produk & layanan</h2>
    <p className="lead">Paket layanan standar dan produk aktif yang telah dipublikasikan operator. Tidak ada item fiktif.</p>
    {plans.isLoading ? <Loading /> : plans.data && <ServiceGrid items={plans.data.servicePackages} />}
    <h3 style={{ marginTop: 36, marginBottom: 12 }}>Produk yang dipublikasikan</h3>
    {live.isLoading ? <Loading /> : live.error ? <div className="alert warn">Katalog produk sedang tidak tersedia ({live.error.code}).</div> :
      live.data!.items.length === 0 ? <div className="card muted small">Belum ada produk yang dipublikasikan. Produk muncul di sini hanya setelah disetujui dan diaktifkan operator.</div> :
      <div className="grid g3">{live.data!.items.map((p) => <div className="card" key={p.id}><span className="badge">{p.kind}</span><h3 style={{ marginTop: 10 }}>{p.name}</h3><p className="muted small">{p.description}</p></div>)}</div>}
  </section>;
}

export function Faq() {
  const items = [
    ["Bagaimana cara masuk?", "DAYANEXA hanya mendukung login dengan akun Google melalui Clerk Production. Kami tidak menyimpan kata sandi."],
    ["Apakah paket Free benar-benar gratis?", "Ya. Paket Free memberi 2 permintaan solusi per bulan tanpa kartu. Eksekusi proyek ditagih terpisah berdasarkan penawaran yang Anda setujui."],
    ["Kapan saya membayar?", "Setelah Anda menyetujui penawaran tertulis. Status pembayaran hanya berubah setelah diverifikasi gateway (Midtrans, Xendit, Duitku, atau Faspay)."],
    ["Apakah pembayaran sudah aktif?", "Pembayaran live dikunci sampai akun merchant terverifikasi. Selama itu sistem berjalan dalam mode mock yang ditandai jelas dan tidak membuat tagihan nyata."],
    ["Bagaimana jika hasil tidak sesuai?", "Anda dapat menyengketakan delivery. Refund mengikuti syarat di penawaran dan memerlukan persetujuan sebelum dikirim ke gateway."],
    ["Bisakah saya menjadi kontributor?", "Ya. Lengkapi profil kontributor di aplikasi. Operator memverifikasi profil sebelum penugasan; setiap tugas memiliki kompensasi yang jelas — tidak ada kerja spekulatif tanpa bayaran."],
  ];
  return <section className="wrap section"><h2>Pertanyaan umum</h2><div className="stack" style={{ marginTop: 20 }}>{items.map(([q, a]) => <details className="card" key={q}><summary>{q}</summary><p className="muted">{a}</p></details>)}</div></section>;
}
export function Contact() {
  return <section className="wrap section"><h2>Kontak & dukungan</h2><div className="grid g2" style={{ marginTop: 18 }}>
    <div className="card"><h3>Email</h3><p className="muted">sparkmind.support@gmail.com</p><p className="small dim">Respons pada hari kerja. Pengguna Plus mendapat target respons 1 hari kerja.</p></div>
    <div className="card"><h3>Pengguna terdaftar</h3><p className="muted">Ajukan kebutuhan atau sengketa langsung dari aplikasi agar tercatat dalam jejak audit.</p><Link className="btn" to="/app">Buka aplikasi</Link></div>
  </div></section>;
}
const LEGAL: Record<string, [string, string[]]> = {
  terms: ["Syarat Layanan", ["Draf kerja — harus ditinjau penasihat hukum sebelum operasi komersial publik.", "Akun: login hanya melalui Google; Anda bertanggung jawab atas aktivitas akun Anda.", "Penawaran: setiap pekerjaan berbayar diatur oleh penawaran tertulis yang Anda setujui secara eksplisit.", "Langganan: berlaku 30 hari sejak pembayaran terverifikasi, tanpa perpanjangan otomatis.", "Batasan: DAYANEXA tidak menjanjikan hasil bisnis tertentu di luar kriteria penerimaan yang disepakati."]],
  privacy: ["Kebijakan Privasi", ["Draf kerja — harus ditinjau penasihat hukum.", "Data yang kami simpan: ID akun Clerk, email terverifikasi, nama tampilan, serta catatan permintaan, penawaran, misi, dan pembayaran.", "Kami tidak menyimpan kata sandi atau data kartu. Data pembayaran diproses oleh gateway.", "Log disamarkan (redaksi) untuk rahasia dan data sensitif. Berkas disimpan privat.", "Anda dapat meminta ekspor atau penghapusan data melalui kontak dukungan."]],
  "refund-policy": ["Kebijakan Refund & Sengketa", ["Draf kerja — harus ditinjau penasihat hukum.", "Syarat refund spesifik tercantum di setiap penawaran.", "Sengketa dapat dibuka saat delivery menunggu penerimaan.", "Refund memerlukan persetujuan internal sebelum dikirim ke gateway; status akhir mengikuti konfirmasi gateway.", "Langganan: refund prorata hanya jika layanan tidak dapat diberikan karena kesalahan kami."]],
  "contributor-terms": ["Ketentuan Kontributor", ["Draf kerja — harus ditinjau penasihat hukum.", "Profil kontributor diverifikasi operator sebelum penugasan.", "Setiap tugas mencantumkan ruang lingkup, kriteria penerimaan, tenggat, dan kompensasi sebelum Anda mulai.", "Kompensasi menjadi kewajiban bayar setelah tugas diterima, dan tidak otomatis bergantung pada pembayaran pelanggan.", "Pembayaran ke kontributor saat ini diproses manual setelah persetujuan; payout otomatis belum diaktifkan."]],
};
export function Legal({ doc }: { doc: keyof typeof LEGAL }) {
  const [title, items] = LEGAL[doc];
  return <article className="legal"><h1>{title}</h1><p className="muted small">Terakhir diperbarui: 16 November 2026</p>{items.map((t, i) => <p key={i} className={i === 0 ? "alert warn" : "muted"}>{t}</p>)}</article>;
}
export function SignInPage() { return <div className="auth-wrap"><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/app" /></div>; }
export function SignUpPage() { return <div className="auth-wrap"><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/app" /></div>; }
