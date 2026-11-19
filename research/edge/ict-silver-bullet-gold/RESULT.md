# ICT silver bullet on spot gold: the one-hour window entry, AM / PM / London

Paper research only. ICT is a separate edge; nothing under `ict/` changed (only its CME calendar is read), nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 3: AM silver bullet on gold 2021 → now −0.168R a trade net (n 401, month t −2.13, gross −0.078R); 2016-20 −0.253R**

## Tests

| Test | Window | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / targets / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | AM 10:00-11:00 | 2016-2020 | 360 | 33.9 % | −0.253 | −0.036 | −0.469 | +0.216 | −90.94 | −3.42 | −0.51 | 225 / 99 / 36 | −109.65 | 1.51 |
| T1 | AM 10:00-11:00 | 2021 → 2026-11-13 | 401 | 33.4 % | −0.168 | −0.078 | −0.258 | +0.090 | −67.18 | −2.13 | −0.98 | 251 / 103 / 47 | −75.47 | 3.72 |
| T2 | PM 14:00-15:00 | 2016-2020 | 351 | 36.2 % | −0.377 | +0.038 | −0.791 | +0.414 | −132.18 | −4.35 | +0.45 | 197 / 97 / 57 | −137.50 | 0.86 |
| T2 | PM 14:00-15:00 | 2021 → 2026-11-13 | 490 | 33.3 % | −0.311 | −0.058 | −0.564 | +0.253 | −152.37 | −5.49 | −1.16 | 303 / 128 / 59 | −153.40 | 1.39 |
| T3 | London 03:00-04:00 | 2016-2020 | 148 | 35.1 % | −0.289 | +0.046 | −0.624 | +0.335 | −42.75 | −2.56 | +0.47 | 96 / 51 / 1 | −54.40 | 0.99 |
| T3 | London 03:00-04:00 | 2021 → 2026-11-13 | 191 | 30.9 % | −0.224 | −0.073 | −0.375 | +0.151 | −42.83 | −2.15 | −0.69 | 132 / 59 / 0 | −43.23 | 2.43 |

## Decision (out of sample, Holm over the three tests)

| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | in sample > 0 | 2x cost > 0 | above placebo 95th | pass |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.983 | 1 | no | no | no | no | no | no | **fail** |
| T2 | 1 | 1 | no | no | no | no | no | no | **fail** |
| T3 | 0.984 | 1 | no | no | no | no | no | no | **fail** |

**Placebo** (the same rule in a random one-hour window starting 00:30-14:55 New York, one draw a day, 40 seeds, 2021 → now): seed means from −0.365 to −0.034R a trade, median −0.226, 95th percentile −0.106R.

## Sides and skipped days

- T1 (AM 10:00-11:00), 2021 → now: buys n 177 −0.091R, sells n 224 −0.228R; days without a trade, whole period: nofill 386, nosweep 611, latesweep 186, opposite 54, nogap 713, room 2, both 1.
- T2 (PM 14:00-15:00), 2021 → now: buys n 220 −0.324R, sells n 270 −0.300R; days without a trade, whole period: nosweep 610, nogap 767, nofill 350, opposite 118, latesweep 26, missing 1, both 1.
- T3 (London 03:00-04:00), 2021 → now: buys n 81 −0.318R, sells n 110 −0.155R; days without a trade, whole period: nogap 379, nosweep 611, latesweep 1216, nofill 167, missing 1, both 1.

## By year (net R a trade, n)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2016 | −0.018 (74) | −0.247 (72) | −0.221 (25) |
| 2017 | −0.361 (83) | −0.326 (63) | −0.452 (28) |
| 2018 | −0.207 (65) | −0.422 (63) | −0.422 (32) |
| 2019 | −0.446 (67) | −0.752 (73) | −0.450 (37) |
| 2020 | −0.230 (71) | −0.155 (80) | +0.215 (26) |
| 2021 | −0.223 (69) | −0.329 (91) | −0.388 (30) |
| 2022 | −0.135 (63) | −0.390 (79) | −0.219 (32) |
| 2023 | −0.133 (68) | −0.382 (87) | +0.097 (32) |
| 2024 | −0.300 (63) | −0.293 (82) | −0.317 (34) |
| 2025 | +0.019 (72) | −0.232 (81) | −0.220 (31) |
| 2026 | −0.253 (66) | −0.224 (70) | −0.301 (32) |

## Reading

The primary AM window does not pass the pre-registered bar (failed: netPos, t2, holm, isPos, cost2x, placebo). Out of sample it makes −0.168R a trade after $0.30 a round trip (n 401, month t −2.13; before costs −0.078R, t −0.98); costs take 0.090R a trade at a median stop of $3.72. Not an edge; nothing on the ICT desk or the council changes and no proposal is written.

## Data and method

- OANDA mid XAU/USD M5 through the keyless candle proxy, 2714 trading days 2016-01-04 → 2026-11-13; CME calendar from ict/calendar.mjs (full holidays and early closes skipped)
- Rule: draw = prior 17:00-NY day high/low and the Asian range (18:00-00:00 NY); the first side swept from 00:00 sets the side (buy side swept → sell); first M5 FVG (middle candle in the trade direction) whose third candle opens in the window up to 10 min before its end; limit at the near edge until the window ends; stop at the first candle's extreme; target the nearer of the opposite draw and 2R (skip under 1R of room); stop first; flat 16:00; one trade a day
- Costs: $0.30 a round trip per ounce (`research/edge/gold-systems`, `spreadOf` for spot), 2x reported; no financing (flat at 16:00).
- Item 44: a new standalone intraday rule; not a gate, exit, entry or size of the live gold book; no candle before 2016 read, none of the book's 2006-17 records opened.
- To repeat: `node --use-env-proxy research/edge/ict-silver-bullet-gold/fetch.mjs <dir>`, then `node research/edge/ict-silver-bullet-gold/run.mjs <dir>`.
