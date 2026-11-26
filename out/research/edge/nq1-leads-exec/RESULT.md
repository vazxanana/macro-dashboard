# The Nasdaq leads at the broker's own bid / ask ticks (result)

**Verdict: 2 of 6 pass (l1, l5). At the broker's own NAS100 bid and ask, after financing: l1 +0.269R (n 365, month t 3.194; mid +0.303R); l2 +0.189R (n 344, month t 1.8462; mid +0.233R); l3 +0.206R (n 277, month t 1.5482; mid +0.243R); l4 +0.139R (n 340, month t 1.8146; mid +0.144R); l5 +0.364R (n 317, month t 3.9778; mid +0.326R); l6 +0.094R (n 674, month t 1.4907; mid +0.085R).**

Run 2026-11-26 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Paper research only: nothing live
changed, no rule is proposed. The rules are the auto-researcher's NAS100 leads, found on these same years; they overlap heavily.

## What was run

Every order of each rule, 2023-12-01 to 2026-11-20, entered at the demo broker's NAS100 ask (buy) or bid (sell); stop and target when the
closing side reaches them; else the quote at the time limit. Net = tick R less financing (0.62 points a night on a buy).

| Rule | Orders | No entry quote | Exit unresolved | Resolved | Won | Mid R | Tick R | Financing R | Net R (month t) | Holm p | Verdict |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| l1 Stretch + 10-hour breakout, long | 380 | 15 | 0 | 365 | 28.0 % | +0.303 | +0.276 | 0.0068 | +0.269 (3.194) | 0.0035 | PASS |
| l2 Stretch + 20-hour breakout, long | 360 | 16 | 0 | 344 | 24.1 % | +0.233 | +0.197 | 0.0077 | +0.189 (1.8462) | 0.1297 | FAIL |
| l3 20-hour breakout with the trend, long | 277 | 0 | 0 | 277 | 24.9 % | +0.243 | +0.216 | 0.0096 | +0.206 (1.5482) | 0.1297 | FAIL |
| l4 Double stretch with the trend, 4-hour hold | 340 | 0 | 0 | 340 | 45.6 % | +0.144 | +0.141 | 0.0023 | +0.139 (1.8146) | 0.1297 | FAIL |
| l5 Double stretch, high volatility, long | 330 | 13 | 0 | 317 | 34.7 % | +0.326 | +0.370 | 0.006 | +0.364 (3.9778) | 0.0002 | PASS |
| l6 Big candle + stretch | 699 | 25 | 0 | 674 | 27.7 % | +0.085 | +0.097 | 0.0026 | +0.094 (1.4907) | 0.1297 | FAIL |

## Detail by rule

### l1 Stretch + 10-hour breakout, long

Tick minus mid −0.028R a trade (month t -1.3443); entry spread in R: median 0.0129, 90th percentile 0.022; 0.7178 nights held on average. Unresolved: {}.

| | n | Tick R | Net R | Mid R |
|---|---:|---:|---:|---:|
| stop | 263 | −1.024 | −1.028 | −0.974 |
| target | 81 | +4.000 | +3.989 | +4.000 |
| time | 21 | +2.180 | +2.155 | +2.045 |
| never open over the break | 217 | −0.436 | −0.436 | −0.424 |
| open over the 21:00-22:59 break | 148 | +1.319 | +1.302 | +1.370 |
| 2023 | 16 | +0.335 | +0.325 | +0.250 |
| 2024 | 129 | +0.466 | +0.458 | +0.521 |
| 2025 | 115 | +0.189 | +0.181 | +0.238 |
| 2026 | 105 | +0.128 | +0.123 | +0.116 |
| buy | 365 | +0.276 | +0.269 | +0.303 |

### l2 Stretch + 20-hour breakout, long

Tick minus mid −0.036R a trade (month t -1.7361); entry spread in R: median 0.0128, 90th percentile 0.0216; 0.8314 nights held on average. Unresolved: {}.

| | n | Tick R | Net R | Mid R |
|---|---:|---:|---:|---:|
| stop | 261 | −1.013 | −1.018 | −0.965 |
| target | 83 | +4.000 | +3.985 | +4.000 |
| never open over the break | 202 | −0.492 | −0.492 | −0.480 |
| open over the 21:00-22:59 break | 142 | +1.177 | +1.158 | +1.247 |
| 2023 | 15 | −0.005 | −0.016 | 0.000 |
| 2024 | 124 | +0.441 | +0.432 | +0.492 |
| 2025 | 107 | +0.066 | +0.057 | +0.113 |
| 2026 | 98 | +0.063 | +0.058 | +0.071 |
| buy | 344 | +0.197 | +0.189 | +0.233 |

### l3 20-hour breakout with the trend, long

Tick minus mid −0.027R a trade (month t -0.8639); entry spread in R: median 0.0133, 90th percentile 0.0215; 0.9458 nights held on average. Unresolved: {}.

| | n | Tick R | Net R | Mid R |
|---|---:|---:|---:|---:|
| stop | 208 | −1.029 | −1.036 | −0.968 |
| target | 68 | +4.000 | +3.983 | +3.926 |
| time | 1 | +1.755 | +1.699 | +1.630 |
| never open over the break | 135 | −0.642 | −0.642 | −0.630 |
| open over the 21:00-22:59 break | 142 | +1.032 | +1.013 | +1.073 |
| 2023 | 17 | +0.168 | +0.157 | +0.176 |
| 2024 | 98 | +0.313 | +0.301 | +0.327 |
| 2025 | 88 | +0.329 | +0.318 | +0.394 |
| 2026 | 74 | −0.035 | −0.041 | −0.031 |
| buy | 277 | +0.216 | +0.206 | +0.243 |

### l4 Double stretch with the trend, 4-hour hold

Tick minus mid −0.002R a trade (month t -0.4361); entry spread in R: median 0.0113, 90th percentile 0.0191; 0.3382 nights held on average. Unresolved: {}.

| | n | Tick R | Net R | Mid R |
|---|---:|---:|---:|---:|
| stop | 151 | −1.024 | −1.025 | −1.011 |
| target | 11 | +4.000 | +4.000 | +4.000 |
| time | 178 | +0.892 | +0.888 | +0.885 |
| never open over the break | 254 | +0.066 | +0.066 | +0.070 |
| open over the 21:00-22:59 break | 86 | +0.365 | +0.356 | +0.363 |
| 2023 | 11 | −0.521 | −0.524 | −0.487 |
| 2024 | 130 | +0.200 | +0.196 | +0.184 |
| 2025 | 107 | +0.049 | +0.046 | +0.064 |
| 2026 | 92 | +0.247 | +0.246 | +0.256 |
| buy | 177 | +0.187 | +0.182 | +0.198 |
| sell | 163 | +0.092 | +0.092 | +0.085 |

### l5 Double stretch, high volatility, long

Tick minus mid +0.044R a trade (month t 1.8174); entry spread in R: median 0.0164, 90th percentile 0.0261; 0.4795 nights held on average. Unresolved: {}.

| | n | Tick R | Net R | Mid R |
|---|---:|---:|---:|---:|
| stop | 207 | −1.027 | −1.031 | −1.017 |
| target | 110 | +3.000 | +2.989 | +2.854 |
| never open over the break | 203 | +0.013 | +0.013 | −0.015 |
| open over the 21:00-22:59 break | 114 | +1.006 | +0.989 | +0.933 |
| 2023 | 15 | +0.327 | +0.320 | +0.333 |
| 2024 | 113 | +0.619 | +0.611 | +0.593 |
| 2025 | 102 | +0.363 | +0.358 | +0.294 |
| 2026 | 87 | +0.064 | +0.059 | +0.016 |
| buy | 317 | +0.370 | +0.364 | +0.326 |

### l6 Big candle + stretch

Tick minus mid +0.011R a trade (month t 0.5947); entry spread in R: median 0.0159, 90th percentile 0.0272; 0.3071 nights held on average. Unresolved: {}.

| | n | Tick R | Net R | Mid R |
|---|---:|---:|---:|---:|
| stop | 487 | −1.018 | −1.020 | −0.976 |
| target | 187 | +3.000 | +2.995 | +2.850 |
| never open over the break | 531 | −0.041 | −0.041 | −0.028 |
| open over the 21:00-22:59 break | 143 | +0.607 | +0.595 | +0.507 |
| 2023 | 17 | +0.169 | +0.163 | +0.176 |
| 2024 | 256 | +0.155 | +0.151 | +0.202 |
| 2025 | 212 | +0.007 | +0.005 | −0.057 |
| 2026 | 189 | +0.112 | +0.110 | +0.079 |
| buy | 305 | +0.128 | +0.123 | +0.088 |
| sell | 369 | +0.070 | +0.070 | +0.083 |

## What it means

The broker's own quotes do NOT take these rules away, unlike the two USD/CHF leads: every one of the six stays positive at Fusion's
bid and ask after financing, and the cost of trading the Nasdaq there (a spread of about 0.013R a trade, financing under 0.01R) is
small against stops of an ATR. Two rules clear the pre-registered bar (l1 and l5); the other four are positive with a month t of
1.5 to 1.8.

What this does and does not show. It is an execution measurement on years the search itself read (2023-12 to 2026-11 lies inside
the auto-researcher's holdout window, where these rules were chosen out of about 118 million tries), so it says the mid-candle
figures were not an artefact of the candle feed; it is not new evidence that the rules work. All six are long-biased readings of one
market in a rising stretch, they overlap heavily (their totals are not additive), and the result sits almost wholly in trades held
over the 21:00-22:59 UTC break (trades never open over it lose). The years fade: l1 +0.46R a trade in 2024, +0.18R in 2025, +0.12R
in 2026. A candidate for the forward record that already runs on the NQ1 desk from 26 Nov 2026, never an edge.

The broker's NAS100 price is not the candles' price: its mid sat a median 15.9 points under the candle open at entry (1st to 99th
percentile -82.9 to +8.9), so levels were looked for on the broker's own basis (the amendment to the pre-registration, committed
before any tick R was read).
