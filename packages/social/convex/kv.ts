import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, mutation, query } from "./_generated/server";

type Kind = Doc<"kv">["kind"];
type ZEntry = [string, number];

async function load(ctx: QueryCtx | MutationCtx, key: string): Promise<Doc<"kv"> | null> {
  const doc = await ctx.db
    .query("kv")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (doc?.exp !== undefined && doc.exp <= Date.now()) return null;
  return doc;
}

async function save(ctx: MutationCtx, key: string, kind: Kind, data: unknown, existing: Doc<"kv"> | null, exp?: number): Promise<void> {
  const patch = { key, kind, data, exp: exp ?? existing?.exp };
  if (existing) await ctx.db.replace(existing._id, patch);
  else await ctx.db.insert("kv", patch);
}

const bound = (n: number | string) => (n === "+inf" ? Number.POSITIVE_INFINITY : n === "-inf" ? Number.NEGATIVE_INFINITY : Number(n));
const sortedZ = (z: ZEntry[]) => [...z].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const sliceRange = <T>(arr: T[], start: number, stop: number) => arr.slice(start, stop < 0 ? arr.length + stop + 1 : stop + 1);

/** Read-only commands. */
export const read = query({
  args: { op: v.string(), key: v.string(), a: v.optional(v.any()), b: v.optional(v.any()) },
  handler: async (ctx, { op, key, a, b }) => {
    const doc = await load(ctx, key);
    switch (op) {
      case "get":
        return doc?.kind === "string" ? (doc.data as string) : null;
      case "hget":
        return doc?.kind === "hash" ? ((doc.data as Record<string, string>)[a as string] ?? null) : null;
      case "hgetall":
        return doc?.kind === "hash" ? (doc.data as Record<string, string>) : {};
      case "lrange":
        return doc?.kind === "list" ? sliceRange(doc.data as string[], Number(a), Number(b)) : [];
      case "zscore": {
        const hit = doc?.kind === "zset" ? (doc.data as ZEntry[]).find((e) => e[0] === a) : undefined;
        return hit ? hit[1] : null;
      }
      case "zrevrank": {
        if (doc?.kind !== "zset") return null;
        const i = sortedZ(doc.data as ZEntry[]).findIndex((e) => e[0] === a);
        return i < 0 ? null : i;
      }
      case "zcard":
        return doc?.kind === "zset" ? (doc.data as ZEntry[]).length : 0;
      case "zrevrange":
        return doc?.kind === "zset" ? sliceRange(sortedZ(doc.data as ZEntry[]), Number(a), Number(b)).map(([member, score]) => ({ member, score })) : [];
      case "zrangebyscore": {
        if (doc?.kind !== "zset") return [];
        const min = bound(a as number | string);
        const max = bound(b as number | string);
        return (doc.data as ZEntry[])
          .filter((e) => e[1] >= min && e[1] <= max)
          .sort((x, y) => x[1] - y[1])
          .map((e) => e[0]);
      }
      case "smembers":
        return doc?.kind === "set" ? (doc.data as string[]) : [];
      case "sismember":
        return doc?.kind === "set" ? (doc.data as string[]).includes(a as string) : false;
      default:
        throw new Error(`unknown read op ${op}`);
    }
  },
});

/** Read-modify-write commands, each transactional. */
export const exec = mutation({
  args: { op: v.string(), key: v.string(), a: v.optional(v.any()), b: v.optional(v.any()) },
  handler: async (ctx, { op, key, a, b }) => {
    const doc = await load(ctx, key);
    switch (op) {
      case "set":
        await save(ctx, key, "string", String(a), doc, b ? Date.now() + Number(b) * 1000 : undefined);
        return null;
      case "del": {
        const existing = await ctx.db
          .query("kv")
          .withIndex("by_key", (q) => q.eq("key", key))
          .unique();
        if (existing) await ctx.db.delete(existing._id);
        return null;
      }
      case "incrby": {
        const next = Number(doc?.kind === "string" ? doc.data : 0) + Number(a);
        await save(ctx, key, "string", String(next), doc);
        return next;
      }
      case "expire":
        if (doc) await ctx.db.patch(doc._id, { exp: Date.now() + Number(a) * 1000 });
        return null;
      case "hset": {
        const h = doc?.kind === "hash" ? { ...(doc.data as Record<string, string>) } : {};
        Object.assign(h, a as Record<string, string>);
        await save(ctx, key, "hash", h, doc);
        return null;
      }
      case "hincrby": {
        const h = doc?.kind === "hash" ? { ...(doc.data as Record<string, string>) } : {};
        const next = Number(h[a as string] ?? 0) + Number(b);
        h[a as string] = String(next);
        await save(ctx, key, "hash", h, doc);
        return next;
      }
      case "hdel": {
        const h = doc?.kind === "hash" ? { ...(doc.data as Record<string, string>) } : {};
        for (const f of a as string[]) delete h[f];
        await save(ctx, key, "hash", h, doc);
        return null;
      }
      case "lpush": {
        const l = doc?.kind === "list" ? [...(doc.data as string[])] : [];
        for (const val of a as string[]) l.unshift(val);
        await save(ctx, key, "list", l, doc);
        return null;
      }
      case "ltrim": {
        const l = doc?.kind === "list" ? (doc.data as string[]) : [];
        await save(ctx, key, "list", sliceRange(l, Number(a), Number(b)), doc);
        return null;
      }
      case "zadd": {
        const z = doc?.kind === "zset" ? (doc.data as ZEntry[]).filter((e) => e[0] !== b) : [];
        z.push([b as string, Number(a)]);
        await save(ctx, key, "zset", z, doc);
        return null;
      }
      case "zincrby": {
        const z = doc?.kind === "zset" ? [...(doc.data as ZEntry[])] : [];
        const i = z.findIndex((e) => e[0] === b);
        const next = (i >= 0 ? (z[i] as ZEntry)[1] : 0) + Number(a);
        if (i >= 0) z[i] = [b as string, next];
        else z.push([b as string, next]);
        await save(ctx, key, "zset", z, doc);
        return next;
      }
      case "zremrangebyscore": {
        const min = bound(a as number | string);
        const max = bound(b as number | string);
        const z = doc?.kind === "zset" ? (doc.data as ZEntry[]).filter((e) => !(e[1] >= min && e[1] <= max)) : [];
        await save(ctx, key, "zset", z, doc);
        return null;
      }
      case "sadd": {
        const s = new Set(doc?.kind === "set" ? (doc.data as string[]) : []);
        for (const m of a as string[]) s.add(m);
        await save(ctx, key, "set", [...s], doc);
        return null;
      }
      case "srem": {
        const s = new Set(doc?.kind === "set" ? (doc.data as string[]) : []);
        for (const m of a as string[]) s.delete(m);
        await save(ctx, key, "set", [...s], doc);
        return null;
      }
      default:
        throw new Error(`unknown exec op ${op}`);
    }
  },
});
