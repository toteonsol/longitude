# Demo recording plan (no narration needed)

Target: 3 to 4 minutes, 1440p, cursor visible, no audio required. Every app shows a snapshot first, then
**Refresh live** succeeding (the judges' "live data loads, end to end" criterion). Nothing may error.

## Before recording
1. `SEED_FRESH=1 DEEP=1 pnpm seed:all` so every snapshot is minutes old and the call counter is high.
2. `pnpm dev`, open the store at http://localhost:3000 (or the deployed store), clear localStorage once so
   the explainer sentences show on first load.
3. Check `data/social.json` (or Redis) has a few feed events so the ticker is alive; open two browser
   windows so "2 on the globe now" reads true.

## Shot list
1. **Store (20s).** Globe rotating. Hover three meridians: worlds bleed in. Show the counters: Nansen
   credits spent, API calls, explorers, on the globe now. Passport at 0/10. Click Rookie Scout.
2. **Rookie Scout (30s).** Explainer sentence. Draft board. Flip a card: similarity score counts up. Press
   **Draft**: roster appears, leaderboard updates. Press **Refresh live**: badge flips to live. Back to globe:
   passport 1/10, ticker shows the draft.
3. **Rewind (30s).** Drag the tape wheel, pick a cassette, LOCK, PLAY: paths draw, winner stamped, score,
   leaderboard. Share button.
4. **Exit Clock (20s).** Hands ticking, an overdue hand glowing. Watch a hand. Refresh live.
5. **Two-Faced (20s).** Drag the dial: mask morphs, panels crossfade. Crowd verdict.
6. **Odds vs Flow (15s).** Rope springs to the knot. Pick a side.
7. **Last Ones Out (15s).** Windows going dark. Replay the blackout. Tap a building.
8. **Dynasties (15s).** Tapestry unfurls, crests, connectors draw. Swear fealty.
9. **MENAGERIE (15s).** Animals roaming, tap one, field notes. Collect.
10. **Wallet Obituaries (15s).** Headlines typeset. Light a candle.
11. **As The Chain Turns (20s).** Title card, episode plays, dramatic zoom, studio audience.
12. **Store (10s).** Passport 10/10, counters higher, ticker full. End on the rotating globe.

## X post (draft)
LONGITUDE: ten meridians, ten ways to read smart money. A store of ten apps built on the @nansen_ai API in
one weekend for the Meridian Buildathon. Draft rookie wallets before the label lands, rewind the tape and
call it, watch exit clocks tick, read the obituaries of wallets that sold it all. No login, ever.
[video] [store link] [repo link]

## Submission checklist
- [ ] 1,000+ API calls made in the window (store counter screenshot + data/nansen-calls.jsonl)
- [ ] Recording posted on X, tagging @nansen_ai
- [ ] Public GitHub repo with README (clone → run in under 10 minutes)
- [ ] Form: email, X post link, repo link
