# H1 inversion-gap reversal inside a Daily engulf zone (pre-registration, 24 Nov 2026)

Written and committed alone BEFORE any run on real candles. Research only: nothing live reads it, nothing is placed, no rule
is proposed, and nothing under `ict/` changes (the ICT desk stays a separate edge; this study only imports its signal function).

## Why

The ICT desk's H1 model (a swing is swept, then a candle body closes back through the fair value gap of the leg that made
the sweep) has been tested alone and with its own filters (`ict-oos-2008`, `ict-filters`, `ict-equal-lows`, ...), and the engulf
zones have been tested as entries on their own (`grid7-wide-core`, `desk-rigor`, ...). No study in `research/edge/` asks the
combination: is the same reversal better when the sweep happens INSIDE a Daily engulf zone (or a Daily engulf zone that
failed and turned) of the trade's side, than when it happens outside any such zone? Checked before writing: `smc-sweep-fvg`,
`grid6-smc-market`, `grid7-fvg-wide`, `grid7-wide-sweeps` use other entries (limits in a gap, gap returns, range sweeps) and none
uses the desk's signal with a Daily engulf zone.

## Data

OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs` `load`), five markets: xau, eurusd,
gbpusd, usdjpy, audusd (gold's candles start in March 2006). H1 = `edgekit.resample(…, 3600)` (UTC hours); Daily = `edgekit.dailyNY`
(17:00 New York trading days, the weekend folded into Monday). No data-quality exclusion list is applied. Costs = `edgekit.COSTS`
(round trip in price units, the demo figures: gold 0.30, EUR/USD 0.00006, GBP/USD 0.00008, USD/JPY 0.008, AUD/USD 0.00006),
charged as cost / risk on every trade.

Windows, by the time of the fill: **discovery 2005-01-01 to 2014-12-31**, **confirmation 2015-01-01 to 2026-10-31**.

## The signal (imported, not edited)

`ict/tracker.mjs` `signals(H1, D, side, tick)` with its own constants `P` as committed today, for both sides. In plain words:
a confirmed H1 swing low (3 candles a side, within the last 96 H1 candles) is traded under by an H1 candle (the sweep);
within the sweep candle and the 6 after it an H1 candle's body closes above the top of the most recent down-leg fair value
gap (three-candle gap, at most 12 candles before the sweep) having opened, or the candle before having closed, at or under
that top; the stop is 2 ticks under the lowest low from the sweep to that candle; a stop wider than 8 x the 48-candle H1
average true range ends the search; after a signal the next sweep is read from 6 candles later. Sells mirror. Every signal
of the function is used (no grade, bias or A-setup filter). Tick: gold 0.1, USD/JPY 0.01, the three other pairs 0.0001
(so the stop sits $0.20 / 2 pips beyond the sweep's extreme).

## The zone (imported, not edited)

`council/eg-methods.mjs` `zones(Daily, '1d')` with its default span (an engulf = a coloured Daily candle closing beyond the
high, for a buy, or the low, for a sell, of the last candle of the other colour at most 3 candles back; the zone is that
base candle wick to wick, known from the completing candle's close; it lives 120 Daily candles or until a Daily close
through its far side = it failed). At the moment T = the open of the H1 sweep candle, for a trade of side d:

- **eg**: a zone of side d known by T (completing close <= T) and still standing at T (not failed by T, inside its life);
- **ef**: a zone of side -d that failed by a Daily close at or before T, at most 60 calendar days before T, with no Daily
  close back through its other side between that failure and T (a failed sell zone is a buy zone and the reverse).

The signal is **inside** a zone when the sweep's extreme (the lowest low of a buy's sweep leg = stop + 2 ticks; highest high
for a sell) lies between the zone's bottom and top, both included. Classes: `in` = inside at least one eg or ef zone;
`eg` = inside at least one eg zone; `ef` = inside at least one ef zone (a signal can be both); `out` = inside neither.
Only Daily candles closed by T are read; a zone's later touch or failure is never used.

## The trade

Market entry at the open of the first 5-minute candle starting at or after the close of the H1 inversion candle. Stop = the
signal's stop (always on the losing side; a fill already at or past the stop is no trade and is counted). Target = 1R, 2R
or 3R from the fill; time exit at the close of the first 5-minute candle closing 36 hours or more after the fill. When one
candle holds both stop and target the stop counts; a candle opening past the stop or target exits at its open
(`edgekit.simulate`). Every signal is its own trade (the function already spaces them). R after costs = R - cost / risk.

## Cells (9, all fixed here) and the control (3)

Class {`in`, `eg`, `ef`} x target {1R, 2R, 3R} = 9 tested cells, five markets pooled. Beside each target the `out` stream
(the same signal outside any zone) is reported as the control, with the difference `in` minus `out` in mean R a trade
(Welch t on trades) - reported, not part of the bar.

## Pass bar (per cell)

n >= 300 in EACH window; mean R AFTER costs > 0 with a calendar-month-sum t >= 2 in BOTH windows (every calendar month of
the window from the first month with a trade of any class to the window's last month counts, empty months as 0); Holm-adjusted
one-sided p < 0.05 over the 9 cells in confirmation. Verdict: PASS if at least one cell passes all of it; INCONCLUSIVE if no
cell reaches n >= 300 in both windows; else FAIL.

## Reported

For every cell and control, in both windows: n, win share, mean R before costs and after costs, month-sum t (after costs),
the Holm p; the `in` minus `out` difference; the count of signals, of fills past the stop, and by market for the `in` 2R cell.
One run; no variant is tested after the result.
