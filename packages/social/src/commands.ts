/** The dozen Redis commands the store needs. Implemented by ioredis, Upstash REST, and memory. */
export interface Commands {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, exSec?: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  incrby(key: string, n: number): Promise<number>;
  expire(key: string, sec: number): Promise<void>;

  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, values: Record<string, string>): Promise<void>;
  hincrby(key: string, field: string, n: number): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, ...fields: string[]): Promise<void>;

  lpush(key: string, ...values: string[]): Promise<void>;
  ltrim(key: string, start: number, stop: number): Promise<void>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;

  zadd(key: string, score: number, member: string): Promise<void>;
  zincrby(key: string, n: number, member: string): Promise<number>;
  zscore(key: string, member: string): Promise<number | null>;
  zrevrank(key: string, member: string): Promise<number | null>;
  zcard(key: string): Promise<number>;
  /** Highest scores first, inclusive indexes like Redis. */
  zrevrange(key: string, start: number, stop: number): Promise<{ member: string; score: number }[]>;
  zrangebyscore(key: string, min: number, max: number): Promise<string[]>;
  zremrangebyscore(key: string, min: number, max: number): Promise<void>;

  sadd(key: string, ...members: string[]): Promise<void>;
  srem(key: string, ...members: string[]): Promise<void>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<boolean>;
}

export interface MemoryDump {
  strings: [string, { v: string; exp?: number }][];
  hashes: [string, [string, string][]][];
  lists: [string, string[]][];
  zsets: [string, [string, number][]][];
  sets: [string, string[]][];
  expiries: [string, number][];
}

/** In-process implementation for development and tests. */
export class MemoryCommands implements Commands {
  private strings = new Map<string, { v: string; exp?: number }>();
  private hashes = new Map<string, Map<string, string>>();
  private lists = new Map<string, string[]>();
  private zsets = new Map<string, Map<string, number>>();
  private sets = new Map<string, Set<string>>();
  private expiries = new Map<string, number>();

  dump(): MemoryDump {
    return {
      strings: [...this.strings],
      hashes: [...this.hashes].map(([k, v]) => [k, [...v]]),
      lists: [...this.lists],
      zsets: [...this.zsets].map(([k, v]) => [k, [...v]]),
      sets: [...this.sets].map(([k, v]) => [k, [...v]]),
      expiries: [...this.expiries],
    };
  }

  static fromDump(d: MemoryDump): MemoryCommands {
    const m = new MemoryCommands();
    m.strings = new Map(d.strings ?? []);
    m.hashes = new Map((d.hashes ?? []).map(([k, v]) => [k, new Map(v)]));
    m.lists = new Map(d.lists ?? []);
    m.zsets = new Map((d.zsets ?? []).map(([k, v]) => [k, new Map(v)]));
    m.sets = new Map((d.sets ?? []).map(([k, v]) => [k, new Set(v)]));
    m.expiries = new Map(d.expiries ?? []);
    return m;
  }

  private alive(key: string): boolean {
    const exp = this.expiries.get(key);
    if (exp !== undefined && exp <= Date.now()) {
      this.expiries.delete(key);
      this.strings.delete(key);
      this.hashes.delete(key);
      this.lists.delete(key);
      this.zsets.delete(key);
      this.sets.delete(key);
      return false;
    }
    return true;
  }

  async get(key: string) {
    return this.alive(key) ? (this.strings.get(key)?.v ?? null) : null;
  }
  async set(key: string, value: string, exSec?: number) {
    this.strings.set(key, { v: value });
    if (exSec) this.expiries.set(key, Date.now() + exSec * 1000);
    else this.expiries.delete(key);
  }
  async del(...keys: string[]) {
    for (const k of keys) {
      this.strings.delete(k);
      this.hashes.delete(k);
      this.lists.delete(k);
      this.zsets.delete(k);
      this.sets.delete(k);
      this.expiries.delete(k);
    }
  }
  async incrby(key: string, n: number) {
    this.alive(key);
    const next = Number(this.strings.get(key)?.v ?? 0) + n;
    this.strings.set(key, { v: String(next) });
    return next;
  }
  async expire(key: string, sec: number) {
    this.expiries.set(key, Date.now() + sec * 1000);
  }

  private hash(key: string) {
    this.alive(key);
    let h = this.hashes.get(key);
    if (!h) {
      h = new Map();
      this.hashes.set(key, h);
    }
    return h;
  }
  async hget(key: string, field: string) {
    return this.hash(key).get(field) ?? null;
  }
  async hset(key: string, values: Record<string, string>) {
    const h = this.hash(key);
    for (const [k, v] of Object.entries(values)) h.set(k, v);
  }
  async hincrby(key: string, field: string, n: number) {
    const h = this.hash(key);
    const next = Number(h.get(field) ?? 0) + n;
    h.set(field, String(next));
    return next;
  }
  async hgetall(key: string) {
    return Object.fromEntries(this.hash(key));
  }
  async hdel(key: string, ...fields: string[]) {
    const h = this.hash(key);
    for (const f of fields) h.delete(f);
  }

  private list(key: string) {
    this.alive(key);
    let l = this.lists.get(key);
    if (!l) {
      l = [];
      this.lists.set(key, l);
    }
    return l;
  }
  async lpush(key: string, ...values: string[]) {
    const l = this.list(key);
    for (const v of values) l.unshift(v);
  }
  async ltrim(key: string, start: number, stop: number) {
    const l = this.list(key);
    const end = stop < 0 ? l.length + stop + 1 : stop + 1;
    this.lists.set(key, l.slice(start, end));
  }
  async lrange(key: string, start: number, stop: number) {
    const l = this.list(key);
    const end = stop < 0 ? l.length + stop + 1 : stop + 1;
    return l.slice(start, end);
  }

  private zset(key: string) {
    this.alive(key);
    let z = this.zsets.get(key);
    if (!z) {
      z = new Map();
      this.zsets.set(key, z);
    }
    return z;
  }
  async zadd(key: string, score: number, member: string) {
    this.zset(key).set(member, score);
  }
  async zincrby(key: string, n: number, member: string) {
    const z = this.zset(key);
    const next = (z.get(member) ?? 0) + n;
    z.set(member, next);
    return next;
  }
  async zscore(key: string, member: string) {
    return this.zset(key).get(member) ?? null;
  }
  private sorted(key: string) {
    return [...this.zset(key).entries()].map(([member, score]) => ({ member, score })).sort((a, b) => b.score - a.score || a.member.localeCompare(b.member));
  }
  async zrevrank(key: string, member: string) {
    const i = this.sorted(key).findIndex((e) => e.member === member);
    return i < 0 ? null : i;
  }
  async zcard(key: string) {
    return this.zset(key).size;
  }
  async zrevrange(key: string, start: number, stop: number) {
    const s = this.sorted(key);
    const end = stop < 0 ? s.length + stop + 1 : stop + 1;
    return s.slice(start, end);
  }
  async zrangebyscore(key: string, min: number, max: number) {
    return [...this.zset(key).entries()].filter(([, s]) => s >= min && s <= max).sort((a, b) => a[1] - b[1]).map(([m]) => m);
  }
  async zremrangebyscore(key: string, min: number, max: number) {
    const z = this.zset(key);
    for (const [m, s] of z) if (s >= min && s <= max) z.delete(m);
  }

  private setOf(key: string) {
    this.alive(key);
    let s = this.sets.get(key);
    if (!s) {
      s = new Set();
      this.sets.set(key, s);
    }
    return s;
  }
  async sadd(key: string, ...members: string[]) {
    const s = this.setOf(key);
    for (const m of members) s.add(m);
  }
  async srem(key: string, ...members: string[]) {
    const s = this.setOf(key);
    for (const m of members) s.delete(m);
  }
  async smembers(key: string) {
    return [...this.setOf(key)];
  }
  async sismember(key: string, member: string) {
    return this.setOf(key).has(member);
  }
}
