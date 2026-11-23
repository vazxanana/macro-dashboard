# Right after an MSNR switch: fade the first pullback, take the first break, or enter on the switch (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`msnr-direction-wide` found its nearest miss at the moment of a switch: on the H4 ladder (Daily key levels) the five H4
candles after a switch leaned the call's way (+0.039 volatility units, month t 1.92 in 2015-26; +0.057, t 3.02 in 2005-14),
while the call as a standing filter carried nothing (`grid7-msnr-filter`: with against against, no difference). `grid7-wide-fade`
found that fading the first lower-timeframe structure break leans positive before costs on every market. This study joins the
two at the one moment the direction work points to: right after a switch. Does a lower-timeframe pullback that breaks
structure AGAINST a fresh call, faded (entered WITH the call), do better than the same fade when the call is old, and better
than the plain fade? Does the first break WITH a fresh call do better than one under an old call? Does entering on the switch
candle itself pay?

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, filled with `fetch-cache.mjs`), loaded
  from 2004-01-01 for warm-up. Ten markets: xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy.
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported, unchanged): 15m, 1h, 4h (UTC buckets), 1d
  (17:00 New York days).
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.
- Costs (shown beside, never part of the bar): `combo-grid-2`'s `COSTS` (round trip in price units, charged as cost / risk in
  R). Gold and the four majors are the demo account's figures; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The call and the switch

`direction(work, keyOf, htfSec)` imported from `council/eg-methods.mjs`, unchanged (`keyOf` = start of the key-timeframe
candle holding the working candle, as `grid7-msnr-filter`):

| Ladder | Working chart | Key levels | Trigger chart (two steps lower) | Time limit of a trade |
|---|---|---|---|---|
| L4 | 4h | 1d | 15m | 1 day |
| LH | 1h | 4h | 5m | 8 hours |

A **switch** = an entry of `events` (the call takes side s at the close of working candle `e.i`; the first event of a market
counts too). The call at a trigger = `call[wi]` of the last working candle CLOSED by the trigger candle's close; **age** =
`wi - e.i` of the event that set it (`last[wi]`).

## The triggers (closed candles only)

Lower-timeframe structure: `edgekit` `structure(T, 3)` on the trigger chart (a close beyond the last confirmed swing, 3 candles
a side). An event at candle j has direction d and the broken swing at index `from`.

- **(a) fade the first pullback**: after a switch to s, the FIRST trigger-chart break with d = -s whose candle starts at or after
  the switch candle's close, while the call is still s from that same switch and age <= 20. Entered WITH the call (side s).
- **(b) the first break with the call**: the same, the first break with d = s. Entered with it (side s).
- **(c) the switch candle**: side s at the first 5-minute open at or after the switch candle's close (age 0).

Age buckets for (a) and (b): **0-1**, **2-5**, **6-20** working candles. (c) has no bucket.

Entry: market, at the open of the first 5-minute candle starting at or after the trigger candle's close.

Stop (always on the losing side of the fill; a trade whose stop is not is not taken and counted):
- (a), (b): past the trigger's swing: for a long the lowest low of trigger candles `from` .. j minus 0.1 x ATR(14) of the
  trigger chart at j; a short mirrors (highest high plus 0.1 ATR).
- (c): past the tapped key level of the switch: for a buy the event's zone `bottom` minus 0.1 x ATR(14) of the trigger chart at
  the last trigger candle closed by the switch's close; a sell mirrors (`top` plus 0.1 ATR).
- A trade whose risk is under the market's round-trip cost is not taken (counted), as in `grid7-wide-fade`.

Exits (each a separate cell, all from one pass on 5-minute candles; stop first when one candle holds both; a candle that
opens past the stop or the target exits at its open; time limit by ladder, exit at that candle's close):
- **1R**, **2R**;
- **key**: the nearest opposite key level of the key timeframe: for a long the nearest A level above the fill (a turn of the
  closes on the key timeframe, 2 candles a side as in `direction()` (`DIR.K`), price = that candle's close), known by the fill
  (its right-side candles closed), not closed above by any key candle closed since it was known up to the fill, at most
  `DIR.AGE` (60) key candles old; a short mirrors with V levels below. Only when it is 1R or more away; otherwise the trade is
  not in this cell.

## Cells: 42

2 ladders x 7 trigger groups ((a) x 3 ages, (b) x 3 ages, (c)) x 3 exits.

## Controls (computed with the same code, entries, stops and exits)

- For (a): **old-call fade** = every trigger-chart break against the call while the call's age is over 20 (same switch-free
  call, unchanged), faded with the call; and **plain fade** = every trigger-chart break whatever the call, faded (the
  `grid7-wide-fade` rule, with this study's stop so the two compare).
- For (b): **old-call break** = every trigger-chart break with the call while its age is over 20, entered with it.
- For (c): **old-call entry** = one entry per call at the close of its 21st working candle after the switch (age 21), side =
  the call, stop past that call's own tapped key level as in (c).

## The bar (judged BEFORE costs)

A cell passes when ALL hold:
1. n >= 300 in each window;
2. mean R > 0 and month-sum t >= 2 in discovery AND in confirmation;
3. Holm-adjusted one-sided p (from the confirmation month t, 141 df) < 0.05 over the 42 cells;
4. it beats its control by Welch t >= 2 (trade level, cell minus control) in BOTH windows: (a) both the old-call fade and the
   plain fade; (b) the old-call break; (c) the old-call entry.

Verdict: **PASS** if any cell passes; **INCONCLUSIVE** if none passes but a cell meets 1-3 (or 2 and 4 with n under 300);
otherwise **FAIL**. Every cell is reported, per-market rows for any pass, after-cost figures beside (never part of the bar).

## Checks

- Cut test: on two markets at five dates, the signals (side, fill time, stop, age, group) known by a date, computed on candles
  cut there, equal the full run's.
- Every trade's stop is on the losing side (the run throws otherwise).
- One run, no variants. Nothing on these years is re-tested after the result.
