import { nansenFor, readSnapshot } from "@longitude/kit/server";
import { lastDays, looksLikeAddress } from "@longitude/nansen";

export type LensChain = "ethereum" | "base" | "solana";

export interface CohortMedians {
  winRate: number;
  pnlUsd: number;
  trades: number;
  tokens: number;
}

export interface WalletLens {
  address: string;
  chain: LensChain;
  fetchedAt: string;
  credits: number;
  scout?: { winRate: number; pnlUsd: number; trades: number; tokens: number; roiPct: number; topTokens: string[]; similarity: number; grade: "A" | "B" | "C"; verdict: string };
  perp?: { winRate: number; pnlUsd: number; trades: number; coins: number; topCoins: string[] } | null;
  holdings?: { symbol: string; valueUsd: number; amount: number }[];
  kin?: { count: number; relations: Record<string, number>; sample: { address: string; label: string; relation: string }[] };
  exits?: { symbol: string; valueUsd: number; at: string; into: string }[];
  errors: Record<string, string>;
}

const DEFAULT_MEDIANS: CohortMedians = { winRate: 50, pnlUsd: 500_000, trades: 800, tokens: 20 };
const STABLE = /USD|DAI|^W?(ETH|SOL|BTC|BNB)$|STETH|^M?SOL$|JITOSOL|WSOL/i;

/** Same formula as Rookie Scout's similarity: sqrt ratios to the cohort medians, win rate shrunk with a 20-exit prior. */
function similarity(s: { winRate: number; pnlUsd: number; trades: number; tokens: number }, m: CohortMedians): number {
  const ratio = (a: number, b: number) => (a <= 0 ? 0 : Math.min(1, Math.sqrt(a / Math.max(b, 1e-9))));
  const winAdj = (s.winRate * s.trades + m.winRate * 20) / (s.trades + 20);
  const win = m.winRate <= 0 ? (winAdj > 0 ? 1 : 0) : Math.min(1, winAdj / m.winRate);
  const penalty = s.pnlUsd < 0 ? 15 : 0;
  return Math.max(0, Math.round(100 * (0.35 * win + 0.3 * ratio(s.pnlUsd, m.pnlUsd) + 0.2 * ratio(s.trades, m.trades) + 0.15 * ratio(s.tokens, m.tokens)) - penalty));
}

const num = (v: unknown): number => Number(v ?? 0) || 0;
const pct = (v: unknown): number => {
  const n = num(v);
  return n <= 1 ? n * 100 : n;
};

/** One address, five Nansen lenses. About 5 credits (4 on Solana), cached five minutes. */
export async function readWallet(raw: string, preferred?: string): Promise<WalletLens | { error: string }> {
  const address = raw.trim();
  const chains: LensChain[] = preferred === "ethereum" || preferred === "base" || preferred === "solana" ? [preferred] : address.startsWith("0x") ? ["ethereum", "base"] : ["solana"];
  if (!chains.some((c) => looksLikeAddress(address, c))) return { error: "That does not look like an Ethereum, Base or Solana address." };
  const nansen = nansenFor("app:store");
  const before = nansen.credits.spent;
  const errors: Record<string, string> = {};
  const window90 = lastDays(90);
  const window30 = lastDays(30);
  const snap = await readSnapshot<{ cohort?: { medians?: CohortMedians } }>("rookie-scout").catch(() => undefined);
  const medians = snap?.data?.cohort?.medians ?? DEFAULT_MEDIANS;
  const tag = `wallet:${address.slice(0, 8)}`;

  // 1) Rookie Scout lens: 90-day spot profile on the first chain with activity.
  let chain: LensChain = chains[0] as LensChain;
  let scout: WalletLens["scout"];
  for (const c of chains) {
    try {
      const s = await nansen.profiler.pnlSummary({ wallet_address: address, chain: c, date: window90 }, { tag });
      const stats = { winRate: pct(s.win_rate), pnlUsd: num(s.realized_pnl_usd), trades: num(s.traded_times), tokens: num(s.traded_token_count) };
      const score = similarity(stats, medians);
      const grade = score >= 75 ? "A" : score >= 55 ? "B" : "C";
      scout = { ...stats, roiPct: num(s.realized_pnl_percent) * 100, topTokens: [...new Set((s.top5_tokens ?? []).map((t) => t.token_symbol).filter(Boolean))].slice(0, 5), similarity: score, grade, verdict: grade === "A" ? "Draft" : grade === "B" ? "Watch" : "Pass" };
      chain = c;
      if (stats.trades > 0) break;
    } catch (err) {
      errors.scout = err instanceof Error ? err.message : String(err);
    }
  }

  const [perp, holdings, kin, exits] = await Promise.all([
    // 2) Two-Faced lens: Hyperliquid perps (EVM addresses only).
    address.startsWith("0x")
      ? nansen.profiler
          .perpPnlSummary({ address, date: window90 }, { tag })
          .then((r) => {
            const d = r.data;
            if (!d || num(d.traded_times) === 0) return null;
            return { winRate: pct(d.win_rate), pnlUsd: num(d.realized_pnl_usd), trades: num(d.traded_times), coins: num(d.traded_coin_count), topCoins: (d.top5_coins ?? []).map((c) => c.coin).filter(Boolean).slice(0, 5) };
          })
          .catch((err: unknown) => {
            errors.perp = err instanceof Error ? err.message : String(err);
            return null;
          })
      : Promise.resolve(null),
    // 3) Exit Clock / Last Ones Out lens: what it still holds.
    nansen.profiler
      .currentBalance({ address, chain, order_by: [{ field: "value_usd", direction: "DESC" }], pagination: { page: 1, per_page: 8 } }, { tag })
      .then((r) => (r.data ?? []).map((h) => ({ symbol: h.token_symbol ?? "?", valueUsd: num(h.value_usd), amount: num(h.token_amount) })).filter((h) => h.valueUsd > 1))
      .catch((err: unknown) => {
        errors.holdings = err instanceof Error ? err.message : String(err);
        return [] as { symbol: string; valueUsd: number; amount: number }[];
      }),
    // 4) Dynasties lens: kin.
    nansen.profiler
      .relatedWallets({ wallet_address: address, chain, pagination: { page: 1, per_page: 12 } }, { tag })
      .then((r) => {
        const rows = r.data ?? [];
        const relations: Record<string, number> = {};
        for (const row of rows) relations[row.relation ?? "Related"] = (relations[row.relation ?? "Related"] ?? 0) + 1;
        return { count: rows.length, relations, sample: rows.slice(0, 4).map((row) => ({ address: row.address, label: row.address_label ?? "", relation: row.relation ?? "Related" })) };
      })
      .catch((err: unknown) => {
        errors.kin = err instanceof Error ? err.message : String(err);
        return undefined;
      }),
    // 5) Obituaries / soap lens: the largest exits of the last 30 days.
    nansen.profiler
      .dexTrades({ address, chain, date: window30, pagination: { page: 1, per_page: 25 } }, { tag })
      .then((r) =>
        (r.data ?? [])
          .filter((t) => t.token_sold_symbol && !STABLE.test(t.token_sold_symbol))
          .map((t) => ({ symbol: t.token_sold_symbol as string, valueUsd: num(t.trade_value_usd), at: String(t.block_timestamp ?? ""), into: t.token_bought_symbol ?? "" }))
          .sort((a, b) => b.valueUsd - a.valueUsd)
          .slice(0, 5),
      )
      .catch((err: unknown) => {
        errors.exits = err instanceof Error ? err.message : String(err);
        return [] as { symbol: string; valueUsd: number; at: string; into: string }[];
      }),
  ]);

  return { address, chain, fetchedAt: new Date().toISOString(), credits: nansen.credits.spent - before, scout, perp, holdings, kin, exits, errors };
}
