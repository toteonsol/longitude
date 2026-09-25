import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Commands } from "./commands";

/** Redis-style commands over Convex functions (see convex/kv.ts). Each write is one transaction. */
export class ConvexCommands implements Commands {
  private readonly client: ConvexHttpClient;

  constructor(url: string) {
    this.client = new ConvexHttpClient(url);
  }

  private read<T>(op: string, key: string, a?: unknown, b?: unknown): Promise<T> {
    return this.client.query(api.kv.read, { op, key, a, b }) as Promise<T>;
  }

  private exec<T>(op: string, key: string, a?: unknown, b?: unknown): Promise<T> {
    return this.client.mutation(api.kv.exec, { op, key, a, b }) as Promise<T>;
  }

  get(key: string) {
    return this.read<string | null>("get", key);
  }
  async set(key: string, value: string, exSec?: number) {
    await this.exec("set", key, value, exSec);
  }
  async del(...keys: string[]) {
    for (const k of keys) await this.exec("del", k);
  }
  incrby(key: string, n: number) {
    return this.exec<number>("incrby", key, n);
  }
  async expire(key: string, sec: number) {
    await this.exec("expire", key, sec);
  }
  hget(key: string, field: string) {
    return this.read<string | null>("hget", key, field);
  }
  async hset(key: string, values: Record<string, string>) {
    if (Object.keys(values).length) await this.exec("hset", key, values);
  }
  hincrby(key: string, field: string, n: number) {
    return this.exec<number>("hincrby", key, field, n);
  }
  hgetall(key: string) {
    return this.read<Record<string, string>>("hgetall", key);
  }
  async hdel(key: string, ...fields: string[]) {
    if (fields.length) await this.exec("hdel", key, fields);
  }
  async lpush(key: string, ...values: string[]) {
    if (values.length) await this.exec("lpush", key, values);
  }
  async ltrim(key: string, start: number, stop: number) {
    await this.exec("ltrim", key, start, stop);
  }
  lrange(key: string, start: number, stop: number) {
    return this.read<string[]>("lrange", key, start, stop);
  }
  async zadd(key: string, score: number, member: string) {
    await this.exec("zadd", key, score, member);
  }
  zincrby(key: string, n: number, member: string) {
    return this.exec<number>("zincrby", key, n, member);
  }
  zscore(key: string, member: string) {
    return this.read<number | null>("zscore", key, member);
  }
  zrevrank(key: string, member: string) {
    return this.read<number | null>("zrevrank", key, member);
  }
  zcard(key: string) {
    return this.read<number>("zcard", key);
  }
  zrevrange(key: string, start: number, stop: number) {
    return this.read<{ member: string; score: number }[]>("zrevrange", key, start, stop);
  }
  zrangebyscore(key: string, min: number, max: number) {
    return this.read<string[]>("zrangebyscore", key, bound(min), bound(max));
  }
  async zremrangebyscore(key: string, min: number, max: number) {
    await this.exec("zremrangebyscore", key, bound(min), bound(max));
  }
  async sadd(key: string, ...members: string[]) {
    if (members.length) await this.exec("sadd", key, members);
  }
  async srem(key: string, ...members: string[]) {
    if (members.length) await this.exec("srem", key, members);
  }
  smembers(key: string) {
    return this.read<string[]>("smembers", key);
  }
  sismember(key: string, member: string) {
    return this.read<boolean>("sismember", key, member);
  }
}

/** Infinity cannot cross the Convex value boundary; the functions accept "+inf" / "-inf". */
const bound = (n: number): number | string => (n === Number.POSITIVE_INFINITY ? "+inf" : n === Number.NEGATIVE_INFINITY ? "-inf" : n);
