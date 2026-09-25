import { isServerless, resolveRepoPath } from "./util";

export interface CacheEntry<T = unknown> {
  value: T;
  storedAt: number;
  expiresAt: number;
  endpoint?: string;
}

/**
 * TTL cache. `get` returns expired entries too (with `expiresAt` in the past) so the client can
 * serve stale data when the API is down; callers must check `expiresAt` themselves.
 */
export interface Cache {
  readonly name: string;
  get<T>(key: string): Promise<CacheEntry<T> | undefined>;
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryCache implements Cache {
  readonly name = "memory";
  private readonly map = new Map<string, CacheEntry>();
  constructor(private readonly maxEntries = 1000) {}

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const hit = this.map.get(key) as CacheEntry<T> | undefined;
    if (!hit) return undefined;
    // refresh LRU position
    this.map.delete(key);
    this.map.set(key, hit);
    return hit;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    this.map.delete(key);
    this.map.set(key, entry);
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async clear(): Promise<void> {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

/**
 * JSON-file cache, one file per key. Survives process restarts so re-running a seed script during
 * development costs zero credits. A relative `dir` resolves against the monorepo root so every app
 * and script shares one cache. Uses dynamic `node:fs` imports so the module can be evaluated in a
 * non-Node bundle without crashing at import time (it will just fail when used there).
 */
export class DiskCache implements Cache {
  readonly name = "disk";
  private resolved: Promise<string> | undefined;

  constructor(readonly dir: string = process.env.NANSEN_CACHE_DIR || ".nansen-cache") {}

  private async fs() {
    return import("node:fs/promises");
  }

  /** Absolute cache directory, created on first use. */
  directory(): Promise<string> {
    if (!this.resolved) {
      this.resolved = (async () => {
        const abs = await resolveRepoPath(this.dir);
        const fs = await this.fs();
        await fs.mkdir(abs, { recursive: true });
        return abs;
      })();
    }
    return this.resolved;
  }

  private async file(key: string): Promise<string> {
    return `${await this.directory()}/${key.replace(/[^a-z0-9._-]/gi, "_")}.json`;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    try {
      const fs = await this.fs();
      const raw = await fs.readFile(await this.file(key), "utf8");
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (typeof entry?.expiresAt !== "number") return undefined;
      return entry;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const fs = await this.fs();
    const target = await this.file(key);
    const tmp = `${target}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(entry));
    await fs.rename(tmp, target);
  }

  async delete(key: string): Promise<void> {
    const fs = await this.fs();
    await fs.rm(await this.file(key), { force: true });
  }

  async clear(): Promise<void> {
    const fs = await this.fs();
    await fs.rm(await this.directory(), { recursive: true, force: true });
    this.resolved = undefined;
  }
}

/** Cache that never stores anything. */
export class NoCache implements Cache {
  readonly name = "none";
  async get(): Promise<undefined> {
    return undefined;
  }
  async set(): Promise<void> {}
  async delete(): Promise<void> {}
  async clear(): Promise<void> {}
}

let shared: Cache | undefined;

/**
 * Disk cache for scripts and local dev (where a writable filesystem exists), memory cache on
 * serverless. Set NANSEN_CACHE_DIR to force the disk cache anywhere.
 */
export function defaultCache(): Cache {
  if (!shared) {
    const forceDisk = Boolean(process.env.NANSEN_CACHE_DIR);
    shared = forceDisk || !isServerless() ? new DiskCache() : new MemoryCache();
  }
  return shared;
}
