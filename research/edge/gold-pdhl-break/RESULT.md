# Gold: an M15 close beyond the previous day's high or low, held as a continuation

Paper research only. A new stand-alone intraday rule on spot gold, **not a gate, exit, entry or size of the live gold book** (item 44; none of the book's records opened). Nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). The opposite question to `mmxm-pdhl-raid-gold` (a fade of the raid). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 3: buying / selling an M15 close beyond the previous day's high / low, 2021 → now −0.026R a trade net (n 1120, month t −0.64); 2016-20 −0.090R (n 939)**

## Tests (R of the stop distance; t on calendar-month sums of net R, every month of the window counted)

| Test | Rule | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / targets / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | no target, out at 20:00 UTC | 2016-2020 | 939 | 37.2 % | −0.090 | +0.027 | −0.206 | +0.116 | −84.11 | −2.44 | +0.76 | 405 / 0 / 534 | −111.83 | 5.36 |
| T1 | no target, out at 20:00 UTC | 2021 → 2026-11-13 | 1120 | 42.1 % | −0.026 | +0.033 | −0.084 | +0.059 | −28.81 | −0.64 | +0.83 | 467 / 0 / 653 | −56.78 | 10.37 |
| T2 | target 1.5R, else out at 20:00 UTC | 2016-2020 | 939 | 39.9 % | −0.135 | −0.019 | −0.251 | +0.116 | −126.58 | −4.04 | −0.59 | 391 / 220 / 328 | −137.87 | 5.36 |
| T2 | target 1.5R, else out at 20:00 UTC | 2021 → 2026-11-13 | 1120 | 44.6 % | −0.062 | −0.003 | −0.120 | +0.059 | −69.14 | −1.94 | −0.10 | 451 / 236 / 433 | −90.78 | 10.37 |
| T3 | T1 on the side of the 20-day average | 2016-2020 | 531 | 38.4 % | −0.090 | +0.026 | −0.206 | +0.116 | −47.74 | −1.54 | +0.46 | 229 / 0 / 302 | −64.23 | 5.39 |
| T3 | T1 on the side of the 20-day average | 2021 → 2026-11-13 | 633 | 43.3 % | −0.001 | +0.057 | −0.059 | +0.058 | −0.65 | −0.02 | +1.25 | 268 / 0 / 365 | −52.31 | 10.39 |

## Decision (out of sample, Holm over the three tests)

| Test | p | Holm p | net > 0 | t ≥ 2 | Holm < 0.05 | in sample > 0 | 2x cost > 0 | beats ≥ 38 of 40 placebos | n ≥ 30 | pass |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.74 | 1 | no | no | no | no | no | no (27) | yes | **fail** |
| T2 | 0.974 | 1 | no | no | no | no | no | no (17) | yes | **fail** |
| T3 | 0.509 | 1 | no | no | no | no | no | no (33) | yes | **fail** |

**Placebo** (40 seeds; per real out-of-sample trade a random out-of-sample day, a random M15 entry 07:00-16:45 UTC, a random side, the real stop distance, the test's own exit and costs):

- T1: seed means −0.160 to +0.040R a trade, median −0.048; the rule −0.026R beats 27 of 40.
- T2: seed means −0.113 to +0.017R a trade, median −0.047; the rule −0.062R beats 17 of 40.
- T3: seed means −0.115 to +0.120R a trade, median −0.043; the rule −0.001R beats 33 of 40.

## Sides

- T1, 2021 → now: buys n 615 −0.077R, sells n 505 +0.037R; 2016-20: buys n 507 −0.043R, sells n 432 −0.144R.
- T2, 2021 → now: buys n 615 −0.081R, sells n 505 −0.039R; 2016-20: buys n 507 −0.099R, sells n 432 −0.177R.
- T3, 2021 → now: buys n 392 −0.043R, sells n 241 +0.068R; 2016-20: buys n 319 −0.009R, sells n 212 −0.212R.

## By year (net R a trade, n)

| Year | T1 | T2 | T3 |
|---|---|---|---|
| 2016 | +0.002 (181) | −0.065 (181) | +0.085 (98) |
| 2017 | −0.194 (194) | −0.185 (194) | +0.044 (110) |
| 2018 | −0.211 (178) | −0.235 (178) | −0.284 (103) |
| 2019 | −0.113 (189) | −0.184 (189) | −0.252 (107) |
| 2020 | +0.061 (197) | −0.011 (197) | −0.041 (113) |
| 2021 | −0.112 (187) | −0.182 (187) | −0.051 (99) |
| 2022 | −0.018 (195) | −0.014 (195) | +0.029 (110) |
| 2023 | +0.009 (203) | −0.122 (203) | −0.156 (120) |
| 2024 | −0.100 (190) | −0.118 (190) | −0.131 (106) |
| 2025 | +0.004 (192) | +0.042 (192) | +0.079 (117) |
| 2026 | +0.080 (153) | +0.045 (153) | +0.303 (81) |

## Reading

No test passes the pre-registered bar (T1 failed: netPos, t2, holm, isPos, cost2x, placebo; T2: netPos, t2, holm, isPos, cost2x, placebo; T3: netPos, t2, holm, isPos, cost2x, placebo). Out of sample the plain continuation makes −0.026R a trade after $0.60 a round trip (n 1120, month t −0.64; before costs +0.033R, t +0.83); with a 1.5R target −0.062R (n 1120, t −1.94); on the side of the 20-day average −0.001R (n 633, t −0.02). Not an edge; nothing live changes and no proposal is written. A variant (another stop, window or target) would be a different rule and needs its own pre-registration.

## Data and method

- OANDA mid XAU/USD M5 through the keyless candle proxy, 2015-12-01 → 2026-11-13 (776427 candles); trade days 2016-01-01 → 2026-11-13; M15 and D1 built from M5
- Days: 2806 UTC weekdays with candles 07:00-17:00 and 21 earlier folded daily candles; skipped window 16.
- Funnel: T1 2059 triggers, 0 against the 20-day average, 0 with no entry before 20:00, 0 while a position was open, 0 with the entry past the stop; T2 2059 triggers, 0 against the 20-day average, 0 with no entry before 20:00, 0 while a position was open, 0 with the entry past the stop; T3 2059 triggers, 895 against the 20-day average, 0 with no entry before 20:00, 0 while a position was open, 0 with the entry past the stop.
- Rule: previous day = the last complete UTC daily candle, weekends folded (foldWeekend); first M15 close above PDH (buy) / below PDL (sell) of a candle starting 07:00-16:45 UTC, one per side per day; market at the next M15 open; stop PDH − 0.25 x ATR20(D1) (sell: PDL + 0.25 x ATR20); T1 out at 20:00 UTC; T2 target 1.5R else 20:00; T3 = T1 when the previous D1 close is on the trade's side of its 20-day average; one position at a time per test; walked on M5, stop first, a gap through the stop at the open
- Costs: $0.60 a round trip per ounce on every trade; financing `council/fills.mjs` `FIN.xau.long` x `nights` on buys (mean +0.000R a trade: the 20:00 UTC exit is before the rollover); 2x reported.
- To repeat: `node research/edge/gold-pdhl-break/run.mjs <path to xau-5m-vol.json.gz>` (OANDA mid M5 XAU/USD through the keyless candle proxy, kept out of git). Tests: `tests/gold-pdhl-break.test.mjs`.
