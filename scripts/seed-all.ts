// Runs every app's seed in sequence, rebuilds the manifest, optionally commits + pushes snapshots.
//   pnpm seed:all                    all apps
//   pnpm seed:all --only=rewind,exit-clock
//   pnpm seed:all --publish          also commit and push snapshot files with git (optional)
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.slice("--only=".length).split(",");
const publish = args.includes("--publish");

const apps = readdirSync(path.join(root, "apps"))
  .filter((id) => id !== "store" && existsSync(path.join(root, "apps", id, "seed.ts")))
  .filter((id) => !only || only.includes(id))
  .sort();

if (!process.env.NANSEN_API_KEY) {
  console.error("NANSEN_API_KEY is not set; nothing to seed.");
  process.exit(2);
}

const results: { app: string; ok: boolean; seconds: number }[] = [];
for (const id of apps) {
  console.error(`\n━━━ seeding ${id} ━━━`);
  const started = Date.now();
  const r = spawnSync("pnpm", ["--filter", `@longitude/${id}`, "seed"], { cwd: root, stdio: "inherit", env: process.env });
  results.push({ app: id, ok: r.status === 0, seconds: Math.round((Date.now() - started) / 1000) });
}

spawnSync("node", ["scripts/manifest.mjs"], { cwd: root, stdio: "inherit" });
console.table(results);

if (publish) {
  const r = spawnSync("bash", ["scripts/publish-snapshots.sh"], { cwd: root, stdio: "inherit", env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
if (results.some((r) => !r.ok)) process.exit(1);
