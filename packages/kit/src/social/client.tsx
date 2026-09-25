"use client";
import { AnimatePresence, Marquee, motion } from "@longitude/motion";
import type { FeedEvent, Identity, Presence } from "@longitude/social/types";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { APPS, APP_BY_ID, type AppId, type AppMeta } from "../apps";
import { appUrl } from "../urls";
import { UID_HEADER, getIdentity, withIdentity } from "./identity";

/* ------------------------------------------------------------------ transport */

let cached: Identity | null = null;

/** Synchronous identity once the boot effect has run; null during SSR and the first paint. */
export function useIdentity(): Identity | null {
  const [me, setMe] = useState<Identity | null>(cached);
  useEffect(() => {
    if (!cached) cached = getIdentity();
    setMe(cached);
  }, []);
  return me;
}

async function call<T = Record<string, unknown>>(op: string, init: { method?: "GET" | "POST"; body?: unknown; params?: Record<string, string> } = {}): Promise<(T & { ok: boolean }) | null> {
  try {
    const me = cached ?? (cached = getIdentity());
    const url = new URL(`/api/social/${op}`, window.location.origin);
    for (const [k, v] of Object.entries(init.params ?? {})) url.searchParams.set(k, v);
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: { [UID_HEADER]: me.id, ...(init.body ? { "content-type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T & { ok: boolean };
  } catch {
    return null;
  }
}

/** Fire-and-forget social actions. Every call swallows failures: the app never depends on them. */
export const social = {
  event: (type: FeedEvent["type"], text: string, extra: { href?: string; meta?: FeedEvent["meta"] } = {}) =>
    call("event", { method: "POST", body: { type, text, ...extra } }),
  score: (board: string, value: number, mode: "sum" | "max" = "sum") =>
    call<{ score: number; rank: number }>("score", { method: "POST", body: { board, value, mode } }),
  react: (target: string, kind: string) => call<{ counts: Record<string, number>; mine: string[] }>("react", { method: "POST", body: { target, kind } }),
  reactions: (target: string) => call<{ counts: Record<string, number>; mine: string[] }>("reactions", { params: { target } }),
  stamp: (appName: string) => call<{ stamps: string[]; isNew: boolean }>("stamp", { method: "POST", body: { appName } }),
  passport: () => call<{ stamps: string[] }>("passport"),
  heartbeat: () => call<{ app: Presence; global: Presence }>("heartbeat", { method: "POST" }),
  presence: () => call<{ app: Presence; global: Presence; byApp: Record<string, number>; visitors: number }>("presence"),
  feed: (scope: "app" | "global" = "global", limit = 30) => call<{ events: FeedEvent[] }>("feed", { params: { scope, limit: String(limit) } }),
  leaderboard: (board: string, limit = 10) =>
    call<{ entries: { id: string; handle: string; score: number; rank: number }[]; me: { score: number; rank: number; total: number } | null }>("leaderboard", { params: { board, limit: String(limit) } }),
  items: (list: string) => call<{ items: { id: string; addedAt: string; data: Record<string, unknown> }[] }>("items", { params: { list } }),
  addItem: (list: string, itemId: string, data: Record<string, unknown>) => call("item", { method: "POST", body: { list, itemId, data } }),
  removeItem: (list: string, itemId: string) => call("unitem", { method: "POST", body: { list, itemId } }),
  profile: (patch: { displayName?: string; wallet?: string }) => call("profile", { method: "POST", body: patch }),
  collect: (name: string, member: string) => call("collect", { method: "POST", body: { name, member } }),
  uncollect: (name: string, member: string) => call("uncollect", { method: "POST", body: { name, member } }),
  collection: (name: string) => call<{ members: string[] }>("collection", { params: { name } }),
};

/* ------------------------------------------------------------------ hooks */

export function usePresence(intervalMs = 25_000): { app: Presence; global: Presence; byApp: Record<string, number>; visitors: number } | null {
  const [state, setState] = useState<{ app: Presence; global: Presence; byApp: Record<string, number>; visitors: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      await social.heartbeat();
      const p = await social.presence();
      if (alive && p?.ok) setState({ app: p.app, global: p.global, byApp: p.byApp, visitors: p.visitors });
    };
    void tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);
  return state;
}

export function useFeed(scope: "app" | "global" = "global", limit = 30, intervalMs = 15_000): FeedEvent[] {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const r = await social.feed(scope, limit);
      if (alive && r?.ok) setEvents(r.events);
    };
    void tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [scope, limit, intervalMs]);
  return events;
}

export function useReactions(target: string, kinds: string[]) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    void social.reactions(target).then((r) => {
      if (alive && r?.ok) {
        setCounts(r.counts);
        setMine(r.mine);
      }
    });
    return () => {
      alive = false;
    };
  }, [target]);
  const toggle = useCallback(
    async (kind: string) => {
      // optimistic
      setMine((m) => (m.includes(kind) ? m.filter((k) => k !== kind) : [...m, kind]));
      setCounts((c) => ({ ...c, [kind]: Math.max(0, (c[kind] ?? 0) + (mine.includes(kind) ? -1 : 1)) }));
      const r = await social.react(target, kind);
      if (r?.ok) {
        setCounts(r.counts);
        setMine(r.mine);
      }
    },
    [target, mine],
  );
  return { counts, mine, toggle, kinds };
}

export function usePassport(): string[] {
  const [stamps, setStamps] = useState<string[]>([]);
  useEffect(() => {
    void social.passport().then((r) => r?.ok && setStamps(r.stamps));
    const onStamp = (e: Event) => setStamps((e as CustomEvent<string[]>).detail);
    window.addEventListener("lg:stamps", onStamp);
    return () => window.removeEventListener("lg:stamps", onStamp);
  }, []);
  return stamps;
}

/* ------------------------------------------------------------------ components */

/**
 * Mount once per app (AppFrame does it): resolves the identity, stamps the passport, keeps
 * presence alive. Renders nothing.
 */
export function SocialBoot({ app }: { app: AppMeta }) {
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    cached = getIdentity();
    void social.stamp(app.name).then((r) => {
      if (r?.ok) window.dispatchEvent(new CustomEvent("lg:stamps", { detail: r.stamps }));
    });
    void social.heartbeat();
    const id = setInterval(() => void social.heartbeat(), 25_000);
    return () => clearInterval(id);
  }, [app.id, app.name]);
  return null;
}

/** "3 here now" for this app, "41 across the globe" on hover. */
export function PresenceBadge({ scope = "app" }: { scope?: "app" | "global" }) {
  const p = usePresence();
  if (!p) return null;
  const here = scope === "app" ? p.app.count : p.global.count;
  const names = (scope === "app" ? p.app.handles : p.global.handles).slice(-3).join(", ");
  return (
    <span className="lg-presence" title={names ? `Here now: ${names}` : undefined}>
      <span className="lg-presence__dot" aria-hidden="true" />
      {here} here now
    </span>
  );
}

const appColor = (id: string): string => {
  const a = APP_BY_ID[id as AppId];
  if (!a) return "currentColor";
  return a.palette.accent.toLowerCase() === a.palette.ink.toLowerCase() ? a.palette.accent2 : a.palette.accent;
};

/** Scrolling strip of the latest activity across all ten apps. */
export function FeedTicker({ scope = "global", limit = 20, className }: { scope?: "app" | "global"; limit?: number; className?: string }) {
  const events = useFeed(scope, limit);
  if (!events.length) return null;
  return (
    <Marquee className={`lg-ticker${className ? ` ${className}` : ""}`} duration={Math.max(24, events.length * 6)} gap={40}>
      {events.map((e) => (
        <a key={e.id} className="lg-ticker__item" href={e.href ?? appUrl(e.app as AppId)} title={new Date(e.ts).toLocaleString()}>
          <i style={{ background: appColor(e.app) }} aria-hidden="true" />
          <span>{e.text}</span>
        </a>
      ))}
    </Marquee>
  );
}

/** Ten stamps, one per app; filled when visited. */
export function Passport({ compact = false }: { compact?: boolean }) {
  const stamps = usePassport();
  const me = useIdentity();
  return (
    <div className={`lg-passport${compact ? " lg-passport--compact" : ""}`} aria-label={`${stamps.length} of 10 meridians visited`}>
      {!compact ? (
        <span className="lg-passport__label">
          {me ? me.handle : "Passport"} · {stamps.length}/10
        </span>
      ) : null}
      <span className="lg-passport__stamps">
        {APPS.map((a) => {
          const done = stamps.includes(a.id);
          return (
            <a
              key={a.id}
              className={`lg-passport__stamp${done ? " is-done" : ""}`}
              href={withIdentity(appUrl(a.id), me?.id)}
              title={`${a.name}${done ? " · visited" : ""}`}
              style={{ "--stamp": appColor(a.id) } as React.CSSProperties}
            />
          );
        })}
      </span>
    </div>
  );
}

/** Share to X with prefilled text; logs a share event. */
export function ShareButton({ text, url, label = "Share on X", children }: { text: string; url?: string; label?: string; children?: ReactNode }) {
  const onClick = () => {
    const target = url ?? (typeof window !== "undefined" ? window.location.href.split("?")[0] : "");
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(target ?? "")}`;
    window.open(intent, "_blank", "noopener,noreferrer,width=600,height=500");
    void social.event("share", `shared: ${text.slice(0, 80)}`, { href: target });
  };
  return (
    <button type="button" className="lg-btn lg-btn--share" onClick={onClick}>
      <span aria-hidden="true">𝕏</span> {children ?? label}
    </button>
  );
}

/** Reaction buttons with live counts. `kinds` are short ascii keys mapped to glyphs by the caller. */
export function ReactionBar({ target, kinds, glyphs }: { target: string; kinds: string[]; glyphs: Record<string, string> }) {
  const { counts, mine, toggle } = useReactions(target, kinds);
  return (
    <span className="lg-reactions">
      {kinds.map((k) => (
        <button key={k} type="button" className={`lg-reaction${mine.includes(k) ? " is-mine" : ""}`} onClick={() => void toggle(k)} aria-pressed={mine.includes(k)} title={k}>
          <span aria-hidden="true">{glyphs[k] ?? k}</span>
          {counts[k] ? <b>{counts[k]}</b> : null}
        </button>
      ))}
    </span>
  );
}

/** Top-N list for a board plus the viewer's standing. */
export function Leaderboard({ board, limit = 10, title = "Leaderboard", unit = "pts", refreshKey }: { board: string; limit?: number; title?: string; unit?: string; refreshKey?: unknown }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof social.leaderboard>>>(null);
  const me = useIdentity();
  useEffect(() => {
    let alive = true;
    void social.leaderboard(board, limit).then((r) => alive && setData(r));
    return () => {
      alive = false;
    };
  }, [board, limit, refreshKey]);
  return (
    <div className="lg-board">
      <div className="lg-board__head">
        <span>{title}</span>
        {data?.me ? (
          <span className="lg-board__me">
            you: #{data.me.rank} · {data.me.score} {unit}
          </span>
        ) : null}
      </div>
      <ol className="lg-board__list">
        <AnimatePresence initial={false}>
          {(data?.entries ?? []).map((e) => (
            <motion.li key={e.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={me?.id === e.id ? "is-me" : undefined}>
              <span className="lg-board__rank">{e.rank}</span>
              <span className="lg-board__handle">{e.handle}</span>
              <span className="lg-board__score">
                {e.score} {unit}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
        {data && data.entries.length === 0 ? <li className="lg-muted">No one on the board yet. Be first.</li> : null}
      </ol>
    </div>
  );
}
