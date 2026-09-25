import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /** One document per Redis-style key: strings, hashes, lists, sorted sets and sets. */
  kv: defineTable({
    key: v.string(),
    kind: v.union(v.literal("string"), v.literal("hash"), v.literal("list"), v.literal("zset"), v.literal("set")),
    data: v.any(),
    exp: v.optional(v.number()),
  }).index("by_key", ["key"]),

  /** Seed output per app, served as JSON over HTTP so the apps read it without a redeploy. */
  snapshots: defineTable({
    app: v.string(),
    name: v.string(),
    json: v.string(),
    generatedAt: v.string(),
    credits: v.number(),
    sample: v.boolean(),
  }).index("by_app_name", ["app", "name"]),
});
