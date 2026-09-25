import { APPS } from "@longitude/kit";
import { readManifest } from "@longitude/kit/server";
import { readTotals } from "@longitude/nansen";
import { Globe } from "@/components/Globe";

export const revalidate = 60;

export default async function StorePage() {
  const [manifest, totals] = await Promise.all([readManifest(), readTotals().catch(() => undefined)]);
  // The call log already contains the seed runs, so it is the source of truth; the manifest's seed
  // credits are the floor for deployments that have no shared log (no Upstash configured).
  const seeded = Object.values(manifest).reduce((sum, m) => sum + (m.sample ? 0 : m.credits), 0);
  const logged = totals?.credits ?? 0;
  const spent = Math.max(seeded, logged);
  const status = Object.fromEntries(Object.entries(manifest).map(([id, m]) => [id, m.sample ? "sample" : "seeded"])) as Record<string, "seeded" | "sample">;
  return (
    <Globe
      apps={APPS}
      credits={{ spent, apiCalls: totals?.apiCalls ?? 0, cacheHits: totals?.cachedCalls ?? 0, remaining: totals?.creditsRemaining }}
      status={status}
    />
  );
}
