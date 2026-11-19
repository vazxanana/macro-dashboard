# Gotobi cost: what the fade after the 09:55 Tokyo fix costs at 00:55 and 06:00 UTC, and where it breaks even (pre-registration)

Written and pushed on 14 Nov 2026 before any trade of this study was computed and before any break-even was worked out. Cost
accounting only: **no rule is tested and no verdict on the rule is given here.** The rule, its windows and its pass bar are the
`gotobi` study's (branch `gotobi`, PR #878) and stay as they were; this study only asks what the trade costs and at which cost
its result disappears. Nothing live changes.

## Why

`gotobi` T2 (sell USD/JPY at 00:55 UTC on gotobi days, buy back at 06:00 UTC; stop 1.5 x the 20-day median move of the window)
passed its pre-registered bar at an assumed cost: 0.3 pip spread a round trip + 0.5 pip slippage a side + USD 22.5 per million
of notional a side (`costPx` in its `run.mjs`), about 2 pips a round trip. `gotobi-replicate` (PR #889) found the same fade on
GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY 2010-now. Both reported that at TWICE that cost the result is about zero (USD/JPY 2016-now
+0.035R, month t 0.65; crosses pooled +0.005R, t 0.15). The 0.3 pip spread and the 0.5 pip slippage were never measured at
those two minutes, and not at all on the crosses.

## The frozen rule

`frozen.mjs` in this folder is a byte-for-byte copy of `research/edge/gotobi/run.mjs` at commit `5f341e069` of branch `gotobi`
(sha256 `645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32`, the same file `gotobi-replicate` froze; pinned in
`tests/gotobi-cost.test.mjs`). Every trade is the frozen `trade` (entry, stop, stop-first management, exit, gross `R`, stop
distance `D`). Costs never change a trade's path (no position is stopped or kept because of a cost), so a trade's net R at
another cost is computed from its own stored figures:

    net R(x) = R - (x x 0.01 + 2 x 22.5e-6 x entry) / D

where **x = spread + 2 x slippage, in pips a round trip** (one parameter), and the commission stays at USD 22.5 per million a
side. At x = 1.3 (0.3 + 2 x 0.5) this is exactly the frozen `costPx`. Month t = the frozen `monthT` on the net R(x) of the
trades (calendar-month sums).

## Streams

- **USD/JPY, 2016-01-01 to the last whole day on file** (the gotobi study's decisive window for T2); the gotobi study's candle file.
- **The four crosses pooled, 2010-01-01 to the last whole day on file** (gotobi-replicate's R1 window and pooling: all
  trades of the four crosses together, month sums across them); gotobi-replicate's candle files.
- Reported beside them, not part of the break-even question: USD/JPY 2010-15, and each cross on its own.

Gate before anything else: at x = 1.3 the USD/JPY 2016-now stream must give n 771, +0.148R a trade, month t 2.74 (PR #878's
RESULT.md) and the pooled crosses n 4784, +0.099R, t 2.75 (PR #889's RESULT.md). If not, the study stops and says so.

## Break-even

For each of the two streams:

1. **x0** = the x at which net R a trade = 0. Net R a trade is linear in x, so x0 = (mean R - mean(commission / D)) /
   mean(0.01 / D), computed exactly.
2. **x2** = the x at which month t = 2, found by bisection on x between -5 and +20 pips to 0.001 pip. Month t is checked to be
   decreasing in x on a grid of 0.1 pip over that range before the bisection; if it is not, the report says so and gives the
   grid instead of a single x2.
3. Both also as an all-in figure: x plus the commission in pips at the stream's median entry price (2 x 22.5e-6 x price / 0.01).

## Costs: what is measured and what is assumed

Looked up before this file was written (where to find a figure, not what the trade makes with it). Each candidate is named in
the report with where it comes from and is labelled **measured** or **not measured**:

- **Commission**: USD 22.5 per million a side, the demo broker's own figure (`commissionType` 1 in council-data
  `ctrader/symbols.json`; `commissionRT` 0.000045 on every forex major). Measured for the broker's forex symbols; the yen
  pairs are not on the account, so it is assumed the same for them (the broker states one forex rate).
- **Quoted spread at 00:55 and 06:00 UTC on yen pairs: not measured.** The candle proxy (`api/bars.js`) asks OANDA for mid
  prices only (`price: 'M'`), so no bid / ask history is reachable; no yen pair is in `ctrader/symbols.json` (none in its
  history either) or in any `ctrader/mirror*.json`. What exists, reported as context only: the broker's quoted spread on the
  five USD majors in `spreadLog` at the reads nearest 00:55 and 06:00 UTC on 13 Nov 2026 (one day, majors, not yen).
- **Slippage at those minutes: not measured** for yen pairs (no yen fill on any demo account).
- Candidate x values (each a row of the report, none chosen as "the" cost):
  - C1 the original assumption: 0.3 spread + 2 x 0.5 slippage = 1.3 pips.
  - C2 the broker's published average spreads (Fusion Markets help centre, undated, all-day averages, account type not
    stated; found through a web search on 14 Nov 2026, page not opened): USD/JPY 0.08, GBP/JPY 0.49, AUD/JPY 0.29, CAD/JPY
    0.49, CHF/JPY 1.39 pips; with no slippage (C2a) and with 0.5 pip a side (C2b). Per cross in the pooled stream.
  - C3 another published figure for CHF/JPY on the same broker's raw account: 0.8 pips (BrokerChooser, web search 14 Nov 2026,
    not opened); used only in a CHF/JPY row.
  - C4 twice the original cost in R (the figure #878 and #889 reported: twice spread, slippage and commission).
  - A grid of x = 0, 0.5, 1, 1.3, 2, 2.6, 3, 4 pips for both streams.

## What the report says

The gate, x0 and x2 per stream (and all-in), net R a trade and month t at every candidate and on the grid, per-cross figures,
and plainly which costs are measured and which are not. No PASS / FAIL on the rule; if the measured-or-published candidates
sit above x2, the report says the gotobi result does not survive them, and if below, that it survives them **only as far as
those unmeasured figures hold at 00:55 and 06:00 UTC**. The next step that would measure the spread (bid / ask reads of the
yen pairs at those two minutes on real gotobi mornings) is named, not taken here.
