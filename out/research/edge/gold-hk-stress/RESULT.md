# Result: buying gold after Hong Kong equities under-run US equities (14 Nov 2026)

**Verdict: FAIL, 0 of 3: a gold buy after Hong Kong ran far behind the S&P 500 over 5 days made -0.028R a trade versus an any-day buy 2017-26 (n 149, month t -0.48).**

Pre-registered in `PREREGISTRATION.md` (committed and pushed alone before any return was computed; only event counts were
read first). Paper research only: a stand-alone gold rule, never a gate, entry, exit or size of the live gold book, and the
book's 2006-17 window and positions were not used (owner decision 44). Nothing live changed and no proposal is written.

## The rule and the data

OANDA mid daily candles from council-data (`research/daily/xau.json`, `hk33.json`, `spx500.json`, commit
`83e686fccd81`), weekends folded into Monday with `council/fills.mjs` `foldWeekend`. Gap of a day = the
Hong Kong 33 CFD's 5-day log return minus the S&P 500 CFD's, on joint days. A stress day: the gap is at or below the q-quantile
of the 250 gaps before it. Buy gold at the next open, stop 2 x ATR(20) below, out at the close of the H-th candle or at the
stop; one trade at a time. Costs $0.60 a round trip plus `nights` x `FIN.xau.long` x entry price. Baseline: the same buy
after every eligible weekday of the window (overlap allowed). Excess = net R - the baseline mean net R. t on calendar-month
sums of the excess; Holm over three; 40 seeded placebos of random days.

## The tests

| Test | Window | Stress days | n | Gross R | Net R | Baseline net | Excess | Month t | At 2x costs (excess) | Placebos beaten | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 lowest 15 %, 5 candles (primary) | 2007-16 | 389 | 169 | +0.008 | -0.038 | -0.007 | -0.031 | -0.55 | -0.029 |  |  |  |
|  | 2017-26 | 373 | 149 | +0.080 | +0.030 | +0.058 | -0.028 | -0.48 | -0.025 | 11 of 40 | 1.00 | no |
| T2 lowest 10 %, 3 candles | 2007-16 | 261 | 170 | -0.030 | -0.064 | -0.014 | -0.050 | -1.09 | -0.048 |  |  |  |
|  | 2017-26 | 249 | 135 | +0.094 | +0.060 | +0.030 | +0.030 | 0.57 | +0.033 | 28 of 40 | 0.85 | no |
| T3 lowest 20 %, 10 candles | 2007-16 | 501 | 158 | +0.064 | -0.009 | +0.006 | -0.015 | -0.18 | -0.015 |  |  |  |
|  | 2017-26 | 499 | 148 | +0.136 | +0.055 | +0.100 | -0.045 | -0.53 | -0.040 | 10 of 40 | 1.00 | no |

R is per trade, in units of the initial risk (2 x ATR(20)). Month t is on the excess over the baseline.

## Gross and net, costs and stops

- Excess before costs (gross minus the baseline gross), 2007-16 / 2017-26: T1 -0.033 / -0.030, T2
  -0.052 / +0.027, T3 -0.016 / -0.049. The failure is not the cost: the signal and the baseline trades pay the same costs.
- Month t of the net R itself (not the excess), 2007-16 / 2017-26: T1 -0.66 / 0.52, T2 -1.39 / 1.14,
  T3 -0.10 / 0.66. The positive net R since 2017 is gold's own rise, which the any-day baseline earns too.
- Median stop distance: T1 $38.47 / $49.31 (every test over $10). Cost share (mean cost / mean |gross R|):
  7.5 % to 9.8 %.

## What it says

- A week of China-specific equity stress, measured as Hong Kong far behind the US, did not lead gold. Every test is within
  noise of the any-day buy in both windows (largest |month t| 1.09), T2 changes sign between the windows, and the primary
  sits below the middle of its random placebos (11 of 40 beaten).
- Not an edge, not a filter, and no reason to avoid gold on such days either.

## Repeat

`node research/edge/gold-hk-stress/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-hk-stress/run.mjs full <dir>` (`count <dir>` prints the event counts only). Test:
`tests/gold-hk-stress.test.mjs`.
