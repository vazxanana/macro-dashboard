# Result: the "double seven" pullback buy on gold's daily chart, judged against gold's own drift (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold's 7-day lowest close above its 200-day average made +0.057R a trade net OOS, only +0.005R over the same buy on every day (n 115, t 0.08).**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any number was computed). OANDA mid gold daily candles, council-data
`research/daily/xau.json`, weekends folded with `council/fills.mjs` `foldWeekend`, 5,369 days to 13 November 2026. The rule is
read on the close, the order fills at the next open, a stop of 2 x ATR(14) on every trade, out at the open after the first
opposite seven-day extreme close or after 15 days; one position at a time in each signal stream. $0.60 a round trip and
overnight financing on buys at `FIN.xau.long`. Each test is judged as an EXCESS over the same trade entered after every
eligible day of the window (the baseline = gold's drift for that trade shape and filter). In sample = entries 2007-16, out of
sample = 2017 to 13 Nov 2026. A stand-alone rule of my own choosing: not a gate, exit, entry or size of the gold book; owner
decision 44 is untouched. Nothing live changed; no proposal.

| Test | Window | n | Win | R gross | R net | Every-day net | Excess net | Excess t (month) | Net t (month) | Excess at 2x costs |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 low-7 buy above the 200-day average (primary) | IS 2007-16 | 101 | 60% | +0.036 | -0.019 | +0.021 | -0.040 | -0.60 | -0.29 | -0.053 |
| | OOS 2017-26 | 115 | 67% | +0.111 | +0.057 | +0.051 | +0.005 | 0.08 | 0.80 | -0.007 |
| T2 high-7 sell below the 200-day average | IS 2007-16 | 56 | 55% | -0.088 | -0.103 | -0.037 | -0.067 | -0.74 | -1.14 | -0.066 |
| | OOS 2017-26 | 49 | 55% | -0.121 | -0.137 | -0.076 | -0.060 | -0.53 | -1.18 | -0.061 |
| T3 low-7 buy, no filter | IS 2007-16 | 192 | 58% | +0.018 | -0.037 | -0.023 | -0.014 | -0.28 | -0.72 | -0.027 |
| | OOS 2017-26 | 184 | 63% | +0.064 | +0.009 | +0.043 | -0.034 | -0.62 | 0.16 | -0.047 |

Baselines (every eligible day, overlapping): T1 1,627 buys in sample and 1,831 out of sample, T2 975 and 730 sells, T3 2,602
and 2,560 buys. Month t: the excess (net R less the window's every-day mean) summed by the calendar month of entry over every
month of the window (IS 120, OOS 119 months).

## The pass bar, check by check

| Check | T1 | T2 | T3 |
|---|---|---|---|
| OOS excess t >= 2, Holm p < 0.05 | no (t 0.08, Holm p 1.00) | no (t -0.53, Holm p 1.00) | no (t -0.62, Holm p 1.00) |
| IS excess > 0 (same sign) | no (-0.040) | no (-0.067) | no (-0.014) |
| OOS excess at 2x costs > 0 | no (-0.007) | no (-0.061) | no (-0.047) |
| Beats >= 38 of 40 placebos | no (18; placebo median +0.013R) | no (10; median +0.040R) | no (11; median -0.009R) |
| n >= 100 in each window | yes (101 / 115) | no (56 / 49) | yes (192 / 184) |

OOS halves (reported only): T1 +0.057R over the every-day buy in 2017-21 (n 55, t 0.60) and -0.041R from 2022 (n 60, t -0.39).

## Reading

- **The pullback buy is gold's drift.** Out of sample the double seven wins two trades in three and makes +0.057R a trade
  after costs, but buying after ANY day above the 200-day average with the same stop and exit makes +0.051R. The seven-day
  low adds +0.005R, inside the placebo spread (18 of 40 random draws do better). In sample it is 0.040R a trade worse than
  the every-day buy. The high win rate is the exit's doing (a quick exit on the first seven-day high close), not the entry's.
- **The mirror sell loses** in both windows, on top of a losing every-day sell (gold rose in both periods), and has too few
  signals to judge (56 / 49).
- **Without the trend filter** the low-7 buy is worse than the every-day buy out of sample (-0.034R, t -0.62).
- Costs are not what sank it: before costs the primary is +0.111R against +0.093R for the every-day buy (+0.018R).

Not an edge: no rule, gate, size or filter follows from this, and the 7 / 200 / 2 ATR / 15-day settings will not be retuned.

## Files

- `run.mjs` (`fetch <dir>` copies the candle file from council-data with `git show`, `full <dir>` writes `result.json`),
  `result.json` (every statistic, the 40 placebo excesses, the OOS signal trades), `tests/gold-double-seven.test.mjs`.
