// Non-destructive production smoke (read-only GETs). Usage: npm run smoke:prod [-- https://host]
const base = (process.argv[2] || "https://dayanexa.biz.id").replace(/\/$/, "");
const checks = [];
const check = async (name, fn) => { try { await fn(); checks.push([name, "PASS"]); } catch (e) { checks.push([name, `FAIL: ${e.message}`]); } };
const get = (p) => fetch(base + p, { redirect: "manual" });
await check("health ok", async () => { const j = await (await get("/api/v1/health")).json(); if (!j.ok) throw new Error(JSON.stringify(j)); });
await check("/me requires auth (401)", async () => { const s = (await get("/api/v1/me")).status; if (s !== 401) throw new Error(`status ${s}`); });
await check("admin API requires auth (401)", async () => { const s = (await get("/api/v1/admin/gateway/status")).status; if (s !== 401) throw new Error(`status ${s}`); });
await check("SPA served (200)", async () => { const s = (await get("/")).status; if (s !== 200) throw new Error(`status ${s}`); });
for (const [n, r] of checks) console.log(`${r.startsWith("PASS") ? "✓" : "✗"} ${n} — ${r}`);
if (checks.some(([, r]) => !r.startsWith("PASS"))) process.exit(1);
console.log(`smoke OK: ${base}`);
