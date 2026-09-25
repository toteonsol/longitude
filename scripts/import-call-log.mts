// One-time import of the local JSONL call log into the shared store's counters (Convex/Redis/Upstash),
// so the deployed store's globe shows the full history. Safe to re-run: it skips if already imported.
import { readFileSync } from "node:fs";
import { foldTotals, type CallRecord } from "@longitude/nansen";
import { getSocialStore, socialBackend } from "@longitude/social";

const backend = socialBackend();
if (backend === "memory" || backend === "file") {
  console.error(`no shared store configured (backend=${backend})`);
  process.exit(2);
}
const cmd = getSocialStore().cmd;
const k = (n: string) => `nansen:${n}`;
if (await cmd.get(k("imported"))) {
  console.log("already imported");
  process.exit(0);
}
const rows = readFileSync("data/nansen-calls.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l) as CallRecord);
const t = foldTotals(rows);
await cmd.incrby(k("credits"), Math.round(t.credits));
await cmd.incrby(k("calls:count"), t.calls);
await cmd.incrby(k("calls:api"), t.apiCalls);
await cmd.incrby(k("calls:cached"), t.cachedCalls);
await cmd.incrby(k("calls:failed"), t.failedCalls);
for (const [ep, b] of Object.entries(t.byEndpoint)) {
  await cmd.hincrby(k("by_endpoint:credits"), ep, Math.round(b.credits));
  await cmd.hincrby(k("by_endpoint:calls"), ep, b.calls);
}
for (const [sc, b] of Object.entries(t.byScript)) {
  await cmd.hincrby(k("by_script:credits"), sc, Math.round(b.credits));
  await cmd.hincrby(k("by_script:calls"), sc, b.calls);
}
if (t.firstAt && !(await cmd.get(k("first_at")))) await cmd.set(k("first_at"), t.firstAt);
if (t.lastAt) await cmd.set(k("last_at"), t.lastAt);
if (t.creditsRemaining !== undefined) await cmd.set(k("credits_remaining"), String(t.creditsRemaining));
await cmd.lpush(k("calls"), ...rows.slice(-200).reverse().map((r) => JSON.stringify(r)));
await cmd.set(k("imported"), new Date().toISOString());
console.log(`imported ${t.calls} records: ${t.apiCalls} API calls, ${t.credits} credits`);
