import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CallLogger, FileSink, MemorySink, UpstashSink, foldTotals, type CallRecord } from "../src/logger";

const rec = (over: Partial<CallRecord> = {}): CallRecord => ({
  ts: "2026-09-25T10:00:00.000Z",
  script: "seed:test",
  endpoint: "/api/v1/smart-money/netflow",
  credits: 5,
  estimated: 5,
  ms: 100,
  status: 200,
  ok: true,
  cached: false,
  ...over,
});

describe("foldTotals", () => {
  it("sums credits and buckets by endpoint and script", () => {
    const t = foldTotals([
      rec(),
      rec({ credits: 0, cached: true, status: null, ts: "2026-09-25T11:00:00.000Z" }),
      rec({ endpoint: "/api/v1/tgm/holders", script: "app:x", credits: 150, credits_remaining: 1234 }),
      rec({ ok: false, credits: 0, status: 500 }),
    ]);
    expect(t.credits).toBe(155);
    expect(t.calls).toBe(4);
    expect(t.apiCalls).toBe(2);
    expect(t.cachedCalls).toBe(1);
    expect(t.failedCalls).toBe(1);
    expect(t.byEndpoint["/api/v1/smart-money/netflow"]).toEqual({ credits: 5, calls: 3 });
    expect(t.byScript["app:x"]).toEqual({ credits: 150, calls: 1 });
    expect(t.creditsRemaining).toBe(1234);
    expect(t.firstAt).toBe("2026-09-25T10:00:00.000Z");
    expect(t.lastAt).toBe("2026-09-25T11:00:00.000Z");
  });
});

describe("FileSink", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "nansen-log-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("appends JSONL in order and folds totals", async () => {
    const sink = new FileSink(join(dir, "nested", "calls.jsonl"));
    const logger = new CallLogger([sink], "seed:test");
    logger.record({ endpoint: "/a", credits: 5, estimated: 5, ms: 1, status: 200, ok: true, cached: false });
    logger.record({ endpoint: "/b", credits: 1, estimated: 1, ms: 1, status: 200, ok: true, cached: false });
    await logger.flush();
    const all = await sink.readAll();
    expect(all.map((r) => r.endpoint)).toEqual(["/a", "/b"]);
    expect(all[0]?.script).toBe("seed:test");
    const t = await logger.totals();
    expect(t.credits).toBe(6);
    expect((await logger.recent(1))[0]?.endpoint).toBe("/b");
  });
});

describe("UpstashSink", () => {
  it("writes a pipeline of counters and reads totals back", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const cmds = JSON.parse(String(init?.body)) as string[][];
      if (cmds[0]?.[0] === "RPUSH") return new Response(JSON.stringify(cmds.map(() => ({ result: 1 }))));
      // totals read
      return new Response(
        JSON.stringify([
          { result: "155" },
          { result: "4" },
          { result: "2" },
          { result: "1" },
          { result: "1" },
          { result: ["/a", "150", "/b", "5"] },
          { result: ["/a", "1", "/b", "3"] },
          { result: ["seed:x", "155"] },
          { result: ["seed:x", "4"] },
          { result: "1000" },
          { result: "2026-09-25T10:00:00.000Z" },
          { result: "2026-09-25T11:00:00.000Z" },
        ]),
      );
    });
    const sink = new UpstashSink({ url: "https://example.upstash.io/", token: "t", fetch: fetchMock as unknown as typeof fetch });
    await sink.write(rec({ credits_remaining: 1000 }));
    const first = fetchMock.mock.calls[0]!;
    expect(String(first[0])).toBe("https://example.upstash.io/pipeline");
    const cmds = JSON.parse(String(first[1]?.body)) as (string | number)[][];
    expect(cmds[0]?.[0]).toBe("RPUSH");
    expect(cmds.find((c) => c[0] === "INCRBYFLOAT")?.[2]).toBe(5);
    expect(cmds.find((c) => c[0] === "SET" && c[1] === "nansen:credits_remaining")?.[2]).toBe(1000);
    const t = await sink.totals();
    expect(t.credits).toBe(155);
    expect(t.byEndpoint["/a"]).toEqual({ credits: 150, calls: 1 });
    expect(t.byScript["seed:x"]).toEqual({ credits: 155, calls: 4 });
    expect(t.creditsRemaining).toBe(1000);
  });
});

describe("CallLogger", () => {
  it("keeps going when a sink throws", async () => {
    const bad = { name: "bad", durable: false, write: () => { throw new Error("boom"); } };
    const mem = new MemorySink();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = new CallLogger([bad, mem], "s");
    logger.record({ endpoint: "/a", credits: 1, estimated: 1, ms: 1, status: 200, ok: true, cached: false });
    await logger.flush();
    expect(mem.records).toHaveLength(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
