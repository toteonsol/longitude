import { type NansenClient, getNansen } from "@longitude/nansen";
import { readSnapshot } from "./snapshot";

export type DataSource =
  | { kind: "snapshot"; generatedAt: string; credits: number; sample: boolean; note?: string }
  | { kind: "live"; fetchedAt: string; credits: number }
  | { kind: "missing" };

export interface LoadResult<T> {
  data: T | undefined;
  source: DataSource;
  /** Set when a live fetch failed and we fell back to the snapshot. */
  error?: string;
}

export interface LoadOptions<T> {
  app: string;
  name?: string;
  /** From `?live=1`. */
  live?: boolean;
  /** From `?t=<timestamp>`: bypass the client cache on an explicit re-click. */
  fresh?: boolean;
  fetchLive?: (ctx: { nansen: NansenClient; fresh: boolean }) => Promise<T>;
}

/** Page-level data loader: snapshot by default, live on request, snapshot again if live fails. */
export async function loadAppData<T>(opts: LoadOptions<T>): Promise<LoadResult<T>> {
  const name = opts.name ?? "main";
  const fromSnapshot = async (error?: string): Promise<LoadResult<T>> => {
    const snap = await readSnapshot<T>(opts.app, name);
    if (!snap) return { data: undefined, source: { kind: "missing" }, error };
    return {
      data: snap.data,
      source: { kind: "snapshot", generatedAt: snap.generatedAt, credits: snap.credits, sample: snap.sample ?? false, note: snap.note },
      error,
    };
  };

  if (opts.live && opts.fetchLive) {
    const nansen = getNansen(`app:${opts.app}`);
    const before = nansen.credits.spent;
    try {
      const data = await opts.fetchLive({ nansen, fresh: Boolean(opts.fresh) });
      return { data, source: { kind: "live", fetchedAt: new Date().toISOString(), credits: nansen.credits.spent - before } };
    } catch (err) {
      return fromSnapshot(err instanceof Error ? err.message : String(err));
    }
  }
  return fromSnapshot();
}

/** Parse Next.js search params into loader flags. */
export function liveFlags(searchParams: Record<string, string | string[] | undefined> | undefined): { live: boolean; fresh: boolean } {
  const live = searchParams?.live;
  const t = searchParams?.t;
  return { live: live === "1" || live === "true", fresh: Boolean(t) };
}
