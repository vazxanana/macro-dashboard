# Pre-registration: trend quality (R squared of the 60-day log-price line) on gold's daily chart (14 Nov 2026)

Committed and pushed ALONE, before any return, trade or statistic of this rule was computed.

**Question.** When gold's last 60 daily closes lie close to a straight line (a "clean" trend: high R squared of an
ordinary least-squares fit of log close on time), is the next 10 days' move in the line's direction better than the move
after an ordinary day traded the same way? The idea (trend quality, not trend size) is that an orderly trend reflects
steady flows that persist, while a noisy one with the same slope does not.

**Why this design.** Many gold ideas here failed because they only rode gold's rise. So the primary test is a SELECTION
test against a same-side baseline that trades every day: each day the baseline takes a trade in the direction of the
60-day slope; the rule takes the same trade only on high-R-squared days. The primary statistic is how much better the
rule's trades are than the baseline's trades of the same calendar month, so a month in which gold simply rose credits
both alike and drift cancels.

**What this is not.** A stand-alone rule, tested on its own. It is **not** a gate, exit, entry, filter or size of the
live gold book (Gold trend + Gold daily engulf) and reads nothing of it; it does not use the book's 2006-17 positions or
window (owner decision 44 is untouched). Paper research only: nothing live changes, and a pass would only be reported to
the owner, never applied.

**Dedupe.** No study here measures trend QUALITY (R squared / linearity) on gold. Read: `gold-tsmom` and `tsmom`
(signed past return, no quality), `gold-adx-trend` (Wilder ADX strength, FAIL), `gold-autocorr-switch` (return
autocorrelation), `gold-volvol-switch`, `gold-drd-er` and `mosha-bo-er` (Kaufman efficiency ratio as a FILTER of other
rules), `regime-switch`, `gold-200d-stretch`, `gold-weekly-momentum`. No branch or folder name holds "r2", "regress" or
"quality". The 14 Nov untested-backlog list holds no stand-alone gold rule.

## Data (fixed before any result)

- Market: **spot gold only (XAU/USD)**, OANDA mid daily candles, council-data `research/daily/xau.json`, read with
  `git show origin/council-data:research/daily/xau.json` (no network). Rows start March 2006.
- Weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend`. Only complete days are used.
- Warm-up: no signal before 1 January 2007 is traded.

## The rule (all on the CLOSE of day i; every order fills at the OPEN of day i+1)

- Line: OLS of y = ln(close) on x = 0..59 over the 60 closes up to and including day i. Slope b, R squared
  = 1 - SSE / SST. Side s = +1 when b > 0, -1 when b < 0 (no trade when b = 0).
- **Signal day**: R squared >= 0.70.
- **Trade**: side s, entry at the open of day i+1, **stop 2 x ATR(14)** of day i from the entry (simple mean of the last 14
  true ranges up to day i), never moved; checked from the entry day on (low for a long, high for a short); a day opening
  beyond the stop fills at the open. Otherwise out at the open of day i+11 (10 trading days). No target.
- 1R = the stop distance. R = (exit - entry) x side / stop distance.
- **Baseline**: the same trade (side = sign of the slope, same stop and hold) taken on EVERY day from 2007, signal or
  not. Each baseline day is its own trade (overlapping).

## The three tests (Holm over these three)

- **T1, selection against the same-side baseline (primary).** For every signal day, its own trade (overlapping, as the
  baseline). Excess of a signal trade = its net R minus the mean net R of all baseline trades entered in the same calendar
  month. Statistic: the excess summed by entry month over every calendar month of the window (a month without a signal
  counts 0); month t.
- **T2, the rule stand-alone, long and short.** One position at a time: a signal day with no position open enters;
  net R summed by exit month; month t.
- **T3, the rule stand-alone, shorts only** (no help from gold's upward drift). One position at a time, short signals
  only; as T2.

## Costs

- **$0.60 an ounce a round trip** on every trade, taken off as 0.60 / stop distance in R.
- **Financing on buys**: `nights(entry time, exit time)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's
  XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry / stop distance; today's rate for every year. Shorts are charged
  and credited nothing. An open fill is stamped at the day's 00:00 UTC; a stop inside a day at 12:00 UTC.
- **2x costs**: $1.20 a round trip and twice the financing. The cost share (cost + financing as a share of gross R) is
  reported per test.

## Windows

- **In sample (IS)**: entries 1 January 2007 to 31 December 2016. **Out of sample (OOS)**: 1 January 2017 to the last
  complete candle in the file (early November 2026). OOS halves 2017-21 and 2022-26 reported only.

## Statistics and the pass bar

- Per test and window: n, win rate, R a trade gross / net / net at 2x costs, total, worst drawdown, median stop in dollars,
  month t (mean / (sd / sqrt(months)), two-sided Student p), Holm over the three OOS p values.
- **Placebo, 40 seeds** (mulberry32, seeds 1-40). T1: per OOS calendar year, the same number of days as the real signal
  days is drawn at random from that year's baseline days; the T1 OOS month t is recomputed. T2 / T3: the same number of
  trades with the same sides at random OOS entry days, same stop rule and hold; mean net R a trade.
- **PASS** only if T1 has OOS month t >= 2 with Holm p < 0.05, the IS excess is positive (same sign), the stand-alone rule
  (T2) is positive net in OOS at 2x costs, the real T1 t beats at least 38 of 40 placebo t values, and OOS has at least 30
  signal trades. T2 and T3 are reported; each is judged by the same bar on its own statistic (net R, placebo mean). Fixed
  numbers (60 days, 0.70, 10 days, 2 x ATR) are not tuned; no other value will be reported as a result.
- A pass would be a finding to report, never an edge until a forward record exists, and nothing is applied.
