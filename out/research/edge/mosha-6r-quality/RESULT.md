# Mosha 6R barrier: can the better trades be told apart at the entry? (result)

**Verdict: FAIL. The kept fifth made +0.018R a trade after costs on 2022-26 (n 18763, month t 0.53); kept against the rest Welch t 6.08; the avoided fifth is reliably worse, so the rule names trades to skip.**

Built 2026-11-25. Pre-registered (PREREGISTRATION.md, committed alone before any run). Paper research only; nothing live changed.

Gold, the desk's own 6R barrier reading. Rule chosen on entries 2018-2021 (66834 trades), judged on 2022 to October 2026 (92504 trades). 0 trades still open at the end of their candles are left out. R after costs = R − 0.30 / r0.

## All trades

| Window | n / R after costs (month t) / R before costs / winners |
|---|---|
| 2018-21 | 66834 / −0.197 (t -9.35) / −0.030 / 13.9% |
| 2022-26 | 92504 / −0.082 (t -4.61) / +0.036 / 14.9% |

## The three groups

| Group | 2018-21 (where it was chosen) | 2022-26 (the test) |
|---|---|---|
| keep | 13369 / −0.023 (t -0.59) / +0.046 / 15% | 18763 / +0.018 (t 0.53) / +0.068 / 15.3% |
| mid | 40086 / −0.205 (t -8.55) / −0.037 / 13.8% | 60996 / −0.081 (t -4.29) / +0.032 / 14.9% |
| avoid | 13379 / −0.347 (t -9.13) / −0.085 / 13.2% | 12745 / −0.232 (t -7.28) / +0.005 / 14.4% |

## Tests on 2022-26

| Test | Result | Holm p | Pass |
|---|---|---|---|
| T1 kept trades profitable after costs | n 18763, +0.018R, month t 0.53 | 0.2981 | no |
| T2 kept beat the rest | Welch t 6.08, month-difference t 3.42 | 0 | yes |
| T3 avoided are worse than the rest | Welch t -7.4 | 0 | yes |

Placebo: the kept trades with the side flipped made +0.010R after costs (n 18763, month t 0.26); the real kept-against-rest t beats 34 of 40 rules fitted on shuffled results (their t from -4.13 to 7.84).

## Every feature level, both windows (R after costs; descriptive)

| Feature | Level | 2018-21 n / R (t) | 2022-26 n / R (t) | before costs 18-21 / 22-26 | Same sign |
|---|---|---|---|---|---|
| tf | 4h | 7171 / −0.102 (-3.18) | 8051 / −0.003 (-0.08) | +0.010 / +0.073 | yes |
| tf | 15m | 48121 / −0.227 (-9.56) | 69256 / −0.089 (-4.8) | −0.044 / +0.039 | yes |
| tf | 1h | 7508 / −0.134 (-3.1) | 9914 / −0.080 (-2.55) | −0.008 / +0.003 | yes |
| tf | 1d | 926 / +0.032 (0.34) | 1041 / −0.033 (-0.41) | +0.141 / +0.042 | no |
| tf | 30m | 3108 / −0.169 (-3.45) | 4242 / −0.132 (-3.2) | −0.002 / −0.018 | yes |
| kind | bo | 44491 / −0.199 (-8.7) | 60395 / −0.083 (-4.36) | −0.032 / +0.032 | yes |
| kind | vr | 167 / +0.006 (0.02) | 192 / +0.223 (0.88) | +0.132 / +0.312 | yes |
| kind | eg | 21054 / −0.206 (-7.79) | 30012 / −0.084 (-3.82) | −0.035 / +0.040 | yes |
| kind | sweep | 1120 / +0.012 (0.15) | 1903 / −0.044 (-0.66) | +0.153 / +0.067 | no |
| kind | cf | 2 / −1.052 (-53.81) | 2 / +2.424 (0.69) | −1.000 / +2.500 | no |
| entry | tap | 22731 / −0.209 (-9.26) | 31082 / −0.079 (-4.35) | −0.033 / +0.039 | yes |
| entry | level | 22477 / −0.188 (-7.73) | 30742 / −0.066 (-3.3) | −0.026 / +0.046 | yes |
| entry | zone | 17422 / −0.215 (-9.08) | 24655 / −0.114 (-4.63) | −0.045 / +0.015 | yes |
| entry | janda | 4204 / −0.110 (-2.21) | 6025 / −0.042 (-1.07) | +0.032 / +0.052 | yes |
| dir | against | 33491 / −0.218 (-7.2) | 45757 / −0.047 (-1.64) | −0.050 / +0.071 | yes |
| dir | with | 32417 / −0.182 (-4.07) | 45706 / −0.117 (-3.38) | −0.013 / +0.001 | yes |
| dir | none | 926 / +0.032 (0.34) | 1041 / −0.033 (-0.41) | +0.141 / +0.042 | no |
| visit | later | 38507 / −0.186 (-7.73) | 50306 / −0.087 (-3.69) | −0.019 / +0.030 | yes |
| visit | first | 28327 / −0.213 (-7.38) | 42198 / −0.075 (-3.59) | −0.044 / +0.043 | yes |
| cost | 0.10-0.20 | 25181 / −0.207 (-7.1) | 29125 / −0.103 (-3.92) | −0.059 / +0.040 | yes |
| cost | >0.20 | 23070 / −0.296 (-10.33) | 15652 / −0.286 (-8.41) | −0.024 / −0.021 | yes |
| cost | 0.05-0.10 | 13208 / −0.059 (-1.68) | 24710 / −0.057 (-2) | +0.017 / +0.017 | yes |
| cost | <=0.05 | 5375 / −0.066 (-0.89) | 23017 / +0.058 (1.9) | −0.031 / +0.090 | no |
| stopAtr | wide | 22278 / −0.086 (-2.45) | 21960 / +0.005 (0.16) | +0.010 / +0.060 | no |
| stopAtr | small | 22278 / −0.274 (-7.7) | 44006 / −0.141 (-7.56) | −0.043 / +0.019 | yes |
| stopAtr | mid | 22278 / −0.231 (-9) | 26538 / −0.055 (-1.99) | −0.056 / +0.043 | yes |
| session | asia | 20968 / −0.219 (-6.63) | 31064 / −0.103 (-3.77) | −0.023 / +0.032 | yes |
| session | london | 16083 / −0.183 (-5.58) | 22127 / −0.094 (-3.22) | −0.012 / +0.025 | yes |
| session | ny | 29327 / −0.190 (-6) | 38687 / −0.057 (-2.21) | −0.046 / +0.044 | yes |
| session | late | 456 / −0.144 (-0.87) | 626 / −0.091 (-0.56) | +0.059 / +0.073 | yes |
| trend | against | 33738 / −0.201 (-5.07) | 46122 / −0.148 (-3.87) | −0.033 / −0.029 | yes |
| trend | with | 33096 / −0.194 (-3.34) | 46382 / −0.016 (-0.35) | −0.026 / +0.100 | yes |
| er | >0.4 | 11821 / −0.164 (-3.14) | 18479 / −0.048 (-1.02) | −0.001 / +0.067 | yes |
| er | 0.2-0.4 | 21445 / −0.141 (-3.56) | 28996 / −0.072 (-2.17) | +0.029 / +0.045 | yes |
| er | <0.2 | 33568 / −0.245 (-7.73) | 45029 / −0.102 (-3.93) | −0.077 / +0.017 | yes |

## By year (R after costs, n)

| Year | keep | mid | avoid |
|---|---|---|---|
| 2018 | −0.089 (2515) | −0.260 (9144) | −0.298 (3348) |
| 2019 | −0.057 (2580) | −0.234 (8599) | −0.326 (3080) |
| 2020 | +0.043 (3983) | −0.140 (11382) | −0.385 (3240) |
| 2021 | −0.026 (4291) | −0.203 (10961) | −0.377 (3711) |
| 2022 | −0.059 (4302) | −0.125 (11457) | −0.283 (4060) |
| 2023 | +0.041 (4019) | −0.163 (10824) | −0.230 (3403) |
| 2024 | −0.038 (4233) | −0.101 (11957) | −0.215 (3280) |
| 2025 | +0.153 (3774) | +0.000 (13980) | −0.143 (1577) |
| 2026 | +0.037 (2576) | −0.018 (13672) | −0.186 (466) |

## Notes

- Score cut points from 2018-21: keep at or above -0.1793, avoid at or below -0.2150; stop / ATR terciles at 0.469 and 0.800.
- M1 candles reach the start of 8 of 9 years (2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026).
- Cut test 2024 at 2024-04-30: 5843 entries with their features, identical when later candles are removed.
- Several barrier entries can be open at once; month sums carry that clustering.
- One run. No other score, band, percentile or feature is tried on these years.

## What it means

The ten features cannot make the 6R barrier profitable: the best fifth of trades, picked on 2018-21 and judged on 2022-26, made +0.018R a trade after costs (n 18,763, month t 0.53; +0.068R before costs), so T1 fails and nothing is proposed as a rule to take.

They do name trades to skip. The worst fifth lost −0.232R a trade on 2022-26 (n 12,745, Welch t −7.4 against the rest), against −0.347R when it was chosen, and the best fifth beat the rest on both windows. But the ranking is weaker than the t suggests: the real kept-against-rest t beat 34 of 40 rules refitted on shuffled results, and the pre-registered bar was 38, so this is not a clean pass of the placebo.

Most of the separation is cost against risk. Trades whose 0.30 cost is over 0.20 of their stop lose about −0.29R a trade in both windows (n 38,722), and trades at 0.05 or under are the only cost band positive after costs in 2022-26 (+0.058R). Before costs every group is within about 0.1R of zero. This is the lesson of the fade studies again: a tight stop makes a cost-heavy trade, and avoiding those is a cost saving, not a better reading of the market.

"Best in both" levels (positive after costs in both windows) are the 1-day barrier and the VR kind, on a few hundred trades. M1 candles are missing for 2018, so that year's M1 entries are less complete. Nothing live changed; do not refit the score on these years.
