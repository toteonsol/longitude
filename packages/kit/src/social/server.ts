import { getSocialStore, isValidId, socialBackend } from "@longitude/social";
import type { FeedEventType, Identity } from "@longitude/social/types";
import { UID_COOKIE, UID_HEADER } from "./identity";

type Ctx = { params: Promise<{ op: string }> };

const EVENT_TYPES = new Set<FeedEventType>(["visit", "draft", "call", "score", "watch", "react", "share", "stamp", "collect", "custom"]);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

function uidFrom(req: Request): string | undefined {
  const h = req.headers.get(UID_HEADER);
  if (isValidId(h)) return h;
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|; )${UID_COOKIE}=([^;]*)`));
  const c = m ? decodeURIComponent(m[1] as string) : undefined;
  return isValidId(c) ? c : undefined;
}

/**
 * Route handlers for `app/api/social/[op]/route.ts` in every app:
 *   export const { GET, POST } = createSocialRoutes("rewind");
 * Every handler is fail-safe: a store outage returns `{ ok: false }`, never a crash.
 */
export function createSocialRoutes(app: string) {
  const store = () => getSocialStore();

  async function GET(req: Request, ctx: Ctx): Promise<Response> {
    const { op } = await ctx.params;
    const url = new URL(req.url);
    const q = url.searchParams;
    const uid = uidFrom(req);
    try {
      const s = store();
      switch (op) {
        case "feed": {
          const scope = q.get("scope") === "app" ? app : undefined;
          return json({ ok: true, events: await s.feed(Number(q.get("limit") ?? 30), scope) });
        }
        case "presence":
          return json({ ok: true, app: await s.presence(app), global: await s.presence(), byApp: await s.presenceByApp(), visitors: await s.visitorCount() });
        case "leaderboard": {
          const board = q.get("board") ?? app;
          return json({ ok: true, board, entries: await s.leaderboard(board, Number(q.get("limit") ?? 10)), me: uid ? await s.standing(board, uid) : null });
        }
        case "reactions":
          return json({ ok: true, ...(await s.reactions(q.get("target") ?? "", uid)) });
        case "passport":
          return json({ ok: true, stamps: uid ? await s.passport(uid) : [] });
        case "items":
          return json({ ok: true, items: uid ? await s.items(uid, q.get("list") ?? "default") : [] });
        case "collection":
          return json({ ok: true, members: await s.collection(q.get("name") ?? "default") });
        case "me":
          return json({ ok: true, profile: uid ? await s.profile(uid) : null, backend: socialBackend() });
        default:
          return json({ ok: false, error: "unknown op" }, 404);
      }
    } catch (err) {
      return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 200);
    }
  }

  async function POST(req: Request, ctx: Ctx): Promise<Response> {
    const { op } = await ctx.params;
    const uid = uidFrom(req);
    if (!uid) return json({ ok: false, error: "no identity" }, 400);
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      /* empty body is fine for some ops */
    }
    const str = (key: string, max = 200) => (typeof body[key] === "string" ? (body[key] as string).slice(0, max) : "");
    try {
      const s = store();
      const profile = await s.touch(uid);
      const actor: Identity = { id: uid, handle: profile.displayName || profile.handle };
      switch (op) {
        case "event": {
          const type = str("type", 20) as FeedEventType;
          if (!EVENT_TYPES.has(type)) return json({ ok: false, error: "bad type" }, 400);
          const text = str("text");
          if (!text) return json({ ok: false, error: "no text" }, 400);
          const meta = typeof body.meta === "object" && body.meta ? (body.meta as Record<string, string | number | boolean | null>) : undefined;
          return json({ ok: true, event: await s.publish({ app, type, actor, text, href: str("href", 300) || undefined, meta }) });
        }
        case "heartbeat":
          return json({ ok: true, app: await s.heartbeat(app, actor), global: await s.presence() });
        case "score": {
          const value = Number(body.value);
          if (!Number.isFinite(value)) return json({ ok: false, error: "bad value" }, 400);
          const mode = body.mode === "max" ? "max" : "sum";
          return json({ ok: true, ...(await s.score(str("board", 60) || app, actor, value, mode)) });
        }
        case "react":
          return json({ ok: true, ...(await s.react(str("target", 120), actor, str("kind", 16) || "like")) });
        case "stamp": {
          const r = await s.stamp(uid, app);
          if (r.isNew) await s.publish({ app, type: "stamp", actor, text: `${actor.handle} stepped into ${str("appName", 40) || app} (${r.stamps.length}/10 meridians)` }).catch(() => undefined);
          return json({ ok: true, ...r });
        }
        case "item": {
          const data = typeof body.data === "object" && body.data ? (body.data as Record<string, unknown>) : {};
          return json({ ok: true, item: await s.addItem(uid, str("list", 40) || "default", str("itemId", 120), data) });
        }
        case "unitem":
          await s.removeItem(uid, str("list", 40) || "default", str("itemId", 120));
          return json({ ok: true });
        case "collect":
          await s.collect(str("name", 40) || "default", str("member", 160));
          return json({ ok: true });
        case "uncollect":
          await s.uncollect(str("name", 40) || "default", str("member", 160));
          return json({ ok: true });
        case "profile":
          return json({ ok: true, profile: await s.touch(uid, { displayName: str("displayName", 32) || undefined, wallet: str("wallet", 80) || undefined }) });
        default:
          return json({ ok: false, error: "unknown op" }, 404);
      }
    } catch (err) {
      return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 200);
    }
  }

  return { GET, POST };
}
