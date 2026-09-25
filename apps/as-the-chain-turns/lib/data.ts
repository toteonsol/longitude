import type { NansenClient, RowOf } from "@longitude/nansen";
import { lastDays } from "@longitude/nansen";

/** Chains the episode is shot on. One day of smart money DEX trades → six wallets → their 30-day profiles. */
const CHAINS = ["ethereum", "solana", "base"] as const;
export type Chain = (typeof CHAINS)[number];

export type Action = "buy" | "sell" | "swap";
export type Zoom = "slow" | "dramatic";
export type Pronoun = "she" | "he";

/** Why a trade made the cut. Picks the scene title, the caption template and the zoom. */
export type SceneKind = "big-buy" | "big-sell" | "reversal" | "shared" | "rotation" | "buy" | "sell";

/**
 * Soap archetypes, assigned in this priority from the numbers (first match not already taken):
 * Tycoon: the cast's biggest volume of the day. Amnesiac: bought and sold the same token within the
 * day. Villain: sells more than buys, and is up this month. Widow: down this month and still selling.
 * Twin: trades a token another cast member also traded. Ingenue: only buys. Schemer: rotations
 * (token for token) outnumber buys and sells. Oracle: 30-day win rate ≥ 65%. Gambler: win rate < 45%
 * on 20+ exits. Newcomer: none of the above.
 */
export type Archetype =
  | "The Tycoon"
  | "The Amnesiac"
  | "The Twin"
  | "The Villain"
  | "The Widow"
  | "The Ingenue"
  | "The Schemer"
  | "The Oracle"
  | "The Gambler"
  | "The Newcomer";

export interface Character {
  /** "The Duchess of Base": title from the address hash, place from the wallet's home chain. */
  name: string;
  /** One soap-bio line written from the numbers. */
  role: string;
  archetype: Archetype;
  pronoun: Pronoun;
  /** Wardrobe hue 0..359 from the address, so the character looks the same everywhere. */
  hue: number;
}

export interface CastStats {
  /** Today (the episode's 24 hours). */
  trades: number;
  buys: number;
  sells: number;
  swaps: number;
  volumeUsd: number;
  biggestTradeUsd: number;
  /** Distinct non-cash tokens traded today, biggest first. */
  tokens: string[];
  /** Last 30 days, from the profiler. */
  pnl30dUsd: number;
  roi30dPct: number;
  winRate30dPct: number;
  trades30d: number;
  tokens30d: number;
  topTokens: string[];
}

export interface CastMember {
  address: string;
  /** Nansen label, the "actor" playing the character. */
  label: string;
  /** Home chain: where the wallet traded most today. */
  chain: Chain;
  character: Character;
  stats: CastStats;
}

export interface Scene {
  /** 1-based, in air order. */
  index: number;
  title: string;
  /** ISO timestamp of the trade. */
  at: string;
  /** Cast member address (the actor in the scene). */
  wallet: string;
  action: Action;
  /** The token the scene is about: bought for buys, sold for sells, the incoming token for swaps. */
  symbol: string;
  valueUsd: number;
  caption: string;
  zoom: Zoom;
  kind: SceneKind;
  chain: Chain;
  txHash: string;
  /** Amount of `symbol`. */
  amount: number;
  pair: { sold: { symbol: string; amount: number }; bought: { symbol: string; amount: number } };
  /** Second cast member in the scene (shared-token scenes). */
  coStar?: string;
}

export interface Episode {
  /** Days since the series premiere. */
  number: number;
  title: string;
  synopsis: string;
  /** YYYY-MM-DD (UTC) of the newest trade. */
  airDate: string;
  /** The "Previously on…" recap: the three biggest beats, in time order. */
  previously: { wallet: string; text: string }[];
}

export interface AsTheChainTurnsData {
  generatedAt: string;
  /** The 24 hours the episode covers. */
  window: { from: string; to: string };
  episode: Episode;
  cast: CastMember[];
  scenes: Scene[];
}

type TradeRow = RowOf<"/api/v1/smart-money/dex-trades">;

/* ------------------------------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------------------------- */

const num = (v: number | string | null | undefined): number => Number(v ?? 0) || 0;
const pct = (v: number | null | undefined): number => {
  const n = Number(v ?? 0);
  return n <= 1 ? n * 100 : n;
};

/** FNV-1a 32-bit. Everything "random" about a character comes from this, so the seed is reproducible. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const pick = <T>(list: readonly T[], seed: number): T => list[seed % list.length] as T;

const STABLES = new Set([
  "USDC", "USDT", "DAI", "USDE", "USDS", "FRAX", "TUSD", "PYUSD", "USD1", "USDBC", "FDUSD", "SUSD", "LUSD", "GHO",
  "CRVUSD", "USDC.E", "USDT.E", "BUSD", "USDH", "USDG", "RLUSD", "AUSD", "USDY", "USDP", "EURC",
]);
const NATIVES = new Set(["ETH", "WETH", "SOL", "WSOL", "BNB", "WBNB", "MATIC", "POL"]);
const isStable = (sym: string) => STABLES.has(sym);
const isCash = (sym: string) => STABLES.has(sym) || NATIVES.has(sym);

const isEvm = (chain: Chain) => chain !== "solana";
const keyOf = (address: string, chain: Chain) => (isEvm(chain) ? address.toLowerCase() : address);

function parseTs(s: string): number {
  const iso = /Z$|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(" ", "T")}Z`;
  return new Date(iso).getTime();
}

export const usd = (n: number): string => {
  const a = Math.abs(n);
  const body =
    a >= 1e9
      ? `$${(a / 1e9).toFixed(1)}B`
      : a >= 1e6
        ? `$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`
        : a >= 1e3
          ? `$${Math.round(a / 1e3)}K`
          : `$${Math.round(a)}`;
  return n < 0 ? `-${body}` : body;
};

export const qty = (n: number): string =>
  n >= 1e9
    ? `${(n / 1e9).toFixed(1)}B`
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1)}M`
      : n >= 1e3
        ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K`
        : n >= 100
          ? `${Math.round(n)}`
          : `${Number(n.toFixed(2))}`;

function timeOfDay(iso: string): string {
  const h = new Date(iso).getUTCHours();
  if (h < 5) return "in the dead of night";
  if (h < 8) return "before dawn";
  if (h < 11) return "over breakfast";
  if (h < 14) return "before lunch";
  if (h < 17) return "in the afternoon";
  if (h < 20) return "at dinner";
  return "after dark";
}

const WORDS = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen",
  "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one", "twenty-two",
  "twenty-three", "twenty-four",
];
function hoursAgo(h: number): string {
  if (h < 1) {
    const m = Math.max(1, Math.round(h * 60));
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  const r = Math.round(h);
  if (r <= 1) return "an hour ago";
  return `${WORDS[r] ?? String(r)} hours ago`;
}
function hoursSpan(h: number): string {
  if (h < 1) {
    const m = Math.max(1, Math.round(h * 60));
    return `${m} minute${m === 1 ? "" : "s"}`;
  }
  const r = Math.round(h);
  return r <= 1 ? "an hour" : `${WORDS[r] ?? String(r)} hours`;
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "").replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------------------------------------------------
 * Trades
 * ---------------------------------------------------------------------------------------------- */

interface Trade {
  chain: Chain;
  at: number;
  iso: string;
  txHash: string;
  wallet: string;
  walletKey: string;
  label: string;
  action: Action;
  symbol: string;
  amount: number;
  valueUsd: number;
  sold: { symbol: string; amount: number };
  bought: { symbol: string; amount: number };
  kind: SceneKind;
  drama: number;
  /** Shared-token scenes: the other cast member, when they moved and which way. */
  coStar?: string;
  coStarAt?: number;
  coStarAction?: Action;
  /** Reversals: hours since the earlier, opposite trade on the same token. */
  hoursSince?: number;
  prevAction?: Action;
}

function toTrade(r: TradeRow): Trade | null {
  if (!(CHAINS as readonly string[]).includes(r.chain)) return null;
  const chain = r.chain as Chain;
  const soldSym = (r.token_sold_symbol ?? "").trim().toUpperCase();
  const boughtSym = (r.token_bought_symbol ?? "").trim().toUpperCase();
  const valueUsd = num(r.trade_value_usd);
  if (!soldSym || !boughtSym || valueUsd <= 0 || !r.trader_address) return null;
  const at = parseTs(r.block_timestamp);
  if (!Number.isFinite(at)) return null;

  const sold = { symbol: soldSym, amount: num(r.token_sold_amount) };
  const bought = { symbol: boughtSym, amount: num(r.token_bought_amount) };
  let action: Action;
  let focus: { symbol: string; amount: number };
  if (isCash(soldSym) && isCash(boughtSym)) {
    if (isStable(soldSym) && isStable(boughtSym)) return null; // stable shuffles: no drama
    if (isStable(soldSym)) {
      action = "buy";
      focus = bought;
    } else {
      action = "sell";
      focus = sold;
    }
  } else if (isCash(soldSym)) {
    action = "buy";
    focus = bought;
  } else if (isCash(boughtSym)) {
    action = "sell";
    focus = sold;
  } else {
    action = "swap";
    focus = bought;
  }
  return {
    chain,
    at,
    iso: new Date(at).toISOString(),
    txHash: r.transaction_hash ?? "",
    wallet: r.trader_address,
    walletKey: keyOf(r.trader_address, chain),
    label: (r.trader_address_label ?? "").trim() || "Smart Money",
    action,
    symbol: focus.symbol,
    amount: focus.amount,
    valueUsd,
    sold,
    bought,
    kind: action === "swap" ? "rotation" : action,
    drama: 0,
  };
}

/* ------------------------------------------------------------------------------------------------
 * Characters
 * ---------------------------------------------------------------------------------------------- */

const TITLES: ReadonlyArray<{ title: string; pronoun: Pronoun }> = [
  { title: "Duchess", pronoun: "she" },
  { title: "Baron", pronoun: "he" },
  { title: "Countess", pronoun: "she" },
  { title: "Viscount", pronoun: "he" },
  { title: "Heiress", pronoun: "she" },
  { title: "Colonel", pronoun: "he" },
  { title: "Dowager", pronoun: "she" },
  { title: "Archduke", pronoun: "he" },
  { title: "Marchioness", pronoun: "she" },
  { title: "Admiral", pronoun: "he" },
  { title: "Widow", pronoun: "she" },
  { title: "Reverend", pronoun: "he" },
  { title: "Governess", pronoun: "she" },
  { title: "Prince", pronoun: "he" },
  { title: "Madame", pronoun: "she" },
  { title: "Doctor", pronoun: "he" },
];

const PLACES: Record<Chain, string> = { ethereum: "Mainnet", base: "Base", solana: "Solana" };

const PRONOUNS: Record<Pronoun, { she: string; her: string; hers: string }> = {
  she: { she: "she", her: "her", hers: "her" },
  he: { she: "he", her: "him", hers: "his" },
};

interface Member {
  key: string;
  address: string;
  label: string;
  chain: Chain;
  trades: Trade[];
  volumeUsd: number;
  score: number;
  name: string;
  pronoun: Pronoun;
  hue: number;
  archetype: Archetype;
  profile: { pnl: number; roi: number; winRate: number; trades: number; tokens: number; top: string[] };
}

function groupMembers(tape: Trade[]): Member[] {
  const groups = new Map<string, Member>();
  for (const t of tape) {
    let m = groups.get(t.walletKey);
    if (!m) {
      m = {
        key: t.walletKey,
        address: t.wallet,
        label: t.label,
        chain: t.chain,
        trades: [],
        volumeUsd: 0,
        score: 0,
        name: "",
        pronoun: "she",
        hue: hashString(t.walletKey) % 360,
        archetype: "The Newcomer",
        profile: { pnl: 0, roi: 0, winRate: 0, trades: 0, tokens: 0, top: [] },
      };
      groups.set(t.walletKey, m);
    }
    m.trades.push(t);
    m.volumeUsd += t.valueUsd;
    if (t.label !== "Smart Money") m.label = t.label;
  }
  for (const m of groups.values()) {
    m.trades.sort((a, b) => a.at - b.at);
    // Home chain: most trades, then most volume.
    const byChain = new Map<Chain, { n: number; v: number }>();
    for (const t of m.trades) {
      const c = byChain.get(t.chain) ?? { n: 0, v: 0 };
      c.n += 1;
      c.v += t.valueUsd;
      byChain.set(t.chain, c);
    }
    m.chain = [...byChain.entries()].sort((a, b) => b[1].n - a[1].n || b[1].v - a[1].v)[0]?.[0] ?? m.chain;
    // Active and valuable: volume on a log scale plus a bonus per trade that flattens out.
    m.score = Math.log10(1 + m.volumeUsd) + 1.5 * Math.log2(1 + m.trades.length);
  }
  return [...groups.values()].sort((a, b) => b.score - a.score || b.volumeUsd - a.volumeUsd);
}

/** Title from the hash, place from the chain, bumped along the list until the name is unique. */
function nameCast(cast: Member[]): void {
  const used = new Set<string>();
  for (const m of cast) {
    let i = hashString(`${m.key}:title`) % TITLES.length;
    let name = "";
    for (let tries = 0; tries < TITLES.length; tries++) {
      const t = TITLES[i] as (typeof TITLES)[number];
      name = `The ${t.title} of ${PLACES[m.chain]}`;
      if (!used.has(name)) {
        m.pronoun = t.pronoun;
        break;
      }
      i = (i + 1) % TITLES.length;
    }
    used.add(name);
    m.name = name;
  }
}

/** Marks reversals, shared tokens and the day's biggest buy and sell across the cast's trades. */
function annotate(cast: Member[]): void {
  const all = cast.flatMap((m) => m.trades);
  // Reversals: an opposite buy/sell on the same token by the same wallet, later in the day.
  for (const m of cast) {
    const last = new Map<string, Trade>();
    for (const t of m.trades) {
      if (t.action === "swap") continue;
      const prev = last.get(t.symbol);
      if (prev && prev.action !== t.action) {
        t.kind = "reversal";
        t.hoursSince = (t.at - prev.at) / 3_600_000;
        t.prevAction = prev.action;
      }
      last.set(t.symbol, t);
    }
  }
  // Shared tokens: two cast members on the same token. The co-star is the other's biggest trade on it.
  const bySymbol = new Map<string, Map<string, Trade>>();
  for (const t of all) {
    const holders = bySymbol.get(t.symbol) ?? new Map<string, Trade>();
    const best = holders.get(t.walletKey);
    if (!best || t.valueUsd > best.valueUsd) holders.set(t.walletKey, t);
    bySymbol.set(t.symbol, holders);
  }
  for (const t of all) {
    const holders = bySymbol.get(t.symbol);
    if (!holders || holders.size < 2) continue;
    const other = [...holders.values()].filter((o) => o.walletKey !== t.walletKey).sort((a, b) => b.valueUsd - a.valueUsd)[0];
    if (!other) continue;
    t.coStar = other.wallet;
    t.coStarAt = other.at;
    t.coStarAction = other.action;
    if (t.kind !== "reversal") t.kind = "shared";
  }
  // The day's biggest buy and biggest sell.
  const biggest = (action: Action) => [...all].filter((t) => t.action === action).sort((a, b) => b.valueUsd - a.valueUsd)[0];
  const bigBuy = biggest("buy");
  const bigSell = biggest("sell");
  if (bigBuy && bigBuy.kind === "buy") bigBuy.kind = "big-buy";
  if (bigSell && bigSell.kind === "sell") bigSell.kind = "big-sell";
  for (const t of all) {
    t.drama =
      Math.log10(1 + t.valueUsd) +
      (t.kind === "reversal" ? 3 : 0) +
      (t.kind === "shared" ? 2 : 0) +
      (t === bigBuy || t === bigSell ? 2 : 0) +
      (t.action === "sell" ? 0.5 : 0) +
      (t.action === "swap" ? 0.3 : 0);
  }
}

function assignArchetypes(cast: Member[]): void {
  const top = [...cast].sort((a, b) => b.volumeUsd - a.volumeUsd)[0];
  const counts = (m: Member) => ({
    buys: m.trades.filter((t) => t.action === "buy").length,
    sells: m.trades.filter((t) => t.action === "sell").length,
    swaps: m.trades.filter((t) => t.action === "swap").length,
    buyVol: m.trades.filter((t) => t.action === "buy").reduce((s, t) => s + t.valueUsd, 0),
    sellVol: m.trades.filter((t) => t.action === "sell").reduce((s, t) => s + t.valueUsd, 0),
  });
  const rules: Array<{ archetype: Archetype; test: (m: Member) => boolean }> = [
    { archetype: "The Tycoon", test: (m) => m === top },
    { archetype: "The Amnesiac", test: (m) => m.trades.some((t) => t.kind === "reversal") },
    { archetype: "The Villain", test: (m) => counts(m).sellVol > counts(m).buyVol && m.profile.pnl > 0 },
    { archetype: "The Widow", test: (m) => m.profile.pnl < 0 && counts(m).sells >= 1 },
    { archetype: "The Twin", test: (m) => m.trades.some((t) => t.coStar !== undefined) },
    { archetype: "The Ingenue", test: (m) => counts(m).sells === 0 && counts(m).swaps === 0 && counts(m).buys >= 1 },
    { archetype: "The Schemer", test: (m) => counts(m).swaps >= 1 && counts(m).swaps >= Math.max(counts(m).buys, counts(m).sells) },
    { archetype: "The Oracle", test: (m) => m.profile.winRate >= 65 },
    { archetype: "The Gambler", test: (m) => m.profile.winRate > 0 && m.profile.winRate < 45 && m.profile.trades >= 20 },
  ];
  const taken = new Set<Archetype>();
  for (const m of cast) {
    const hit = rules.find((r) => !taken.has(r.archetype) && r.test(m));
    m.archetype = hit?.archetype ?? "The Newcomer";
    taken.add(m.archetype);
  }
}

function roleFor(m: Member, cast: Member[]): string {
  const buys = m.trades.filter((t) => t.action === "buy");
  const sells = m.trades.filter((t) => t.action === "sell");
  const swaps = m.trades.filter((t) => t.action === "swap");
  const sellVol = sells.reduce((s, t) => s + t.valueUsd, 0);
  const win = Math.round(m.profile.winRate);
  const tokens = new Set(m.trades.map((t) => t.symbol)).size;
  switch (m.archetype) {
    case "The Tycoon":
      return `Moved ${usd(m.volumeUsd)} in a single day. Owns the town, or says so.`;
    case "The Amnesiac": {
      const r = m.trades.find((t) => t.kind === "reversal");
      return `Bought and sold $${r?.symbol ?? "it"} within ${hoursSpan(r?.hoursSince ?? 1)}. Remembers nothing.`;
    }
    case "The Twin": {
      const t = m.trades.find((t) => t.coStar !== undefined);
      const other = cast.find((c) => c.address === t?.coStar);
      return `Trades the same $${t?.symbol ?? "token"} as ${other?.name ?? "someone"}. A coincidence, allegedly.`;
    }
    case "The Villain":
      return `Sold ${usd(sellVol)} into everyone's hopes. Up ${usd(m.profile.pnl)} this month.`;
    case "The Widow":
      return `Down ${usd(Math.abs(m.profile.pnl))} this month. Still selling. Wears black.`;
    case "The Ingenue":
      return `Only buys. ${plural(buys.length, "purchase")} today, zero regrets. So far.`;
    case "The Schemer":
      return `${plural(swaps.length, "rotation")} before the credits roll. Always has a plan.`;
    case "The Oracle":
      return `Wins ${win}% of exits. Knows things. Won't say how.`;
    case "The Gambler":
      return `Wins ${win}% of the time. Trades like it's ${Math.min(99, win + 40)}%.`;
    default:
      return `${plural(m.trades.length, "trade")}, ${plural(tokens, "token")}, no history in this town.`;
  }
}

/* ------------------------------------------------------------------------------------------------
 * Scenes
 * ---------------------------------------------------------------------------------------------- */

const TITLE_VARIANTS: Record<SceneKind, readonly string[]> = {
  "big-buy": ["A Fortune Changes Hands", "The Proposal", "The Acquisition"],
  "big-sell": ["Every. Last. Token.", "The Farewell", "Nothing Left to Say"],
  reversal: ["Second Thoughts", "What Was Promised", "The Return"],
  shared: ["Two Wallets, One Token", "Old Flames", "This Town Is Too Small"],
  rotation: ["The Rotation", "Trading Up", "Like It Was Nothing"],
  buy: ["The Temptation", "A Small Indulgence", "Against Advice"],
  sell: ["The Departure", "Letting Go", "Not a Word"],
};

const CAPTIONS: Record<string, readonly string[]> = {
  "big-buy": [
    "{name} bought {value} of {cash} {time}. With money {she} swore {she} didn't have.",
    "{amount} {sym} for {value}, {time}. {name} calls it a hobby.",
    "Nobody told {name} to buy {value} of {cash}. Nobody could have stopped {her}.",
  ],
  "big-sell": [
    "{She} sold everything. Every. Last. {sym}. {value} worth, gone {time}.",
    "{name} walked away from {amount} {sym} {time}. {value}. {She} did not look back.",
    "{value} of {cash}, sold {time}. {name} says it was never about the money.",
  ],
  "reversal:sell": [
    "{Hours}, {she} swore {cash} was forever. {name} just sold {value} of it.",
    "{name} bought {cash} {hours}. Now {value} of it is gone, {time}. Nobody is surprised.",
  ],
  "reversal:buy": [
    "{name} sold {cash} {hours}. Now {she}'s back for {value} more. Of course {she} is.",
    "{Hours}, {name} said {she} was done with {cash}. {She} just bought {value}.",
  ],
  // Shared tokens, by who moved first and which way the co-star went.
  "shared:buy:first": [
    "{name} went in on {cash} {time}. {value}. {costar} was watching.",
    "{value} of {cash}, {time}. {name} thinks nobody noticed. {costar} noticed.",
  ],
  "shared:buy:after": [
    "{name} touched {cash} too. {value}. The same token as {costar}. On the same day. Everyone saw.",
    "First {costar}, now {name}: {value} into {cash}. This town is too small for two wallets.",
    "{costar} will hear about this. {name}, {cash}, {value}, {time}.",
  ],
  "shared:buy:vs": [
    "{costar} sold {cash}. {name} bought {value} of it {time}. Somebody knows something.",
    "{name} bought {value} of {cash} {time}, the very token {costar} sold. One of them is wrong.",
  ],
  "shared:sell:vs": [
    "{name} sold {value} of {cash} {time}. {costar} is still in. One of them is wrong.",
    "Same token as {costar}, opposite door. {name} sold {value} of {cash} {time}.",
  ],
  "shared:sell:first": [
    "{name} sold {value} of {cash} {time}. {costar} hadn't heard yet.",
    "{name} got out of {cash} {time}. {value}. Somebody should have told {costar}.",
  ],
  "shared:sell:after": [
    "{costar} sold. Then {name} sold: {value} of {cash}, {time}. The exits are getting crowded.",
    "{name} followed {costar} out of {cash} {time}. {value}. Nobody said goodbye.",
  ],
  rotation: [
    "{name} traded {sold} for {cash} like it was nothing. {value}. Nothing.",
    "Out with {sold}, in with {cash}. {value}, {time}. {name} has always been like this.",
  ],
  buy: [
    "{value} of {cash}, {time}. {name} says it's not what it looks like.",
    "{name} picked up {amount} {sym} {time}. {value}. A small indulgence, {she} calls it.",
    "{name} was told to wait. {She} bought {value} of {cash} instead.",
  ],
  sell: [
    "{name} let go of {amount} {sym} {time}. {value}. {She} says {she}'s fine.",
    "{value} of {cash}, sold {time}. {name} left without a word.",
    "{name} sold {cash} {time}. {value}. {She} had {hers} reasons. {She} always does.",
  ],
};

function captionVars(t: Trade, m: Member, coStar: Member | undefined): Record<string, string> {
  const p = PRONOUNS[m.pronoun];
  const time = timeOfDay(t.iso);
  const hours = hoursAgo(t.hoursSince ?? 1);
  return {
    name: m.name,
    she: p.she,
    She: cap(p.she),
    her: p.her,
    Her: cap(p.her),
    hers: p.hers,
    Hers: cap(p.hers),
    sym: t.symbol,
    cash: `$${t.symbol}`,
    value: usd(t.valueUsd),
    amount: qty(t.amount),
    time,
    Time: cap(time),
    hours,
    Hours: cap(hours),
    costar: coStar?.name ?? "someone",
    sold: `$${t.sold.symbol}`,
    soldAmount: qty(t.sold.amount),
  };
}

/** Shared scenes: "vs" when the co-star went the other way, else who moved first. Swaps count as buys. */
function sharedKey(t: Trade): "first" | "after" | "vs" {
  const sold = t.action === "sell";
  const coStarSold = t.coStarAction === "sell";
  if (sold !== coStarSold) return "vs";
  return (t.coStarAt ?? 0) > t.at ? "first" : "after";
}

function captionKey(t: Trade): string {
  if (t.kind === "reversal") return t.action === "buy" ? "reversal:buy" : "reversal:sell";
  if (t.kind === "shared") return `shared:${t.action === "sell" ? "sell" : "buy"}:${sharedKey(t)}`;
  return t.kind;
}

/** A title for the scene; rotates through the variants so no title repeats within an episode. */
function sceneTitle(t: Trade, used: Set<string>): string {
  const variants: readonly string[] =
    t.kind === "reversal"
      ? t.action === "buy"
        ? ["The Return", "Back for More"]
        : ["Second Thoughts", "What Was Promised"]
      : t.kind === "shared" && sharedKey(t) === "vs"
        ? ["One of Them Is Wrong", "Opposite Doors"]
        : TITLE_VARIANTS[t.kind];
  const start = hashString(`${t.txHash}:title`) % variants.length;
  for (let i = 0; i < variants.length; i++) {
    const title = variants[(start + i) % variants.length] as string;
    if (!used.has(title)) {
      used.add(title);
      return title;
    }
  }
  return variants[start] as string;
}

/**
 * 8–12 trades: one per cast member, the setup half of every chosen reversal (the audience needs the
 * "before"), then the most dramatic trades to fill up to ten.
 */
function selectScenes(cast: Member[]): Trade[] {
  const MIN = 8;
  const TARGET = 10;
  const MAX = 12;
  const all = cast.flatMap((m) => m.trades);
  const byDrama = [...all].sort((a, b) => b.drama - a.drama || a.at - b.at);
  const chosen = new Set<Trade>();
  const addSetups = () => {
    for (const t of [...chosen]) {
      if (t.kind !== "reversal" || chosen.size >= MAX) continue;
      const m = cast.find((c) => c.key === t.walletKey);
      const setup = m?.trades.filter((s) => s.symbol === t.symbol && s.at < t.at && s.action === t.prevAction).at(-1);
      if (setup) chosen.add(setup);
    }
  };
  for (const m of cast) {
    const best = byDrama.find((t) => t.walletKey === m.key);
    if (best) chosen.add(best);
  }
  addSetups();
  for (const t of byDrama) {
    if (chosen.size >= TARGET) break;
    chosen.add(t);
  }
  addSetups();
  for (const t of byDrama) {
    if (chosen.size >= MIN) break;
    chosen.add(t);
  }
  return [...chosen].sort((a, b) => a.at - b.at).slice(0, MAX);
}

function recapLine(t: Trade, m: Member, coStar: Member | undefined): string {
  const v = captionVars(t, m, coStar);
  switch (t.kind) {
    case "reversal":
      return fill("{name} changed {hers} mind about {cash}.", v);
    case "shared":
      return fill(
        sharedKey(t) === "vs"
          ? "{name} and {costar} disagreed about {cash}."
          : t.action === "sell"
            ? "{name} and {costar} both gave up on {cash}."
            : "{name} and {costar} both wanted {cash}.",
        v,
      );
    case "rotation":
      return fill("{name} traded {sold} for {cash}.", v);
    case "big-sell":
    case "sell":
      return fill("{name} sold {value} of {cash}.", v);
    default:
      return fill("{name} bought {value} of {cash}.", v);
  }
}

function synopsisPhrase(t: Trade, m: Member, coStar: Member | undefined): string {
  const v = captionVars(t, m, coStar);
  switch (t.kind) {
    case "reversal":
      return fill("changes {hers} mind about {cash}", v);
    case "shared": {
      const key = `${t.action === "sell" ? "sell" : "buy"}:${sharedKey(t)}`;
      const phrase: Record<string, string> = {
        "buy:first": "puts {value} into {cash} with {costar} close behind",
        "buy:after": "follows {costar} into {cash} with {value}",
        "buy:vs": "buys {value} of {cash} while {costar} sells",
        "sell:vs": "sells {value} of {cash} while {costar} holds on",
        "sell:first": "sells {value} of {cash} before {costar} can",
        "sell:after": "follows {costar} out of {cash} with {value}",
      };
      return fill(phrase[key] ?? "goes after {cash}, the same token as {costar}", v);
    }
    case "rotation":
      return fill("trades {sold} for {cash}", v);
    case "big-sell":
    case "sell":
      return fill("walks away from {amount} {sym}", v);
    default:
      return fill("puts {value} into {cash}", v);
  }
}

function episodeTitle(t: Trade): string {
  switch (t.kind) {
    case "reversal":
      return `Second Thoughts About $${t.symbol}`;
    case "shared":
      return `Two Wallets, One $${t.symbol}`;
    case "big-sell":
      return `The $${t.symbol} Farewell`;
    case "big-buy":
      return `A ${usd(t.valueUsd)} Proposal`;
    case "rotation":
      return `The $${t.sold.symbol}-for-$${t.symbol} Affair`;
    case "sell":
      return `Goodbye, $${t.symbol}`;
    default:
      return `The $${t.symbol} Temptation`;
  }
}

/** Series premiere, for the episode number. */
const PREMIERE = Date.UTC(2026, 0, 5);

/* ------------------------------------------------------------------------------------------------
 * Builder. 5 credits for the tape + 1 per cast member = 11 on a full run (cap 20).
 * ---------------------------------------------------------------------------------------------- */

export async function buildAsTheChainTurns(nansen: NansenClient): Promise<AsTheChainTurnsData> {
  // 1) The day's tape: the 100 most recent smart money DEX trades. 5 credits.
  const res = await nansen.smartMoney.dexTrades({
    chains: [...CHAINS],
    order_by: [{ field: "block_timestamp", direction: "DESC" }],
    pagination: { page: 1, per_page: 100 },
  });
  const trades = (res.data ?? []).map(toTrade).filter((t): t is Trade => t !== null);
  if (!trades.length) throw new Error("No smart money DEX trades came back; nothing to film.");

  // The last day of trades: 24 hours back from the newest one. If the tape is thin, keep it all.
  const newest = Math.max(...trades.map((t) => t.at));
  const inDay = trades.filter((t) => t.at >= newest - 86_400_000);
  const tape = inDay.length >= 24 ? inDay : trades;
  const window = { from: new Date(Math.min(...tape.map((t) => t.at))).toISOString(), to: new Date(newest).toISOString() };

  // 2) The cast: the six most active and valuable wallets.
  const cast = groupMembers(tape).slice(0, 6);
  nameCast(cast);
  annotate(cast);

  // 3) Backstory: 30-day profile per cast member. 1 credit each. A failed profile plays as an unknown.
  const date = lastDays(30);
  for (const m of cast) {
    try {
      const s = await nansen.profiler.pnlSummary({ wallet_address: m.address, chain: m.chain, date }, { tag: `cast:${m.address.slice(0, 8)}` });
      m.profile = {
        pnl: num(s.realized_pnl_usd),
        roi: pct(s.realized_pnl_percent),
        winRate: pct(s.win_rate),
        trades: num(s.traded_times),
        tokens: num(s.traded_token_count),
        top: (s.top5_tokens ?? []).map((t) => t.token_symbol).filter(Boolean).slice(0, 5),
      };
    } catch {
      /* the profiler has no file on this wallet; the numbers stay at zero */
    }
  }
  assignArchetypes(cast);

  const byAddress = new Map(cast.map((m) => [m.address, m]));
  const members: CastMember[] = cast.map((m) => {
    const tokens = [...m.trades]
      .sort((a, b) => b.valueUsd - a.valueUsd)
      .flatMap((t) => (t.action === "swap" ? [t.symbol, t.sold.symbol] : [t.symbol]))
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .slice(0, 8);
    return {
      address: m.address,
      label: m.label,
      chain: m.chain,
      character: { name: m.name, role: roleFor(m, cast), archetype: m.archetype, pronoun: m.pronoun, hue: m.hue },
      stats: {
        trades: m.trades.length,
        buys: m.trades.filter((t) => t.action === "buy").length,
        sells: m.trades.filter((t) => t.action === "sell").length,
        swaps: m.trades.filter((t) => t.action === "swap").length,
        volumeUsd: Math.round(m.volumeUsd),
        biggestTradeUsd: Math.round(Math.max(...m.trades.map((t) => t.valueUsd))),
        tokens,
        pnl30dUsd: Math.round(m.profile.pnl),
        roi30dPct: Math.round(m.profile.roi * 10) / 10,
        winRate30dPct: Math.round(m.profile.winRate * 10) / 10,
        trades30d: m.profile.trades,
        tokens30d: m.profile.tokens,
        topTokens: m.profile.top,
      },
    };
  });

  // 4) Tonight's scenes, in air order.
  const picked = selectScenes(cast);
  const usedTitles = new Set<string>();
  const scenes: Scene[] = picked.map((t, i) => {
    const m = byAddress.get(t.wallet) ?? cast.find((c) => c.key === t.walletKey);
    if (!m) throw new Error("scene without an actor");
    const coStar = t.coStar ? byAddress.get(t.coStar) : undefined;
    const dramatic = t.kind === "reversal" || t.kind === "shared" || t.kind === "big-buy" || t.kind === "big-sell";
    const variants = CAPTIONS[captionKey(t)] ?? CAPTIONS.buy!;
    const scene: Scene = {
      index: i + 1,
      title: sceneTitle(t, usedTitles),
      at: t.iso,
      wallet: m.address,
      action: t.action,
      symbol: t.symbol,
      valueUsd: Math.round(t.valueUsd),
      caption: fill(pick(variants, hashString(`${t.txHash}:caption`)), captionVars(t, m, coStar)),
      zoom: dramatic ? "dramatic" : "slow",
      kind: t.kind,
      chain: t.chain,
      txHash: t.txHash,
      amount: t.amount,
      pair: { sold: t.sold, bought: t.bought },
    };
    if (coStar) scene.coStar = coStar.address;
    return scene;
  });

  // 5) The episode: number from the air date, title and synopsis from the biggest beats.
  const beats = [...picked].sort((a, b) => b.drama - a.drama);
  const lead = beats[0];
  if (!lead) throw new Error("an episode needs at least one scene");
  const actor = (t: Trade) => cast.find((c) => c.key === t.walletKey)!;
  const coStarOf = (t: Trade) => (t.coStar ? byAddress.get(t.coStar) : undefined);
  const second = beats.find((t) => t.walletKey !== lead.walletKey);
  const sceneCounts = new Map<string, number>();
  for (const t of picked) sceneCounts.set(t.walletKey, (sceneCounts.get(t.walletKey) ?? 0) + 1);
  // The one nobody has heard from: fewest scenes, least important, and not already in the synopsis.
  const named = new Set([lead.wallet, lead.coStar, second?.wallet, second?.coStar].filter(Boolean));
  const quiet = [...cast]
    .filter((m) => !named.has(m.address))
    .sort((a, b) => (sceneCounts.get(a.key) ?? 0) - (sceneCounts.get(b.key) ?? 0) || a.score - b.score)[0];
  const totalUsd = picked.reduce((s, t) => s + t.valueUsd, 0);
  const tokenCount = new Set(picked.map((t) => t.symbol)).size;
  const hours = Math.max(1, Math.round((newest - Math.min(...tape.map((t) => t.at))) / 3_600_000));
  const synopsis =
    `${actor(lead).name} ${synopsisPhrase(lead, actor(lead), coStarOf(lead))} ${timeOfDay(lead.iso)}` +
    (second ? `, and ${actor(second).name} ${synopsisPhrase(second, actor(second), coStarOf(second))}` : "") +
    `. ${cast.length} wallets, ${plural(tokenCount, "token")} and ${usd(totalUsd)} on the move in ${plural(hours, "hour")}` +
    (quiet ? `, and nobody has heard from ${quiet.name}.` : ".");
  const previously = beats
    .slice(0, 3)
    .sort((a, b) => a.at - b.at)
    .map((t) => ({ wallet: actor(t).address, text: recapLine(t, actor(t), coStarOf(t)) }));
  const airDate = new Date(newest).toISOString().slice(0, 10);

  return {
    generatedAt: new Date().toISOString(),
    window,
    episode: {
      number: Math.max(1, Math.floor((Date.UTC(Number(airDate.slice(0, 4)), Number(airDate.slice(5, 7)) - 1, Number(airDate.slice(8, 10))) - PREMIERE) / 86_400_000) + 1),
      title: episodeTitle(lead),
      synopsis,
      airDate,
      previously,
    },
    cast: members,
    scenes,
  };
}
