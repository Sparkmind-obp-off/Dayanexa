import type { Principal } from "./auth/principal";

/** Cloudflare bindings + server-side configuration. Secrets never reach the browser. */
export interface Env {
  DB?: D1Database;
  AI?: Ai;
  ARTIFACTS?: R2Bucket;
  ASSETS?: Fetcher;

  APP_ENV?: string; // local | preview | production | test
  PUBLIC_ORIGINS?: string; // comma separated exact origins allowed for CORS

  // Identity (Clerk Production)
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_JWT_KEY?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
  CLERK_WEBHOOK_SECRET?: string;
  BOOTSTRAP_OWNER_EMAILS?: string;

  // Inference
  INFERENCE_PROVIDER?: string; // workers-ai (default) | mock | groq
  AI_DAILY_NEURON_BUDGET?: string;
  AI_MONTHLY_NEURON_BUDGET?: string;
  GROQ_ENABLED?: string;
  GROQ_API_KEY?: string;
  GROQ_DAILY_TOKEN_BUDGET?: string;

  // Market intelligence providers
  TAVILY_API_KEY?: string;
  TAVILY_DAILY_CREDIT_CAP?: string;
  FIRECRAWL_API_KEY?: string;
  FIRECRAWL_DAILY_CREDIT_CAP?: string;
  APIFY_API_TOKEN?: string;
  SCRAPELY_API_KEY?: string;
  SPECIALIZED_SCRAPER?: string; // none (default) | apify | scrapely
  SPECIALIZED_ACTOR_ALLOWLIST?: string;
  SPECIALIZED_MAX_CHARGE_USD?: string;

  // Payments
  PAYMENTS_MODE?: string; // mock | live
  PAYMENT_LIVE_ENABLED?: string;
  DUITKU_MERCHANT_CODE?: string;
  DUITKU_API_KEY?: string;
  DUITKU_BASE_URL?: string;
  XENDIT_SECRET_KEY?: string;
  XENDIT_CALLBACK_TOKEN?: string;
  XENDIT_BASE_URL?: string;
  MIDTRANS_SERVER_KEY?: string;
  MIDTRANS_BASE_URL?: string;
  MIDTRANS_API_BASE_URL?: string;
  FASPAY_MERCHANT_ID?: string;
  FASPAY_MERCHANT_NAME?: string;
  FASPAY_USER_ID?: string;
  FASPAY_PASSWORD?: string;
  FASPAY_PAYMENT_CHANNEL?: string;
  FASPAY_DEBIT_ENDPOINT?: string;
  FASPAY_CONTRACT_VERIFIED?: string;

  ARTIFACT_SIGNING_SECRET?: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { requestId: string; principal: Principal };
};
