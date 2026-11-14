# Result: big NAS100 cash sessions into BTC / ETH overnight (13 Nov 2026)

**Verdict: FAIL, 0 of 2 variants clear the checks that could be run.** Follow −0.043R a trade net on 2022-01 to 2026-10 (BTC + ETH pooled, n 764, monthly t −0.49, fails: net R not above 0, monthly t under 2, Holm p over 0.05, placebo 95th percentile not beaten); Fade −0.070R a trade net on 2022-01 to 2026-10 (BTC + ETH pooled, n 764, monthly t −0.77, fails: net R not above 0, monthly t under 2, Holm p over 0.05, placebo 95th percentile not beaten). The 2018-2020 replication could not be run (no crypto intraday candles before 2022 reachable), so no variant could pass in this run. Not an edge; no proposal, nothing live changed.

Data: OANDA mid NAS100 M15 (session = open of the 09:30 to close of the 15:45 New York candle) on 1252 full NYSE days from Nov 2021; 392 signal days with |move| > 1.5 × the median |move| of the previous 20 days (206 up). Binance BTCUSDT / ETHUSDT 5-minute candles from council-data (Jan 2022 to 2026-10-31). Each trade: the coin's 16:00 New York open, stop 1.5 × ATR(24 H1), out at the next trading day's 09:30 New York open. Costs: CFD round trip 0.04 % + one spread of slippage 0.02 % of price, swap per 17:00 New York rollover (Friday x3) at the broker's rates: longs 15 % a year, shorts 7.5 % (BTC) / 10 % (ETH).

| Variant | window | n | net R a trade | t (trades) | gross R | cost R | swap R | x2 costs | hit | stopped |
|---|---|---|---|---|---|---|---|---|---|---|
| Follow | decisive, pooled | 764 | −0.043 | −0.74 | +0.047 | +0.051 | +0.038 | −0.132 | 35.7 % | 52.9 % |
| Follow | 2022-23 (half) | 310 | −0.046 | −0.49 | +0.050 | +0.055 | +0.042 | −0.143 | 35.8 % | 52.9 % |
| Follow | 2024-26 (half) | 454 | −0.040 | −0.55 | +0.044 | +0.048 | +0.036 | −0.124 | 35.7 % | 52.9 % |
| Fade | decisive, pooled | 764 | −0.070 | −1.15 | +0.018 | +0.051 | +0.037 | −0.159 | 36.4 % | 56.9 % |
| Fade | 2022-23 (half) | 310 | +0.055 | +0.46 | +0.152 | +0.055 | +0.042 | −0.041 | 36.5 % | 56.8 % |
| Fade | 2024-26 (half) | 454 | −0.156 | −2.54 | −0.073 | +0.048 | +0.035 | −0.239 | 36.3 % | 57.0 % |
| Follow BTC | decisive | 382 | −0.096 | −1.24 | +0.002 | +0.057 | +0.041 | −0.194 | 34.8 % | 52.4 % |
| Follow BTC | 2022-23 | 155 | −0.069 | −0.53 | +0.033 | +0.058 | +0.043 | −0.170 | 36.1 % | 51.6 % |
| Follow BTC | 2024-26 | 227 | −0.115 | −1.20 | −0.019 | +0.056 | +0.039 | −0.210 | 33.9 % | 52.9 % |
| Follow ETH | decisive | 382 | +0.011 | +0.12 | +0.091 | +0.045 | +0.036 | −0.070 | 36.6 % | 53.4 % |
| Follow ETH | 2022-23 | 155 | −0.024 | −0.18 | +0.068 | +0.051 | +0.041 | −0.116 | 35.5 % | 54.2 % |
| Follow ETH | 2024-26 | 227 | +0.034 | +0.31 | +0.107 | +0.041 | +0.032 | −0.038 | 37.4 % | 52.9 % |
| Fade BTC | decisive | 382 | +0.012 | +0.12 | +0.109 | +0.057 | +0.040 | −0.085 | 38.5 % | 54.5 % |
| Fade BTC | 2022-23 | 155 | +0.129 | +0.65 | +0.229 | +0.058 | +0.042 | +0.028 | 36.8 % | 58.1 % |
| Fade BTC | 2024-26 | 227 | −0.068 | −0.76 | +0.026 | +0.056 | +0.038 | −0.163 | 39.6 % | 52.0 % |
| Fade ETH | decisive | 382 | −0.152 | −2.02 | −0.072 | +0.045 | +0.035 | −0.232 | 34.3 % | 59.4 % |
| Fade ETH | 2022-23 | 155 | −0.018 | −0.13 | +0.074 | +0.051 | +0.041 | −0.111 | 36.1 % | 55.5 % |
| Fade ETH | 2024-26 | 227 | −0.244 | −2.91 | −0.173 | +0.041 | +0.031 | −0.315 | 33.0 % | 62.1 % |
| Both | 2018-2020 (replication) | not run | | | | | | | | |

## The bar, check by check (decisive window, pooled)

| Variant | net > 0 | monthly t ≥ 2 | Holm p | same sign 2018-20 | above placebo 95th pct | result |
|---|---|---|---|---|---|---|
| Follow | no | no (−0.49, 58 months) | 1.000 | not run | no (−0.043 vs +0.090; beats 20 of 40) | FAIL |
| Fade | no | no (−0.77, 58 months) | 1.000 | not run | no (−0.070 vs +0.089; beats 15 of 40) | FAIL |

## Descriptive (not part of the bar)

- **Follow**: 382 signal days traded (202 long). After up sessions −0.045R (n 404, t −0.61), after down sessions −0.040R (n 360, t −0.45); Friday signals −0.114R (n 164), the rest −0.023R (n 600). Placebo means −0.194 to +0.103R (pool 1201 days). By year (net R a trade, n): 2022 +0.19 (142), 2023 −0.25 (168), 2024 −0.02 (174), 2025 +0.15 (148), 2026 −0.29 (132). Exits on the last close before 09:30 (candle missing): 2.
- **Fade**: 382 signal days traded (180 long). After up sessions −0.149R (n 404, t −2.14), after down sessions +0.019R (n 360, t +0.18); Friday signals −0.098R (n 164), the rest −0.063R (n 600). Placebo means −0.209 to +0.099R (pool 1201 days). By year (net R a trade, n): 2022 −0.42 (142), 2023 +0.46 (168), 2024 −0.00 (174), 2025 −0.40 (148), 2026 −0.08 (132). Exits on the last close before 09:30 (candle missing): 2.

Follow and Fade take the same days with the side reversed. Their gross R are not exact mirrors (each has its own stop, on the other side of the entry, and a stopped trade is −1R either way); costs and swap are paid by both.

To repeat: `node --use-env-proxy research/edge/nas-crypto-spill/run.mjs fetch <dir>` (candles outside git), then `node research/edge/nas-crypto-spill/run.mjs full <dir>`. For the replication, put 2017-11 to 2020-12 BTCUSDT / ETHUSDT 5-minute candles and NAS100 M15 in a directory and rerun on the 2018-2020 window. Tests: `tests/nas-crypto-spill.test.mjs`.
