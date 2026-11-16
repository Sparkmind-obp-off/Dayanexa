# DAYANEXA — Agentic Opportunity & Execution OS

Implementasi sesuai `docs/16-master-system-and-full-stack-implementation.md` (v1.1) dan `prompts/DAYANEXA_MASTER_IMPLEMENTATION_PROMPT.md`.

## Stack
- **Frontend**: React 18 + TypeScript + Vite, React Router, TanStack Query, Clerk React Core 3 (`@clerk/react` 6.18.8; Production, **Google-only**), lucide icons, design system gelap kustom.
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
1. **D1**: ✅ `dayanexa-production` (40ba9edb-…) sudah dibuat, 5 migrasi remote sudah diterapkan, binding `DB` aktif.
2. **Clerk**: pastikan hanya Google yang aktif di dashboard Clerk Production; buat webhook ke `https://dayanexa.biz.id/api/v1/webhooks/clerk` dan set `CLERK_WEBHOOK_SECRET`.
3. **DNS** (WAJIB, owner): token Cloudflare tidak punya izin DNS. Di dashboard Cloudflare zone `dayanexa.biz.id` tambahkan CNAME `@` → `dayanexa.pages.dev` dan CNAME `www` → `dayanexa.pages.dev` (proxied). Domain sudah ditambahkan ke Pages project dan menunggu CNAME ini. Login Clerk Production hanya berfungsi di `dayanexa.biz.id`.
4. **Pembayaran**: isi kredensial sandbox merchant; live hanya setelah approval owner (`PAYMENT_LIVE_ENABLED=true`, `PAYMENTS_MODE=live`).
5. **Groq**: tetap nonaktif kecuali owner mengizinkan (`GROQ_ENABLED=true`).

## Status
- Clerk SDK migration: Core 3 (`@clerk/react` 6.18.8 + `@clerk/backend` 3.29.0); production sign-in smoke test still required after deployment.
- CI workflow siap di `docs/ci/ci.workflow.yml` (salin ke `.github/workflows/ci.yml` — GitHub App belum punya izin `workflows`).
- Typecheck ✅ · 18 unit test ✅ · migrasi ✅ · secret scan ✅ · build ✅
- Production: https://dayanexa.pages.dev (D1 ✅, Workers AI ✅, R2 ✅, Clerk keys ✅)
- Terakhir diperbarui: 2026-11-16
