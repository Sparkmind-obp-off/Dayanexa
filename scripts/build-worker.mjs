// Bundles the Hono API into dist/_worker.js (Cloudflare Pages advanced mode) and limits it to /api/*.
import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("dist", { recursive: true });
await build({
  entryPoints: ["apps/api/src/index.ts"], outfile: "dist/_worker.js", bundle: true, format: "esm", target: "es2022",
  platform: "browser", conditions: ["workerd", "worker", "browser"], mainFields: ["browser", "module", "main"],
  minify: true, sourcemap: false, legalComments: "none", logLevel: "warning",
});
writeFileSync("dist/_routes.json", JSON.stringify({ version: 1, include: ["/api/*"], exclude: [] }, null, 2));
console.log("worker bundled → dist/_worker.js, routes → /api/*");
