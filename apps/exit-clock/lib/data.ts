import type { NansenClient, RowOf } from "@longitude/nansen";
import { isEvmChain, lastDays } from "@longitude/nansen";

/** Chains with the deepest smart money + token god mode coverage. */
export const CHAINS = ["ethereum", "solana", "base"] as const;
export type Chain = (typeof CHAINS)[number];

/** What a holder's countdown starts from: an observed BUY, or an estimate from its balance changes. */
export type AnchorSource = "trade" | "24h" | "7d" | "30d" | "window";
/** Where a holder's hold-time estimate came from: its own round trips, the token median, or the default. */
export type HoldSource = "trader" | "token" | "default";

export interface Holder {
  address: string;
  label: string;
  valueUsd: number;
  /** Percent of supply. */
  ownershipPct: number;
  /** Balance change over 7 days as a percent of the balance 7 days ago, clamped to -100..999. */
  change7dPct: number;
  /** Last smart money BUY of the token by this wallet inside the window (ISO), null when none was seen. */
  lastBuyAt: string | null;
  /** The instant the countdown starts from (ISO): lastBuyAt when known, otherwise an estimate. */
  anchorAt: string;
  anchorSource: AnchorSource;
  /** Typical hold in hours: the wallet's own FIFO-paired, amount-weighted average when it has round trips. */
  avgHoldHours: number;
  holdSource: HoldSource;
  /** BUY→SELL lot pairings observed for this wallet in the window. */
  pairs: number;
  /** anchorAt + avgHoldHours (ISO). The hand points here. */
  expectedExitAt: string;
  /** True when expectedExitAt was already in the past at build time. */
  overdue: boolean;
}

export interface ExitToken {
  symbol: string;
  address: string;
  chain: Chain;
  netFlow7dUsd: number;
  traderCount: number;
  marketCapUsd: number | null;
  /** Median of the per-trader average hold times (hours) seen in the sampled trades. */
  medianHoldHours: number;
  /** Smart money DEX trades sampled for the estimate. */
  tradesSampled: number;
  /** Traders with at least one completed BUY→SELL pair. */
  tradersPaired: number;
  totalValueUsd: number;
  overdueCount: number;
  /** Sorted by expectedExitAt ascending: overdue first, then soonest. */
  holders: Holder[];
}

export interface ExitClockData {
  generatedAt: string;
  window: { from: string; to: string };
  tokens: ExitToken[];
}

type NetflowRow = RowOf<"/api/v1/smart-money/netflow">;
type HolderRow = RowOf<"/api/v1/tgm/holders">;
type TradeRow = RowOf<"/api/v1/tgm/dex-trades">;

export const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const WINDOW_DAYS = 30;
const TOKENS = 3;
const HOLDERS_PER_TOKEN = 30;
const TRADES_PER_PAGE = 100;
/** A second page of trades costs one more credit per token and only happens when the first page was full. */
const MAX_TRADE_PAGES = 2;
/** Used only when neither the wallet nor the token shows a single completed round trip in the window. */
export const DEFAULT_HOLD_HOURS = 72;
/** The API asks for these alongside label_type "smart_money". */
const SMART_MONEY_LABELS = ["30D Smart Trader", "90D Smart Trader", "180D Smart Trader", "Fund", "Smart Trader"] as const;
/** Natives, wrapped natives, liquid staking and stables: inflow into these is not a position with an exit. */
const NOT_A_TOKEN = /^(W?ETH|W?SOL|W?BNB|STETH|WSTETH|CBETH|WEETH|RETH|USDC|USDT|USDE|USDS|DAI|FDUSD|PYUSD|USD1|TUSD|FRAX|USD0)$/i;

const num = (v: number | string | null | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const iso = (ms: number): string => new Date(ms).toISOString();
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round = (n: number, digits = 2): number => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

export function median(values: readonly number[]): number {
  const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!s.length) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** EVM addresses are case-insensitive hex; Solana's base58 is case-sensitive, so only EVM is folded. */
export function addressKey(chain: string, address: string): string {
  return isEvmChain(chain) ? address.toLowerCase() : address;
}

export interface TradeLike {
  trader: string;
  action: string;
  /** ISO 8601 timestamp. */
  at: string;
  /** Token units. */
  amount: number;
}

export interface TraderHold {
  /** Amount-weighted mean hours between a BUY lot and the SELL that consumed it; null without a pair. */
  avgHoldHours: number | null;
  pairs: number;
  buys: number;
  sells: number;
  lastBuyAt: string | null;
}

/**
 * FIFO pairing per trader. Trades are sorted by time; every BUY opens a lot; every SELL consumes the
 * oldest open lots first. Each consumed slice contributes (hours held × amount) to that trader's
 * weighted average, so a wallet that trims 1% after an hour and sells the rest a week later reads
 * as a week-long holder. SELLs with no open lot were bought before the window and are ignored.
 * Durations only ever leave milliseconds through HOUR_MS.
 */
export function pairHolds(trades: readonly TradeLike[]): Map<string, TraderHold> {
  const rows = trades
    .map((t) => ({ trader: t.trader, action: t.action, ms: Date.parse(t.at), amount: Number(t.amount) }))
    .filter((t) => t.trader && (t.action === "BUY" || t.action === "SELL") && Number.isFinite(t.ms) && t.amount > 0)
    .sort((a, b) => a.ms - b.ms);

  interface Acc {
    weightedHours: number;
    weight: number;
    pairs: number;
    buys: number;
    sells: number;
    lastBuyMs: number;
    lots: { ms: number; left: number }[];
  }
  const acc = new Map<string, Acc>();
  for (const t of rows) {
    let a = acc.get(t.trader);
    if (!a) {
      a = { weightedHours: 0, weight: 0, pairs: 0, buys: 0, sells: 0, lastBuyMs: Number.NaN, lots: [] };
      acc.set(t.trader, a);
    }
    if (t.action === "BUY") {
      a.lots.push({ ms: t.ms, left: t.amount });
      a.buys += 1;
      a.lastBuyMs = t.ms; // rows are ascending, so the last assignment is the latest buy
      continue;
    }
    a.sells += 1;
    let remaining = t.amount;
    while (remaining > 0) {
      const lot = a.lots[0];
      if (!lot) break; // nothing open: bought before the window
      const matched = Math.min(lot.left, remaining);
      const hours = Math.max(0, (t.ms - lot.ms) / HOUR_MS);
      a.weightedHours += hours * matched;
      a.weight += matched;
      a.pairs += 1;
      lot.left -= matched;
      remaining -= matched;
      if (lot.left <= 0) a.lots.shift();
    }
  }

  const out = new Map<string, TraderHold>();
  for (const [trader, a] of acc) {
    out.set(trader, {
      avgHoldHours: a.weight > 0 ? a.weightedHours / a.weight : null,
      pairs: a.pairs,
      buys: a.buys,
      sells: a.sells,
      lastBuyAt: Number.isFinite(a.lastBuyMs) ? iso(a.lastBuyMs) : null,
    });
  }
  return out;
}

/** Minimal structural inputs so the assembly step can be exercised without the API. Real rows satisfy them. */
export interface TokenInput {
  symbol: string;
  address: string;
  chain: Chain;
  netFlow7dUsd: number;
  traderCount: number;
  marketCapUsd: number | null;
}
export interface HolderInput {
  address?: string;
  address_label?: string;
  token_amount?: number;
  value_usd?: number;
  ownership_percentage?: number;
  balance_change_24h?: number;
  balance_change_7d?: number;
  balance_change_30d?: number;
}
export interface TradeInput {
  trader_address: string;
  action: string;
  block_timestamp: string;
  token_amount: number;
}

/** Turns one token's holders + trades into dial hands. Pure; `nowMs` is the build instant. */
export function assembleToken(token: TokenInput, holderRows: readonly HolderInput[], tradeRows: readonly TradeInput[], nowMs: number): ExitToken {
  const { chain } = token;
  const holds = pairHolds(
    tradeRows.map((t) => ({ trader: addressKey(chain, t.trader_address), action: t.action, at: t.block_timestamp, amount: num(t.token_amount) })),
  );
  const traderAverages = [...holds.values()].map((h) => h.avgHoldHours).filter((h): h is number => h !== null);
  const medianHoldHours = traderAverages.length ? median(traderAverages) : DEFAULT_HOLD_HOURS;

  const holders: Holder[] = [];
  const seen = new Set<string>();
  for (const row of holderRows) {
    if (!row.address) continue;
    const key = addressKey(chain, row.address);
    if (seen.has(key)) continue;
    seen.add(key);

    const own = holds.get(key);
    const tokenAmount = num(row.token_amount);
    const change24h = num(row.balance_change_24h);
    const change7d = num(row.balance_change_7d);
    const change30d = num(row.balance_change_30d);
    const prior = tokenAmount - change7d;
    const change7dPct = clamp(prior > 0 ? (change7d / prior) * 100 : change7d > 0 ? 100 : 0, -100, 999);

    // The anchor: the observed last BUY, else the middle of the freshest balance-change window that shows buying.
    let anchorMs: number;
    let anchorSource: AnchorSource;
    if (own?.lastBuyAt) {
      anchorMs = Date.parse(own.lastBuyAt);
      anchorSource = "trade";
    } else if (change24h > 0) {
      anchorMs = nowMs - 12 * HOUR_MS;
      anchorSource = "24h";
    } else if (change7d > 0) {
      anchorMs = nowMs - 3.5 * DAY_MS;
      anchorSource = "7d";
    } else if (change30d > 0) {
      anchorMs = nowMs - 15 * DAY_MS;
      anchorSource = "30d";
    } else {
      anchorMs = nowMs - WINDOW_DAYS * DAY_MS;
      anchorSource = "window";
    }

    const ownHold = own?.avgHoldHours ?? null;
    const avgHoldHours = ownHold !== null ? ownHold : medianHoldHours;
    const holdSource: HoldSource = ownHold !== null ? "trader" : traderAverages.length ? "token" : "default";
    const exitMs = anchorMs + avgHoldHours * HOUR_MS;

    holders.push({
      address: row.address,
      label: row.address_label?.trim() || "Smart Money",
      valueUsd: round(num(row.value_usd)),
      ownershipPct: round(num(row.ownership_percentage), 4),
      change7dPct: round(change7dPct, 1),
      lastBuyAt: anchorSource === "trade" ? iso(anchorMs) : null,
      anchorAt: iso(anchorMs),
      anchorSource,
      avgHoldHours: round(avgHoldHours),
      holdSource,
      pairs: own?.pairs ?? 0,
      expectedExitAt: iso(exitMs),
      overdue: exitMs <= nowMs,
    });
  }
  holders.sort((a, b) => Date.parse(a.expectedExitAt) - Date.parse(b.expectedExitAt) || b.valueUsd - a.valueUsd);

  return {
    ...token,
    medianHoldHours: round(medianHoldHours),
    tradesSampled: tradeRows.length,
    tradersPaired: traderAverages.length,
    totalValueUsd: round(holders.reduce((s, h) => s + h.valueUsd, 0)),
    overdueCount: holders.filter((h) => h.overdue).length,
    holders,
  };
}

/**
 * Builds the clock. 5 credits for the netflow scan, then per token 5 (holders) + 1 (trades) and one
 * more only when the first page of trades was full: 23 credits typical, 26 worst case (cap 40).
 */
export async function buildExitClock(nansen: NansenClient): Promise<ExitClockData> {
  const nowMs = Date.now();
  const range = lastDays(WINDOW_DAYS, new Date(nowMs));

  // 1) Where smart money is piling in this week. 5 credits.
  const netflow = await nansen.smartMoney.netflow({
    chains: [...CHAINS],
    filters: { include_stablecoins: false, include_native_tokens: false },
    order_by: [{ field: "net_flow_7d_usd", direction: "DESC" }],
    pagination: { page: 1, per_page: 8 },
  });
  const seenTokens = new Set<string>();
  const picks: TokenInput[] = [];
  for (const t of (netflow.data ?? []) as NetflowRow[]) {
    if (picks.length >= TOKENS) break;
    if (!(CHAINS as readonly string[]).includes(t.chain)) continue;
    if (!t.token_address || num(t.net_flow_7d_usd) <= 0) continue;
    if (NOT_A_TOKEN.test(t.token_symbol ?? "")) continue;
    const key = `${t.chain}:${addressKey(t.chain, t.token_address)}`;
    if (seenTokens.has(key)) continue;
    seenTokens.add(key);
    picks.push({
      symbol: t.token_symbol || "?",
      address: t.token_address,
      chain: t.chain as Chain,
      netFlow7dUsd: round(num(t.net_flow_7d_usd)),
      traderCount: num(t.trader_count),
      marketCapUsd: t.market_cap_usd == null ? null : round(num(t.market_cap_usd)),
    });
  }

  const tokens: ExitToken[] = [];
  for (const pick of picks) {
    const tag = `token:${pick.symbol}`;

    // 2) Who holds it: the smart money holder list, biggest bags first. 5 credits.
    const holdersRes = await nansen.tgm.holders(
      {
        chain: pick.chain,
        token_address: pick.address,
        label_type: "smart_money",
        filters: { include_smart_money_labels: [...SMART_MONEY_LABELS] },
        order_by: [{ field: "value_usd", direction: "DESC" }],
        pagination: { page: 1, per_page: HOLDERS_PER_TOKEN },
      },
      { tag },
    );
    const holderRows: HolderRow[] = (holdersRes.data ?? []).slice(0, HOLDERS_PER_TOKEN);

    // 3) How smart money trades it: the most recent trades of the last 30 days. 1 credit per page.
    const tradeRows: TradeRow[] = [];
    for (let page = 1; page <= MAX_TRADE_PAGES; page++) {
      const res = await nansen.tgm.dexTrades(
        {
          chain: pick.chain,
          token_address: pick.address,
          only_smart_money: true,
          date: range,
          order_by: [{ field: "block_timestamp", direction: "DESC" }],
          pagination: { page, per_page: TRADES_PER_PAGE },
        },
        { tag: `${tag}:trades:${page}` },
      );
      const rows = res.data ?? [];
      tradeRows.push(...rows);
      if (rows.length < TRADES_PER_PAGE || res.pagination?.is_last_page !== false) break;
    }

    tokens.push(assembleToken(pick, holderRows, tradeRows, nowMs));
  }

  return { generatedAt: iso(nowMs), window: range, tokens };
}
