# Crypto monthly expiry: result

Run on 2026-11-14. Pre-registration: `PREREGISTRATION.md` (committed alone before this ran). Paper research only.

**Verdict: FAIL.** After the monthly crypto expiry, BTC and ETH with the 7-day trend made +0.052R a trade net out of sample (n 56, month t 0.6), +0.086R in sample.

## Pass bar (POOL, primary window)

- OOS net R > 0 with month-sum t >= 2: no (+0.052R, t 0.6)
- IS net R > 0: yes (+0.086R)
- OOS net R > 0 at 2x cost and financing: yes (+0.02R)
- beats >= 38 of 40 placebo runs: no (beats 25 of 40; placebo p5 / p50 / p95 -0.102 / +0.025 / +0.161R)

## Primary: after expiry: Fri 08:00 -> Mon 08:00, with the 7 days before

| Test | window | n | win % | R before costs | net R a trade | event t | month-sum t | total R | max DD | net at 2x | stops |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BTC | IS | 29 | 41 | +0.01 | -0.024 | -0.24 | -0.3 | -0.68 | -2.81 | -0.057 | 2 |
| BTC | OOS | 28 | 54 | +0.024 | -0.012 | -0.1 | -0.14 | -0.35 | -3.8 | -0.048 | 2 |
| BTC | ALL | 57 | 47 | +0.017 | -0.018 | -0.24 | -0.28 | -1.03 | -4.97 | -0.053 | 4 |
| ETH | IS | 29 | 62 | +0.227 | +0.196 | 2.14 | 2.12 | +5.69 | -1.02 | +0.165 | 0 |
| ETH | OOS | 28 | 50 | +0.142 | +0.116 | 0.77 | 1.04 | +3.23 | -1.06 | +0.089 | 2 |
| ETH | ALL | 57 | 56 | +0.186 | +0.157 | 1.8 | 2.23 | +8.92 | -1.06 | +0.127 | 2 |
| POOL | IS | 58 | 52 | +0.119 | +0.086 | 1.27 | 1.11 | +5 | -2.53 | +0.054 | 2 |
| POOL | OOS | 56 | 52 | +0.083 | +0.052 | 0.54 | 0.6 | +2.89 | -3.64 | +0.02 | 4 |
| POOL | ALL | 114 | 52 | +0.101 | +0.069 | 1.19 | 1.25 | +7.89 | -3.64 | +0.037 | 6 |

OOS one-sided p from the month-sum t, Holm over BTC / ETH / POOL: BTC p 0.555, Holm 0.555; ETH p 0.149, Holm 0.448; POOL p 0.275, Holm 0.551.

- **BTC**: OOS long -0.164R (n 10), short +0.072R (n 18); mean cost 0.008R, financing 0.027R (4.89 nights); by year 2022 +0.095 (n 12), 2023 -0.088 (n 12), 2024 -0.083 (n 12), 2025 -0.187 (n 12), 2026 +0.236 (n 9).
- **ETH**: OOS long -0.05R (n 10), short +0.207R (n 18); mean cost 0.006R, financing 0.023R (4.95 nights); by year 2022 +0.163 (n 12), 2023 +0.22 (n 12), 2024 +0.021 (n 12), 2025 +0.209 (n 12), 2026 +0.174 (n 9).
- **POOL**: OOS long -0.107R (n 20), short +0.139R (n 36); mean cost 0.007R, financing 0.025R (4.92 nights); by year 2022 +0.129 (n 24), 2023 +0.066 (n 24), 2024 -0.031 (n 24), 2025 +0.011 (n 24), 2026 +0.205 (n 18).

Median absolute window move in ATR (descriptive): BTC expiry 0.444 (n 57) against other Fridays 0.632 (n 191); ETH expiry 0.52 (n 57) against other Fridays 0.583 (n 191).

## Reported only: into expiry: Thu 08:00 -> Fri 08:00, against the 7 days before

| Test | window | n | win % | R before costs | net R a trade | event t | month-sum t | total R | max DD | net at 2x | stops |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BTC | IS | 29 | 55 | +0.092 | +0.079 | 1.13 | 1.13 | +2.3 | -1.46 | +0.067 | 0 |
| BTC | OOS | 29 | 41 | -0.182 | -0.196 | -2.11 | -2.11 | -5.68 | -6.55 | -0.21 | 5 |
| BTC | ALL | 58 | 48 | -0.045 | -0.058 | -0.96 | -0.96 | -3.38 | -6.55 | -0.071 | 5 |
| ETH | IS | 29 | 52 | +0.045 | +0.034 | 0.43 | 0.43 | +0.99 | -1.58 | +0.023 | 1 |
| ETH | OOS | 29 | 41 | -0.106 | -0.116 | -1.39 | -1.39 | -3.36 | -3.97 | -0.126 | 4 |
| ETH | ALL | 58 | 47 | -0.031 | -0.041 | -0.71 | -0.71 | -2.37 | -3.97 | -0.051 | 5 |
| POOL | IS | 58 | 53 | +0.068 | +0.057 | 1.08 | 0.98 | +3.29 | -1.58 | +0.045 | 1 |
| POOL | OOS | 58 | 41 | -0.144 | -0.156 | -2.51 | -1.95 | -9.04 | -10.51 | -0.168 | 9 |
| POOL | ALL | 116 | 47 | -0.038 | -0.05 | -1.19 | -0.97 | -5.75 | -10.51 | -0.061 | 10 |

OOS one-sided p from the month-sum t, Holm over BTC / ETH / POOL: BTC p 0.983, Holm 1; ETH p 0.917, Holm 1; POOL p 0.974, Holm 1.

- **BTC**: OOS long -0.379R (n 17), short +0.063R (n 12); mean cost 0.008R, financing 0.006R (0.95 nights); by year 2022 +0.184 (n 12), 2023 -0.034 (n 12), 2024 +0.042 (n 12), 2025 -0.185 (n 12), 2026 -0.347 (n 10).
- **ETH**: OOS long -0.329R (n 16), short +0.146R (n 13); mean cost 0.006R, financing 0.005R (0.98 nights); by year 2022 -0.006 (n 12), 2023 +0.056 (n 12), 2024 +0.005 (n 12), 2025 -0.001 (n 12), 2026 -0.303 (n 10).
- **POOL**: OOS long -0.354R (n 33), short +0.106R (n 25); mean cost 0.007R, financing 0.005R (0.97 nights); by year 2022 +0.089 (n 24), 2023 +0.011 (n 24), 2024 +0.023 (n 24), 2025 -0.093 (n 24), 2026 -0.325 (n 20).

Median absolute window move in ATR (descriptive): BTC expiry 0.402 (n 58) against other Fridays 0.436 (n 191); ETH expiry 0.368 (n 58) against other Fridays 0.418 (n 191).

## Funnel (primary window, expiry Fridays 2022-01 to 2026-10)

| Market | expiries | priced | trades (long / short) | first | last |
|---|---|---|---|---|---|
| BTC | 58 | 58 | 57 (23 / 34) | 2022-01-28 | 2026-09-25 |
| ETH | 58 | 58 | 57 (26 / 31) | 2022-01-28 | 2026-09-25 |

## Reading

- Primary (POOL, Friday 08:00 to Monday 08:00 with the 7-day trend): OOS +0.052R a trade net (n 56, month t 0.6, event t 0.54; +0.083R before costs), IS +0.086R (n 58), OOS at 2x costs +0.02R.
- Against the placebo (the same rule on random non-expiry Fridays of the OOS window): the real figure beats 25 of 40 runs (placebo middle +0.025R).
- Reported only, into expiry against the 7-day move: POOL OOS -0.156R (n 58, month t -1.95), IS +0.057R. Pinning as a smaller Thursday-to-Friday move: median BTC 0.402 on expiry against 0.436 ATR otherwise, ETH 0.368 on expiry against 0.418 ATR otherwise (descriptive).
- n is small by construction (one event a month a coin); a 1R stop of 1.5 daily ATRs is rarely hit over three days, so the result is mostly the sign of the weekend move.
- Not an edge. Do not trade it, do not add it to the council, and do not re-test other windows, directions or stops of the expiry calendar on these candles.

## What was not done, and why

- No open-interest or strike data are on file and no exchange API is reachable from the build sandbox, so "max pain" itself was not computed: this is a calendar test of the release.
- No hourly or finer BTC / ETH candles before 2022 exist in the repository or council-data; the study covers 2022-01 to 2026-10 only (about 28 events a coin each half).
- Binance spot prices stand in for the broker's CFD prices; today's financing rates are charged for every year. CME's 16:00 London settlement was not tested separately.

## To repeat

```sh
node research/edge/crypto-expiry/run.mjs fetch <dir>   # git show from origin/council-data, no network
node research/edge/crypto-expiry/run.mjs run <dir>
```
