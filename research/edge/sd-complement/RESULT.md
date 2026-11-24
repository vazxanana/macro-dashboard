# Supply / demand, completed: what was missing, and the zones as a breakout filter (result)

**Verdict: FAIL. 0 of 6 supply / demand tests and 0 of 2 breakout filters pass; the best test, A1 premium / discount, made +0.013R a trade before costs in 2015-26 (n 3,562, month t 0.56) and -0.007R on the holdout (n 1,934, t -0.22); breakouts away from a defended zone, 2024 on: gold +0.237R (n 34), USD/JPY +0.053R (n 36) after costs.**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## Part A: the parts of a supply / demand trade the plain reading left out

H4 base zones (all shapes), first touch on M15, market entry, stop past the far side + 0.1 ATR, 2R, 3 days, as `grid7-sd-wide`,
with ONE addition per test. Ten markets 2005-14 (disc) and 2015-26 (conf); eight holdout markets no supply / demand study had
read, 2019-26 (hold). R a trade before costs (month t), after costs beside. Costs **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy, nas100, spx500, de40, gbpjpy, audjpy, cadjpy, eurgbp, euraud.

| Test | disc n | disc R (t) | conf n | conf R (t) | conf after costs | hold n | hold R (t) | hold after costs | control R disc / conf / hold | vs ctl t (disc / conf) | Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| A1 premium / discount | 3,098 | +0.021 (0.86) | 3,562 | +0.013 (0.56) | -0.032 | 1,934 | -0.007 (-0.22) | -0.039 | +0.009 / -0.007 / -0.025 | 0.44 / 0.76 | 1.000 | no |
| A2 Daily trend | 3,644 | +0.023 (0.84) | 4,163 | -0.038 (-1.60) | -0.086 | 2,235 | -0.022 (-0.79) | -0.054 | +0.018 / -0.034 / -0.031 | 0.18 / -0.17 | 1.000 | no |
| A3 quality | 1,687 | +0.009 (0.27) | 1,952 | -0.011 (-0.36) | -0.063 | 943 | -0.067 (-1.65) | -0.103 | -0.008 / -0.017 / -0.069 | 0.45 / 0.16 | 1.000 | no |
| A4 opposite-zone target | 2,400 | +0.078 (1.67) | 2,876 | -0.026 (-0.65) | -0.074 | 1,542 | +0.101 (1.85) | +0.069 | +0.050 / +0.026 / -0.007 | 0.53 / -1.20 | 1.000 | no |
| A5 resting order at the near line | 6,327 | +0.011 (0.69) | 7,235 | -0.027 (-1.68) | -0.074 | 3,897 | +0.010 (0.48) | -0.021 | +0.014 / -0.010 / -0.020 | -0.16 / -0.96 | 1.000 | no |
| A6 A1 + A2 + A3 | 335 | -0.145 (-1.96) | 366 | -0.101 (-1.54) | -0.152 | 169 | +0.101 (0.97) | +0.062 | -0.108 / -0.075 / +0.056 | -0.46 / -0.33 | 1.000 | no |

| Test | n | before costs > 0, t >= 2 (all windows) | Holm | beats control | after costs > 0 (conf, hold) |
|---|---|---|---|---|---|
| A1 premium / discount | yes | no | no | no | no |
| A2 Daily trend | yes | no | no | no | no |
| A3 quality | yes | no | no | no | no |
| A4 opposite-zone target | yes | no | no | no | no |
| A5 resting order at the near line | yes | no | no | no | no |
| A6 A1 + A2 + A3 | yes | no | no | no | no |

## Part B: the zones as a filter on the two passing breakouts

Gold T1 and USD/JPY T1 every day from 2010; kept = a fresh H4 zone of the trade's side had its first touch in the 48 hours
before the day's open and is still alive, and none of the other side; against = only the other side. R after costs.

| Market | Window | all n / net | kept n / net (month t) | kept 2x cost | against n / net | neither | kept - against (Welch t) |
|---|---|---|---|---|---|---|---|
| xau | REP | 1842 / +0.043 | 159 / +0.004 (0.04) | -0.081 | 148 / +0.169 | 1535 | -0.165 (-1.08) |
| xau | IS | 747 / +0.030 | 60 / +0.113 (0.92) | +0.059 | 50 / +0.073 | 637 | +0.040 (0.16) |
| xau | OOS | 567 / +0.169 | 34 / +0.237 (0.71) | +0.209 | 45 / +0.191 | 488 | +0.045 (0.14) |
| usdjpy | REP | 1886 / +0.046 | 167 / +0.055 (0.55) | +0.023 | 140 / -0.020 | 1579 | +0.075 (0.60) |
| usdjpy | IS | 761 / +0.070 | 60 / +0.035 (0.29) | +0.007 | 68 / +0.135 | 633 | -0.100 (-0.47) |
| usdjpy | OOS | 552 / +0.116 | 36 / +0.053 (0.28) | +0.022 | 46 / +0.433 | 470 | -0.380 (-1.48) |

- xau: kept - against over 2010 to now, Welch t -0.78; Holm on OOS 0.478; checks oos no, is yes, rep yes, cost2x yes, adds no, holm no: **fail**.
- usdjpy: kept - against over 2010 to now, Welch t -0.53; Holm on OOS 0.478; checks oos no, is yes, rep yes, cost2x yes, adds no, holm no: **fail**.

## Checks

- Cut test: 17 cuts on xau, eurusd, usdjpy, gbpjpy: 155,969 Part A signals known by the cut dates, 0 missing or extra on candles cut there.
- Breakout harness: the unfiltered trades here against `vb-structure-filter`'s published figures: xau REP 1842 / +0.043 (published 1841 / +0.042); xau IS 747 / +0.030 (published 747 / +0.031); usdjpy REP 1886 / +0.046 (published 1886 / +0.046); usdjpy IS 761 / +0.070 (published 761 / +0.070).
- Every market-entry trade has its stop on the losing side of the fill (the run throws otherwise); fills past the stop and risks under the round trip are no trades, for the tests and the controls alike.

| Market | set | candles from | zones | trades (incl. controls) | past the stop | risk under cost | no opposite target |
|---|---|---|---:|---:|---:|---:|---:|
| xau | main | 2006-03-19 | 1,492 | 13,235 | 8 | 9 | 2,950 |
| xag | main | 2006-03-19 | 1,541 | 13,204 | 9 | 127 | 2,921 |
| eurusd | main | 2004-01-01 | 1,694 | 15,354 | 25 | 0 | 3,430 |
| gbpusd | main | 2004-01-01 | 1,662 | 15,003 | 3 | 1 | 3,310 |
| usdjpy | main | 2004-01-01 | 1,616 | 14,811 | 27 | 0 | 3,179 |
| audusd | main | 2004-01-01 | 1,704 | 15,873 | 14 | 0 | 3,362 |
| nzdusd | main | 2004-01-01 | 1,602 | 14,437 | 22 | 1 | 3,156 |
| usdcad | main | 2004-01-01 | 1,622 | 14,852 | 5 | 0 | 3,092 |
| usdchf | main | 2004-01-01 | 1,603 | 14,549 | 10 | 1 | 3,110 |
| eurjpy | main | 2004-01-01 | 1,681 | 15,418 | 35 | 1 | 3,310 |
| nas100 | holdout | 2018-01-01 | 713 | 5,662 | 2 | 0 | 1,251 |
| spx500 | holdout | 2018-01-01 | 690 | 5,639 | 11 | 0 | 1,248 |
| de40 | holdout | 2018-01-02 | 547 | 4,694 | 23 | 0 | 1,065 |
| gbpjpy | holdout | 2018-01-01 | 618 | 4,864 | 13 | 0 | 1,195 |
| audjpy | holdout | 2018-01-01 | 699 | 5,760 | 27 | 1 | 1,374 |
| cadjpy | holdout | 2018-01-01 | 666 | 5,460 | 9 | 1 | 1,243 |
| eurgbp | holdout | 2018-01-01 | 607 | 4,689 | 19 | 1 | 1,180 |
| euraud | holdout | 2018-01-01 | 671 | 5,723 | 10 | 0 | 1,304 |

## What it means

None of the classic missing pieces (location in the Daily range, the Daily trend, a short base with a structure-breaking leg
out, the opposite zone as target, a resting order at the near line) turns the supply / demand zone into something better than a
random band at the same distance, on the main markets or on eight markets it had never seen. Used as a filter, a freshly
defended zone does not improve the two breakout rules either. The zones add nothing measurable; the two breakouts stay as they
are, judged by their forward records. Do not re-test variants of these tests on these markets and years.
