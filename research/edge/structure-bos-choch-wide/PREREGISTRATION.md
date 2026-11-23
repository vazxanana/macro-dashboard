# Structure breaks by kind: BOS against ChoCh, three entries, ten markets (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`grid7-wide-fade` found that FADING the first structure break has a tilt before costs (and loses after them), and
`grid7-wide-core` found that trading WITH a lower-timeframe break after an H4 level loses. Neither split the break by its
kind. The question here: does the kind of break as a structure reader names it change that? A **BOS** (break of structure)
is a close beyond the last swing in the direction of the current structure; a **ChoCh** (change of character) is the first
close beyond the last swing AGAINST it. We also split by how many BOS the current leg has already made, and by whether the
break agrees with the structure of the next timeframe up, and we add a third entry: the RETEST of the broken level.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA` on the
  machine that runs it), loaded from 2004-01-01 for warm-up, to 2026-11-01.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (each from where OANDA's history
  starts).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m, 1h, 4h (UTC buckets), 1d (17:00 New York).
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Costs (reported beside, never part of the bar): `combo-grid-2` `COSTS`, the demo figures for gold and the four majors,
  **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The break (trigger timeframe T = M15, H1 or H4; closed candles only)

`edgekit` `structure(T, 3)` exactly: swings 3 candles a side (confirmed 3 candles later); a close beyond the last confirmed
swing high (low) is a break up (down), each swing broken once; the break is known at the close of its candle j.

- **Kind**: edgekit's own label. A break in the direction of the structure side before it is a **BOS**; any other (the first
  break against the side, or the first break of the series) is a **ChoCh**.
- **BOS count in the leg**: a ChoCh starts a leg; each BOS after it counts 1, 2, 3, ... until the next ChoCh. Classes
  **1st**, **2nd**, **3rd+**.
- **Next timeframe up** (M15 -> H1, H1 -> H4, H4 -> D1): edgekit `structure(U, 3).side` of the last U candle CLOSED at or
  before the break's close. **with** = that side equals the break's direction, **against** = the opposite; a side of 0 is in
  neither class.
- **Opposite swing**: the last confirmed swing of the other type standing when the break happened (for a break up of a swing
  high, the last confirmed swing low); none = no trade for the entries that need it.

## The three entries (direction d = the break's; every trade has its stop on its losing side; a fill at or beyond the stop,
or a risk under the market's round-trip cost, is no trade, the `grid7-wide-core` rule)

- **(a) with**: side s = d, market entry at the open of the first 5-minute candle starting at or after the break's close. Stop
  past the opposite swing (the swing before the break) by 0.1 x ATR(14) of T at candle j.
- **(b) fade**: side s = -d, same fill. Stop past the break candle's extreme (its high for a break up, low for a break down) by
  0.1 x ATR(14) of T at candle j (the `grid7-wide-fade` "ext" stop).
- **(c) retest**: side s = d. On the timeframe L one step lower (M15 -> M5, H1 -> M15, H4 -> H1), from the first L candle
  starting at or after the break's close: the **touch** = the first L candle that trades back to the broken level (low <= level
  for a break up, high >= level for a break down), within 24 T candles of the break. From the touch candle on (itself
  included), the **confirmation** = the first L candle that closes beyond the level in the break's direction AND closes in that
  direction (c > o for up, c < o for down), within 12 L candles of the touch. The setup is cancelled if, before the
  confirmation, an L candle closes beyond the opposite swing (where the stop would be). Market entry at the open of the first
  5-minute candle starting at or after the confirmation candle's close. Stop as (a): past the opposite swing by 0.1 x ATR(14)
  of T at candle j.

## Exits

**1R** or **2R**; stop first when one 5-minute candle holds stop and target; a gap through either fills at the open. Time
limit from the fill: M15 1 day, H1 2 days, H4 5 days; out at the close of the 5-minute candle that reaches it. Trades overlap
freely (no one-at-a-time rule).

## The cells (51, fixed here)

A. By kind, per timeframe: 3 timeframes (m15, h1, h4) x 3 entries (with, fade, retest) x 2 kinds (BOS, ChoCh) x 2 exits
(1R, 2R) = **36 cells**, named `<tf> <entry> <kind> <exit>`.

B. By BOS count, the three timeframes pooled, 1R: 3 entries x 3 counts (1st, 2nd, 3rd+) = **9 cells**, named
`all <entry> bos-<count> 1R`.

C. By the next timeframe up, both kinds, the three timeframes pooled, 1R: 3 entries x 2 (with, against) = **6 cells**, named
`all <entry> htf-<with|against> 1R`.

## The control (one per cell)

The plain `grid7-wide-fade` rule on the same timeframe and exit: fade EVERY break (either kind, no context), stop past the
break candle's extreme by 0.1 ATR, the same exits and time limits as above (H4 is computed here with the same rule; M15 and H1
are the same rule as `grid7-wide-fade`'s "none ext" cells). For B and C the control is that rule pooled over the three
timeframes at 1R.

## The bar (judged BEFORE costs)

A cell passes when ALL hold:
1. n >= 300 trades in each window;
2. mean R > 0 and calendar-month-sum t >= 2 in discovery;
3. mean R > 0 and month-sum t >= 2 in confirmation;
4. Holm-adjusted one-sided p < 0.05 over the 51 confirmation tests (p from the month-sum t, df = months - 1);
5. it beats its control: Welch t (per trade, cell R against control R) >= 2 in discovery AND in confirmation.

Verdict: **PASS** if one cell or more passes; **FAIL** otherwise. INCONCLUSIVE only if fewer than 8 of the 10 markets load.

## Also reported (not part of the bar)

Every cell with n, mean R, month t, after-cost mean beside, the control's figures and the Welch t; per-market rows for any
passing cell; a cut test (signals known by five dates computed on candles cut there equal the full run's).

One run, no variants. Nothing that comes out of it is called an edge without n and t, and nothing is adopted.
