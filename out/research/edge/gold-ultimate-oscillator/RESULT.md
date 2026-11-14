# Result: Williams' Ultimate Oscillator extremes on gold's daily chart (14 Nov 2026)

**Verdict: FAIL, 0 of 3: entering UO 35 / 65 does no better than the same-side trade on any day (OOS excess -0.021R, n 117, t -0.27) and loses net (-0.095R).**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any return was computed). OANDA mid gold daily candles,
council-data `research/daily/xau.json`, weekends folded with `council/fills.mjs` `foldWeekend`, 20 March 2006 to 13 November
2026 (5,369 days). UO(7, 14, 28); a long when it closes into < 35, a short when it closes into > 65; entry at the next open,
stop 2 x ATR(14) never moved, out at the open five days later. $0.60 a round trip and overnight financing on buys at
`FIN.xau.long`. Excess = a signal trade's net R minus the mean net R of the same trade taken after every day of the window
(same side). In sample = entries 2007-16, out of sample = 2017 to 13 Nov 2026. A stand-alone rule: not a gate, exit, entry
or size of the gold book; owner decision 44 is untouched. Nothing live changed; no proposal.

| Test | Window | n | Win | R gross | R net | Net 2x costs | Baseline net | Excess net | Excess 2x | Month t (excess) | Month t (net) | Worst DD |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 both sides (primary) | IS 2007-16 | 121 | 44 % | -0.070 | -0.094 | -0.118 | | -0.047 | -0.047 | -0.71 | -1.39 | -15.7R |
| | OOS 2017-26 | 117 | 41 % | -0.076 | -0.095 | -0.115 | | -0.021 | -0.019 | -0.27 | -1.17 | -18.1R |
| T2 long (oversold) | IS 2007-16 | 30 | 53 % | +0.019 | -0.025 | -0.069 | -0.001 | -0.024 | -0.020 | -0.18 | -0.19 | -5.2R |
| | OOS 2017-26 | 24 | 50 % | +0.107 | +0.062 | +0.017 | +0.063 | -0.001 | +0.006 | -0.01 | 0.41 | -4.5R |
| T3 short (overbought) | IS 2007-16 | 91 | 41 % | -0.100 | -0.117 | -0.135 | -0.062 | -0.055 | -0.056 | -0.68 | -1.41 | -15.7R |
| | OOS 2017-26 | 93 | 39 % | -0.123 | -0.136 | -0.148 | -0.109 | -0.026 | -0.025 | -0.28 | -1.39 | -15.9R |

Month t: summed by exit month over every calendar month of the window (IS 120, OOS 119 months). Baseline = the same trade
after every day (OOS 2,557 a side, IS 2,602): longs net -0.001R (IS) and +0.063R (OOS), shorts -0.062R and -0.109R.

## The pass bar, check by check

| Check | T1 | T2 | T3 |
|---|---|---|---|
| OOS excess > 0, month t >= 2, Holm p < 0.05 | no (-0.021, t -0.27, Holm p 1.00) | no (-0.001, t -0.01, Holm p 1.00) | no (-0.026, t -0.28, Holm p 1.00) |
| IS excess > 0 | no (-0.047) | no (-0.024) | no (-0.055) |
| OOS excess at 2x costs > 0 | no | yes (+0.006) | no |
| OOS net R > 0 | no (-0.095) | yes (+0.062) | no (-0.136) |
| Beats >= 38 of 40 placebos | no (7) | no (18) | no (10) |
| OOS n (>= 100 for T1, >= 30 otherwise) | yes (117) | no (24) | yes (93) |

## What it means

- The oscillator's extremes carry no information about gold's next five days that a trade on any day does not: every
  excess is within a fraction of a standard error of zero, in both windows and on both sides.
- The long side's positive net (+0.062R OOS) is gold's drift, not the signal: the every-day long made +0.063R in the same
  window. The short side loses because shorting gold lost on any day (-0.109R OOS), and the overbought entry is no better.
- The placebo (40 seeded draws of the same number of random OOS days per side) is beaten 7 times out of 40 by T1: the real
  signal sits below the middle of chance.
- Williams' own 30 / 70 thresholds were not testable (about 8 long crossings a window); 35 / 65 was fixed from the event
  count before any return. Divergence signals, his intended use, are rarer still and were not tested.

Not an edge. Never a council rule, filter or bias gate. To repeat: `node research/edge/gold-ultimate-oscillator/run.mjs
fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Tests:
`tests/gold-ultimate-oscillator.test.mjs`.
