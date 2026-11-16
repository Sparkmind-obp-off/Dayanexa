# DAYANEXA — Agentic Opportunity & Execution OS

Implementasi sesuai `docs/16-master-system-and-full-stack-implementation.md` (v2.0) dan `prompts/DAYANEXA_MASTER_IMPLEMENTATION_PROMPT.md`.

## Stack
- **Frontend**: React 18 + TypeScript + Vite, React Router, TanStack Query, Clerk React Core 3 (`@clerk/react` 6.18.0+; `@clerk/backend` compatible v2; Production, **Google-only**), lucide icons, design system gelap kustom.
- **API**: Hono di Cloudflare Pages Functions (advanced mode, `dist/_worker.js`, `_routes.json` → `/api/*`).
- **Data**: Cloudflare D1 (5 migrasi, 43 tabel, ledger double-entry immutable), R2 privat `dayanexa-private` untuk artefak (download bertanda tangan HMAC).
- **AI**: Workers AI (`env.AI`) default — profil classification/extraction (Llama 3.1 8B fp8), reasoning/generation (Llama 3.3 70B fp8-fast), embeddings (bge-m3); budget neuron harian/bulanan, circuit breaker, validasi zod, `inference_traces`. Groq opsional, **nonaktif** default, tanpa fallback otomatis.
- **Provider riset**: Tavily, Firecrawl, Apify, Scrape.ly — governor biaya (cap harian), SSRF guard, tanpa fallback berbayar.
- **Pembayaran**: Duitku, Xendit, Midtrans, Faspay di balik satu antarmuka ternormalisasi; verifikasi webhook + rekonsiliasi status; refund/payout butuh approval; **live terkunci** (`PAYMENT_LIVE_ENABLED=false`, `PAYMENTS_MODE=mock`). Faspay fail-closed sampai kontrak merchant diverifikasi.

## Fitur
- **Publik**: Landing, Cara kerja, Harga (SaaS **Free / Pro / Plus** + paket layanan), Katalog, FAQ, Kontak, Legal (terms, privacy, refund, contributor terms), Sign-in/up Google.
- **Customer journey**: dashboard, ajukan kebutuhan (kuota per plan, AI draft untuk Pro/Plus), daftar permintaan → terima penawaran → payment intent, detail misi (artefak, terima/sengketakan delivery), billing (upgrade/cancel), notifikasi.
- **Contributor journey**: profil kontributor, tugas yang ditugaskan.
- **14 workspace command center** (berbasis permission): Executive, Market Radar, Demand Intelligence, Opportunities, Solutions, Capabilities, Catalog, Agents, Execution, Commercial, Delivery, Ledger, Learning, Governance.
- Authz milik DAYANEXA: role owner/operator/analyst/finance/contributor/member, isolasi tenant, separation of duties pada approval, audit append-only, rate limit, idempotency key.

## Paket
| Plan | Harga/30 hari | Permintaan | AI assist | Seat |
|---|---|---|---|---|
| Free | Rp0 | 2 | 0 | 1 |
| Pro | Rp149.000 | 10 | 50 | 3 |
| Plus | Rp399.000 | 30 | 200 | 10 |

Layanan (mulai dari): Demand Validation Rp750rb · Solution Sprint Rp3,5jt · Build & Deliver Rp9,5jt · Managed Ops Rp4,9jt/bln.

## API utama (`/api/v1`)
Publik: `GET /health`, `/config`, `/catalog`, `/plans`, `/artifacts/download`, webhooks `/webhooks/clerk`, `/webhooks/payments/:gateway`.
Terautentikasi (Bearer Clerk): `/me`, `/notifications`, `/requests`, `/requests/ai-draft`, `/billing`, `/billing/subscribe`, `/billing/cancel`, intel (sources/signals/demands/opportunities…), ops (solutions/capabilities/missions/tasks/deliveries/artifacts…), commerce (offers/payments/refunds/payouts/ledger), governance (approvals/audit/providers/inference), metrics.

## Pengembangan
Node.js minimal 20.9.0 (persyaratan Clerk Core 3).
```bash
npm install
npm run build            # vite + bundle worker
npm run typecheck && npm test && npm run check:migrations && npm run check:secrets
pm2 start ecosystem.config.cjs   # wrangler pages dev dist :3000
```
Secret lokal: salin `.dev.vars.example` → `.dev.vars`.

## Deploy (Cloudflare BYOK)
`npm run deploy` → Pages project `dayanexa`, branch `main`. Secret disimpan via `wrangler pages secret put` (tidak pernah di-commit).

## Checklist aktivasi owner (wajib)
1. **D1/R2/Workers AI**: resource dan binding pernah terdeteksi di Pages project; verifikasi kembali terhadap deployment aktif sebelum menyatakan sehat.
2. **Clerk Production**: Google-only; pastikan custom domain, callback, publishable key, secret/JWT verification, authorized parties dan webhook `https://dayanexa.biz.id/api/v1/webhooks/clerk` + `CLERK_WEBHOOK_SECRET` benar. Real sign-in masih wajib diuji.
3. **DNS/TLS**: `dayanexa.biz.id` dan `www.dayanexa.biz.id` tercantum pada konfigurasi Pages project saat pemeriksaan terakhir; tetap lakukan pemeriksaan DNS/TLS aktual. Jangan membuat record duplikat.
4. **Cloudflare Pages source**: pada pemeriksaan API terakhir, `source` belum terhubung dan deployment terbaru tercatat sebagai ad-hoc. Hubungkan GitHub repo/branch `main` melalui dashboard atau gunakan jalur deployment resmi yang diotorisasi. Push GitHub belum otomatis berarti production ter-update.
5. **Dependency lockfile/CI**: regenerasi dan commit `package-lock.json`; pastikan `.github/workflows/ci.yml` benar-benar ada dan workflow berjalan. `docs/ci/ci.workflow.yml` saja bukan CI aktif.
6. **Pembayaran**: tetap `PAYMENTS_MODE=mock` dan `PAYMENT_LIVE_ENABLED=false`; uji sandbox terlebih dahulu. Live hanya setelah approval owner.
7. **Groq**: tetap nonaktif kecuali owner mengizinkan (`GROQ_ENABLED=true`).

## Status (pemeriksaan 16 November 2026)
- Clerk frontend source sudah dimigrasikan ke `@clerk/react` Core 3; login Google Production belum dibuktikan berhasil pada deployment aktif.
- `package-lock.json` belum ada pada tree `main` saat pemeriksaan; regenerasi dengan clean install dan commit sebelum CI.
- Cloudflare Pages project memuat custom domains, tetapi API project terakhir menunjukkan Git `source` belum terhubung; deployment terakhir adalah ad-hoc dan menggunakan commit lama.
- D1 (5 migrasi), Workers AI dan R2 pernah terdeteksi terikat pada konfigurasi deployment; verifikasi ulang pada release terbaru.
- CI workflow berada di `docs/ci/ci.workflow.yml`; belum boleh dianggap aktif sampai file workflow berada di `.github/workflows/` dan ada run sukses.
- Payment mode masih mock; gateway sandbox/live, webhook Clerk, payout dan keseluruhan journey belum terverifikasi end-to-end.
- Dokumen legal masih memerlukan tinjauan hukum sebelum operasi komersial publik.
- Terakhir diperbarui: 2026-11-16
