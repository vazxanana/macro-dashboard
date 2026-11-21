# Desk partial exits: half closed at +1R, the rest left to run

Pre-registered (PREREGISTRATION.md, committed first). Half the position closes at +1R; the other half then either trails 1R behind the best price from the entry (PT) or goes to 3R with its stop at the entry (P3). Every trade run alone on OANDA mid 5-minute candles; R of the whole position; after the desk-rigor cost model unless said.

**Verdict: FAIL.** Stage B (2020-2025, out of sample 2024-2025): 0 of 30 group-exit pairs pass both bars; 0 better than the desk's own exit, 0 profitable after costs.

## Stage B: 2020-2025 on gold, EUR/USD and GBP/USD (the verdict)

Trades: 112330 (4 left out). Out of sample 2024-2025, R a trade after costs.

| Group | OOS n | Own exit | All at +1R | Trailing | Half + trail | Half + 3R | Half + trail vs own (t) | Half + 3R vs own (t) | Verdicts |
|---|---|---|---|---|---|---|---|---|---|
| Mosha sequence | 487 | −0.324 | −0.232 | −0.210 | −0.221 | −0.224 | +0.054 (0.57) | +0.049 (0.49) | PT FAIL; P3 FAIL |
| Mosha barrier entry | 21458 | −0.090 | −0.099 | −0.071 | −0.085 | −0.086 | +0.005 (0.38) | +0.004 (0.34) | PT FAIL; P3 FAIL |
| Engulf D1 | 251 | −0.064 | −0.122 | −0.092 | −0.107 | −0.082 | −0.058 (-0.99) | −0.030 (-0.54) | PT FAIL; P3 FAIL |
| Engulf H4 | 1366 | −0.040 | −0.086 | −0.042 | −0.064 | −0.068 | −0.025 (-1.01) | −0.028 (-1.39) | PT FAIL; P3 FAIL |
| Engulf H1 | 5636 | −0.093 | −0.107 | −0.075 | −0.091 | −0.102 | +0.002 (0.17) | −0.009 (-0.71) | PT FAIL; P3 FAIL |
| Engulf plan (with the Daily) | 1144 | −0.119 | −0.112 | −0.095 | −0.103 | −0.111 | +0.029 (1.1) | +0.015 (0.6) | PT FAIL; P3 FAIL |
| Engulf short method | 1204 | −0.116 | −0.120 | −0.069 | −0.095 | −0.106 | +0.033 (1.08) | +0.018 (0.7) | PT FAIL; P3 FAIL |
| Engulf direct entry | 47 | +0.286 | −0.367 | −0.182 | −0.275 | −0.261 | −0.451 (-1.8) | −0.459 (-1.6) | PT FAIL; P3 FAIL |
| MSNR with the direction, 12-16 UTC | 836 | −0.141 | −0.175 | −0.156 | −0.166 | −0.175 | −0.030 (-1.19) | −0.040 (-1.44) | PT FAIL; P3 FAIL |
| MSNR with the direction, other hours | 3290 | −0.185 | −0.191 | −0.164 | −0.177 | −0.183 | +0.009 (0.74) | +0.003 (0.21) | PT FAIL; P3 FAIL |
| MSNR gold plan | 575 | −0.123 | −0.126 | −0.105 | −0.116 | −0.144 | +0.018 (0.3) | −0.022 (-0.4) | PT FAIL; P3 FAIL |
| MSNR gold plan, QM entry | 149 | −0.056 | −0.163 | −0.145 | −0.154 | −0.153 | −0.120 (-1.3) | −0.138 (-1.58) | PT FAIL; P3 FAIL |
| LIT, the rule's execution | 26 | −0.579 | −0.603 | −0.676 | −0.639 | −0.643 | −0.005 (-0.01) | −0.005 (-0.01) | PT FAIL; P3 FAIL |
| LIT, loose limit | 319 | −0.196 | −0.279 | −0.179 | −0.229 | −0.223 | −0.027 (-0.37) | −0.025 (-0.38) | PT FAIL; P3 FAIL |
| LIT, market on the break | 87 | −0.070 | −0.247 | −0.151 | −0.199 | −0.158 | −0.174 (-1.22) | −0.209 (-1.58) | PT FAIL; P3 FAIL |

In sample 2020-2023, R a trade after costs:

| Group | IS n | Own exit | All at +1R | Trailing | Half + trail | Half + 3R |
|---|---|---|---|---|---|---|
| Mosha sequence | 976 | −0.131 | −0.124 | −0.132 | −0.128 | −0.164 |
| Mosha barrier entry | 44883 | −0.060 | −0.084 | −0.082 | −0.083 | −0.080 |
| Engulf D1 | 470 | +0.067 | +0.021 | +0.043 | +0.032 | +0.046 |
| Engulf H4 | 2929 | −0.024 | −0.032 | −0.016 | −0.024 | −0.031 |
| Engulf H1 | 11474 | −0.084 | −0.095 | −0.082 | −0.089 | −0.088 |
| Engulf plan (with the Daily) | 2597 | −0.054 | −0.085 | −0.075 | −0.080 | −0.083 |
| Engulf short method | 2640 | −0.143 | −0.148 | −0.123 | −0.136 | −0.150 |
| Engulf direct entry | 82 | −0.096 | −0.084 | +0.022 | −0.031 | −0.101 |
| MSNR with the direction, 12-16 UTC | 1466 | −0.177 | −0.173 | −0.164 | −0.168 | −0.187 |
| MSNR with the direction, other hours | 5649 | −0.191 | −0.203 | −0.203 | −0.203 | −0.210 |
| MSNR gold plan | 1177 | −0.036 | −0.021 | −0.013 | −0.017 | −0.039 |
| MSNR gold plan, QM entry | 268 | −0.015 | +0.037 | +0.059 | +0.048 | +0.050 |
| LIT, the rule's execution | 45 | −0.183 | −0.190 | +0.081 | −0.055 | −0.201 |
| LIT, loose limit | 628 | −0.020 | −0.174 | −0.083 | −0.129 | −0.129 |
| LIT, market on the break | 171 | −0.067 | −0.099 | −0.088 | −0.093 | −0.098 |

## Stage A: the desks' own 2026 trades (in sample, descriptive)

Trades: 30905. R a trade before costs / after costs.

| Group | n | Own exit | All at +1R | Trailing | Half + trail | Half + 3R | Win % own / half + trail |
|---|---|---|---|---|---|---|---|
| Mosha sequence | 125 | +0.044 / −0.029 | +0.048 / −0.024 | +0.029 / −0.043 | +0.039 / −0.034 | +0.028 / −0.044 | 22.4 / 52.8 |
| Mosha barrier entry | 13040 | +0.005 / −0.084 | −0.034 / −0.122 | +0.004 / −0.085 | −0.015 / −0.103 | −0.017 / −0.105 | 25.2 / 48.4 |
| Engulf D1 | 182 | +0.135 / +0.125 | +0.031 / +0.022 | +0.102 / +0.092 | +0.066 / +0.057 | +0.069 / +0.059 | 43.4 / 51.1 |
| Engulf H4 | 1091 | +0.002 / −0.029 | −0.037 / −0.068 | −0.016 / −0.046 | −0.027 / −0.057 | −0.021 / −0.052 | 36.1 / 48.3 |
| Engulf H1 | 4053 | +0.014 / −0.042 | +0.006 / −0.049 | +0.014 / −0.041 | +0.010 / −0.045 | −0.005 / −0.061 | 36.4 / 50.5 |
| Engulf plan (with the Daily) | 2149 | −0.074 / −0.154 | −0.137 / −0.217 | +0.035 / −0.045 | −0.051 / −0.131 | −0.089 / −0.169 | 31.1 / 43.4 |
| Engulf short method | 2146 | −0.075 / −0.156 | −0.139 / −0.220 | +0.022 / −0.060 | −0.059 / −0.140 | −0.098 / −0.180 | 31 / 43.1 |
| Engulf direct entry | 41 | +0.071 / −0.012 | −0.463 / −0.546 | −0.125 / −0.207 | −0.294 / −0.376 | −0.378 / −0.460 | 14.6 / 26.8 |
| MSNR with the direction, 12-16 UTC | 1459 | +0.002 / −0.090 | −0.042 / −0.133 | +0.029 / −0.063 | −0.007 / −0.098 | −0.006 / −0.098 | 40 / 48 |
| MSNR with the direction, other hours | 5441 | +0.007 / −0.106 | −0.013 / −0.127 | +0.050 / −0.064 | +0.018 / −0.095 | +0.006 / −0.107 | 40.8 / 49.9 |
| MSNR gold plan | 351 | −0.299 / −0.373 | −0.328 / −0.402 | −0.184 / −0.258 | −0.256 / −0.330 | −0.312 / −0.387 | 17.7 / 33.9 |
| MSNR gold plan, QM entry | 42 | +0.143 / +0.068 | −0.143 / −0.218 | +0.114 / +0.039 | −0.015 / −0.089 | +0.036 / −0.039 | 28.6 / 42.9 |
| LIT, the rule's execution | 45 | +0.263 / +0.093 | −0.111 / −0.281 | +0.177 / +0.007 | +0.033 / −0.137 | −0.056 / −0.225 | 24.4 / 44.4 |
| LIT, loose limit | 576 | −0.046 / −0.149 | −0.080 / −0.182 | +0.038 / −0.065 | −0.021 / −0.124 | −0.037 / −0.140 | 20.8 / 46 |
| LIT, market on the break | 164 | −0.044 / −0.111 | −0.071 / −0.139 | −0.073 / −0.141 | −0.072 / −0.140 | −0.087 / −0.155 | 25.6 / 47 |

## What this is not

- Each trade was run alone: a desk holding one position at a time would have taken other later trades.
- Stage B covers three markets; stage A is in sample.
- A pass is a candidate for its own forward paper record, never a live rule without the owner. Nothing live changed.
