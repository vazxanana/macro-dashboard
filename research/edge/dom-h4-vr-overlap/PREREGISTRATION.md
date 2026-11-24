# H1 dominant zone inside the range at the extreme of the last H4 break (pre-registration, 24 Nov 2026)

Written and committed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

The H1 dominant-zone limit (`combo-grid-3`, `dom-zone-holdout`) is a few hundredths of an R before costs and loses after them
(`dom-tick-exec` −0.111R a filled trade on the broker's own quotes; `dom-vb-side`: the breakout's side adds nothing;
`dom-sd-choch-wide`: a lower-timeframe change of character adds nothing; `dom-filters`, `dom-placebo`, `dom-timeframes`,
`dom-exits` likewise). None of them asked WHERE the zone sits in the higher timeframe's storyline. The desk's reading puts weight
on one place: after an H4 structure break, the first range the lower timeframe makes at the extreme of that move (the first H1
break against the H4 break; the desk draws it as a box from the extreme to the level that break took). This study takes the same
H1 dominant-zone orders and asks one thing: are the orders whose zone overlaps that box better than the ones that do not?
No existing folder tests this combination (checked `research/edge/` on 24 Nov 2026: `dom-*`, `grid5-*`, `grid6-*`, `grid7-*`,
`luxus-vr-cycle`, `usdjpy-dom-ef`).

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs` `load`), five markets: xau, eurusd, gbpusd,
  usdjpy, audusd. Each window is loaded with 200 days of warm-up before it.
- Timeframes from the 5-minute candles with `combo-grid-3` `frames` (imported): 1h and 4h UTC buckets.
- Exclusions: `combo-grid-3` `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by the fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.
- Costs: `combo-grid-3` `COSTS` (the demo account's round trips), charged as cost / risk on every trade.

## The order (unchanged from `dom-zone-holdout` and the demo job; imported code, nothing edited)

- Zone: `buildZones('dom', H1)`: two consecutive closed H1 candles of one colour, the second closing beyond the first's extreme;
  the zone is the first candle's body, side = the candles' colour; it stands until an H1 close through its far side or 120 H1
  candles.
- Arming: `signalsFor(F, '1h', '5m', 'dom')`, the no-trigger signal: at the first 5-minute candle that trades into the zone
  (first and second visit), a limit at the zone's near edge, alive 12 five-minute candles.
- Stop: the zone's far side minus / plus (half the round trip + 0.25 x ATR(14) of H1 at the last H1 candle closed at the
  arming). Every order has its stop on the losing side; an order whose risk is under two round trips, or whose filled risk is
  under one, is no trade.
- Exit: a **2R** target (`multi`, slot 2R), time limit 2 days after the fill. A 5-minute candle that opens past the stop or
  target exits at its open; one that holds both is a stop; on the fill candle only the stop counts.

## The box (this study's own code, closed candles only)

1. **H4 breaks**: `edgekit.structure(H4, 3).events`: an H4 close above the last confirmed, unbroken 3-a-side swing high (below
   the last swing low for a down break), BO or change of character alike. A break is known at its H4 candle's close; its side
   is D.
2. **The move's extreme** (D = up; down mirrors): the highest high of the H1 candles from the start of the breaking H4 candle
   on, kept running.
3. **The first counter-break**: from the first H1 candle that starts at or after the H4 break's close, the first H1 candle j
   whose close is below the most recent H1 3-a-side swing low that (a) lies before the candle of the running extreme as it
   stood before j and (b) was confirmed by the close of candle j−1. The search ends, with no box, when the next H4 break closes.
4. **The box**: from that swing-low level (bottom) to the move's highest high up to and including candle j (top). Known at the
   close of j. Only the first counter-break of an H4 break makes a box.
5. **Life**: the box is current from the close of j until the earlier of (a) the next H4 break's close (it is then no longer
   the last H4 break's) and (b) the close of the first H1 candle after j that closes beyond the extreme side (above the top
   for D = up: the move went on, the range is no longer at its extreme).

## Sets

An order is classed at its arming time ts (the start of the 5-minute touch candle) by the box current at ts (known at or before
ts, not ended by ts):

- **IN**: the zone's body overlaps the box (`zone.bot <= box.top && zone.top >= box.bot`).
  - **IN-with**: the zone's side equals the H4 break's side D.
  - **IN-against**: the zone's side is the other one (the side of the counter-break).
- **OUT**: every other order (no current box, or no overlap).

## Cells (3), all at the 2R target, each pooling the five markets

IN, IN-with, IN-against.

## Pass bar

A cell passes when, in BOTH windows, n >= 300 and the mean R AFTER costs is above zero with a calendar-month-sum t >= 2, and its
Holm-adjusted one-sided p (month-sum t after costs, confirmation window, over the three cells) is under 0.05.
**PASS** = at least one cell passes. **INCONCLUSIVE** = no cell passes and no cell has 300 trades in both windows.
**FAIL** otherwise.

## Reported (not the bar)

- For every cell and for OUT and ALL, per window: n, win rate, mean R before costs and after, mean cost in R, month-sum t before
  and after costs.
- IN against OUT after costs per window (difference of means, Welch t), and the same for IN-with and IN-against.
- Per market for the three cells, the share of orders that are IN, and the same cells with the order's trailing exit
  (`multi` slot trail), context only.
- A cut check: on real candles cut at five dates, every box known before the cut is the same from the cut series and the full
  one.

One run. No variant of the box, the overlap rule or the exit is run after the result.
