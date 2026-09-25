import type { NansenClient, RowOf } from "@longitude/nansen";
import { lastDays } from "@longitude/nansen";

/** Chains the prospect pipeline runs on. Netflow → token leaderboards → wallet summaries. */
const CHAINS = ["ethereum", "solana", "base"] as const;
type Chain = (typeof CHAINS)[number];

export interface CohortMedians {
  winRate: number; // percent 0..100
  pnlUsd: number;
  trades: number;
  tokens: number;
}

export interface Veteran {
  address: string;
  label: string;
  pnlUsd: number;
  winRate: number;
  trades: number;
  tokens: number;
}

export interface ProspectStats {
  winRate: number;
  pnlUsd: number;
  trades: number;
  tokens: number;
  /** Realized ROI in percent over the window. */
  roiPct: number;
}

export type Grade = "A" | "B" | "C";

export interface Prospect {
  number: number;
  address: string;
  chain: Chain;
  /** Token where the wallet was spotted trading alongside smart money. */
  spottedOn: { symbol: string; address: string; pnlUsd: number; stillHoldingRatio: number };
  stats: ProspectStats;
  topTokens: string[];
  similarity: number;
  grade: Grade;
  verdict: "Draft" | "Watch" | "Pass";
  report: string[];
}

export interface RookieScoutData {
  generatedAt: string;
  window: { from: string; to: string };
  cohort: { size: number; medians: CohortMedians; veterans: Veteran[] };
  tokensScouted: { symbol: string; address: string; chain: Chain; netFlow7dUsd: number }[];
  prospects: Prospect[];
}

type LeaderRow = RowOf<"/api/v1/smart-money/pnl-leaderboard">;
type NetflowRow = RowOf<"/api/v1/smart-money/netflow">;
type TokenTraderRow = RowOf<"/api/v1/tgm/pnl-leaderboard">;

const pct = (v: number | null | undefined): number => {
  const n = Number(v ?? 0);
  return n <= 1 ? n * 100 : n;
};
const num = (v: number | string | null | undefined): number => Number(v ?? 0) || 0;

function median(values: number[]): number {
  const s = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!s.length) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

const NOT_A_ROOKIE = /exchange|fund|smart|mev|bot|bridge|router|contract|deployer|market maker|treasury|protocol/i;

/**
 * 0..100: how closely a wallet's 90-day profile matches the smart money cohort's medians.
 * Each component is sqrt(value / median) capped at 1, so half the median scores 0.71 and a tenth
 * scores 0.32. Win rate is shrunk toward the cohort median with a 20-exit prior so a 3-for-3 wallet
 * does not read as a 100% trader. Negative realized PnL costs 15 points.
 */
export function similarity(p: ProspectStats, m: CohortMedians): number {
  const ratio = (a: number, b: number) => (a <= 0 ? 0 : Math.min(1, Math.sqrt(a / Math.max(b, 1e-9))));
  const prior = 20;
  const winAdj = (p.winRate * p.trades + m.winRate * prior) / (p.trades + prior);
  const win = m.winRate <= 0 ? (winAdj > 0 ? 1 : 0) : Math.min(1, winAdj / m.winRate);
  const pnl = ratio(p.pnlUsd, m.pnlUsd);
  const trades = ratio(p.trades, m.trades);
  const tokens = ratio(p.tokens, m.tokens);
  const penalty = p.pnlUsd < 0 ? 15 : 0;
  return Math.max(0, Math.round(100 * (0.35 * win + 0.3 * pnl + 0.2 * trades + 0.15 * tokens) - penalty));
}

export function grade(score: number): Grade {
  return score >= 75 ? "A" : score >= 55 ? "B" : "C";
}

export function verdict(g: Grade): Prospect["verdict"] {
  return g === "A" ? "Draft" : g === "B" ? "Watch" : "Pass";
}

const usd = (n: number) =>
  Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`;

export function scoutingReport(p: Omit<Prospect, "report" | "number">, m: CohortMedians): string[] {
  const s = p.stats;
  const lines: string[] = [];
  const w = Math.round(s.winRate);
  const mw = Math.round(m.winRate);
  lines.push(
    w === mw
      ? `Wins ${w}% of exits, right on the smart money median.`
      : w > mw
        ? `Wins ${w}% of exits, above the smart money median of ${mw}%.`
        : `Wins ${w}% of exits, below the smart money median of ${mw}%.`,
  );
  lines.push(
    s.pnlUsd > 0
      ? `Booked ${usd(s.pnlUsd)} realized over 90 days (${s.roiPct >= 0 ? "+" : ""}${s.roiPct.toFixed(0)}% ROI). Cohort median ${usd(m.pnlUsd)}.`
      : `Sitting on ${usd(s.pnlUsd)} realized over 90 days. Cohort median ${usd(m.pnlUsd)}.`,
  );
  lines.push(
    `${s.trades} exits across ${s.tokens} tokens. ${s.trades >= m.trades ? "Active at smart money pace." : "Trades less often than the cohort."}`,
  );
  lines.push(
    `Spotted on $${p.spottedOn.symbol} with ${usd(p.spottedOn.pnlUsd)} PnL, ${Math.round(p.spottedOn.stillHoldingRatio * 100)}% of its peak bag still held.`,
  );
  return lines;
}

/** Builds the draft board. About 45 credits on a full run (cap 100). */
export async function buildRookieScout(nansen: NansenClient): Promise<RookieScoutData> {
  const window30 = lastDays(30);
  const window90 = lastDays(90);

  // 1) The veterans: top smart money wallets by 30-day PnL. 5 credits.
  const leaderboard = await nansen.smartMoney.pnlLeaderboard({
    chains: [...CHAINS],
    timeframe: 30,
    pagination: { page: 1, per_page: 50 },
  });
  const rows: LeaderRow[] = leaderboard.data ?? [];
  const cohortAddresses = new Set(rows.map((r) => r.address.toLowerCase()));
  const medians: CohortMedians = {
    winRate: median(rows.map((r) => pct(r.win_rate))),
    pnlUsd: median(rows.map((r) => num(r.total_pnl_usd))),
    trades: median(rows.map((r) => num(r.n_trades))),
    tokens: median(rows.map((r) => num(r.n_tokens))),
  };
  const veterans: Veteran[] = [...rows]
    .sort((a, b) => num(b.total_pnl_usd) - num(a.total_pnl_usd))
    .slice(0, 5)
    .map((r) => ({
      address: r.address,
      label: r.address_label || "Smart Money",
      pnlUsd: num(r.total_pnl_usd),
      winRate: pct(r.win_rate),
      trades: num(r.n_trades),
      tokens: num(r.n_tokens),
    }));

  // 2) Where to scout: tokens smart money is accumulating this week. 5 credits.
  const netflow = await nansen.smartMoney.netflow({
    chains: [...CHAINS],
    filters: { include_stablecoins: false, include_native_tokens: false },
    order_by: [{ field: "net_flow_7d_usd", direction: "DESC" }],
    pagination: { page: 1, per_page: 5 },
  });
  const tokens = (netflow.data ?? [])
    .filter((t: NetflowRow) => (CHAINS as readonly string[]).includes(t.chain) && num(t.net_flow_7d_usd) > 0)
    .slice(0, 5);
  const tokensScouted = tokens.map((t) => ({
    symbol: t.token_symbol,
    address: t.token_address,
    chain: t.chain as Chain,
    netFlow7dUsd: num(t.net_flow_7d_usd),
  }));

  // 3) Candidates: the best traders of each of those tokens who are not in the cohort. 5 credits per token.
  const candidates = new Map<string, { row: TokenTraderRow; token: (typeof tokensScouted)[number] }>();
  for (const token of tokensScouted) {
    const board = await nansen.tgm.pnlLeaderboard(
      { chain: token.chain, token_address: token.address, date: window30, pagination: { page: 1, per_page: 20 } },
      { tag: `token:${token.symbol}` },
    );
    for (const row of board.data ?? []) {
      const addr = row.trader_address.toLowerCase();
      if (cohortAddresses.has(addr)) continue;
      if (row.trader_address_label && NOT_A_ROOKIE.test(row.trader_address_label)) continue;
      if (num(row.pnl_usd_total) <= 0) continue;
      if (!candidates.has(addr)) candidates.set(addr, { row, token });
    }
  }
  const shortlist = [...candidates.values()].sort((a, b) => num(b.row.pnl_usd_total) - num(a.row.pnl_usd_total)).slice(0, 12);

  // 4) Scouting: 90-day profile per candidate. 1 credit each.
  const prospects: Prospect[] = [];
  for (const { row, token } of shortlist) {
    const summary = await nansen.profiler.pnlSummary(
      { wallet_address: row.trader_address, chain: token.chain, date: window90 },
      { tag: `prospect:${row.trader_address.slice(0, 8)}` },
    );
    const stats: ProspectStats = {
      winRate: pct(summary.win_rate),
      pnlUsd: num(summary.realized_pnl_usd),
      trades: num(summary.traded_times),
      tokens: num(summary.traded_token_count),
      // realized_pnl_percent is documented as a fraction ("not multiplied by 100"), and can exceed 1.
      roiPct: num(summary.realized_pnl_percent) * 100,
    };
    const score = similarity(stats, medians);
    const g = grade(score);
    const base = {
      address: row.trader_address,
      chain: token.chain,
      spottedOn: {
        symbol: token.symbol,
        address: token.address,
        pnlUsd: num(row.pnl_usd_total),
        stillHoldingRatio: Math.max(0, Math.min(1, num(row.still_holding_balance_ratio))),
      },
      stats,
      topTokens: [...new Set((summary.top5_tokens ?? []).map((t) => t.token_symbol).filter(Boolean))].slice(0, 5),
      similarity: score,
      grade: g,
      verdict: verdict(g),
    };
    prospects.push({ number: 0, ...base, report: scoutingReport(base, medians) });
  }
  prospects.sort((a, b) => b.similarity - a.similarity);
  prospects.forEach((p, i) => {
    p.number = i + 1;
  });

  return {
    generatedAt: new Date().toISOString(),
    window: window90,
    cohort: { size: rows.length, medians, veterans },
    tokensScouted,
    prospects,
  };
}
