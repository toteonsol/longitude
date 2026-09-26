# LONGITUDE

**Ten meridians. Ten ways to read smart money.**

LONGITUDE is a store of ten small apps built on the [Nansen API](https://docs.nansen.ai). The store is a slowly
rotating globe; each glowing meridian is an app. Hover a line and its world bleeds into the globe. Click and
you're in. Every app also lives at its own URL and works with no store around it. No login, anywhere.

| # | App | The world | What you do |
| - | --- | --- | --- |
| 01 | **Rookie Scout** | Sports draft room: turf, chalk lines, trading cards | Flip prospect cards to see a scouting report and a similarity score to real smart money |
| 02 | **Two-Faced** | Theater masks, a split screen light and dark | Drag a slider across a wallet to morph its spot face into its perp face |
| 03 | **Exit Clock** | Brutalist watchmaker: concrete, brass, dials | Every smart money holder is a hand counting down to its typical sell time |
| 04 | **Odds vs Flow** | A betting slip and a river | A live tug of war between crowd odds and smart money flow |
| 05 | **Last Ones Out** | A city skyline at night | Lit windows are tokens retail still holds; they go dark as smart money leaves |
| 06 | **Dynasties** | Royal heraldry: navy, gold, generated crests | Family trees of wallets unfurl like tapestry |
| 07 | **MENAGERIE** | Naturalist's field journal | Smart money sorted into species; tap an animal for its field notes |
| 08 | **Rewind** | VHS tape deck | Scrub to a real past date, lock your call, press play for the reveal |
| 09 | **Wallet Obituaries** | Sepia broadsheet | A fresh front page of wallets that sold everything; headlines typeset themselves |
| 10 | **As The Chain Turns** | Daytime soap | The last 24 hours of smart money trading as an episode with a cast of wallets |

Every app opens with one plain sentence and keeps a **"What am I looking at?"** toggle, so a newcomer gets it
in five seconds and a pro can skip it.

## Live

**Store:** https://longitude-sigma.vercel.app

| App | URL |
| --- | --- |
| Rookie Scout | https://longitude-rookie-scout.vercel.app |
| Two-Faced | https://longitude-two-faced.vercel.app |
| Exit Clock | https://longitude-exit-clock.vercel.app |
| Odds vs Flow | https://longitude-odds-vs-flow.vercel.app |
| Last Ones Out | https://longitude-last-ones-out.vercel.app |
| Dynasties | https://longitude-dynasties.vercel.app |
| MENAGERIE | https://longitude-menagerie.vercel.app |
| Rewind | https://longitude-rewind.vercel.app |
| Wallet Obituaries | https://longitude-wallet-obituaries.vercel.app |
| As The Chain Turns | https://longitude-as-the-chain-turns.vercel.app |

Wallet lens: paste any Ethereum, Base or Solana address into the globe's search (or open
`https://longitude-sigma.vercel.app/wallet/<address>`) to read one wallet through five worlds at once: its
similarity to smart money, its perp face, what it still holds, its kin and its biggest exits, each linking
into the app that goes deeper.

Nansen spend, live: https://longitude-sigma.vercel.app/api/totals

## How it's built

```
apps/store              the globe
apps/<app> × 10         one Next.js app each, its own Vercel project
packages/nansen         one typed Nansen client: retries, per-script credit cap, TTL cache, call logger
packages/motion         shared animation primitives, skinned differently by every app
packages/kit            app registry, shared chrome, explainer, refresh-live, snapshots, seed runner
scripts/                seed-all, manifest, snapshot publishing, app scaffolder
```

**One client, every call.** `packages/nansen` generates request and response types from Nansen's OpenAPI
spec. Every call is estimated against a credit table, reserved before the request, and reconciled with
the `X-Nansen-Credits-Used` header. A seed script cannot spend past its cap. Every call is logged with
timestamp, endpoint and credits; the store shows the running total.

**Snapshots first, live on demand.** Each app's seed script writes `snapshots/main.json`. Pages render the
snapshot instantly; the **Refresh live** button re-runs the same builder against Nansen. If the live call
fails, the snapshot stays up. A Vercel cron re-seeds once a day (00:00 UTC) in deep mode, the same bigger cut
the seeds publish, and pushes the JSON to Convex, where the apps fetch it, so refreshed data never needs a
redeploy and the live apps never thin out overnight.

**Same engine, ten feels.** `packages/motion` holds springs, reveals, staggers, number tickers, flips,
typewriters, marquees and a tilt. Each world picks a spring and a skin.

**The Meridian layer: social without a login.** `packages/social` plus the kit give every app an anonymous
identity (a handle like "Quiet Fox 42", carried between apps in the link), a global activity feed, live
presence ("3 here now"), a passport that stamps each of the ten apps you visit, leaderboards, reactions and
per-visitor lists. Each app turns that into its own loop: Rookie Scout drafts go on a roster that every seed
re-scores against that day's smart money; Rewind calls score on a leaderboard; Exit Clock hands can be
watched; Obituaries take candles; Dynasties take fealty; MENAGERIE specimens are collected; the soap has a
studio audience; the rope takes sides. State lives in Convex in production (Redis or Upstash also work), and in one
shared JSON file across the eleven local dev servers. Every social call is fail-safe: if the store is
unreachable, pages render exactly as before.

**Users fund the calls.** Every visitor action that touches Nansen is a real API call that LONGITUDE pays for:
a wallet lens is five credits, a scouting report one, a live refresh what that app's seed costs. The free paths
serve a five-minute cache; **Pro refresh** charges a few cents of USDC on Base over x402 (public facilitators,
no keys) and forces a fresh pull, so the people who want fresher data pay for it on the same rail Nansen
sells on. Set `X402_PAY_TO` to turn it on; judges never need a wallet.

**Every wallet and token opens in Nansen.** A small **Nansen** pill sits beside the wallets and tokens in
every app and in the wallet lens. It opens the wallet in Nansen Profiler or the token in Token God Mode, costs
no credits, and makes each of the ten worlds a doorway into Nansen's own product.

**Recording mode.** Add `?rec=1` to any page and a caption bar explains what is on screen and which Nansen
data drives it, so a screen recording needs no voiceover. The flag follows you between the store and the apps;
`?rec=0` turns it off. See `docs/DEMO.md`.

## Run it

You need Node 22 or newer and pnpm 9 (`corepack enable` installs the pinned pnpm). No API key is needed to
look around: every app renders from its committed snapshot. Add a key to refresh live or seed.

```bash
pnpm install
cp .env.example .env        # add NANSEN_API_KEY
pnpm dev                    # every app: store on :3000, apps on :4101-:4110
```

Seed real data (about 300 credits for all ten; each app has its own cap):

```bash
pnpm seed:all                         # or: pnpm --filter @longitude/rewind seed
SEED_FRESH=1 pnpm seed:all            # bypass the 6-hour response cache
SEED_FRESH=1 DEEP=1 pnpm seed:all     # the deep cut the live apps run: more wallets, tokens and weeks (~450 credits)
pnpm nansen:account                   # plan + credits remaining, costs nothing
```

Until an app is seeded it shows a hand-written sample flagged **sample data** in its header.

| App | Credits per seed (approx.) |
| --- | --- |
| Rookie Scout | 45 |
| Two-Faced | 30 |
| Exit Clock | 25 |
| Odds vs Flow | 10 |
| Last Ones Out | 30 |
| Dynasties | 17 |
| MENAGERIE | 10 |
| Rewind | 45 |
| Wallet Obituaries | 21 |
| As The Chain Turns | 11 |

## Deploy

- **Vercel:** one project per app, Root Directory `apps/<app>`. `node scripts/vercel-projects.mjs` creates or
  updates the eleven projects through your logged-in Vercel CLI session, `node scripts/vercel-projects.mjs env KEY VALUE`
  sets a variable on all of them, and `scripts/deploy-vercel.sh` deploys from the repo root (deploying from an app
  folder uploads only that folder). Apps need `NEXT_PUBLIC_STORE_URL`, `NEXT_PUBLIC_APP_URL_TEMPLATE`,
  `CONVEX_URL`, `SNAPSHOT_BASE_URL`, `NANSEN_API_KEY` (for refresh-live), `SEED_TOKEN` and `CRON_SECRET`.
- **Convex:** `cd packages/social && npx convex dev --once` creates the deployment; put its URL in
  `CONVEX_URL`, set `SNAPSHOT_BASE_URL` to `<site url>/snapshots`, generate a `SEED_TOKEN` and set it both in
  `.env` and on the deployment (`npx convex env set SEED_TOKEN …`). One Convex deployment holds the social store,
  the snapshots and the call log for every app.
- **Cron:** the store's `vercel.json` schedules `/api/cron/seed` once a day; it calls each app's own
  `/api/cron/seed` (protected by `CRON_SECRET`) a few seconds apart, which re-runs the builder against Nansen
  in deep mode and pushes the snapshot to Convex. Deep mode is scoped to that one request, so a visitor's
  Refresh live still gets the lighter build; add `?deep=0` for a light run. No server runs between seeds.

## How this maps to the Meridian judging

- **Data integration:** every app's `lib/data.ts` derives something new from Nansen: a similarity score
  against the smart money cohort, exit clocks from FIFO-paired trades, species from behaviour percentiles,
  a tug-of-war between prediction-market odds and net flow, obituaries from the day's largest exits.
- **Creativity:** ten worlds, one signature interaction each, and a social layer that makes them a place
  people return to rather than dashboards.
- **Functionality:** snapshot first, live on demand, snapshot again if live fails. No page can crash on a
  Nansen or social outage.
- **Documentation:** this file, `docs/APP-PLAYBOOK.md` (how every app is built) and `docs/DEMO.md`.

## Honest notes

- Data comes from Nansen's Smart Money, Profiler, Token God Mode, screener and prediction-market
  endpoints. Similarity scores, species, temperaments, exit clocks and soap-opera captions are our own
  derivations from those numbers; each app documents its formula in `lib/data.ts`.
- *As The Chain Turns* renders its episodes in the browser with SVG and springs; there is no video export.
- `premium_labels` is never requested (150 credits a call); free-tier labels are enough for every app.
