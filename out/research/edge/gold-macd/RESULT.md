# Result: MACD and 50/200 moving-average crosses on gold's daily chart (14 Nov 2026)

**Verdict: FAIL, 0 of 3: no test has an out-of-sample month t near 2 (best MACD long only +0.253R a trade, t 1.53, Holm p 0.39), none beats 38 of 40 placebos, and the 50/200 cross has 7 trades.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any number was computed). OANDA mid gold daily candles, council-data
`research/daily/xau.json`, weekends folded with `council/fills.mjs` `foldWeekend`, 20 March 2006 to 6 November 2026 (5,364
days). Every trade has a stop (k x ATR(14) of the signal day, never moved); $0.60 a round trip and overnight financing on
longs at `FIN.xau.long`. In sample = entries 2008-16, out of sample = 2017 to 6 Nov 2026. A stand-alone rule: not a gate,
exit, entry or size of the gold book, and owner decision 44 is untouched. Nothing live changed; no proposal.

| Test | Window | n | Win | R a trade, gross | R a trade, net | Total net | Worst DD | Month t | 2x costs |
|---|---|---|---|---|---|---|---|---|---|
| T1 MACD stop-and-reverse, 2 ATR | IS 2008-16 | 186 | 37 % | +0.149 | +0.090 | +16.8R | -7.6R | 0.92 | +0.032 |
| | OOS 2017-26 | 200 | 33 % | +0.115 | +0.045 | +9.0R | -13.3R | 0.47 | -0.025 |
| T2 MACD long only, 2 ATR | IS 2008-16 | 93 | 39 % | +0.249 | +0.148 | +13.8R | -7.4R | 0.97 | +0.047 |
| | OOS 2017-26 | 100 | 35 % | +0.379 | +0.253 | +25.3R | -8.7R | 1.53 | +0.127 |
| T3 50/200 SMA long only, 3 ATR | IS 2008-16 | 6 | 17 % | +1.181 | +0.681 | +4.1R | -5.1R | 0.48 | +0.182 |
| | OOS 2017-26 | 7 | 29 % | +1.669 | +0.797 | +5.6R | -4.6R | 0.47 | -0.075 |

Month t: net R summed by exit month over every calendar month of the window (IS 108, OOS 119 months).

## The pass bar, check by check

| Check | T1 | T2 | T3 (descriptive, OOS n < 30) |
|---|---|---|---|
| OOS net R a trade > 0 | yes (+0.045) | yes (+0.253) | yes (+0.797) |
| OOS month t >= 2, Holm p < 0.05 | no (t 0.47, Holm p 1.00) | no (t 1.53, Holm p 0.39) | no (t 0.47, Holm p 1.00) |
| Positive IS and both OOS halves (2017-21, 2022-26) | no (2017-21 -0.008R, n 90) | yes (+0.148, +0.126, +0.357) | no (2022-26 -1.219R, n 3) |
| OOS net > 0 at 2x costs | no (-0.025) | yes (+0.127) | no (-0.075) |
| Beats >= 38 of 40 placebos | no (27; placebo median +0.005R) | no (33; median +0.120R) | no (29; median +0.247R) |
| OOS n >= 30 | yes (200) | yes (100) | no (7) |

## What it shows

- **The long side is gold's own rise, not the signal.** The placebo (same number of trades, same sides, holding lengths and
  stops, random entry days) makes +0.120R a trade for T2 and +0.247R for T3 out of sample: random long entries on gold made
  money from 2017 on. T2's +0.253R beats that in 33 of 40 seeds, short of the 38 the bar asks, and its month t is 1.53. The
  short side adds nothing: T1 (long and short) is +0.045R a trade, about its placebo, and loses at 2x costs.
- **Costs and financing matter**: $0.60 and financing take about 0.07R a trade from T1 and 0.13R from T2; the stops are
  2 x ATR(14), from about $19 to $500 out of sample (wide in 2025-26), so the cost is small per trade but the edge it eats is small too.
- **The 50/200 cross is too rare to judge**: 6 trades in sample, 7 out of sample; one 2019 trade made +11.5R and 5 of the
  other 6 were stopped. After its stop in December 2023 it took no trade in the 2024-26 rally (no new cross).
- **Buy-and-hold** (one ounce, every night's financing charged on that day's close): 2008-16 +38.1 % before financing,
  -35.9 % after; 2017 to 6 Nov 2026 +253.8 % before, +155.6 % after. The rules' summed net trade returns (one ounce a trade,
  no leverage): T1 +38.9 % IS / +1.5 % OOS (in the market 98 % / 95 % of days), T2 +34.4 % / +51.7 % (51 %), T3 +54.0 % /
  +6.7 % (45 % / 29 %). Out of sample none comes near holding gold; in 2008-16 the long-only rules avoided financing on the
  flat days and did better than holding after financing, but that is the in-sample window and not a test.

Not an edge on any test; do not use MACD or the 50/200 cross as a gold rule, filter or bias. Nothing live changed and no
proposal is written.

To repeat: `node research/edge/gold-macd/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-macd/run.mjs full <dir>`. Tests: `tests/gold-macd.test.mjs`.
