import type { Commands } from "./commands";

/** Upstash Redis over REST (UPSTASH_REDIS_REST_URL/TOKEN). Works from any serverless runtime. */
export class UpstashCommands implements Commands {
  private client: Promise<import("@upstash/redis").Redis> | undefined;

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private async c() {
    if (!this.client) {
      this.client = import("@upstash/redis").then(({ Redis }) => new Redis({ url: this.url, token: this.token, automaticDeserialization: false }));
    }
    return this.client;
  }

  private str(v: unknown): string | null {
    return v === null || v === undefined ? null : String(v);
  }

  async get(key: string) {
    return this.str(await (await this.c()).get(key));
  }
  async set(key: string, value: string, exSec?: number) {
    const c = await this.c();
    if (exSec) await c.set(key, value, { ex: exSec });
    else await c.set(key, value);
  }
  async del(...keys: string[]) {
    if (keys.length) await (await this.c()).del(...keys);
  }
  async incrby(key: string, n: number) {
    return Number(await (await this.c()).incrby(key, n));
  }
  async expire(key: string, sec: number) {
    await (await this.c()).expire(key, sec);
  }
  async hget(key: string, field: string) {
    return this.str(await (await this.c()).hget(key, field));
  }
  async hset(key: string, values: Record<string, string>) {
    if (Object.keys(values).length) await (await this.c()).hset(key, values);
  }
  async hincrby(key: string, field: string, n: number) {
    return Number(await (await this.c()).hincrby(key, field, n));
  }
  async hgetall(key: string) {
    const v = (await (await this.c()).hgetall(key)) as Record<string, unknown> | null;
    const out: Record<string, string> = {};
    if (v) for (const [k, x] of Object.entries(v)) out[k] = String(x);
    return out;
  }
  async hdel(key: string, ...fields: string[]) {
    if (fields.length) await (await this.c()).hdel(key, ...fields);
  }
  async lpush(key: string, ...values: string[]) {
    if (values.length) await (await this.c()).lpush(key, ...values);
  }
  async ltrim(key: string, start: number, stop: number) {
    await (await this.c()).ltrim(key, start, stop);
  }
  async lrange(key: string, start: number, stop: number) {
    return ((await (await this.c()).lrange(key, start, stop)) as unknown[]).map(String);
  }
  async zadd(key: string, score: number, member: string) {
    await (await this.c()).zadd(key, { score, member });
  }
  async zincrby(key: string, n: number, member: string) {
    return Number(await (await this.c()).zincrby(key, n, member));
  }
  async zscore(key: string, member: string) {
    const s = await (await this.c()).zscore(key, member);
    return s === null || s === undefined ? null : Number(s);
  }
  async zrevrank(key: string, member: string) {
    const r = await (await this.c()).zrevrank(key, member);
    return r === null || r === undefined ? null : Number(r);
  }
  async zcard(key: string) {
    return Number(await (await this.c()).zcard(key));
  }
  async zrevrange(key: string, start: number, stop: number) {
    const flat = (await (await this.c()).zrange(key, start, stop, { rev: true, withScores: true })) as unknown[];
    const out: { member: string; score: number }[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) out.push({ member: String(flat[i]), score: Number(flat[i + 1]) });
    return out;
  }
  async zrangebyscore(key: string, min: number, max: number) {
    return ((await (await this.c()).zrange(key, min, max, { byScore: true })) as unknown[]).map(String);
  }
  async zremrangebyscore(key: string, min: number, max: number) {
    await (await this.c()).zremrangebyscore(key, min, max);
  }
  async sadd(key: string, ...members: string[]) {
    if (members.length) await (await this.c()).sadd(key, members[0] as string, ...members.slice(1));
  }
  async srem(key: string, ...members: string[]) {
    if (members.length) await (await this.c()).srem(key, members[0] as string, ...members.slice(1));
  }
  async smembers(key: string) {
    return ((await (await this.c()).smembers(key)) as unknown[]).map(String);
  }
  async sismember(key: string, member: string) {
    return Number(await (await this.c()).sismember(key, member)) === 1;
  }
}
