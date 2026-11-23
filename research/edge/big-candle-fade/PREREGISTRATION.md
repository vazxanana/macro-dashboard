# Big-candle fade: is the fade a reaction to an outsized candle rather than to a break? (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/grid7-wide-fade` found that fading the first structure break at market has a tilt before costs in both
2005-14 and 2015-26 on ten markets (22 of 54 cells passed before costs; none survives costs). A structure break is often made by
one large candle. This study asks whether the tilt belongs to the SIZE of the candle (an outsized move that gives part of itself
back) rather than to the break: if the fade of a big candle beats the plain fade of every break, size is the better trigger; if
big candles that are NOT breaks also fade, the break is not needed.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA`), loaded
  from 2004-01-01 for warm-up.
- Markets (10, the same as `grid7-wide-fade`): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy.
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m and 1h (UTC buckets).
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0 (`grid7-wide-core` `mstat`, imported).
- Costs (after costs beside, not part of the bar): `combo-grid-2` `COSTS`, the demo figures for gold and the four majors;
  **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The signal (trigger timeframe T = M15 or H1; closed candles only)

- A closed candle j of T with |close - open| > k x ATR(14) of T, the ATR taken on the 14 candles BEFORE j (`dom-trade-through`
  `atr14` at index j-1, so the candle does not size itself); k = **1.5, 2 or 3** (a larger k is a subset of a smaller one).
- Its direction d = +1 for a bullish body, -1 for a bearish one. Known at the close of candle j.
- **Split (two)**: **break** = candle j is a structure event of `edgekit` `structure(T, 3)` in the direction d (the same events as
  `grid7-wide-fade` `breaks`, which the run imports); **nobreak** = it is not (no event at j, or an event the other way).

## The trade (the FADE)

Side s = -d (against the candle). Market entry at the open of the first 5-minute candle starting at or after the close of
candle j. Every trade has a stop on its losing side; a fill at or beyond the stop is no trade.

- **Stop**: past the candle's extreme (its high for a bullish candle, its low for a bearish one) by 0.1 x the same ATR.
- **Exit (three)**: **1R**, **2R**, or **half** = back to the candle's 50 % (the middle of its high-low range), taken only when it
  is 1R or more away from the fill on the winning side; otherwise no trade in that cell. Stop first when one 5-minute candle
  holds stop and target; a gap through either fills at the open (`grid7-wide-fade` `exits`, imported).
- **Time limit**: M15 1 day, H1 2 days from the fill (the `grid7-wide-fade` limits); out at the close of the 5-minute candle
  that reaches it.
- Trades overlap freely; a trade whose risk is under the market's round-trip cost is no trade (the `grid7-wide-core` rule).

## The cells (36, fixed here)

2 trigger timeframes (m15, h1) x 3 sizes (k1.5, k2, k3) x 2 splits (break, nobreak) x 3 exits (1R, 2R, half) = **36 cells**,
named `<tf> k<k> <split> <exit>`, e.g. `m15 k2 break 1R`, `h1 k3 nobreak half`.

## The comparison rule (the plain fade, not a cell)

For each timeframe and exit: `grid7-wide-fade`'s plain rule = fade EVERY structure event of `structure(T, 3)` on T, stop past
the break candle's extreme by 0.1 x ATR(14) of T at the break candle (its own definition), the same exits (1R, 2R, and for
"half" the break candle's 50 % when 1R or more away), the same fill, time limit, cost floor and exclusions. Computed in this run
with `grid7-wide-fade`'s own `breaks` and `exits`. For 1R and 2R it is exactly that study's "<tf> none ext 1R / 2R all" cell.

## The bar (judged BEFORE costs)

A cell passes when ALL hold:
1. n >= 300 trades in each window;
2. mean R > 0 and month-sum t >= 2 in discovery;
3. mean R > 0 and month-sum t >= 2 in confirmation;
4. Holm-adjusted one-sided p < 0.05 over the 36 confirmation tests (p from the month-sum t, df = months - 1);
5. it beats the plain fade on the same timeframe and exit: Welch t (per trade, cell mean minus plain mean) >= 2 in BOTH windows.

Verdict: **PASS** if one cell or more passes; **FAIL** otherwise. INCONCLUSIVE only if fewer than 8 of the 10 markets load.

## Also reported (not part of the bar)

- **The mirror**: every cell traded WITH the candle (side d, same fill, the stop at the same distance on the other side, targets
  at the same distances in R).
- **After costs** beside every figure: R less (round-trip cost / risk) per trade; the mean cost in R per cell.
- **The plain fade** rows themselves (both windows, before and after costs).
- **Per-market rows** for any passing cell.
- **Cut test**: on five dates in two markets, the signals known by a date computed on candles cut there equal the full run's.

## What a result means

A pass is a before-cost tilt in both decades that is larger than the plain fade's, nothing more: if the cost in R is larger than
the tilt it is not tradable and is said so. Not adopted, never called an edge, no live change. One run, no variants.
