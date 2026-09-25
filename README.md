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
fails, the snapshot stays up. A Railway cron re-seeds every six hours and pushes the JSON, which redeploys
the apps.

**Same engine, ten feels.** `packages/motion` holds springs, reveals, staggers, number tickers, flips,
typewriters, marquees and a tilt. Each world picks a spring and a skin.

## Run it

```bash
pnpm install
cp .env.example .env        # add NANSEN_API_KEY
pnpm dev                    # every app: store on :3000, apps on :4101-:4110
```

Seed real data (about 300 credits for all ten; each app has its own cap):

```bash
pnpm seed:all                         # or: pnpm --filter @longitude/rewind seed
SEED_FRESH=1 pnpm seed:all            # bypass the 6-hour response cache
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

- **Vercel:** one project per app. Set the project's *Root Directory* to `apps/<app>` (and `apps/store`);
  Vercel detects the pnpm workspace and Turborepo. The store needs `NEXT_PUBLIC_APP_URL_TEMPLATE`
  (default `https://longitude-{id}.vercel.app`); apps need `NEXT_PUBLIC_STORE_URL` and `NANSEN_API_KEY`
  for refresh-live. Optional `UPSTASH_REDIS_REST_URL` / `_TOKEN` make the store's credit counter live
  across every deployment.
- **Railway cron:** `railway.json` runs `pnpm seed:all --publish` every six hours. Give it
  `NANSEN_API_KEY`, `GITHUB_TOKEN` and `GITHUB_REPO=owner/name` so it can push refreshed snapshots.

## Honest notes

- Data comes from Nansen's Smart Money, Profiler, Token God Mode, screener and prediction-market
  endpoints. Similarity scores, species, temperaments, exit clocks and soap-opera captions are our own
  derivations from those numbers; each app documents its formula in `lib/data.ts`.
- *As The Chain Turns* renders its episodes in the browser with SVG and springs; there is no video export.
- `premium_labels` is never requested (150 credits a call); free-tier labels are enough for every app.
