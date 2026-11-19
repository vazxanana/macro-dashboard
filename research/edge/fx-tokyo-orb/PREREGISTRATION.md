# Tokyo-open range breakout on three forex pairs: pre-registration

Written and committed on 14 Nov 2026, before any candle of the test was read for this study and before any trade was
computed. Paper research only: no live rule, size, filter, cost model, council member or mirror setting is changed by this
study, whatever it finds. A pass would only be a proposal (`research/proposals/`) for a paper shadow the owner decides on;
it never becomes a live rule by itself.

## Why

The London opening-range study (branch `fx-london-orb`) tested the first hour of London. Nobody here has tested the same
idea at the Tokyo open: the first hour of the Tokyo session sets a range, and a close beyond it later in the session is
followed by continuation. This study tests that claim once, as a fixed rule, with the pass bar below written before any
result exists. No code is imported from the other branch; what is reused is copied.

## Data

- OANDA mid M15 candles (with OANDA's tick volume) through the council's keyless proxy
  (`/md/bars?sym=<key>&tf=15m&from=&to=`, 4,999-candle windows, paced), from 2007-06-01 (warm-up) to the start of the UTC
  day the run is made. If OANDA serves M15 only from a later date, the file starts there and the replication window starts
  when the warm-ups below are complete. Files kept outside git (the session scratchpad).
- Markets (OANDA keys of `api/_oanda.js`): **T1 `usdjpy`, T2 `audusd`, T3 `nzdusd`**. Pip 0.01 for USD/JPY, 0.0001 for the
  other two.
- **Decisive window: trades entered 2016-01-01 to the end of the file. Replication window: 2008-01-01 (or the first day the
  warm-ups allow) to 2015-12-31.** Nothing is tuned on either: every number below is fixed now.

## Clock

All times are **UTC**. Japan has no daylight saving time, so 09:00-10:00 Tokyo is 00:00-01:00 UTC all year. A candle
belongs to a time by its open time. A trading day is a UTC calendar day Monday to Friday.

## Days skipped (fixed now)

- Saturdays and Sundays.
- **Missing range data**: a day whose four M15 candles opening 00:00, 00:15, 00:30 and 00:45 UTC are not all present.
- **Japanese public holidays**: they cannot be derived reliably here (moving "Happy Monday" days, equinox dates, substitute
  and special holidays), and forex trades through them, so they are proxied from the data: the day is skipped when the
  summed tick volume of its four range candles is under 0.5 x the median of that sum over the 20 previous days that had
  four range candles (this pair, today excluded; skipped days still enter later medians). Days before 20 earlier such days
  exist are skipped (warm-up). This also removes other thin openings; it is a rule fixed now, not a holiday list.
- **First trading day of the year**: 1 January is skipped, and so is the first weekday of each year that has its four range
  candles.
- **Range too narrow**: `range = high - low` of the four range candles. ATR(14) of daily candles: UTC daily candles built
  from the M15 candles of Monday to Friday (Saturday and Sunday candles dropped), true range with the previous such day's
  close, the simple mean of the 14 complete days before today (today excluded). The day is skipped when
  `range < 0.25 x ATR(14)`. Days before 14 earlier daily candles (plus one for the first previous close) exist are skipped.
  No upper limit.

## The rule

- Signal: the first M15 candle opening 01:00 to 05:30 UTC (so closing 01:15 to 05:45) whose close is above the range high
  (buy) or below the range low (sell). Only the first such close of the day counts; one trade a day per pair at most.
- Entry: at market at the open of the next M15 candle (01:15 to 05:45 UTC). If that candle is missing, or opens at or
  beyond the stop, there is no trade that day.
- Stop: the opposite side of the range (buy: range low; sell: range high). Every trade has a stop. `r0 = |entry - stop|` =
  1R. No target, no break-even, no trail.
- Management, from the entry candle on: a candle (after the entry candle) that opens beyond the stop exits at its open; a
  candle whose low (buy) or high (sell) reaches the stop exits at the stop (the entry candle is checked for the stop too).
- Time exit: at the close of the last candle opening before 06:00 UTC (normally the 05:45 candle) if still open.
- Results in R: gross = side x (exit - entry) / r0.

## Costs (net R)

The raw-spread demo's measured model (CLAUDE.md "Forex spreads", 12 Nov 2026; `council/fills.mjs`), charged per trade in
price, then divided by `r0`:
- spread 0.3 pip a round trip;
- commission 22.5 USD per million USD of notional a side; for all three pairs the USD notional of one unit, in the quote
  currency, equals the pair's price, so the round trip is `2 x 22.5e-6 x entry price`;
- slippage of half the default 1-pip spread (0.5 pip) on every market fill: the entry, a stop exit and a time exit (all
  three are market orders, so every trade pays 1 pip of slippage).
No overnight financing (every trade is closed the same UTC morning). Gross R is reported beside net R; a sensitivity at
twice the costs is reported, not judged.

## Statistics and the pass bar

Three tests, one per pair (T1 USD/JPY, T2 AUD/USD, T3 NZD/USD). For each:
1. n >= 300 trades in the decisive window;
2. mean net R a trade in the decisive window > 0;
3. mean net R a trade in the replication window > 0;
4. t >= 2 on calendar-month sums in the decisive window (net R summed per calendar month, every month of the window
   counted, a month with no trade is 0; t = mean / (sd / sqrt(months)));
5. Holm over the three tests on the one-sided p of the decisive month-sum t (normal approximation): adjusted p < 0.05.

A test **PASSES** only when all five hold. The study's verdict is PASS if at least one test passes, else FAIL.

Placebo (reported, not judged): 40 seeds (1-40, a seeded generator). For every real trade in the decisive window, a placebo
trade on the same pair and day, entered at the same candle's open with the same stop distance `r0`, but with a side drawn
at random (buy or sell, one half each); stop at `entry - side x r0`, the same management, exit and costs. The statistic is
the mean net R a trade per pair; its mean, 95th percentile and range over the 40 seeds are reported beside the real one.

Per year, the two windows, gross and twice-cost figures are reported and never judged. What a pass or a fail does and does
not mean is written in RESULT.md, and a pass is only a proposal to the owner.
