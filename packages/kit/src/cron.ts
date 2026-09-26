import { AsyncLocalStorage } from "node:async_hooks";
import { type NansenClient, createNansen, defaultSinks } from "@longitude/nansen";
import { pushSnapshot } from "@longitude/social";
import { setDeepScope } from "./deep";
import { sharedSink } from "./social/logsink";

const deepScope = new AsyncLocalStorage<boolean>();
setDeepScope(deepScope);

/** Seconds between the fan-out's app starts, so ten builders don't all hit Nansen in the same second. */
const STAGGER_MS = 4_000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}` || new URL(req.url).searchParams.get("secret") === secret;
}

/**
 * `export const { GET } = createCronSeedRoute("rewind", buildRewind)` in `app/api/cron/seed/route.ts`.
 * Re-runs the app's builder with fresh Nansen calls and pushes the snapshot to Convex, where every
 * deployment reads it. Vercel Cron (or anything holding CRON_SECRET) calls it.
 *
 * It builds in deep mode by default, the same cut the seeds publish, so the overnight refresh never
 * thins the live apps. `?deep=0` runs the lighter build instead.
 */
export function createCronSeedRoute<T>(app: string, build: (nansen: NansenClient) => Promise<T>, name = "main") {
  async function GET(req: Request): Promise<Response> {
    if (!authorized(req)) return json({ ok: false, error: "unauthorized" }, 401);
    const shared = sharedSink();
    const nansen = createNansen({
      script: `cron:${app}`,
      fresh: true,
      cache: false,
      creditCap: Number(process.env.NANSEN_CREDIT_CAP ?? 150),
      logger: shared ? [...defaultSinks(), shared] : undefined,
    });
    const deep = new URL(req.url).searchParams.get("deep") !== "0";
    const started = Date.now();
    try {
      const data = await deepScope.run(deep, () => build(nansen));
      const generatedAt = new Date().toISOString();
      const snapshot = { app, name, generatedAt, credits: nansen.credits.spent, sample: false, data };
      const pushed = await pushSnapshot({ app, name, json: JSON.stringify(snapshot), generatedAt, credits: nansen.credits.spent, sample: false });
      await nansen.log.flush();
      return json({ ok: true, app, deep, credits: nansen.credits.spent, calls: nansen.credits.calls, pushed, seconds: Math.round((Date.now() - started) / 1000) });
    } catch (err) {
      await nansen.log.flush();
      return json({ ok: false, app, error: err instanceof Error ? err.message : String(err), seconds: Math.round((Date.now() - started) / 1000) }, 500);
    }
  }
  return { GET };
}

/** The store's job: trigger every app's seed route, a few seconds apart, and report. `?deep=0` passes through. */
export function createCronFanoutRoute(targets: { id: string; url: string }[]) {
  async function GET(req: Request): Promise<Response> {
    if (!authorized(req)) return json({ ok: false, error: "unauthorized" }, 401);
    const secret = process.env.CRON_SECRET ?? "";
    const light = new URL(req.url).searchParams.get("deep") === "0";
    const started = Date.now();
    const results = await Promise.allSettled(
      targets.map(async (t, i) => {
        await new Promise((resolve) => setTimeout(resolve, i * STAGGER_MS));
        const res = await fetch(`${t.url.replace(/\/$/, "")}/api/cron/seed${light ? "?deep=0" : ""}`, {
          headers: { authorization: `Bearer ${secret}` },
          cache: "no-store",
        });
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        return { id: t.id, status: res.status, ...body };
      }),
    );
    const rows = results.map((r, i) => (r.status === "fulfilled" ? r.value : { id: targets[i]?.id, ok: false, error: String(r.reason) }));
    return json({ ok: rows.every((r) => (r as { ok?: boolean }).ok), seconds: Math.round((Date.now() - started) / 1000), apps: rows });
  }
  return { GET };
}
