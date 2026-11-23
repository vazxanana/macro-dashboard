# Equal highs / lows: the sweep and the break of a pool (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/ict-equal-lows` asked whether an ICT A-setup did better when its sweep took a pool of relative equal lows / highs
(FAIL, t under 1). That was a split of one desk's signals. This study asks the plainer question on its own events, with the same
equal-pool detector and the wide design of `grid7-wide-core` / `grid7-wide-fade` (ten markets, 22 years, discovery and
confirmation, judged before costs on month sums): when a pool of two or more equal swings is SWEPT (taken by a wick, price closes
back), does trading back against the sweep make money before costs; when the pool is BROKEN (taken by a close), does trading
with the break; and in both cases, does an equal pool do better than one single swing taken the same way?
`grid7-wide-fade` found a before-cost tilt for fading the first structure break; the control below separates "a pool of equal
swings" from "any swing taken".

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`), loaded from
  2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (from where OANDA's history starts).
- Timeframes built with `combo-grid-3`'s `frames` (imported): 15m and 1h (UTC buckets); the daily candle (17:00 New York) only
  for the daily ATR.
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The pool (timeframe T = M15 or H1; closed candles only)

The detector of `research/edge/ict-equal-lows/eq.mjs` (imported, unchanged: `sweptSwings`, `equalPool`, `EQ` piv 3, look 96,
tol 0.1, sep 4), run on every candle s of T, for lows (side +1) and highs (side -1, mirrored):

- the swept swings of candle s = confirmed swing lows (3 candles each side with no lower low) of the last 96 candles, whose
  right-hand candles all closed before s, untouched by every candle between them and s, that candle s trades below;
- the daily ATR = the mean high - low of the 14 daily candles (17:00 New York) that CLOSED at or before the close of candle s
  (this study's own copy, judged on the candle's end time, so a day that is not over is never read);
- **equal pool**: `equalPool(...).eq` (two or more swept swings, at least 4 candles apart, within 0.1 x daily ATR of each other);
  its size = `pool` (2, or 3 or more);
- **single swing (the control)**: exactly one swing swept by candle s (`sweptSwings` returns one);
- candles that sweep two or more swings that are not equal are in neither group.

Pool level L = the deepest swing swept by candle s (the lowest for lows, the highest for highs). Range edge = the highest high
(lowest low for highs) of the candles from the earliest swept swing to s - 1.

## The events (decided on candles s, s+1, s+2 only)

- **Break**: the first of s, s+1, s+2 that closes beyond L (below for lows) before any of them closes back on the pool's side
  (above L). The pool is taken by a close. Trade WITH the break (short for lows).
- **Sweep**: the first of s, s+1, s+2 that closes back on the pool's side (above L for lows) before any of them closes beyond
  L. The pool was taken by a wick and price came back. Trade AGAINST the sweep (long for lows).
- Neither within s..s+2: no event. The event candle k is the candle that decided it; the event is known at the close of k.

## The trade

- Entry at market at the open of the first 5-minute candle starting at or after the close of k.
- Stop: **sweep** = past the sweep's extreme (the lowest low of s..k for lows) by 0.1 x ATR(14) of T at k; **break** = 1 x ATR(14)
  of T at k from the fill, on the losing side. Every trade has its stop on the losing side of the fill (the run throws
  otherwise); a fill at or past the stop, or a risk under the market's round-trip cost, is no trade.
- Exits (each a separate cell): **1R**, **2R**, **range**: the sweep's target is the range edge (the top of the range the pool
  formed, for lows); the break's is the measured move, L minus (range edge - L) for lows. A range target is used only when it is
  1R or more from the fill on the winning side; otherwise that trade is not in the range cell.
- Time limit: 1 day (M15) or 2 days (H1), then out at that 5-minute close. On 5-minute candles: a gap through the stop or
  target fills at the open; stop first when one candle holds both.
- No one-position rule: every event is a trade (as `grid7-wide-fade`); a trade still open when the data ends is not counted.
- R before costs. After costs beside: `combo-grid-2` `COSTS` (round trip in price / risk). **ASSUMED, not measured** for xag,
  nzdusd, usdcad, usdchf, eurjpy.

## Cells (48, fixed now)

- Sweep: 2 timeframes (M15, H1) x pool size (2, 3+) x session (London 07-12, New York 12-17, other; UTC hour of the fill) x
  3 exits = 36.
- Break: 2 timeframes x pool size x 3 exits, all sessions = 12.

Each cell has its control: the same event type, timeframe, session (sweep) or all sessions (break) and exit, on single-swing
events. Controls are not tested cells.

## The bar (all must hold for a cell to pass)

1. n >= 300 trades in discovery AND in confirmation.
2. Mean R > 0 and month-sum t >= 2 before costs in discovery AND in confirmation.
3. Holm-adjusted one-sided p (from the confirmation month-sum t) < 0.05 over the 48 cells.
4. Beats its control: Welch t (trade-level R, cell vs control) >= 2 in discovery AND in confirmation.

Verdict: **PASS** if one or more cells pass; **FAIL** if none; **INCONCLUSIVE** if fewer than 8 markets could be run. One run, no
variants. Every cell is reported (with the control and after-cost figures); per-market rows for any cell that passes.

## Checks

- Cut test: on five dates for two markets, the events known by the date, computed on candles cut there, equal the full run's.
- Every trade's stop on the losing side (asserted).

## What it is not

A before-cost pass is a tilt, not something to trade: the after-cost column decides that, and nothing live changes from this
study. It measures a mechanical detector of equal pools, not a pool chosen by eye.
