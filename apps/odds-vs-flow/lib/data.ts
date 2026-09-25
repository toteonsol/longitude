import type { NansenClient, RowOf } from "@longitude/nansen";
import { CreditCapExceededError } from "@longitude/nansen";

/** Chains the flow side runs on: where BTC (as WBTC), ETH and SOL have Smart Money coverage. */
export type Chain = "ethereum" | "solana";
const CHAINS: readonly Chain[] = ["ethereum", "solana"];

/** The crowd's stance on the asset once the question's direction is applied to its YES lean. */
export type Stance = "bullish" | "bearish" | "split";
/** Smart money's stance, read straight off the sign of the weekly net flow. */
export type FlowStance = "buying" | "selling" | "flat";
/** Are the two sides actually opposed? Decides how taut the rope is. */
export type Relation = "contested" | "aligned" | "unopposed";

export interface Market {
  id: string;
  question: string;
  slug: string;
  /** Crowd-implied probability of YES, 1..99. */
  yesPct: number;
  /** Best YES bid / ask in cents when the screener exposed them. */
  bidCents: number | null;
  askCents: number | null;
  volumeUsd: number;
  volume24hUsd: number;
  liquidityUsd: number;
  traders24h: number;
  /** ISO datetime the market resolves; "" when Polymarket did not say. */
  endsAt: string;
  /** +1 when YES means the price goes up (above / reach / hit), -1 when YES means down (below / dip / fall). */
  direction: 1 | -1;
}

export interface TokenFlow {
  symbol: string;
  chain: Chain;
  address: string;
  netFlow1hUsd: number;
  netFlow24hUsd: number;
  netFlow7dUsd: number;
  netFlow30dUsd: number;
  /** Smart Money traders of the token in the past 30 days. */
  traderCount: number;
  marketCapUsd: number;
}

export interface Bout {
  id: string;
  number: number;
  asset: { symbol: string; name: string };
  market: Market;
  token: TokenFlow;
  crowd: { conviction: number; stance: Stance };
  flow: { strength: number; stance: FlowStance };
  relation: Relation;
  /** -1..1, negative = the crowd is pulling harder, positive = smart money is. See `pullOf`. */
  pull: number;
  verdict: string;
}

export interface OddsVsFlowData {
  generatedAt: string;
  bouts: Bout[];
}

type ScreenerRow = RowOf<"/api/v1/prediction-market/market-screener">;
type NetflowRow = RowOf<"/api/v1/smart-money/netflow">;
type BookRow = RowOf<"/api/v1/prediction-market/orderbook">;

interface Asset {
  symbol: string;
  name: string;
  /** Screener search term. */
  query: string;
  /** The question must actually be about this asset. */
  mention: RegExp;
  /** Netflow symbols that stand in for the asset, best first. */
  tokens: readonly string[];
  /** Preferred chain when the same symbol shows up on both. */
  chain: Chain;
}

const ASSETS: readonly Asset[] = [
  { symbol: "BTC", name: "Bitcoin", query: "bitcoin", mention: /\b(bitcoin|btc)\b/i, tokens: ["WBTC", "BTC", "CBBTC", "TBTC"], chain: "ethereum" },
  { symbol: "ETH", name: "Ethereum", query: "ethereum", mention: /\b(ethereum|ether|eth)\b/i, tokens: ["ETH", "WETH"], chain: "ethereum" },
  { symbol: "SOL", name: "Solana", query: "solana", mention: /\b(solana|sol)\b/i, tokens: ["SOL", "WSOL"], chain: "solana" },
];

const num = (v: number | string | null | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const usd = (n: number): string =>
  Math.abs(n) >= 1e9
    ? `$${(n / 1e9).toFixed(2)}B`
    : Math.abs(n) >= 1e6
      ? `$${(n / 1e6).toFixed(1)}M`
      : Math.abs(n) >= 1e3
        ? `$${(n / 1e3).toFixed(0)}K`
        : `$${n.toFixed(0)}`;

/* ------------------------------------------------------------------------------------------------
 * Reading the question
 * ---------------------------------------------------------------------------------------------- */

const PRICE = /\$\s?\d[\d,]*(?:\.\d+)?\s?[kmb]?\b|\b\d{2,3}k\b/i;
const UP = /\b(above|reach(?:es)?|hit(?:s)?|exceed(?:s)?|higher|surpass(?:es)?|all[- ]time high|ath|up or down|new high)\b/i;
const DOWN = /\b(below|under|dip(?:s)?|drop(?:s)?|fall(?:s)?|lower|crash(?:es)?|sink(?:s)?|plunge(?:s)?|down to)\b/i;
const RANGE = /\bbetween\b/i;
/** Up-calls that carry no dollar figure. */
const NO_PRICE_NEEDED = /up or down|all[- ]time high|\bath\b/i;

/**
 * Which way YES points for a price question. +1: "Will Bitcoin be above $120,000 on October 3?",
 * "…reach $150K by…", "Bitcoin Up or Down…". -1: "…dip to $90,000…", "…fall below…". null when the
 * question is not a directional price call (ranges, "or" questions, ETF approvals, flippenings).
 */
export function readQuestion(question: string): 1 | -1 | null {
  const q = question.trim();
  if (!q || RANGE.test(q)) return null;
  const up = UP.test(q);
  const down = DOWN.test(q);
  if (up === down) return null;
  if (!PRICE.test(q) && !NO_PRICE_NEEDED.test(q)) return null;
  return up ? 1 : -1;
}

/* ------------------------------------------------------------------------------------------------
 * The tug of war
 * ---------------------------------------------------------------------------------------------- */

/** Flows under this read as "flat"; flows at or above the ceiling pull with full strength. */
export const FLOW_FLOOR_USD = 1e4;
export const FLOW_CEIL_USD = 1e9;

/** 0 (coin flip) .. 1 (certain): how far the crowd's YES price sits from 50¢. */
export function crowdConviction(yesPct: number): number {
  return clamp(Math.abs(yesPct - 50) / 50, 0, 1);
}

/** 0..1 on a log scale: $10K → 0, $1M → 0.4, $10M → 0.6, $100M → 0.8, $1B → 1. */
export function flowStrength(netFlowUsd: number): number {
  const abs = Math.abs(netFlowUsd);
  if (abs < FLOW_FLOOR_USD) return 0;
  const lo = Math.log10(FLOW_FLOOR_USD);
  const hi = Math.log10(FLOW_CEIL_USD);
  return clamp((Math.log10(abs) - lo) / (hi - lo), 0, 1);
}

/** A market within 3¢ of 50 is a coin flip; otherwise the question's direction turns the YES lean into a call on the asset. */
export function crowdStance(yesPct: number, direction: 1 | -1): Stance {
  if (Math.abs(yesPct - 50) < 3) return "split";
  const bullish = (yesPct > 50 ? direction : -direction) > 0;
  return bullish ? "bullish" : "bearish";
}

export function flowStance(netFlowUsd: number): FlowStance {
  if (flowStrength(netFlowUsd) === 0) return "flat";
  return netFlowUsd > 0 ? "buying" : "selling";
}

export function relationOf(crowd: Stance, flow: FlowStance): Relation {
  if (crowd === "split" || flow === "flat") return "unopposed";
  return (crowd === "bullish") === (flow === "buying") ? "aligned" : "contested";
}

/**
 * `pull` ∈ [-1, 1]: who is pulling harder on the rope.
 *
 *   crowd = |yesPct - 50| / 50                                  the crowd's conviction, 0 (coin flip) .. 1 (certain)
 *   flow  = clamp((log10 |netFlow7dUsd| - 4) / 5, 0, 1)         smart money's strength, $10K → 0, $1M → 0.4, $100M → 0.8, $1B → 1
 *   pull  = flow - crowd                                        > 0 smart money is winning, < 0 the crowd is
 *
 * Sign and sides: the market question's direction (+1 when YES means the price goes up, -1 when YES
 * means down) turns the crowd's YES lean into a bullish or bearish stance; the sign of the net flow
 * gives smart money's stance (buying = bullish). Opposite stances → `contested`, a real tug of war and
 * a taut rope. Same stance → `aligned`, both pulling the same way, the rope goes slack and the knot
 * only shows who leans harder. A 50/50 crowd or a flat flow → `unopposed`.
 */
export function pullOf(yesPct: number, netFlow7dUsd: number): number {
  return clamp(Number((flowStrength(netFlow7dUsd) - crowdConviction(yesPct)).toFixed(3)), -1, 1);
}

interface Verdictable {
  asset: { name: string };
  market: Pick<Market, "yesPct">;
  token: Pick<TokenFlow, "netFlow7dUsd">;
  crowd: Bout["crowd"];
  flow: Bout["flow"];
  relation: Relation;
  pull: number;
}

/** One dry sentence per bout, ring-announcer voice. */
export function verdictOf(b: Verdictable): string {
  const money = usd(Math.abs(b.token.netFlow7dUsd));
  const crowdSide = b.crowd.stance === "bullish" ? "up" : b.crowd.stance === "bearish" ? "down" : "a coin flip";
  const verb = b.flow.stance === "buying" ? "buying" : b.flow.stance === "selling" ? "selling" : "sitting still";
  const lead = b.pull > 0.1 ? "Smart money has the rope" : b.pull < -0.1 ? "The crowd has the rope" : "Dead even";
  const price = `YES trades at ${b.market.yesPct}¢`;
  switch (b.relation) {
    case "contested":
      return `${lead}: ${price} (the crowd leans ${crowdSide} on ${b.asset.name}) while smart money is ${verb} ${money} this week.`;
    case "aligned":
      return `No fight here: the crowd leans ${crowdSide} on ${b.asset.name} and smart money is ${verb} ${money}. ${
        b.pull > 0.1 ? "Smart money leans harder." : b.pull < -0.1 ? "The crowd leans harder." : "Same lean, same weight."
      }`;
    default:
      return b.crowd.stance === "split"
        ? `The crowd is at a coin flip on ${b.asset.name}; smart money's ${money} of ${verb} goes unopposed.`
        : `Smart money is flat on ${b.asset.name} this week; the crowd's ${b.market.yesPct}¢ call stands unopposed.`;
  }
}

/** Pure assembly of one bout from a market and its token flow. The seed and the sample use the same function. */
export function boutOf(input: { number: number; asset: { symbol: string; name: string }; market: Market; token: TokenFlow }): Bout {
  const { number, asset, market, token } = input;
  const crowd = { conviction: Number(crowdConviction(market.yesPct).toFixed(3)), stance: crowdStance(market.yesPct, market.direction) };
  const flow = { strength: Number(flowStrength(token.netFlow7dUsd).toFixed(3)), stance: flowStance(token.netFlow7dUsd) };
  const relation = relationOf(crowd.stance, flow.stance);
  const pull = pullOf(market.yesPct, token.netFlow7dUsd);
  const partial = { asset, market, token, crowd, flow, relation, pull };
  return { id: `${asset.symbol.toLowerCase()}-${market.id}`, number, ...partial, verdict: verdictOf(partial) };
}

/* ------------------------------------------------------------------------------------------------
 * Nansen
 * ---------------------------------------------------------------------------------------------- */

interface Quote {
  yesPct: number;
  bidCents: number | null;
  askCents: number | null;
}

/** Polymarket prices are 0..1 for the YES token; tolerate cents just in case. */
function prob(v: number | string | null | undefined): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n > 1 ? n / 100 : n;
}

const cents = (p: number | undefined): number | null => (p === undefined ? null : Math.round(p * 100));

function quoteFrom(bid: number | undefined, ask: number | undefined, last: number | undefined): Quote | undefined {
  const mid = bid !== undefined && ask !== undefined ? (bid + ask) / 2 : (last ?? bid ?? ask);
  if (mid === undefined) return undefined;
  return { yesPct: clamp(Math.round(mid * 100), 1, 99), bidCents: cents(bid), askCents: cents(ask) };
}

/** The screener's own price fields. Mid of best bid/ask, else the last trade. */
function quoteOf(row: ScreenerRow): Quote | undefined {
  return quoteFrom(prob(row.best_bid), prob(row.best_ask), prob(row.last_trade_price));
}

/** Fallback: rebuild the YES quote from the CLOB. 1 credit, only when the screener had no price. */
async function bookQuote(nansen: NansenClient, marketId: string): Promise<Quote | undefined> {
  try {
    const res = await nansen.predictionMarket.orderbook({ market_id: marketId, pagination: { page: 1, per_page: 100 } }, { tag: `book:${marketId}` });
    const rows: BookRow[] = res.data ?? [];
    if (!rows.length) return undefined;
    const labelled = rows.filter((r) => /^(yes|up)$/i.test(r.outcome ?? ""));
    const firstIndex = Math.min(...rows.map((r) => num(r.outcome_index)));
    const yes = labelled.length ? labelled : rows.filter((r) => num(r.outcome_index) === firstIndex);
    const bids = yes.filter((r) => /buy|bid/i.test(r.side ?? "")).map((r) => prob(r.price)).filter((p): p is number => p !== undefined);
    const asks = yes.filter((r) => /sell|ask/i.test(r.side ?? "")).map((r) => prob(r.price)).filter((p): p is number => p !== undefined);
    return quoteFrom(bids.length ? Math.max(...bids) : undefined, asks.length ? Math.min(...asks) : undefined, undefined);
  } catch (err) {
    if (err instanceof CreditCapExceededError) throw err;
    return undefined;
  }
}

function marketOf(row: ScreenerRow, direction: 1 | -1, quote: Quote): Market {
  return {
    id: String(row.market_id),
    question: (row.question ?? "").trim(),
    slug: row.slug ?? "",
    yesPct: quote.yesPct,
    bidCents: quote.bidCents,
    askCents: quote.askCents,
    volumeUsd: num(row.volume),
    volume24hUsd: num(row.volume_24hr),
    liquidityUsd: num(row.liquidity),
    traders24h: num(row.unique_traders_24h),
    endsAt: row.end_date ?? "",
    direction,
  };
}

function tokenOf(row: NetflowRow): TokenFlow {
  return {
    symbol: row.token_symbol,
    chain: row.chain as Chain,
    address: row.token_address,
    netFlow1hUsd: num(row.net_flow_1h_usd),
    netFlow24hUsd: num(row.net_flow_24h_usd),
    netFlow7dUsd: num(row.net_flow_7d_usd),
    netFlow30dUsd: num(row.net_flow_30d_usd),
    traderCount: num(row.trader_count),
    marketCapUsd: num(row.market_cap_usd),
  };
}

/** For each asset, the netflow row that stands for it: preferred symbol first, then its home chain, then the bigger flow. */
function matchTokens(rows: NetflowRow[], into: Map<string, TokenFlow> = new Map()): Map<string, TokenFlow> {
  for (const asset of ASSETS) {
    if (into.has(asset.symbol)) continue;
    const best = rows
      .map((r) => ({ r, rank: asset.tokens.indexOf((r.token_symbol ?? "").toUpperCase()) }))
      .filter((x) => x.rank >= 0 && CHAINS.includes(x.r.chain as Chain))
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          Number(b.r.chain === asset.chain) - Number(a.r.chain === asset.chain) ||
          Math.abs(num(b.r.net_flow_7d_usd)) - Math.abs(num(a.r.net_flow_7d_usd)),
      )[0];
    if (best) into.set(asset.symbol, tokenOf(best.r));
  }
  return into;
}

interface Candidate {
  asset: Asset;
  row: ScreenerRow;
  direction: 1 | -1;
}

const volume24h = (c: Candidate): number => num(c.row.volume_24hr);

/**
 * Builds the card. About 8 credits on a normal run (three 1-credit screener queries and one 5-credit
 * netflow), at most 17 when every fallback fires (a second netflow for a missing major, an orderbook
 * per bout). Seed cap: 25.
 */
export async function buildOddsVsFlow(nansen: NansenClient): Promise<OddsVsFlowData> {
  // 1) The crowd: the most traded open markets that name each asset, kept only when the question is a
  //    directional price call. 1 credit per asset.
  const found: Candidate[] = [];
  for (const asset of ASSETS) {
    const res = await nansen.predictionMarket.marketScreener(
      {
        query: asset.query,
        status: "active",
        order_by: [{ field: "volume_24hr", direction: "DESC" }],
        pagination: { page: 1, per_page: 25 },
      },
      { tag: `crowd:${asset.symbol}` },
    );
    for (const row of res.data ?? []) {
      const question = (row.question ?? "").trim();
      if (!question || row.closed === true || row.active === false) continue;
      if (!asset.mention.test(question)) continue;
      const direction = readQuestion(question);
      if (!direction) continue;
      found.push({ asset, row, direction });
    }
  }

  // 2) Smart money: one netflow call, natives included, biggest market caps first so the majors are on
  //    the page. 5 credits. If a major is missing (and has a market), one targeted retry by symbol.
  const flows = await nansen.smartMoney.netflow(
    {
      chains: [...CHAINS],
      filters: { include_native_tokens: true, include_stablecoins: false },
      order_by: [{ field: "market_cap_usd", direction: "DESC" }],
      pagination: { page: 1, per_page: 100 },
    },
    { tag: "flow:majors" },
  );
  const tokens = matchTokens(flows.data ?? []);
  const missing = ASSETS.filter((a) => !tokens.has(a.symbol) && found.some((c) => c.asset === a));
  if (missing.length) {
    const retry = await nansen.smartMoney.netflow(
      {
        chains: [...CHAINS],
        filters: { include_native_tokens: true, include_stablecoins: false, token_address: missing.flatMap((a) => [...a.tokens]) },
        pagination: { page: 1, per_page: 20 },
      },
      { tag: "flow:retry" },
    );
    matchTokens(retry.data ?? [], tokens);
  }

  // 3) The card: the busiest market per asset, then a fourth bout from what is left, preferring a
  //    question that runs the other way from its asset's main bout (a "dip to" against an "above").
  const picks: Candidate[] = [];
  const taken = new Set<string>();
  const mainDirection = new Map<string, 1 | -1>();
  for (const asset of ASSETS) {
    if (!tokens.has(asset.symbol)) continue;
    const best = found.filter((c) => c.asset === asset).sort((a, b) => volume24h(b) - volume24h(a))[0];
    if (!best) continue;
    picks.push(best);
    taken.add(String(best.row.market_id));
    mainDirection.set(asset.symbol, best.direction);
  }
  const otherWay = (c: Candidate): number => Number(mainDirection.get(c.asset.symbol) !== c.direction);
  const fourth = found
    .filter((c) => tokens.has(c.asset.symbol) && !taken.has(String(c.row.market_id)))
    .sort((a, b) => otherWay(b) - otherWay(a) || volume24h(b) - volume24h(a))[0];
  if (fourth) picks.push(fourth);

  // 4) Odds: the screener's prices; the orderbook only when it had none. ≤ 1 credit per bout.
  const bouts: Bout[] = [];
  for (const pick of picks) {
    const quote = quoteOf(pick.row) ?? (await bookQuote(nansen, String(pick.row.market_id)));
    const token = tokens.get(pick.asset.symbol);
    if (!quote || !token) continue;
    bouts.push(
      boutOf({
        number: bouts.length + 1,
        asset: { symbol: pick.asset.symbol, name: pick.asset.name },
        market: marketOf(pick.row, pick.direction, quote),
        token,
      }),
    );
  }

  return { generatedAt: new Date().toISOString(), bouts };
}
