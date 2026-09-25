// Rebuilds snapshots/manifest.json from apps/*/snapshots/*.json (the files are the source of truth).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = {};
for (const id of fs.readdirSync(path.join(root, "apps")).sort()) {
  const dir = path.join(root, "apps", id, "snapshots");
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) continue;
  let credits = 0;
  let sample = true;
  let generatedAt = "";
  for (const f of files) {
    try {
      const snap = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      if (!snap.sample) {
        sample = false;
        credits += Number(snap.credits) || 0;
      }
      if (snap.generatedAt && snap.generatedAt > generatedAt) generatedAt = snap.generatedAt;
    } catch {
      /* skip unreadable */
    }
  }
  manifest[id] = { generatedAt, credits, sample, snapshots: files.map((f) => f.replace(/\.json$/, "")) };
}
fs.mkdirSync(path.join(root, "snapshots"), { recursive: true });
fs.writeFileSync(path.join(root, "snapshots", "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const seeded = Object.values(manifest).filter((m) => !m.sample).length;
console.log(`manifest: ${Object.keys(manifest).length} apps with snapshots, ${seeded} seeded with real data, ${Object.values(manifest).reduce((s, m) => s + m.credits, 0)} credits`);
