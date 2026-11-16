// Lightweight secret scanner for tracked files (CI also runs gitleaks).
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
const patterns = [
  ["clerk secret", /sk_(live|test)_[A-Za-z0-9]{20,}/], ["groq", /gsk_[A-Za-z0-9]{30,}/], ["tavily", /tvly-[A-Za-z0-9_-]{20,}/],
  ["firecrawl", /\bfc-[a-f0-9]{24,}/], ["apify", /apify_api_[A-Za-z0-9]{20,}/], ["scrape.ly", /scrapely_[a-f0-9]{30,}/],
  ["svix", /whsec_[A-Za-z0-9+/=]{20,}/], ["cloudflare token", /\b(cfut|cfat)_[A-Za-z0-9]{20,}/], ["private key", /-----BEGIN (RSA |EC )?PRIVATE KEY-----/],
];
const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter((f) => f && !f.endsWith("check-secrets.mjs") && !/\.(png|jpg|jpeg|webp|ico|lock)$/.test(f));
let hits = 0;
for (const f of files) {
  let text = "";
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  for (const [name, re] of patterns) if (re.test(text)) { console.error(`possible ${name} in ${f}`); hits++; }
}
if (hits) process.exit(1);
console.log(`OK: scanned ${files.length} tracked files, no secrets found`);
