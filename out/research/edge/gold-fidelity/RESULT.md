**Verdict: the forward record of the four gold daily/H4 systems is too thin to diff trade by trade (no live trade yet for Gold trend, Gold trend fast, the H4 trendline or Mosha BO; one pending engulf order), but everywhere it can be compared the live Trader and a replay of its own code on OANDA candles agree to the cent; every difference found is the Kraken-era feed (PAXG + basis before 7 Nov 19:00 UTC), not the rules. One live-side bug found by reading (a shadow Mosha chain's add was pushed as a live trade; fixed on main as #564 while this ran, pinned by a test here), two replay-side gaps closed (the council's shared fill step could not manage a gold-system trade; the research rows had no replay at all).**

## Question

Four paper gold systems went live in `council/trader.mjs` on 4–7 Nov 2026 (Mosha BO 4 Nov 20:43, Gold trend 5 Nov 23:32, Gold H4 trendline 6 Nov 00:13, Gold daily engulf 6 Nov 09:15, Gold trend fast 7 Nov 01:14), next to the gold replica (live since 3 Nov 21:47). Does the forward record on council-data (`trades.json`, `research.json`, `snapshot.json`) match what the same code produces on OANDA XAU/USD candles for the same days, managed with the council's own fill rules (`council/fills.mjs`): entry price and time, pending-limit fills (`price > entry` guard), gapped stops, the 17:00–17:14 NY rollover skip, weekend closes, adds, break-even moves, trailing exits, costs?

## What was compared

- **Live side.** council-data read 7 Nov 22:40 UTC. Gold system rows in `trades.json`: 2 replica trades (4 Nov, closed), 1 engulf order (pending). 0 rows, live or shadow, for Gold trend, Gold trend fast, the H4 trendline and Mosha BO. `research.json`: 36 replica signals on gold 3–6 Nov (5 pass v5). `snapshot.json` states of each system at 7 Nov 22:34. `research/replay-2w.json`: the council's long system replay (ends 3 Nov; it has no Mosha BO rows at all).
- **Replay side (`run.mjs`).** The live blocks of trader.mjs line for line (gold trend legs, trendline, engulf, Mosha chain, replica with every live gate of the current config; `replicaSignals` / `msnrDirection` lifted verbatim out of trader.mjs at run time), one run every minute from 3 Nov 00:00 to the Friday close (5,641 runs), the Trader's view = the last 720 candles of each timeframe (719 closed + the forming one), on OANDA mid candles through the site's `/md/bars` proxy (1m, 5m, 1h, 4h, 1d; 15m and 30m built from 1m). Trades are managed candle by candle with **`manageLive`**, the new pure form of the Trader's "Manage open trades" step (see Fixes). Each system enters only after its live start; earlier would-be entries are kept as `preLive` rows.
- The audited 2006–26 harness (`research/edge/gold-systems-oos/replay.mjs`, M5 management) was also run over 20 Oct – 6 Nov as a cross-check.

## Per-trade diff table

| System | Record | Live (feed) | Replay on OANDA | Entry diff (feed / timing) | Exit / R | Class |
|---|---|---|---|---|---|---|
| replica | xau-replica-1793752503-s | sell at market 4 Nov 00:35, 3924.00 / stop 3941.86 → loss −1R (Kraken PAXG + basis) | same signal (CHoCH 00:30), 3922.78 / 3941.29 at 00:36 → loss −1R | +1.22 (1.22 / 0.01) | live levels on OANDA 1m: loss −1R, same candle | **feed** |
| replica | xau-replica-1793765703-b | buy at market 4 Nov 04:15, 3949.82 / 3926.45 → win +2R | same signal (CHoCH 04:10), 3948.82 / 3925.70 at 04:11 → win +2R | +1.00 (1.64 / −0.64) | live levels on OANDA 1m: win +2R | **feed** |
| geg | xau-geg-1793664000 | limit buy placed 6 Nov 09:15 at 3979.36 / stop 3907.61, pending (zone from Kraken PAXG daily candle of 3 Nov) | same order id, 3971.36 / 3895.27 (OANDA 3 Nov zone 3895.57–3971.355), placed 5 Nov 00:01 on the 4 Nov close, pending | +8.00 / stop +12.34 (all feed) | both unfilled by the Friday close (OANDA low since placement 4029.83) | **feed** |
| gtrend | — | no trade since 5 Nov 23:32 | no trade; state hi20 4200.63, last close 4085.945 = snapshot to the cent | — | — | match |
| gtl | — | no trade since 6 Nov 00:13 | no trade; no falling line (state `line: null` = snapshot) | — | — | match |
| gtrend5 | xau-gtrend5-1793836800 | no trade (live only from 7 Nov 01:14) | buy 6 Nov 00:01 at 4085.52 / 3937.90 (5 Nov close 4085.945 > 5-day high 4071.67), `preLive` | — | the signal's 24 h window closed 7 Nov 00:00, 74 min before the leg went live; snapshot shows the same stale breakout (`open: false`) | go-live **timing**, not a fault |
| mosha-bo | — | 0 chains recorded (live or shadow) since 4 Nov 20:43 | 0 H4→H1→M15 chains on OANDA structure 3–6 Nov | — | — | match |
| mosha-bo | add-shadow-flag | code (to 7 Nov): every pyramid add pushed with `shadow: false` | rule text: a blocked chain "is kept as a shadow trade, not our system" | — | a shadow chain reaching +1.5R would have put its add on the live book and alerted | **bug** (fixed on main, #564; pinned by test here) |
| replica | research-loop | `research.json` rows managed by their own loop: no `spotSkip`, no `fillBarAmbiguous` | live book skips shut-market candles | — | 3 of 36 live research exits were decided while gold was shut (1 in the 17:05 NY break on a PAXG print, 2 on Saturday PAXG candles) | **rule** (reported) |
| all | cost-model | live `Rnet` = spread + ½ spread slippage per market order ($0.45–0.60 a unit) | research replays (replay-2w, gold-systems-oos) charge $0.30 | — | on the two replica trades costR 0.034 / 0.019 live vs 0.017 / 0.013 at $0.30 | **rule** (reported) |

Count by class (rows with a live or replay record): **feed 3, bug 1, rule 2, match 3, go-live timing 1**. No row where the live code and the replay disagree on a rule.

Cross-check of the two research replays on the only recent trade either has: the H4 trendline buy of 27 Oct 16:0x (pre-live): replay-2w (HistData 1m) 4058.95 / 3988.68 → −1R, stopped 30 Oct 03:06; OANDA harness 4060.98 / 3988.86 → −1R, stopped 30 Oct 03:05. Feed difference $2.03 on the entry, same result.

## Replica signals: the forward record vs OANDA (36 live signals, 3–6 Nov, all Kraken-era)

| | n |
|---|---|
| Live signals (research.json) | 36 (5 pass v5) |
| Replay signals on OANDA | 33 (5 pass v5) |
| Same CHoCH candle on both feeds (matched by `sig`) | **17** |
| Live only (a Kraken PAXG CHoCH that OANDA did not print) | **19** |
| Replay only | 11 |
| Matched: same outcome | 16 of 17 (the odd one: 5 Nov 23:15 buy, −1R live, −2.15R on OANDA where the stop was gapped at 23:16) |
| Matched: same v5 flag / H4 label / D1 label | 14 / 15 / **0** of 17 |
| Live outcome reproduced on OANDA with the live row's own levels | 29 of 36; **7 flip** (4 Nov 12:30 +2 → −1, 13:49 +2 → −1, 18:34 −1 → +2, 6 Nov 04:38 +2 → −1, 23:15 −1 → −2.15, 6 Nov 20:12 +2 → still open at the Friday close, 20:34 −1 → still open) |
| Live record R / the same levels on OANDA / the OANDA replay's signals | **+5R / −3.15R / +5R** |
| Entry difference, matched signals (live − replay), median | +1.68 (feed part 1.46, run-time part 1.07) |

- The D1 label disagreed on every matched signal: the live rows carried Kraken's PAXG daily trend (up since 27 Jan) while OANDA's daily trend has been down since 30 Oct (the switch to OANDA labels came 7 Nov 16:01, CLAUDE.md). The five live v5 signals were blocked by `calm + d1Skip`; on OANDA labels the same sells read `with D1`, so only `calm` blocks them: the same decision, no live trade.
- The volatility gate reads 1.39–1.40% on the Kraken daily series (weekend PAXG candles pull the 20-day range down) and 1.68% on OANDA; the top-fifth bar is 2.47 (the snapshot's `goldVol 1.68 / goldVolP 2.47` reproduce exactly from the proxy's 720 daily candles, 0 of 720 differ from the cache). Calm on both feeds.
- Two of the three exits decided while gold was shut were weekend PAXG candles (closed Saturday 01:24 and 08:04 UTC); the third stopped at 17:05 NY Wednesday, inside gold's daily break. On OANDA the first two are still open at the Friday close.

## Fills and management rules checked

- **Pending-limit fills and the `price > entry` guard.** The engulf order is the only resting order in the record; the guard (a limit buy is placed only below the price) held on both sides, the order never filled on either feed. Mosha BO's limit at the broken level never arose (no chain).
- **Gapped stops.** None in the window on the live book (`snapshot.fillChecks.gapStops 0`); one on the research side (5 Nov 23:15 buy, OANDA open through the stop → −2.15R where the live Kraken row booked −1R).
- **17:00–17:14 NY rollover (`spotSkip`).** On OANDA, gold has no candles between 17:00 and 18:00 New York (0 one-minute candles in that hour over the four days, 168 in the 18:00 hour), so the rollover skip never fires on gold; the gap carries into the 18:00 candle's open, which `stopFill` handles. It matters for forex, where OANDA prints through the rollover. The live research loop does not skip these minutes, and on Kraken PAXG they existed (the 22:01 UTC row above was stopped at 22:05 UTC = 17:05 NY).
- **Weekend.** No weekend inside the window on OANDA; the live research rows closed on Saturday PAXG candles are the weekend item above.
- **Adds, break-even, trails.** No live gold-system trade reached +1R in the window; the rules were checked by code, not by price: `manageLive` reproduces the Trader's loop on 500 random cases with trails, `beAt`, adds, time exits, limit fills and gaps (`tests/fills-live.test.mjs`).
- **Costs.** The live `Rnet` charges spread + half-spread slippage per market order; the research replays $0.30. Reported, not changed.

## Fixes made (this PR)

1. **Replay side: `council/fills.mjs` `manageLive(tr, b, { be })`, `addUnit`, `expireOrder`, `sizeR`.** The Trader's "Manage open trades" loop body as a pure per-candle function: limit fill (ambiguous = missed), stop with gap fill (first / break-even / trailing), target, time exit, MFE / MAE, trail `[fromR, behindR]`, Coach `be`, per-trade `beAt`, pyramid add. The council's shared step (`replayBar` / `manageVariant`) only knew stop, target and break-even, so no council replay could manage a gold-system trade; `run.mjs` manages on it. **`tests/fills-live.test.mjs`** lifts the Trader's loop text out of trader.mjs and runs it against `manageLive` on random gappy candles across a weekend (600 cases: 300+ exits, 40+ adds incl. shadow adds, 60+ trails, gapped stops, time exits), plus unit tests of each rule. `manageLive` reads the entry in the candle feed's frame (`E = entry + feedBasis`, council/feed.mjs, #568) as the live loop does. Any later change to the live loop that the shared step does not follow fails the test.
2. **Live side (code contradicted its rule text): the pyramid add's `shadow` flag.** Until 7 Nov `council/trader.mjs` pushed every add with `shadow: false`, so a Mosha chain blocked by weekly / cap / price / momentum (a shadow trade) that reached +1.5R would have pushed its add as a live trade with an alert; the Gold trend add already did this right. Found here by reading the loop; the same fix landed on main as #564 while this study ran (the add inherits the parent's `shadow` flag and blockers, `owner-shadow` when none is named), so this PR carries no trader.mjs change; `tests/fills-live.test.mjs` pins the behaviour and `addUnit` mirrors it. No rule, size, filter or mirror setting changed.

## Drift items for the owner (not changed)

- **Engulf order prices.** `xau-geg-1793664000` rests at 3979.36 / 3907.61 from the Kraken PAXG + basis daily candle; on OANDA the zone is 3971.355 / 3895.27 (+8.00 / +12.34). Since 7 Nov 19:00 the Trader judges it on OANDA candles, so it fills $8 above the spot zone high with a stop $12 above the spot zone low. Re-placing it is a live decision.
- **Mosha weekly filter fallback.** Live reads the weekly structure from CNBC spot days (`goldW1 −1`, bearish, 7 Nov). If CNBC fails, the code falls back to the feed's daily candles: OANDA's D1 series carries a Sunday-dated stub (the 22:00 UTC reopen) that Monday-aligned weeks fold into the *previous* week, and on those weeks the structure reads **+1** (bullish); without the stub candle it reads −1, as CNBC does. The fallback path would flip the filter.
- **Research-row management** (`research.json`): no `spotSkip` / `fillBarAmbiguous`; 3 of 36 outcomes in this window were decided while gold was shut. These rows feed `snapshot.research.replica` and the equity filter seed, not the live book.
- **Cost model**: research replays $0.30 a unit vs live `Rnet` $0.45–0.60.
- **Observability**: the snapshot has no `moshaBo` state block (only `goldW1` and errors), so a silent chain evaluation cannot be seen live; `research/replay-2w.json` has no Mosha BO rows and ends 3 Nov, so the systems' forward weeks have no council-side replay (this `run.mjs` is re-runnable for that).
- **Trade note text**: the Mosha BO record note says "target 3R" while the record runs to 10R with the trail from +3R (`moshaRun`). Text only.
- **Daily-close entries are timing-sensitive**: on 6 Nov gold moved from 4085.52 (00:01) to 4097.01 (00:05) right after the daily close; a run at a random minute after 00:00 moves a trend-leg entry by about $10 (0.08R of a 2 ATR stop).

## Method and files

- `run.mjs` — `CANDLES=<dir> node research/edge/gold-fidelity/run.mjs <council-data dir> [outDir]` (env `FROM`, default 2026-11-03T00:00Z; candle files `xau-<tf>.json[.gz]` rows `[t,o,h,l,c]`, fetched from `/md/bars` when missing; keep the folder out of git). Writes `result.json` (window, live-since times, live rows, replay rows with `cost.costR` and `cost30`, replica signal matching with per-row feed / timing split, Mosha chains, skipped-candle counts, the snapshot states against the replay's) and prints the diff table.
- `result.json` — this run (7 Nov 2026, candles to the Friday close).
- Candles: OANDA XAU/USD mid through `meridianx.dev/md/bars`, 1m from 16 Oct 2025, 5m / 1h / 4h / 1d from the #512 / #530 caches, all to 6 Nov 21:59 UTC. The proxy's live `tf=1d&n=720` series (the Trader's read) equals the cache candle for candle.
- Kraken's public OHLC is not reachable from the sandbox, so the live Trader's own PAXG candles could not be re-read; the feed class is inferred from the record's time (before the 7 Nov 19:00 switch) and from the per-minute OANDA price at each live run.
- Tests: `node --test tests/*.test.mjs tests/*.test.js` (296 pass, incl. the 6 new), `node ict/audit-test.mjs`, `node council/alerts-test.mjs`.
