import type { Commands } from "./commands";

const INF = "+inf";
const NEG_INF = "-inf";
const bound = (n: number) => (n === Number.POSITIVE_INFINITY ? INF : n === Number.NEGATIVE_INFINITY ? NEG_INF : String(n));

/** ioredis over TCP (REDIS_URL, e.g. Railway). Connects lazily on first command. */
export class IoRedisCommands implements Commands {
  private client: Promise<import("ioredis").default> | undefined;

  constructor(private readonly url: string) {}

  private async c() {
    if (!this.client) {
      this.client = import("ioredis").then(({ default: Redis }) => new Redis(this.url, { lazyConnect: true, maxRetriesPerRequest: 2, enableOfflineQueue: true, connectTimeout: 5000 }));
    }
    return this.client;
  }

  async get(key: string) {
    return (await this.c()).get(key);
  }
  async set(key: string, value: string, exSec?: number) {
    const c = await this.c();
    if (exSec) await c.set(key, value, "EX", exSec);
    else await c.set(key, value);
  }
  async del(...keys: string[]) {
    if (keys.length) await (await this.c()).del(...keys);
  }
  async incrby(key: string, n: number) {
    return (await this.c()).incrby(key, n);
  }
  async expire(key: string, sec: number) {
    await (await this.c()).expire(key, sec);
  }
  async hget(key: string, field: string) {
    return (await this.c()).hget(key, field);
  }
  async hset(key: string, values: Record<string, string>) {
    if (Object.keys(values).length) await (await this.c()).hset(key, values);
  }
  async hincrby(key: string, field: string, n: number) {
    return (await this.c()).hincrby(key, field, n);
  }
  async hgetall(key: string) {
    return (await this.c()).hgetall(key);
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
    return (await this.c()).lrange(key, start, stop);
  }
  async zadd(key: string, score: number, member: string) {
    await (await this.c()).zadd(key, score, member);
  }
  async zincrby(key: string, n: number, member: string) {
    return Number(await (await this.c()).zincrby(key, n, member));
  }
  async zscore(key: string, member: string) {
    const s = await (await this.c()).zscore(key, member);
    return s === null ? null : Number(s);
  }
  async zrevrank(key: string, member: string) {
    const r = await (await this.c()).zrevrank(key, member);
    return r === null ? null : Number(r);
  }
  async zcard(key: string) {
    return (await this.c()).zcard(key);
  }
  async zrevrange(key: string, start: number, stop: number) {
    const flat = await (await this.c()).zrevrange(key, start, stop, "WITHSCORES");
    const out: { member: string; score: number }[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) out.push({ member: flat[i] as string, score: Number(flat[i + 1]) });
    return out;
  }
  async zrangebyscore(key: string, min: number, max: number) {
    return (await this.c()).zrangebyscore(key, bound(min), bound(max));
  }
  async zremrangebyscore(key: string, min: number, max: number) {
    await (await this.c()).zremrangebyscore(key, bound(min), bound(max));
  }
  async sadd(key: string, ...members: string[]) {
    if (members.length) await (await this.c()).sadd(key, ...members);
  }
  async srem(key: string, ...members: string[]) {
    if (members.length) await (await this.c()).srem(key, ...members);
  }
  async smembers(key: string) {
    return (await this.c()).smembers(key);
  }
  async sismember(key: string, member: string) {
    return (await (await this.c()).sismember(key, member)) === 1;
  }
}
