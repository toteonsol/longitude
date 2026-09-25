import { describe, expect, it } from "vitest";
import { MemoryCommands } from "../src/commands";
import { handleFor, isValidId, newId } from "../src/identity";
import { SocialStore } from "../src/store";

const fresh = () => new SocialStore(new MemoryCommands());
const me = { id: "abcdef0123456789", handle: handleFor("abcdef0123456789") };
const you = { id: "fedcba9876543210", handle: handleFor("fedcba9876543210") };

describe("identity", () => {
  it("makes valid ids and stable readable handles", () => {
    const id = newId();
    expect(isValidId(id)).toBe(true);
    expect(handleFor(id)).toBe(handleFor(id));
    expect(handleFor("abcdef0123456789")).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d+$/);
    expect(isValidId("../etc")).toBe(false);
    expect(isValidId("short")).toBe(false);
  });
});

describe("SocialStore", () => {
  it("creates profiles on touch and counts visitors once", async () => {
    const s = fresh();
    const p = await s.touch(me.id);
    expect(p.handle).toBe(me.handle);
    await s.touch(me.id);
    await s.touch(you.id);
    expect(await s.visitorCount()).toBe(2);
    expect((await s.profile(me.id))?.createdAt).toBe(p.createdAt);
    expect(await s.profile("nope-nope-nope")).toBeNull();
  });

  it("publishes to the global and app feeds, newest first", async () => {
    const s = fresh();
    await s.publish({ app: "rewind", type: "score", actor: me, text: "scored 4/5" });
    await s.publish({ app: "rookie-scout", type: "draft", actor: you, text: "drafted 8MHU" });
    const global = await s.feed(10);
    expect(global.map((e) => e.app)).toEqual(["rookie-scout", "rewind"]);
    expect(await s.feed(10, "rewind")).toHaveLength(1);
    expect(global[0]?.actor.handle).toBe(you.handle);
  });

  it("keeps leaderboards in sum and max modes with ranks", async () => {
    const s = fresh();
    await s.score("rewind", me, 3);
    await s.score("rewind", me, 2);
    await s.score("rewind", you, 4);
    const board = await s.leaderboard("rewind");
    expect(board.map((e) => [e.handle, e.score, e.rank])).toEqual([
      [me.handle, 5, 1],
      [you.handle, 4, 2],
    ]);
    await s.score("streak", me, 7, "max");
    await s.score("streak", me, 3, "max");
    expect((await s.standing("streak", me.id))?.score).toBe(7);
    expect(await s.standing("streak", you.id)).toBeNull();
  });

  it("toggles reactions per user and reports counts", async () => {
    const s = fresh();
    const t = "obituary:0xabc";
    await s.react(t, me, "candle");
    await s.react(t, you, "candle");
    const r = await s.react(t, me, "fire");
    expect(r.counts).toEqual({ candle: 2, fire: 1 });
    expect(r.mine.sort()).toEqual(["candle", "fire"]);
    const again = await s.react(t, me, "candle");
    expect(again.counts).toEqual({ candle: 1, fire: 1 });
  });

  it("tracks presence per app and globally", async () => {
    const s = fresh();
    await s.heartbeat("exit-clock", me);
    await s.heartbeat("exit-clock", me);
    await s.heartbeat("rewind", you);
    expect((await s.presence("exit-clock")).count).toBe(1);
    expect((await s.presence()).count).toBe(2);
    expect(await s.presenceByApp()).toEqual({ "exit-clock": 1, rewind: 1 });
  });

  it("stamps passports and keeps lists per user", async () => {
    const s = fresh();
    expect((await s.stamp(me.id, "rewind")).isNew).toBe(true);
    expect((await s.stamp(me.id, "rewind")).isNew).toBe(false);
    await s.stamp(me.id, "dynasties");
    expect(await s.passport(me.id)).toEqual(["dynasties", "rewind"]);
    await s.addItem(me.id, "roster", "0xabc", { symbol: "PEPE" });
    await s.addItem(me.id, "roster", "0xdef", { symbol: "WIF" });
    expect((await s.items(me.id, "roster")).map((i) => i.id).sort()).toEqual(["0xabc", "0xdef"]);
    await s.removeItem(me.id, "roster", "0xabc");
    expect(await s.items(me.id, "roster")).toHaveLength(1);
    expect(await s.items("bad id", "roster")).toEqual([]);
  });
});
