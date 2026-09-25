# @longitude/nansen

One typed client for the Nansen API that every LONGITUDE app and seed script stands on.

- **Typed end to end.** Request and response types are generated from Nansen's OpenAPI spec (`pnpm generate`); `nansen.tgm.holders({...})` autocompletes every field.
- **Retries** with backoff, honoring `Retry-After`, only for retryable failures (429, 5xx, `query_timeout`, `upstream_unavailable`, `internal_error`, network).
- **Per-process credit cap.** Every call is estimated from the generated credit table, reserved before the request, then reconciled with the real `X-Nansen-Credits-Used` header. A seed script cannot blow past `NANSEN_CREDIT_CAP` (default 500).
- **TTL cache.** Disk cache for scripts and local dev (re-running a seed costs nothing), memory cache on Vercel. Expired entries are served if the API fails, so a demo survives an outage.
- **Call logger.** Every call is written with timestamp, endpoint, credits and script name to a JSONL file locally and to Upstash Redis when configured. `readTotals()` is what the store's live counter reads.
- **Rate limiter.** Concurrency gate plus request spacing tuned to the plan's per-second limit.

## Use

```ts
import { createNansen, lastDays } from "@longitude/nansen";

const nansen = createNansen({ script: "seed:rookie-scout", creditCap: 120, logToConsole: true });

const flows = await nansen.smartMoney.netflow({
  chains: ["ethereum", "solana"],
  order_by: [{ field: "net_flow_7d_usd", direction: "DESC" }],
});

const summary = await nansen.profiler.pnlSummary({
  wallet_address: "0x...",
  chain: "ethereum",
  date: lastDays(90),
});

// Walk pages (bounded), concatenating rows
const holders = await nansen.all("/api/v1/tgm/holders", { chain: "base", token_address: "0x..." }, { maxPages: 3 });

// "Refresh live" button: skip the cache read, still write the result
await nansen.tgm.flowIntelligence({ chain: "solana", token_address: "...", timeframe: "1d" }, { fresh: true });

console.log(nansen.credits.spent, nansen.creditsRemaining);
await nansen.log.flush();
```

In a Next.js route handler or server component use the per-process singleton:

```ts
import { getNansen } from "@longitude/nansen";
const nansen = getNansen("app:two-faced");
```

The package is server-only (it touches the filesystem and holds the API key). Never import it from a client component.

## Credits

| Concept | Where |
| --- | --- |
| Per-endpoint cost table | `src/generated/credits.ts` (derived from the spec's pay-per-request prices at $0.01 per credit, plus documented overrides) |
| `premium_labels: true` | Billed at 150 on `tgm/holders`, `tgm/pnl-leaderboard`, `tgm/perp-pnl-leaderboard`, `perp-leaderboard` |
| Expensive calls to avoid | `profiler/address/labels` (100), `premium-labels` (500), `agent/*` (200-750) |

## Environment

| Variable | Purpose |
| --- | --- |
| `NANSEN_API_KEY` | Required for live calls |
| `NANSEN_CREDIT_CAP` | Per-process ceiling, default 500 |
| `NANSEN_PLAN` | `free` (default) or `pro`; sets rate-limiter pacing |
| `NANSEN_CACHE_DIR` | Disk cache directory, default `.nansen-cache` |
| `NANSEN_LOG_PATH` | JSONL log path, default `data/nansen-calls.jsonl` |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Shared live call log for the deployed store |

## Scripts

```bash
pnpm --filter @longitude/nansen test        # unit tests (mocked fetch, no credits)
pnpm --filter @longitude/nansen typecheck
pnpm --filter @longitude/nansen sync-spec   # refetch openapi.json and regenerate types + credit table
pnpm nansen:account                          # smoke test: plan + credits remaining (0 credits)
```
