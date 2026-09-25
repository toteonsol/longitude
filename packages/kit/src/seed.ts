import { type NansenClient, createNansen } from "@longitude/nansen";
import { writeSnapshot } from "./snapshot";

export interface SeedSpec<T> {
  app: string;
  name?: string;
  /** Credit ceiling for this seed run. */
  cap?: number;
  note?: string;
  build: (nansen: NansenClient) => Promise<T>;
}

/**
 * Runs one seed: a capped, logged Nansen client, the app's `build` function, then the snapshot.
 * Usage in apps/<app>/seed.ts:  await runSeed({ app: "exit-clock", cap: 60, build: async (n) => ({...}) })
 */
export async function runSeed<T>(spec: SeedSpec<T>): Promise<T> {
  const name = spec.name ?? "main";
  const nansen = createNansen({ script: `seed:${spec.app}${name === "main" ? "" : `:${name}`}`, creditCap: spec.cap ?? 150, logToConsole: true });
  const started = Date.now();
  console.error(`[seed] ${spec.app}/${name}: cap ${nansen.credits.cap} credits`);
  try {
    const data = await spec.build(nansen);
    const file = await writeSnapshot(spec.app, name, data, { credits: nansen.credits.spent, note: spec.note });
    console.error(
      `[seed] ${spec.app}/${name}: wrote ${file.split("/apps/")[1]} in ${((Date.now() - started) / 1000).toFixed(1)}s, ` +
        `${nansen.credits.spent} credits (${nansen.credits.calls} calls)` +
        (nansen.creditsRemaining !== undefined ? `, ${nansen.creditsRemaining} remaining on account` : ""),
    );
    return data;
  } finally {
    await nansen.log.flush();
  }
}
