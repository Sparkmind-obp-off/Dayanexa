// Local release gate (GitHub Actions CI/CD is retired — ADR-0004). Run: npm run release:check
// Runs the full local validation, then the checks the old workflow performed in addition.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const run = (cmd) => { console.log(`\n$ ${cmd}`); execSync(cmd, { stdio: "inherit" }); };
const fail = (msg) => { console.error(`\nRELEASE CHECK FAILED: ${msg}`); process.exit(1); };

const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n");
const envFiles = tracked.filter((f) => /(^|\/)\.env\.(production|development)$/.test(f));
if (envFiles.length) fail(`environment-specific files are tracked: ${envFiles.join(", ")}`);
if (tracked.some((f) => f.startsWith(".github/workflows/"))) fail("GitHub Actions workflows are retired (ADR-0004); remove .github/workflows/*");

try { execSync("npm ls @clerk/clerk-react --all", { stdio: "pipe" }); fail("deprecated @clerk/clerk-react is installed"); } catch { /* not installed: ok */ }

run("npm run ci");

const secretRe = /sk_live_|tvly-|fc-[A-Za-z0-9]{20}|apify_api_|gsk_[A-Za-z0-9]{20}|scrapely_|whsec_[A-Za-z0-9+/=]{20}/;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
if (!existsSync("dist/_worker.js")) fail("dist/_worker.js missing after build");
for (const f of walk("dist")) if (secretRe.test(readFileSync(f, "utf8"))) fail(`secret-like material in build output: ${f}`);

const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim();
console.log(`\nRELEASE CHECK PASSED at ${head}${dirty ? " (WARNING: working tree has uncommitted changes — do not deploy)" : ""}`);
