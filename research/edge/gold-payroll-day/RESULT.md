# Result: gold in the three days after US payrolls, and on the release day (14 Nov 2026)

**Verdict: FAIL: long gold the 3 days after US payrolls beats the year's every-day long by +0.026R net 2017-26 (n 114, month t +0.51, 26 of 40 placebos): t under 2, placebo short of 38 of 40; T2 fails.**

Judged on the pre-registered bar (PREREGISTRATION.md, pushed alone before any gold return was computed). A stand-alone calendar study on spot gold: it reads no record or position of the live gold book and is not a gate, exit, entry or size of it (owner item 44). Paper only; nothing live changed; no proposal follows. Not an edge: every figure carries its n and t.

Data: OANDA mid daily gold candles (council-data research/daily/xau.json, 2006-03-20 to 2026-11-13, 5369 folded candles; weekend stubs folded into Monday with council/fills.mjs foldWeekend; close = 00:00 UTC). Payroll dates: the BLS rule copied from gold-pre-nfp-replicate (2007-21, with its two 2013 shutdown exceptions, its five "moves" not used) and council/events.mjs (2022 on). Costs: $0.60 a round trip plus nights x FIN.xau.long (0.000148, 2026-11-11) x entry. Stop 2 x ATR(20) daily, fixed. Baseline: the same long with the same hold, stop and costs from the close of every candle whose exit falls in the same year, payroll days included; excess = event net R − that year's baseline mean.

## The two tests (Holm over both; the verdict is T1)

| Test | Window | n | months | gross R | net R | excess gross R | excess net R | excess 2x R | event t (excess) | month-sum t (excess net) | month t gross | one-sided p | Holm p | stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | in sample 2007-16 | 119 | 119 | +0.109 | +0.069 | +0.080 | +0.076 | +0.073 | +1.40 | +1.40 | +1.46 | 0.082 | - | 6 |
| T1 | out of sample 2017-26 | 114 | 114 | +0.102 | +0.059 | +0.029 | +0.026 | +0.022 | +0.51 | +0.51 | +0.58 | 0.305 | 0.611 | 7 |
| T2 | in sample 2007-16 | 119 | 119 | +0.070 | +0.048 | +0.061 | +0.063 | +0.065 | +1.58 | +1.58 | +1.54 | 0.058 | - | 4 |
| T2 | out of sample 2017-26 | 114 | 114 | +0.006 | −0.015 | −0.017 | −0.014 | −0.012 | −0.38 | −0.38 | −0.44 | 0.646 | 0.646 | 5 |

## Pass bar

| Check | T1 | T2 |
|---|---|---|
| OOS month-sum t >= 2 and Holm p < 0.05 | no | no |
| in-sample excess net > 0 | yes | yes |
| OOS excess at 2x costs > 0 | yes | no |
| OOS net R > 0 | yes | no |
| beats >= 38 of 40 placebo draws | no | no |
| **pass** | **no** | **no** |

## Placebo

40 seeded draws (mulberry32, seed 20261114 + draw): every out-of-sample event moved to a random gold candle of the same calendar month that is not a payroll release day, same hold, stop and costs; the draw's mean excess net R.

- T1: the rule's +0.026R beats 26 of 40 draws (draw median +0.005R, range −0.126 to +0.117R).
- T2: the rule's −0.014R beats 15 of 40 draws (draw median −0.004R, range −0.056 to +0.055R).

## Baseline by year (net R of the every-day long)

| Year | T1 n | T1 net R | T2 n | T2 net R |
|---|---|---|---|---|
| 2007 | 261 | +0.058 | 261 | −0.004 |
| 2008 | 262 | +0.005 | 262 | −0.007 |
| 2009 | 261 | +0.049 | 261 | +0.006 |
| 2010 | 260 | +0.071 | 260 | +0.011 |
| 2011 | 260 | +0.044 | 260 | −0.003 |
| 2012 | 260 | −0.027 | 260 | −0.015 |
| 2013 | 259 | −0.133 | 259 | −0.055 |
| 2014 | 260 | −0.072 | 260 | −0.034 |
| 2015 | 259 | −0.088 | 259 | −0.042 |
| 2016 | 260 | +0.009 | 260 | −0.010 |
| 2017 | 259 | +0.017 | 259 | −0.007 |
| 2018 | 260 | −0.062 | 260 | −0.038 |
| 2019 | 260 | +0.058 | 260 | +0.003 |
| 2020 | 260 | +0.093 | 260 | +0.023 |
| 2021 | 258 | −0.035 | 258 | −0.027 |
| 2022 | 259 | −0.034 | 259 | −0.019 |
| 2023 | 259 | +0.036 | 259 | −0.004 |
| 2024 | 261 | +0.077 | 261 | +0.021 |
| 2025 | 260 | +0.208 | 260 | +0.063 |
| 2026 | 226 | −0.025 | 226 | −0.020 |

## Notes

- T1 (primary): long the three days after the release: 4 event(s) skipped (2015-04-03: no gold candle on the release date; 2021-04-02: no gold candle on the release date; 2023-04-07: no gold candle on the release date; 2026-04-03: no gold candle on the release date).
- T2: long over the release day: 4 event(s) skipped (2015-04-03: no gold candle on the release date; 2021-04-02: no gold candle on the release date; 2023-04-07: no gold candle on the release date; 2026-04-03: no gold candle on the release date).
- The pre-registration counted 120 in-sample and 117 out-of-sample release dates; releases on Good Friday have no OANDA gold candle and are skipped as pre-registered, leaving 119 and 114 (both still at least 100).
- Payroll dates 2007-21 are derived by rule and not verified by a BLS page (bls.gov is refused by the sandbox proxy); gold-pre-nfp-replicate verified 165 of 189 derived dates 2006-21 on the release minute.
- Financing at today's rate for every year; the daily close is 00:00 UTC, not the 17:00 New York rollover.
- To repeat: `node research/edge/gold-payroll-day/run.mjs fetch <dir>`, then `node research/edge/gold-payroll-day/run.mjs full <dir>`; delete `<dir>` after.
