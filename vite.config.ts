import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Clerk's publishable key is public client configuration, not a secret.
 * The canonical value lives in wrangler.jsonc (same deployment contract as
 * the Pages Worker). Cloudflare runtime vars are not injected into an
 * already-built Vite bundle, so resolve it at build time. An explicit VITE_
 * override remains available for separate preview/production environments.
 */
function resolveClerkPublishableKey(mode: string): string {
  const env = loadEnv(mode, process.cwd(), "");
  const fromEnvironment =
    process.env.VITE_CLERK_PUBLISHABLE_KEY ||
    process.env.CLERK_PUBLISHABLE_KEY ||
    env.VITE_CLERK_PUBLISHABLE_KEY ||
    env.CLERK_PUBLISHABLE_KEY;

  if (fromEnvironment) return fromEnvironment.trim();

  const wranglerConfig = readFileSync(new URL("./wrangler.jsonc", import.meta.url), "utf8");
  const match = wranglerConfig.match(/"CLERK_PUBLISHABLE_KEY"\\s*:\\s*"([^"]+)"/);
  const fromCanonicalConfig = match?.[1]?.trim();
  if (fromCanonicalConfig) return fromCanonicalConfig;

  throw new Error(
    "Missing Clerk publishable key. Set VITE_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY, or configure CLERK_PUBLISHABLE_KEY in wrangler.jsonc.",
  );
}

export default defineConfig(({ mode }) => {
  const clerkPublishableKey = resolveClerkPublishableKey(mode);
  if (!/^pk_(live|test)_/.test(clerkPublishableKey)) {
    throw new Error("Invalid Clerk publishable key format; expected pk_live_ or pk_test_.");
  }

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(clerkPublishableKey),
    },
    build: { outDir: "dist", emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 1200 },
    server: { proxy: { "/api": "http://127.0.0.1:3000" } },
  };
});
