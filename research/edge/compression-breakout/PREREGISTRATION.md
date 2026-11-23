# Compression breakout: does a break out of a tight range behave unlike the ordinary break? (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/grid7-wide-fade` found that the ordinary first structure break FADES: entering against it has a small tilt
before costs on ten markets and 22 years, and entering with it loses. The only rules in the repository with a passing record
are opening-range-style breakouts (the gold and USD/JPY volatility breakouts): a break out of a quiet stretch. This study asks
whether a break out of a TIGHT range (compression) behaves unlike the ordinary break: does trading WITH it beat the ordinary
break traded with, or does it fade as well? Every cell is fixed below; one run, no variants.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA` on the
  machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10, `grid7-wide-core` `MARKETS`): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy.
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m and 1h (UTC buckets), 1d (17:00 New York).
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The compression and the event (trigger timeframe T = M15 or H1; closed candles only)

ATR = `dom-trade-through` `atr14` of T. Three compression definitions:

- **n8**: the high-low range of the 8 closed candles j-8 .. j-1 is under 1.5 x ATR(14) at candle j-1. The box = that range.
- **n16**: the same with the 16 candles j-16 .. j-1.
- **inside**: candles j-3, j-2, j-1 each lie inside candle j-4 (high <= its high, low >= its low). The box = candle j-4's range.

**Event**: candle j CLOSES beyond the box (above its high: d = +1; below its low: d = -1). Candle j-1 is part of the box, so
this is the first close beyond it. Known at the close of candle j. After an event, the next event of the same definition on the
same timeframe needs its whole box to start after candle j (no overlapping episodes).

**Control (the ordinary break)**: `grid7-wide-fade`'s trigger, imported unchanged: `breaks(T)` = a close beyond the last
confirmed swing (3 candles a side), each swing broken once, with the opposite swing standing at the break.

## The trade

Market entry at the open of the first 5-minute candle starting at or after the close of candle j. Every trade has a stop on its
losing side; a fill at or beyond the stop is no trade; a risk under the market's round-trip cost is no trade (the
`grid7-wide-core` rule).

- **with** (side s = d): stop past the box's other side by 0.1 x ATR(14) of T at candle j. Control: past the opposite swing
  standing at the break by 0.1 x ATR (no opposite swing = no trade).
- **fade** (side s = -d): stop past the break candle's extreme (its high for an up break, low for a down one) by 0.1 x ATR(14)
  of T at candle j. Control: the same.
- **Exit (three)**: **1R**, **2R**, or **trail** = no target, the stop trails 1R (the opening risk) behind the best price once
  the trade has reached +1R (moved only after a 5-minute candle closes, never loosened). Stop first when one 5-minute candle
  holds stop and target; a gap through either fills at the open.
- **Time limit**: M15 1 day, H1 2 days from the fill; out at the close of the 5-minute candle that reaches it.
- Trades overlap freely.
- **Session** by the fill's UTC hour: **London** 07:00-11:59, **New York** 12:00-16:59, **other** = the rest (`grid7-wide-fade`
  `sessionOf`).
- **Daily range so far**: high minus low of the 5-minute candles of the current 17:00 New York day (`edgekit` `dailyNY`) that
  closed by the break's close, against ATR(14) of the closed daily candles: **dlow** under 0.5 x it, **dhigh** 0.5 x or more
  (with fewer than 15 closed daily candles the trade is in no daily-range cell).

## The cells (56, fixed here)

A. All sessions: 2 trigger timeframes (m15, h1) x 3 compressions (n8, n16, inside) x 2 directions (with, fade) x 3 exits
(1R, 2R, trail) = **36 cells**.

B. Splits, compression n8, exit 2R: 2 trigger timeframes x 2 directions x 5 splits (london, ny, other, dlow, dhigh) =
**20 cells**.

Each cell named `<tf> <comp> <dir> <exit> <split>` (split "all" for part A). Each cell's CONTROL is the ordinary break on the
same trigger timeframe, the same direction, exit and split (32 control cells: 12 for part A, 20 for part B).

## The bar (judged BEFORE costs)

A cell passes when ALL hold:
1. n >= 300 trades in each window;
2. mean R > 0 and month-sum t >= 2 in discovery;
3. mean R > 0 and month-sum t >= 2 in confirmation;
4. Holm-adjusted one-sided p < 0.05 over the 56 confirmation tests (p from the month-sum t, df = months - 1);
5. beats its control: Welch t (per-trade R, cell minus control) >= 2 in discovery AND in confirmation.

Verdict: **PASS** if one cell or more passes; **FAIL** otherwise. INCONCLUSIVE only if the data cannot be read (fewer than 8 of
the 10 markets load).

## Also reported (not part of the bar)

- **After costs** beside every figure: R less (round-trip cost / risk), `combo-grid-2` `COSTS` (demo figures for gold and the
  four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).
- The control cells' own figures, and every cell's Welch t against its control in both windows.
- **Per-market rows** for any passing cell.
- **Cut test**: on five dates in two markets, the events known by a date computed on candles cut there equal the full run's.

## What a result means

A pass is a before-cost tilt in both decades that also beats the ordinary break, nothing more: if the cost in R is larger than
the tilt it is not tradable and is said so. Not adopted, never called an edge, no live change. One run, no variants.
