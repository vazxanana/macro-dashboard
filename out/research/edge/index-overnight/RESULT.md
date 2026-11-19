# Overnight drift on US index CFDs: close-to-open longs on US500 and NAS100: result

Pre-registered in PREREGISTRATION.md (committed before any trade was simulated). Built 2026-11-14. Paper research only: nothing live changed.

## Verdict: FAIL: the overnight long after spread and financing, 2016-26: US500 −0.022R a trade (n 2721, month-sum t −2.86), NAS100 −0.006R (n 2721, t −0.84); before costs +0.023R and +0.026R (t +2.87, +3.54).

T1 (US500 overnight) made −0.022R a trade after costs in 2016-26 (n 2721, month-sum t −2.86, +0.023R before costs); T2 (NAS100 overnight) −0.006R (n 2721, t −0.84, +0.026R before costs). Pooled monthly t −1.93 (2016-26), −2.47 (2005-15).

| Test | Window | n | Gross R | Spread R | Financing R | Net R | Month t gross | Month t net | Total net R | Max DD R | Placebo net R p5 / p50 / p95 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| T1 US500 overnight | 2016-26 | 2721 | +0.023 | −0.027 | −0.017 | −0.022 | +2.87 | −2.86 | −59.5 | 59.6 | −0.032 / −0.018 / −0.009 |
| T1 US500 overnight | 2005-15 | 2743 | +0.014 | −0.025 | −0.015 | −0.025 | +2.29 | −3.96 | −68.6 | 70.4 | −0.030 / −0.018 / −0.006 |
| T2 NAS100 overnight | 2016-26 | 2721 | +0.026 | −0.020 | −0.013 | −0.006 | +3.54 | −0.84 | −16.4 | 25.3 | −0.023 / −0.008 / 0.000 |
| T2 NAS100 overnight | 2005-15 | 2743 | +0.028 | −0.020 | −0.011 | −0.004 | +4.65 | −0.69 | −11.1 | 20.2 | −0.022 / −0.013 / +0.004 |
| T3 US500 session | 2016-26 | 2722 | +0.017 | −0.027 | 0.000 | −0.010 | +1.72 | −0.99 | −26.7 | 42.0 | (control) |
| T3 US500 session | 2005-15 | 2743 | +0.005 | −0.025 | 0.000 | −0.020 | +0.49 | −2.17 | −55.5 | 61.2 | (control) |

Pooled T1 + T2 (monthly sums added): 2016-26 130 months, mean −0.583R a month, t −1.93 (gross t +3.27); 2005-15 131 months, mean −0.608R, t −2.47 (gross t +3.55).

## Pass conditions

| Test | n ≥ 300 both | net > 0, t ≥ 2 (2016-26) | net > 0 (2005-15) | Holm p < 0.05 | above placebo p95 | net > 0 at 2x spread | Pass |
|---|---|---|---|---|---|---|---|
| T1 | yes | no | no | no (p 0.998, Holm 1) | no (rank 12 of 40) | no | no |
| T2 | yes | no | no | no (p 0.8, Holm 1) | no (rank 27 of 40) | no | no |

## Overnight against the cash session (US500)

- 2016-26: overnight minus session +0.006R a trade before costs, −0.012R after; Welch t on monthly sums −0.97.
- 2005-15: overnight minus session +0.009R a trade before costs, −0.005R after; Welch t on monthly sums −0.42.

## Weekend holds (3 or more nights) apart

- T1 2016-26: weekend n 563, +0.023R gross, −0.041R net; weekday n 2158, +0.022R gross, −0.017R net.
- T1 2005-15: weekend n 568, +0.004R gross, −0.052R net; weekday n 2175, +0.017R gross, −0.018R net.
- T2 2016-26: weekend n 564, +0.021R gross, −0.026R net; weekday n 2157, +0.028R gross, −0.001R net.
- T2 2005-15: weekend n 568, +0.026R gross, −0.019R net; weekday n 2175, +0.028R gross, 0.000R net.

## By year (net R a trade, total)

| Year | T1 US500 | T2 NAS100 | T3 US500 session |
|---|---|---|---|
| 2005 | −0.016 (−3.7, n 232) | −0.002 (−0.4, n 232) | −0.055 (−12.9, n 232) |
| 2006 | −0.040 (−10.1, n 251) | −0.016 (−3.9, n 251) | +0.006 (+1.5, n 251) |
| 2007 | −0.026 (−6.6, n 251) | +0.001 (+0.2, n 251) | −0.032 (−8.0, n 251) |
| 2008 | −0.054 (−13.7, n 253) | −0.031 (−7.9, n 253) | −0.048 (−12.1, n 253) |
| 2009 | +0.002 (+0.4, n 252) | +0.004 (+1.0, n 252) | +0.009 (+2.2, n 252) |
| 2010 | −0.015 (−3.7, n 252) | +0.007 (+1.8, n 252) | +0.006 (+1.6, n 252) |
| 2011 | −0.027 (−6.8, n 252) | −0.022 (−5.5, n 252) | −0.030 (−7.6, n 252) |
| 2012 | −0.023 (−5.6, n 249) | −0.006 (−1.6, n 249) | −0.003 (−0.9, n 249) |
| 2013 | −0.014 (−3.5, n 250) | +0.014 (+3.5, n 250) | +0.018 (+4.5, n 250) |
| 2014 | −0.026 (−6.6, n 250) | +0.009 (+2.4, n 250) | −0.039 (−9.7, n 250) |
| 2015 | −0.035 (−8.7, n 251) | −0.002 (−0.6, n 251) | −0.056 (−14.1, n 251) |
| 2016 | −0.033 (−8.3, n 252) | −0.022 (−5.5, n 252) | −0.007 (−1.7, n 252) |
| 2017 | −0.007 (−1.9, n 251) | +0.019 (+4.8, n 251) | −0.017 (−4.3, n 251) |
| 2018 | −0.023 (−5.7, n 251) | −0.015 (−3.7, n 251) | −0.044 (−11.1, n 251) |
| 2019 | −0.002 (−0.4, n 252) | +0.008 (+1.9, n 252) | 0.000 (−0.1, n 252) |
| 2020 | +0.020 (+5.1, n 253) | +0.029 (+7.3, n 253) | −0.015 (−3.7, n 253) |
| 2021 | +0.004 (+1.0, n 252) | −0.004 (−0.9, n 252) | −0.015 (−3.8, n 252) |
| 2022 | −0.065 (−16.1, n 250) | −0.059 (−14.9, n 250) | −0.038 (−9.6, n 250) |
| 2023 | −0.060 (−15.0, n 250) | −0.024 (−6.1, n 250) | +0.053 (+13.3, n 250) |
| 2024 | +0.001 (+0.3, n 252) | +0.019 (+4.7, n 252) | −0.013 (−3.2, n 252) |
| 2025 | −0.035 (−8.7, n 250) | +0.007 (+1.6, n 250) | −0.002 (−0.4, n 250) |
| 2026 | −0.047 (−9.8, n 208) | −0.027 (−5.5, n 208) | −0.011 (−2.2, n 209) |

## Detail

- T1 2016-26: win 50.4 %, stopped 131, median stop 1.166 % of price, mean nights 1.45, net at 2x spread −0.049R; dropped days (whole run) {"data":8,"atr":20}.
- T1 2005-15: win 48.7 %, stopped 76, median stop 1.194 % of price, mean nights 1.45, net at 2x spread −0.050R; dropped days (whole run) {"data":8,"atr":20}.
- T2 2016-26: win 52.3 %, stopped 110, median stop 1.594 % of price, mean nights 1.45, net at 2x spread −0.026R; dropped days (whole run) {"data":8,"atr":20}.
- T2 2005-15: win 51.3 %, stopped 57, median stop 1.463 % of price, mean nights 1.45, net at 2x spread −0.024R; dropped days (whole run) {"data":8,"atr":20}.
- T3 2016-26: win 51.7 %, stopped 253, median stop 1.166 % of price, mean nights 0, net at 2x spread −0.037R; dropped days (whole run) {"data":7,"atr":20}.
- T3 2005-15: win 51.3 %, stopped 273, median stop 1.194 % of price, mean nights 0, net at 2x spread −0.045R; dropped days (whole run) {"data":7,"atr":20}.

## Reading

Not an edge. Before costs the drift is there on both CFDs: the overnight long made about +0.01 to +0.03R a trade with month-sum t between +2.3 and +4.7 in both windows, the published effect. But it is about 0.03 % of price a night, and the round-trip spread charged here (0.03 % of price, about 0.02 to 0.027R at a one-ATR stop) takes all of it before financing (another 0.011 to 0.017R) is paid: net it is negative on both markets in both windows (US500 t below -2.8). The overnight leg did not beat the cash session on US500 by a measurable margin (Welch t under 1 in both windows), and the US500 result sits inside the random-window placebo. The rule fails the pre-registered bar; the result says the drift is too small per trade to pay a CFD spread, whatever the stop. Never call it an edge and never propose it as a council system; nothing live changed.

## Data

OANDA mid M30: US500 258206 candles 2005-01-02 to 2026-10-30; NAS100 258176 candles 2005-01-02 to 2026-10-30. Rates: FRED DGS2 weekly (rates.json, copied from research/edge/gold-carry/rates.json). To repeat: `node --use-env-proxy research/edge/index-overnight/run.mjs fetch <dir>`, then `node research/edge/index-overnight/run.mjs full <dir>` (candles kept out of git).
