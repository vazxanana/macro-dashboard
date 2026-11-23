# The Mosha desk's barrier entries at 1R, 3R and 6R targets, gold 2010-2019

**Verdict: FAIL. 6R barrier entries on gold 2010-2019: n 145127, +0.012R a trade before costs, month t 0.86 (discovery +0.027R t 1.38; confirmation −0.003R t -0.15); after costs −0.161R.**

Built 2026-11-23. Pre-registered (PREREGISTRATION.md, committed alone before any run). Paper research only; nothing live changed.

## Tests (before costs; R a trade; t on calendar-month sums)

| Test | What | n | R a trade | month t | 2010-14 n / R / t | 2015-19 n / R / t | after costs | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 6R reading: R a trade before costs | 145127 | +0.012 | 0.86 | 74480 / +0.027 / 1.38 | 70647 / −0.003 / -0.15 | −0.161 | 0.3898 | no |
| T2 | 6R minus 1R, paired by entry | 145127 | +0.023 | 1.71 | 74480 / +0.032 / 1.77 | 70647 / +0.013 / 0.66 | +0.023 | 0.1308 | no |
| T3 | 3R reading: R a trade before costs | 145129 | +0.002 | 0.2 | 74482 / +0.015 / 1.49 | 70647 / −0.013 / -1.25 | −0.172 | 0.4207 | no |

## Placebo (the same entries, side flipped)

| Test | n | R a trade | month t | 2010-14 R / t | 2015-19 R / t |
|---|---|---|---|---|---|
| T1 | 145127 | +0.034 | 2.25 | +0.037 / 1.73 | +0.032 / 1.44 |
| T3 | 145129 | +0.012 | 1.57 | +0.017 / 1.62 | +0.007 / 0.6 |

## Each target, whole window

| Target | n | win % | R a trade (before) | month t | after costs | worst drawdown R | still open, left out |
|---|---|---|---|---|---|---|---|
| 1R | 145130 | 49.6 | −0.011 | -2.84 | −0.184 | 1904.2 | 0 |
| 3R | 145129 | 25.1 | +0.002 | 0.2 | −0.172 | 1690.3 | 0 |
| 6R | 145127 | 14.5 | +0.012 | 0.86 | −0.161 | 2375 | 0 |

Pairing: 145127 of 145127 6R entries are the same entry (side, time, entry, stop) as a 1R entry (145130 1R entries).

## By barrier timeframe (R a trade before costs, n)

| | 1R | 3R | 6R | 6R after costs |
|---|---|---|---|---|
| 1d | +0.015 (2186, t 0.78) | +0.054 (2186, t 1.46) | +0.082 (2186, t 1.57) | −0.022 |
| 4h | −0.001 (15644, t -0.07) | −0.007 (15644, t -0.42) | +0.006 (15642, t 0.21) | −0.106 |
| 1h | −0.008 (16516, t -0.76) | −0.006 (16516, t -0.35) | +0.002 (16516, t 0.05) | −0.126 |
| 30m | −0.018 (6590, t -1.24) | +0.016 (6590, t 0.79) | +0.010 (6590, t 0.32) | −0.162 |
| 15m | −0.013 (104194, t -3.09) | +0.002 (104193, t 0.26) | +0.014 (104193, t 0.97) | −0.177 |

## With / against the direction of the timeframe above the barrier (R a trade before costs, n)

| | 1R | 3R | 6R | 6R after costs |
|---|---|---|---|---|
| with | −0.016 (70215, t -2.48) | +0.001 (70213, t 0.08) | +0.001 (70212, t 0.03) | −0.174 |
| against | −0.006 (72729, t -0.96) | +0.000 (72730, t 0.01) | +0.021 (72729, t 0.92) | −0.152 |
| none | +0.015 (2186, t 0.78) | +0.054 (2186, t 1.46) | +0.082 (2186, t 1.57) | −0.022 |

## By year (R a trade before costs, n)

| | 1R | 3R | 6R | 6R after costs |
|---|---|---|---|---|
| 2010 | +0.002 (14656, t 0.11) | +0.031 (14655, t 0.99) | +0.038 (14653, t 0.57) | −0.126 |
| 2011 | +0.013 (17184, t 1.02) | +0.040 (17184, t 2.18) | +0.075 (17184, t 2.18) | −0.060 |
| 2012 | −0.013 (16575, t -0.96) | +0.016 (16575, t 0.78) | +0.018 (16575, t 0.46) | −0.141 |
| 2013 | −0.020 (13176, t -1.89) | +0.003 (13176, t 0.12) | +0.022 (13176, t 0.57) | −0.130 |
| 2014 | −0.014 (12892, t -1.34) | −0.025 (12892, t -1.64) | −0.033 (12892, t -1.16) | −0.217 |
| 2015 | −0.010 (12676, t -0.75) | +0.021 (12676, t 0.91) | +0.079 (12676, t 1.81) | −0.105 |
| 2016 | −0.008 (14934, t -0.73) | −0.044 (14934, t -2.35) | −0.034 (14934, t -0.85) | −0.201 |
| 2017 | −0.008 (13771, t -0.58) | −0.006 (13771, t -0.3) | +0.019 (13771, t 0.34) | −0.182 |
| 2018 | −0.028 (15007, t -2.95) | −0.014 (15007, t -0.52) | −0.041 (15007, t -1.15) | −0.240 |
| 2019 | −0.028 (14259, t -2.47) | −0.016 (14259, t -0.63) | −0.025 (14259, t -0.46) | −0.222 |

## Notes

- M1 candles on file for 10 of 10 years (2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019); a year without them reads its M1 confirmations on M5.
- Cost: $0.3 a round trip (COSTS.xau), R − 0.3 / r0.
- Several barrier entries can be open at once (the desk records every one); month sums carry that clustering.
- Cut test: 2012 at 2012-04-30: 1R 5819 entries, identical; 3R 5819 entries, identical; 6R 5819 entries, identical.
- No variant is tested on these years after this run.
