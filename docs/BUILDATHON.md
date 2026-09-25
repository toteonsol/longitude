# Nansen Meridian Buildathon: rules and our checklist

Source: https://www.nansen.ai/campaigns/meridian-buildathon (Sep 14-27, 2026, UTC).

## Prizes
- 1st: **$10,000 USDC** (one winner)
- 2nd: AirPods Max + Ledger + Keychron Q Pro
- 3rd: Sony WH-1000XM5 + Ledger
- Honorable mentions: 100,000 Nansen API credits each
- Five winners in total

## Entry requirements
1. API key created at https://app.nansen.ai/api
2. **At least 1,000 API calls** to any endpoint during Sep 14-27
3. Demo recording posted on X, tagging **@nansen_ai**
4. Submission form: email, X post link, **public GitHub repo**

Deadline: **Sep 27, 23:59 UTC** (Sep 28, 07:59 Manila).

## Judging (25% each)
- **Data integration:** "Nansen data drives the logic, not just appears on screen. The deeper the integration, the stronger the score."
- **Creativity & originality:** "A use case nobody thought to build. We've seen dashboards. Show us something we haven't."
- **Functionality & workability:** "Live data loads. End to end. No crashes. If it breaks in the recording, it doesn't qualify."
- **Documentation & submission:** "Clean README. Followable recording. No narration needed. Another builder can run it in under 10 minutes."

## Our checklist
- [ ] 1,000+ API calls (the store's counter and `data/nansen-calls.jsonl` are the proof). Status Thu 25 Sep 19:40 Manila: **502 calls, 755 credits spent, 2,245 left**. A full deep run (`SEED_FRESH=1 DEEP=1 pnpm seed:all`) is ~340 calls / ~450 credits; a standard run ~175 calls / ~230 credits. Plan: one deep run Saturday (~840), one standard run before the demo (~1,015), plus refresh-live, scout-any-wallet and cron runs on top.
- [ ] Every app loads live data end to end in the recording: show the snapshot, press **Refresh live**, show the live badge.
- [ ] README: clone → `pnpm install` → `.env` → `pnpm dev` → `pnpm seed:all` in under 10 minutes, no narration needed.
- [ ] Demo recording with no crashes; post on X tagging @nansen_ai; public GitHub repo; submit the form.
- [ ] Each app's `lib/data.ts` documents how Nansen data drives its logic (similarity score, exit clock, species, pull, etc.).
