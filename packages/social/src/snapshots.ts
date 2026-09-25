import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

export interface SnapshotUpload {
  app: string;
  name: string;
  json: string;
  generatedAt: string;
  credits: number;
  sample: boolean;
}

/** Push a seed's snapshot to Convex, where the apps fetch it over HTTP without a redeploy. */
export async function pushSnapshot(snap: SnapshotUpload, url = process.env.CONVEX_URL, token = process.env.SEED_TOKEN): Promise<boolean> {
  if (!url || !token) return false;
  await new ConvexHttpClient(url).mutation(api.snapshots.put, { token, ...snap });
  return true;
}

export async function fetchManifest(url = process.env.CONVEX_URL): Promise<Record<string, { generatedAt: string; credits: number; sample: boolean; snapshots: string[] }> | null> {
  if (!url) return null;
  return new ConvexHttpClient(url).query(api.snapshots.manifest, {});
}
