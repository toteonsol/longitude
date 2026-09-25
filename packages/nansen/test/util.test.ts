import { describe, expect, it } from "vitest";
import { cacheKey, hash53, lastDays, stableStringify } from "../src/util";

describe("stableStringify", () => {
  it("sorts keys recursively and drops undefined", () => {
    const a = stableStringify({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: undefined } });
    const b = stableStringify({ a: { d: [3, { y: 2, z: 1 }] }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"d":[3,{"y":2,"z":1}]},"b":1}');
  });
});

describe("cacheKey", () => {
  it("is stable across key order and readable", () => {
    const k1 = cacheKey("/api/v1/smart-money/netflow", { chains: ["ethereum"], filters: { a: 1, b: 2 } });
    const k2 = cacheKey("/api/v1/smart-money/netflow", { filters: { b: 2, a: 1 }, chains: ["ethereum"] });
    expect(k1).toBe(k2);
    expect(k1.startsWith("smart-money-netflow.")).toBe(true);
    expect(cacheKey("/api/v1beta1/tgm/historical-top-holders", {})).toMatch(/^tgm-historical-top-holders\./);
  });
  it("differs when the body differs", () => {
    expect(cacheKey("/x", { a: 1 })).not.toBe(cacheKey("/x", { a: 2 }));
  });
});

describe("hash53", () => {
  it("is deterministic and 14 hex chars", () => {
    expect(hash53("hello")).toBe(hash53("hello"));
    expect(hash53("hello")).toMatch(/^[0-9a-f]{14}$/);
    expect(hash53("hello")).not.toBe(hash53("hellp"));
  });
});

describe("lastDays", () => {
  it("returns an inclusive YYYY-MM-DD range", () => {
    const r = lastDays(7, new Date("2026-09-25T12:00:00Z"));
    expect(r).toEqual({ from: "2026-09-18", to: "2026-09-25" });
  });
});

describe("repo root resolution", () => {
  it("finds the monorepo root from inside a package and passes absolute paths through", async () => {
    const { findRepoRoot, resolveRepoPath } = await import("../src/util");
    const { existsSync } = await import("node:fs");
    const { join, isAbsolute } = await import("node:path");
    const root = await findRepoRoot();
    expect(existsSync(join(root, "pnpm-workspace.yaml"))).toBe(true);
    expect(await resolveRepoPath("data/x.jsonl")).toBe(join(root, "data/x.jsonl"));
    expect(await resolveRepoPath("/tmp/abs.jsonl")).toBe("/tmp/abs.jsonl");
    expect(isAbsolute(root)).toBe(true);
  });
});
