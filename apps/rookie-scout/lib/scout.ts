import { getNansen, lastDays, looksLikeAddress } from "@longitude/nansen";
import { type CohortMedians, type Grade, type Prospect, type ProspectStats, grade, scoutingReport, similarity, verdict } from "./data";

export type ScoutChain = "ethereum" | "base" | "solana";

export interface ScoutResult {
  address: string;
  chain: ScoutChain;
  stats: ProspectStats;
  topTokens: string[];
  similarity: number;
  grade: Grade;
  verdict: Prospect["verdict"];
  report: string[];
  credits: number;
  fetchedAt: string;
  /** True when the wallet had no exits in the window on any chain we tried. */
  quiet: boolean;
}

export const DEFAULT_MEDIANS: CohortMedians = { winRate: 50, pnlUsd: 500_000, trades: 800, tokens: 20 };

function candidateChains(address: string, preferred?: string): ScoutChain[] {
  if (preferred === "ethereum" || preferred === "base" || preferred === "solana") return [preferred];
  if (address.startsWith("0x")) return ["ethereum", "base"];
  return ["solana"];
}

/** Live 90-day profile for any wallet, scored like a prospect. 1 credit per chain tried (cached 5 min). */
export async function scoutWallet(address: string, preferred: string | undefined, medians: CohortMedians): Promise<ScoutResult | { error: string }> {
  const chains = candidateChains(address, preferred);
  if (!chains.some((c) => looksLikeAddress(address, c))) return { error: "That does not look like an Ethereum, Base or Solana address." };
  const nansen = getNansen("app:rookie-scout");
  const before = nansen.credits.spent;
  const window90 = lastDays(90);
  let best: { chain: ScoutChain; stats: ProspectStats; topTokens: string[] } | undefined;
  for (const chain of chains) {
    try {
      const s = await nansen.profiler.pnlSummary({ wallet_address: address, chain, date: window90 }, { tag: `scout:${address.slice(0, 8)}` });
      const win = Number(s.win_rate ?? 0);
      const stats: ProspectStats = {
        winRate: win <= 1 ? win * 100 : win,
        pnlUsd: Number(s.realized_pnl_usd ?? 0) || 0,
        trades: Number(s.traded_times ?? 0) || 0,
        tokens: Number(s.traded_token_count ?? 0) || 0,
        roiPct: (Number(s.realized_pnl_percent ?? 0) || 0) * 100,
      };
      const topTokens = [...new Set((s.top5_tokens ?? []).map((t) => t.token_symbol).filter(Boolean))].slice(0, 5);
      if (!best || stats.trades > best.stats.trades) best = { chain, stats, topTokens };
      if (stats.trades > 0) break;
    } catch (err) {
      if (!best && chain === chains[chains.length - 1]) return { error: err instanceof Error ? err.message : String(err) };
    }
  }
  if (!best) return { error: "Nansen returned nothing for that wallet." };
  const score = similarity(best.stats, medians);
  const g = grade(score);
  const base = {
    address,
    chain: best.chain,
    spottedOn: { symbol: "your lookup", address: "", pnlUsd: best.stats.pnlUsd, stillHoldingRatio: 0 },
    stats: best.stats,
    topTokens: best.topTokens,
    similarity: score,
    grade: g,
    verdict: verdict(g),
  };
  const report = scoutingReport(base, medians).slice(0, 3);
  return {
    address,
    chain: best.chain,
    stats: best.stats,
    topTokens: best.topTokens,
    similarity: score,
    grade: g,
    verdict: verdict(g),
    report,
    credits: nansen.credits.spent - before,
    fetchedAt: new Date().toISOString(),
    quiet: best.stats.trades === 0,
  };
}
