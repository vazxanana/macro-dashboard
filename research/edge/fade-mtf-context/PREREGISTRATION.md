# Fade of the M15 break, split by the higher timeframes (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/grid7-wide-fade` found that fading the first M15 structure break (entering against it at market, stop 1 ATR)
has a small tilt before costs in both decades on ten markets (m15 none atr 2R: +0.054R / +0.042R a trade, month t 11.38 /
11.33; swing exit +0.059R / +0.040R, t 9.45 / 8.72) and loses after costs. This study asks one question about that rule:
is the tilt larger when the M15 break goes AGAINST the higher timeframes' structure (so the fade trades WITH them)? Five
splits, every level named here, read from candles closed at the break only.

## Data and windows (as grid7-wide-fade)

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `EDGE_DATA`), loaded from 2004-01-01.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy.
- Timeframes from the 5-minute candles with `combo-grid-3` `frames` (imported): 15m, 1h, 4h (UTC buckets), 1d (17:00 New York).
- Exclusions: `combo-grid-2` `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The rule (unchanged from grid7-wide-fade, context "none", stop "atr")

Every M15 structure event (`edgekit` `structure(M15, 3)`, through `grid7-wide-fade` `breaks`, imported): candle j closes beyond
the last confirmed swing, direction d. Fade: side s = -d, market entry at the open of the first 5-minute candle starting at or
after the close of j. Stop = 1 x ATR(14) of M15 at j from the fill (always on the losing side; a fill at or past it is no
trade; a risk under the market's round-trip cost is no trade). Exits (two): **2R**, and **swing** = the last confirmed M15 swing
on the other side standing at the break (no swing on the winning side of the fill = no trade in that exit). Stop first when one
5-minute candle holds both; a gap fills at the open; time limit 1 day from the fill. Trade engine: `grid7-wide-fade` `exits`.

## The splits (closed candles only: everything is read at the close of the M15 break candle, ts)

1. **H1 last break**: the last `structure(H1, 3)` event closed by ts. **same** (its direction = d) / **opposite** (= -d).
   No event yet: in neither level (counted in the control only).
2. **H4 last break**: as 1 on `structure(H4, 3)`: **same** / **opposite**.
3. **H4 stage**, `phase.mjs`'s definition (`stageOf`): from the H4 last break closed by ts and the H1 events after it closed by
   ts: **pullback** (an H1 break against the H4 side after it, no H1 break back with it since), **move** (no H1 break against
   it since; phase.mjs's "continuation", an H1 break back with it after one against, is counted as move: the H4 leg is running
   again), **range** (no H4 break yet, or phase.mjs's two-ChoCh range rule). Computed on the full closed series with the same
   rules (one pass, not `readPhase` per signal, which reads a 600-candle tail); the agreement with `readPhase` on a sample of
   signals is reported.
4. **Counter-move**: **yes** = the last H1 event closed by ts has direction -d AND this is the first M15 event of direction d
   closed after that H1 event's close; **no** = every other M15 event.
5. **Prior day**: the last 1d candle (17:00 New York day) closed by ts = the prior day. **yes** = the break candle's high is
   above the prior day's high (up break) / its low below the prior day's low (down break); **no** otherwise.

## Cells (24, fixed here)

For each exit (2R, swing): the **control** (the unsplit rule) + 11 levels (H1 same, H1 opposite, H4 same, H4 opposite, stage
move, stage pullback, stage range, counter yes, counter no, prior-day yes, prior-day no) = 12; x 2 exits = **24 cells**.
Named `<split> <level> <exit>`, e.g. `h1 opposite 2R`, `control swing`.

## The bar for a cell (judged BEFORE costs, on calendar-month sums of R)

A level cell passes when ALL hold:
1. n >= 300 trades in each window;
2. mean R > 0 and month-sum t >= 2 in discovery AND in confirmation;
3. Holm-adjusted one-sided p < 0.05 over the 22 level cells' confirmation tests (p from the month-sum t, df = months - 1);
4. it beats its control: mean R of the cell minus mean R of the unsplit rule (same exit), Welch t >= 2 on trades, in BOTH
   windows.

## Primary tests (the hypothesis: fading works better when the break goes AGAINST the higher timeframe)

For each exit, five differences of means (trade-level Welch t), the level named first expected higher:
- P1 `h1 opposite` minus `h1 same`;
- P2 `h4 opposite` minus `h4 same`;
- P3 `stage pullback` minus `stage move` (in an H4 pullback the M15 breaks run against the H4 side, in a move with it);
- P4 `counter yes` minus `counter no`;
- P5 `prior-day yes` minus `prior-day no` (a break that runs the prior day's extreme is the one most likely to be a stop run
  that reverses).
A primary test holds when the difference is > 0 with Welch t >= 2 in BOTH windows and its Holm-adjusted one-sided p
(confirmation Welch t, normal approximation) is < 0.05 over the 10 primary tests (5 splits x 2 exits).

## Verdict

**PASS** if one or more primary tests hold; **FAIL** otherwise. INCONCLUSIVE only if fewer than 8 of the 10 markets load.
Cells that pass the cell bar are reported either way.

## Also reported (not part of the bar)

- After costs beside every figure: R less (round-trip cost / risk), `combo-grid-2` `COSTS` (demo figures for gold and the four
  majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).
- **Side-flipped check**: every cell traded WITH the break (same fill, stop at the same distance on the other side, targets at
  the same distances in R).
- Per-market rows for any passing cell or holding primary test.
- Cut test: on five dates in two markets, the signals and their split labels known by a date, computed on candles cut there,
  equal the full run's.

## What a result means

A pass is a before-cost difference inside a rule that loses after costs: it says where the tilt lives, not that anything is
tradable. Never called an edge, no live change, one run, no variants on these years.
