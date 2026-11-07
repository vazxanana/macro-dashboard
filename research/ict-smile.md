# ICT x Dollar Smile: out-of-sample test of the #507 lead

Run 2026-11-07T21:07:05.539Z. Pre-registration: research/edge/ict-smile/preregistration.md.
Trades: 1137 A-setups (GC gold rule, NQ/ES = NAS100/SPX cash, index rule), 2018-01-01T00:00:00.000Z to 2025-08-01T00:00:00.000Z; 0 without a Smile phase.

**Verdict: FAIL.** Dropped (left + right): 483 | +0.118 | 1.667 (n | R/trade | t), halves 0.176 / 0.06. Bar: n ≥ 30, t ≤ −2, both halves < 0.
Kept (mid + trough): 654 | +0.133 | 2.244, halves 0.003 / 0.263. Difference -0.015 (Welch t -0.164).

## By Smile phase (gross R x size)

| phase | n | R/trade | t | halves |
|---|---|---|---|---|
| left | 266 | +0.202 | 2.091 | 0.183 / 0.22 |
| right | 217 | +0.015 | 0.146 | 0.073 / -0.042 |
| trough | 305 | +0.122 | 1.444 | -0.146 / 0.388 |
| mid | 349 | +0.143 | 1.717 | 0.12 / 0.165 |

## Dollar bid (left + right) vs mid + trough, by market

| market | bid n | bid R/t | bid t | rest n | rest R/t | rest t | diff (Welch t) |
|---|---|---|---|---|---|---|---|
| es | 137 | +0.088 | 0.597 | 205 | +0.051 | 0.561 | 0.037 (0.214) |
| gc | 184 | +0.225 | 2.103 | 272 | +0.159 | 1.612 | 0.066 (0.455) |
| nq | 162 | +0.021 | 0.179 | 177 | +0.188 | 1.587 | -0.167 (-0.992) |

## By year

| year | bid n | bid R/t | bid t | rest n | rest R/t | rest t | diff (Welch t) |
|---|---|---|---|---|---|---|---|
| 2018 | 45 | +0.032 | 0.195 | 105 | -0.103 | -0.895 | 0.134 (0.675) |
| 2019 | 40 | +0.517 | 1.42 | 115 | +0.027 | 0.225 | 0.49 (1.281) |
| 2020 | 137 | +0.157 | 1.288 | 21 | +0.818 | 1.37 | -0.661 (-1.085) |
| 2021 | 52 | -0.137 | -0.772 | 103 | -0.037 | -0.348 | -0.1 (-0.48) |
| 2022 | 68 | +0.219 | 0.993 | 90 | +0.24 | 1.403 | -0.021 (-0.076) |
| 2023 | 55 | -0.121 | -0.842 | 81 | +0.463 | 1.925 | -0.584 (-2.084) |
| 2024 | 59 | +0.007 | 0.033 | 92 | +0.295 | 2.023 | -0.288 (-1.111) |
| 2025 | 27 | +0.437 | 1.239 | 47 | -0.103 | -0.537 | 0.54 (1.345) |

## Sensitivities (descriptive, not pass routes)

| version | dropped n | R/trade | t | halves | kept n | kept R/trade | kept t | meets the bar? |
|---|---|---|---|---|---|---|---|---|
| net of costs | 483 | +0.074 | 1.043 | 0.128 / 0.019 | 654 | +0.078 | 1.313 | no |
| VIX lag 1 day (#507) | 491 | +0.132 | 1.825 | 0.146 / 0.119 | 646 | +0.122 | 2.109 | no |
| HY-covered days only | 87 | +0.132 | 0.725 | -0.084 / 0.343 | 151 | +0.223 | 1.729 | no |

HY OAS covers 183 of 859 trade days (from 2023-11-07). Phase counts by HY coverage: {"noHy":{"trough":172,"left":174,"mid":214,"right":116},"hy":{"trough":65,"mid":53,"right":41,"left":24}}.
