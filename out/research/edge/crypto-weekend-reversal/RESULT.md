# Crypto weekend reversal: result

Run on 2026-11-14. Pre-registration: `PREREGISTRATION.md` (committed alone before this ran). Paper research only.

**Verdict: FAIL.** 0 of 5 tests pass; T1-BTC -0.016R a trade (n 19, month t -0.08); T1-ETH -0.044R a trade (n 27, month t -0.24); T2-BTC -0.141R a trade (n 19, month t -0.71); T2-ETH -0.304R a trade (n 27, month t -1.69); POOL -0.032R a trade (n 46, month t -0.19), 2022-26 after costs and financing.

## Tests (decisive window, entries 2022-01 to 2026-10, net of CFD_CRYPTO and financing)

| Test | n | win % | gross R | net R a trade | month-sum t | trade t | total R | max DD | net 2022-23 | net 2024-26 | net at 2x costs | placebo p5 / p50 / p95 | Holm p | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1-BTC | 19 | 53 | +0.003 | -0.016 | -0.08 | -0.07 | -0.31 | -3.15 | -0.177 (n 6) | +0.058 (n 13) | -0.036 | -0.382 / -0.048 / +0.293 (real above 23 of 40) | 1 | no |
| T1-ETH | 27 | 44 | -0.028 | -0.044 | -0.24 | -0.25 | -1.18 | -8.18 | -0.659 (n 10) | +0.318 (n 17) | -0.06 | -0.283 / +0.022 / +0.169 (real above 15 of 40) | 1 | no |
| T2-BTC | 19 | 42 | -0.125 | -0.141 | -0.71 | -0.62 | -2.68 | -5.61 | -0.249 (n 6) | -0.091 (n 13) | -0.157 | -0.327 / -0.014 / +0.395 (real above 9 of 40) | 1 | no |
| T2-ETH | 27 | 37 | -0.291 | -0.304 | -1.69 | -1.65 | -8.2 | -13.21 | -0.9 (n 10) | +0.047 (n 17) | -0.316 | -0.351 / -0.011 / +0.241 (real above 3 of 40) | 1 | no |
| POOL | 46 | 48 | -0.015 | -0.032 | -0.19 | -0.23 | -1.49 | -11.33 | -0.479 (n 16) | +0.206 (n 30) | -0.05 | -0.215 / -0.037 / +0.164 (real above 21 of 40) | 1 | no |

Conditions met per test (n, net > 0 with month t >= 2, Holm, both halves, 2x costs, above placebo p95):

- T1-BTC: n no, tMonth no, holm no, halves no, x2 no, placebo no
- T1-ETH: n no, tMonth no, holm no, halves no, x2 no, placebo no
- T2-BTC: n no, tMonth no, holm no, halves no, x2 no, placebo no
- T2-ETH: n no, tMonth no, holm no, halves no, x2 no, placebo no
- POOL: n no, tMonth no, holm no, halves no, x2 no, placebo no

## Detail

- **T1-BTC**: exits time 1, stop 9, target 9; mean cost 0.012R, financing 0.007R (0.79 nights); long +0.071R (n 11), short -0.136R (n 8); by year 2022 -0.488 (n 2), 2023 -0.022 (n 4), 2024 -0.512 (n 4), 2025 +0.319 (n 6), 2026 +0.297 (n 3).
- **T1-ETH**: exits time 5, stop 11, target 11; mean cost 0.009R, financing 0.007R (0.85 nights); long +0.174R (n 14), short -0.279R (n 13); by year 2022 -0.657 (n 5), 2023 -0.662 (n 5), 2024 -0.213 (n 5), 2025 +0.615 (n 9), 2026 +0.313 (n 3).
- **T2-BTC**: exits time 1, stop 10, target 8; mean cost 0.012R, financing 0.004R (0.53 nights); long -0.105R (n 11), short -0.19R (n 8); by year 2022 -0.704 (n 2), 2023 -0.022 (n 4), 2024 -0.51 (n 4), 2025 -0.346 (n 6), 2026 +0.977 (n 3).
- **T2-ETH**: exits time 1, stop 17, target 9; mean cost 0.009R, financing 0.003R (0.37 nights); long -0.217R (n 14), short -0.397R (n 13); by year 2022 -0.783 (n 5), 2023 -1.018 (n 5), 2024 -0.612 (n 5), 2025 +0.323 (n 9), 2026 +0.319 (n 3).
- **POOL**: exits time 6, stop 20, target 20; mean cost 0.01R, financing 0.007R (0.83 nights); long +0.129R (n 25), short -0.224R (n 21); by year 2022 -0.609 (n 7), 2023 -0.377 (n 9), 2024 -0.346 (n 9), 2025 +0.497 (n 15), 2026 +0.305 (n 6).

## Funnel

| Market | weekends | priced | signals (long / short) | T1 trades | T2 trades | median abs(move) / ATR |
|---|---|---|---|---|---|---|
| BTC | 252 | 248 | 19 (11 / 8) | 19 | 19 | 0.22 |
| ETH | 252 | 248 | 27 (14 / 13) | 27 | 27 | 0.26 |

## Descriptive only: 2017-08 to 2021-12 on daily candles (Sunday close to Wednesday close, no stop)

- BTC: n 34, -0.796R a trade net (gross -0.768R), trade t -2.24; by year 2017 -0.001 (n 4), 2018 -0.606 (n 4), 2019 -0.607 (n 10), 2020 -1.487 (n 8), 2021 -0.833 (n 8). Not a test.
- ETH: n 36, -0.653R a trade net (gross -0.63R), trade t -2.28; by year 2017 -1.39 (n 1), 2018 -0.249 (n 8), 2019 -0.715 (n 11), 2020 -0.393 (n 11), 2021 -1.588 (n 5). Not a test.

## Reading

- Tests with a positive net R a trade: none. Largest month-sum t: -0.08.
- POOL against its placebo: -0.032R against a placebo middle of -0.037R (p95 +0.164R); the real figure is above 21 of 40 placebo runs.
- The signal is rare: a weekend move over one daily ATR came on 19 of 248 priced BTC weekends and 27 of 248 ETH weekends (median weekend move 0.22 / 0.26 ATR), so no single-market test reaches the pre-registered 30 trades and the pool has 46 against 60.
- The halves disagree (POOL -0.479R in 2022-23, +0.206R in 2024-26), and the daily-candle description of 2017-21 goes the other way to the hypothesis (BTC -0.796R, ETH -0.653R a trade, Sunday to Wednesday close, no stop): there, big weekend moves tended to continue, not reverse. Descriptive only.
- 1R is one daily ATR, so the round trip and financing are small in R (see "mean cost" and "financing" above); the result is the price behaviour, not the costs.
- Not an edge. Do not trade it, do not add it to the council, and do not re-test it with other thresholds, hours or exits on these candles.

## What was not done, and why

- The brief asked for a decisive window from January 2021 and a 2017-2020 replication. No hourly or finer BTC / ETH candles before 2022 exist in the repository or council-data, and every exchange API was refused by the sandbox network on 14 Nov 2026; the decisive window is 2022-01 to 2026-10 and the 2017-21 years are a daily-candle description without stops (above), not a replication.
- Binance spot prices stand in for the broker's CFD prices; the broker's past financing rates are unknown (today's rates for every year).

## To repeat

```sh
node research/edge/crypto-weekend-reversal/run.mjs fetch <dir>   # git show from origin/council-data, no network
node research/edge/crypto-weekend-reversal/run.mjs run <dir>
```
