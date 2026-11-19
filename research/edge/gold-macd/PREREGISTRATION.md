# Pre-registration: MACD and 50/200 moving-average crosses on gold's daily chart (14 Nov 2026)

Committed and pushed ALONE, before any return, trade or statistic of these rules was computed.

**Question.** Do the two most common retail indicator signals work on gold's daily chart: MACD(12, 26, 9) signal-line
crosses, and the 50/200 simple-moving-average golden / death cross?

**What this is not.** A stand-alone rule, tested on its own. It is **not** a gate, exit, entry, filter or size of the live
gold book (Gold trend + Gold daily engulf), and it reads nothing of it; owner decision 44 (no further gate, exit, entry or
size tested on that book's 2006-17 window) is untouched. Paper research only: nothing live changes, and a pass would only
be reported to the owner, never applied.

**Dedupe.** No earlier study tests MACD or 50/200 crosses on gold. Read: `gold-tsmom` (12-month time-series momentum,
monthly), `tsmom`, `trend-breadth` (the live 20-day breakout rule on other markets), `gold-regime-switch`, `gold-vol-target`,
`macro-gold`, `sma10-timing` (10-month average, monthly, on a four-market book), and the untested-backlog proposal of
14 Nov 2026; no branch name holds "macd". The 10-month average and 12-month momentum are monthly rules; these are daily.

## Data (fixed before any result)

- Market: **spot gold only**, OANDA mid daily candles, council-data `research/daily/xau.json`, read with
  `git show origin/council-data:research/daily/xau.json` (no network). Rows start 20 March 2006.
- Weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` (the live engulf's day rule).
  Only complete days: a last row dated today or later is dropped.
- Indicators use the folded daily closes. Warm-up 2006-03 to 2007-12: no signal before 1 January 2008 is traded.

## The indicators

- EMA(n): seeded with the simple mean of the first n closes, then `e = e_prev + 2/(n+1) * (c - e_prev)`.
- MACD line = EMA12 - EMA26 of the close; signal line = EMA9 of the MACD line (seeded with the mean of its first 9 values).
- SMA(n): plain mean of the last n closes.
- ATR(14): simple mean of the last 14 true ranges (high-low, |high - previous close|, |low - previous close|), up to and
  including the signal day.
- A cross is read on the CLOSE of day i: up-cross when `A[i-1] <= B[i-1]` and `A[i] > B[i]`, down-cross when
  `A[i-1] >= B[i-1]` and `A[i] < B[i]`. Every order is filled at the OPEN of day i+1. Nothing of day i+1 or later is read
  to make the decision.

## The three tests

**Every trade carries a stop**, set at entry from the ATR(14) of the signal day and never moved.

- **T1, MACD stop-and-reverse.** Up-cross: buy at the next open (closing a short at the same price); down-cross: sell at
  the next open (closing a long at the same price). Protective stop 2 x ATR(14) from each entry. If the stop is hit, the
  position is closed at the stop (at the open if the day opens beyond it) and the rule stays flat until the next cross of
  either direction.
- **T2, MACD long only.** Buy at the next open after an up-cross; go flat at the next open after a down-cross; the same
  2 x ATR(14) stop; flat after a stop until the next up-cross.
- **T3, 50/200 SMA.** Buy at the next open after the 50-day average crosses above the 200-day; go flat at the next open
  after it crosses below; stop 3 x ATR(14). Long only, and only on a cross: being above at the start of 2008 is not an
  entry. After a stop-out, re-enter only on a new up-cross.
- Stop handling: the stop is checked on every day from the entry day on (low for a long, high for a short). One day that
  holds both the stop and the exit open is settled at the open (the open comes first). A position still open on the last
  candle is closed at that candle's close and reported as open.
- 1R = the entry's stop distance (k x ATR(14)). R of a trade = (exit - entry) x side / stop distance.

## Costs

- $0.60 an ounce a round trip on every trade (the brief's figure; about two of the demo's typical gold spreads plus
  slippage), taken off as 0.60 / stop distance in R.
- Overnight financing on longs: `nights(entry time, exit time)` x `FIN.xau.long` (0.000148 of price a rollover, the demo
  broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price / stop distance. Today's rate charged for every
  year, as every gold study since 11 Nov. Shorts are charged and credited nothing (`FIN.xau.short` = 0). Entry and exit at
  an open are at the day's 00:00 UTC stamp; a stop inside a day is stamped 12:00 UTC (as `gold-tsmom`).
- **2x costs**: $1.20 a round trip and twice the financing.

## Windows

- **In sample (IS)**: trades whose entry day is 1 January 2008 to 31 December 2016.
- **Out of sample (OOS)**: entry day 1 January 2017 to the last complete candle in the file (early November 2026).
- OOS halves: 2017-01-01 to 2021-12-31 and 2022-01-01 to the end.

## Statistics

- Per test and window: n, win rate, R a trade gross and net, total R net, worst drawdown on the closed-trade R curve.
- **Month t**: net R summed by the calendar month of each trade's exit, over every calendar month of the window (a month
  with no exit counts 0); t = mean / (sd / sqrt(months)); two-sided p from Student's t with months - 1 degrees of freedom.
- **Holm** over the three tests' OOS p-values.
- **Placebo, 40 seeds** (mulberry32, seeds 1 to 40), per test on the OOS window: the same number of entries as the rule's
  OOS trades, each placed on a uniformly random OOS day with room for its holding length, keeping each real trade's side,
  its holding length in days and its stop multiple (k x ATR(14) of the day before the random entry); exit at the open
  after that many days or at the stop; same costs. Placebo trades may overlap. Score = net R a trade; the rule must beat
  the placebo in at least 38 of 40 seeds.
- **Buy-and-hold** (descriptive, not in the bar): gold's percentage change from the first open to the last close of each
  window, less financing on every night held; set beside the rule's summed net trade return in percent of entry price
  (one ounce a trade, no leverage), and the share of days the rule was in the market.

## Pass bar (each test on its own; all must hold)

1. OOS net R a trade > 0.
2. OOS month t >= 2 and Holm-adjusted p < 0.05.
3. Net R a trade > 0 in sample AND in both OOS halves.
4. OOS net R a trade > 0 at 2x costs.
5. Beats at least 38 of the 40 placebo seeds.
6. OOS n >= 30.

**T3 will have few trades** (a 50/200 cross on gold happens about once or twice a year). If its OOS n is under 30 it
cannot pass and is **judged descriptively only**: its numbers are reported, no verdict of "edge" is drawn either way.

The study passes if at least one of T1 / T2 / T3 passes every check; otherwise FAIL. Whatever the result, no live rule
changes; a pass would be written up for the owner as a proposal to watch on paper, nothing more.

## Deliverables

`run.mjs` (`fetch <dir>` copies the candle file with `git show`, `full <dir>` runs and writes `result.json`), `RESULT.md`,
`result.json`, `tests/gold-macd.test.mjs` (offline: the indicators and crosses on hand-made candles, no look-ahead, the
stop on every trade, the report against result.json).
