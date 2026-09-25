import type { NansenClient } from "@longitude/nansen";

/** Shape of snapshots/main.json → data. Keep the seed and the page in agreement here. */
export interface AsTheChainTurnsData {
  generatedAt: string;
  items: unknown[];
}

/** Builds the app's data set. Used by seed.ts (snapshot) and by the page's "refresh live". */
export async function buildAsTheChainTurns(nansen: NansenClient): Promise<AsTheChainTurnsData> {
  void nansen;
  return { generatedAt: new Date().toISOString(), items: [] };
}
