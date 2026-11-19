# Gold intraday momentum on the 17:00 New York day: pre-registration

Written, committed and pushed **alone, before any return of this study was computed** (14 Nov 2026). The data, the day, the
signals, the trades, the stop, the costs, the windows, the placebo and the pass bar are fixed here and do not change after the
results are seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **A stand-alone rule.** It is never a gate, exit, entry or size of the live gold book (Gold trend, Gold
daily engulf), it reads none of that book's positions or any other study's trade records (owner decision 44). No live rule,
size, filter, stop, config or council member changes. ICT is not involved. A pass would only be a hypothesis for a forward
paper shadow that the owner decides on.

## The question

Does gold's return over the first part of its New York trading day predict its return into the close of that day? This is the
"intraday momentum" effect reported for US equity index ETFs (Gao, Han, Li and Zhou, Journal of Financial Economics 2018: the
first half-hour predicts the last half-hour), read here on gold's own trading day, which ends at 17:00 New York.

## What is already known (seen before this was written)

- `research/edge/intraday-momentum` (branch of 13 Nov 2026): SPX500 / NAS100, first half-hour to last half-hour of the cash
  session: FAIL.
- `research/edge/metals-intraday-momentum` (branch of 14 Nov 2026), read before writing this: gold, silver, WTI on the COMEX /
  NYMEX floor session (gold signal 08:20-08:50 New York, trade 13:00-13:30): FAIL. Gold, 2016 to now: n 2,713, gross -0.015R,
  net -0.157R a trade (stop 1.5 x the 20-day mean last-half-hour move, cost $0.30); regression slope +0.028 (White t 1.27).
  So this study is a **near neighbour, not a duplicate**: other windows (the overnight-plus-morning move, and the 08:30-10:00
  US-open move, as signals; the last 1.5 / 2 hours of gold's 17:00 New York day, after the floor closes, as the trade), another
  stop (1 x daily ATR) and another day anchor. Its gold result is a reason to expect nothing here; it is stated, not used.
- No return at 08:30, 10:00, 15:00, 15:30 or 16:55 New York, nor any 17:00-to-17:00 daily candle, has been computed on this
  data for this study. The candle file's format and coverage only were looked at.

## Data

OANDA mid XAU/USD M5 candles, 1 Nov 2006 to 13 Nov 2026, from a local cache kept out of git (`xau-5m.json.gz`: an array of
`[start unix seconds, open, high, low, close]`). Its path is passed to `run.mjs` on the command line. No other data.

## Clock and day

- New York time: `council/histdata.mjs` `nyOffsetH` (US daylight time from the 2nd Sunday of March, 07:00 UTC, to the 1st Sunday
  of November, 06:00 UTC: UTC-4, else UTC-5). Every clock time used is between 08:30 and 17:00, so a switch day is converted
  correctly. The data starts after the 2006 switch, so the pre-2007 US rule never applies. The test checks the converter against
  the system's `America/New_York` time zone around DST switch days.
- **Trading day D** = a Monday-Friday New York date; it runs from 17:00 New York of the previous weekday to 17:00 New York of D
  (Monday's runs from Friday 17:00, so Sunday evening's candles are Monday's). Saturday and Sunday are never trading days.
- **Price at a clock time X of day D** = the close of the M5 candle that ENDS at X (starts at X - 5 min); if that candle is
  missing, the close of the last candle ending in the 15 minutes before X; none: the day is skipped (and counted).
  The previous close = the price at 17:00 New York of the previous trading day (same rule).
- **Daily candles** (for the ATR): all candles of trading day D; true range against the previous day's close; ATR(14) for day D
  = the simple mean of the true ranges of the 14 trading days before D (D itself is not used). Fewer than 14: no trade.

## The three tests (one trade a day at most, long or short)

| test | signal (known at) | trade |
|---|---|---|
| T1 | s = P(10:00) / previous 17:00 close - 1 | enter at 15:30 New York, exit 16:55 |
| T2 | s = P(10:00) / P(08:30) - 1 (the US open window) | enter at 15:00 New York, exit 16:55 |
| T3 | T1's signal, only on days with abs(s) above the median of abs(s) over the 250 previous T1 signal days (past days only; fewer than 250: no trade) | as T1 |

- Long if s > 0, short if s < 0; s = 0: no trade.
- Entry price = P(entry time). Exit = P(16:55) unless the stop is hit first.
- **Stop** = 1.0 x ATR(14) from the entry. Checked on every M5 candle from the one that starts at the entry time to the one that
  ends at 16:55: a candle that OPENS beyond the stop fills at its open (gap); else a candle whose low (long) / high (short)
  reaches the stop fills at the stop (worst case). Every trade has a stop.
- **R** = (exit - entry) x side / (1 x ATR). Cost per trade in R = cost in dollars / ATR. **Judged at $0.60 a round trip.**
  Also reported: $0.16 (the demo all-in) and $1.20 (2 x cost). No financing: every trade is closed before the 17:00 rollover.

## Windows

In sample: trading days 1 Jan 2007 - 31 Dec 2016. Out of sample: 1 Jan 2017 - 31 Oct 2026. Candles before 2007 are warm-up only;
November 2026 is not used.

## Statistics and pass bar

- t on calendar-month sums of net R (months with at least one trade): mean / sd x sqrt(months). One-sided p from the normal
  distribution. Holm over the three tests (on the out-of-sample p).
- **Placebo**: for each test, 40 seeded runs (seeds 1-40, a fixed generator) on the same traded days with a random long / short
  per day, the same entry, stop, exit and cost.
- **A test passes only if all hold**: (1) net R a trade > 0 in sample AND out of sample; (2) out-of-sample month-sum t >= 2 and
  its Holm-adjusted p < 0.05; (3) out-of-sample n >= 200; (4) out-of-sample net R a trade beats at least 38 of the 40 placebo
  runs; (5) out-of-sample net R a trade still > 0 at 2 x cost ($1.20). The study passes if any test passes; otherwise FAIL.

## Reported, decides nothing

Gross R; net at $0.16 and $1.20; by year; win rate and stops hit; and, descriptively, the OLS slope (with t) of the last-window
return (entry price to P(16:55), no stop, in %) on the signal (in %) for T1 and T2, in sample and out of sample.
