import { isDeep } from "@longitude/kit/deep";
import type { NansenClient, RowOf } from "@longitude/nansen";
import { CreditCapExceededError, lastDays } from "@longitude/nansen";

/** Chains the skyline is built from: the ones with the deepest smart money and Token God Mode coverage. */
export const CHAINS = ["ethereum", "solana", "base"] as const;
export type Chain = (typeof CHAINS)[number];

/** Buildings in the skyline: the week's biggest smart money exits. Client code may read this; it never changes. */
export const BUILDINGS = 12;
/** DEEP=1 seed runs build this many instead. Read only inside `buildLastOnesOut`, never by client code. */
const DEEP_BUILDINGS = 24;
/** Anything smaller than this is a shed, not a building. */
export const MIN_MARKET_CAP_USD = 5_000_000;
/** The OHLCV endpoint takes at most 10 addresses per batch call. */
const OHLCV_BATCH = 10;

export interface Building {
  /** 1 = the biggest smart money exit of the week: the tallest building, left-most on the skyline. */
  rank: number;
  symbol: string;
  name: string;
  address: string;
  chain: Chain;
  /** Smart money net flow over the last 7 days, USD. Always negative here: they are leaving. */
  smartNetFlow7dUsd: number;
  /** Retail proxy: fresh wallets' net flow over the last 7 days, USD. Positive means retail is still buying. */
  retailNetFlow7dUsd: number;
  retailWalletCount: number;
  smartWalletCount: number;
  priceChange24hPct: number;
  marketCapUsd: number;
  /** 0..1: share of the building's windows lit at dusk, i.e. how much retail is still home. See `litScore`. */
  lit: number;
  /** 0..1: share of those lit windows that switch off, i.e. how far along the smart money exit is. See `darknessScore`. */
  darkness: number;
  /** 0..1: building height, √(exit ÷ biggest exit), so the skyline is not one tower and eleven sheds. */
  height: number;
  /** One dry line for the panel, written from the numbers. */
  caption: string;
}

export interface LastOnesOutData {
  generatedAt: string;
  /** The 7-day flow window. */
  window: { from: string; to: string };
  chains: Chain[];
  totals: {
    /** Sum of the smart money exits, USD, as a positive magnitude. */
    smartExitUsd: number;
    /** Sum of the positive retail flows, USD: what retail is still putting in. */
    retailInflowUsd: number;
    /** Buildings with more than a third of their windows still on once the blackout ends. */
    stillLit: number;
  };
  buildings: Building[];
}

/** The raw numbers per token, straight from the API. `assemble` turns a list of these into the snapshot. */
export interface BuildingInput {
  symbol: string;
  name: string;
  address: string;
  chain: Chain;
  smartNetFlow7dUsd: number;
  retailNetFlow7dUsd: number;
  retailWalletCount: number;
  smartWalletCount: number;
  priceChange24hPct: number;
  marketCapUsd: number;
}

type NetflowRow = RowOf<"/api/v1/smart-money/netflow">;
type FlowRow = RowOf<"/api/v1/tgm/flow-intelligence">;

const num = (v: number | string | null | undefined): number => Number(v ?? 0) || 0;
const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
const round = (n: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};
const isChain = (c: string): c is Chain => (CHAINS as readonly string[]).includes(c);

/**
 * `lit` (0..1): how much of the building is still lit at dusk, i.e. how much retail is still home.
 *
 *   flowLit  = 0.5 + 0.5 · retail ÷ (|retail| + |smart|)
 *              0.5 when retail is flat, → 1 when retail buys more than smart money sells, → 0 when retail is leaving too
 *   countLit = log10(retailWallets ÷ smartWallets) ÷ 3, clamped
 *              1:1 → 0, 100:1 → 0.67, 1000:1 → 1; 0.5 when either count is unknown
 *   lit      = 0.7 · flowLit + 0.3 · countLit
 */
export function litScore(b: BuildingInput): number {
  const retail = b.retailNetFlow7dUsd;
  const smart = Math.abs(b.smartNetFlow7dUsd);
  const denom = Math.abs(retail) + smart;
  const flowLit = denom > 0 ? 0.5 + 0.5 * (retail / denom) : 0.5;
  const countLit = b.retailWalletCount > 0 && b.smartWalletCount > 0 ? clamp01(Math.log10(b.retailWalletCount / b.smartWalletCount) / 3) : 0.5;
  return clamp01(0.7 * flowLit + 0.3 * countLit);
}

/**
 * `darkness` (0..1): how far along the smart money exit is, i.e. the share of lit windows that switch off.
 *
 *   exitRank   = |smart| ÷ biggest |smart| in the skyline        the tallest building scores 1
 *   capBite    = |smart| ÷ (2% of market cap), clamped           selling 2% of the cap in a week empties the building
 *   walletRank = smartWallets ÷ most smartWallets in the skyline  more smart wallets leaving, more lights out
 *   darkness   = 0.5 · exitRank + 0.3 · capBite + 0.2 · walletRank
 */
export function darknessScore(b: BuildingInput, maxExitUsd: number, maxSmartWallets: number): number {
  const exit = Math.abs(b.smartNetFlow7dUsd);
  const exitRank = maxExitUsd > 0 ? exit / maxExitUsd : 0;
  const capBite = b.marketCapUsd > 0 ? clamp01(exit / (0.02 * b.marketCapUsd)) : 0;
  const walletRank = maxSmartWallets > 0 ? b.smartWalletCount / maxSmartWallets : 0;
  return clamp01(0.5 * exitRank + 0.3 * capBite + 0.2 * walletRank);
}

export function captionFor(b: Pick<Building, "lit" | "darkness" | "retailNetFlow7dUsd">): string {
  const stillOn = b.lit * (1 - b.darkness);
  const retailBuying = b.retailNetFlow7dUsd > 0;
  if (retailBuying && b.darkness >= 0.55) return "Smart money took the stairs. Retail is still buying on the top floor.";
  if (retailBuying && stillOn >= 0.5) return "Retail keeps the lights on. Smart money is only half out the door.";
  if (retailBuying) return "Retail is still buying, but the floors are emptying.";
  if (stillOn < 0.12) return "Nearly empty. Last one out, hit the switch.";
  if (b.darkness >= 0.55) return "Everyone is leaving. Retail is one floor behind smart money.";
  return "A slow evening: some floors dark, some still home.";
}

/** Scores, ranks and captions a set of inputs into the finished snapshot. Pure: the seed and the sample share it. */
export function assemble(
  inputs: BuildingInput[],
  window: { from: string; to: string },
  generatedAt = new Date().toISOString(),
  count = BUILDINGS,
): LastOnesOutData {
  const sorted = inputs
    .filter((b) => b.smartNetFlow7dUsd < 0)
    .sort((a, b) => a.smartNetFlow7dUsd - b.smartNetFlow7dUsd)
    .slice(0, count);
  const maxExit = Math.max(1, ...sorted.map((b) => Math.abs(b.smartNetFlow7dUsd)));
  const maxSmartWallets = Math.max(1, ...sorted.map((b) => b.smartWalletCount));

  const buildings: Building[] = sorted.map((b, i) => {
    const lit = round(litScore(b), 3);
    const darkness = round(darknessScore(b, maxExit, maxSmartWallets), 3);
    return {
      rank: i + 1,
      symbol: b.symbol,
      name: b.name,
      address: b.address,
      chain: b.chain,
      smartNetFlow7dUsd: Math.round(b.smartNetFlow7dUsd),
      retailNetFlow7dUsd: Math.round(b.retailNetFlow7dUsd),
      retailWalletCount: Math.round(b.retailWalletCount),
      smartWalletCount: Math.round(b.smartWalletCount),
      priceChange24hPct: round(b.priceChange24hPct, 1),
      marketCapUsd: Math.round(b.marketCapUsd),
      lit,
      darkness,
      height: round(Math.sqrt(Math.abs(b.smartNetFlow7dUsd) / maxExit), 3),
      caption: captionFor({ lit, darkness, retailNetFlow7dUsd: b.retailNetFlow7dUsd }),
    };
  });

  return {
    generatedAt,
    window,
    chains: [...CHAINS],
    totals: {
      smartExitUsd: Math.round(buildings.reduce((s, b) => s + Math.abs(b.smartNetFlow7dUsd), 0)),
      retailInflowUsd: Math.round(buildings.reduce((s, b) => s + Math.max(0, b.retailNetFlow7dUsd), 0)),
      stillLit: buildings.filter((b) => b.lit * (1 - b.darkness) >= 1 / 3).length,
    },
    buildings,
  };
}

/** One bad token must not take the whole skyline down: log it and keep building. The credit cap still stops everything. */
async function attempt<T>(call: () => Promise<T>, tag: string): Promise<T | undefined> {
  try {
    return await call();
  } catch (err) {
    if (err instanceof CreditCapExceededError) throw err;
    console.error(`[last-ones-out] ${tag}: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

/** Latest close against the close before it, in percent. Daily candles over the last few days give a 24h change. */
function pctChange(candles: { close?: number }[]): number {
  const closes = candles.map((c) => num(c.close)).filter((c) => c > 0);
  if (closes.length < 2) return 0;
  const last = closes[closes.length - 1] as number;
  const prev = closes[closes.length - 2] as number;
  return (last / prev - 1) * 100;
}

/**
 * Builds the skyline. Credits on a full run (seed.ts caps it at 80):
 *   default, 12 buildings: about 32 = 5 (netflow) + 12 × (1 flow intelligence + 1 token information) + 1 OHLCV batch per chain (3, or 4 if one chain holds more than 10 tokens)
 *   DEEP=1, 24 buildings:  about 56 = 5 + 24 × 2 + 3 (up to 5 OHLCV batches of 10 addresses when a chain holds more than 10)
 * The snapshot carries whichever count was built; the skyline, register and window planner follow `buildings.length`.
 */
export async function buildLastOnesOut(nansen: NansenClient): Promise<LastOnesOutData> {
  const range = lastDays(7);
  // Seed-time switch only. BUILDINGS itself never changes, so client code that reads it stays at 12.
  const count = isDeep() ? DEEP_BUILDINGS : BUILDINGS;

  // 1) The week's biggest smart money exits: netflow ascending by 7d flow, mid caps and up. 5 credits.
  //    A few spare rows (same 5 credits) cover the client-side guard below.
  const netflow = await nansen.smartMoney.netflow({
    chains: [...CHAINS],
    filters: { include_stablecoins: false, include_native_tokens: false, market_cap_usd: { min: MIN_MARKET_CAP_USD } },
    order_by: [{ field: "net_flow_7d_usd", direction: "ASC" }],
    pagination: { page: 1, per_page: count + 4 },
  });
  const exits = (netflow.data ?? [])
    .filter(
      (r: NetflowRow) =>
        isChain(r.chain) && num(r.net_flow_7d_usd) < 0 && (r.market_cap_usd === undefined || num(r.market_cap_usd) >= MIN_MARKET_CAP_USD),
    )
    .slice(0, count);

  // 2) Per building: who is still home (flow intelligence, 7d) and the nameplate (token information, 1d). 2 credits each.
  const inputs: BuildingInput[] = [];
  for (const row of exits) {
    const chain = row.chain as Chain;
    const tag = `token:${row.token_symbol}`;
    const flow = await attempt(() => nansen.tgm.flowIntelligence({ chain, token_address: row.token_address, timeframe: "7d" }, { tag }), tag);
    const info = await attempt(() => nansen.tgm.tokenInformation({ chain, token_address: row.token_address, timeframe: "1d" }, { tag }), tag);
    const seg: FlowRow = flow?.data?.[0] ?? {};
    const spot = info?.data?.spot_metrics;
    const smartWalletCount = num(seg.smart_trader_wallet_count) || num(row.trader_count);
    // The API reports fresh_wallets_wallet_count as 0 on the 7d timeframe; fall back to the day's unique buyers minus the smart ones.
    const freshWallets = num(seg.fresh_wallets_wallet_count);
    const retailWalletCount = freshWallets > 0 ? freshWallets : Math.max(0, num(spot?.unique_buyers) - smartWalletCount);
    inputs.push({
      symbol: row.token_symbol,
      name: info?.data?.name?.trim() || row.token_symbol,
      address: row.token_address,
      chain,
      smartNetFlow7dUsd: num(row.net_flow_7d_usd),
      retailNetFlow7dUsd: num(seg.fresh_wallets_net_flow_usd),
      retailWalletCount,
      smartWalletCount,
      priceChange24hPct: 0,
      marketCapUsd: num(row.market_cap_usd) || num(info?.data?.token_details?.market_cap_usd),
    });
  }

  // 3) 24h price change from daily candles, batched per chain (token information carries no price change). 1 credit per call.
  for (const chain of CHAINS) {
    const mine = inputs.filter((b) => b.chain === chain);
    for (let i = 0; i < mine.length; i += OHLCV_BATCH) {
      const batch = mine.slice(i, i + OHLCV_BATCH);
      const tag = `ohlcv:${chain}`;
      const res = await attempt(
        () => nansen.tgm.ohlcv({ chain, token_addresses: batch.map((b) => b.address), timeframe: "1d", date: lastDays(3) }, { tag }),
        tag,
      );
      if (!res) continue;
      const series = "tokens" in res ? res.tokens : [{ token_address: res.token_address, data: res.data }];
      for (const s of series) {
        const b = batch.find((x) => x.address.toLowerCase() === s.token_address.toLowerCase());
        if (b) b.priceChange24hPct = pctChange(s.data ?? []);
      }
    }
  }

  return assemble(inputs, range, undefined, count);
}
