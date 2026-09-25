import type { NansenClient, RowOf } from "@longitude/nansen";
import { CreditCapExceededError, NansenConfigError, isoDate, lastDays, shortAddress } from "@longitude/nansen";
import { article, chainName, listJoin, numWord, pctText, qty, usd, whenPhrase } from "./format";

/** Chains the obituary desk covers. */
export const CHAINS = ["ethereum", "solana", "base"] as const;
export type Chain = (typeof CHAINS)[number];

/** Notices on a front page. */
export const OBITUARIES = 8;
/** Smallest sale that earns a notice, USD. The tape is sorted by value, so this only matters on a quiet day. */
export const MIN_EXIT_USD = 2_500;
/** Days of history behind the "lifetime" numbers. */
export const LIFETIME_DAYS = 180;

export interface Edition {
  /** YYYY-MM-DD (UTC) the page was set. */
  date: string;
  /** Daily edition number: days since the genesis block. 3 Jan 2009 was No. 1. */
  number: number;
  /** One volume per calendar year, 2009 = Vol. I. */
  volume: number;
}

export interface Exit {
  symbol: string;
  tokenAddress: string;
  /** Tokens sold, decimal units. */
  amount: number;
  valueUsd: number;
  /** What the position was converted into (USDC, WETH, SOL...). */
  into: string;
  /** ISO timestamp of the sale. */
  at: string;
  txHash: string;
  /** Qualifying exits by this wallet on the tape, and what they added up to. */
  exitsToday: number;
  soldTodayUsd: number;
  /** Value of the exited token still among the wallet's top holdings; 0 when nothing remains. */
  stillHoldsUsd: number;
}

export interface TopToken {
  symbol: string;
  pnlUsd: number;
  roiPct: number;
}

export interface Lifetime {
  /** Realized PnL over the last 180 days, USD. */
  pnlUsd: number;
  roiPct: number;
  /** Percent, 0..100. */
  winRate: number;
  tokens: number;
  /** Sales counted by the profiler. */
  trades: number;
  topTokens: TopToken[];
  /** False when the profiler had no record for the wallet (the call failed or came back empty). */
  known: boolean;
}

export interface Holding {
  symbol: string;
  valueUsd: number;
  amount: number;
}

/** What the desk knows before it writes. */
export interface ObituaryFacts {
  address: string;
  label: string;
  chain: Chain;
  exit: Exit;
  lifetime: Lifetime;
  survivedBy: Holding[];
}

export interface Obituary extends ObituaryFacts {
  headline: string;
  deck: string;
  body: string[];
  /** Sum of survivedBy. */
  estateUsd: number;
}

export interface WalletObituariesData {
  generatedAt: string;
  edition: Edition;
  /** The window the lifetime numbers cover. */
  window: { from: string; to: string };
  /** Biggest exit first. The first one is the lead. */
  obituaries: Obituary[];
}

type TradeRow = RowOf<"/api/v1/smart-money/dex-trades">;
type BalanceRow = RowOf<"/api/v1/profiler/address/current-balance">;
type PnlSummary = Awaited<ReturnType<NansenClient["profiler"]["pnlSummary"]>>;

const num = (v: number | string | null | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
/** Fractions (0.62) and percents (62) both arrive from the API; normalise to percent. */
const pct = (v: number | null | undefined): number => {
  const n = num(v);
  return Math.abs(n) <= 1 ? n * 100 : n;
};

/* ------------------------------------------------------------------------------------------------
 * What counts as an exit
 * ---------------------------------------------------------------------------------------------- */

/** Money, not positions: selling these is really a buy of something else. */
const EXCLUDED_SYMBOLS = new Set<string>([
  // stablecoins
  "USDC", "USDT", "DAI", "USDE", "USDS", "FRAX", "TUSD", "USDP", "PYUSD", "GUSD", "LUSD", "CRVUSD", "GHO",
  "FDUSD", "USD1", "USDD", "BUSD", "SUSD", "SUSDE", "SUSDS", "USDBC", "USDC.E", "USDT.E", "USDY", "USD0",
  "RLUSD", "AUSD", "EURC", "EURS", "EURT", "USDL", "USDX", "DOLA", "MIM", "USDH", "USDG", "USDT0", "DEUSD",
  "SDAI", "CASH", "USDTB", "USDA", "UXD", "USDR",
  // natives, wrappers, liquid staking
  "ETH", "WETH", "SOL", "WSOL", "BTC", "WBTC", "CBBTC", "TBTC", "BNB", "WBNB", "MATIC", "POL", "WMATIC",
  "AVAX", "WAVAX", "STETH", "WSTETH", "RETH", "CBETH", "WEETH", "EZETH", "RSETH", "METH", "OSETH", "SFRXETH",
  "FRXETH", "MSOL", "JITOSOL", "BSOL", "JUPSOL", "BNSOL", "INF", "VSOL", "HSOL", "ETHX", "SWETH", "PUFETH",
  "STONE", "WBETH", "BNBX", "SOLVBTC", "LBTC", "FBTC", "EBTC", "UNIBTC", "STSOL", "LST",
]);
const STABLE_RE = /^[A-Z]{0,3}USD[A-Z0-9.]{0,3}$/;
const NATIVE_RE = /^W?(ETH|SOL|BTC|BNB)$/;

export function isExcludedSymbol(symbol: string | null | undefined): boolean {
  if (/USD/i.test(symbol ?? "")) return true;
  const s = (symbol ?? "").trim().toUpperCase();
  return !s || EXCLUDED_SYMBOLS.has(s) || STABLE_RE.test(s) || NATIVE_RE.test(s);
}

const isChain = (c: string): c is Chain => (CHAINS as readonly string[]).includes(c);

/** Nansen timestamps arrive as ISO or "YYYY-MM-DD HH:mm:ss"; both are UTC. */
function toIso(s: string): string {
  const t = s.includes("T") ? s : s.replace(" ", "T");
  const zoned = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(t) ? t : `${t}Z`;
  const d = new Date(zoned);
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

export interface ExitCandidate {
  address: string;
  label: string;
  chain: Chain;
  /** The wallet's biggest qualifying sale. */
  best: TradeRow;
  exits: number;
  soldUsd: number;
}

/** One candidate per wallet, biggest sale first. Sells of stables and natives are buys, so they are skipped. */
export function collectExits(rows: TradeRow[]): ExitCandidate[] {
  const byWallet = new Map<string, ExitCandidate>();
  for (const r of rows) {
    if (!r.trader_address || !isChain(r.chain) || isExcludedSymbol(r.token_sold_symbol)) continue;
    const value = num(r.trade_value_usd);
    if (value < MIN_EXIT_USD) continue;
    const key = `${r.chain}:${r.trader_address.toLowerCase()}`;
    const c = byWallet.get(key);
    if (!c) {
      byWallet.set(key, {
        address: r.trader_address,
        label: r.trader_address_label?.trim() || "Smart Money",
        chain: r.chain,
        best: r,
        exits: 1,
        soldUsd: value,
      });
    } else {
      c.exits += 1;
      c.soldUsd += value;
      if (value > num(c.best.trade_value_usd)) c.best = r;
    }
  }
  return [...byWallet.values()].sort((a, b) => num(b.best.trade_value_usd) - num(a.best.trade_value_usd));
}

/** Prefer one notice per token so the page reads as eight stories, not one; fill from the rest. */
export function pickDistinct(candidates: ExitCandidate[], n: number): ExitCandidate[] {
  const chosen: ExitCandidate[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const sym = c.best.token_sold_symbol.toUpperCase();
    if (seen.has(sym)) continue;
    seen.add(sym);
    chosen.push(c);
    if (chosen.length === n) break;
  }
  for (const c of candidates) {
    if (chosen.length >= n) break;
    if (!chosen.includes(c)) chosen.push(c);
  }
  return chosen.sort((a, b) => num(b.best.trade_value_usd) - num(a.best.trade_value_usd));
}

/* ------------------------------------------------------------------------------------------------
 * The edition
 * ---------------------------------------------------------------------------------------------- */

const GENESIS_UTC = Date.UTC(2009, 0, 3);

export function editionFor(d: Date): Edition {
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return {
    date: isoDate(d),
    number: Math.floor((day - GENESIS_UTC) / 86_400_000) + 1,
    volume: d.getUTCFullYear() - 2008,
  };
}

/* ------------------------------------------------------------------------------------------------
 * The copy desk. Dry, affectionate, and strictly about the numbers.
 * ---------------------------------------------------------------------------------------------- */

interface Vars {
  name: string;
  label: string;
  chain: string;
  sym: string;
  into: string;
  value: string;
  when: string;
  trades: number;
  tokens: number;
  exits: number;
}

const HEADLINES: Array<(v: Vars) => string> = [
  (v) => (v.trades > 0 ? `${v.name} Closes the Book on $${v.sym} After ${v.trades} Trades` : `${v.name} Closes the Book on $${v.sym}`),
  (v) => `$${v.sym} Loses a Patron as ${v.name} Retires a ${v.value} Position`,
  (v) => `A Quiet Exit: ${v.name} Steps Away From $${v.sym} With ${v.value}`,
  (v) => `${v.name}, ${v.label} of ${v.chain}, Retires From $${v.sym}`,
  (v) => `${v.value} Walks Out the Door as ${v.name} Leaves $${v.sym}`,
  (v) =>
    v.exits > 1
      ? `${v.name} Bids $${v.sym} a Fond Farewell, ${v.value} at a Time`
      : `${v.name} Bids $${v.sym} a Fond Farewell in a Single ${v.value} Sale`,
  (v) => `Ledger Closed: ${v.name} Converts Its $${v.sym} to ${v.into}`,
  (v) => `${v.name} Retires From $${v.sym}; ${v.chain} Loses ${article(v.label)} ${v.label}`,
];

const CLOSERS: Array<(v: Vars) => string> = [
  () => "The Smart Money desk notes that the address remains open; retirement, in this trade, is seldom permanent.",
  () => "Remembrances may be left on the block explorer. The wallet's next position has not been announced.",
  (v) => `Colleagues on ${v.chain} are reminded that the wallet still answers to its address, and may yet trade again.`,
  (v) => `The position is at rest in ${v.into}. The wallet is not.`,
];

function estatePhrase(survivedBy: Holding[], estateUsd: number): string {
  if (!survivedBy.length) return "no holdings of note";
  if (survivedBy.length === 1) return `a single holding worth ${usd(estateUsd)}`;
  return `a ${numWord(survivedBy.length)}-token estate worth ${usd(estateUsd)}`;
}

function winClause(winRate: number): string {
  if (winRate >= 60) return `winning ${pctText(winRate)} of the time, a record its peers would envy`;
  if (winRate >= 45) return `winning ${pctText(winRate)} of the time, which is to say about as often as anyone`;
  return `winning ${pctText(winRate)} of the time and pressing on regardless`;
}

/** Writes the notice. Pure, so the sample snapshot and the seed speak with one voice. */
export function composeObituary(facts: ObituaryFacts, index: number): Obituary {
  const { exit, lifetime, survivedBy } = facts;
  const estateUsd = survivedBy.reduce((s, h) => s + h.valueUsd, 0);
  const hasRecord = lifetime.known && lifetime.trades > 0;
  const v: Vars = {
    name: shortAddress(facts.address, 4),
    label: facts.label,
    chain: chainName(facts.chain),
    sym: exit.symbol,
    into: exit.into,
    value: usd(exit.valueUsd),
    when: whenPhrase(exit.at),
    trades: hasRecord ? lifetime.trades : 0,
    tokens: hasRecord ? lifetime.tokens : 0,
    exits: exit.exitsToday,
  };
  const headline = (HEADLINES[index % HEADLINES.length] ?? HEADLINES[0]!)(v);

  const sale = `Sold ${qty(exit.amount)} ${v.sym} on ${v.chain} for ${v.value} ${v.when}, taking payment in ${v.into}.`;
  const estate = estatePhrase(survivedBy, estateUsd);
  const record = !hasRecord
    ? `Nansen's profiler holds no six-month record for the wallet, which leaves ${estate}.`
    : lifetime.pnlUsd >= 0
      ? `Leaves ${usd(lifetime.pnlUsd)} in realized profit over six months, a ${pctText(lifetime.winRate)} win rate and ${estate}.`
      : `Leaves a six-month record of ${usd(-lifetime.pnlUsd)} in realized losses, a ${pctText(lifetime.winRate)} win rate and ${estate}.`;
  const deck = `${sale} ${record}`;

  // 1. The lede: when, who, what, and what became of the position. It opens with a word, not an
  //    address, so the drop cap is a capital letter.
  const opening = v.when.charAt(0).toUpperCase() + v.when.slice(1);
  let lede =
    `${opening}, ${v.name}, ${article(v.chain)} ${v.chain} wallet carried on Nansen's books as “${v.label}”, closed the book on $${v.sym}. ` +
    `It sold ${qty(exit.amount)} tokens in a single transaction for ${v.value}, taking payment in ${v.into}.`;
  if (exit.exitsToday > 1) {
    lede += ` The sale was the largest of ${numWord(exit.exitsToday)} exits the wallet made that day, ${usd(exit.soldTodayUsd)} in all.`;
  }
  if (exit.stillHoldsUsd > 0) {
    lede += ` A remainder of ${usd(exit.stillHoldsUsd)} in $${v.sym} stays on the books, which those who know the wallet describe as sentimental.`;
  } else if (survivedBy.length) {
    lede += ` Nothing of the position remains among its principal holdings.`;
  }

  // 2. The career.
  let career: string;
  if (!hasRecord) {
    career =
      `The profiler holds no record of the wallet's dealings on ${v.chain} over the past six months; ` +
      `whatever it did before ${v.when.replace(/^(on|late on|in the small hours of) /, "")}, it did quietly.`;
  } else {
    const tokensPhrase = lifetime.tokens === 1 ? "a single token" : `${lifetime.tokens} tokens`;
    career =
      `Over the past six months the wallet booked ${usd(Math.abs(lifetime.pnlUsd))} in realized ${lifetime.pnlUsd >= 0 ? "profit" : "losses"} ` +
      `across ${lifetime.trades} sales of ${tokensPhrase}, ${winClause(lifetime.winRate)}.`;
    const [t1, t2] = lifetime.topTokens;
    if (t1) {
      const fitting = t1.symbol.toUpperCase() === v.sym.toUpperCase() ? ", fittingly," : "";
      career += ` It will be remembered${fitting} for $${t1.symbol}, which returned ${usd(t1.pnlUsd)}`;
      career += t2 ? `, and for a ${t2.pnlUsd >= 0 ? "profitable" : "less fortunate"} spell in $${t2.symbol}.` : ".";
    }
  }

  // 3. The survivors.
  const survivors = survivedBy.length
    ? `It is survived by ${survivedBy.length === 1 ? "one holding" : `${numWord(survivedBy.length)} holdings`}: ` +
      `${listJoin(survivedBy.map((h) => `$${h.symbol} (${usd(h.valueUsd)})`))}. The estate is valued at ${usd(estateUsd)}.`
    : `No holdings of note survive it on ${v.chain}. The wallet leaves the table clean, which is its own kind of tidiness.`;

  // 4. The closer.
  const closer = (CLOSERS[index % CLOSERS.length] ?? CLOSERS[0]!)(v);

  return { ...facts, headline, deck, body: [lede, career, survivors, closer], estateUsd };
}

/* ------------------------------------------------------------------------------------------------
 * The builder
 * ---------------------------------------------------------------------------------------------- */

const UNKNOWN_LIFETIME: Lifetime = { pnlUsd: 0, roiPct: 0, winRate: 0, tokens: 0, trades: 0, topTokens: [], known: false };

function lifetimeFrom(s: PnlSummary): Lifetime {
  return {
    pnlUsd: num(s.realized_pnl_usd),
    roiPct: pct(s.realized_pnl_percent),
    winRate: pct(s.win_rate),
    tokens: num(s.traded_token_count),
    trades: num(s.traded_times),
    topTokens: (s.top5_tokens ?? [])
      .filter((t) => Boolean(t.token_symbol))
      .slice(0, 5)
      .map((t) => ({ symbol: t.token_symbol, pnlUsd: num(t.realized_pnl), roiPct: pct(t.realized_roi) })),
    known: true,
  };
}

function holdingsFrom(rows: BalanceRow[]): Holding[] {
  return rows
    .map((b) => ({ symbol: b.token_symbol, valueUsd: num(b.value_usd), amount: num(b.token_amount) }))
    .filter((h) => h.symbol && h.valueUsd >= 1)
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, 5);
}

/** A wallet that will not talk to the profiler still gets its notice; a spent budget or a missing key does not. */
function fatal(err: unknown): boolean {
  return err instanceof CreditCapExceededError || err instanceof NansenConfigError;
}

/**
 * Builds the day's front page. 5 credits for the tape (10 if a quiet day needs a second page) plus
 * 2 per wallet for eight wallets: 21 credits on a normal run, 26 at most. Cap 30.
 */
export async function buildWalletObituaries(nansen: NansenClient): Promise<WalletObituariesData> {
  const now = new Date();
  const window = lastDays(LIFETIME_DAYS, now);

  // 1) The tape: the last 24 hours of smart money DEX trades, biggest first. 5 credits.
  const request = {
    chains: [...CHAINS],
    order_by: [{ field: "trade_value_usd" as const, direction: "DESC" as const }],
  };
  const first = await nansen.smartMoney.dexTrades({ ...request, pagination: { page: 1, per_page: 100 } }, { tag: "tape:1" });
  let rows: TradeRow[] = first.data ?? [];
  let candidates = collectExits(rows);
  if (candidates.length < OBITUARIES && first.pagination?.is_last_page !== true) {
    const second = await nansen.smartMoney.dexTrades({ ...request, pagination: { page: 2, per_page: 100 } }, { tag: "tape:2" });
    rows = rows.concat(second.data ?? []);
    candidates = collectExits(rows);
  }
  const chosen = pickDistinct(candidates, OBITUARIES);

  // 2) Per wallet: the six-month record (1 credit) and what survives it (1 credit).
  const obituaries: Obituary[] = [];
  for (const [index, c] of chosen.entries()) {
    const tag = `obit:${shortAddress(c.address, 4)}`;
    let lifetime = UNKNOWN_LIFETIME;
    try {
      lifetime = lifetimeFrom(await nansen.profiler.pnlSummary({ wallet_address: c.address, chain: c.chain, date: window }, { tag }));
    } catch (err) {
      if (fatal(err)) throw err;
    }
    let survivedBy: Holding[] = [];
    try {
      const balance = await nansen.profiler.currentBalance(
        { address: c.address, chain: c.chain, order_by: [{ field: "value_usd", direction: "DESC" }], pagination: { page: 1, per_page: 5 } },
        { tag },
      );
      survivedBy = holdingsFrom(balance.data ?? []);
    } catch (err) {
      if (fatal(err)) throw err;
    }
    const r = c.best;
    const sym = r.token_sold_symbol;
    const exit: Exit = {
      symbol: sym,
      tokenAddress: r.token_sold_address,
      amount: num(r.token_sold_amount),
      valueUsd: num(r.trade_value_usd),
      into: r.token_bought_symbol?.trim() || "stablecoins",
      at: toIso(r.block_timestamp),
      txHash: r.transaction_hash,
      exitsToday: c.exits,
      soldTodayUsd: c.soldUsd,
      stillHoldsUsd: survivedBy.find((h) => h.symbol.toUpperCase() === sym.toUpperCase())?.valueUsd ?? 0,
    };
    obituaries.push(composeObituary({ address: c.address, label: c.label, chain: c.chain, exit, lifetime, survivedBy }, index));
  }

  return { generatedAt: now.toISOString(), edition: editionFor(now), window, obituaries };
}
