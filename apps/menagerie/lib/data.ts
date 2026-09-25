import type { NansenClient } from "@longitude/nansen";

/** Shape of snapshots/main.json → data. Keep the seed and the page in agreement here. */
export interface MenagerieData {
  generatedAt: string;
  items: unknown[];
}

/** Builds the app's data set. Used by seed.ts (snapshot) and by the page's "refresh live". */
export async function buildMenagerie(nansen: NansenClient): Promise<MenagerieData> {
  void nansen;
  return { generatedAt: new Date().toISOString(), items: [] };
}
