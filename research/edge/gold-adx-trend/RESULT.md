# Result: Wilder's ADX / directional-movement trend rule on gold's daily chart (14 Nov 2026)

**Verdict: FAIL, 0 of 3: the primary long-short ADX rule loses in sample (-0.043R) and has OOS t 0.67; the best, long only, +0.411R OOS has t 1.99, Holm p 0.15, 35 of 40 placebos.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any number was computed). OANDA mid gold daily candles, council-data
`research/daily/xau.json`, weekends folded with `council/fills.mjs` `foldWeekend`, 20 March 2006 to 6 November 2026 (5,364
days). Wilder DMI / ADX(14); state +1 / -1 when ADX > 25 and the stronger DI points that way. Every trade has a stop
(2 x ATR(14) of the signal day, never moved); $0.60 a round trip and overnight financing on buys at `FIN.xau.long`. In
sample = entries 2007-16, out of sample = 2017 to 6 Nov 2026. Topic chosen by me: no item of the 14 Nov untested-backlog list
is a stand-alone gold rule. A stand-alone rule: not a gate, exit, entry or size of the gold book; owner decision 44 is
untouched. Nothing live changed; no proposal.

| Test | Window | n | Win | R a trade, gross | R a trade, net | Total net | Worst DD | Month t | 2x costs |
|---|---|---|---|---|---|---|---|---|---|
| T1 ADX trend, long and short (primary) | IS 2007-16 | 82 | 32 % | +0.020 | -0.043 | -3.6R | -12.3R | -0.41 | -0.107 |
| | OOS 2017-26 | 95 | 33 % | +0.174 | +0.083 | +7.9R | -9.1R | 0.67 | -0.008 |
| T2 ADX trend, long only | IS 2007-16 | 41 | 34 % | +0.272 | +0.159 | +6.5R | -5.7R | 0.73 | +0.047 |
| | OOS 2017-26 | 51 | 43 % | +0.571 | +0.411 | +21.0R | -3.5R | 1.99 | +0.251 |
| T3 DI cross stop-and-reverse | IS 2007-16 | 227 | 30 % | +0.108 | +0.050 | +11.4R | -8.1R | 0.50 | -0.007 |
| | OOS 2017-26 | 218 | 24 % | +0.084 | +0.010 | +2.3R | -15.0R | 0.13 | -0.063 |

Month t: net R summed by exit month over every calendar month of the window (IS 120, OOS 119 months).

## The pass bar, check by check

| Check | T1 | T2 | T3 |
|---|---|---|---|
| OOS net R a trade > 0 | yes (+0.083) | yes (+0.411) | yes (+0.010) |
| OOS month t >= 2, Holm p < 0.05 | no (t 0.67, Holm p 1.00) | no (t 1.99, Holm p 0.15) | no (t 0.13, Holm p 1.00) |
| IS net R a trade > 0 (same sign) | no (-0.043) | yes (+0.159) | yes (+0.050) |
| OOS net > 0 at 2x costs | no (-0.008) | yes (+0.251) | no (-0.063) |
| Beats >= 38 of 40 placebos | no (27; placebo median +0.013R) | no (35; median +0.146R) | no (24; median -0.005R) |
| OOS n >= 30 | yes (95) | yes (51) | yes (218) |

## Reading

- **The primary rule fails on every line but the sign of its OOS mean.** Long and short together it lost in sample, and the
  out-of-sample gain came from 2017-21 (+0.310R, n 35) and turned negative in 2022-26 (-0.050R, n 60): the short side gave back
  what the long side made in gold's strongest decade.
- **Long only is gold's drift, not the indicator.** T2 makes +0.411R a trade out of sample (both halves positive: 2017-21
  +0.572R, n 20; 2022-26 +0.307R, n 31) but random long entries with the same holding lengths and stops make +0.146R (placebo
  median), and the rule beats only 35 of 40. Gold bought and held rose 254 % before financing over the out-of-sample window.
  With 51 trades its month t of 1.99 does not reach 2, and after Holm over three tests p is 0.15. It is in the market 31 % of
  out-of-sample days.
- **The plain DI cross** trades about 22 times a year and is costs: +0.084R gross, +0.010R net, negative at 2x costs.
- Nothing here is an edge; no proposal is written. The same lesson as `gold-macd`: a daily trend indicator on gold looks good
  long only because gold rose, and the placebo shows how much of it the clock alone gives.

## Files

- `run.mjs` (`fetch <dir>`: copies council-data's `research/daily/xau.json` with `git show`, no network; `full <dir>`: runs
  the study and writes `result.json`), `result.json` (every statistic, the 40 placebo scores, the out-of-sample trade lists),
  `tests/gold-adx-trend.test.mjs`.
