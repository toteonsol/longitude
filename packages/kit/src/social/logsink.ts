import type { CallRecord, LogSink, Totals } from "@longitude/nansen";
import { emptyTotals, foldTotals, readRecentCalls as readRecentFile, readTotals as readTotalsFile } from "@longitude/nansen";
import { type Commands, getSocialStore, socialBackend } from "@longitude/social";

const KEEP = 5000;

/** Call log over the shared social store's commands (Convex, Redis or Upstash). Same keys as UpstashSink. */
export class CommandsSink implements LogSink {
  readonly name = "social-store";
  readonly durable = true;

  constructor(
    private readonly cmd: Commands,
    private readonly prefix = "nansen",
  ) {}

  private k(name: string): string {
    return `${this.prefix}:${name}`;
  }

  async write(r: CallRecord): Promise<void> {
    const c = this.cmd;
    await Promise.all([
      c.lpush(this.k("calls"), JSON.stringify(r)),
      c.incrby(this.k("credits"), Math.round(r.credits)),
      c.incrby(this.k("calls:count"), 1),
      c.incrby(this.k(r.cached ? "calls:cached" : r.ok ? "calls:api" : "calls:failed"), 1),
      c.hincrby(this.k("by_endpoint:credits"), r.endpoint, Math.round(r.credits)),
      c.hincrby(this.k("by_endpoint:calls"), r.endpoint, 1),
      c.hincrby(this.k("by_script:credits"), r.script, Math.round(r.credits)),
      c.hincrby(this.k("by_script:calls"), r.script, 1),
      c.set(this.k("last_at"), r.ts),
    ]);
    await c.ltrim(this.k("calls"), 0, KEEP - 1);
    if (r.credits_remaining !== undefined) await c.set(this.k("credits_remaining"), String(r.credits_remaining));
    if (!(await c.get(this.k("first_at")))) await c.set(this.k("first_at"), r.ts);
  }

  async totals(): Promise<Totals> {
    const c = this.cmd;
    const [credits, count, api, cached, failed, epCredits, epCalls, scCredits, scCalls, remaining, firstAt, lastAt] = await Promise.all([
      c.get(this.k("credits")),
      c.get(this.k("calls:count")),
      c.get(this.k("calls:api")),
      c.get(this.k("calls:cached")),
      c.get(this.k("calls:failed")),
      c.hgetall(this.k("by_endpoint:credits")),
      c.hgetall(this.k("by_endpoint:calls")),
      c.hgetall(this.k("by_script:credits")),
      c.hgetall(this.k("by_script:calls")),
      c.get(this.k("credits_remaining")),
      c.get(this.k("first_at")),
      c.get(this.k("last_at")),
    ]);
    const num = (v: string | null) => Number(v ?? 0);
    const merge = (a: Record<string, string>, b: Record<string, string>) => {
      const out: Totals["byEndpoint"] = {};
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) out[key] = { credits: Number(a[key] ?? 0), calls: Number(b[key] ?? 0) };
      return out;
    };
    const t: Totals = { ...emptyTotals(), credits: num(credits), calls: num(count), apiCalls: num(api), cachedCalls: num(cached), failedCalls: num(failed), byEndpoint: merge(epCredits, epCalls), byScript: merge(scCredits, scCalls) };
    if (remaining) t.creditsRemaining = Number(remaining);
    if (firstAt) t.firstAt = firstAt;
    if (lastAt) t.lastAt = lastAt;
    return t;
  }

  async recent(limit: number): Promise<CallRecord[]> {
    const rows = await this.cmd.lrange(this.k("calls"), 0, Math.max(0, limit - 1));
    const out: CallRecord[] = [];
    for (const r of rows) {
      try {
        out.push(JSON.parse(r) as CallRecord);
      } catch {
        /* skip */
      }
    }
    return out;
  }
}

const SHARED = new Set(["convex", "redis", "upstash"]);

/** True when a hosted store is configured, so call totals can be shared across deployments. */
export function hasSharedStore(): boolean {
  return SHARED.has(socialBackend());
}

/** The sink apps and seeds add when a hosted store exists. */
export function sharedSink(): LogSink | undefined {
  return hasSharedStore() ? new CommandsSink(getSocialStore().cmd) : undefined;
}

/** Totals for the store's counter: the shared store when configured, else the local JSONL log. */
export async function readTotals(): Promise<Totals> {
  const sink = sharedSink();
  if (sink?.totals) {
    try {
      const t = await sink.totals();
      if (t.calls > 0) return t;
    } catch {
      /* fall back to the local log */
    }
  }
  return readTotalsFile();
}

export async function readRecentCalls(limit = 50): Promise<CallRecord[]> {
  const sink = sharedSink();
  if (sink?.recent) {
    try {
      return await sink.recent(limit);
    } catch {
      /* fall back */
    }
  }
  return readRecentFile(limit);
}

export { foldTotals };
