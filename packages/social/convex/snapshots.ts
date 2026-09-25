import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Seeds push here (token-protected). The HTTP route in http.ts serves the JSON back. */
export const put = mutation({
  args: { token: v.string(), app: v.string(), name: v.string(), json: v.string(), generatedAt: v.string(), credits: v.number(), sample: v.boolean() },
  handler: async (ctx, { token, ...snap }) => {
    const expected = process.env.SEED_TOKEN;
    if (!expected || token !== expected) throw new Error("bad seed token");
    const existing = await ctx.db
      .query("snapshots")
      .withIndex("by_app_name", (q) => q.eq("app", snap.app).eq("name", snap.name))
      .unique();
    if (existing) await ctx.db.replace(existing._id, snap);
    else await ctx.db.insert("snapshots", snap);
    return null;
  },
});

export const get = query({
  args: { app: v.string(), name: v.string() },
  handler: async (ctx, { app, name }) => {
    const doc = await ctx.db
      .query("snapshots")
      .withIndex("by_app_name", (q) => q.eq("app", app).eq("name", name))
      .unique();
    return doc ? doc.json : null;
  },
});

/** The manifest the store reads: per app, when it was seeded and what it cost. */
export const manifest = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("snapshots").collect();
    const out: Record<string, { generatedAt: string; credits: number; sample: boolean; snapshots: string[] }> = {};
    for (const s of all) {
      const m = (out[s.app] ??= { generatedAt: "", credits: 0, sample: true, snapshots: [] });
      m.snapshots.push(s.name);
      if (!s.sample) {
        m.sample = false;
        m.credits += s.credits;
      }
      if (s.generatedAt > m.generatedAt) m.generatedAt = s.generatedAt;
    }
    for (const m of Object.values(out)) m.snapshots.sort();
    return out;
  },
});
