# Pre-registration: gold-ny-impulse-pullback, the first pullback after gold's New York 08:30 impulse

Written and pushed on 14 Nov 2026 before any trade of this rule was computed. Paper research only.

## What this is, and what it is not

A **new stand-alone intraday rule** on spot gold. It is **not a gate, exit, entry or size of the live gold book** (Gold trend +
Gold daily engulf): none of that book's records or positions is read (owner decision 44), and nothing here can change it.
Nothing live changes whatever the result; a pass would at most be a proposal for the owner with its own forward record.

The idea: the 08:30-09:00 New York half hour (US data time) often makes a one-way impulse in gold. Traders say the first
pullback into the middle of that impulse is bought (sold) by the flow that made it. The rule enters at the 50 % retrace of the
impulse, with the impulse, and is both-sided by construction (up impulses give buys, down impulses give sells).

## Not already tested (checked before writing this)

- `gold-comex-orb`: a breakout of the 08:20-08:50 New York range. A breakout, not a retrace entry with the impulse.
- `gold-ote-retrace`: a limit at the 0.705 retrace of an H1 structure-break leg at any hour. Another leg, another hour, another level.
- `gold-intraday-momentum`, `intraday-momentum`, `metals-intraday-momentum`: first half hour to last half hour. No pullback entry.
- `gold-london-reversal`, `gold-late-ny`: fades or follows whole session moves at fixed times. No retrace entry.
- `gold-vwap`, `gold-h1-bb-fade`, `gold-hourly-shock`: reversion to a mean or after a shock. Against the move, not with it.
- `nfp-follow`, `cpi-follow`: the first minutes' direction on release days only, entered at market.
- `gold-h4-pullback-resume`: H4 pullbacks in an H4 trend. Another timeframe, no session impulse.

## Data

OANDA mid XAU/USD M5 candles, 2006-11 to 2026-11 (keyless candle proxy, kept outside git), `[unixSec, o, h, l, c]`. Times are
UTC; New York time is computed with the US daylight rule in force since 2007 (second Sunday of March to first Sunday of
November): 08:30 New York = 12:30 UTC in daylight time, else 13:30 UTC.

Market set: XAU/USD only, fixed here before any result.

## The rule (one trade a day at most)

- **Day**: a New York weekday (Monday-Friday).
- **Impulse window**: the six M5 candles starting 08:30, 08:35, ..., 08:55 New York. Skipped if fewer than 5 exist.
- **Direction**: d = +1 if the close of the window's last candle is above the open of its first, -1 if below; skipped if equal.
- **Leg**: up: extreme E = highest high in the window, origin O = lowest low among the window's candles up to and including the
  candle that made E. Down mirrored (E = lowest low, O = highest high up to it). L = |E - O|.
- **Size filter**: L >= 0.25 x ATR(14), ATR = true-range average of the 14 previous complete UTC days built from the same M5
  candles (strictly earlier days). Skipped without 14 earlier days.
- **Order**: at 09:00 New York a limit at the 50 % retrace M = E - d x 0.5 x L, live on the candles starting 09:00 to 10:55
  New York. The leg is frozen at 09:00 (it does not move with later highs or lows).
- **Fill**: a buy limit fills at M when a candle's low reaches it, or at the candle's open when it opens below M; sell mirrored.
  If the fill price is already at or beyond the stop, the day is skipped (no trade).
- **Stop**: O - d x $0.30 (beyond the impulse's origin). **Every trade has this stop.** 1R = |fill - stop|.
- **Management**: in the fill candle only the stop is checked (a stop reached there counts; a target there does not). Later
  candles: a gap through the stop fills at the open; stop and target in one candle = the stop.
- **T1 (primary)**: target 1.5R from the fill, else out at the close of the 15:55 New York candle (16:00 New York).
- **T2**: target = the impulse extreme E (the retest), else out at 16:00 New York.
- **T3**: T1, only on days with L >= 0.5 x ATR(14) (a large impulse; the same days' trades are a subset of T1).

## Costs

$0.60 a round trip per ounce on every trade (spread and slippage together), taken off in R as 0.60 / 1R; 2x ($1.20) reported
and used in the pass bar. Financing: buys pay `nights(fill, exit) x FIN.xau.long x fill / 1R` (`council/fills.mjs`, the demo
broker's XAUUSD swap of 11 Nov 2026); every trade is flat by 16:00 New York, before the rollover, so this is zero by
construction, and the code checks it. Sells are charged nothing.

## Windows

In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to the last complete day of the data (2026-11). OOS halves
2017-2021 and 2022-now are reported (not in the pass bar).

## Statistics

- t on calendar-month sums of net R (one value per month). One-sided p from the normal; Holm across T1, T2, T3.
- Placebo, 40 seeds (1..40): on each day the test traded out of sample, enter at market at the open of a random M5 candle
  starting 09:00-10:55 New York, **on the impulse's side** (an unconditional same-side entry, same window), stop at the trade's
  own 1R distance, the test's target in R (T2: the trade's own target distance) and 16:00 New York exit, same cost. The test's
  OOS net R a trade must beat the seed mean in at least 38 of 40.
- Buys and sells are reported apart, in and out of sample.

## Pass bar (per test; the verdict is PASS if any test passes, T1 is the primary)

1. OOS net R a trade > 0, OOS n >= 30
2. OOS month-sum t >= 2 and Holm p < 0.05
3. In-sample (2007-16) net R a trade > 0 (same sign)
4. OOS net R a trade > 0 at 2x costs
5. Beats >= 38 of 40 placebo seeds

Anything else is FAIL. No parameter (window, fraction, filter, target, stop buffer, cost, exit time) will be changed after the
first run.
