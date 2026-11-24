# Equal highs / lows taken by one H1 candle, entered on an M5 break back (pre-registration, 24 Nov 2026)

Written and committed alone BEFORE any run on real candles. Research only: nothing live reads it, nothing is placed, no rule
is proposed.

## Why

Two studies have looked at pools of relative equal highs / lows. `research/edge/ict-equal-lows` split one desk's own signals
by whether their sweep took a pool (FAIL, t under 1). `research/edge/equal-hl-sweep` traded the pool itself on M15 and H1:
a sweep = a close back on the pool's side within three candles of that timeframe, entered at the next 5-minute open (FAIL, 0
of 48). Neither waited for a lower-timeframe confirmation. This study is the nearest untested variation: the pool is taken
by ONE H1 candle, and the entry waits for a 5-minute close back through the last 5-minute swing made before the extreme
(a small break of structure against the sweep), with fixed 2R and 3R targets. It is compared with a single swing taken the
same way. Five markets (gold and four forex majors).

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs` `load`), from 2004-01-01 for warm-up, to
  2026-11-01. Markets (5): xau, eurusd, gbpusd, usdjpy, audusd (gold from where OANDA's history starts, March 2006).
- H1 candles = UTC hour buckets of the 5-minute candles (`resample`); daily candles = 17:00 New York trading days (`dailyNY`),
  used only for the daily ATR.
- Exclusions: `combo-grid-2` `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The event (lows, bought; highs mirror and are sold). Closed 5-minute candles only

For every H1 bucket s and each side, walk the 5-minute candles q that START inside bucket s or bucket s + 1 (the sweep hour
and the hour after), in order:

1. **The extreme so far.** X(q) = the lowest low of the 5-minute candles from the first candle of bucket s through q; xi = the
   index of the (first) 5-minute candle that made it. xi must lie inside bucket s; once a candle of bucket s + 1 makes a lower
   low, the walk for s ends with no event (that is bucket s + 1's own sweep).
2. **What was taken.** The detector of `research/edge/ict-equal-lows/eq.mjs` (imported, unchanged: `sweptSwings`, `equalPool`,
   `EQ` piv 3, look 96, tol 0.1, sep 4) on the H1 candles up to s, where candle s is given the low X(q) (the part of the hour
   seen so far, never the hour's final low): the swept swings = confirmed H1 swing lows (3 candles a side) of the last 96 H1
   candles, all their right-hand candles closed before s, untouched by every candle between them and s, below which X(q) lies.
   L = the lowest swept swing level.
   - **Pool**: `equalPool(...).eq` is true (two or more swept swings, at least 4 H1 candles apart, within 0.1 x the daily ATR of
     each other). Daily ATR = the mean high - low of the 14 New York trading days that ENDED at or before the start of bucket s.
   - **Single swing (the control)**: exactly one swept swing.
   - Two or more swept swings that are not an equal pool: neither group, no event.
3. **The confirmation.** q > xi, and candle q CLOSES above both
   - the high of the last 5-minute swing high made before the extreme: the swing high (its high above the 3 highs before it and
     at or above the 3 after it) with the largest index i such that i < xi, i >= xi - 36 (within three hours before the extreme)
     and i + 3 < q (its three right-hand candles closed before q); no such swing = no confirmation at q; and
   - L (price is back on the pool's side of the deepest swept level).

The FIRST q that meets 1-3 is the event of (s, side); one event at most per H1 bucket and side, classified (pool / single) by
what X(q) had taken at that moment. It is known at the close of candle q.

## The trade

- Market entry against the sweep at the open of the first 5-minute candle starting at or after the close of q.
- **Stop** past the extreme: X(q) - 0.1 x ATR(14) of H1 at candle s - 1 (the last H1 candle closed before the sweep hour; a sell
  mirrors). Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop is
  no trade; a risk under the market's round-trip cost is no trade (the rule of the sister studies).
- **Targets**: 2R and 3R from the fill (each its own cell). On 5-minute candles: a gap through the stop or target fills at the
  open; stop first when one candle holds both. **Time limit** 1 day from the fill, out at that 5-minute close
  (`grid7-wide-fade` `exits`, imported).
- Every event is a trade (trades may overlap); a trade still open when the data ends is not counted.
- R before costs and after costs. Costs: `combo-grid-2` `COSTS` (round trip in price units, the demo account's measured
  figures for these five markets), cost in R = cost / risk.

## Cells (6, fixed now)

Target (2R, 3R) x session by the UTC hour of the fill (all hours; London 07:00-11:59; New York 12:00-16:59), the five
markets pooled, pool events only:
`pool 2R all`, `pool 2R london`, `pool 2R ny`, `pool 3R all`, `pool 3R london`, `pool 3R ny`.

Each cell has its control: the same cell on single-swing events. Controls are not tested cells.

## The bar (all must hold for a cell to pass)

1. n >= 300 trades in discovery AND in confirmation.
2. Mean R AFTER costs > 0 and calendar-month-sum t (after costs) >= 2 in discovery AND in confirmation.
3. Holm-adjusted one-sided p (from the confirmation after-cost month-sum t) < 0.05 over the 6 cells.

Verdict: **PASS** if any cell clears all three; **INCONCLUSIVE** if no cell has n >= 300 in both windows; otherwise **FAIL**.

## Reported

Every cell: n, R a trade before costs and after costs, month-sum t (both), win rate, mean cost in R, in each window; its
control the same; Welch t of cell minus control (after costs, trade by trade) in each window; Holm p. Per market, the `all`
cells. Event counts per market (pool / single / dropped / past the stop / risk under cost / unresolved). A cut test: the
events known by five dates, computed on candles cut there, equal the full run's.

One run, no variants. A FAIL is a result; nothing here is called an edge.
