# The H1 dominant-zone limit on gold, at the demo broker's measured hourly spreads (pre-registration)

Written 23 Nov 2026, before any run of this study. Research only: nothing live changes.

**Why.** The three combination grids (`research/edge/combo-grid`, `-2`, `-3`) ended, before costs, on one family: an H1
dominant zone (two H1 candles of one colour, the second closing beyond the first's extreme; zone = the first candle's body),
touched on M5, a limit at the zone's near edge, no trigger, the stop past the far side by half the cost plus 0.25 x ATR(14) of
H1. Gold was its strongest market (grid 3: 4R exit +0.142R a trade before costs in 2024-now, n 8,909, month t 6.62; +0.073R
after the flat $0.30 round trip). The grids charged a flat $0.30. This study charges each trade what the demo broker's own
quotes say a round trip costs at the hours it was opened and closed, as `research/edge/gold-vol-breakout-hourcost` did.

**Said plainly before any number: 2020-26 has been read by three grids that picked this family from millions of cells.** A
pass here is not evidence on new data; it only says the family can pay the broker's measured costs, which makes it a
candidate for the forward demo record (`council/dom-demo.mjs`, already running). The untouched-years test is
`research/edge/dom-zone-holdout`.

## Rule (fixed; the grid 3 engine, imported, never edited)

Exactly `research/edge/dom-zone-holdout/run.mjs` `trades()` for one market: `combo-grid-3/run.mjs` `frames`, `signalsFor(F, '1h',
'5m', 'dom', {}, from)`, the no-trigger signals (first and second touch of a zone), entry a limit at the zone's near edge from
the touch candle's start, alive 12 M5 candles, stop = far side -/+ ($0.15 + 0.25 x ATR(14) of the last closed H1 candle), risk
at least $0.60 and at least $0.30 at the fill, the grid's `multi()` exits (fill candle can only stop the trade, a gap through
the stop at the open, 2-day limit), the data-quality exclusions. Gold (`xau`) only. Exits: 2R, 3R, 4R and the 1R trail (from
+1R the stop trails 1R behind the best price).

## Data and windows

OANDA mid 5-minute candles from the `edgekit` cache (`fetch-cache.mjs xau 5m 2019`), loaded from 200 days before the first
window. Fills from 2021-01-01 (where the hourcost study's newest window begins) to the end of the cache. Two windows:
**A = 2021-01-01 to 2023-12-31, B = 2024-01-01 to the end.** Year-by-year table reported.

## Costs (the point of this study)

- **Measured spread**: the hour profile of council-data `research/probe/ticks-XAUUSD.json` at commit `0459ec37` (read
  20 Nov 2026 00:58 UTC; the file the hourcost study used): `frac[h]` = median quoted spread of UTC hour h as a share of the
  mid. **Commission** 0.000024 of price a round trip (council-data `ctrader/symbols.json`, XAUUSD `commissionRT`).
- **C1 (judged)**: cost = (0.5 x frac[hour of the fill candle] + 0.5 x frac[hour of the exit candle] + 0.000024) x entry
  + 0.05 x M, M = the median range of the 12 M5 candles ending with the fill candle (the hourcost study's stop-slippage
  allowance, charged on every trade, whatever its exit). Plus overnight financing on buys only: `council/fills.mjs`
  `nights(fill, exit)` x `FIN.xau.long` x entry. Net R = R - (cost + financing) / risk.
- **C2 (reported, not judged)**: the same with `frac90` and 0.10 x M.
- **Flat (reported)**: the grids' $0.30, no financing, to compare.
- The exit time is not returned by `multi()`, so `run.mjs` walks each trade again for each exit; the walk must reproduce
  `multi()`'s R on every trade (to 1e-9) or the study stops (gate G1).

## Gates (the study stops and reports only this if one fails)

- **G1** the walk equals `multi()` on every trade and exit.
- **G2** before costs, 4R exit, window B reproduces grid 3's gold cell within 2 % on n and 0.01R on the mean (a later cache end
  may add trades; a larger gap means the harness differs).
- **G3 cut test**: the trade list built from candles cut at three dates (2022-06-15, 2024-03-15, 2025-09-15) equals the full
  run's trades whose exit candle ends before the cut (entry, stop, fill time, every exit's R).
- Every trade has a stop on the losing side of its entry (checked).

## Tests (after C1 costs; month sums of calendar months, t = mean / (sd / sqrt(months)))

- **T1** 4R exit: mean net R a trade > 0 with month t >= 2 in window A AND in window B.
- **T2** 1R trail: the same bar.
- Holm over T1 and T2, each on the one-sided p of its weaker window's t (Student t, months - 1). **PASS** = at least one of
  T1 / T2 holds with Holm p < 0.05; **FAIL** = neither. Both reported whatever the verdict, with before-cost figures beside.

## Reported

Per exit and window: n, R before costs, net R under C1 / C2 / flat, month t of each; the year-by-year table (C1); the share of
gross R the cost takes (mean cost R / mean gross R); the cost in dollars a trade (median); fills by session (Asia 00-07,
London 07-12, New York 12-21, late 21-24 UTC) under C1. No variant is chosen from this; nothing is called an edge.
