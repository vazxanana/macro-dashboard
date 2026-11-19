# Result: do Treasury bond prices lead spot gold when gold lags them? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold after a 10-year bond up week that gold lagged makes +0.088R a trade net out of sample 2017-26 (n 30, month t 0.46); the mirror short and the daily 2-year lose.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 8d1fac650, pushed alone before any number was computed).
Paper research only, a **standalone cross-asset signal**: not a gate, entry, exit or size of the live gold book, and nothing
here was compared with or applied to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant
or council member changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json`, `usb10y.json`, `usb02y.json`, `usb30y.json` at
  commit `e693788d` (gold 2006-03-20 to 2026-11-06; bonds from March / April 2003), weekends folded into Monday with
  `council/fills.mjs` `foldWeekend`. Bond and gold matched by UTC day stamp; a week counts only when the bond has a candle on
  gold's last day of the week. The bond keys are the CFD's price (rising = yields falling).
- Weekly signal (T1, T2): the bond's weekly return as a z-score against the 52 weekly returns before it; gold's "lag" = its
  weekly return less beta x the bond's, beta fitted on the same 52 earlier weeks. T1: z > +1 and lag < 0, long gold. T2:
  z < -1 and lag > 0, short gold. Entry at gold's Monday open (the Sunday reopen), out at the close of the 5th gold candle.
- Daily signal (T3): the same on the 2-year note with 250 earlier days; gold the bond's way, held one candle.
- Every trade: stop 2 x ATR(20) of gold's candles before the entry (1R), gaps through the stop fill at the open, one
  position at a time. Costs $0.30 spread + $0.15 slippage on each of the two market orders ($0.60 a trade) plus financing on
  longs by `nights()` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's long swap, today's rate every year).
  The stop is wide (about $42 in sample, $59-66 out of sample), so costs are 0.014-0.045R a trade.
- t on calendar-month sums of net R (every month of the window counts, empty ones as 0), Holm over T1-T3 on the one-sided
  OOS p. In sample = signals from the first with full history (April 2007 weekly, March 2007 daily) to 2016; out of sample
  2017-01 to 2026-10.

## The three tests

| Test | Window | n (long / short) | Win % | Gross R a trade | Net R a trade | Net at 2x costs | Total net R | Month t gross | Month t net | Stops |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 10Y up, gold lagged, long (primary) | IS 2007-16 | 32 (32 / 0) | 65.6 | +0.176 | +0.133 | +0.089 | +4.25 | 1.42 | 1.08 | 6 |
| | OOS 2017-26 | 30 (30 / 0) | 53.3 | +0.133 | +0.088 | +0.042 | +2.63 | 0.69 | **0.46** | 8 |
| T2 10Y down, gold lagged, short | IS 2007-16 | 33 (0 / 33) | 39.4 | -0.105 | -0.122 | -0.139 | -4.02 | -0.87 | -1.00 | 4 |
| | OOS 2017-26 | 53 (0 / 53) | 43.4 | -0.105 | -0.119 | -0.134 | -6.32 | -1.19 | **-1.35** | 10 |
| T3 2Y day, gold lagged, 1 day | IS 2007-16 | 309 (148 / 161) | 50.5 | +0.023 | +0.002 | -0.018 | +0.76 | 1.21 | 0.13 | 7 |
| | OOS 2017-26 | 317 (134 / 183) | 41.3 | -0.030 | -0.048 | -0.065 | -15.09 | -1.54 | **-2.37** | 8 |

| Test | OOS p (one-sided) | Holm p | OOS t >= 2 and Holm < 0.05 | IS net > 0 | OOS 2x > 0 | OOS n >= 30 | Pass |
|---|---|---|---|---|---|---|---|
| T1 | 0.323 | 0.968 | no | yes | yes | yes | no |
| T2 | 0.911 | 1 | no | no | no | yes | no |
| T3 | 0.991 | 1 | no | yes (+0.002) | no | yes | no |

Placebo (40 seeds: the same number of random eligible OOS weeks / days, the real side mix, identical trade):

| Test | Real OOS month t | Seeds with t >= 2 | Seeds at or above the real t | Median / 5th / 95th percentile |
|---|---|---|---|---|
| T1 | 0.46 | 0 | 14 | 0.24 / -1.73 / 1.62 |
| T2 | -1.35 | 0 | 26 | -0.97 / -2.65 / 0.3 |
| T3 | -2.37 | 0 | 32 | -1.14 / -3.28 / 0.47 |

T1 sits near the middle of random long weeks (gold rose over 2017-26, so random longs earn too); T2 and T3 sit inside their
placebo spread, below its median.

## Informational (no test, not in Holm, not in the verdict)

| Row | Window | n | Gross R | Net R | 2x | Month t net |
|---|---|---|---|---|---|---|
| I1 T1 rule on the 30-year | IS | 35 | -0.028 | -0.071 | -0.113 | -0.55 |
| | OOS | 30 | +0.146 | +0.101 | +0.056 | 0.68 |
| I2 every 10Y up week > 1 sd, long (no lag condition) | IS | 86 | +0.106 | +0.063 | +0.020 | 0.62 |
| | OOS | 69 | +0.135 | +0.088 | +0.041 | 1.03 |
| I3 every 10Y down week > 1 sd, short (no lag condition) | IS | 69 | +0.024 | +0.007 | -0.009 | 0.09 |
| | OOS | 78 | +0.007 | -0.006 | -0.019 | -0.08 |

- **Gold's lag adds nothing.** Long after every big bond-up week (I2) earns the same +0.088R a trade out of sample as T1,
  on more than twice the trades; the lag condition only cut the sample. The catch-up idea is not visible.
- Co-move context: the median 52-week beta of gold's weekly return on the 10-year bond's was 0.43 in 2007-16 and 1.05 in
  2017-26 (2-year daily: 2.4 and 3.1). The link the macro stack ranks first is real and same-period, as `macro-gold` found
  for real yields; it does not carry into the next week or day by enough to trade.

## Reading

- Not an edge, and no proposal. T1 is positive in both windows before and after costs but nowhere near t 2 (OOS month t
  0.46, 30 trades in ten years) and no better than random long weeks of the same years.
- T3's out-of-sample t of -2.37 is negative, the wrong side of the hypothesis (gold went the other way of the 2-year's big
  days more often than with it, after lagging). It is not a finding: the test is one-sided by design, it is in the middle
  of its placebo (which is mostly short in a rising gold market), and any reverse rule would be post hoc and need its own
  pre-registration on other data.
- With `macro-gold` (real-yield momentum after the publication lag: correlation with gold's next day -0.015), `bond-lead-intraday`
  (one-hour lead smaller than costs) and `yield-fx-weekly` (2-year weekly into the dollar), this closes the bond-into-gold
  lead at the hour, day and week horizons on the council's data.

## What was not tested

Other thresholds, look-backs, betas or holds; the 5-year note; real yields from FRED or TIPS; intraday timing around the US
cash close; gold leading bonds; any use inside the gold book.

## To repeat

`node research/edge/gold-bond-lead/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-bond-lead/run.mjs full <dir>`. Tests: `tests/gold-bond-lead.test.mjs`.
