# Fading the overnight gap on European indices (DE40, UK100, EU50): result

Pre-registered in PREREGISTRATION.md (committed alone, before any candle of these markets was fetched). Built 2026-11-14. Source of the idea: us-asia-lead (#913): the post-hoc reversal of the US-led gap in the Asian session; JP225 / HK33 excluded for that reason. Paper research only: nothing live changed.

## Verdict: FAIL: fading the European index overnight gap from the 08:00 London open to the 16:30 close, stop 1 x ATR20, after a 0.04 % round trip, 2016 → now: DE40 −0.048R a trade (n 1964, month-sum t −4.06), UK100 + EU50 −0.031R (n 4010, t −3.18), DE40 on US-led gaps −0.063R (n 1283, t −4.09); before costs −0.019R, +0.002R, −0.034R.

| Test | Window | n | Buys / sells | Win | Gross R | Cost R | Net R | Net R at 2x cost | Month t gross | Month t net | Total net R | Max DD R | Stopped |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| T1 DE40 | 2016 → now (decides) | 1964 | 880 / 1084 | 46.5 % | −0.019 | −0.030 | −0.048 | −0.078 | −1.60 | −4.06 | −95.2 | 100.5 | 184 |
| T1 DE40 | start → 2015 (replication) | 2032 | 869 / 1163 | 47.6 % | +0.004 | −0.026 | −0.022 | −0.048 | +0.29 | −1.62 | −45.0 | 53.1 | 170 |
| T2 UK100 + EU50 | 2016 → now (decides) | 4010 | 1864 / 2146 | 47.2 % | +0.002 | −0.033 | −0.031 | −0.063 | +0.23 | −3.18 | −122.5 | 144.2 | 292 |
| T2 UK100 + EU50 | start → 2015 (replication) | 4059 | 1748 / 2311 | 47.8 % | +0.003 | −0.030 | −0.027 | −0.057 | +0.26 | −2.44 | −109.6 | 109.6 | 311 |
| T3 DE40, US-led gaps | 2016 → now (decides) | 1283 | 545 / 738 | 46.5 % | −0.034 | −0.030 | −0.063 | −0.093 | −2.19 | −4.09 | −81.1 | 83.3 | 128 |
| T3 DE40, US-led gaps | start → 2015 (replication) | 1402 | 595 / 807 | 48.4 % | +0.017 | −0.026 | −0.009 | −0.035 | +0.99 | −0.57 | −13.3 | 30.3 | 113 |

## Pass conditions

| Test | net > 0 (2016 → now) | net > 0 (to 2015) | Holm p < 0.05 | n ≥ 200 (T3: 100), decisive | Pass |
|---|---|---|---|---|---|
| T1 | no | no | no (p 1, Holm 1) | yes | no |
| T2 | no | no | no (p 0.999, Holm 1) | yes | no |
| T3 | no | no | no (p 1, Holm 1) | yes | no |

## Placebo (40 seeds, random side on the same days, mean net R a trade; reported, not a pass condition)

| Test | Window | Real | Random side p5 / p50 / p95 | Rank of real (of 40) |
|---|---|---:|---|---:|
| T1 DE40 | 2016 → now (decides) | −0.048 | −0.045 / −0.027 / −0.011 | 2 |
| T1 DE40 | start → 2015 (replication) | −0.022 | −0.044 / −0.023 / −0.008 | 24 |
| T2 UK100 + EU50 | 2016 → now (decides) | −0.031 | −0.044 / −0.033 / −0.024 | 23 |
| T2 UK100 + EU50 | start → 2015 (replication) | −0.027 | −0.042 / −0.028 / −0.014 | 22 |
| T3 DE40, US-led gaps | 2016 → now (decides) | −0.063 | −0.050 / −0.031 / −0.011 | 0 |
| T3 DE40, US-led gaps | start → 2015 (replication) | −0.009 | −0.047 / −0.027 / −0.004 | 36 |

## T2 by market (descriptive)

- 2016 → now (decides): UK100 n 1991, −0.004R gross, −0.040R net, t −3.58; EU50 n 2019, +0.009R gross, −0.022R net, t −1.85.
- start → 2015 (replication): UK100 n 2016, −0.014R gross, −0.046R net, t −3.84; EU50 n 2043, +0.019R gross, −0.009R net, t −0.68.

## Gap and session (descriptive, every session day with a previous session)

- DE40 2016 → now (decides): 2759 sessions, 1964 triggered; correlation of the gap with the session after it −0.03; prior US session vs the gap +0.38, vs the European session −0.03 (n 2682).
- DE40 start → 2015 (replication): 2781 sessions, 2032 triggered; correlation of the gap with the session after it −0.01; prior US session vs the gap +0.51, vs the European session +0.01 (n 2709).
- UK100 2016 → now (decides): 2725 sessions, 1991 triggered; correlation of the gap with the session after it −0.04; prior US session vs the gap +0.35, vs the European session −0.02 (n 2659).
- UK100 start → 2015 (replication): 2744 sessions, 2016 triggered; correlation of the gap with the session after it +0.00; prior US session vs the gap +0.56, vs the European session +0.02 (n 2681).
- EU50 2016 → now (decides): 2762 sessions, 2019 triggered; correlation of the gap with the session after it −0.02; prior US session vs the gap +0.40, vs the European session −0.05 (n 2686).
- EU50 start → 2015 (replication): 2752 sessions, 2043 triggered; correlation of the gap with the session after it −0.01; prior US session vs the gap +0.53, vs the European session +0.01 (n 2682).

## By year (net R a trade, total, n)

| Year | T1 DE40 | T2 UK100 + EU50 | T3 DE40, US-led gaps |
|---|---|---|---|
| 2005 | −0.046 (−7.8, n 168) | −0.057 (−18.5, n 326) | +0.018 (+2.3, n 129) |
| 2006 | −0.067 (−12.5, n 188) | −0.004 (−1.5, n 362) | −0.034 (−4.2, n 124) |
| 2007 | 0.000 (−0.1, n 178) | −0.024 (−9.1, n 373) | +0.014 (+1.8, n 128) |
| 2008 | +0.035 (+6.5, n 185) | −0.014 (−4.8, n 359) | +0.058 (+7.8, n 135) |
| 2009 | +0.024 (+4.7, n 198) | +0.003 (+1.2, n 374) | −0.010 (−1.4, n 134) |
| 2010 | +0.071 (+13.5, n 191) | +0.039 (+15.4, n 391) | +0.061 (+7.8, n 129) |
| 2011 | +0.009 (+1.7, n 193) | +0.005 (+2.0, n 386) | +0.020 (+2.6, n 135) |
| 2012 | −0.038 (−6.4, n 169) | −0.006 (−2.4, n 365) | −0.036 (−4.4, n 122) |
| 2013 | −0.046 (−8.8, n 189) | −0.070 (−26.6, n 380) | −0.069 (−8.1, n 117) |
| 2014 | −0.076 (−14.4, n 189) | −0.070 (−26.2, n 374) | −0.072 (−9.4, n 131) |
| 2015 | −0.116 (−21.4, n 184) | −0.106 (−39.0, n 369) | −0.070 (−8.3, n 118) |
| 2016 | −0.041 (−7.2, n 173) | −0.011 (−3.9, n 364) | −0.090 (−10.0, n 111) |
| 2017 | −0.017 (−3.0, n 177) | −0.013 (−5.1, n 383) | +0.023 (+2.8, n 123) |
| 2018 | −0.064 (−11.3, n 177) | −0.091 (−32.3, n 355) | −0.095 (−11.3, n 119) |
| 2019 | −0.003 (−0.6, n 168) | −0.054 (−19.4, n 361) | −0.020 (−2.0, n 100) |
| 2020 | −0.063 (−11.7, n 186) | −0.028 (−10.3, n 370) | −0.120 (−15.7, n 131) |
| 2021 | −0.084 (−14.9, n 178) | −0.070 (−25.3, n 363) | −0.088 (−10.0, n 114) |
| 2022 | +0.005 (+0.9, n 188) | +0.020 (+7.3, n 369) | −0.013 (−1.7, n 133) |
| 2023 | −0.106 (−19.4, n 183) | −0.070 (−25.7, n 366) | −0.162 (−19.3, n 119) |
| 2024 | −0.120 (−22.1, n 184) | −0.024 (−9.0, n 374) | −0.085 (−10.5, n 124) |
| 2025 | +0.010 (+1.9, n 188) | −0.028 (−10.5, n 376) | +0.042 (+4.7, n 112) |
| 2026 | −0.048 (−7.8, n 162) | +0.035 (+11.7, n 329) | −0.082 (−7.9, n 97) |

## Reading

Not an edge, and the #913 observation does not carry over to Europe. The US cash session does lead the European open through the gap (correlation of the prior US session with the DE40 / UK100 / EU50 gap +0.35 to +0.56), but the European session that follows neither reverses nor extends it: the correlation of the gap with the session after it is −0.04 to +0.00, and of the US session with the European session −0.05 to +0.02. Fading the triggered gaps is about zero before costs (−0.019R to +0.017R a trade in the six cells; UK100 + EU50 +0.002R in 2016 → now) and every cell loses after the 0.04 % round trip (about 0.03R at a one-ATR stop; month-sum t −0.57 to −4.09). The US-led subset (T3), the one the #913 mechanism describes, is the worst in 2016 → now (−0.034R gross, −0.063R net, below all 40 random-side placebos) and does not replicate the small positive gross figure of 2005-15 (+0.017R). The reversal seen on JP225 / HK33 was most likely a feature of those two markets or of noise, not a general response to a US-led gap. Never call this an edge and never propose it as a council system; nothing live changed. Post hoc, not a test: no other exit, stop or trigger was tried.

## Data

OANDA mid M15: DE40 357205 candles 2005-01-03 to 2026-11-13; UK100 359379 candles 2005-01-04 to 2026-11-13; EU50 317519 candles 2005-01-03 to 2026-11-13; US500 509220 candles 2005-01-02 to 2026-11-13; 5493 US cash sessions with both candles. Days dropped before a trade: DE40 20 warm-up, 1524 under the trigger, 0 without an ATR; UK100 20 warm-up, 1442 under the trigger, 0 without an ATR; EU50 20 warm-up, 1432 under the trigger, 0 without an ATR; T3 left out 1311 DE40 trades whose gap did not have the prior US session's sign (or had no prior US session). European exchange holidays are not excluded by a calendar (pre-registered): a day counts when the CFD printed both the 08:00 and the 16:15 London candle. To repeat: `node --use-env-proxy research/edge/eu-gap-fade/run.mjs fetch <dir>`, then `node research/edge/eu-gap-fade/run.mjs full <dir>` (candles kept out of git).
