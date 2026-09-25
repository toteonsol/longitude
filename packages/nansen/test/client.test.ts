import { describe, expect, it, vi } from "vitest";
import { MemoryCache } from "../src/cache";
import { NansenClient } from "../src/client";
import { CreditCapExceededError, NansenApiError, NansenConfigError } from "../src/errors";
import { Limiter } from "../src/limiter";
import { MemorySink } from "../src/logger";
import { mockFetch, ok } from "./helpers";

const fast = new Limiter(8, 0);

function client(fetchImpl: typeof fetch, extra: ConstructorParameters<typeof NansenClient>[0] = {}) {
  const sink = new MemorySink();
  const c = new NansenClient({
    apiKey: "test-key",
    script: "test",
    cache: new MemoryCache(),
    logger: [sink],
    limiter: fast,
    creditCap: 100,
    fetch: fetchImpl,
    ...extra,
  });
  return { c, sink };
}

describe("NansenClient.post", () => {
  it("sends apikey + JSON body and records the real credit cost from the header", async () => {
    const f = mockFetch([ok({ data: [{ token_symbol: "ETH" }], pagination: { is_last_page: true } }, 5, { "x-nansen-credits-remaining": "1995" })]);
    const { c, sink } = client(f);
    const res = await c.smartMoney.netflow({ chains: ["ethereum"] }, { tag: "t1" });
    expect(res.data?.[0]?.token_symbol).toBe("ETH");
    const call = f.calls[0]!;
    expect(call.url).toBe("https://api.nansen.ai/api/v1/smart-money/netflow");
    expect(call.init.method).toBe("POST");
    expect((call.init.headers as Record<string, string>).apikey).toBe("test-key");
    expect(JSON.parse(String(call.init.body))).toEqual({ chains: ["ethereum"] });
    expect(c.credits.spent).toBe(5);
    expect(c.creditsRemaining).toBe(1995);
    const rec = sink.records[0]!;
    expect(rec).toMatchObject({ endpoint: "/api/v1/smart-money/netflow", credits: 5, estimated: 5, ok: true, cached: false, tag: "t1", request_id: "req-test", credits_remaining: 1995 });
  });

  it("serves identical calls from cache and logs them at zero credits", async () => {
    const f = mockFetch([ok({ data: [] })]);
    const { c, sink } = client(f);
    await c.tgm.holders({ chain: "ethereum", token_address: "0xabc" });
    await c.tgm.holders({ token_address: "0xabc", chain: "ethereum" });
    expect(f.calls).toHaveLength(1);
    expect(sink.records[1]).toMatchObject({ cached: true, credits: 0 });
    await c.tgm.holders({ chain: "ethereum", token_address: "0xabc" }, { fresh: true });
    expect(f.calls).toHaveLength(2);
    expect(c.credits.spent).toBe(10);
  });

  it("uses the estimate when the credits header is absent", async () => {
    const f = mockFetch([{ status: 200, body: { data: [] } }]);
    const { c } = client(f);
    await c.profiler.pnlSummary({ wallet_address: "0x1", chain: "ethereum", date: { from: "2026-01-01", to: "2026-02-01" } });
    expect(c.credits.spent).toBe(1);
  });

  it("refuses before fetching when the credit cap would be exceeded", async () => {
    const f = mockFetch([ok({ data: [] }, 100)]);
    const { c, sink } = client(f, { creditCap: 120 });
    await c.profiler.labels({ address: "0x1", chain: "ethereum" });
    await expect(c.profiler.labels({ address: "0x2", chain: "ethereum" })).rejects.toBeInstanceOf(CreditCapExceededError);
    expect(f.calls).toHaveLength(1);
    expect(sink.records).toHaveLength(1);
  });

  it("premium_labels raises the estimate to 150", async () => {
    const f = mockFetch([ok({ data: [] }, 150)]);
    const { c } = client(f, { creditCap: 149 });
    await expect(c.tgm.holders({ chain: "ethereum", token_address: "0x", premium_labels: true })).rejects.toBeInstanceOf(CreditCapExceededError);
    expect(f.calls).toHaveLength(0);
  });

  it("retries 429 honoring Retry-After, then succeeds", async () => {
    const f = mockFetch([
      { status: 429, body: { code: "rate_limit_exceeded", message: "slow down", retry_after: 0 }, headers: { "retry-after": "0" } },
      ok({ data: [{ x: 1 }] }, 5),
    ]);
    const { c, sink } = client(f);
    const res = await c.smartMoney.holdings({ chains: ["solana"] });
    expect(res.data).toHaveLength(1);
    expect(f.calls).toHaveLength(2);
    expect(sink.records[0]).toMatchObject({ ok: true, attempts: 2, credits: 5 });
  });

  it("does not retry 422 and exposes the structured error", async () => {
    const f = mockFetch([{ status: 422, body: { code: "missing_field", message: "chain missing", param: "chain", request_id: "req-1", status: 422 } }]);
    const { c, sink } = client(f);
    const err = await c.tgm.flows({ chain: "ethereum", token_address: "0x", label: "smart_money", date: { from: "a", to: "b" } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NansenApiError);
    const e = err as NansenApiError;
    expect(e.status).toBe(422);
    expect(e.code).toBe("missing_field");
    expect(e.param).toBe("chain");
    expect(e.retryable).toBe(false);
    expect(f.calls).toHaveLength(1);
    expect(c.credits.spent).toBe(0);
    expect(c.credits.reserved).toBe(0);
    expect(sink.records[0]).toMatchObject({ ok: false, status: 422, error_code: "missing_field", request_id: "req-1" });
  });

  it("gives up after retries on 500 and releases the reservation", async () => {
    const f = mockFetch([{ status: 500, body: { code: "internal_error" } }]);
    const { c } = client(f, { retries: 2 });
    await expect(c.screener.tokens({ chains: ["base"] })).rejects.toBeInstanceOf(NansenApiError);
    expect(f.calls).toHaveLength(3);
    expect(c.credits.reserved).toBe(0);
  });

  it("serves a stale cache entry when the API keeps failing", async () => {
    const cache = new MemoryCache();
    const f = mockFetch([ok({ data: [{ old: true }] }), { status: 503, body: { code: "upstream_unavailable" } }]);
    const { c, sink } = client(f, { cache, ttlMs: 1, retries: 1 });
    await c.tgm.tokenInformation({ chain: "base", token_address: "0x", timeframe: "1d" });
    await new Promise((r) => setTimeout(r, 5));
    const res = await c.tgm.tokenInformation({ chain: "base", token_address: "0x", timeframe: "1d" });
    expect((res as { data: unknown }).data).toEqual([{ old: true }]);
    expect(sink.records.at(-1)).toMatchObject({ cached: true, stale: true, ok: true, error_code: "upstream_unavailable" });
  });

  it("throws a config error without an API key unless the cache can answer", async () => {
    const f = mockFetch([ok({ data: [] })]);
    const { c } = client(f, { apiKey: "" });
    await expect(c.smartMoney.netflow({ chains: ["ethereum"] })).rejects.toBeInstanceOf(NansenConfigError);
    expect(f.calls).toHaveLength(0);
  });

  it("times out slow requests", async () => {
    const slow = vi.fn((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }),
    ) as unknown as typeof fetch;
    const { c } = client(slow, { timeoutMs: 10, retries: 0 });
    await expect(c.account()).rejects.toMatchObject({ name: "NansenTimeoutError" });
  });
});

describe("pagination helpers", () => {
  it("walks pages until is_last_page and concatenates rows", async () => {
    const f = mockFetch([
      ok({ data: [{ i: 1 }, { i: 2 }], pagination: { page: 1, per_page: 2, is_last_page: false } }),
      ok({ data: [{ i: 3 }], pagination: { page: 2, per_page: 2, is_last_page: true } }),
    ]);
    const { c } = client(f);
    const rows = await c.all("/api/v1/smart-money/netflow", { chains: ["ethereum"] }, { perPage: 2 });
    expect(rows.map((r) => (r as unknown as { i: number }).i)).toEqual([1, 2, 3]);
    expect(JSON.parse(String(f.calls[0]!.init.body)).pagination).toEqual({ page: 1, per_page: 2 });
    expect(JSON.parse(String(f.calls[1]!.init.body)).pagination).toEqual({ page: 2, per_page: 2 });
  });

  it("stops on a short page when is_last_page is missing, and respects maxPages", async () => {
    const f = mockFetch([ok({ data: [{ i: 1 }] })]);
    const { c } = client(f);
    const rows = await c.all("/api/v1/tgm/holders", { chain: "ethereum", token_address: "0x" }, { perPage: 50, maxPages: 3 });
    expect(rows).toHaveLength(1);
    expect(f.calls).toHaveLength(1);
    const g = mockFetch([ok({ data: Array.from({ length: 2 }, (_, i) => ({ i })) })]);
    const { c: c2 } = client(g);
    const many = await c2.all("/api/v1/tgm/holders", { chain: "ethereum", token_address: "0x" }, { perPage: 2, maxPages: 3 });
    expect(many).toHaveLength(6);
    expect(g.calls).toHaveLength(3);
  });
});

describe("account", () => {
  it("GETs /api/v1/account without a body and never caches", async () => {
    const f = mockFetch([ok({ user_id: "u", plan: "pro", credits_remaining: 1900 }, 0)]);
    const { c } = client(f);
    const a = await c.account();
    const b = await c.account();
    expect(a.plan).toBe("pro");
    expect(b.credits_remaining).toBe(1900);
    expect(f.calls).toHaveLength(2);
    expect(f.calls[0]!.init.method).toBe("GET");
    expect(f.calls[0]!.init.body).toBeUndefined();
  });
});
