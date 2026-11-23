# Wide fade grid: fading the first structure break on ten markets (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/grid7-wide-core` entered WITH a lower-timeframe structure break after an H4 level and lost before costs in both
windows (engulf zone, M15 break, 1R: -0.031R a trade, month t -5.02 in 2005-14 and -3.56 in 2015-26), and its side-flipped
placebo cleared bars 1-3 in 10 cells, including the plain control "M15 break with no level". The same pattern appeared in
`grid6-box-in-box`, `grid6-mosha-market` and `grid6-dom-confirm`. This study asks the general question directly, with few cells
and 22 years of data: does FADING the first structure break (entering against it) make money before costs, and how far is it
from tradable after costs? A separate study (`fade-breaks-holdout`) tests picked placebo cells on held-out data; this one does
not pick from them, every cell is fixed below.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA` on the
  machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (gold and silver from where OANDA's
  history starts).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m, 1h, 4h (UTC buckets), 1d (17:00 New York).
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The break (trigger timeframe T = M5, M15 or H1; closed candles only)

`edgekit` `structure(T, 3)`: a close beyond the last confirmed swing (3 candles a side, confirmed 3 candles later); each swing is
broken once. The event's candle j closes beyond the level; its direction d = +1 (up) or -1 (down). The break is known at the
close of candle j.

## Context (two)

- **none**: every structure event on T.
- **h4eg**: `grid7-wide-core`'s engulf-zone family on H4 (`combo-grid-3` `buildZones('eg', F['4h'])`, imported): the first T
  candle at or after the zone is known that trades into it (first touch only), then the FIRST structure event on T of the zone's
  side within 24 T candles (and before the zone ends). That is the break WITH the level, and this study fades it. The same
  T candle and direction is used once even when two zones point at it.

## The trade (the FADE)

Side s = -d (against the break). Market entry at the open of the first 5-minute candle starting at or after the close of
candle j. Every trade has a stop on its losing side; a fill at or beyond the stop is no trade.

- **Stop (two)**: **ext** = past the break candle's extreme (its high for an up break, low for a down break) by 0.1 x ATR(14)
  of T at candle j; **atr** = 1 x ATR(14) of T from the fill.
- **Exit (three)**: **1R**, **2R**, or **swing** = the opposite swing of the broken one (for an up break of a swing high, the last
  confirmed swing low standing when the break happened); a swing target not on the winning side of the fill, or none, is no
  trade in that cell. Stop first when one 5-minute candle holds stop and target; a gap through either fills at the open.
- **Time limit**: M5 8 hours, M15 1 day, H1 2 days from the fill; out at the close of the 5-minute candle that reaches it.
- Trades overlap freely (no one-at-a-time rule); a trade whose risk is under the market's round-trip cost is no trade (the
  `grid7-wide-core` rule, same in every cell).
- **Session** by the fill's UTC hour: **London** 07:00-11:59, **New York** 12:00-16:59, **other** = the rest.

## The cells (54, fixed here)

A. All sessions: 3 trigger timeframes (M5, M15, H1) x 2 contexts (none, h4eg) x 2 stops (ext, atr) x 3 exits (1R, 2R, swing)
= **36 cells**.

B. By session: 3 trigger timeframes x 2 contexts x 3 sessions (London, New York, other), stop ext, exit 1R = **18 cells**.

Every cell named `<tf> <ctx> <stop> <exit> <session>` (session "all" for part A):

- m5 none ext 1R all; m5 none ext 2R all; m5 none ext swing all; m5 none atr 1R all; m5 none atr 2R all; m5 none atr swing all
- m5 h4eg ext 1R all; m5 h4eg ext 2R all; m5 h4eg ext swing all; m5 h4eg atr 1R all; m5 h4eg atr 2R all; m5 h4eg atr swing all
- m15 (the same 12), h1 (the same 12)
- m5 none ext 1R london / ny / other; m5 h4eg ext 1R london / ny / other; and the same six for m15 and h1.

## The bar (judged BEFORE costs, on calendar-month sums of R)

A cell passes when ALL hold:
1. n >= 300 trades in each window;
2. mean R > 0 and month-sum t >= 2 in discovery;
3. mean R > 0 and month-sum t >= 2 in confirmation;
4. Holm-adjusted one-sided p < 0.05 over the 54 confirmation tests (p from the month-sum t, df = months - 1).

Verdict: **PASS** if one cell or more passes; **FAIL** otherwise. INCONCLUSIVE only if the data cannot be read (fewer than 8 of
the 10 markets load).

## Also reported (not part of the bar)

- **The mirror**: every cell traded WITH the break (side d, same fill, the stop at the same distance on the other side, targets
  at the same distances in R; for 1R it is exactly the fade's mirror). Expected to be the fade's mirror image; shown so the owner
  sees it.
- **After costs** beside every figure: R less (round-trip cost / risk) per trade, `combo-grid-2` `COSTS` (the demo figures for
  gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).
- **Cost in R by market**: mean (cost / risk) of the trades per trigger timeframe and stop, so the owner sees how far a pass
  before costs is from tradable.
- **Per-market rows** for any passing cell.
- **Cut test**: on five dates in two markets, the signals known by a date computed on candles cut there equal the full run's.

## What a result means

A pass is a before-cost tilt in both decades, nothing more: if the cost in R is larger than the tilt, it is not tradable and is
said so. Not adopted, never called an edge, no live change; a forward record would need the owner. One run, no variants.
