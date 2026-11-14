# Gold: the London move faded in New York (the "Judas swing")

Paper research only. A new stand-alone intraday rule on spot gold, **not a gate, exit, entry or size of the live gold book** (item 44: no candle before 2016 read, none of the book's records opened). Nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 3: fading gold's London move at 09:30 NY, 2021 → now −0.164R a trade net (n 352, month t −2.22, gross −0.064R); after a NY raid −0.380R (n 155, t −3.82)**

## Tests (R of the stop distance; t on calendar-month sums of net R)

| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | fade London at 09:30 | 2016-2020 | 319 | 33.5 % | −0.224 | −0.018 | −0.430 | +0.206 | −71.41 | −3.11 | −0.24 | 162 / 157 | −76.08 | 3.41 |
| T1 | fade London at 09:30 | 2021 → 2026-11-13 | 352 | 32.1 % | −0.164 | −0.064 | −0.264 | +0.100 | −57.71 | −2.22 | −0.87 | 194 / 158 | −58.64 | 7.78 |
| T2 | T1 on the midnight open's side | 2016-2020 | 301 | 32.2 % | −0.249 | −0.036 | −0.461 | +0.213 | −74.81 | −3.29 | −0.47 | 161 / 140 | −78.48 | 3.29 |
| T2 | T1 on the midnight open's side | 2021 → 2026-11-13 | 322 | 29.5 % | −0.191 | −0.086 | −0.296 | +0.105 | −61.42 | −2.34 | −1.05 | 190 / 132 | −61.49 | 7.34 |
| T3 | after a New York raid of the London extreme | 2016-2020 | 137 | 31.4 % | −0.244 | +0.001 | −0.490 | +0.245 | −33.46 | −1.83 | +0.01 | 81 / 56 | −37.51 | 2.72 |
| T3 | after a New York raid of the London extreme | 2021 → 2026-11-13 | 155 | 27.7 % | −0.380 | −0.267 | −0.494 | +0.114 | −58.97 | −3.82 | −2.69 | 100 / 55 | −63.18 | 5.93 |

## Decision (out of sample, Holm over the three tests)

| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | in sample > 0 | 2x cost > 0 | above placebo 95th | pass |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.987 | 1 | no | no | no | no | no | no | **fail** |
| T2 | 0.99 | 1 | no | no | no | no | no | no | **fail** |
| T3 | 1 | 1 | no | no | no | no | no | no | **fail** |

**Placebo** (each test's own trade days with a random side, same entry, stop rule and exit; 40 seeds, 2021 → now):

- T1: seed means −0.227 to +0.034R a trade, median −0.097, 95th percentile −0.010R; the rule −0.164R.
- T2: seed means −0.220 to +0.068R a trade, median −0.080, 95th percentile +0.026R; the rule −0.191R.
- T3: seed means −0.318 to −0.032R a trade, median −0.191, 95th percentile −0.066R; the rule −0.380R.

## Sides

- T1, 2021 → now: buys (London down) n 175 −0.098R, sells (London up) n 177 −0.229R; 2016-20: buys n 145 −0.303R, sells n 174 −0.158R.
- T2, 2021 → now: buys (London down) n 161 −0.111R, sells (London up) n 161 −0.270R; 2016-20: buys n 137 −0.330R, sells n 164 −0.180R.
- T3, 2021 → now: buys (London down) n 81 −0.405R, sells (London up) n 74 −0.353R; 2016-20: buys n 60 −0.497R, sells n 77 −0.047R.

## By year (net R a trade, n)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2016 | −0.327 (43) | −0.361 (41) | −0.603 (20) |
| 2017 | −0.206 (55) | −0.219 (54) | −0.466 (25) |
| 2018 | −0.121 (84) | −0.154 (76) | +0.284 (33) |
| 2019 | −0.340 (68) | −0.347 (65) | −0.520 (31) |
| 2020 | −0.184 (69) | −0.214 (65) | −0.107 (28) |
| 2021 | −0.006 (61) | −0.028 (55) | −0.132 (27) |
| 2022 | −0.254 (71) | −0.307 (65) | −0.400 (32) |
| 2023 | −0.163 (45) | −0.158 (39) | −0.778 (22) |
| 2024 | −0.183 (66) | −0.222 (57) | −0.177 (27) |
| 2025 | +0.032 (66) | +0.034 (64) | −0.353 (30) |
| 2026 | −0.513 (43) | −0.554 (42) | −0.596 (17) |

## Reading

No test passes the pre-registered bar (T1 failed: netPos, t2, holm, isPos, cost2x, placebo). Out of sample the plain fade makes −0.164R a trade after $0.60 a round trip (n 352, month t −2.22; before costs −0.064R, t −0.87); the midnight-open condition gives −0.191R (n 322, t −2.34) and waiting for a New York raid of the London extreme −0.380R (n 155, t −3.82). Not an edge; nothing live changes and no proposal is written.

## Data and method

- OANDA mid XAU/USD M5 through the keyless candle proxy, read from 2016-01-01; trade days 2016-02-08 → 2026-11-12; CME calendar from ict/calendar.mjs (full holidays and early closes skipped)
- Days: 671 trade days (London move over 0.3 x ATR20); skipped atr 20, small 2022, london 1; no entry candle / condition: T1 0, T2 48, T3 379.
- Rule: trade day when the London move (07:55 close − 02:00 open) exceeds 0.3 x ATR20 of 17:00-NY sessions; side against it; T1 market at the 09:30 open; T2 = T1 when London's extreme and the entry are beyond the midnight open; T3 = after a candle from 08:00 trades beyond the London extreme, the first candle opening 09:00-10:25 that closes back inside, entry at the next open; stop $0.30 beyond the extreme since 02:00 (at least 0.1 x ATR20); stop first; flat 16:00; one trade a day
- Costs: $0.30 spread a round trip per ounce (`research/edge/gold-systems`, `spreadOf` for spot) + $0.15 slippage on each market order = $0.60 a round trip; 2x reported; no financing (flat at 16:00).
- To repeat: `node --use-env-proxy research/edge/gold-london-reversal/fetch.mjs <dir>`, then `node research/edge/gold-london-reversal/run.mjs <dir>`.
