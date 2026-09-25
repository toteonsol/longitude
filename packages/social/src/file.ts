import type { Commands } from "./commands";
import { MemoryCommands } from "./commands";

type Dump = {
  strings: [string, { v: string; exp?: number }][];
  hashes: [string, [string, string][]][];
  lists: [string, string[]][];
  zsets: [string, [string, number][]][];
  sets: [string, string[]][];
  expiries: [string, number][];
};

/**
 * MemoryCommands persisted to one JSON file. Every command reloads the file if another process
 * changed it and writes it back afterwards, so the eleven local dev servers share one social
 * state. Development only: last writer wins under contention. Production uses Redis or Upstash.
 */
export class FileCommands implements Commands {
  private mem = new MemoryCommands();
  private mtime = 0;
  private chain: Promise<void> = Promise.resolve();

  constructor(readonly file: string) {}

  private async fs() {
    return import("node:fs/promises");
  }

  private async load(): Promise<void> {
    try {
      const fs = await this.fs();
      const stat = await fs.stat(this.file);
      if (stat.mtimeMs === this.mtime) return;
      const raw = JSON.parse(await fs.readFile(this.file, "utf8")) as Dump;
      this.mem = MemoryCommands.fromDump(raw);
      this.mtime = stat.mtimeMs;
    } catch {
      /* no file yet */
    }
  }

  private async save(): Promise<void> {
    const fs = await this.fs();
    const path = await import("node:path");
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.mem.dump()));
    await fs.rename(tmp, this.file);
    this.mtime = (await fs.stat(this.file)).mtimeMs;
  }

  /** Serializes commands per process: load → run → save. */
  private run<T>(fn: (m: MemoryCommands) => Promise<T>, write = true): Promise<T> {
    const next = this.chain.then(async () => {
      await this.load();
      const out = await fn(this.mem);
      if (write) await this.save();
      return out;
    });
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  get(key: string) {
    return this.run((m) => m.get(key), false);
  }
  set(key: string, value: string, exSec?: number) {
    return this.run((m) => m.set(key, value, exSec));
  }
  del(...keys: string[]) {
    return this.run((m) => m.del(...keys));
  }
  incrby(key: string, n: number) {
    return this.run((m) => m.incrby(key, n));
  }
  expire(key: string, sec: number) {
    return this.run((m) => m.expire(key, sec));
  }
  hget(key: string, field: string) {
    return this.run((m) => m.hget(key, field), false);
  }
  hset(key: string, values: Record<string, string>) {
    return this.run((m) => m.hset(key, values));
  }
  hincrby(key: string, field: string, n: number) {
    return this.run((m) => m.hincrby(key, field, n));
  }
  hgetall(key: string) {
    return this.run((m) => m.hgetall(key), false);
  }
  hdel(key: string, ...fields: string[]) {
    return this.run((m) => m.hdel(key, ...fields));
  }
  lpush(key: string, ...values: string[]) {
    return this.run((m) => m.lpush(key, ...values));
  }
  ltrim(key: string, start: number, stop: number) {
    return this.run((m) => m.ltrim(key, start, stop));
  }
  lrange(key: string, start: number, stop: number) {
    return this.run((m) => m.lrange(key, start, stop), false);
  }
  zadd(key: string, score: number, member: string) {
    return this.run((m) => m.zadd(key, score, member));
  }
  zincrby(key: string, n: number, member: string) {
    return this.run((m) => m.zincrby(key, n, member));
  }
  zscore(key: string, member: string) {
    return this.run((m) => m.zscore(key, member), false);
  }
  zrevrank(key: string, member: string) {
    return this.run((m) => m.zrevrank(key, member), false);
  }
  zcard(key: string) {
    return this.run((m) => m.zcard(key), false);
  }
  zrevrange(key: string, start: number, stop: number) {
    return this.run((m) => m.zrevrange(key, start, stop), false);
  }
  zrangebyscore(key: string, min: number, max: number) {
    return this.run((m) => m.zrangebyscore(key, min, max), false);
  }
  zremrangebyscore(key: string, min: number, max: number) {
    return this.run((m) => m.zremrangebyscore(key, min, max));
  }
  sadd(key: string, ...members: string[]) {
    return this.run((m) => m.sadd(key, ...members));
  }
  srem(key: string, ...members: string[]) {
    return this.run((m) => m.srem(key, ...members));
  }
  smembers(key: string) {
    return this.run((m) => m.smembers(key), false);
  }
  sismember(key: string, member: string) {
    return this.run((m) => m.sismember(key, member), false);
  }
}
