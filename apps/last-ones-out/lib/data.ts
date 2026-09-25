import type { NansenClient } from "@longitude/nansen";

/** Shape of snapshots/main.json → data. Keep the seed and the page in agreement here. */
export interface LastOnesOutData {
  generatedAt: string;
  items: unknown[];
}

/** Builds the app's data set. Used by seed.ts (snapshot) and by the page's "refresh live". */
export async function buildLastOnesOut(nansen: NansenClient): Promise<LastOnesOutData> {
  void nansen;
  return { generatedAt: new Date().toISOString(), items: [] };
}
