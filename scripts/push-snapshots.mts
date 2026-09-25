// Pushes every apps/*/snapshots/*.json to Convex (needs CONVEX_URL + SEED_TOKEN). Seeds do this
// automatically; this is for a first upload or a manual resync.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { pushSnapshot } from "@longitude/social";

const root = path.resolve(import.meta.dirname, "..");
let n = 0;
for (const app of readdirSync(path.join(root, "apps")).sort()) {
  const dir = path.join(root, "apps", app, "snapshots");
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const json = readFileSync(path.join(dir, file), "utf8");
    const snap = JSON.parse(json) as { generatedAt: string; credits: number; sample?: boolean };
    const ok = await pushSnapshot({ app, name: file.replace(/\.json$/, ""), json, generatedAt: snap.generatedAt, credits: Number(snap.credits) || 0, sample: Boolean(snap.sample) });
    if (!ok) {
      console.error("CONVEX_URL or SEED_TOKEN missing");
      process.exit(2);
    }
    console.log(`pushed ${app}/${file} (${(json.length / 1024).toFixed(0)} KB)`);
    n++;
  }
}
console.log(`${n} snapshots pushed`);
