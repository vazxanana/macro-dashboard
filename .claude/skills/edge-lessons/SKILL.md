---
name: edge-lessons
description: Lessons from this repository's own studies that transfer to every edge (Mosha, Engulfing, MSNR, LIT, council systems; ICT stays separate) - cost as a share of the stop decides most rules, go one timeframe up instead of tightening the stop, trailing exit, market entry over a "better price" limit, confirmation arrives after the move, the side-flipped placebo as a discovery tool, and the discovery / holdout / gate / cut-test routine. Use when improving, tightening, filtering or re-testing any trading rule, when someone asks "what if we reduce the stop / get a better entry / add a filter", or before writing a pre-registration.
---

# Edge lessons: what transfers from one study to the next

Written 28 Nov 2026 from `research/edge/fade-breaks-holdout` and `research/edge/fade-box-edge` (and the grids they built on).
These are findings with n and t, not rules of any desk. Nothing here is an edge by itself; every lesson is a CHECK to run on
the next rule before believing it. Absolute rules of CLAUDE.md still bind (stops, paper / demo only, owner approves).

## 1. Check the cost in R first: it decides most small-timeframe rules

The cost is a fixed amount of price; a trade's result is in R. Cost in R = round trip / risk. Before any other analysis,
list each rule's cost / risk distribution (median and share of trades over 0.1R).

- Evidence: the fade of an M5 box close-out made about +0.05R a trade BEFORE costs in every one of 22 years and three data
  sets (n 29,000 / 55,510 / 41,799; month t 6.19 / 9.79 / 6.38), yet lost after costs everywhere, because its round trip was
  0.07-0.11R a trade (fade-breaks-holdout F1).
- Filter that helped most: keep only trades whose stop is at least **8 round trips** wide (cost under 0.125R).
- Apply to: any entry on M1 / M5 with a stop of a few pips (Mosha M1 BO at the tap, the Engulfing M1 EF entry, LIT,
  the scalp methods). A before-cost tilt smaller than its cost in R is not tradable, however high its t.

## 2. Move one timeframe up; do not tighten the stop

- Moving the same fade from the M5 box (H1-M15-M5 chain) to the M15 box (H4-H1-M15) about halved the cost share; the plain
  M5 fade lost after costs in every stop / exit variant on four of five windows (the fifth within 0.003R of zero), the
  M15 one sat near zero.
- Tightening the stop made it WORSE in every window: 0.5 x the stop negative after costs in 5 of 7 windows, and both 0.5 x and
  0.75 x below the current stop in all 7 (fade-box-edge, "After the result"). A smaller stop raises the cost share and stops out more trades in the noise.
- Small tweaks are noise: 10 % less stop with 10 % more target moved the pooled result by 0.004R a trade or less.
- So when a rule is "nearly there", test the next timeframe up before any stop or target tuning.

## 3. Exit with a trailing stop

- A stop moved to 1R behind the best price from +1R was the best exit for the M15 fade pooled over seven windows: +0.033R a
  trade after costs against +0.026R at a fixed 2R, +0.001R at 1R; the box middle was worse still (fade-box-edge). Fixed 1R
  targets were the worst almost everywhere, as in `desk-exits` and `desk-partial`.

## 4. A "better price" limit is adverse selection

- A limit 0.25 x the stop distance beyond the signal filled about 60 % of the time, 0.5 x about 40 %, and the fills are the
  trades where the move kept going: before costs the fade's +0.092R a trade (2020-26 holdout markets) fell to +0.006R and
  0.000R. Market entry at the next open was best.
- Same lesson as the grids (trade-through limits lose more than market entries) and `dom-trade-through` (touch fills on mid
  candles flatter a limit). Never assume a touch fills; use the trade-through rule (half the round trip through the level).

## 5. Waiting for confirmation usually arrives after the move

- Waiting for an M15 close back inside the box before fading lost after costs in all 7 windows (-0.02R to -0.14R a trade).
  The grids found the same for engulf / break / box confirmations on dominant zones (`grid6-dom-confirm`).

## 6. Complements from the other strategies: small, and only some

- Helped a little: the signal still inside the larger (H4) box (box-in-box reading); a choppy H1 (20-candle efficiency ratio
  under 0.30). On fresh data the best combination (E1: M15 fade, stops of 8+ round trips, inside the H4 box, trailing exit)
  made +0.017R a trade after costs (n 3,085, t 0.74) and +0.043R (n 4,190, t 1.86): not an edge.
- Did not help: agreeing with the lower or higher timeframe's structure (`ltf-structure`, `direction-chain-gate`,
  `vb-structure-filter`), the Daily MSNR call (`grid6-dom-confirm`, `grid6-mosha-market`).

## 7. The side-flipped placebo is a discovery tool

- Every grid trades each signal the other way too (same time, stop mirrored at the same distance). When the PLACEBO beats
  the real trades (box-in-box: placebo 22 confirmed cells, real 0; mosha-market: 1,155 discovery winners against about 369 by
  chance), the rule is following a move that tends to reverse: test the fade as its own pre-registered rule.
- But fading breaks in general did not work: the plain "fade the first M5 break inside an H1 box" lost before costs on every
  set. Only the specific form that the placebo pointed at held.

## 8. The routine (reuse the code)

1. **Discovery** on data already read; never call it evidence. Keep the number of cells tried.
2. **List the unread data** for that rule family before choosing (fade studies, 28 Nov 2026: the eight markets gbpjpy,
   eurgbp, audjpy, cadjpy, euraud, nas100, spx500, de40 from 2019 are still unread by any fade study).
3. **Pre-register** alone (PREREGISTRATION.md committed and pushed before any run on the unread data); fix exact cells.
4. **Gate**: the new code reproduces the source grid's figures exactly on the grid's own data before any new figure counts.
5. **Cut test**: signals known before a cut are identical when the candles stop at the cut.
6. **Judge** with month-sum t (empty months 0), Holm over the primary tests, per-market rows; judge AFTER costs when the goal
   is a tradable rule (before costs only to ask whether an effect exists), and show 2 x costs.
7. Never smoke-test on the holdout before the pre-registration is pushed (it happened once: disclosed in fade-breaks-holdout).

Code to reuse: `research/edge/fade-breaks-holdout/run.mjs` (per-cell trade generators copied from three grids, gate and cut
test), `research/edge/fade-box-edge/discover.mjs` + `analyze.mjs` (per-trade features, variants x conditions x windows),
`explore-entry.mjs` (stop / limit / confirmation variants), `explore-stoptp.mjs` (stop and target multiples).

## How to apply it to another edge (checklist)

1. Cost / risk per trade of the edge's records: share over 0.1R? Try the 8-round-trip filter.
2. If the stop is on M1 / M5: run the same reading one timeframe up before any other change.
3. Compare its exit with a trailing stop from +1R.
4. If it enters on a limit at a "better" level: compare with a market entry at the signal; check the fill rate.
5. Run its side-flipped placebo; if the placebo wins, pre-register the fade.
6. Any condition found that way goes through steps 1-7 of the routine on unread data before anyone calls it better.
