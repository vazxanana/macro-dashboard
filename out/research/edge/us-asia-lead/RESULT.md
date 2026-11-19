# US cash session leading the Asian index session: JP225 and HK33 from the Asian open: result

Pre-registered in PREREGISTRATION.md (committed before any trade was simulated). Built 2026-11-14. Paper research only: nothing live changed.

## Verdict: FAIL: the Asian session in the US cash session's direction, entered at the Asian open, after a 0.04 % round trip, 2016-26: JP225 −0.041R a trade (n 2679, month-sum t −5.31), JP225 on strong US days −0.051R (n 826, t −3.39), HK33 −0.041R (n 2530, t −3.92); before costs −0.017R, −0.026R, −0.018R.

| Test | Window | n | Buys / sells | Gross R | Cost R | Net R | Net R at 2x cost | Month t gross | Month t net | Total net R | Max DD R | Gap in signal direction R |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| T1 JP225 | 2016-26 | 2679 | 1484 / 1195 | −0.017 | −0.025 | −0.041 | −0.066 | −2.16 | −5.31 | −111.0 | 111.3 | +0.009 |
| T1 JP225 | 2005-15 | 1239 | 670 / 569 | −0.005 | −0.023 | −0.028 | −0.051 | −0.36 | −2.16 | −34.2 | 34.8 | −0.012 |
| T2 JP225 strong US days | 2016-26 | 826 | 452 / 374 | −0.026 | −0.025 | −0.051 | −0.076 | −1.74 | −3.39 | −42.1 | 43.0 | +0.011 |
| T2 JP225 strong US days | 2005-15 | 378 | 187 / 191 | −0.029 | −0.023 | −0.053 | −0.076 | −1.24 | −2.19 | −19.9 | 19.9 | −0.026 |
| T3 HK33 | 2016-26 | 2530 | 1390 / 1140 | −0.018 | −0.023 | −0.041 | −0.064 | −1.76 | −3.92 | −104.1 | 104.9 | −0.245 |
| T3 HK33 | 2005-15 | 1114 | 599 / 515 | −0.029 | −0.028 | −0.057 | −0.085 | −1.72 | −3.39 | −63.2 | 63.4 | n/a |

## Pass conditions

| Test | net > 0 (2016-26) | net > 0 (2005-15) | Holm p < 0.05 | n ≥ 100 (T2: 50) each window | Pass |
|---|---|---|---|---|---|
| T1 | no | no | no (p 1, Holm 1) | yes | no |
| T2 | no | no | no (p 1, Holm 1) | yes | no |
| T3 | no | no | no (p 1, Holm 1) | yes | no |

## Placebo (40 seeds, mean net R a trade; reported, not a pass condition)

| Test | Window | Real | Random sign p5 / p50 / p95 (rank of real) | Other day's signal p5 / p50 / p95 (rank) |
|---|---|---:|---|---|
| T1 | 2016-26 | −0.041 | −0.034 / −0.020 / −0.012 (1 of 40) | −0.033 / −0.021 / −0.011 (0 of 40) |
| T1 | 2005-15 | −0.028 | −0.043 / −0.024 / −0.002 (15 of 40) | −0.046 / −0.025 / −0.010 (15 of 40) |
| T2 | 2016-26 | −0.051 | −0.044 / −0.021 / +0.001 (1 of 40) | −0.045 / −0.023 / +0.007 (0 of 40) |
| T2 | 2005-15 | −0.053 | −0.061 / −0.015 / +0.008 (5 of 40) | −0.064 / −0.014 / +0.014 (4 of 40) |
| T3 | 2016-26 | −0.041 | −0.037 / −0.024 / −0.006 (1 of 40) | −0.035 / −0.025 / −0.008 (1 of 40) |
| T3 | 2005-15 | −0.057 | −0.050 / −0.035 / −0.019 (2 of 40) | −0.051 / −0.033 / −0.010 (1 of 40) |

## What the gap took

- T1 JP225 2016-26: correlation of the US session return with the gap to the Asian open +0.01, with the Asian session after it −0.06 (n 2697); the gap in the signal's direction averaged +0.009R of the trade's stop.
- T1 JP225 2005-15: correlation of the US session return with the gap to the Asian open −0.08, with the Asian session after it −0.07 (n 1250); the gap in the signal's direction averaged −0.012R of the trade's stop.
- T2 JP225 strong US days 2016-26: correlation of the US session return with the gap to the Asian open −0.01, with the Asian session after it −0.09 (n 825); the gap in the signal's direction averaged +0.011R of the trade's stop.
- T2 JP225 strong US days 2005-15: correlation of the US session return with the gap to the Asian open −0.12, with the Asian session after it −0.14 (n 378); the gap in the signal's direction averaged −0.026R of the trade's stop.
- T3 HK33 2016-26: correlation of the US session return with the gap to the Asian open −0.38, with the Asian session after it +0.38 (n 12); the gap in the signal's direction averaged −0.245R of the trade's stop.
- T3 HK33 2005-15: correlation of the US session return with the gap to the Asian open n/a, with the Asian session after it n/a (n 0); the gap in the signal's direction averaged n/aR of the trade's stop.

Added after the run (descriptive, not pre-registered): OANDA's JP225 trades through the US session, so the price "at the US close" above already holds the US move; the cash-to-cash gap, from the Asian market's own close BEFORE the US session to its next open, is the one that prices it:

- T1 JP225 2016-26: correlation of the US session return with the cash-to-cash gap +0.58, the gap in the US session's direction on 68.7 % of days, correlation with the Asian session after the open −0.06 (n 2696).
- T1 JP225 2005-15: correlation of the US session return with the cash-to-cash gap +0.57, the gap in the US session's direction on 70.2 % of days, correlation with the Asian session after the open −0.07 (n 1163).
- T2 JP225 strong US days 2016-26: correlation of the US session return with the cash-to-cash gap +0.70, the gap in the US session's direction on 84.9 % of days, correlation with the Asian session after the open −0.09 (n 826).
- T2 JP225 strong US days 2005-15: correlation of the US session return with the cash-to-cash gap +0.68, the gap in the US session's direction on 85.1 % of days, correlation with the Asian session after the open −0.12 (n 356).
- T3 HK33 2016-26: correlation of the US session return with the cash-to-cash gap +0.45, the gap in the US session's direction on 64.9 % of days, correlation with the Asian session after the open −0.08 (n 2434).
- T3 HK33 2005-15: correlation of the US session return with the cash-to-cash gap +0.60, the gap in the US session's direction on 71.1 % of days, correlation with the Asian session after the open −0.04 (n 1075).

## Buy days and sell days apart

- T1 JP225 2016-26: buys n 1484, −0.015R gross, −0.040R net; sells n 1195, −0.019R gross, −0.044R net.
- T1 JP225 2005-15: buys n 670, −0.025R gross, −0.048R net; sells n 569, +0.019R gross, −0.004R net.
- T2 JP225 strong US days 2016-26: buys n 452, −0.023R gross, −0.048R net; sells n 374, −0.030R gross, −0.054R net.
- T2 JP225 strong US days 2005-15: buys n 187, −0.049R gross, −0.072R net; sells n 191, −0.010R gross, −0.033R net.
- T3 HK33 2016-26: buys n 1390, −0.023R gross, −0.045R net; sells n 1140, −0.013R gross, −0.036R net.
- T3 HK33 2005-15: buys n 599, −0.045R gross, −0.073R net; sells n 515, −0.010R gross, −0.038R net.

## By year (net R a trade, total, n)

| Year | T1 JP225 | T2 JP225 strong US days | T3 HK33 |
|---|---|---|---|
| 2010 | −0.057 (−6.7, n 118) | −0.116 (−3.7, n 32) | — |
| 2011 | −0.048 (−7.7, n 159) | −0.082 (−4.2, n 51) | −0.075 (−14.8, n 197) |
| 2012 | +0.033 (+7.5, n 227) | −0.001 (−0.1, n 66) | −0.025 (−5.7, n 227) |
| 2013 | −0.041 (−10.1, n 246) | −0.018 (−1.4, n 73) | −0.097 (−22.0, n 227) |
| 2014 | −0.012 (−2.9, n 242) | −0.059 (−5.0, n 85) | −0.023 (−5.2, n 229) |
| 2015 | −0.058 (−14.2, n 247) | −0.077 (−5.5, n 71) | −0.066 (−15.5, n 234) |
| 2016 | −0.038 (−9.5, n 246) | −0.059 (−4.1, n 70) | −0.072 (−16.7, n 231) |
| 2017 | −0.041 (−10.0, n 243) | −0.028 (−2.1, n 73) | −0.046 (−10.8, n 233) |
| 2018 | −0.046 (−11.3, n 244) | −0.129 (−9.8, n 76) | −0.024 (−5.5, n 230) |
| 2019 | −0.045 (−11.2, n 246) | −0.041 (−2.7, n 67) | −0.058 (−13.4, n 229) |
| 2020 | +0.008 (+2.0, n 244) | −0.076 (−5.1, n 67) | −0.035 (−8.0, n 230) |
| 2021 | −0.062 (−15.4, n 251) | −0.012 (−1.1, n 86) | −0.048 (−11.3, n 237) |
| 2022 | −0.015 (−3.7, n 245) | −0.001 (−0.1, n 80) | +0.008 (+1.8, n 232) |
| 2023 | −0.057 (−14.0, n 246) | −0.020 (−1.8, n 89) | −0.074 (−17.1, n 232) |
| 2024 | −0.021 (−5.2, n 249) | −0.027 (−2.0, n 74) | −0.007 (−1.7, n 235) |
| 2025 | −0.070 (−17.4, n 247) | −0.100 (−7.8, n 78) | −0.038 (−8.8, n 234) |
| 2026 | −0.071 (−15.4, n 218) | −0.085 (−5.6, n 66) | −0.061 (−12.5, n 207) |

## Detail

- T1 JP225 2016-26: win 43.7 %, stopped 87, median stop 1.662 % of price, months 131; dropped US days (whole run) {"data":1544,"atr":0}.
- T1 JP225 2005-15: win 46.6 %, stopped 50, median stop 1.737 % of price, months 69; dropped US days (whole run) {"data":1544,"atr":0}.
- T2 JP225 strong US days 2016-26: win 43.7 %, stopped 37, median stop 1.665 % of price, months 131; dropped US days (whole run) {"data":1544,"atr":0}.
- T2 JP225 strong US days 2005-15: win 43.7 %, stopped 20, median stop 1.732 % of price, months 69; dropped US days (whole run) {"data":1544,"atr":0}.
- T3 HK33 2016-26: win 47.5 %, stopped 155, median stop 1.906 % of price, months 131; dropped US days (whole run) {"data":1822,"atr":0}.
- T3 HK33 2005-15: win 45.5 %, stopped 90, median stop 1.446 % of price, months 58; dropped US days (whole run) {"data":1822,"atr":0}.

## Reading

Not an edge, and not even the right sign. The US cash session does lead Asia, but through the opening gap: its return is correlated about +0.45 to +0.70 with the Tokyo and Hong Kong cash-to-cash gap (the gap goes the US way on 65-85 % of days), and that gap is already in the entry price. Inside the Asian session that follows, what is left is a slight reversal, not a continuation: correlation of the US return with the Asian session -0.04 to -0.12, gross R in the US direction negative in all six test-window cells (JP225 2016-26 -0.017R, month-sum t -2.16), and the real stream sits at or below the 5th percentile of both placebos in 2016-26. After the 0.04 % round trip (about 0.025R at a one-ATR stop) every cell loses (t -2.2 to -5.3). The reverse trade was not tested and is not proposed: its gross figure (+0.005 to +0.029R a trade) is about the size of the cost or smaller. Never call this an edge and never propose it as a council system; nothing live changed.

## Data

OANDA mid M15: US500 509220 candles 2005-01-02 to 2026-11-13; JP225 440507 candles 2005-01-03 to 2026-11-13; HK33 229874 candles 2005-01-03 to 2026-11-13; 5493 US cash sessions with both candles. Asian exchange holidays are not excluded (pre-registered). Where the data reaches: OANDA's JP225 has no candles in Tokyo hours before mid 2010 and HK33 has no 01:30 UTC candle before March 2011 (Hong Kong opened at 10:00 HKT until then), so the replication window holds JP225 from 2010 and HK33 from 2011 (the dropped US days above). To repeat: `node --use-env-proxy research/edge/us-asia-lead/run.mjs fetch <dir>`, then `node research/edge/us-asia-lead/run.mjs full <dir>` (candles kept out of git).
