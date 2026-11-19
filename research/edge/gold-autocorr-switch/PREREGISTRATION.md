# Pre-registration: gold's autocorrelation regime switching 5-day momentum and 5-day reversal, 14 Nov 2026

Written and pushed alone, before any trade or regime label of this rule was computed. Paper research only: nothing live
reads it, no rule, size, filter, stop, config or council member changes whatever the result.

## Question
When gold's daily returns have been positively autocorrelated over the last 60 days, does its 5-day move continue over the
next week; and when they have been negatively autocorrelated, does it reverse? One both-sided stream that follows the 5-day
move in a positive-autocorrelation regime and fades it in a negative one, net of costs.

A **stand-alone daily rule**. It is not a gate, exit, entry or size change of the live gold book (Gold trend / Gold daily
engulf) and reads none of that book's 2006-17 positions (owner decision 44); the daily candles alone are used. Not covered
by an earlier study: `gold-regime-switch` switches an H4 breakout and a band fade on the efficiency ratio (2016 on);
`gold-volvol-switch` switches on volatility of volatility; `gold-weekly-momentum`, `gold-tsmom`, `gold-streak`,
`gold-capitulation` trade momentum or reversal unconditionally or on the size of a move. None conditions the choice
between momentum and reversal on the sign of the returns' own lag-1 autocorrelation.

## Data (named before any result)
- One market: XAU/USD only. council-data `research/daily/xau.json` at commit `f6288251e` (OANDA mid daily candles, UTC days,
  2006-03-20 to 2026-11-06), weekend stubs folded into the next weekday with `council/fills.mjs` `foldWeekend`.

## Rule
- Daily log return `r(i) = ln(close(i) / close(i-1))`. At the close of day i (closed candles only):
  - `AC(i)` = Pearson correlation of the pairs (r(j-1), r(j)) for j = i-59 .. i (the 60 latest returns against the return
    before each; 61 returns read).
  - `M5(i) = close(i) / close(i-5) - 1`.
- **Regime**: AC(i) > 0 = momentum regime, AC(i) < 0 = reversal regime (AC exactly 0, or M5 exactly 0: no signal).
- **Side**: momentum regime → side = sign(M5) (buy after a 5-day rise, sell after a fall); reversal regime → side =
  −sign(M5).
- Entry at the open of day i+1. **Stop** = 2 x ATR(20) at day i (true range, the 20 days ending at i) from the entry, every
  trade, on the losing side. Exit at the close of day i+5 (five trading days held), or at the stop: a day that opens
  through the stop fills at its open, else a touch of the stop (low for a buy, high for a sell) fills at the stop. No target.
- One position at a time per test; a signal while the test's position is open is ignored; the next signal is the first day
  after the exit day.

## Tests (three, Holm over the three)
- **T1 (primary, both-sided): the switch.** Momentum side in the momentum regime, reversal side in the reversal regime.
- **T2: the momentum leg alone** (T1's signals in the momentum regime only, own one-at-a-time stream).
- **T3: the reversal leg alone** (T1's signals in the reversal regime only, own stream).
- Comparisons, not tests (same entry, hold, stop and costs): unconditional 5-day momentum every day (side = sign(M5)),
  unconditional 5-day reversal every day (side = −sign(M5)), and long / short every 5th trading day (the unconditional
  same-side baselines). The switch is only interesting if it beats both unconditional momentum and reversal.

## Costs
- $0.60 a round trip (spread $0.30 + $0.15 slippage each side), as `gold-capitulation` / `gold-13w-low`.
- Buys pay overnight financing: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's
  XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price; sells pay and earn nothing.
- **Cost share of R**, measured on every day (no signal or regime read): median 2 x ATR(20) is $37.3 in 2007-16 (median
  gold $1,223) and $47.9 in 2017-26 ($1,821): the $0.60 is 1.6 % / 1.3 % of R; a median 6-night buy's financing about
  2.9 % / 3.4 % of R. Median stop well over $10.
- 2x costs = both the round trip and the financing doubled.

## Statistics and windows
- R a trade, 1R = the stop distance. Trades counted by EXIT month. In sample 2007-01 to 2016-12, out of sample 2017-01 to
  2026-10. t = mean / standard error of net R summed by calendar month, over EVERY calendar month of the window (months
  with no trade count as 0). One-sided p from t (normal), Holm over the three tests.
- **Placebo**: 40 seeds; each real trade's signal day is replaced by a random day of the same window whose trade (same
  side, hold and stop rule) exits in that window; the OOS net month t of each seed; the real t must be above the 95th
  percentile (more than 38 of 40 seeds below).
- **Pass** (each test on its own): OOS net month mean > 0 with t >= 2 and Holm p < 0.05; in-sample net month mean > 0;
  OOS mean still > 0 at 2x costs; above the placebo's 95th percentile. The verdict is PASS only if T1 (the primary) passes;
  a pass of T2 or T3 alone is reported as such, not as a verdict on the rule.
- Also reported (description, not tests): share of days in each regime per window, and T1's per-year net R.
- Nothing is changed after the run; if it fails, no variant (window length, threshold, hold) is tried here.
