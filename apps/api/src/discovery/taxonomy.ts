/** DAYANEXA Omni-Channel Discovery — shared vocabulary (docs/31 §12). Navigation/classification aids, never silos. */
export const DEMAND_CATEGORIES = [
  { code: "service_need", label: "Kebutuhan layanan", terms: ["jasa", "layanan", "service", "hire", "agency", "freelancer", "vendor"] },
  { code: "product_gap", label: "Kebutuhan / celah produk", terms: ["produk", "product", "alternatif", "alternative", "wish", "fitur", "feature", "beli", "buy"] },
  { code: "complaint", label: "Keluhan & pain point berulang", terms: ["keluhan", "complain", "masalah", "problem", "frustrat", "kecewa", "annoying", "susah", "ribet"] },
  { code: "msme_ops", label: "Operasional UMKM / bisnis", terms: ["umkm", "usaha", "toko", "small business", "bisnis", "pembukuan", "stok", "inventory", "marketing", "penjualan"] },
  { code: "software_ai", label: "Software, otomasi & AI", terms: ["aplikasi", "software", "app", "otomasi", "automation", "ai", "tool", "integrasi", "spreadsheet"] },
  { code: "b2b", label: "B2B, pengadaan & supplier", terms: ["supplier", "pemasok", "pengadaan", "procurement", "grosir", "wholesale", "b2b", "distributor"] },
  { code: "local", label: "Kebutuhan lokal / komunitas", terms: ["dekat", "near me", "lokal", "local", "kota", "daerah", "kecamatan", "komunitas"] },
  { code: "education", label: "Pendidikan, skill & pelatihan", terms: ["kursus", "belajar", "pelatihan", "course", "training", "learn", "tutorial", "bootcamp"] },
  { code: "work_signal", label: "Sinyal permintaan kerja/tugas (bukan lowongan terverifikasi)", terms: ["dicari", "lowongan", "hiring", "looking for someone", "butuh orang", "gig", "project"] },
  { code: "custom", label: "Lainnya / brief kustom", terms: [] },
] as const;
export type DemandCategory = (typeof DEMAND_CATEGORIES)[number]["code"];
export const CATEGORY_CODES = DEMAND_CATEGORIES.map((c) => c.code) as [DemandCategory, ...DemandCategory[]];

export const GEOGRAPHIES = [
  { code: "ID", label: "Indonesia", query: "Indonesia" },
  { code: "SEA", label: "Asia Tenggara", query: "Southeast Asia" },
  { code: "global", label: "Global", query: "" },
] as const;
export const GEO_CODES = GEOGRAPHIES.map((g) => g.code) as [string, ...string[]];
export const LANGUAGES = [{ code: "id", label: "Bahasa Indonesia" }, { code: "en", label: "English" }, { code: "any", label: "Semua bahasa" }] as const;
export const LANG_CODES = LANGUAGES.map((l) => l.code) as [string, ...string[]];

export const CAMPAIGN_STATUSES = ["DRAFT", "VALIDATING", "SCOPE_READY", "RESERVED", "QUEUED", "RUNNING", "RECONCILING", "COMPLETED", "PARTIAL", "FAILED", "CANCELLED"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
/** Governed lifecycle. PARTIAL/FAILED → QUEUED only via bounded retry of the SAME campaign (no new entitlement). */
export const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["VALIDATING", "CANCELLED"],
  VALIDATING: ["SCOPE_READY", "FAILED"],
  SCOPE_READY: ["RESERVED", "CANCELLED"],
  RESERVED: ["QUEUED", "RECONCILING", "CANCELLED", "SCOPE_READY"],
  QUEUED: ["RUNNING", "RECONCILING"],
  RUNNING: ["RECONCILING"],
  RECONCILING: ["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"],
  COMPLETED: [],
  PARTIAL: ["QUEUED"],
  FAILED: ["QUEUED"],
  CANCELLED: [],
};
export const TERMINAL: CampaignStatus[] = ["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"];

export const PROVIDER_UNITS: Record<string, string> = { tavily: "credits", firecrawl: "credits", apify: "usd_micros", scrapely: "usd_micros" };

/** Member-safe explanation of why a source/route cannot run. Never includes account labels or secrets. */
export const UNAVAILABLE_REASON: Record<string, string> = {
  SOURCE_NOT_APPROVED: "Sumber belum lolos review izin & penggunaan komersial.",
  SOURCE_PENDING_REVIEW: "Menunggu review izin oleh owner DAYANEXA.",
  SOURCE_REJECTED: "Ditolak pada review izin (akses terbatas, login, atau ketentuan platform).",
  SOURCE_SUSPENDED: "Ditangguhkan sementara oleh owner.",
  SOURCE_REVIEW_EXPIRED: "Masa berlaku review izin sudah habis; perlu review ulang.",
  SOURCE_NOT_PUBLIC: "Sumber tidak publik — tidak pernah dikumpulkan.",
  SOURCE_COMMERCIAL_USE_UNCLEAR: "Hak penggunaan komersial belum jelas — perlu review.",
  SOURCE_PAUSED: "Sumber sedang dijeda.",
  PROVIDER_NOT_SELECTED: "Rute Actor untuk sumber ini tidak dipilih (Apify ATAU Scrape.ly).",
  ACTOR_NOT_APPROVED: "Actor terkurasi untuk sumber ini belum disetujui/kedaluwarsa.",
  PROGRAM_BUDGET_MISSING: "Belum ada alokasi program discovery yang disetujui owner untuk rute ini.",
  PROGRAM_BUDGET_EXHAUSTED: "Alokasi program discovery periode ini tidak cukup.",
  PROVIDER_POLICY_MISSING: "Rute penyedia belum dikonfigurasi.",
  PROVIDER_POLICY_DISABLED: "Rute penyedia dinonaktifkan.",
  PROVIDER_NO_ELIGIBLE_ACCOUNT: "Tidak ada akun penyedia aktif yang disetujui untuk rute ini.",
  PROVIDER_TERMS_NOT_REVIEWED: "Ketentuan penyedia belum direview.",
  PROVIDER_CREDENTIAL_MISSING: "Rute penyedia belum siap.",
  PROVIDER_CREDENTIAL_BINDING_INVALID: "Rute penyedia belum siap.",
  PROVIDER_CIRCUIT_OPEN: "Penyedia sedang dibatasi sementara (circuit breaker).",
  PROVIDER_CAP_NOT_CONFIGURED: "Batas pemakaian penyedia belum dikonfigurasi (fail-closed).",
  PROVIDER_UNIT_MISMATCH: "Konfigurasi unit penyedia tidak cocok.",
  PROVIDER_POLICY_UNIT_MISMATCH: "Konfigurasi unit penyedia tidak cocok.",
  PROVIDER_PRICE_UNKNOWN: "Harga penyedia belum diketahui — eksekusi ditahan (fail-closed).",
  PROVIDER_PAID_APPROVAL_REQUIRED: "Rute berbayar nonaktif tanpa persetujuan owner yang terbatas.",
  PROVIDER_QUOTA_UNKNOWN: "Kuota penyedia belum terverifikasi — eksekusi ditahan (fail-closed).",
  PROVIDER_QUOTA_STALE: "Data kuota penyedia kedaluwarsa — perlu verifikasi ulang.",
  PROVIDER_QUOTA_EXHAUSTED: "Kuota penyedia habis untuk periode ini.",
  PROVIDER_BUDGET_EXCEEDED: "Batas biaya/unit penyedia tercapai.",
  PROVIDER_CONCURRENCY_LIMIT: "Penyedia sedang penuh; dicoba ulang terbatas.",
  PROVIDER_PER_REQUEST_CAP: "Permintaan melebihi batas per-run penyedia.",
  PROVIDER_REGION_INCOMPATIBLE: "Region data penyedia tidak cocok.",
  PROVIDER_RESERVATION_RACE_LOST: "Kapasitas berubah bersamaan; dicoba ulang terbatas.",
  PROVIDER_SCHEMA_NOT_MIGRATED: "Skema runtime penyedia belum diterapkan.",
  NOT_SELECTED: "Tidak dipilih otomatis (relevansi/diversitas lebih rendah atau batas channel).",
  RATE_LIMITED: "Penyedia membatasi laju (429). Tidak ada rotasi akun.",
  QUOTA_EXHAUSTED: "Kuota penyedia habis (tidak ada fallback berbayar).",
  UPSTREAM_ERROR: "Gangguan penyedia.",
  TIMEOUT: "Waktu habis; status biaya tidak pasti dan ditahan untuk rekonsiliasi.",
  INVALID_REQUEST: "Penyedia menolak permintaan.",
  BLOCKED_TARGET: "Target diblokir oleh pengaman jaringan.",
  NOT_CONFIGURED: "Rute penyedia belum siap.",
  AMBIGUOUS_DISPATCH: "Eksekusi terputus setelah dikirim; tidak diulang otomatis untuk mencegah biaya ganda.",
};
export const reasonFor = (code: string | null | undefined) => (code ? UNAVAILABLE_REASON[code] ?? "Rute tidak tersedia." : null);

export const LIMITATIONS = [
  "Hasil adalah sinyal dari sumber publik yang terindeks — bukan demand tervalidasi dan bukan sampel representatif pasar.",
  "Jumlah rekaman tidak sama dengan jumlah orang/pelanggan; salinan dan repost dihitung terpisah dari sumber independen.",
  "Klasifikasi tema/isyarat demand bersifat heuristik (inferensi), terpisah dari bukti yang diamati.",
  "Grup privat, konten berlogin, pesan pribadi dan konten terbatas tidak pernah dikumpulkan.",
];
