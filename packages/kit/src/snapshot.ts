import { findRepoRoot } from "@longitude/nansen";

/** Every seed script writes one of these per data set; every page reads one first. */
export interface Snapshot<T> {
  app: string;
  name: string;
  generatedAt: string;
  /** Credits the seed spent producing this snapshot. */
  credits: number;
  /** True when the data was hand-written for development, not fetched from Nansen. */
  sample?: boolean;
  note?: string;
  data: T;
}

export interface ManifestEntry {
  generatedAt: string;
  credits: number;
  sample: boolean;
  snapshots: string[];
}

export type Manifest = Record<string, ManifestEntry>;

async function localSnapshotPaths(app: string, name: string): Promise<string[]> {
  const path = await import("node:path");
  const root = await findRepoRoot();
  return [
    path.join(process.cwd(), "snapshots", `${name}.json`),
    path.join(root, "apps", app, "snapshots", `${name}.json`),
  ];
}

/**
 * Remote first (SNAPSHOT_BASE_URL/<app>/<name>.json, revalidated every 5 min), then the JSON file
 * bundled with the app. Returns undefined when nothing has been seeded yet.
 */
export async function readSnapshot<T>(app: string, name = "main"): Promise<Snapshot<T> | undefined> {
  const base = process.env.SNAPSHOT_BASE_URL;
  if (base) {
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/${app}/${name}.json`, { next: { revalidate: 300 } } as RequestInit);
      if (res.ok) return (await res.json()) as Snapshot<T>;
    } catch {
      /* fall through to local */
    }
  }
  const fs = await import("node:fs/promises");
  for (const file of await localSnapshotPaths(app, name)) {
    try {
      return JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ file, "utf8")) as Snapshot<T>;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

/** Writes apps/<app>/snapshots/<name>.json and updates snapshots/manifest.json at the repo root. */
export async function writeSnapshot<T>(
  app: string,
  name: string,
  data: T,
  meta: { credits: number; sample?: boolean; note?: string },
): Promise<string> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const root = await findRepoRoot();
  const dir = path.join(root, "apps", app, "snapshots");
  await fs.mkdir(dir, { recursive: true });
  const snap: Snapshot<T> = {
    app,
    name,
    generatedAt: new Date().toISOString(),
    credits: meta.credits,
    sample: meta.sample ?? false,
    note: meta.note,
    data,
  };
  const file = path.join(dir, `${name}.json`);
  await fs.writeFile(file, JSON.stringify(snap, null, 2) + "\n");

  const manifestFile = path.join(root, "snapshots", "manifest.json");
  let manifest: Manifest = {};
  try {
    manifest = JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ manifestFile, "utf8")) as Manifest;
  } catch {
    /* fresh manifest */
  }
  const prev = manifest[app];
  const names = new Set([...(prev?.snapshots ?? []), name]);
  manifest[app] = {
    generatedAt: snap.generatedAt,
    credits: (prev && !prev.sample ? prev.credits : 0) + (meta.sample ? 0 : meta.credits),
    sample: meta.sample ?? false,
    snapshots: [...names].sort(),
  };
  await fs.mkdir(path.dirname(manifestFile), { recursive: true });
  await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
  return file;
}

/** The root manifest: which apps are seeded, when, and what it cost. The store reads this. */
export async function readManifest(): Promise<Manifest> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const candidates = [path.join(process.cwd(), "snapshots", "manifest.json"), path.join(await findRepoRoot(), "snapshots", "manifest.json")];
  for (const file of candidates) {
    try {
      return JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ file, "utf8")) as Manifest;
    } catch {
      /* next */
    }
  }
  return {};
}
