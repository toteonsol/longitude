import type { CallOptions, NansenClient } from "./client";
import type { GetEndpoint, GetResponseOf, PostEndpoint, RequestBody, ResponseOf } from "./paths";

type PostFn<P extends PostEndpoint> = (body: RequestBody<P>, opts?: CallOptions) => Promise<ResponseOf<P>>;
type GetFn<P extends GetEndpoint> = (opts?: CallOptions) => Promise<GetResponseOf<P>>;

const post =
  <P extends PostEndpoint>(c: NansenClient, path: P): PostFn<P> =>
  (body, opts) =>
    c.post(path, body, opts);

const get =
  <P extends GetEndpoint>(c: NansenClient, path: P): GetFn<P> =>
  (opts) =>
    c.get(path, opts);

/** Namespaced, fully typed wrappers over every metered endpoint. Method names mirror the docs. */
export function buildApi(c: NansenClient) {
  return {
    smartMoney: {
      /** 5 cr. Net inflow/outflow per token over 1h/24h/7d/30d, rolling 30-day history. */
      netflow: post(c, "/api/v1/smart-money/netflow"),
      /** 5 cr. Aggregated current holdings across the Smart Money cohort. */
      holdings: post(c, "/api/v1/smart-money/holdings"),
      /** 1 cr. Holdings snapshots at past dates. */
      historicalHoldings: post(c, "/api/v1/smart-money/historical-holdings"),
      /** 5 cr. Recent DEX trades by Smart Money wallets. */
      dexTrades: post(c, "/api/v1/smart-money/dex-trades"),
      /** 5 cr. Hyperliquid perp trades by Smart Money wallets. */
      perpTrades: post(c, "/api/v1/smart-money/perp-trades"),
      /** 5 cr. Jupiter DCA orders by Smart Money wallets. */
      dcas: post(c, "/api/v1/smart-money/dcas"),
      /** 5 cr. Ranked Smart Money wallets by PnL over 1/7/30/90/180 days. */
      pnlLeaderboard: post(c, "/api/v1/smart-money/pnl-leaderboard"),
      /** 25 cr (beta). Smart Money token balances as of a past date. */
      historicalTokenBalances: post(c, "/api/v1beta1/smart-money/historical-token-balances"),
    },
    profiler: {
      /** 1 cr. */
      currentBalance: post(c, "/api/v1/profiler/address/current-balance"),
      /** 1 cr. */
      historicalBalances: post(c, "/api/v1/profiler/address/historical-balances"),
      /** 1 cr. */
      transactions: post(c, "/api/v1/profiler/address/transactions"),
      /** 1 cr. */
      transactionLookup: post(c, "/api/v1/transaction-with-token-transfer-lookup"),
      /** 1 cr. */
      dexTrades: post(c, "/api/v1/profiler/dex-trades"),
      /** 5 cr. */
      counterparties: post(c, "/api/v1/profiler/address/counterparties"),
      /** 5 cr. */
      counterpartiesBatch: post(c, "/api/v1/profiler/address/counterparties/batch"),
      /** 1 cr. Wallets linked by funding / shared activity. */
      relatedWallets: post(c, "/api/v1/profiler/address/related-wallets"),
      /** 1 cr. */
      firstFunder: post(c, "/api/v1/profiler/address/first-funder"),
      /** 1 cr. Per-token PnL for an address over a date range. */
      pnl: post(c, "/api/v1/profiler/address/pnl"),
      /** 1 cr. Realized PnL, win rate, trade counts, top 5 tokens. */
      pnlSummary: post(c, "/api/v1/profiler/address/pnl-summary"),
      /** 100 cr. Common labels for an address. Expensive: cache aggressively. */
      labels: post(c, "/api/v1/profiler/address/labels"),
      /** 500 cr. Premium labels. Avoid. */
      premiumLabels: post(c, "/api/v1/profiler/address/premium-labels"),
      /** 1 cr. Open Hyperliquid perp positions. */
      perpPositions: post(c, "/api/v1/profiler/perp-positions"),
      /** 1 cr. Rate limited to 5/min. */
      perpTrades: post(c, "/api/v1/profiler/perp-trades"),
      /** 1 cr. */
      perpPnlSummary: post(c, "/api/v1/profiler/perp-pnl-summary"),
      /** 5 cr (beta). Token balances as of a past date. */
      historicalTokenBalances: post(c, "/api/v1beta1/profiler/address/historical-token-balances"),
      /** 5 cr (beta). */
      historicalTransactions: post(c, "/api/v1beta1/profiler/address/historical-transactions"),
      /** 5 cr (beta). */
      historicalTransactionLookup: post(c, "/api/v1beta1/profiler/historical-transaction-lookup"),
    },
    tgm: {
      /** 1 cr. Name, symbol, logo, spot metrics for a token. */
      tokenInformation: post(c, "/api/v1/tgm/token-information"),
      /** 5 cr. Nansen quant indicators. */
      indicators: post(c, "/api/v1/tgm/indicators"),
      /** 1 cr. Candles for one token or a batch. */
      ohlcv: post(c, "/api/v1/tgm/token-ohlcv"),
      /** 1 cr. Daily flow buckets by holder segment. */
      flows: post(c, "/api/v1/tgm/flows"),
      /** 1 cr. Net flow by segment (whale, smart trader, exchange, fresh wallets...). */
      flowIntelligence: post(c, "/api/v1/tgm/flow-intelligence"),
      /** 1 cr. */
      positionIntelligence: post(c, "/api/v1/tgm/position-intelligence"),
      /** 5 cr, 150 with premium_labels. Top holders with balance changes. */
      holders: post(c, "/api/v1/tgm/holders"),
      /** 1 cr. Who bought or sold a token over a date range. */
      whoBoughtSold: post(c, "/api/v1/tgm/who-bought-sold"),
      /** 1 cr. */
      dexTrades: post(c, "/api/v1/tgm/dex-trades"),
      /** 1 cr. */
      transfers: post(c, "/api/v1/tgm/transfers"),
      /** 1 cr. */
      jupDca: post(c, "/api/v1/tgm/jup-dca"),
      /** 5 cr, 150 with premium_labels. Best and worst traders of a token. */
      pnlLeaderboard: post(c, "/api/v1/tgm/pnl-leaderboard"),
      /** 5 cr, 150 with premium_labels. */
      perpPnlLeaderboard: post(c, "/api/v1/tgm/perp-pnl-leaderboard"),
      /** 5 cr. */
      perpPositions: post(c, "/api/v1/tgm/perp-positions"),
      /** 1 cr. Rate limited to 60/min. */
      perpTrades: post(c, "/api/v1/tgm/perp-trades"),
      /** 5 cr (beta). */
      historicalDexTrades: post(c, "/api/v1beta1/tgm/historical-dex-trades"),
      /** 5 cr (beta). Who bought/sold as of a past date range. */
      historicalWhoBoughtSold: post(c, "/api/v1beta1/tgm/historical-who-bought-sold"),
      /** 25 cr (beta). */
      historicalPnlLeaderboard: post(c, "/api/v1beta1/tgm/historical-pnl-leaderboard"),
      /** 5 cr (beta). */
      historicalFlowSummary: post(c, "/api/v1beta1/tgm/historical-token-flow-summary"),
      /** 5 cr (beta). Candles as they stood at a past date. */
      historicalOhlcv: post(c, "/api/v1beta1/tgm/historical-token-ohlcv"),
      /** 25 cr (beta). Top holders as of a past date. */
      historicalTopHolders: post(c, "/api/v1beta1/tgm/historical-top-holders"),
      /** 25 cr (beta). */
      historicalQuantScores: post(c, "/api/v1beta1/tgm/historical-token-quant-scores"),
    },
    screener: {
      /** 1 cr. Token discovery with filters, sorting, smart money flags. */
      tokens: post(c, "/api/v1/token-screener"),
      /** 1 cr. */
      perps: post(c, "/api/v1/perp-screener"),
      /** 5 cr (beta). The screener as it stood on a past date. */
      historicalTokens: post(c, "/api/v1beta1/token-screener/historical"),
    },
    perps: {
      /** 5 cr, 150 with premium_labels. Hyperliquid trader leaderboard. */
      leaderboard: post(c, "/api/v1/perp-leaderboard"),
    },
    search: {
      /** 0 cr. Tokens and entities by name. */
      general: post(c, "/api/v1/search/general"),
      /** 0 cr. */
      entityName: post(c, "/api/v1/search/entity-name"),
      /** 0-1 cr. GET. Rate limited to 60/min. */
      tokenSectors: get(c, "/api/v1/search/token-sectors"),
    },
    predictionMarket: {
      categories: post(c, "/api/v1/prediction-market/categories"),
      marketScreener: post(c, "/api/v1/prediction-market/market-screener"),
      eventScreener: post(c, "/api/v1/prediction-market/event-screener"),
      orderbook: post(c, "/api/v1/prediction-market/orderbook"),
      ohlcv: post(c, "/api/v1/prediction-market/ohlcv"),
      tradesByMarket: post(c, "/api/v1/prediction-market/trades-by-market"),
      tradesByAddress: post(c, "/api/v1/prediction-market/trades-by-address"),
      pnlByAddress: post(c, "/api/v1/prediction-market/pnl-by-address"),
      pnlByMarket: post(c, "/api/v1/prediction-market/pnl-by-market"),
      addressSummary: post(c, "/api/v1/prediction-market/address-summary"),
      topHolders: post(c, "/api/v1/prediction-market/top-holders"),
      positionDetail: post(c, "/api/v1/prediction-market/position-detail"),
    },
    portfolio: {
      /** 1 cr. */
      defiHoldings: post(c, "/api/v1/portfolio/defi-holdings"),
    },
    misc: {
      /** 1 cr. */
      chainRank: post(c, "/api/v1/chains/chain-rank"),
      /** 1 cr. */
      nansenScoreTopTokens: post(c, "/api/v1/nansen-score/top-tokens"),
    },
  };
}

export type NansenApi = ReturnType<typeof buildApi>;
