import { buildApi, type NansenApi } from "./api";
import { type Cache, type CacheEntry, NoCache, defaultCache } from "./cache";
import { CreditCap, creditCapFromEnv, estimateCredits } from "./credits";
import {
  CreditCapExceededError,
  NansenApiError,
  NansenConfigError,
  NansenTimeoutError,
  type NansenErrorBody,
} from "./errors";
import { Limiter, type Plan, limiterForPlan } from "./limiter";
import { CallLogger, type LogSink, defaultSinks, detectScriptName } from "./logger";
import type { GetEndpoint, GetResponseOf, PostEndpoint, RequestBody, ResponseOf, RowOf } from "./paths";
import { backoffMs, cacheKey, sleep } from "./util";

export const DEFAULT_BASE_URL = "https://api.nansen.ai";
export const DEFAULT_TTL_MS = 5 * 60_000;
export const DEFAULT_TIMEOUT_MS = 45_000;
export const DEFAULT_RETRIES = 3;
export const MAX_PER_PAGE = 1000;
export const DEFAULT_PER_PAGE = 100;

export interface NansenClientOptions {
  /** Defaults to process.env.NANSEN_API_KEY. */
  apiKey?: string;
  baseUrl?: string;
  /** Label for the call log, e.g. "seed:rookie-scout" or "app:two-faced". */
  script?: string;
  /** Per-process spend ceiling. `null` disables it. Defaults to NANSEN_CREDIT_CAP or 500. */
  creditCap?: number | null;
  /** Response cache. `false` disables. Defaults to disk locally, memory on serverless. */
  cache?: Cache | false;
  /** Default cache TTL for every call. */
  ttlMs?: number;
  /** Serve an expired cache entry when the API fails after retries. Default true. */
  staleIfError?: boolean;
  /** Treat every call as fresh: skip cache reads but still write, so other clients sharing the cache benefit. */
  fresh?: boolean;
  /** A logger, a list of sinks, or `false` to disable logging. */
  logger?: CallLogger | LogSink[] | false;
  /** Also print one line per call to stderr. */
  logToConsole?: boolean;
  retries?: number;
  timeoutMs?: number;
  /** Sets rate-limiter defaults. */
  plan?: Plan;
  limiter?: Limiter;
  fetch?: typeof fetch;
}

export interface CallOptions {
  /** Cache TTL for this call; 0 disables caching for it. */
  ttlMs?: number;
  /** Skip the cache read (still writes the fresh result). What "refresh live" buttons pass. */
  fresh?: boolean;
  retries?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Free-form label stored on the log line, e.g. "prospect:0xabc". */
  tag?: string;
}

export interface PageOptions extends CallOptions {
  perPage?: number;
  maxPages?: number;
  startPage?: number;
}

interface Sent {
  data: unknown;
  headers: Headers;
  status: number;
}

function numberHeader(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name);
  if (raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof NansenApiError) return err.retryable;
  if (err instanceof NansenTimeoutError) return true;
  if (err instanceof CreditCapExceededError || err instanceof NansenConfigError) return false;
  if (err && typeof err === "object" && (err as { name?: string }).name === "AbortError") return false;
  // undici surfaces network failures as TypeError("fetch failed")
  return err instanceof TypeError;
}

export class NansenClient {
  readonly credits: CreditCap;
  readonly log: CallLogger;
  readonly cache: Cache;
  readonly script: string;
  readonly baseUrl: string;
  readonly ttlMs: number;
  /** Credits left on the account, from the last response header seen. */
  creditsRemaining: number | undefined;

  readonly smartMoney: NansenApi["smartMoney"];
  readonly profiler: NansenApi["profiler"];
  readonly tgm: NansenApi["tgm"];
  readonly screener: NansenApi["screener"];
  readonly perps: NansenApi["perps"];
  readonly search: NansenApi["search"];
  readonly predictionMarket: NansenApi["predictionMarket"];
  readonly portfolio: NansenApi["portfolio"];
  readonly misc: NansenApi["misc"];

  private readonly apiKey: string | undefined;
  private readonly retries: number;
  private readonly timeoutMs: number;
  private readonly staleIfError: boolean;
  private readonly freshDefault: boolean;
  private readonly limiter: Limiter;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: NansenClientOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.NANSEN_API_KEY;
    this.baseUrl = (opts.baseUrl ?? process.env.NANSEN_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.script = opts.script ?? detectScriptName();
    this.credits = new CreditCap(opts.creditCap === undefined ? creditCapFromEnv() : opts.creditCap);
    this.cache = opts.cache === false ? new NoCache() : (opts.cache ?? defaultCache());
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.staleIfError = opts.staleIfError ?? true;
    this.freshDefault = opts.fresh ?? false;
    this.retries = opts.retries ?? DEFAULT_RETRIES;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.limiter = opts.limiter ?? limiterForPlan(opts.plan ?? (process.env.NANSEN_PLAN === "pro" ? "pro" : "free"));
    this.fetchImpl = opts.fetch ?? fetch;
    this.log =
      opts.logger instanceof CallLogger
        ? opts.logger
        : new CallLogger(
            opts.logger === false ? [] : Array.isArray(opts.logger) ? opts.logger : defaultSinks({ console: opts.logToConsole }),
            this.script,
          );

    const api = buildApi(this);
    this.smartMoney = api.smartMoney;
    this.profiler = api.profiler;
    this.tgm = api.tgm;
    this.screener = api.screener;
    this.perps = api.perps;
    this.search = api.search;
    this.predictionMarket = api.predictionMarket;
    this.portfolio = api.portfolio;
    this.misc = api.misc;
  }

  /** Typed POST. `path` is the full path, e.g. "/api/v1/smart-money/netflow". */
  post<P extends PostEndpoint>(path: P, body: RequestBody<P>, opts: CallOptions = {}): Promise<ResponseOf<P>> {
    return this.request(path, "POST", body, opts) as Promise<ResponseOf<P>>;
  }

  /** Typed GET for the few GET endpoints (account, token-sectors). */
  get<P extends GetEndpoint>(path: P, opts: CallOptions = {}): Promise<GetResponseOf<P>> {
    return this.request(path, "GET", undefined, opts) as Promise<GetResponseOf<P>>;
  }

  /** Plan + remaining credits. Free (0 credits), never cached. */
  account(): Promise<GetResponseOf<"/api/v1/account">> {
    return this.get("/api/v1/account", { ttlMs: 0 });
  }

  /** Iterate pages of a paginated endpoint. Stops at `is_last_page`, a short page, or `maxPages`. */
  async *pages<P extends PostEndpoint>(path: P, body: RequestBody<P>, opts: PageOptions = {}): AsyncGenerator<ResponseOf<P>> {
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, opts.perPage ?? DEFAULT_PER_PAGE));
    const maxPages = opts.maxPages ?? 10;
    let page = opts.startPage ?? 1;
    for (let i = 0; i < maxPages; i++, page++) {
      const merged = { ...(body as object), pagination: { page, per_page: perPage } } as RequestBody<P>;
      const res = await this.post(path, merged, opts);
      yield res;
      const info = (res as { pagination?: { is_last_page?: boolean } }).pagination;
      const rows = (res as { data?: unknown[] }).data;
      if (info?.is_last_page === true) break;
      if (!Array.isArray(rows) || rows.length === 0) break;
      if (info?.is_last_page === undefined && rows.length < perPage) break;
    }
  }

  /** Collect every row across pages (bounded by `maxPages`, default 10). */
  async all<P extends PostEndpoint>(path: P, body: RequestBody<P>, opts: PageOptions = {}): Promise<RowOf<P>[]> {
    const out: RowOf<P>[] = [];
    for await (const page of this.pages(path, body, opts)) {
      const rows = (page as { data?: RowOf<P>[] }).data;
      if (Array.isArray(rows)) out.push(...rows);
    }
    return out;
  }

  /** Estimated cost of a call before making it. */
  estimate(path: string, body?: unknown): number {
    return estimateCredits(path, body);
  }

  private async request(path: string, method: "GET" | "POST", body: unknown, opts: CallOptions): Promise<unknown> {
    const ttl = opts.ttlMs ?? this.ttlMs;
    const useCache = ttl > 0 && !(this.cache instanceof NoCache);
    const key = cacheKey(path, method === "GET" ? null : body);
    let cached: CacheEntry | undefined;

    if (useCache) {
      cached = await this.cache.get(key).catch(() => undefined);
      if (cached && !(opts.fresh ?? this.freshDefault) && cached.expiresAt > Date.now()) {
        this.log.record({ endpoint: path, credits: 0, estimated: 0, ms: 0, status: null, ok: true, cached: true, tag: opts.tag });
        return cached.value;
      }
    }

    if (!this.apiKey) {
      throw new NansenConfigError(
        "NANSEN_API_KEY is not set. Add it to .env (see .env.example) or pass { apiKey } to createNansen().",
      );
    }

    const estimated = estimateCredits(path, body);
    this.credits.reserve(estimated, path);

    const started = Date.now();
    const maxAttempts = (opts.retries ?? this.retries) + 1;
    let attempt = 0;
    let lastErr: unknown;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const { data, headers, status } = await this.limiter.run(() => this.send(path, method, body, opts));
        const actual = numberHeader(headers, "x-nansen-credits-used") ?? estimated;
        const remaining = numberHeader(headers, "x-nansen-credits-remaining");
        if (remaining !== undefined) this.creditsRemaining = remaining;
        this.credits.commit(estimated, actual);
        if (useCache) {
          const now = Date.now();
          await this.cache.set(key, { value: data, storedAt: now, expiresAt: now + ttl, endpoint: path }).catch(() => {});
        }
        this.log.record({
          endpoint: path,
          credits: actual,
          estimated,
          ms: Date.now() - started,
          status,
          ok: true,
          cached: false,
          attempts: attempt,
          request_id: headers.get("x-request-id") ?? undefined,
          credits_remaining: remaining,
          tag: opts.tag,
        });
        return data;
      } catch (err) {
        lastErr = err;
        if (!isRetryable(err) || attempt >= maxAttempts) break;
        const retryAfter = err instanceof NansenApiError ? err.retryAfterSec : undefined;
        const wait = retryAfter !== undefined ? retryAfter * 1000 : backoffMs(attempt - 1);
        await sleep(wait, opts.signal);
      }
    }

    this.credits.release(estimated);
    const apiErr = lastErr instanceof NansenApiError ? lastErr : undefined;
    const base = {
      endpoint: path,
      credits: 0,
      estimated,
      ms: Date.now() - started,
      status: apiErr?.status ?? null,
      attempts: attempt,
      request_id: apiErr?.requestId,
      error_code: apiErr?.code,
      error: lastErr instanceof Error ? lastErr.message : String(lastErr),
      tag: opts.tag,
    };

    if (this.staleIfError && cached) {
      this.log.record({ ...base, ok: true, cached: true, stale: true });
      return cached.value;
    }
    this.log.record({ ...base, ok: false, cached: false });
    throw lastErr;
  }

  private async send(path: string, method: "GET" | "POST", body: unknown, opts: CallOptions): Promise<Sent> {
    const controller = new AbortController();
    const timeoutMs = opts.timeoutMs ?? this.timeoutMs;
    const timeoutErr = new NansenTimeoutError(path, timeoutMs);
    const timer = setTimeout(() => controller.abort(timeoutErr), timeoutMs);
    const onAbort = () => controller.abort(opts.signal?.reason);
    opts.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const res = await this.fetchImpl(this.baseUrl + path, {
        method,
        headers: {
          apikey: this.apiKey ?? "",
          accept: "application/json",
          ...(method === "POST" ? { "content-type": "application/json" } : {}),
          "user-agent": "longitude/0.1 (+https://github.com/nansen-longitude)",
        },
        body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        json = undefined;
      }
      if (!res.ok) {
        throw new NansenApiError(path, res.status, (json as NansenErrorBody | undefined) ?? text, res.headers.get("retry-after"));
      }
      return { data: json, headers: res.headers, status: res.status };
    } catch (err) {
      if (controller.signal.aborted && controller.signal.reason === timeoutErr) throw timeoutErr;
      throw err;
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    }
  }
}

export function createNansen(opts: NansenClientOptions = {}): NansenClient {
  return new NansenClient(opts);
}

const singletons = new Map<string, NansenClient>();

/** One client per script label per process. What Next.js route handlers and server components use. */
export function getNansen(script: string, opts: Omit<NansenClientOptions, "script"> = {}): NansenClient {
  let c = singletons.get(script);
  if (!c) {
    c = new NansenClient({ ...opts, script });
    singletons.set(script, c);
  }
  return c;
}
