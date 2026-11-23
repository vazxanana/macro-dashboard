# Fade on H4 and D1: fading the first structure break on the higher timeframes (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/grid7-wide-fade` found that FADING the first structure break on M5, M15 and H1 (entering against it at market)
has a small tilt before costs in both 2005-14 and 2015-26 on ten markets, and `research/edge/fade-new-markets` found it again on
eight other markets and on HistData; but after costs every cell lost, because the stops are a few pips and the round trip takes
more than the tilt. The tilt shrank as the trigger timeframe rose (H1 with a 1 ATR stop: +0.011R, t 2.12, Holm 0.54). This study
asks the one question left: on H4 and D1, where the stop is many times the spread, is there still a tilt before costs, and how
far is it from tradable after costs? Every cell is fixed below; nothing is picked from the earlier studies' figures.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA` on the machine
  that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10, `grid7-wide-core` `MARKETS`): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy.
- **H4** = `edgekit` `resample(M5, 14400)` (UTC 4-hour buckets, as `combo-grid-3` `frames`).
- **D1** = UTC days (`resample(M5, 86400)`) with weekend candles folded into the next weekday, as `council/fills.mjs`
  `foldWeekend` does: a Saturday or Sunday day candle is not a day of its own; its open becomes the next weekday's open and its
  high / low are joined into that day's; the weekday keeps its own time, close and end.
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time (`grid7-wide-core` `FROM`, `SPLIT`, `TO`): **discovery 2005-01-01 to 2014-12-31** (120 months),
  **confirmation 2015-01-01 to 2026-10-31** (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The break (T = H4 or D1; closed candles only)

`grid7-wide-fade` `breaks(T)` (imported, unchanged; its events equal `edgekit` `structure(T, 3)`): a close beyond the last confirmed
swing (3 candles a side, confirmed 3 candles later); each swing is broken once; direction d = +1 (up) / -1 (down); the break is
known at the close of its candle j. No context filter: every break counts.

## The trade

- **Direction (two)**: **fade** = side s = -d (against the break); **with** = side d, the mirror (the `grid7-wide-fade` mirror: same
  fill, the stop at the same distance on the other side, targets at the same distances in R).
- **Entry**: market at the open of the first 5-minute candle starting at or after the close of candle j.
- **Stop (two)**, defined on the fade: **ext** = past the break candle's extreme (its high for an up break, low for a down break) by
  0.1 x ATR(14) of T at candle j; **atr** = 1 x ATR(14) of T at candle j, from the fill. Every trade has its stop on the losing side;
  a fill at or past the stop is no trade; a risk under the market's round-trip cost is no trade (same for both directions).
- **Exit (three)**: **1R**, **2R**, or **swing** = the opposite swing of the broken one standing when the break happened (the
  grid's swing exit; a swing target not on the winning side of the fade's fill, or none, is no trade in that cell; the mirror's swing
  cell uses the same distance in R). Stop first when one 5-minute candle holds stop and target; a gap through either fills at the open.
- **Time limit**: H4 8 days, D1 30 days from the fill; out at the close of the 5-minute candle that reaches it.
- Trades overlap freely (no one-at-a-time rule).
- Simulation on the 5-minute candles with `grid7-wide-fade` `exits` (imported, unchanged).

## The cells (24, fixed here)

timeframe (H4, D1) x stop (ext, atr) x exit (1R, 2R, swing) x direction (fade, with). Named `<tf> <stop> <exit> <direction>`:
h4 ext 1R fade, h4 ext 2R fade, h4 ext swing fade, h4 atr 1R fade, h4 atr 2R fade, h4 atr swing fade, d1 ext 1R fade, d1 ext 2R fade,
d1 ext swing fade, d1 atr 1R fade, d1 atr 2R fade, d1 atr swing fade, and the same twelve with "with".

## The bar (judged BEFORE costs, on calendar-month sums of R; fade cells only)

A fade cell passes when ALL hold:
1. n >= 300 trades in each window (a cell short of it is reported as **too few to judge**, never a pass or a fail of its own);
2. mean R > 0 and month-sum t >= 2 in discovery;
3. mean R > 0 and month-sum t >= 2 in confirmation;
4. Holm-adjusted one-sided p < 0.05 over the 12 fade confirmation tests (p from the month-sum t, df = months - 1).

Verdict: **PASS** if one fade cell or more passes; **FAIL** if none passes and at least one fade cell has n >= 300 in both
windows; **INCONCLUSIVE** if every fade cell is too few, or fewer than 8 of the 10 markets load. The "with" cells are reported
with the same figures and are not judged.

## Also reported (not part of the bar)

- **After costs** beside every figure: R less (round-trip cost / risk) per trade, `combo-grid-2` `COSTS` (the demo figures for gold
  and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy). Mean cost in R per cell.
- **Stop size**: per market, timeframe and stop, the mean and median risk of the fade trades in pips (0.01 on yen pairs, 0.0001
  on other pairs) or dollars (gold, silver), and the typical stop as `cost / mean(cost / risk)` (the harmonic mean of the risk). The
  same typical stop is given for `grid7-wide-fade`'s M5 / M15 / H1 cells from its committed `result.json` (`costByMarket`), so
  the sizes can be compared.
- **Per-market rows** for any passing cell.
- **Cut test**: on five dates in two markets (xau, eurusd), the H4 and D1 signals known by a date computed on candles cut there
  equal the full run's.

## What a result means

A pass is a before-cost tilt in both decades, nothing more: if it does not survive costs it is not tradable and is said so; if it
does, it is still a hypothesis for a forward record that needs the owner. Never called an edge without n and t; no live change.
One run, no variants.
