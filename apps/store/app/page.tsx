import { APPS } from "@longitude/kit";
import { readManifest } from "@longitude/kit/server";
import { readTotals } from "@longitude/nansen";
import { Globe } from "@/components/Globe";

export const revalidate = 60;

export default async function StorePage() {
  const [manifest, totals] = await Promise.all([readManifest(), readTotals().catch(() => undefined)]);
  const seeded = Object.values(manifest).reduce((sum, m) => sum + (m.sample ? 0 : m.credits), 0);
  const live = totals?.credits ?? 0;
  const seededApps = Object.entries(manifest)
    .filter(([, m]) => !m.sample)
    .map(([id]) => id);
  return (
    <Globe
      apps={APPS}
      credits={{ seeded, live, calls: totals?.calls ?? 0, remaining: totals?.creditsRemaining }}
      seededApps={seededApps}
    />
  );
}
