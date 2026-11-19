# Pre-registration: gold-london-displacement, a big M15 candle in gold's first London hour, followed into New York

Written and pushed on 14 Nov 2026 before any trade of this rule was computed. Paper research only.

## What this is, and what it is not

A **new stand-alone intraday rule** on spot gold. It is **not a gate, exit, entry or size of the live gold book** (Gold trend +
Gold daily engulf): none of that book's records or positions is read, and nothing here can change it (owner decision 44). Nothing
live changes whatever the result; a pass would at most be a proposal for the owner with its own forward record.

Claim tested: when the first London hour prints one unusually large, decisive M15 candle (a "displacement"), price keeps going
that way into the New York morning.

## Not already tested (checked before writing this)

- `gold-london-orb`: a breakout of the first London hour's high / low range, entered on a stop order after the hour. No candle-size
  condition; this study enters on ONE large candle inside the hour, at the next M15 open.
- `gold-london-reversal`: fades the London move at 09:30 New York. The opposite direction and another entry.
- `gold-asia-break`: the Asian range broken in London. A range, no candle-size condition.
- `gold-hourly-shock`, `gold-shock-revert`: large H1 moves at any hour, faded or followed on another clock.
- `gold-vol-breakout*`, `gold-range-expansion`, `gold-intraday-momentum`: daily ranges / session returns, not one M15 candle.
- `ict-*`: the H1 iFVG reversal on index futures and GC; not this rule.

## Data

OANDA mid XAU/USD M5 candles, 2006-11 to 2026-11 (kept outside git). Times are UTC. M15 candles are built from M5 candles on UTC
quarter hours (:00, :15, :30, :45); an M15 candle counts only when all three of its M5 candles exist.

## The rule (one trade a day at most)

- **Day**: a UTC calendar day Monday-Friday.
- **London first hour**: London 08:00-08:59 local time = **07:00-07:59 UTC** in British Summer Time (last Sunday of March to last
  Sunday of October), otherwise **08:00-08:59 UTC**. Its four M15 candles are the candidates.
- **ATR**: the mean true range of the 96 complete M15 candles before the candidate (the M15 series across days, weekend gaps
  skipped; true range uses the previous M15 close). Needs 96 earlier candles.
- **Displacement**: a candidate M15 candle with range (high - low) >= **2.0 x ATR** and |close - open| >= **0.6 x range**. Side =
  the sign of close - open. The FIRST such candle of the hour is the signal; later ones are ignored.
- **Entry**: at market, the open of the next M5 candle (the open of the next M15 period).
- **Stop**: the displacement candle's opposite extreme (buy: its low; sell: its high). **Every trade has this stop.** 1R =
  |entry - stop|; a trade with 1R <= 0 is skipped. A gap through the stop fills at the candle's open; if a stop and target fall in
  one M5 candle the stop counts.
- **T1** (primary): exit at **17:00 UTC** (the close of the 16:55 M5 candle), or at the stop.
- **T2**: T1 with a target at 2R.
- **T3**: T1, only when the displacement candle also CLOSES beyond the Asian range (high / low of the M5 candles from 00:00 UTC
  to the start of the London hour) in its own direction.
- A day is skipped when fewer than 60 M5 candles exist between the entry and 17:00 UTC.

## Costs

$0.60 a round trip per ounce on every trade (spread and slippage together), taken off in R as 0.60 / 1R. Financing: `nights`
x `FIN.xau.long` x entry / 1R on buys, imported from `council/fills.mjs` (the demo broker's XAUUSD swap of 11 Nov 2026); every
trade is flat before the 22:00 UTC rollover, so it is 0 by construction (computed anyway). 2x costs ($1.20) reported and used
in the pass bar.

## Windows

In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31. OOS halves reported: 2017-2021 and 2022-2026.

## Baseline and placebo (gold's 2017-26 rise makes buys look good on their own)

- **Unconditional same-side baseline** (reported, and used in the pass bar): for each signal trade, the same side entered on
  EVERY weekday of the same window at the same UTC minute, with a stop at the same multiple of that day's ATR as the signal's
  stop (stop distance / ATR at the signal), the same exit and costs. The baseline value of a trade = the mean net R of those
  days; **lift** = mean signal net R minus mean baseline value.
- **Placebo**, 40 seeds (seed 1..40): each signal trade moved to a random other weekday of the same window, keeping its side,
  entry minute, exit time, target rule and stop as the same ATR multiple; one draw per trade per seed. The test's net R a trade
  out of sample must beat the placebo seed mean in at least 38 of 40 seeds.

## Statistics

t on calendar-month sums of net R. One-sided p from the normal; Holm across the three tests (T1, T2, T3).

## Pass bar (per test; the verdict is PASS if any test passes, T1 is the primary)

1. OOS net R a trade > 0, OOS month-sum t >= 2 and Holm p < 0.05
2. In-sample net R a trade > 0 (same sign)
3. OOS net R a trade > 0 at 2x costs
4. OOS lift over the same-side baseline > 0
5. Beats >= 38 of 40 placebo seeds out of sample
6. OOS n >= 30

Anything else is FAIL. No parameter (hour, 2.0 x ATR, 0.6 body, ATR length, exit time, target, cost, filter) will be changed
after the first run.
