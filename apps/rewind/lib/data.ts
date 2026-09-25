import type { NansenClient, NansenSchemas, RowOf } from "@longitude/nansen";
import { CreditCapExceededError, isoDate } from "@longitude/nansen";

/** Chains the beta historical screener covers; each pick's candles come from the same chain. */
export const CHAINS = ["ethereum", "solana", "base"] as const;
export type Chain = (typeof CHAINS)[number];

/** Where the tapes are recorded: days before today. Tape 1 is the most recent. */
export const TAPE_OFFSETS = [30, 60, 90, 120, 150] as const;
/** DEEP=1 seed: eight tapes, back to 240 days. */
export const DEEP_TAPE_OFFSETS = [30, 60, 90, 120, 150, 180, 210, 240] as const;
/** The screener window: the week of smart money buying that ends on the tape's date. */
export const WEEK_DAYS = 7;
/** The reveal: what the price did over the 30 days after the date. */
export const HOLD_DAYS = 30;
const PICKS_PER_TAPE = 4;
const DEEP_PICKS_PER_TAPE = 5;
/** Screener rows fetched per tape: the picks plus two spares for rows without candles. Same 5 credits either way. */
const screenerRows = (picks: number) => picks + 2;

export interface PathPoint {
  /** UTC day, YYYY-MM-DD. */
  t: string;
  close: number;
}

export interface Pick {
  symbol: string;
  address: string;
  chain: Chain;
  /** Smart money buy volume over the week ending on the tape's date. */
  buyVolumeUsd: number;
  /** Smart money net flow (buys minus sells) over that week. */
  netflowUsd: number;
  marketCapUsd: number;
  /** Price move over that week, percent. Known on the date, so safe to show before the reveal. */
  weekChangePct: number;
  /** Close on the tape's date: the entry price of your call. */
  priceAtDate: number;
  /** Daily closes from the date (day 0) through day 30, in order. */
  path: PathPoint[];
  /** (last close / priceAtDate - 1) × 100. */
  returnPct30d: number;
}

export interface Tape {
  /** The date you travel back to, YYYY-MM-DD. */
  date: string;
  /** "Aug 26, 2026". */
  label: string;
  daysAgo: number;
  /** Up to four tokens smart money net-bought that week, biggest net flow first. */
  picks: Pick[];
  /** Symbol of the pick with the best 30-day return. Symbols are unique within a tape. */
  winner: string;
}

export interface RewindData {
  generatedAt: string;
  /** The "today" the tape dates were counted back from, YYYY-MM-DD. */
  asOf: string;
  /** Most recent tape first. */
  tapes: Tape[];
}

type ScreenerRow = RowOf<"/api/v1beta1/token-screener/historical">;
type Candle = NansenSchemas["schemas"]["OHLCVCandle"];

const num = (v: number | string | null | undefined): number => Number(v ?? 0) || 0;
const round2 = (n: number): number => Math.round(n * 100) / 100;
const isChain = (c: string): c is Chain => (CHAINS as readonly string[]).includes(c);

/** Stablecoins are excluded server-side by sector; wrapped natives and liquid staking tokens are not a call either. */
const NOT_A_CALL = /^(W?ETH|W?SOL|W?BTC|WBNB|CBBTC|CBETH|WEETH|STETH|WSTETH|RETH|USDC|USDT|USDE|USDS|DAI|FDUSD|PYUSD|USD1|TUSD|FRAX)$/i;

const shiftDays = (from: Date, days: number): string => isoDate(new Date(from.getTime() + days * 86_400_000));

/** "Aug 26, 2026" for a YYYY-MM-DD date. */
export function tapeLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Day offset of a path point from the tape's date (0 = the date itself). */
export function dayOffset(date: string, t: string): number {
  return Math.round((Date.parse(`${t}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
}

/** Percent return of a close against the pick's entry price. */
export function pctFrom(pick: Pick, close: number): number {
  return pick.priceAtDate > 0 ? (close / pick.priceAtDate - 1) * 100 : 0;
}

async function pricePath(
  nansen: NansenClient,
  pick: { symbol: string; address: string; chain: Chain },
  date: string,
  to: string,
): Promise<PathPoint[]> {
  let candles: Candle[];
  try {
    const res = await nansen.tgm.ohlcv(
      { chain: pick.chain, token_address: pick.address, date: { from: `${date}T00:00:00Z`, to: `${to}T23:59:59Z` }, timeframe: "1d" },
      { tag: `ohlcv:${pick.symbol}@${date}` },
    );
    // One shape for a single token, another for a batch; read candles from either.
    candles = "data" in res ? res.data : res.tokens.flatMap((t) => t.data);
  } catch (err) {
    if (err instanceof CreditCapExceededError) throw err;
    return []; // No candles for this token: the caller moves on to the next screener row.
  }
  return candles
    .filter((c): c is Candle & { close: number } => typeof c.close === "number" && Number.isFinite(c.close) && c.close > 0)
    .sort((a, b) => a.interval_start.localeCompare(b.interval_start))
    .slice(0, HOLD_DAYS + 1)
    .map((c) => ({ t: c.interval_start.slice(0, 10), close: Number(c.close.toPrecision(6)) }));
}

/**
 * One tape per past date. Per tape: the historical screener as it stood that week (5 credits), then one
 * ohlcv call per pick for the 30 days that followed (1 credit each).
 *
 * Normal seed: 5 tapes × 4 picks = 5 × (5 + 4) = 45 credits on a clean run, at most 55 if rows without
 * candles are swapped for spares.
 * DEEP=1 seed (process.env.DEEP, read here and only here): 8 tapes × 5 picks = 8 × (5 + 5) = 80 credits,
 * at most 96 with spares. seed.ts caps the run at 100.
 */
export async function buildRewind(nansen: NansenClient): Promise<RewindData> {
  const deep = process.env.DEEP === "1";
  const offsets: readonly number[] = deep ? DEEP_TAPE_OFFSETS : TAPE_OFFSETS;
  const picksPerTape = deep ? DEEP_PICKS_PER_TAPE : PICKS_PER_TAPE;
  const today = new Date();
  const tapes: Tape[] = [];

  for (const daysAgo of offsets) {
    const date = shiftDays(today, -daysAgo);
    const to = shiftDays(today, -daysAgo + HOLD_DAYS);

    // 1) What smart money net-bought in the week ending on `date`. 5 credits.
    const screener = await nansen.screener.historicalTokens(
      {
        to_date: date,
        timeframe_days: WEEK_DAYS,
        chains: [...CHAINS],
        only_smart_money: true,
        trader_type: "sm",
        exclude_sectors: ["Stablecoin"],
        order_by: [{ field: "netflow", direction: "DESC" }],
        pagination: { page: 1, per_page: screenerRows(picksPerTape) },
      },
      { tag: `tape:${date}` },
    );
    const rows = (screener.data ?? []).filter(
      (r: ScreenerRow) => isChain(r.chain) && num(r.netflow) > 0 && !NOT_A_CALL.test(r.token_symbol),
    );

    // 2) The 30 days after the date, one credit per pick. A row without candles is skipped for the next.
    const picks: Pick[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (picks.length >= picksPerTape) break;
      const symbol = row.token_symbol.toUpperCase();
      if (seen.has(symbol) || !isChain(row.chain)) continue;
      const path = await pricePath(nansen, { symbol, address: row.token_address, chain: row.chain }, date, to);
      const first = path[0];
      const last = path[path.length - 1];
      if (!first || !last || path.length < 2) continue;
      seen.add(symbol);
      picks.push({
        symbol,
        address: row.token_address,
        chain: row.chain,
        buyVolumeUsd: num(row.buy_volume),
        netflowUsd: num(row.netflow),
        marketCapUsd: num(row.market_cap_usd),
        weekChangePct: round2(num(row.price_change) * 100),
        priceAtDate: first.close,
        path,
        returnPct30d: round2((last.close / first.close - 1) * 100),
      });
    }

    const [head, ...rest] = picks;
    if (!head || rest.length === 0) continue; // A call needs at least two cassettes.
    const winner = rest.reduce((best, p) => (p.returnPct30d > best.returnPct30d ? p : best), head);
    tapes.push({ date, label: tapeLabel(date), daysAgo, picks, winner: winner.symbol });
  }

  return { generatedAt: new Date().toISOString(), asOf: isoDate(today), tapes };
}
