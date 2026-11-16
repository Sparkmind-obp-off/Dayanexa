#!/usr/bin/env bash
# Run AFTER the owner frees a D1 slot (or upgrades to Workers Paid). Idempotent where possible.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=$(npx wrangler d1 create dayanexa-production 2>&1 || true)
ID=$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
if [ -z "$ID" ]; then ID=$(npx wrangler d1 list --json | node -e 'const l=JSON.parse(require("fs").readFileSync(0,"utf8"));const d=l.find(x=>x.name==="dayanexa-production");if(!d)process.exit(1);console.log(d.uuid)'); fi
echo "D1 id: $ID"
node -e '
const fs=require("fs");let t=fs.readFileSync("wrangler.jsonc","utf8");
if(!t.includes("\"d1_databases\"")){t=t.replace("\"vars\":", `"d1_databases": [{ "binding": "DB", "database_name": "dayanexa-production", "database_id": "'"$ID"'", "migrations_dir": "apps/api/migrations" }],\n\n  "vars":`);fs.writeFileSync("wrangler.jsonc",t);}'
npx wrangler d1 migrations apply dayanexa-production --remote
npm run build && npx wrangler pages deploy dist --project-name dayanexa --branch main
