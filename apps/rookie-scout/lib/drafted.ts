import type { NansenClient } from "@longitude/nansen";
import { lastDays } from "@longitude/nansen";
import { getSocialStore } from "@longitude/kit/server";
import { type CohortMedians, type Grade, type ProspectStats, grade, similarity } from "./data";

export interface DraftedNow {
  key: string;
  address: string;
  chain: string;
  stats: ProspectStats;
  similarity: number;
  grade: Grade;
  checkedAt: string;
}

/** Every wallet anyone has drafted, re-scored against today's cohort. 1 credit per wallet, capped. */
export async function rescoreDrafted(nansen: NansenClient, medians: CohortMedians, max = 40): Promise<Record<string, DraftedNow>> {
  const out: Record<string, DraftedNow> = {};
  let keys: string[] = [];
  try {
    keys = await getSocialStore().collection("drafted");
  } catch {
    return out;
  }
  const window90 = lastDays(90);
  for (const key of keys.slice(0, max)) {
    const i = key.indexOf(":");
    if (i <= 0) continue;
    const chain = key.slice(0, i);
    const address = key.slice(i + 1);
    if (!["ethereum", "solana", "base"].includes(chain)) continue;
    try {
      const s = await nansen.profiler.pnlSummary(
        { wallet_address: address, chain: chain as "ethereum" | "solana" | "base", date: window90 },
        { tag: `drafted:${address.slice(0, 8)}` },
      );
      const win = Number(s.win_rate ?? 0);
      const stats: ProspectStats = {
        winRate: win <= 1 ? win * 100 : win,
        pnlUsd: Number(s.realized_pnl_usd ?? 0) || 0,
        trades: Number(s.traded_times ?? 0) || 0,
        tokens: Number(s.traded_token_count ?? 0) || 0,
        roiPct: (Number(s.realized_pnl_percent ?? 0) || 0) * 100,
      };
      const score = similarity(stats, medians);
      out[key] = { key, address, chain, stats, similarity: score, grade: grade(score), checkedAt: new Date().toISOString() };
    } catch {
      /* skip this wallet; a failed profile should not sink the seed */
    }
  }
  return out;
}
