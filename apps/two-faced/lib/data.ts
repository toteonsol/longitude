import type { NansenClient, ResponseOf, RowOf } from "@longitude/nansen";
import { CreditCapExceededError, NansenConfigError, lastDays } from "@longitude/nansen";

/**
 * Two-Faced: one wallet, two masks. The spot face comes from the profiler's 90-day PnL summary on
 * ethereum (or base), the perp face from its Hyperliquid PnL summary and open positions. Everything the
 * stage needs (expressions, temperaments, verdicts, ranks) is computed here so the components stay dumb.
 */

export type SpotChain = "ethereum" | "base";
export type Side = "Long" | "Short";

/** The parameters the SVG mask morphs between. Geometry comes from the address hash; this is the mood. */
export interface Expression {
  /** -1 deep frown .. 1 wide grin. */
  mouth: number;
  /** -1 brows knitted .. 1 brows raised and serene. */
  brow: number;
  /** 0 narrow, calm .. 1 wide, manic. */
  eyes: number;
  /** 0..1 crimson flush on the cheeks: leverage, losses, churn. */
  heat: number;
  /** A tear rolls when realized PnL is negative. */
  tear: boolean;
}

export interface TopSymbol {
  symbol: string;
  pnlUsd: number;
}

export interface OpenPosition {
  coin: string;
  side: Side;
  sizeUsd: number;
  pnlUsd: number;
  leverage: number;
}

export interface SpotFace {
  chain: SpotChain;
  /** Percent 0..100. */
  winRate: number;
  pnlUsd: number;
  /** Realized ROI in percent. */
  roiPct: number;
  trades: number;
  tokens: number;
  topTokens: TopSymbol[];
}

export interface PerpFace {
  /** Percent 0..100. */
  winRate: number;
  pnlUsd: number;
  /** Realized PnL over closing notional, percent. */
  roiPct: number;
  trades: number;
  closedTrades: number;
  coins: number;
  feesUsd: number;
  unrealizedPnlUsd: number;
  accountValueUsd: number;
  /** Highest leverage across open positions (0 when flat). */
  maxLeverage: number;
  topCoins: TopSymbol[];
  openPositions: OpenPosition[];
}

/** What the wallet did in the perp feed that put it in the cast. */
export interface Activity {
  trades7d: number;
  volume7dUsd: number;
  lastTradeAt: string;
  favoriteCoin: string;
  /** Share of feed trades on the Long side, 0..1. */
  longShare: number;
}

/** Raw numbers per wallet, before any theatre. */
export interface RawWallet {
  address: string;
  label: string;
  activity: Activity;
  spot: SpotFace;
  perp: PerpFace;
}

export interface Wallet extends RawWallet {
  /** 1 = most two-faced. */
  rank: number;
  faces: { spot: Expression; perp: Expression };
  temperament: { spot: string; perp: string };
  /** 0..100: how far apart the two expressions are. */
  duality: number;
  verdict: string;
  notes: { spot: string; perp: string };
}

export interface TwoFacedData {
  generatedAt: string;
  window: { from: string; to: string };
  feed: { lookbackHours: number; trades: number; traders: number };
  wallets: Wallet[];
}

type PerpTradeRow = RowOf<"/api/v1/smart-money/perp-trades">;
type SpotSummary = ResponseOf<"/api/v1/profiler/address/pnl-summary">;
type PerpSummary = ResponseOf<"/api/v1/profiler/perp-pnl-summary">["data"];
type Positions = ResponseOf<"/api/v1/profiler/perp-positions">["data"];

const CAST_SIZE = 8;
const LOOKBACK_HOURS = 168;
const POSITIONS_SHOWN = 5;

const num = (v: number | string | null | undefined): number => Number(v ?? 0) || 0;
/** Win rates and ROIs arrive as fractions; normalise to percent. */
const pct = (v: number | null | undefined): number => {
  const n = num(v);
  return Math.abs(n) <= 1 ? n * 100 : n;
};
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/** 0..1 for $0..$1M on a log scale. */
const magnitude = (usd: number): number => Math.min(1, Math.log10(1 + Math.abs(usd)) / 6);

const usd = (n: number): string =>
  Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`;
const usdSigned = (n: number): string => `${n < 0 ? "-" : "+"}${usd(Math.abs(n))}`;

/* ---------- Expressions: numbers → face ---------- */

export function spotExpression(s: SpotFace): Expression {
  if (s.trades === 0) return { mouth: 0.05, brow: 0.3, eyes: 0.18, heat: 0, tear: false };
  const win = clamp((s.winRate - 50) / 25, -1, 1);
  const sign = s.pnlUsd >= 0 ? 1 : -1;
  return {
    mouth: clamp(0.65 * win + 0.35 * sign * magnitude(s.pnlUsd), -1, 1),
    brow: clamp(0.25 + (s.winRate - 50) / 40 - (s.pnlUsd < 0 ? 0.35 : 0), -1, 1),
    eyes: clamp(Math.log10(1 + s.trades) / 3, 0.15, 1),
    heat: clamp(0.06 + (s.pnlUsd < 0 ? 0.3 : 0) + (s.winRate < 45 ? 0.2 : 0), 0, 1),
    tear: s.pnlUsd < 0,
  };
}

export function perpExpression(p: PerpFace): Expression {
  if (p.trades === 0) return { mouth: 0, brow: 0, eyes: 0.2, heat: 0, tear: false };
  const win = clamp((p.winRate - 50) / 25, -1, 1);
  const sign = p.pnlUsd >= 0 ? 1 : -1;
  const churn = p.feesUsd / Math.max(Math.abs(p.pnlUsd), 1);
  const lev = clamp(p.maxLeverage / 25, 0, 1);
  return {
    mouth: clamp(0.5 * win + 0.5 * sign * magnitude(p.pnlUsd), -1, 1),
    brow: clamp((p.winRate - 50) / 60 - lev * 1.1 - Math.min(0.5, churn * 0.5), -1, 1),
    eyes: clamp(Math.log10(1 + p.trades) / 2.6, 0.2, 1),
    heat: clamp(lev + (p.pnlUsd < 0 ? 0.3 : 0) + Math.min(0.3, churn * 0.3), 0, 1),
    tear: p.pnlUsd < 0,
  };
}

/** 0..100 distance between the two expressions. Mouth and brow carry most of the character. */
export function duality(a: Expression, b: Expression): number {
  const d =
    0.4 * (Math.abs(a.mouth - b.mouth) / 2) +
    0.25 * (Math.abs(a.brow - b.brow) / 2) +
    0.15 * Math.abs(a.eyes - b.eyes) +
    0.2 * Math.abs(a.heat - b.heat);
  return Math.round(clamp(d, 0, 1) * 100);
}

/* ---------- Temperaments: numbers → one word ---------- */

/**
 * Spot rules, first match wins:
 * Ghost (no spot record) · Saint (win ≥ 65%, profitable) · Monk (win ≥ 55%, ≤ 40 exits) ·
 * Collector (≥ 25 tokens, ≥ 80 exits) · Gambler (profitable on < 50% wins) · Tourist (losing, ≥ 40 exits) ·
 * Mourner (losing) · Gardener (everyone else).
 */
export function spotTemperament(s: SpotFace): string {
  if (s.trades === 0) return "Ghost";
  if (s.winRate >= 65 && s.pnlUsd > 0) return "Saint";
  if (s.winRate >= 55 && s.trades <= 40) return "Monk";
  if (s.tokens >= 25 && s.trades >= 80) return "Collector";
  if (s.pnlUsd > 0 && s.winRate < 50) return "Gambler";
  if (s.pnlUsd < 0 && s.trades >= 40) return "Tourist";
  if (s.pnlUsd < 0) return "Mourner";
  return "Gardener";
}

/**
 * Perp rules, first match wins:
 * Understudy (no perp record) · Degen (any open position ≥ 20x, or ≥ 100 trades with fees ≥ half of |PnL|) ·
 * Berserker (≥ 500 trades) · Martyr (losing at ≥ 10x or under 45% wins) · Bleeder (losing) ·
 * Sniper (win ≥ 60% at ≤ 5x) · Duelist (win ≥ 50%) · Drifter (everyone else).
 */
export function perpTemperament(p: PerpFace): string {
  if (p.trades === 0) return "Understudy";
  if (p.maxLeverage >= 20) return "Degen";
  if (p.trades >= 100 && p.feesUsd >= 0.5 * Math.abs(p.pnlUsd)) return "Degen";
  if (p.trades >= 500) return "Berserker";
  if (p.pnlUsd < 0 && (p.maxLeverage >= 10 || p.winRate < 45)) return "Martyr";
  if (p.pnlUsd < 0) return "Bleeder";
  if (p.winRate >= 60 && p.maxLeverage <= 5) return "Sniper";
  if (p.winRate >= 50) return "Duelist";
  return "Drifter";
}

export function verdictOf(spot: string, perp: string, split: number): string {
  const night = perp.toLowerCase();
  if (spot === "Ghost") return `Never seen in daylight. ${perp} after dark.`;
  if (perp === "Understudy") return `${spot} by day. The night role is still uncast.`;
  if (split < 22) return `${spot} by day, ${night} by night. Same face in every light.`;
  if (split >= 60) return `${spot} by day, ${night} by night. Two people share this address.`;
  return `${spot} by day, ${night} by night.`;
}

export function spotNote(s: SpotFace): string {
  if (s.trades === 0) return "No spot record on ethereum or base in the last 90 days.";
  return `Wins ${s.winRate.toFixed(0)}% of ${s.trades} exits across ${s.tokens} tokens on ${s.chain}; ${usdSigned(s.pnlUsd)} realized (${s.roiPct >= 0 ? "+" : ""}${s.roiPct.toFixed(0)}% ROI).`;
}

export function perpNote(p: PerpFace): string {
  if (p.trades === 0) return "No Hyperliquid record in the last 90 days.";
  const top = p.openPositions[0];
  const open = top
    ? ` Open now: ${top.coin} ${top.side.toLowerCase()} at ${top.leverage}x${p.openPositions.length > 1 ? ` and ${p.openPositions.length - 1} more` : ""}.`
    : " Flat right now.";
  return `${p.trades} perp trades on ${p.coins} coins, ${p.winRate.toFixed(0)}% win rate, ${usdSigned(p.pnlUsd)} realized, ${usd(p.feesUsd)} burned in fees.${open}`;
}

/** Everything derived from a wallet's raw numbers. Pure, so the sample snapshot and the seed agree. */
export function assembleWallet(raw: RawWallet): Omit<Wallet, "rank"> {
  const faces = { spot: spotExpression(raw.spot), perp: perpExpression(raw.perp) };
  const temperament = { spot: spotTemperament(raw.spot), perp: perpTemperament(raw.perp) };
  const split = duality(faces.spot, faces.perp);
  return {
    ...raw,
    faces,
    temperament,
    duality: split,
    verdict: verdictOf(temperament.spot, temperament.perp, split),
    notes: { spot: spotNote(raw.spot), perp: perpNote(raw.perp) },
  };
}

/** Most two-faced first; ties go to the busier wallet. */
export function rankWallets(list: Omit<Wallet, "rank">[]): Wallet[] {
  return [...list]
    .sort((a, b) => b.duality - a.duality || b.activity.trades7d - a.activity.trades7d)
    .map((w, i) => ({ ...w, rank: i + 1 }));
}

/* ---------- Nansen → raw faces ---------- */

const volumeOf = (rows: PerpTradeRow[]): number => rows.reduce((sum, r) => sum + num(r.value_usd), 0);

function activityOf(rows: PerpTradeRow[]): Activity {
  const byCoin = new Map<string, number>();
  let longs = 0;
  let last = "";
  for (const r of rows) {
    byCoin.set(r.token_symbol, (byCoin.get(r.token_symbol) ?? 0) + 1);
    if (r.side === "Long") longs += 1;
    if (r.block_timestamp > last) last = r.block_timestamp;
  }
  const favorite = [...byCoin.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  return {
    trades7d: rows.length,
    volume7dUsd: volumeOf(rows),
    lastTradeAt: last,
    favoriteCoin: favorite,
    longShare: rows.length ? longs / rows.length : 0,
  };
}

function spotFace(chain: SpotChain, s: SpotSummary | undefined): SpotFace {
  return {
    chain,
    winRate: pct(s?.win_rate),
    pnlUsd: num(s?.realized_pnl_usd),
    roiPct: pct(s?.realized_pnl_percent),
    trades: num(s?.traded_times),
    tokens: num(s?.traded_token_count),
    topTokens: (s?.top5_tokens ?? [])
      .filter((t) => Boolean(t.token_symbol))
      .slice(0, 5)
      .map((t) => ({ symbol: t.token_symbol, pnlUsd: num(t.realized_pnl) })),
  };
}

function perpFace(s: PerpSummary | undefined, pos: Positions | undefined): PerpFace {
  const openPositions: OpenPosition[] = (pos?.assetPositions ?? [])
    .map((a) => a.position)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => {
      const size = num(p.size);
      return {
        coin: p.token_symbol ?? "?",
        side: (size < 0 ? "Short" : "Long") as Side,
        sizeUsd: Math.abs(num(p.position_value_usd)),
        pnlUsd: num(p.unrealized_pnl_usd),
        leverage: num(p.leverage_value),
      };
    })
    .sort((a, b) => b.sizeUsd - a.sizeUsd);
  return {
    winRate: pct(s?.win_rate),
    pnlUsd: num(s?.realized_pnl_usd),
    roiPct: pct(s?.realized_pnl_percent),
    trades: num(s?.traded_times),
    closedTrades: num(s?.closed_trade_count),
    coins: num(s?.traded_coin_count),
    feesUsd: Math.abs(num(s?.fees_usd)),
    unrealizedPnlUsd: openPositions.reduce((sum, p) => sum + p.pnlUsd, 0),
    accountValueUsd: num(pos?.margin_summary_account_value_usd ?? pos?.cross_margin_summary_account_value_usd),
    maxLeverage: openPositions.reduce((m, p) => Math.max(m, p.leverage), 0),
    topCoins: (s?.top5_coins ?? [])
      .filter((c) => Boolean(c.coin))
      .slice(0, 5)
      .map((c) => ({ symbol: c.coin, pnlUsd: num(c.realized_pnl_usd) })),
    openPositions: openPositions.slice(0, POSITIONS_SHOWN),
  };
}

/** One wallet without a record must not sink the whole cast; a blown credit cap or config error must. */
async function attempt<T>(call: () => Promise<T>): Promise<T | undefined> {
  try {
    return await call();
  } catch (err) {
    if (err instanceof CreditCapExceededError || err instanceof NansenConfigError) throw err;
    console.error(`[two-faced] call skipped: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

const hasSpotActivity = (s: SpotSummary | undefined): boolean => Boolean(s) && (num(s?.traded_times) > 0 || num(s?.traded_token_count) > 0);

/**
 * Builds the cast. Credits: 5 (perp feed) + 8 × (1 perp summary + 1 spot summary + 1 positions) = 29,
 * plus 1 per wallet that needs the base retry, so at most 37. Cap 40.
 */
export async function buildTwoFaced(nansen: NansenClient): Promise<TwoFacedData> {
  const window90 = lastDays(90);

  // 1) The cast: a week of smart money perp trades on Hyperliquid, grouped by trader. 5 credits.
  const feed = await nansen.smartMoney.perpTrades({
    lookback_hours: LOOKBACK_HOURS,
    pagination: { page: 1, per_page: 100 },
  });
  const trades: PerpTradeRow[] = feed.data ?? [];
  const groups = new Map<string, { address: string; label: string; rows: PerpTradeRow[] }>();
  for (const row of trades) {
    const key = row.trader_address.toLowerCase();
    const group = groups.get(key);
    if (group) {
      group.rows.push(row);
      if (!group.label && row.trader_address_label) group.label = row.trader_address_label;
    } else {
      groups.set(key, { address: row.trader_address, label: row.trader_address_label ?? "", rows: [row] });
    }
  }
  const cast = [...groups.values()]
    .sort((a, b) => b.rows.length - a.rows.length || volumeOf(b.rows) - volumeOf(a.rows))
    .slice(0, CAST_SIZE);

  // 2) Both faces per wallet. 1 + 1 (+ 1 if ethereum is empty) + 1 credits each.
  const raws: RawWallet[] = [];
  for (const member of cast) {
    const tag = `wallet:${member.address.slice(0, 8)}`;
    const perpSummary = await attempt(() => nansen.profiler.perpPnlSummary({ address: member.address, date: window90 }, { tag }));

    let spotChain: SpotChain = "ethereum";
    let spotSummary = await attempt(() =>
      nansen.profiler.pnlSummary({ wallet_address: member.address, chain: "ethereum", date: window90 }, { tag }),
    );
    if (!hasSpotActivity(spotSummary)) {
      const onBase = await attempt(() =>
        nansen.profiler.pnlSummary({ wallet_address: member.address, chain: "base", date: window90 }, { tag: `${tag}:base` }),
      );
      if (hasSpotActivity(onBase)) {
        spotSummary = onBase;
        spotChain = "base";
      }
    }

    const positions = await attempt(() => nansen.profiler.perpPositions({ address: member.address }, { tag }));

    raws.push({
      address: member.address,
      label: member.label || "Smart HL Perps Trader",
      activity: activityOf(member.rows),
      spot: spotFace(spotChain, spotSummary),
      perp: perpFace(perpSummary?.data, positions?.data),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    window: window90,
    feed: { lookbackHours: LOOKBACK_HOURS, trades: trades.length, traders: groups.size },
    wallets: rankWallets(raws.map(assembleWallet)),
  };
}
