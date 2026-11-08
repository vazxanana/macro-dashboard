# Mosha BO out-of-sample test: pre-registration

Written and committed **before** any replay result for 2006–2017 was computed. The criteria below decide the verdict; nothing in them is changed after the results are seen. Anything added later is labelled as a post-hoc diagnostic in `RESULT.md`.

## Question

Mosha BO (`k: mosha-bo`) is a LIVE Meridian gold system in `council/trader.mjs`. The parameter-drift audit (`research/edge/param-drift/RESULT.md`) found that it is the one live system never tested on untouched data in its live form: every component (the weekly filter, 2019–26; the add / run exits and the slow-arrival rule, 2023–26) was picked on the only window tested, the HistData replay leaves 18 out-of-sample trades, and the robustness rebuild (#486) has the weekly filter hurting. Does the live combination, **unchanged**, make money on 11.5 years of gold it never saw? This is the same test #530 ran on the other gold systems (`research/edge/gold-systems-oos`), on the same data and harness.

| System | `k` | Live rule (council-data `config.json` of 7 Nov 2026: `moshaBo true`, `moshaBoWeekly true`, `moshaSlow 12`, `moshaBeR 1.5`, `moshaAdd {atR 1.5, size 1}`, `moshaRun {atR 3, trail 1}`) |
|---|---|---|
| Mosha BO | `mosha-bo` | Chain on the engine's structure events (`msAnalyze`, N = 6, on the last 720 candles of each timeframe, closed events only): an H4 BO in direction d, then an H1 BO in direction −d after it, then an M15 BO in direction d, which must be the newest M15 event and at most 1 h old. Limit order at the broken M15 level; stop ±0.3 past the M15 Origin (top for a sell, bottom for a buy); only if the risk `r0 > 0.5`; the order is kept only if the current price is on the right side of the stop. Pending 24 h, out 72 h after the fill. Filters: the weekly structure (Monday-aligned weeks from the last 720 daily candles, `msAnalyze` swing 3, direction of the last BO on a closed week) must agree with d; a chain whose pullback from the H1 extreme to the M15 break took fewer than 12 closed H1 bars is blocked (`momentum`); at most 2 live Mosha trades open or pending (adds count). Exits: at +1.5R the stop moves to the entry and a second unit is added at that price with its stop at the first entry; after +3R the whole position trails 1R behind the best price, capped at 10R. Blocked chains are recorded as shadow trades live; here they are not positions. |

Claimed when approved: 2019–22 +7.5R (104 trades), 2023–26 +15.1R (114) for the base chain; weekly filter +0.37R / +0.35R a trade (both halves, 2019–26); slow rule picked on 2023–26. The robustness rebuild of the live combination on HistData 2018–26 gives +0.01R a trade (n 147, 2024–26 −0.14R).

## Data and periods

- **Source.** OANDA XAU/USD mid candles through the site's free `/md/bars` proxy, the live Trader's gold feed since 7 Nov: M5 (management and current price), M15, H1 and H4 (the chain), D1 (the weekly filter). UTC buckets as the proxy serves them, with OANDA's Sunday-evening daily stub. The M5, H4 and D1 series are the #530 cache (2006-03-19/20 to 2026-11-06); M15 and H1 are fetched the same way for the same span.
- **Out-of-sample (OOS) window, used for the verdict:** positions **filled** from **2006-07-01 to 2017-12-31**. No Mosha study in the repo has used pre-2018 gold. The first 3.5 months of data are warm-up.
- **OOS halves**, fixed in advance (as #530): **H1: 2006-07 to 2011-12** (the secular bull), **H2: 2012-01 to 2017-12** (the 2013–15 bear and the 2016–17 range).
- **Calibration window, not part of the verdict:** 2018-01-01 to 2026-11-06 on the same harness, compared with the robustness rebuild (`research/edge/robustness/out/mosha.json`, `live`: n 147, +0.009R, years 2018 −1.9 / 2019 +41.6 / 2020 −13.1 / 2021 −4.5 / 2022 −10.8 / 2023 −3.2 / 2024 +6.0 / 2025 +7.9 / 2026 −20.7) and with the HistData study (`research/edge/gold-systems/mosha.json`, `live` variant). It is also the reference for the drawdown criterion.

## Harness: the live rules, unchanged

- **Signal code** is the live Mosha block (`council/trader.mjs`, "Mosha breakout system"), line for line: `ev(id, sec)` events with `breakIdx < bars.length − 1`, `e3 = E3.at(-1)` within 1 h, `before(E2, e3.t)` / `before(E1, e3.t)`, `e1.dir === d && e2.dir === −d && e2.t > e1.t`, entry `e3.level`, stop `e3.top + 0.3` / `e3.bot − 0.3`, `r0 > 0.5`, `price` on the right side of the stop, the `pull` count from the 720-bar H1 window (the forming H1 bar included, as live), the weekly `w1At(e3.t)`, the cap on open + pending live Mosha trades (adds included), id `xau-moshabo-<e3.t>` (one chain per M15 event). `msAnalyze` is imported from `council/engine.mjs`. `stopFill`, `exitR`, `fillBarAmbiguous` and `spotSkip` are imported from `council/fills.mjs`.
- **Windows.** A run happens 4 minutes after each M5 close (the live loop runs about every 5.6 minutes). Each timeframe is read as the live Trader reads it from OANDA: the last 720 candles, the last one forming. `msAnalyze` is causal by index, so the closed events of a window equal those of its 719 closed candles; the weekly filter's week list is built from the 720-candle daily window (the forming day included) and only closed weeks' breaks count (`e.t <= now`).
- **Weekly source.** Live reads CNBC `XAU=` daily candles first and falls back to the market feed's daily candles (OANDA since 7 Nov). CNBC has no 2006–17 history for us, so the harness uses OANDA D1 throughout, the fallback path. Declared departure; the param-drift audit judged it small.
- **Entry and management.** A limit order fills on the first M5 candle that touches it (`fillBarAmbiguous` → missed), is missed if the 10R target is touched first, and expires 24 h after it was placed. Management follows the live "Manage open trades" loop on M5 candles in the live order: fill, stop (gapped stop at the open; `trail && trailMoved` → `exitR`, `beMoved` → `exitR`, else −1), target, 72 h time exit, MFE / MAE, trail `[3, 1]`, break-even at +1.5R, add at +1.5R (second unit at entry + 1.5 r0, stop at the first entry, its trail `[1, 0.667]` in its own R, `size 1.5` so that its R counts in the first unit's R, time exit with the first unit). Shut-market and 17:00–17:14 New York rollover candles fill and stop nothing (`spotSkip`).
- **Departures (no M1).** Live manages on 1-minute candles and reads the current price from the last 1-minute close; here `price` is the close of the M5 candle the run falls in (about 1 minute ahead of live) and fills, stops and trails are judged on M5 candles. The forming H1 bar used by the `pull` count is built from the M5 candles closed by the run.
- **Costs.** ×1: $0.30 per unit per round trip (the gold spread used in #512 and #530), charged as `0.30 / r0` R on every leg (the add's own `r0` and `size` make its charge `0.30 / r0` of the first unit too). ×2: $0.60.
- **Unit of analysis.** A position is the first unit plus its add; its R is the sum of the legs' R (× size). Positions are dated by the fill. Expired and missed orders, and blocked (shadow) chains, are not positions.
- **Verification before any OOS number is read.** The 2018–26 calibration is compared year by year with the robustness rebuild and the HistData study. The council's own record has no Mosha BO trade yet (council-data `trades.json`, read 7 Nov 2026 22:40 UTC: 0 records with `k: mosha-bo`), so there is no live overlap to check; the harness's chain detection is instead compared with the live block's structure on the shared code path.

## Statistics reported

- n, win%, mean net R a position, total R and t (mean / sd × √n), by year, by OOS half, for the whole OOS window and for the calibration. The same at ×2 costs, and gross.
- Worst drawdown on the closed-position equity curve, in R.
- Bootstrap 95% CI of the mean, ×1 and ×2: 10,000 resamples of positions, plus a calendar-month block bootstrap, with P(mean ≤ 0).
- Sides: buys and sells separately (diagnostic).
- **Decay monitor replay (diagnostic, pre-declared):** `council/decay.mjs` `assess()` with the live baseline `council/decay-base.json` `mosha-bo` (built from the robustness rebuild: ref +0.009R, sd 2.04, k 0.1, h 5.6, W 18, drawdown limit 39.17R), walked forward over the 2006–17 position record at ×1 costs in close order: the status after every trade, the share of trades at which it reads `decaying` / `watch`, the first date it reads `decaying`, and its reading at the end of 2017. The same over the 2018–26 calibration record. The monitor reads `decaying` on Mosha BO today (council-data `coach.json` of 7 Nov 2026 21:48 UTC: CUSUM 8.54 past 5.6 on the last 48 rebuild trades, no forward trade yet).

## Verdict rule (OOS 2006-07 to 2017-12, live config, positions) — the #530 bar, unchanged

- **FAILS** if the OOS mean net R a position is ≤ 0 at ×1 costs, **or** ≤ 0 at ×2 costs.
- **ROBUST** if it does not fail and meets **all** of these:
  1. t ≥ 2.0 at ×1 costs.
  2. The lower bound of the position-bootstrap 95% CI, at ×1 costs, is above 0.
  3. Both OOS halves (H1 2006-07 to 2011-12, H2 2012-17) have a mean net R above 0 at ×1 costs.
  4. At least half of the OOS calendar years that have a position are net positive at ×1 costs.
  5. The OOS worst drawdown, at ×1 costs, is no deeper than twice the worst drawdown of the same system in the 2018–26 calibration on this harness.
- **REGIME-BOUND** if it neither fails nor is robust. The result names the tests it missed. If H1 is positive and H2 ≤ 0, the edge is read as bull-market exposure rather than a timing edge.

Only the live configuration is judged: one verdict. Any variant (no weekly filter, no slow rule, 3R exit, no add, other windows) is a diagnostic and cannot change the verdict.

## What the verdict feeds

- A written recommendation to the owner on Mosha BO's place in the live book and on how its forward record should be read next to the decay monitor's flag. No live rule, size, filter or mirror setting is changed by this study. Paper research only.
