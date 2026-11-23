# Round-number breaks: trading with, fading and failed crosses of round numbers on ten markets (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/grid7-wide-fade` found that fading the first M15 structure break at market has a small tilt before costs in
both 2005-14 and 2015-26 on ten markets (and on eight new markets, `fade-new-markets`), while trading WITH the break loses.
Round numbers are the most widely watched levels and are not tied to any swing. This study asks: does a 15-minute close beyond
a round number, traded with it or faded, or a wick through it that closes back (a failed cross), do better before costs than
the plain fade of a structure break at the same times (and, for trading with the cross, than a cross of a level of the same
spacing that is NOT round)? Every cell, split and control is fixed below; one run, no variants.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, filled with `fetch-cache.mjs`,
  `EDGE_DATA` on the machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (gold and silver from where OANDA's
  history starts). Pooled.
- M15 candles from the 5-minute candles with `combo-grid-3`'s `frames` (imported; UTC buckets). ATR = `dom-trade-through`'s
  `atr14` on M15 (imported).
- Exclusions: `combo-grid-2`'s `exclusions(market)` (the data-quality audit's bad intervals); a trade whose fill falls in one is
  dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31** (142
  months). Month sums count every calendar month of the window, an empty month as 0 (`grid7-wide-core` `mstat`).

## The levels (fixed)

A round level is an integer multiple of the SMALL step; it is **big** when it is also a multiple of the BIG step, else **small**.

| Market | small step | big step |
|---|---:|---:|
| eurusd, gbpusd, audusd, nzdusd, usdcad, usdchf | 0.0050 | 0.0100 |
| usdjpy, eurjpy | 0.50 | 1.00 |
| xau | 10 | 50 |
| xag | 0.50 | 1.00 |

So forex "00" levels are big and "50" levels small; gold $50 levels big and other $10 levels small; silver whole dollars big and
half dollars small.

## The events (M15, closed candles only)

Candle j, previous candle j-1, ATR a = ATR(14) of M15 at candle j (needs a > 0).

- **(a) / (b) Close beyond.** The close of j is on the other side of a round level L from the close of j-1, strictly
  (c(j-1) < L < c(j) for up, mirrored for down). When one candle crosses several levels, the farthest one crossed is the event's
  level (one event per candle). Known at the close of j. Direction d = +1 (up) / -1 (down).
- **(c) Failed cross.** An up probe: c(j-1) < L, where L is the nearest round level above c(j-1); h(j) >= L + 0.2 a; and the
  previous candle had not already probed it (h(j-1) < L + 0.2 a). It is a failed cross when a close back below L comes at candle
  j or at candle j+1 (j+1 counts also when j closed above L); the event candle k is that candle and the event is known at its
  close. Down probes mirror it. The trade is back the other way (sell after an up probe).

## The trade

Market entry at the open of the first 5-minute candle starting at or after the event's close. Every trade has a stop on its
losing side; a fill at or past the stop, or a risk under the market's round-trip cost, is no trade (the `grid7-wide-fade` rule).

- **(a) WITH**: side s = d. Stop 1 x ATR from the fill.
- **(b) FADE**: side s = -d. Stop past the event candle's extreme (its high after an up close) + 0.1 x ATR.
- **(c) FAILED CROSS**: side back (sell after an up probe). Stop past the extreme of candles j..k (the probe high) + 0.1 x ATR.
- **Exits (two)**: **1R** and **2R** targets. Stop first when one 5-minute candle holds stop and target; a gap through either
  fills at the open (`grid7-wide-fade` `exits`, imported). Time limit 1 day from the fill (out at the close of the 5-minute
  candle that reaches it). Trades overlap freely.

## The splits

- **Size**: big level vs small level.
- **Order**: **first** = no earlier M15 candle of the same UTC day (by candle start) crossed that level by its close (close to
  close, either direction); **later** otherwise. For (c) the day and the check are those of the probe candle j.
- **Session** by the fill's UTC hour: **London** 07:00-11:59, **New York** 12:00-16:59, **other** the rest.

## The cells (48, fixed here)

3 events (with, fade, failed) x 8 groups (all, big, small, first, later, london, ny, other) x 2 exits (1R, 2R) = **48 cells**,
named `<event> <group> <exit>`, e.g. `fade big 2R`, `failed first 1R`, `with ny 1R`:

- with: all / big / small / first / later / london / ny / other, each 1R and 2R (16)
- fade: the same (16)
- failed: the same (16)

## The controls (fixed here)

- **(b) fade and (c) failed cross**: the plain `grid7-wide-fade` M15 rule (fade the first M15 structure break, `breaks(M15)`
  imported, stop past the break candle's extreme + 0.1 ATR, the same exit and time limit). Matched times: for each event trade,
  the control trade is the fade-rule trade of the same market whose fill is nearest in time, within 24 hours (no control: the
  event has none and leaves the comparison only). A control trade may serve more than one event.
- **(a) with**: the same WITH trade on a level grid of the same spacing that is not round: the levels shifted by 0.23, 0.41,
  0.59 and 0.77 of the small step (four grids, pooled), with the same events, splits (big = shifted big step), stop and exit.

## The bar (judged BEFORE costs)

A cell passes when ALL hold:
1. n >= 300 trades in each window;
2. mean R > 0 and month-sum t >= 2 in discovery;
3. mean R > 0 and month-sum t >= 2 in confirmation;
4. Holm-adjusted one-sided p < 0.05 over the 48 confirmation tests (p from the month-sum t, df = months - 1);
5. it beats its control: event mean R minus control mean R with Welch t >= 2 in discovery AND in confirmation (trade-level
   Welch t; for fade / failed the matched control trades, for with the four shifted grids pooled).

Verdict: **PASS** if one cell or more passes; **FAIL** otherwise. INCONCLUSIVE only if the data cannot be read (fewer than 8 of
the 10 markets load).

## Also reported (not part of the bar)

- **After costs** beside every figure: R less (round-trip cost / risk), `combo-grid-2` `COSTS` (the demo figures for gold and the
  four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).
- The shifted-grid control for fade and failed too, and the control's own mean R and month t.
- **Per-market rows** for any passing cell.
- **Cut test**: on five dates in two markets, the events known by a date computed on candles cut there equal the full run's.

## What a result means

A pass is a before-cost tilt in both decades that round numbers add over the plain fade (or over non-round levels), nothing
more: if the cost in R is larger than the tilt it is not tradable and is said so. Not adopted, never called an edge, no live
change. One run, no variants on these years.
