// Adds app/api/cron/seed/route.ts to every app (self-seed on demand) and the fan-out route + vercel.json
// cron to the store. Idempotent.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const id of fs.readdirSync(path.join(root, "apps")).sort()) {
  if (id === "store") continue;
  const data = path.join(root, "apps", id, "lib", "data.ts");
  if (!fs.existsSync(data)) continue;
  const fn = fs.readFileSync(data, "utf8").match(/export async function (build\w+)\(/)?.[1];
  if (!fn) continue;
  const dir = path.join(root, "apps", id, "app", "api", "cron", "seed");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "route.ts"),
    `import { createCronSeedRoute } from "@longitude/kit/cron";
import { ${fn} } from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const { GET } = createCronSeedRoute("${id}", ${fn});
`,
  );
  console.log(`cron route: ${id} → ${fn}`);
}
const storeDir = path.join(root, "apps", "store", "app", "api", "cron", "seed");
fs.mkdirSync(storeDir, { recursive: true });
fs.writeFileSync(
  path.join(storeDir, "route.ts"),
  `import { APPS, appUrl } from "@longitude/kit";
import { createCronFanoutRoute } from "@longitude/kit/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const { GET } = createCronFanoutRoute(APPS.map((a) => ({ id: a.id, url: appUrl(a.id) })));
`,
);
fs.writeFileSync(path.join(root, "apps", "store", "vercel.json"), JSON.stringify({ crons: [{ path: "/api/cron/seed", schedule: "0 */6 * * *" }] }, null, 2) + "\n");
console.log("store: fan-out route + vercel.json cron (every 6 hours)");
