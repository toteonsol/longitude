import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DiskCache, MemoryCache } from "../src/cache";

describe("MemoryCache", () => {
  it("round-trips and evicts least recently used", async () => {
    const c = new MemoryCache(2);
    await c.set("a", { value: 1, storedAt: 0, expiresAt: 10 });
    await c.set("b", { value: 2, storedAt: 0, expiresAt: 10 });
    await c.get("a"); // touch a → b is now oldest
    await c.set("c", { value: 3, storedAt: 0, expiresAt: 10 });
    expect(await c.get("b")).toBeUndefined();
    expect((await c.get("a"))?.value).toBe(1);
    expect((await c.get("c"))?.value).toBe(3);
  });
});

describe("DiskCache", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "nansen-cache-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("persists entries as JSON files and returns expired entries for stale-if-error", async () => {
    const c = new DiskCache(dir);
    await c.set("smart-money-netflow.abc", { value: { data: [1] }, storedAt: 1, expiresAt: 2, endpoint: "/x" });
    const fresh = new DiskCache(dir);
    const hit = await fresh.get<{ data: number[] }>("smart-money-netflow.abc");
    expect(hit?.value.data).toEqual([1]);
    expect(hit?.expiresAt).toBe(2);
    await c.delete("smart-money-netflow.abc");
    expect(await c.get("smart-money-netflow.abc")).toBeUndefined();
  });

  it("returns undefined for missing keys and survives clear", async () => {
    const c = new DiskCache(dir);
    expect(await c.get("nope")).toBeUndefined();
    await c.set("k", { value: 1, storedAt: 0, expiresAt: 1 });
    await c.clear();
    expect(await c.get("k")).toBeUndefined();
    await c.set("k2", { value: 2, storedAt: 0, expiresAt: 1 });
    expect((await c.get("k2"))?.value).toBe(2);
  });
});
