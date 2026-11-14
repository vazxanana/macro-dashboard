# Result: gold after the US dollar index's biggest move in a month (14 Nov 2026)

**Verdict: FAIL, 0 of 3: trading gold against a one-month-record dollar move made +0.103R a trade net out of sample (n 106, month t 1.18, Holm p 0.357) but -0.118R in sample; 40 of 40 placebos beaten.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 3adf0b522, pushed alone before any return was
computed; only the signal days per window were counted first). Paper research only, a **stand-alone rule on gold**: not a
gate, entry, exit or size of the live gold book, and nothing here was compared with or applied to that book (owner decision
44); none of its 2006-17 positions was read. No live rule, size, filter, stop, config, cost constant or council member
changed. No proposal is written. Not an edge.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json` and `eurusd`, `gbpusd`, `usdjpy`, `usdcad`,
  `usdchf` at commit `aa68d9ce`, weekends folded into Monday with `council/fills.mjs` `foldWeekend`. Dollar index = the
  council's ICE DXY build of `council/macro.mjs` `dxySeries` (USD/SEK = 11.2 / EURUSD) on the folded closes.
- Shock day: the index's daily return larger in size than every one of the 21 returns before it (only earlier data). In
  sample 2007-16: 123 shock days (63 up, 60 down) of 2,601; out of sample 2017-01 to 2026-10: 125 (55 up, 70 down) of 2,552.
- T1 (primary): gold against the dollar's move (buy after an up shock, sell after a down shock), 5 candles. T2: the same,
  1 candle. T3: gold with the dollar's move (continuation), 5 candles.
- Trade: entry at gold's next UTC daily open, stop 2 x ATR(20) of the 20 candles before it (1R), gaps through the stop fill at
  the open, one position at a time per test. Costs $0.60 a round trip plus on buys `nights()` x `FIN.xau.long` (0.000148 of
  price a rollover, today's demo rate for every year). Mean cost 0.031-0.034R a 5-day trade, 0.017-0.021R a 1-day trade.
- Baseline: the same-side trade after every eligible day of the same calendar year; excess = net R less that year's mean.
- t on calendar-month sums (empty months count as 0), Holm over T1-T3 on the one-sided out-of-sample p.

## Results

R a trade; "net" after costs; "x2" at twice the costs; "excess" = net less the same-side, same-year baseline.

| Test | Window | n | gross | net | x2 | excess | month t net | month t gross | month t excess |
|---|---|---|---|---|---|---|---|---|---|
| T1 | IS 2007-16 | 110 | -0.085 | -0.118 | -0.152 | -0.084 | -1.71 | -1.23 | -1.26 |
| T1 | OOS 2017-26 | 106 | +0.134 | +0.103 | +0.073 | +0.145 | 1.18 | 1.52 | 1.67 |
| T2 | IS 2007-16 | 123 | -0.014 | -0.035 | -0.056 | -0.014 | -1.22 | -0.48 | -0.51 |
| T2 | OOS 2017-26 | 125 | +0.030 | +0.013 | -0.003 | +0.036 | 0.31 | 0.69 | 0.84 |
| T3 | IS 2007-16 | 112 | +0.031 | -0.001 | -0.034 | +0.031 | -0.02 | 0.45 | 0.45 |
| T3 | OOS 2017-26 | 105 | -0.120 | -0.154 | -0.189 | -0.151 | -2.03 | -1.57 | -2.00 |

Baselines (mean net R, a trade on every eligible day): 5-day buy -0.001 IS / +0.063 OOS, 5-day sell -0.065 / -0.109; 1-day
buy -0.015 / -0.001, 1-day sell -0.024 / -0.035. Gold's drift makes buys the better side out of sample and sells the worse.

| Test | OOS month t | placebos beaten (of 40) | placebo median t | one-sided p | Holm p |
|---|---|---|---|---|---|
| T1 | 1.18 | 40 | -1.03 | 0.119 | 0.357 |
| T2 | 0.31 | 37 | -1.37 | 0.378 | 0.757 |
| T3 | -2.03 | 0 | 0.11 | 0.979 | 0.979 |

## Reading

- **T1 fails four checks**: out-of-sample month t 1.18 (bar 2, Holm p 0.357), negative in sample (-0.118R, the opposite
  sign), excess over the same-year baseline +0.145R with month t 1.67 (bar 2) and negative in sample (-0.084R). It passes
  the 2x-cost and placebo checks only. The out-of-sample gain is mostly the buy side (after a dollar up shock: 47 trades,
  +0.222R net) on a decade when buying gold paid anyway; the sells after a dollar down shock made +0.009R (59 trades).
  These splits are reported, not tested.
- The placebo median is negative because random days carry the real signals' sides, and out of sample the sells (59 of 106)
  sit on a falling-sell baseline (-0.109R); beating all 40 placebos says the side mix chosen by the dollar is not worse than
  random, not that it is an edge.
- T3 (continuation) is the mirror and loses out of sample (-0.154R, month t -2.03); T2 (one day) is flat in both windows.
- The two windows disagree on the sign of every test, as in the other dollar studies (`gold-dollar-lead`,
  `gold-dollar-divergence`): a one-month-record dollar move carries no stable information about gold's next one to five days.

## Not tested

Other look-backs (a week, a quarter), z-score thresholds, holds or stops; single pairs instead of the index; the single-side
splits as tests; intraday timing; other metals.

To repeat: `node research/edge/gold-dxy-month-shock/run.mjs fetch <dir>` (git show from `origin/council-data`, no network),
then `… full <dir>`. Tests: `tests/gold-dxy-month-shock.test.mjs`.
