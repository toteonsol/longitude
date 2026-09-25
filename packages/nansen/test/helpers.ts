import { vi } from "vitest";

export interface MockResponseSpec {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

/** A fetch mock that replays a queue of responses (last one repeats). */
export function mockFetch(queue: MockResponseSpec[]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const spec = queue.length > 1 ? queue.shift()! : queue[0]!;
    const headers = new Headers({ "content-type": "application/json", ...(spec.headers ?? {}) });
    return new Response(spec.body === undefined ? "" : JSON.stringify(spec.body), { status: spec.status ?? 200, headers });
  });
  return Object.assign(fn as unknown as typeof fetch, { calls });
}

export const ok = (body: unknown, credits = 5, extra: Record<string, string> = {}): MockResponseSpec => ({
  status: 200,
  body,
  headers: { "x-nansen-credits-used": String(credits), "x-request-id": "req-test", ...extra },
});
