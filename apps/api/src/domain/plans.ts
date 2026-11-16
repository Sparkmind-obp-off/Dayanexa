/**
 * DAYANEXA SaaS plans + indicative service packages. Prices in integer IDR.
 * Owner-requested tiers (Free / Pro / Plus). Amounts are charged ONLY from this server-side table.
 * Change here + redeploy; the public pricing page reads /api/v1/plans.
 */
export type PlanCode = "free" | "pro" | "plus";
export interface Plan {
  code: PlanCode; name: string; tagline: string; priceMonthly: number; periodDays: number; highlight: boolean;
  limits: { requestsPerMonth: number; aiAssistsPerMonth: number; seats: number };
  features: string[];
}
export const PLANS: Plan[] = [
  { code: "free", name: "Free", tagline: "Mulai validasi kebutuhan Anda", priceMonthly: 0, periodDays: 30, highlight: false,
    limits: { requestsPerMonth: 2, aiAssistsPerMonth: 0, seats: 1 },
    features: ["2 permintaan solusi / bulan", "Pelacakan status request → penawaran → delivery", "Penawaran tertulis dengan ruang lingkup & syarat refund", "Dukungan via email"] },
  { code: "pro", name: "Pro", tagline: "Untuk bisnis yang rutin mengeksekusi", priceMonthly: 149_000, periodDays: 30, highlight: true,
    limits: { requestsPerMonth: 10, aiAssistsPerMonth: 50, seats: 3 },
    features: ["10 permintaan solusi / bulan", "Review prioritas oleh operator", "Ringkasan kebutuhan berbantuan AI (Workers AI)", "Riwayat artefak & delivery tersimpan privat", "3 anggota tim"] },
  { code: "plus", name: "Plus", tagline: "Eksekusi terkelola & skala tim", priceMonthly: 399_000, periodDays: 30, highlight: false,
    limits: { requestsPerMonth: 30, aiAssistsPerMonth: 200, seats: 10 },
    features: ["30 permintaan solusi / bulan", "Operator khusus & target respons 1 hari kerja", "Analisis peluang berbantuan AI", "Laporan ekonomi misi (biaya, margin)", "10 anggota tim"] },
];
export const planByCode = (code: string | null | undefined) => PLANS.find((p) => p.code === code) ?? PLANS[0];

export interface ServicePackage { code: string; name: string; kind: string; startingPrice: number; unit: string; deliveryDays: string; summary: string; includes: string[] }
export const SERVICE_PACKAGES: ServicePackage[] = [
  { code: "demand-validation", name: "Validasi Demand", kind: "Layanan", startingPrice: 750_000, unit: "per proyek", deliveryDays: "3–5 hari",
    summary: "Uji apakah kebutuhan pasar nyata sebelum Anda berinvestasi.", includes: ["Riset sinyal & bukti dari sumber publik", "Skor kepercayaan demand + alasan", "Rekomendasi lanjut/tunda/tolak"] },
  { code: "solution-sprint", name: "Solution Sprint", kind: "Paket", startingPrice: 3_500_000, unit: "per sprint", deliveryDays: "7–14 hari",
    summary: "Rancang solusi, analisis gap kapabilitas, dan penawaran siap eksekusi.", includes: ["Desain solusi & kelayakan", "Rencana build/partner/kontributor", "Penawaran dengan kriteria penerimaan"] },
  { code: "build-deliver", name: "Build & Deliver", kind: "Solusi", startingPrice: 9_500_000, unit: "per misi", deliveryDays: "sesuai ruang lingkup",
    summary: "Eksekusi misi oleh agen AI dan kontributor terverifikasi hingga diterima.", includes: ["Manajemen misi & quality gate", "Artefak privat + tautan unduhan aman", "Penerimaan eksplisit & jalur sengketa"] },
  { code: "managed-ops", name: "Managed Operations", kind: "Berlangganan", startingPrice: 4_900_000, unit: "per bulan", deliveryDays: "berkelanjutan",
    summary: "Operasi proses terkelola dengan laporan hasil bulanan.", includes: ["Operator & agen terdedikasi", "Laporan biaya & hasil", "Review berkala"] },
];
