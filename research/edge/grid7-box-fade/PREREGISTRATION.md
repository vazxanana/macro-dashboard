# Box grid: the swing box's close-out traded with it, faded, and its false break, on ten markets (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/grid7-wide-fade` found that FADING the first structure break at market has a small tilt before costs in both
2005-14 and 2015-26 on ten markets (M15, ATR stop, 2R: +0.054R / +0.042R a trade, month t 11.4 / 11.3), and that trading WITH
the break loses. The owner reads price with a box: from the last confirmed swing low to the last confirmed swing high, closed out
when a candle closes beyond it. This study asks whether the box adds anything to the plain fade: does trading the box's close-out
(with it, or against it) or its false break, in a given box size and higher-timeframe box state, beat the plain fade rule on the
same timeframe and exit? Every cell is fixed below; nothing is picked after the run.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA` on the
  machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (gold and silver from where OANDA's
  history starts).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m, 1h, 4h (UTC buckets).
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The box (trigger timeframe T = M15 or H1; closed candles only)

`edgekit` `boxesHL(T, 2)` (imported, never edited): a swing high / low = a high above the 2 highs before it and at or above the 2
after it (a low mirrors), known 2 candles later. The box runs from the last confirmed swing low to the last confirmed swing high
(its edges are those two prices, fixed), from the candle that confirms the later of the two; it **closes out** at the first
later candle that CLOSES above the high (direction d = +1) or below the low (d = -1). The next box takes the next swing high and
low both made after the later swing of the box before. Box size = (high - low) / ATR(14) of T at the event candle.

## The three events

- **(a) close-out, WITH**: the close-out candle j. Side s = d.
- **(b) close-out, FADED**: the same candle j. Side s = -d.
- **(c) false break**: for one edge of a box (the high: d = +1; the low: d = -1), the FIRST of (i) a candle after the box
  started, while the box stands, whose wick trades beyond the edge and whose close stays inside the box, or (ii) a close-out
  candle followed, within the next 2 candles, by a candle that closes back inside the box's range (at or below the high for
  d = +1; at or above the low for d = -1). The event candle j is the one that closes inside. Side s = -d (back into the box).
  At most one false break per edge of a box.

Every event is known at the close of candle j. Entry at market at the open of the first 5-minute candle starting at or after
that close. Every trade has a stop on its losing side; a fill at or beyond the stop is no trade.

## Stops and exits

- **Stop**: (a) WITH: past the box's other side (the low for an up close-out, the high for a down one) by 0.1 x ATR(14) of T at
  candle j; (b) and (c): past the extreme of the break (b: the close-out candle's high / low; c: the highest high / lowest low
  of the candles beyond the edge, from the first candle that went beyond to candle j) by 0.1 x ATR(14) of T at candle j.
- **Exits**: **1R**, **2R**, or **box** = the box's other side (the low when shorting after an up break, the high when buying
  after a down break), taken only when it is 1R or more from the fill (else no trade in that cell). For (a) WITH the box's other
  side is behind the stop, so (a) has 1R and 2R only.
- Stop first when one 5-minute candle holds stop and target; a gap through either fills at the open
  (`grid7-wide-fade` `exits`, imported). Time limit: M15 1 day, H1 2 days from the fill (the fade study's).
- Trades overlap freely; a trade whose risk is under the market's round-trip cost is no trade (the `grid7-wide-core` rule).

## Context (judged at the close of candle j)

- **Size**: **small** = box size < 2 ATR; **large** = 2 ATR or more.
- **Higher-timeframe box** (H1 for M15, H4 for H1; `boxesHL(·, 2)` on that timeframe, its closed candles only, the last one
  closed at or before the event's close): **in** = a higher box stands (formed and not closed out); **same** = no box stands and
  the last higher close-out was in the event's direction d; **other** = the last higher close-out was against d. No higher box
  yet = in none of the three.

## The cells (46, fixed here)

A. All contexts (16): for each of M15 and H1: with 1R, with 2R; fade 1R, fade 2R, fade box; false 1R, false 2R, false box.

B. By context, exit 1R (30): for each of M15 and H1, each event (with, fade, false), each context (small, large, htf-in,
htf-same, htf-other).

Names: `<tf> <event> <exit> <context>` with tf m15 / h1, event with / fade / false, exit 1R / 2R / box, context all / small /
large / htf-in / htf-same / htf-other. E.g. "m15 fade box all", "h1 false 1R htf-other".

## Control (not a cell; one per timeframe and exit)

The plain `grid7-wide-fade` rule on the same timeframe: every first structure break (`grid7-wide-fade` `breaks`, 3 candles a
side, imported), faded at market at the next 5-minute open, stop past the break candle's extreme + 0.1 ATR(14) ("ext"), exit
1R, 2R or the opposite swing ("swing"), same time limit, same cost rule, same exclusions. A cell's control: same timeframe, and
exit 1R -> 1R, 2R -> 2R, box -> swing (the structural target of each).

## The bar (judged BEFORE costs, on calendar-month sums of R)

A cell passes when ALL hold:
1. n >= 300 trades in each window;
2. mean R > 0 and month-sum t >= 2 in discovery;
3. mean R > 0 and month-sum t >= 2 in confirmation;
4. Holm-adjusted one-sided p < 0.05 over the 46 confirmation tests (p from the month-sum t, df = months - 1);
5. it beats its control: Welch t (per-trade R, cell minus control) >= 2 in discovery AND in confirmation.

Verdict: **PASS** if one cell or more passes; **FAIL** otherwise. INCONCLUSIVE only if the data cannot be read (fewer than 8 of
the 10 markets load).

## Also reported (not part of the bar)

- **Every cell** with n, mean R, month t in both windows, after costs beside, its control and the Welch t against it.
- **The side-flipped check**: every cell and control traded the other way (same fill, the stop at the same distance on the other
  side, targets at the same distances in R).
- **After costs**: R less (round-trip cost / risk), `combo-grid-2` `COSTS` (the demo figures for gold and the four majors;
  **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).
- **Per-market rows** for any passing cell.
- **Cut test**: on five dates in two markets, the events known by a date computed on candles cut there equal the full run's.

## What a result means

A pass is a before-cost tilt in both decades that the box adds to the plain fade, nothing more: never called an edge, no live
change; a forward record would need the owner. One run, no variants.
