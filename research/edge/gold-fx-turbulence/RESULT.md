# Result: gold after a broad currency-turbulence day (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold after a broad G10 currency-turbulence day made +0.028R a trade net in 2017-26 but 0.035R less than buying every day (n 130, excess month t -0.47, Holm p 1.00).**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any gold return after a signal was computed).
Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, none of that
book's positions was read (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member
changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/{xau,eurusd,gbpusd,usdjpy,audusd,usdcad,usdchf}.json`
  at commit `338cfb45c`, weekends folded into the next weekday (`council/fills.mjs` `foldWeekend`). Gold is the only market
  traded.
- Signal: turbulence U = mean over the six USD majors of |daily log return| / sd of that pair's 60 returns before the day;
  a turbulence day has U >= 1.5. 181 of 2,601 days in 2007-16 (96 with gold up), 175 of 2,552 in 2017-26 (94 up).
- Trade: entry at gold's next daily open, 1R = 2 x ATR20, stop at 1R, out at the close of the 5th (T1, T2) or 10th (T3)
  candle; one position at a time per test. Costs $0.60 a round trip plus `nights()` x `FIN.xau.long` x entry on buys.
- Excess = net R minus the mean net R of the same side and hold after every eligible day of the window. t on calendar-month
  sums; Holm over the three out-of-sample one-sided p.

## Results (R a trade; t on month sums)

| Test | Window | n | Gross | Net | Excess | t gross | t net | t excess | Net at 2x costs | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 buy, 5 days (primary) | 2007-16 | 132 | +0.035 | -0.009 | -0.009 | 0.53 | -0.14 | -0.13 | -0.054 | |
| | 2017-26 | 130 | +0.075 | +0.028 | -0.035 | 1.01 | 0.39 | -0.47 | -0.018 | 1.00 |
| T2 follow gold's day, 5 days | 2007-16 | 130 | +0.042 | +0.011 | +0.042 | 0.61 | 0.16 | 0.61 | -0.021 | |
| | 2017-26 | 132 | -0.023 | -0.054 | -0.037 | -0.37 | -0.87 | -0.60 | -0.086 | 1.00 |
| T3 buy, 10 days | 2007-16 | 112 | +0.093 | +0.026 | +0.009 | 0.91 | 0.26 | 0.09 | -0.042 | |
| | 2017-26 | 111 | +0.127 | +0.052 | -0.062 | 1.21 | 0.51 | -0.59 | -0.022 | 1.00 |

Baselines (mean net R of every eligible day): 5-day buy -0.001R (2007-16) / +0.063R (2017-26), 5-day sell -0.065R /
-0.109R; 10-day buy +0.017R / +0.114R, 10-day sell -0.100R / -0.166R. Signals skipped while a position was open: 45-69 a test.

## Placebo and control (2017-26, 40 seeded draws each)

| Test | Real excess t | Placebo (random days of the window): beats / median / max | Control (random day of the same year): beats / median / max |
|---|---|---|---|
| T1 | -0.47 | 12 of 40 / 0.13 / 1.64 | 10 of 40 / 0.08 / 2.20 |
| T2 | -0.60 | 11 of 40 / -0.19 / 2.17 | 7 of 40 / 0.17 / 2.97 |
| T3 | -0.59 | 12 of 40 / -0.06 / 1.73 | 6 of 40 / 0.13 / 1.56 |

The real signal sits in the lower third of both null distributions in every test: the turbulence days carry no information
about gold's next one or two weeks beyond gold's own drift. The positive net figures of T1 and T3 out of sample are that drift
(gold rose through 2017-26; buying on any day made +0.063R / +0.114R), and none survives 2x costs.

## Reading

- Not an edge, and not a near miss: no test has an excess t above 0.61 in either window, the in-sample and out-of-sample signs
  disagree on T2 and T3, and the placebos and controls beat the real signal more often than not.
- Gold does not react, on average, to broad currency turbulence as a haven over the following week. What is not tested:
  the direction of the dollar on those days (other studies read it), a higher threshold (too few days), intraday timing.
- The gap idea first considered (gold's large unfilled daily gaps) was dropped before this pre-registration: gold's daily
  candles have too few of them (3 range gaps in 2007-16), as the pre-registration records.

To repeat: `node research/edge/gold-fx-turbulence/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-fx-turbulence/run.mjs full <dir>`. Test: `tests/gold-fx-turbulence.test.mjs`.
