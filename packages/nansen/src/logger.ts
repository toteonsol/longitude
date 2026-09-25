import { isServerless, nowIso, resolveRepoPath } from "./util";

/** One line per API call. Written to every configured sink. */
export interface CallRecord {
  ts: string;
  script: string;
  endpoint: string;
  /** Credits actually charged (from X-Nansen-Credits-Used); 0 for cached or failed calls. */
  credits: number;
  /** Our pre-call estimate from the credit table. */
  estimated: number;
  ms: number;
  status: number | null;
  ok: boolean;
  cached: boolean;
  /** Served an expired cache entry because the API failed. */
  stale?: boolean;
  attempts?: number;
  request_id?: string;
  error_code?: string;
  error?: string;
  /** From X-Nansen-Credits-Remaining, when present. */
  credits_remaining?: number;
  tag?: string;
}

export interface Bucket {
  credits: number;
  calls: number;
}

export interface Totals {
  credits: number;
  calls: number;
  apiCalls: number;
  cachedCalls: number;
  failedCalls: number;
  byEndpoint: Record<string, Bucket>;
  byScript: Record<string, Bucket>;
  creditsRemaining?: number;
  firstAt?: string;
  lastAt?: string;
}

export interface LogSink {
  readonly name: string;
  /** Whether totals from this sink survive process restarts (file, redis). */
  readonly durable: boolean;
  write(record: CallRecord): void | Promise<void>;
  totals?(): Promise<Totals>;
  recent?(limit: number): Promise<CallRecord[]>;
}

export function emptyTotals(): Totals {
  return { credits: 0, calls: 0, apiCalls: 0, cachedCalls: 0, failedCalls: 0, byEndpoint: {}, byScript: {} };
}

function bump(map: Record<string, Bucket>, key: string, credits: number): void {
  const b = (map[key] ??= { credits: 0, calls: 0 });
  b.credits += credits;
  b.calls += 1;
}

export function foldTotals(records: Iterable<CallRecord>, into: Totals = emptyTotals()): Totals {
  for (const r of records) {
    into.calls += 1;
    if (r.cached) into.cachedCalls += 1;
    else if (r.ok) into.apiCalls += 1;
    else into.failedCalls += 1;
    into.credits += r.credits;
    bump(into.byEndpoint, r.endpoint, r.credits);
    bump(into.byScript, r.script, r.credits);
    if (r.credits_remaining !== undefined) into.creditsRemaining = r.credits_remaining;
    if (!into.firstAt || r.ts < into.firstAt) into.firstAt = r.ts;
    if (!into.lastAt || r.ts > into.lastAt) into.lastAt = r.ts;
  }
  return into;
}

export class MemorySink implements LogSink {
  readonly name = "memory";
  readonly durable = false;
  readonly records: CallRecord[] = [];
  constructor(private readonly maxRecords = 5000) {}

  write(record: CallRecord): void {
    this.records.push(record);
    if (this.records.length > this.maxRecords) this.records.splice(0, this.records.length - this.maxRecords);
  }
  async totals(): Promise<Totals> {
    return foldTotals(this.records);
  }
  async recent(limit: number): Promise<CallRecord[]> {
    return this.records.slice(-limit);
  }
}

/** Human-readable one-liner per call on stderr. Handy in seed scripts. */
export class ConsoleSink implements LogSink {
  readonly name = "console";
  readonly durable = false;
  write(r: CallRecord): void {
    const ep = r.endpoint.replace(/^\/api\/(v1beta1|v1)\//, "");
    const state = r.cached ? (r.stale ? "STALE" : "cache") : r.ok ? `${r.credits}cr` : `FAIL ${r.status ?? "net"}${r.error_code ? ` ${r.error_code}` : ""}`;
    const rem = r.credits_remaining !== undefined ? ` rem=${r.credits_remaining}` : "";
    console.error(`[nansen] ${state.padStart(6)} ${String(r.ms).padStart(5)}ms ${ep}${r.tag ? ` (${r.tag})` : ""}${rem}`);
  }
}

/**
 * Append-only JSONL file. Default: <monorepo root>/data/nansen-calls.jsonl (override with
 * NANSEN_LOG_PATH). Relative paths resolve against the monorepo root so every app and script
 * appends to the same log.
 */
export class FileSink implements LogSink {
  readonly name = "file";
  readonly durable = true;
  private chain: Promise<void> = Promise.resolve();
  private resolved: Promise<string> | undefined;

  constructor(readonly path: string = process.env.NANSEN_LOG_PATH || "data/nansen-calls.jsonl") {}

  /** Absolute path of the log file; its directory is created on first use. */
  file(): Promise<string> {
    if (!this.resolved) {
      this.resolved = (async () => {
        const abs = await resolveRepoPath(this.path);
        const fs = await import("node:fs/promises");
        const pathMod = await import("node:path");
        await fs.mkdir(pathMod.dirname(abs), { recursive: true });
        return abs;
      })();
    }
    return this.resolved;
  }

  write(record: CallRecord): Promise<void> {
    const next = this.chain
      .catch(() => {})
      .then(async () => {
        const fs = await import("node:fs/promises");
        await fs.appendFile(await this.file(), JSON.stringify(record) + "\n");
      });
    this.chain = next;
    return next;
  }

  async readAll(): Promise<CallRecord[]> {
    await this.chain.catch(() => {});
    try {
      const fs = await import("node:fs/promises");
      const raw = await fs.readFile(await this.file(), "utf8");
      const out: CallRecord[] = [];
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
          out.push(JSON.parse(line) as CallRecord);
        } catch {
          /* skip torn line */
        }
      }
      return out;
    } catch {
      return [];
    }
  }

  async totals(): Promise<Totals> {
    return foldTotals(await this.readAll());
  }

  async recent(limit: number): Promise<CallRecord[]> {
    return (await this.readAll()).slice(-limit);
  }
}

export interface UpstashSinkOptions {
  url?: string;
  token?: string;
  prefix?: string;
  fetch?: typeof fetch;
  /** Keep only the last N raw records in the list (totals are counters and are never trimmed). */
  keepRecent?: number;
}

/**
 * Upstash Redis over its REST API (plain fetch, no SDK). Lets the deployed store show one live
 * credit total across every Vercel app and the Railway cron. Env: UPSTASH_REDIS_REST_URL/TOKEN.
 */
export class UpstashSink implements LogSink {
  readonly name = "upstash";
  readonly durable = true;
  private readonly url: string;
  private readonly token: string;
  private readonly prefix: string;
  private readonly fetchImpl: typeof fetch;
  private readonly keepRecent: number;

  constructor(opts: UpstashSinkOptions = {}) {
    const url = opts.url ?? process.env.UPSTASH_REDIS_REST_URL;
    const token = opts.token ?? process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error("UpstashSink needs UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN");
    this.url = url.replace(/\/$/, "");
    this.token = token;
    this.prefix = opts.prefix ?? "nansen";
    this.fetchImpl = opts.fetch ?? fetch;
    this.keepRecent = opts.keepRecent ?? 5000;
  }

  static available(): boolean {
    return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  }

  private k(name: string): string {
    return `${this.prefix}:${name}`;
  }

  private async pipeline(commands: (string | number)[][]): Promise<unknown[]> {
    const res = await this.fetchImpl(`${this.url}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify(commands),
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const rows = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    return rows.map((r) => r.result);
  }

  async write(r: CallRecord): Promise<void> {
    const cmds: (string | number)[][] = [
      ["RPUSH", this.k("calls"), JSON.stringify(r)],
      ["LTRIM", this.k("calls"), -this.keepRecent, -1],
      ["INCRBYFLOAT", this.k("credits"), r.credits],
      ["INCR", this.k("calls:count")],
      ["INCR", this.k(r.cached ? "calls:cached" : r.ok ? "calls:api" : "calls:failed")],
      ["HINCRBYFLOAT", this.k("by_endpoint:credits"), r.endpoint, r.credits],
      ["HINCRBY", this.k("by_endpoint:calls"), r.endpoint, 1],
      ["HINCRBYFLOAT", this.k("by_script:credits"), r.script, r.credits],
      ["HINCRBY", this.k("by_script:calls"), r.script, 1],
      ["SET", this.k("last_at"), r.ts],
      ["SETNX", this.k("first_at"), r.ts],
    ];
    if (r.credits_remaining !== undefined) cmds.push(["SET", this.k("credits_remaining"), r.credits_remaining]);
    await this.pipeline(cmds);
  }

  async totals(): Promise<Totals> {
    const [credits, count, api, cached, failed, epCredits, epCalls, scCredits, scCalls, remaining, firstAt, lastAt] =
      await this.pipeline([
        ["GET", this.k("credits")],
        ["GET", this.k("calls:count")],
        ["GET", this.k("calls:api")],
        ["GET", this.k("calls:cached")],
        ["GET", this.k("calls:failed")],
        ["HGETALL", this.k("by_endpoint:credits")],
        ["HGETALL", this.k("by_endpoint:calls")],
        ["HGETALL", this.k("by_script:credits")],
        ["HGETALL", this.k("by_script:calls")],
        ["GET", this.k("credits_remaining")],
        ["GET", this.k("first_at")],
        ["GET", this.k("last_at")],
      ]);
    const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
    const hash = (v: unknown): Record<string, number> => {
      const out: Record<string, number> = {};
      if (Array.isArray(v)) for (let i = 0; i + 1 < v.length; i += 2) out[String(v[i])] = Number(v[i + 1]);
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) out[k] = Number(x);
      return out;
    };
    const merge = (c: Record<string, number>, n: Record<string, number>): Record<string, Bucket> => {
      const out: Record<string, Bucket> = {};
      for (const key of new Set([...Object.keys(c), ...Object.keys(n)])) out[key] = { credits: c[key] ?? 0, calls: n[key] ?? 0 };
      return out;
    };
    const t: Totals = {
      credits: num(credits),
      calls: num(count),
      apiCalls: num(api),
      cachedCalls: num(cached),
      failedCalls: num(failed),
      byEndpoint: merge(hash(epCredits), hash(epCalls)),
      byScript: merge(hash(scCredits), hash(scCalls)),
    };
    if (remaining !== null && remaining !== undefined) t.creditsRemaining = Number(remaining);
    if (typeof firstAt === "string") t.firstAt = firstAt;
    if (typeof lastAt === "string") t.lastAt = lastAt;
    return t;
  }

  async recent(limit: number): Promise<CallRecord[]> {
    const [rows] = await this.pipeline([["LRANGE", this.k("calls"), -limit, -1]]);
    if (!Array.isArray(rows)) return [];
    return rows.map((s) => JSON.parse(String(s)) as CallRecord);
  }
}

export class CallLogger {
  private pending = new Set<Promise<void>>();

  constructor(
    readonly sinks: LogSink[],
    readonly script: string,
  ) {}

  record(partial: Omit<CallRecord, "ts" | "script"> & Partial<Pick<CallRecord, "ts" | "script">>): CallRecord {
    const rec: CallRecord = { ts: nowIso(), script: this.script, ...partial };
    for (const sink of this.sinks) {
      let p: Promise<void>;
      try {
        p = Promise.resolve(sink.write(rec));
      } catch (err) {
        p = Promise.reject(err);
      }
      const tracked: Promise<void> = p
        .catch((err: unknown) => {
          console.error(`[nansen] log sink "${sink.name}" failed: ${err instanceof Error ? err.message : String(err)}`);
        })
        .finally(() => this.pending.delete(tracked));
      this.pending.add(tracked);
    }
    return rec;
  }

  /** Wait for every sink write to settle. Call at the end of scripts. */
  async flush(): Promise<void> {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  private pick(): LogSink | undefined {
    return this.sinks.find((s) => s.durable && s.totals) ?? this.sinks.find((s) => s.totals);
  }

  /** Totals from the most durable sink available (upstash > file > memory). */
  async totals(): Promise<Totals> {
    await this.flush();
    const sink = this.pick();
    return sink?.totals ? sink.totals() : emptyTotals();
  }

  async recent(limit = 50): Promise<CallRecord[]> {
    await this.flush();
    const sink = this.sinks.find((s) => s.durable && s.recent) ?? this.sinks.find((s) => s.recent);
    return sink?.recent ? sink.recent(limit) : [];
  }
}

/** Script label for log lines: NANSEN_SCRIPT, else the entry file's basename, else "unknown". */
export function detectScriptName(): string {
  if (process.env.NANSEN_SCRIPT) return process.env.NANSEN_SCRIPT;
  const entry = process.argv[1];
  if (entry) {
    const base = entry.split(/[\\/]/).pop() ?? entry;
    return base.replace(/\.(m|c)?(t|j)sx?$/, "");
  }
  return "unknown";
}

/**
 * Memory sink always (in-process totals), file sink where the filesystem is writable, Upstash
 * when configured, console when asked.
 */
export function defaultSinks(opts: { console?: boolean } = {}): LogSink[] {
  const sinks: LogSink[] = [new MemorySink()];
  if (opts.console) sinks.push(new ConsoleSink());
  if (!isServerless()) sinks.push(new FileSink());
  if (UpstashSink.available()) sinks.push(new UpstashSink());
  return sinks;
}

/**
 * Read totals without constructing a client: what the store's credit counter calls.
 * Upstash when configured, else the local JSONL file.
 */
export async function readTotals(): Promise<Totals> {
  if (UpstashSink.available()) return new UpstashSink().totals();
  return new FileSink().totals();
}

export async function readRecentCalls(limit = 50): Promise<CallRecord[]> {
  if (UpstashSink.available()) return new UpstashSink().recent(limit);
  return new FileSink().recent(limit);
}
