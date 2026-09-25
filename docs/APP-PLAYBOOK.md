# LONGITUDE app playbook

How every app in `apps/*` is built. `apps/rookie-scout` is the reference: read its `lib/data.ts`,
`app/page.tsx`, `components/*`, `app/globals.css`, and `snapshots/main.json` before starting.

## The contract (every app, no exceptions)

1. **One data builder.** `lib/data.ts` exports the snapshot type `<Pascal>Data` and
   `build<Pascal>(nansen: NansenClient): Promise<<Pascal>Data>`. It is used by `seed.ts` (writes
   `snapshots/main.json`) and by the page's "Refresh live" path. Keep it pure: Nansen calls in, plain
   JSON out. Precompute everything the UI needs (scores, labels, sort orders) so components stay dumb.
2. **The page** (`app/page.tsx`, already scaffolded) uses `loadAppData` + `AppFrame` + `Missing`.
   Only swap the `<pre>` for your components. Keep `export const dynamic = "force-dynamic"`.
3. **Snapshot first.** Write a realistic hand-made `snapshots/main.json` with `"sample": true` and a
   `note`, exactly the shape the builder returns, with enough rows (8-12) to make the visuals sing.
   The seed replaces it later with real data; the shape must not differ.
4. **Typed Nansen calls only.** `nansen.smartMoney.*`, `nansen.profiler.*`, `nansen.tgm.*`,
   `nansen.screener.*`, `nansen.predictionMarket.*` are fully typed from the OpenAPI spec. Row types:
   `RowOf<"/api/v1/tgm/holders">`. If a field name is unsure, open
   `packages/nansen/src/generated/openapi.d.ts` and search the schema. Typecheck is the truth.
5. **Credits.** Every builder has a budget (below). Pass `{ tag }` on calls in loops. Use
   `pagination: { page: 1, per_page: N }`, never more rows than the UI shows. `premium_labels` stays off.
   Dates: `lastDays(n)` from `@longitude/nansen` gives `{ from, to }`.
6. **Motion.** Use `@longitude/motion` (`Reveal`, `Stagger`, `NumberTicker`, `Flip`, `Typewriter`,
   `Marquee`, `Grow`, `Tilt`, `useClock`, plus `motion`/`AnimatePresence`). Same engine, your skin.
   Respect `useReducedMotion` for anything continuous.
7. **World.** `app/globals.css` sets the `--lg-*` tokens from the registry palette and styles the
   whole world. Pick fonts in `app/layout.tsx` via `next/font/google` (`--font-display`, `--font-body`,
   `--font-mono`). Class names are BEM-ish (`.clock__hand`). No Tailwind, no CSS-in-JS.
8. **Mobile.** Must read well at 390px wide: single column, 16px gutters, no horizontal scroll, tap
   targets ≥ 40px. Hover-only interactions need a tap equivalent.
9. **Copy.** The registry (`packages/kit/src/apps.ts`) already holds the name, tagline, explainer and
   signature. The page never repeats the explainer; it shows the thing.
10. **seed.ts must not use top-level await** (apps are CommonJS to tsx): keep the `runSeed({...}).catch(...)` form.
11. **Verify.** `pnpm --filter @longitude/<id> typecheck` and `pnpm --filter @longitude/<id> build`
    must pass. Do not start dev servers, do not run `pnpm install`, do not add dependencies, do not
    touch other apps or `packages/*`, do not commit.

Utilities: `shortAddress(addr, 4)` and `lastDays(n)` from `@longitude/nansen`; `fmt.usd`,
`fmt.usdSigned`, `fmt.pct`, `fmt.compact`, `fmt.int` from `@longitude/motion`.

## Endpoint cheat sheet (request → useful response fields)

- `smartMoney.netflow({ chains, filters?, order_by: [{ field: "net_flow_7d_usd", direction }], pagination })` 5cr →
  `token_address, token_symbol, chain, net_flow_1h/24h/7d/30d_usd, trader_count, token_age_days, market_cap_usd, token_sectors`.
  Filters: `include_stablecoins`, `include_native_tokens`, `token_address`, `include_smart_money_labels`.
- `smartMoney.pnlLeaderboard({ chains, timeframe: 30, pagination })` 5cr →
  `address, address_label, realized/unrealized/total_pnl_usd, avg_trade_roi, win_rate, n_trades, n_tokens, open_trades, held_tokens_count, top_traded_tokens_info, top_5_balance_tokens_info`.
- `smartMoney.dexTrades({ chains, pagination, order_by? })` 5cr → `chain, block_timestamp, transaction_hash, trader_address, trader_address_label, token_bought_address/symbol/amount, token_sold_address/symbol/amount, trade_value_usd, token_bought_market_cap`.
- `smartMoney.perpTrades({ lookback_hours: 168, pagination })` 5cr → `trader_address, trader_address_label, token_symbol, side, action, token_amount, price_usd, value_usd, type, block_timestamp`.
- `profiler.pnlSummary({ wallet_address, chain, date })` 1cr → `realized_pnl_usd, realized_pnl_percent (fraction), win_rate (fraction), traded_token_count, traded_times, top5_tokens[{token_symbol, realized_pnl, realized_roi}]`.
- `profiler.perpPnlSummary({ address, date })` 1cr → `data.{ realized_pnl_usd, win_rate, traded_coin_count, traded_times, closed_trade_count, fees_usd, top5_coins[{coin, realized_pnl_usd}] }`.
- `profiler.perpPositions({ address })` 1cr → `data.assetPositions[...]` (Hyperliquid position objects), margin summaries.
- `profiler.currentBalance({ address, chain, pagination })` 1cr → `token_symbol, token_amount, price_usd, value_usd`.
- `profiler.relatedWallets({ wallet_address, chain, pagination })` 1cr → `address, address_label, relation, transaction_hash, block_timestamp, order, chain`.
- `profiler.firstFunder({ ... })` 1cr; `profiler.counterparties({ address, chain, date, group_by })` 5cr.
- `tgm.holders({ chain, token_address, label_type: "smart_money", pagination })` 5cr → `address, address_label, token_amount, value_usd, ownership_percentage, balance_change_24h/7d/30d, total_inflow/outflow`.
- `tgm.dexTrades({ chain, token_address, only_smart_money: true, date, pagination })` 1cr → `block_timestamp, trader_address, trader_address_label, action, token_amount, estimated_value_usd, estimated_swap_price_usd`.
- `tgm.flowIntelligence({ chain, token_address, timeframe: "7d" })` 1cr → `data[0].{ smart_trader_net_flow_usd, whale_net_flow_usd, exchange_net_flow_usd, fresh_wallets_net_flow_usd, public_figure_net_flow_usd, top_pnl_net_flow_usd, *_wallet_count }`.
- `tgm.tokenInformation({ chain, token_address, timeframe: "1d" })` 1cr → `data.{ name, symbol, logo, token_details, spot_metrics }`.
- `tgm.ohlcv({ chain, token_address, date: { from, to }, timeframe: "1d" })` 1cr → candles (`data[]` with open/high/low/close/volume; check the type).
- `tgm.whoBoughtSold({ chain, token_address, buy_or_sell: "SELL", date, pagination })` 1cr → `address, address_label, sold_volume_usd, bought_volume_usd, trade_volume_usd`.
- `tgm.pnlLeaderboard({ chain, token_address, date, pagination })` 5cr → `trader_address, trader_address_label, pnl_usd_total, roi_percent_total, nof_trades, still_holding_balance_ratio, holding_usd`.
- `screener.historicalTokens({ to_date, timeframe_days, chains, only_smart_money, pagination })` 5cr (beta) → `token_address, token_symbol, chain, price_usd, price_change, market_cap_usd, volume, buy_volume, sell_volume, netflow, sectors, liquidity`.
- `predictionMarket.marketScreener(...)`, `predictionMarket.orderbook(...)`, `predictionMarket.ohlcv(...)` 1cr each: read the request types in the generated file before use.

Chains with the best coverage: `ethereum`, `solana`, `base`. Beta historical endpoints cover only
`base`, `bnb`, `ethereum`, `solana`.

## Per-app plans

### two-faced (4102) · budget 40
Data: `smartMoney.perpTrades({ lookback_hours: 168, pagination: { per_page: 100 } })` → group by
`trader_address`, keep the 8 most active. Per wallet: `profiler.perpPnlSummary({ address, date: lastDays(90) })`,
`profiler.pnlSummary({ wallet_address, chain: "ethereum", date: lastDays(90) })` (also try `"base"` if
ethereum returns zero activity, one extra credit), `profiler.perpPositions({ address })`.
Snapshot `wallets[]: { address, label, spot: { winRate, pnlUsd, trades, tokens, topTokens[] }, perp:
{ winRate, pnlUsd, trades, coins, feesUsd, topCoins[], openPositions[{ coin, side, sizeUsd, pnlUsd,
leverage }] }, temperament: { spot: string, perp: string } }` plus a `verdict` per wallet
(e.g. "Saint by day, degen by night"). Compute temperament words from the numbers.
World: split screen, ivory left (spot, comedy mask), charcoal right (perp, tragedy mask). Signature:
a draggable slider (motion drag or `<input type="range">` styled) morphs a generated SVG mask (from
the address hash: eye shape, brow angle, mouth curve) between its spot and perp expressions while the
stat panels crossfade. Wallet picker as a row of small masks.

### exit-clock (4103) · budget 40
Data: `smartMoney.netflow` (3 top tokens by 7d inflow on ethereum/solana/base, exclude stables and
natives). Per token: `tgm.holders({ label_type: "smart_money", per_page: 30 })` and
`tgm.dexTrades({ only_smart_money: true, date: lastDays(30), per_page: 100 })`. From the trades,
per trader, pair BUY→SELL timestamps (FIFO) to estimate `avgHoldHours` and take `lastBuyAt`;
`expectedExitAt = lastBuyAt + avgHoldHours` (fallback: token median hold). Snapshot `tokens[]:
{ symbol, address, chain, medianHoldHours, holders[]: { address, label, valueUsd, ownershipPct,
change7dPct, lastBuyAt, avgHoldHours, expectedExitAt, overdue } }`.
World: brutalist concrete + brass. Signature: one big dial per token; every holder is a hand
(length ∝ valueUsd, angle = time until expected exit, 12 o'clock = now) ticking with `useClock`;
overdue hands glow brass and vibrate. Side ledger sorted by soonest exit with live countdowns.
Token tabs.

### odds-vs-flow (4104) · budget 25
Data: `predictionMarket.marketScreener` (read its request type) to find open crypto price markets
(question mentions BTC, ETH, SOL; take up to 4). Odds: the screener's price/probability fields, or
`predictionMarket.orderbook` for the market. Flow: one `smartMoney.netflow({ chains: ["ethereum",
"solana"], filters: { include_native_tokens: true }, per_page: 100 })` and pick the matching token
(WBTC/BTC, ETH, SOL by symbol). Snapshot `bouts[]: { market: { id, question, yesPct, volumeUsd,
endsAt }, token: { symbol, chain, address, netFlow24hUsd, netFlow7dUsd, traderCount }, pull }` where
`pull` ∈ [-1, 1] (negative = crowd winning, positive = smart money winning; document the formula).
World: betting slip (cream ticket, perforations, monospace stamps) on the left, an animated river
(layered SVG waves whose speed ∝ |netflow|) on the right. Signature: a rope across the middle with
a knot that springs to `pull`; each side's team tugs (subtle motion). One bout per row.

### last-ones-out (4105) · budget 40
Data: `smartMoney.netflow` sorted by `net_flow_7d_usd` ASC (most negative), 12 tokens with
`market_cap_usd` > 5M. Per token `tgm.flowIntelligence({ timeframe: "7d" })` (retail proxy =
`fresh_wallets_net_flow_usd`, plus wallet counts) and `tgm.tokenInformation({ timeframe: "1d" })`.
Snapshot `buildings[]: { symbol, address, chain, smartNetFlow7dUsd, retailNetFlow7dUsd,
retailWalletCount, smartWalletCount, priceChange24hPct, marketCapUsd, lit (0..1), darkness (0..1) }`.
World: skyline at night, deep navy, moon, reflections. Signature: each token is a building whose
window grid is lit ∝ `lit`; on load windows switch off in sequence ∝ `darkness` (Stagger + CSS);
hover/tap a building for the numbers. Buildings sorted tallest = biggest smart money exit.

### dynasties (4106) · budget 30
Data: `smartMoney.pnlLeaderboard({ chains: ["ethereum"], timeframe: 30, per_page: 6 })` → 6
patriarchs. Per patriarch: `profiler.relatedWallets({ wallet_address, chain: "ethereum", per_page: 20 })`
and `profiler.firstFunder` (read its request type). Snapshot `houses[]: { patriarch: { address, label,
pnlUsd, winRate }, founder?: { address, label, at }, members[]: { address, label, relation, at },
motto }`. Group members by `relation`.
World: navy + gold tapestry, serif small caps. Signature: each house is a tree that unfurls (Stagger
with `inView`), nodes are generated coats of arms (SVG: shield partition, two tinctures, a charge, all
from the address hash; make a `Crest` component); hover/tap a node for the relation and date.

### menagerie (4107) · budget 20
Data: `smartMoney.pnlLeaderboard({ chains: ["ethereum", "solana", "base"], timeframe: 30, per_page: 40 })`.
Classify each wallet into a species from its stats (write the rules down in `species[]`): e.g.
Whale (top PnL), Fox (high win rate, few trades), Hummingbird (many trades, many tokens), Tortoise
(few trades, high ROI), Hyena (low win rate, high PnL), Elephant (many held tokens), Meerkat
(small, consistent). Snapshot `species[]: { id, name, latin, rule, description }` and `animals[]:
{ address, label, species, stats: { winRate, pnlUsd, trades, tokens, avgRoi }, topTokens[], notes[] }`.
World: naturalist's journal: parchment, ink, watercolor washes, a handwriting display font.
Signature: an SVG savanna where animal silhouettes (simple SVG shapes per species) roam on motion
paths; tap one to open its field notes (ink sketch, stats, notes). Species legend on the side.

### rewind (4108) · budget 60 (beta endpoints cost 5)
Data: for 5 dates (30, 60, 90, 120, 150 days ago): `screener.historicalTokens({ to_date, timeframe_days: 7,
chains: ["ethereum", "solana", "base"], only_smart_money: true, pagination: { per_page: 6 } })`, keep 4
picks with positive netflow. For each pick: `tgm.ohlcv({ chain, token_address, date: { from: date,
to: date+30d }, timeframe: "1d" })` (1cr, normal endpoint, past range) → `returnPct30d` and the path.
Snapshot `tapes[]: { date, label, picks[]: { symbol, address, chain, buyVolumeUsd, netflowUsd,
priceAtDate, path[]: { t, close }, returnPct30d }, winner }`.
World: VHS deck, black, magenta/cyan, scan lines, chunky buttons, tracking noise. Signature: a tape
wheel you drag to scrub between dates (reels rotate), the four picks as cassette labels, "lock your
call", then PLAY draws each price path (SVG line with animated `pathLength`) and reveals the winner;
score kept in localStorage.

### wallet-obituaries (4109) · budget 30
Data: `smartMoney.dexTrades({ chains: ["ethereum", "solana", "base"], pagination: { per_page: 100 } })`;
keep trades where the sold token is not a stable/native and value is large; group by trader, take the 8
biggest exits. Per trader: `profiler.pnlSummary({ wallet_address, chain, date: lastDays(180) })` and
`profiler.currentBalance({ address, chain, pagination: { per_page: 5 } })` ("survived by").
Snapshot `edition: { date, number }`, `obituaries[]: { address, label, chain, headline, deck,
body[], exit: { symbol, valueUsd, at, txHash }, lifetime: { pnlUsd, winRate, tokens, trades,
topTokens[] }, survivedBy[]: { symbol, valueUsd } }`. Write the headlines/decks/body from the numbers
in a dry newspaper voice.
World: sepia broadsheet, serif (e.g. Playfair Display + Libre Baskerville), rules, columns, drop caps,
a masthead with the edition date. Signature: headlines typeset themselves in (`Typewriter`), the lead
obituary first, then the column of others.

### as-the-chain-turns (4110) · budget 20
Data: `smartMoney.dexTrades({ chains: ["ethereum", "solana", "base"], pagination: { per_page: 100 } })`
(last day of trades). Cast = 6 most active/valuable traders; per cast member
`profiler.pnlSummary({ wallet_address, chain, date: lastDays(30) })`. Scenes = 8-12 notable trades
in time order (biggest buys, reversals where one wallet buys then sells, two cast members on the same
token). Snapshot `episode: { number, title, synopsis, airDate }`, `cast[]: { address, label,
character: { name, role, archetype }, stats }`, `scenes[]: { index, title, at, wallet, action,
symbol, valueUsd, caption, zoom: "slow" | "dramatic" }`. Captions in melodramatic soap voice.
World: daytime soap: pink/blue title cards, gold script display font, soft vignette. Signature: an
episode player (play/pause/next) where each scene zooms dramatically into the cast card of the wallet
(scale spring), the caption types in, and a "Previously on…" recap opens the episode. In-browser
only (no ffmpeg).

## The Meridian layer (added after the ten worlds)

Every app also gets, through `AppFrame` and the kit, an anonymous identity, presence, passport stamps,
a share button and access to the shared social store. What an app adds on top lives in its own
components and uses `@longitude/kit`:

- `social.event(type, text)` publishes one line to the global feed (the store's ticker).
- `social.score(board, value, "sum" | "max")` and `<Leaderboard board=… />` for rankings.
- `<ReactionBar target=… kinds=… glyphs=… />` or `useReactions` for polls and reactions (one per visitor per kind).
- `social.addItem / removeItem / items(list)` for per-visitor lists (rosters, watchlists, specimens).
- `social.collect(name, member)` for global sets that seeds re-score (`drafted`, `watched-tokens`).
- `getSocialStore()` from `@longitude/kit/server` inside builders to read those sets during a seed.

Rules: never await a social call on the render path; every call resolves `null` on failure and the page
must look identical without the store. Restyle `.lg-reactions`, `.lg-board`, `.lg-btn--share` in the
app's `globals.css` to fit its world.

Routes every app carries (generated by `scripts/add-social-routes.mjs` and `scripts/add-pro-routes.mjs`):
`app/api/social/[op]/route.ts`, `app/og/route.tsx` (share image) and `app/api/pro-refresh/route.ts`
(x402-paid fresh pull, hidden until `X402_PAY_TO` is set).

`DEEP=1` makes every builder fetch roughly twice as much (documented in each builder's doc comment);
`SEED_FRESH=1` bypasses the six-hour seed cache. `SEED_FRESH=1 DEEP=1 pnpm seed:all` is the run
before a demo.
