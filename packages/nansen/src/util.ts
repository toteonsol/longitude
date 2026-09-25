/** Deterministic JSON: object keys sorted recursively, undefined dropped. Used for cache keys. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = sortValue(v);
    }
    return out;
  }
  return value;
}

/** cyrb53: fast 53-bit string hash, plenty for cache keys. Returns 14 hex chars. */
export function hash53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(16).padStart(14, "0");
}

/** Cache key for an API call: readable endpoint slug + hash of the canonical body. */
export function cacheKey(endpoint: string, body: unknown): string {
  const slug = endpoint.replace(/^\/api\/(v1beta1|v1)\//, "").replace(/[^a-z0-9]+/gi, "-");
  return `${slug}.${hash53(stableStringify(body ?? null))}`;
}

export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error("aborted"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(t);
      reject(signal?.reason ?? new Error("aborted"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });

/** Exponential backoff with full jitter, capped. */
export function backoffMs(attempt: number, baseMs = 500, maxMs = 20_000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.round(Math.random() * exp);
}

export const isServerless = (): boolean =>
  Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);

export const nowIso = (): string => new Date().toISOString();

/** YYYY-MM-DD in UTC. */
export function isoDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Date range helper: `{ from, to }` for the last N days ending today (UTC). */
export function lastDays(days: number, end: Date = new Date()): { from: string; to: string } {
  const start = new Date(end.getTime() - days * 86_400_000);
  return { from: isoDate(start), to: isoDate(end) };
}

let repoRootPromise: Promise<string> | undefined;

/** Walk up from cwd to the directory holding pnpm-workspace.yaml; falls back to cwd. Memoized. */
export function findRepoRoot(from: string = process.cwd()): Promise<string> {
  if (!repoRootPromise) {
    repoRootPromise = (async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      let dir = path.resolve(from);
      for (;;) {
        try {
          await fs.access(path.join(dir, "pnpm-workspace.yaml"));
          return dir;
        } catch {
          /* keep walking */
        }
        const parent = path.dirname(dir);
        if (parent === dir) return path.resolve(from);
        dir = parent;
      }
    })();
  }
  return repoRootPromise;
}

/** Absolute paths pass through; relative ones resolve against the monorepo root, not the cwd. */
export async function resolveRepoPath(p: string): Promise<string> {
  const path = await import("node:path");
  if (path.isAbsolute(p)) return p;
  return path.join(await findRepoRoot(), p);
}
