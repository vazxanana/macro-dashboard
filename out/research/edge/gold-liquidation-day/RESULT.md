# Result: buying gold after a cross-asset liquidation day (14 Nov 2026)

**Verdict: FAIL, 0 of 3: a gold buy after a day when gold, the S&P 500 and the 10-year note all fell 1 sd made -0.244R a trade less than an any-day buy 2017-26 (n 24, month t -1.33).**

Pre-registered in `PREREGISTRATION.md` (committed and pushed alone before any number was computed). Paper research only: a
stand-alone gold rule, never a gate, entry, exit or size of the live gold book, and the book's 2006-17 window and positions
were not used (owner decision 44). Nothing live changed and no proposal is written.

## The rule and the data

OANDA mid daily candles from council-data (`research/daily/xau.json`, `spx500.json`, `usb10y.json`), weekends folded into
Monday with `council/fills.mjs` `foldWeekend`, joined by day. A liquidation day: gold's, the S&P 500 CFD's and the 10-year
Treasury note CFD's daily returns are each at or below -K times their own standard deviation of the 60 returns before the
day. Buy gold at the next open, stop 2 x ATR(20) below, out at the close of the H-th candle or at the stop; one trade at a
time. Costs $0.60 a round trip plus `nights` x `FIN.xau.long` x entry price. Baseline: the same buy after every eligible
weekday of the window (overlap allowed). Excess = net R - the baseline's mean net R in that window. t on calendar-month sums
of the excess; Holm over three; 40 seeded placebos of random days.

## The tests

| Test | Window | Liquidation days | n | Gross R | Net R | Baseline net | Excess | Month t | At 2x costs (excess) | Placebos beaten | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 K 1.0, 10 candles (primary) | 2007-16 | 8 | 7 | +0.094 | 0.000 | +0.014 | -0.013 | -0.04 | -0.034 | | | |
| | 2017-26 | 27 | 24 | -0.071 | -0.132 | +0.113 | -0.244 | -1.33 | -0.220 | 2 of 40 | 1.00 | no |
| T2 K 1.0, 5 candles | 2007-16 | 8 | 7 | -0.268 | -0.329 | -0.003 | -0.326 | -0.95 | -0.339 | | | |
| | 2017-26 | 27 | 25 | -0.004 | -0.040 | +0.063 | -0.104 | -0.74 | -0.088 | 6 of 40 | 1.00 | no |
| T3 K 0.5, 10 candles | 2007-16 | 36 | 32 | -0.181 | -0.254 | +0.014 | -0.268 | -1.93 | -0.268 | | | |
| | 2017-26 | 88 | 62 | +0.064 | -0.013 | +0.113 | -0.126 | -0.99 | -0.118 | 7 of 40 | 1.00 | no |

R is per trade, in units of the initial risk (2 x ATR(20)). Month t is on the excess over the baseline.

## Costs and stops

- Median stop distance: T1 $26.09 in 2007-16 and $65.14 in 2017-26; T2 $26.09 / $69.44; T3 $34.18 / $52.18 (all over $10).
- Cost share (mean cost per trade / mean |gross R|): T1 17.6 % / 9.1 %; T2 9.6 % / 6.3 %; T3 10.5 % / 10.0 %. Mean cost
  0.036-0.094R a trade, financing the larger part on the 10-candle holds (about 11-12 nights).
- The failure is not the cost: before costs the excess is also negative out of sample (T1 -0.269R, T2 -0.120R, T3 -0.134R).

## What it says

- Gold did not give back a "forced selling" fall. After the days it fell with stocks and bonds, a buy did worse than a buy on
  any day, in both windows and at every threshold and hold tested. Every test sits at or below the middle of its 40 random
  placebo draws (2, 6 and 7 of 40 beaten).
- The condition is rare in 2007-16 (8 days at 1 sd, the years of a negative stock-bond correlation) and more common since 2017
  (27 days, most in 2021-26 when stocks and bonds fell together). So the in-sample check has only 7 trades: it is a weak check,
  and it does not matter here because the out-of-sample result fails on its own.
- Not an edge, not a filter, not a reason to avoid buying gold on such a day either (no test reaches t 2 in either sign).

## Repeat

`node research/edge/gold-liquidation-day/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-liquidation-day/run.mjs full <dir>`. Test: `tests/gold-liquidation-day.test.mjs`.
