import type { NansenClient, RowOf } from "@longitude/nansen";
import { lastDays } from "@longitude/nansen";

/** The herd is drawn from the 30-day smart money PnL leaderboard on these chains. */
const CHAINS = ["ethereum", "solana", "base"] as const;
const HERD_SIZE = 40;
/** DEEP=1: a bigger herd, and recent form for the first animals. */
const DEEP_HERD_SIZE = 60;
const DEEP_FORM_COUNT = 40;

export type SpeciesId = "whale" | "fox" | "hummingbird" | "tortoise" | "hyena" | "elephant" | "meerkat";
export type AnimalChain = "ethereum" | "solana" | "base" | "evm";

export interface Species {
  id: SpeciesId;
  name: string;
  latin: string;
  /** Plain-language classification rule. Rules apply in `species[]` order; the last one always matches. */
  rule: string;
  description: string;
  /** The rule with this season's actual herd numbers filled in. */
  cutoff: string;
}

export interface AnimalStats {
  /** Percent, 0..100. */
  winRate: number;
  /** Total 30-day PnL (realized + unrealized), USD. */
  pnlUsd: number;
  trades: number;
  /** Distinct tokens traded in the window. */
  tokens: number;
  /** Average trade ROI, percent. */
  avgRoi: number;
  /** Tokens currently held. */
  heldTokens: number;
  unrealizedPnlUsd: number;
  openTrades: number;
}

/** Thirty-day realized form from the profiler, only present on deep seeds. */
export interface RecentForm {
  realizedPnlUsd: number;
  /** Percent, 0..100. */
  winRate: number;
  trades: number;
  tokens: number;
}

export interface Animal {
  /** Specimen number, 1-based, in `animals[]` order. */
  number: number;
  address: string;
  chain: AnimalChain;
  label: string;
  species: SpeciesId;
  stats: AnimalStats;
  topTokens: string[];
  /** Two or three field notes written from the numbers; deep seeds add a fourth on recent form. */
  notes: string[];
  recentForm?: RecentForm;
}

export interface HerdStats {
  winRate: number;
  pnlUsd: number;
  trades: number;
  tokens: number;
  avgRoi: number;
  heldTokens: number;
}

export interface Herd {
  size: number;
  medians: HerdStats;
  /** The cut lines the species rules are measured against, computed from this season's herd. */
  cuts: {
    /** 90th percentile of total PnL. */
    whalePnlUsd: number;
    /** 75th percentile of trades. */
    busyTrades: number;
    /** 25th percentile of trades. */
    stillTrades: number;
    /** 75th percentile of tokens traded. */
    manyTokens: number;
    /** 75th percentile of tokens held. */
    manyHeldTokens: number;
  };
}

export interface MenagerieData {
  generatedAt: string;
  window: { from: string; to: string };
  herd: Herd;
  species: Species[];
  animals: Animal[];
}

type LeaderRow = RowOf<"/api/v1/smart-money/pnl-leaderboard">;

/* ---------- number helpers ---------- */

const num = (v: number | string | null | undefined): number => Number(v ?? 0) || 0;
/** The spec gives win rate and average trade ROI as fractions; the journal speaks in percent. */
const pct = (v: number | null | undefined): number => num(v) * 100;

export function percentile(values: number[], p: number): number {
  const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!s.length) return 0;
  const pos = (s.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = s[lo] ?? 0;
  const b = s[hi] ?? a;
  return Math.round((a + (b - a) * (pos - lo)) * 100) / 100;
}

const usd = (n: number): string => {
  const a = Math.abs(n);
  const s = a >= 1e9 ? `$${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${(a / 1e3).toFixed(0)}K` : `$${a.toFixed(0)}`;
  return n < 0 ? `-${s}` : s;
};
const int = (n: number): string => Math.round(n).toLocaleString("en-US");
const pc = (n: number): string => `${Math.round(n)}%`;
const pcSigned = (n: number): string => `${n > 0 ? "+" : ""}${Math.round(n)}%`;
const times = (a: number, b: number): string => {
  if (b <= 0) return "many times";
  const r = a / b;
  return `${r >= 10 ? r.toFixed(0) : r.toFixed(1)}×`;
};

/* ---------- species: the rules, as data, in priority order ---------- */

interface SpeciesRule extends Omit<Species, "cutoff"> {
  test: (s: AnimalStats, h: Herd) => boolean;
  cutoff: (h: Herd) => string;
}

/**
 * Applied top to bottom; the first rule that matches names the species, and the meerkat rule
 * matches everything, so every wallet gets exactly one species.
 */
export const SPECIES: readonly SpeciesRule[] = [
  {
    id: "whale",
    name: "Whale",
    latin: "Balaenoptera lucri",
    rule: "Total 30-day PnL in the top tenth of the herd.",
    description:
      "Rarely seen and impossible to miss. Moves slowly through the deep end of the leaderboard and displaces more than the rest of the plain together.",
    test: (s, h) => s.pnlUsd >= h.cuts.whalePnlUsd,
    cutoff: (h) => `This season: ${usd(h.cuts.whalePnlUsd)} or more.`,
  },
  {
    id: "hyena",
    name: "Hyena",
    latin: "Crocuta opportuna",
    rule: "Wins at least ten points less often than the herd's median win rate, yet earns more than the median wallet.",
    description: "Laughs at its own win rate. Loses often and small, then walks off with the whole carcass.",
    test: (s, h) => s.winRate <= h.medians.winRate - 10 && s.pnlUsd >= h.medians.pnlUsd,
    cutoff: (h) => `This season: win rate of ${pc(h.medians.winRate - 10)} or less, PnL above ${usd(h.medians.pnlUsd)}.`,
  },
  {
    id: "fox",
    name: "Fox",
    latin: "Vulpes calculans",
    rule: "Wins at least ten points more often than the herd's median win rate, on no more than the median number of trades.",
    description: "Small, quick and precise. Hunts seldom and rarely misses; distrusts any trade it has not watched for a week.",
    test: (s, h) => s.winRate >= h.medians.winRate + 10 && s.trades <= h.medians.trades,
    cutoff: (h) => `This season: win rate of ${pc(h.medians.winRate + 10)} or more, ${int(h.medians.trades)} trades or fewer.`,
  },
  {
    id: "tortoise",
    name: "Tortoise",
    latin: "Testudo patiens",
    rule: "Fewer trades than three-quarters of the herd, with an average trade ROI above the herd's median.",
    description: "Slow by choice. A handful of trades a month, each carried to the end; outlives faster things by not hurrying.",
    test: (s, h) => s.trades <= h.cuts.stillTrades && s.avgRoi >= h.medians.avgRoi,
    cutoff: (h) => `This season: ${int(h.cuts.stillTrades)} trades or fewer, average ROI above ${pcSigned(h.medians.avgRoi)}.`,
  },
  {
    id: "hummingbird",
    name: "Hummingbird",
    latin: "Colibri insatiabilis",
    rule: "In the busiest quarter of the herd by trades, or above-median trades spread across one of the widest quarter of token lists.",
    description: "Never still. Sips from a hundred tokens a day and burns most of what it takes on the flying.",
    test: (s, h) => s.trades >= h.cuts.busyTrades || (s.trades >= h.medians.trades && s.tokens >= h.cuts.manyTokens),
    cutoff: (h) => `This season: ${int(h.cuts.busyTrades)} trades or more, or ${int(h.medians.trades)}+ trades across ${int(h.cuts.manyTokens)}+ tokens.`,
  },
  {
    id: "elephant",
    name: "Elephant",
    latin: "Loxodonta memor",
    rule: "Holds more tokens right now than three-quarters of the herd.",
    description: "Keeps everything. A long memory and a longer list of holdings; moves the ground when it moves at all.",
    test: (s, h) => s.heldTokens >= h.cuts.manyHeldTokens,
    cutoff: (h) => `This season: ${int(h.cuts.manyHeldTokens)} tokens held or more.`,
  },
  {
    id: "meerkat",
    name: "Meerkat",
    latin: "Suricata vigilans",
    rule: "Every wallet no other species claims: modest PnL, unremarkable habits, one of the mob.",
    description: "The commonest animal on the plain. Small, consistent, forever up on hind legs scanning for what the others have seen.",
    test: () => true,
    cutoff: () => "This season: everything the six rules above did not claim.",
  },
];

export const SPECIES_ORDER: readonly SpeciesId[] = SPECIES.map((s) => s.id);

export function classify(stats: AnimalStats, herd: Herd): SpeciesId {
  for (const s of SPECIES) if (s.test(stats, herd)) return s.id;
  return "meerkat";
}

export function herdOf(all: AnimalStats[]): Herd {
  const trades = all.map((s) => s.trades);
  return {
    size: all.length,
    medians: {
      winRate: percentile(all.map((s) => s.winRate), 0.5),
      pnlUsd: percentile(all.map((s) => s.pnlUsd), 0.5),
      trades: percentile(trades, 0.5),
      tokens: percentile(all.map((s) => s.tokens), 0.5),
      avgRoi: percentile(all.map((s) => s.avgRoi), 0.5),
      heldTokens: percentile(all.map((s) => s.heldTokens), 0.5),
    },
    cuts: {
      whalePnlUsd: percentile(all.map((s) => s.pnlUsd), 0.9),
      busyTrades: percentile(trades, 0.75),
      stillTrades: percentile(trades, 0.25),
      manyTokens: percentile(all.map((s) => s.tokens), 0.75),
      manyHeldTokens: percentile(all.map((s) => s.heldTokens), 0.75),
    },
  };
}

/* ---------- field notes, in a naturalist's voice ---------- */

type Fact = "win" | "pnl" | "trades" | "tokens" | "roi" | "held";

function leadNote(id: SpeciesId, s: AnimalStats, h: Herd): { text: string; used: Fact[] } {
  switch (id) {
    case "whale":
      return {
        text: `Displaces ${usd(s.pnlUsd)} in thirty days, ${times(s.pnlUsd, h.medians.pnlUsd)} the herd's median take; the largest body in this stretch of water.`,
        used: ["pnl"],
      };
    case "hyena":
      return {
        text: `Wins only ${pc(s.winRate)} of its exits and still carries off ${usd(s.pnlUsd)}; the misses are small and the meals are not.`,
        used: ["win", "pnl"],
      };
    case "fox":
      return {
        text: `Pounces ${int(s.trades)} times in thirty days and lands ${pc(s.winRate)} of them; it does not waste a strike.`,
        used: ["trades", "win"],
      };
    case "tortoise":
      return {
        text: `Only ${int(s.trades)} trades all month, each returning ${pcSigned(s.avgRoi)} on average; it gets where it is going.`,
        used: ["trades", "roi"],
      };
    case "hummingbird": {
      const perDay = s.trades / 30;
      const pace = perDay >= 1 ? `about ${int(perDay)} a day` : `one every ${int(30 / Math.max(1, s.trades))} days`;
      return {
        text: `${int(s.trades)} trades across ${int(s.tokens)} tokens in thirty days, ${pace}; it is never still.`,
        used: ["trades", "tokens"],
      };
    }
    case "elephant":
      return {
        text: `Holds ${int(s.heldTokens)} tokens at this writing, more than three of every four wallets on the plain; it drops nothing and forgets less.`,
        used: ["held"],
      };
    case "meerkat":
      return {
        text: `${usd(s.pnlUsd)} in thirty days at a ${pc(s.winRate)} clip; small, upright, and forever scanning the horizon.`,
        used: ["pnl", "win"],
      };
  }
}

function secondNote(s: AnimalStats, h: Herd, used: Fact[]): string {
  const m = h.medians;
  const free = (f: Fact) => !used.includes(f);
  if (free("win") && s.winRate - m.winRate >= 8) return `Wins ${int(s.winRate)} of every 100 exits where the herd manages ${int(m.winRate)}.`;
  if (free("win") && m.winRate - s.winRate >= 8) return `Wins ${int(s.winRate)} of every 100 exits against a herd median of ${int(m.winRate)}.`;
  if (free("trades") && s.trades >= h.cuts.busyTrades) return `Moves ${int(s.trades)} times a month, in the busiest quarter of the plain.`;
  if (free("trades") && s.trades <= h.cuts.stillTrades) return `Just ${int(s.trades)} trades this month; among the stillest creatures here.`;
  if (free("pnl") && s.pnlUsd < 0) return `Ended the month ${usd(s.pnlUsd)} down and is still counted among the herd.`;
  if (free("pnl") && m.pnlUsd > 0 && s.pnlUsd >= 2 * m.pnlUsd) return `Takes ${usd(s.pnlUsd)} in a month, ${times(s.pnlUsd, m.pnlUsd)} the median wallet.`;
  if (free("pnl") && m.pnlUsd > 0 && s.pnlUsd <= 0.5 * m.pnlUsd)
    return `A modest ${usd(s.pnlUsd)} for the month, about ${int((s.pnlUsd / m.pnlUsd) * 100)}% of the herd's median.`;
  if (free("roi") && m.avgRoi > 0 && s.avgRoi >= 1.5 * m.avgRoi) return `Average trade returns ${pcSigned(s.avgRoi)}, against a herd norm of ${pcSigned(m.avgRoi)}.`;
  if (free("roi") && m.avgRoi > 0 && s.avgRoi <= 0.5 * m.avgRoi) return `Average trade returns just ${pcSigned(s.avgRoi)}; it earns by volume, not by margin.`;
  if (free("tokens") && s.tokens >= h.cuts.manyTokens) return `Has tasted ${int(s.tokens)} different tokens this month.`;
  if (free("trades")) return `Trades ${int(s.trades)} times a month, near the herd's own rhythm of ${int(m.trades)}.`;
  if (free("win")) return `Its ${pc(s.winRate)} win rate sits near the herd's median of ${pc(m.winRate)}.`;
  return "Nothing in its numbers stands out from the herd, which is itself a kind of camouflage.";
}

function thirdNote(s: AnimalStats, h: Herd, used: Fact[]): string | undefined {
  const scale = Math.max(1000, Math.abs(s.pnlUsd));
  if (s.unrealizedPnlUsd >= 0.25 * scale) return `Carries ${usd(s.unrealizedPnlUsd)} of unrealized gains on its back, not yet cashed.`;
  if (s.unrealizedPnlUsd <= -0.2 * scale) return `Nurses ${usd(-s.unrealizedPnlUsd)} of open losses and has not let go.`;
  if (!used.includes("held") && s.heldTokens >= h.cuts.manyHeldTokens) return `Keeps ${int(s.heldTokens)} tokens in its den at present.`;
  if (s.openTrades > 0) return `${int(s.openTrades)} ${s.openTrades === 1 ? "position" : "positions"} still open as of this entry.`;
  return undefined;
}

export function fieldNotes(id: SpeciesId, s: AnimalStats, h: Herd): string[] {
  const lead = leadNote(id, s, h);
  const notes = [lead.text, secondNote(s, h, lead.used)];
  const third = thirdNote(s, h, lead.used);
  if (third) notes.push(third);
  return notes;
}

/** The deep-seed line: what the profiler says the animal actually banked lately. */
export function formNote(f: RecentForm): string {
  if (f.realizedPnlUsd > 0) return `Fresh tracks: ${usd(f.realizedPnlUsd)} realized these last thirty days, ${pc(f.winRate)} of its exits in profit.`;
  if (f.realizedPnlUsd < 0) return `Fresh tracks: ${usd(-f.realizedPnlUsd)} given back these last thirty days; ${pc(f.winRate)} of its exits in profit.`;
  return f.trades > 0
    ? `Fresh tracks: nothing realized these last thirty days across ${int(f.trades)} trades.`
    : "Fresh tracks: none; it has not closed a trade these last thirty days.";
}

/* ---------- row → animal ---------- */

function toStats(row: LeaderRow): AnimalStats {
  return {
    winRate: pct(row.win_rate),
    pnlUsd: num(row.total_pnl_usd),
    trades: num(row.n_trades),
    tokens: num(row.n_tokens),
    avgRoi: pct(row.avg_trade_roi),
    heldTokens: num(row.held_tokens_count),
    unrealizedPnlUsd: num(row.unrealized_pnl_usd),
    openTrades: num(row.open_trades),
  };
}

type TokenInfo = Record<string, unknown>[] | undefined;

/** The token info arrays are untyped in the spec; read symbols defensively. */
function tokenSymbols(info: TokenInfo, max: number): string[] {
  const out: string[] = [];
  for (const t of info ?? []) {
    const sym = [t.token_symbol, t.symbol, t.token, t.name].find((v): v is string => typeof v === "string" && v.trim().length > 0);
    if (sym && !out.includes(sym)) out.push(sym.trim());
    if (out.length >= max) break;
  }
  return out;
}

/** The row carries no chain; take it from the token info when present, else from the address shape. */
function inferChain(row: LeaderRow): AnimalChain {
  const votes = new Map<AnimalChain, number>();
  for (const t of [...(row.top_traded_tokens_info ?? []), ...(row.top_5_balance_tokens_info ?? [])]) {
    const c = t.chain;
    if (typeof c === "string" && (CHAINS as readonly string[]).includes(c)) votes.set(c as AnimalChain, (votes.get(c as AnimalChain) ?? 0) + 1);
  }
  const top = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) return top[0];
  return /^0x[0-9a-fA-F]{40}$/.test(row.address) ? "evm" : "solana";
}

/**
 * Builds the menagerie.
 * Standard: one leaderboard call, 5 credits. Deep (`DEEP=1` in the seed's environment): a herd of 60
 * from the same 5-credit call, plus `profiler.pnlSummary` for the first 40 animals at 1 credit each,
 * about 45 credits in all (seed cap 60). Animals whose chain is unknown ("evm") are not looked up.
 */
export async function buildMenagerie(nansen: NansenClient): Promise<MenagerieData> {
  const window = lastDays(30);
  const deep = process.env.DEEP === "1";

  const board = await nansen.smartMoney.pnlLeaderboard(
    { chains: [...CHAINS], timeframe: 30, pagination: { page: 1, per_page: deep ? DEEP_HERD_SIZE : HERD_SIZE } },
    { tag: "herd" },
  );

  // One specimen per address: the leaderboard can list a wallet once per chain.
  const byAddress = new Map<string, LeaderRow>();
  for (const row of board.data ?? []) {
    const key = row.address.toLowerCase();
    const prev = byAddress.get(key);
    if (!prev || num(row.total_pnl_usd) > num(prev.total_pnl_usd)) byAddress.set(key, row);
  }
  const rows = [...byAddress.values()];
  const statsList = rows.map(toStats);
  const herd = herdOf(statsList);
  const species: Species[] = SPECIES.map(({ test: _test, cutoff, ...s }) => ({ ...s, cutoff: cutoff(herd) }));

  const animals: Animal[] = rows.map((row, i) => {
    const stats = statsList[i] ?? toStats(row);
    const id = classify(stats, herd);
    return {
      number: 0,
      address: row.address,
      chain: inferChain(row),
      label: row.address_label?.trim() || "Smart Money",
      species: id,
      stats,
      topTokens: tokenSymbols(row.top_traded_tokens_info, 5),
      notes: fieldNotes(id, stats, herd),
    };
  });

  animals.sort((a, b) => SPECIES_ORDER.indexOf(a.species) - SPECIES_ORDER.indexOf(b.species) || b.stats.pnlUsd - a.stats.pnlUsd);
  animals.forEach((a, i) => {
    a.number = i + 1;
  });

  if (deep) {
    // Recent form for the first animals, one credit each. A wallet that fails to resolve is simply left without it.
    for (const animal of animals.slice(0, DEEP_FORM_COUNT)) {
      const chain = animal.chain;
      if (chain === "evm") continue;
      try {
        const summary = await nansen.profiler.pnlSummary(
          { wallet_address: animal.address, chain, date: window },
          { tag: `form:${animal.address.slice(0, 8)}` },
        );
        const form: RecentForm = {
          realizedPnlUsd: num(summary.realized_pnl_usd),
          winRate: pct(summary.win_rate),
          trades: num(summary.traded_times),
          tokens: num(summary.traded_token_count),
        };
        animal.recentForm = form;
        animal.notes.push(formNote(form));
      } catch (err) {
        console.error(`[menagerie] no recent form for ${animal.address}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { generatedAt: new Date().toISOString(), window, herd, species, animals };
}
