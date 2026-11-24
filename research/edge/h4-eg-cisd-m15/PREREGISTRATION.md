# H4 engulf zone + an M15 change in the state of delivery: pre-registration

Written and committed 24 Nov 2026, before `run.mjs` is run on any real candle. Research only: nothing live changes, no rule is proposed.

## Why

The desks' engulf readings enter with a resting limit at a zone, or after a lower-timeframe engulf. None of the studies in
`research/edge/` enters on a "change in the state of delivery": the close back through the open of the first candle of the run
that carried price into a zone (searched: no folder or RESULT.md names it; the nearest are `eg-ef-choch-ladder`, `h4-ef-to-eg`,
`bigfade-choch`, which use swing breaks or failed zones). The question: does that M15 signal, taken inside an H4 engulf zone with
the zone's side, make money after costs, and is it any better than the SAME M15 signal away from every H4 zone?

## Data

OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs` `load`), markets xau, eurusd, gbpusd, usdjpy,
audusd (gold's history starts March 2006). M15 and H4 candles are UTC-aligned resamples of the 5-minute candles (`resample`).
Costs: edgekit `COSTS` (round trip in price units: xau 0.30, eurusd 0.00006, gbpusd 0.00008, usdjpy 0.008, audusd 0.00006),
charged on every trade as cost / risk.

Windows by FILL time: discovery 2005-01-01 to 2014-12-31, confirmation 2015-01-01 to 2026-10-31.

## Rules (closed candles only)

**The M15 signal (the same everywhere).** A *run* is two or more consecutive M15 candles of one colour (up: close > open; down:
close < open). Its *open* is the open of its first candle. For an up run, the SELL signal is the first M15 candle after the
run's last candle that CLOSES below the run's open, when it comes within 12 M15 candles of the run's last candle and before a
newer up run (two or more up candles) has completed; one signal a run. A down run gives the BUY signal the mirrored way. A newer
run of the same colour replaces the older one (only the latest run is watched).

- Entry: market at the open of the first 5-minute candle starting at or after the signal candle's close.
- Extreme: the highest high (sell) / lowest low (buy) of the M15 candles from the run's first candle to the signal candle.
- Stop: past the extreme by 0.1 x ATR(14) of the M15 candles closed at the signal (true range, simple mean). Always on the
  losing side; a fill already past the stop is no trade; a trade whose risk is under the round-trip cost is no trade.
- Origin of the leg: the low (sell) / high (buy) of the run's first candle.
- Exits: stop, target, or the close of the first 5-minute candle 48 hours after the fill. Stop first when one candle holds both.
- Every signal is its own trade (trades may overlap).

**Context (decided at the signal candle's close, from H4 candles closed by then).** H4 engulf zones = `zones(H4, '4h')` of
`council/eg-methods.mjs` (imported, not edited: a close beyond the high / low of the last opposite candle within three candles,
the zone = that base candle wick to wick). A zone is *standing* at moment T when it was known (`at` <= the run's first candle's
start for the zone cell, `at` <= T for the away cell) and has neither failed (an H4 close through its far side) nor outlived
its life (`end` > T).

- **zone**: a sell signal where a standing SELL zone exists such that the run's open is below the zone's bottom (the run
  started outside it) and the extreme is at or above the zone's bottom (price traded into it); a buy signal mirrored with a BUY
  zone (run's open above its top, extreme at or below its top).
- **away**: the price range from the run's first candle to the signal candle (lowest low to highest high) overlaps NO standing
  H4 engulf zone of either side.
- Signals that are neither (inside a zone of the other side, or a run that began inside a zone) are counted and left out.

## Cells (6, all fixed)

context {zone, away} x target {1R, 2R, origin}. For the origin target, the trade is taken only when the origin lies at least
0.5R beyond the fill on the winning side (else no trade in that cell; counted).

## Pass bar

Per cell: n >= 300 in each window, mean R AFTER costs > 0 with calendar-month-sum t >= 2 (months by exit time, empty months
0) in BOTH windows, and Holm-adjusted p < 0.05 (two-sided p of the month-sum t) over the 6 cells in confirmation.
Verdict PASS if a zone cell passes; FAIL otherwise; INCONCLUSIVE if every zone cell has under 300 trades in a window.

## Reported

For every cell and window: n, win share, R before costs and after costs, month-sum t of both, Holm p. For each target: zone
minus away (after costs, Welch t on trades) in each window. Per market for the zone cells. Counts of signals, left-out signals,
no-trades. A cut test (signals found on candles cut at a moment equal the signals of the full series up to it). One run; no
variants after seeing the result.
