import type { Commands } from "./commands";
import { handleFor, isValidId } from "./identity";
import type { FeedEvent, FeedEventType, Identity, ListItem, Presence, Profile, ScoreEntry } from "./types";

const FEED_MAX = 500;
const PRESENCE_TTL_MS = 60_000;
const MAX_TEXT = 200;

const k = {
  profile: (id: string) => `profile:${id}`,
  feed: (app?: string) => (app ? `feed:${app}` : "feed:global"),
  board: (name: string) => `board:${name}`,
  react: (target: string) => `react:${target}`,
  reactUsers: (target: string) => `react:${target}:users`,
  presence: (app?: string) => (app ? `presence:${app}` : "presence:global"),
  passport: (id: string) => `passport:${id}`,
  list: (id: string, name: string) => `list:${id}:${name}`,
  counter: (name: string) => `counter:${name}`,
  collection: (name: string) => `collection:${name}`,
};

// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x1f]/g;
const clean = (s: string, max = MAX_TEXT) => s.replace(CONTROL, " ").trim().slice(0, max);
const nowIso = () => new Date().toISOString();

/**
 * Everything social that LONGITUDE shares across the ten apps: anonymous profiles, a global feed,
 * leaderboards, reactions, live presence, the passport of visited apps, and per-user lists
 * (rosters, watchlists). Every method is safe to call with untrusted ids.
 */
export class SocialStore {
  constructor(readonly cmd: Commands) {}

  /* identity ------------------------------------------------------------ */

  async touch(id: string, patch: Partial<Pick<Profile, "wallet" | "displayName">> = {}): Promise<Profile> {
    if (!isValidId(id)) throw new Error("invalid id");
    const key = k.profile(id);
    const existing = await this.cmd.hgetall(key);
    const now = nowIso();
    const values: Record<string, string> = { lastSeen: now };
    if (!existing.createdAt) values.createdAt = now;
    if (!existing.handle) values.handle = handleFor(id);
    if (patch.wallet) values.wallet = clean(patch.wallet, 80);
    if (patch.displayName) values.displayName = clean(patch.displayName, 32);
    await this.cmd.hset(key, values);
    if (!existing.createdAt) await this.cmd.incrby(k.counter("visitors"), 1);
    return { id, ...existing, ...values } as unknown as Profile;
  }

  async profile(id: string): Promise<Profile | null> {
    if (!isValidId(id)) return null;
    const h = await this.cmd.hgetall(k.profile(id));
    if (!h.createdAt) return null;
    return { id, handle: h.handle ?? handleFor(id), createdAt: h.createdAt, lastSeen: h.lastSeen ?? h.createdAt, wallet: h.wallet, displayName: h.displayName };
  }

  async visitorCount(): Promise<number> {
    return Number((await this.cmd.get(k.counter("visitors"))) ?? 0);
  }

  identity(id: string): Identity {
    return { id, handle: handleFor(id) };
  }

  /* feed ----------------------------------------------------------------- */

  async publish(input: { app: string; type: FeedEventType; actor: Identity; text: string; href?: string; meta?: FeedEvent["meta"] }): Promise<FeedEvent> {
    if (!isValidId(input.actor.id)) throw new Error("invalid id");
    const ev: FeedEvent = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      ts: nowIso(),
      app: clean(input.app, 40),
      type: input.type,
      actor: { id: input.actor.id, handle: clean(input.actor.handle || handleFor(input.actor.id), 40) },
      text: clean(input.text),
      href: input.href ? clean(input.href, 300) : undefined,
      meta: input.meta,
    };
    const json = JSON.stringify(ev);
    await this.cmd.lpush(k.feed(), json);
    await this.cmd.ltrim(k.feed(), 0, FEED_MAX - 1);
    await this.cmd.lpush(k.feed(ev.app), json);
    await this.cmd.ltrim(k.feed(ev.app), 0, FEED_MAX - 1);
    return ev;
  }

  async feed(limit = 30, app?: string): Promise<FeedEvent[]> {
    const rows = await this.cmd.lrange(k.feed(app), 0, Math.max(0, Math.min(200, limit) - 1));
    const out: FeedEvent[] = [];
    for (const r of rows) {
      try {
        out.push(JSON.parse(r) as FeedEvent);
      } catch {
        /* skip */
      }
    }
    return out;
  }

  /* leaderboards --------------------------------------------------------- */

  /** `mode` "sum" accumulates, "max" keeps the best score. Returns the member's new rank (1-based). */
  async score(board: string, actor: Identity, value: number, mode: "sum" | "max" = "sum"): Promise<{ score: number; rank: number }> {
    if (!isValidId(actor.id)) throw new Error("invalid id");
    const key = k.board(clean(board, 60));
    await this.touch(actor.id);
    let score: number;
    if (mode === "sum") score = await this.cmd.zincrby(key, value, actor.id);
    else {
      const cur = (await this.cmd.zscore(key, actor.id)) ?? Number.NEGATIVE_INFINITY;
      score = Math.max(cur, value);
      if (score !== cur) await this.cmd.zadd(key, score, actor.id);
    }
    const rank = ((await this.cmd.zrevrank(key, actor.id)) ?? 0) + 1;
    return { score, rank };
  }

  async leaderboard(board: string, limit = 10): Promise<ScoreEntry[]> {
    const rows = await this.cmd.zrevrange(k.board(clean(board, 60)), 0, Math.max(0, Math.min(100, limit) - 1));
    const out: ScoreEntry[] = [];
    for (const [i, row] of rows.entries()) {
      const p = await this.cmd.hget(k.profile(row.member), "handle");
      out.push({ id: row.member, handle: p ?? handleFor(row.member), score: row.score, rank: i + 1 });
    }
    return out;
  }

  async standing(board: string, id: string): Promise<{ score: number; rank: number; total: number } | null> {
    if (!isValidId(id)) return null;
    const key = k.board(clean(board, 60));
    const score = await this.cmd.zscore(key, id);
    if (score === null) return null;
    const rank = ((await this.cmd.zrevrank(key, id)) ?? 0) + 1;
    return { score, rank, total: await this.cmd.zcard(key) };
  }

  /* reactions ------------------------------------------------------------ */

  /** One reaction per user per kind per target; calling again removes it. Returns the new counts. */
  async react(target: string, actor: Identity, kind: string): Promise<{ counts: Record<string, number>; mine: string[] }> {
    if (!isValidId(actor.id)) throw new Error("invalid id");
    const t = clean(target, 120);
    const e = clean(kind, 16);
    const users = k.reactUsers(t);
    const mark = `${actor.id}:${e}`;
    if (await this.cmd.sismember(users, mark)) {
      await this.cmd.srem(users, mark);
      await this.cmd.hincrby(k.react(t), e, -1);
    } else {
      await this.cmd.sadd(users, mark);
      await this.cmd.hincrby(k.react(t), e, 1);
    }
    return this.reactions(t, actor.id);
  }

  async reactions(target: string, id?: string): Promise<{ counts: Record<string, number>; mine: string[] }> {
    const t = clean(target, 120);
    const raw = await this.cmd.hgetall(k.react(t));
    const counts: Record<string, number> = {};
    for (const [e, n] of Object.entries(raw)) if (Number(n) > 0) counts[e] = Number(n);
    let mine: string[] = [];
    if (id && isValidId(id)) {
      const all = await this.cmd.smembers(k.reactUsers(t));
      mine = all.filter((m) => m.startsWith(`${id}:`)).map((m) => m.slice(id.length + 1));
    }
    return { counts, mine };
  }

  /* presence ------------------------------------------------------------- */

  async heartbeat(app: string, actor: Identity): Promise<Presence> {
    if (!isValidId(actor.id)) throw new Error("invalid id");
    const member = `${actor.id}|${clean(actor.handle || handleFor(actor.id), 40)}|${clean(app, 40)}`;
    const now = Date.now();
    await this.cmd.zadd(k.presence(app), now, member);
    await this.cmd.zadd(k.presence(), now, member);
    return this.presence(app);
  }

  async presence(app?: string, sample = 12): Promise<Presence> {
    const key = k.presence(app);
    const cutoff = Date.now() - PRESENCE_TTL_MS;
    await this.cmd.zremrangebyscore(key, Number.NEGATIVE_INFINITY, cutoff);
    const members = await this.cmd.zrangebyscore(key, cutoff, Number.POSITIVE_INFINITY);
    const seen = new Map<string, string>();
    for (const m of members) {
      const [id, handle] = m.split("|");
      if (id && handle && !seen.has(id)) seen.set(id, handle);
    }
    return { count: seen.size, handles: [...seen.values()].slice(-sample) };
  }

  /** Where everyone is right now: app id -> count. */
  async presenceByApp(): Promise<Record<string, number>> {
    const cutoff = Date.now() - PRESENCE_TTL_MS;
    await this.cmd.zremrangebyscore(k.presence(), Number.NEGATIVE_INFINITY, cutoff);
    const members = await this.cmd.zrangebyscore(k.presence(), cutoff, Number.POSITIVE_INFINITY);
    const out: Record<string, number> = {};
    const seen = new Set<string>();
    for (const m of members) {
      const [id, , app] = m.split("|");
      if (!id || !app || seen.has(`${id}|${app}`)) continue;
      seen.add(`${id}|${app}`);
      out[app] = (out[app] ?? 0) + 1;
    }
    return out;
  }

  /* passport ------------------------------------------------------------- */

  async stamp(id: string, app: string): Promise<{ stamps: string[]; isNew: boolean }> {
    if (!isValidId(id)) throw new Error("invalid id");
    const key = k.passport(id);
    const a = clean(app, 40);
    const isNew = !(await this.cmd.sismember(key, a));
    if (isNew) await this.cmd.sadd(key, a);
    return { stamps: (await this.cmd.smembers(key)).sort(), isNew };
  }

  async passport(id: string): Promise<string[]> {
    if (!isValidId(id)) return [];
    return (await this.cmd.smembers(k.passport(id))).sort();
  }

  /* lists (rosters, watchlists) ----------------------------------------- */

  async addItem(id: string, list: string, itemId: string, data: Record<string, unknown>): Promise<ListItem> {
    if (!isValidId(id)) throw new Error("invalid id");
    const item: ListItem = { id: clean(itemId, 120), addedAt: nowIso(), data };
    const json = JSON.stringify(item);
    if (json.length > 4000) throw new Error("item too large");
    await this.cmd.hset(k.list(id, clean(list, 40)), { [item.id]: json });
    return item;
  }

  async removeItem(id: string, list: string, itemId: string): Promise<void> {
    if (!isValidId(id)) throw new Error("invalid id");
    await this.cmd.hdel(k.list(id, clean(list, 40)), clean(itemId, 120));
  }

  async items(id: string, list: string): Promise<ListItem[]> {
    if (!isValidId(id)) return [];
    const raw = await this.cmd.hgetall(k.list(id, clean(list, 40)));
    const out: ListItem[] = [];
    for (const v of Object.values(raw)) {
      try {
        out.push(JSON.parse(v) as ListItem);
      } catch {
        /* skip */
      }
    }
    return out.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
  }

  /* collections: global sets the seeds re-score (every drafted wallet, every watched token) */

  async collect(name: string, member: string): Promise<void> {
    await this.cmd.sadd(k.collection(clean(name, 40)), clean(member, 160));
  }

  async uncollect(name: string, member: string): Promise<void> {
    await this.cmd.srem(k.collection(clean(name, 40)), clean(member, 160));
  }

  async collection(name: string): Promise<string[]> {
    return (await this.cmd.smembers(k.collection(clean(name, 40)))).sort();
  }

  /* counters ------------------------------------------------------------- */

  async count(name: string, by = 1): Promise<number> {
    return this.cmd.incrby(k.counter(clean(name, 60)), by);
  }
}
