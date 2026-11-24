# Asian index CFDs: gold's intraday volatility breakout, unchanged (UTC open ± 0.5 × the previous day's range)

**Verdict: FAIL, 0 of 3: T1 breakout after 0.04 % costs, 2016 → now: JP225 −0.012R (n 2065, t −0.45; gross +0.050R), AU200 −0.106R (n 2044, t −4.49; gross −0.019R), Pooled −0.059R (n 4109, t −3.33; gross +0.016R)**

Paper research only; nothing live changed, no proposal. Rule, markets, cost, windows, placebo and bar were committed alone first (`PREREGISTRATION.md`, sha256 in `result.json`). The rule is imported unchanged from `research/edge/index-vol-breakout/original.mjs` (sha256 checked). This page is written by `run.mjs` from `result.json`.

## Results (R a trade; net = after 0.04 % of price a round trip; t = t of calendar-month sums)

| Market | Window | n | Win | Net R | Gross R | Net at 2x cost | Cost R | Total net R | Month t | Gross t | 2x t | Max DD R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| JP225 | discovery 2010-05-10 → 2015 | 722 | 48.2 % | +0.126 | +0.182 | +0.070 | +0.056 | +91.07 | +3.05 | +4.37 | +1.70 | −12.57 |
| JP225 | confirmation 2016 → 2026-11-23 | 2065 | 44.2 % | −0.012 | +0.050 | −0.073 | +0.062 | −23.84 | −0.45 | +1.96 | −2.81 | −46.54 |
| AU200 | discovery 2006-07-19 → 2015 | 585 | 45.0 % | +0.017 | +0.087 | −0.053 | +0.070 | +9.99 | +0.41 | +2.08 | −1.21 | −29.41 |
| AU200 | confirmation 2016 → 2026-11-23 | 2044 | 40.9 % | −0.106 | −0.019 | −0.193 | +0.087 | −216.92 | −4.49 | −0.84 | −7.91 | −234.10 |
| Pooled | discovery start → 2015 | 1307 | 46.7 % | +0.077 | +0.139 | +0.015 | +0.062 | +101.06 | +2.55 | +4.45 | +0.50 | −29.41 |
| Pooled | confirmation 2016 → 2026-11-23 | 4109 | 42.6 % | −0.059 | +0.016 | −0.133 | +0.074 | −240.76 | −3.33 | +0.90 | −7.35 | −250.61 |

## Decision (confirmation month t, one-sided normal p, Holm over the three tests)

| Test | p | Holm p | discovery > 0 | confirmation > 0 | t ≥ 2 | Holm < 0.05 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 200 conf, ≥ 30 disc | pass |
|---|---|---|---|---|---|---|---|---|---|---|
| JP225 | 0.674 | 1 | yes | no | no | no | no | 40 | yes | **fail** |
| AU200 | 1 | 1 | yes | no | no | no | no | 3 | yes | **fail** |
| Pooled | 1 | 1 | yes | no | no | no | no | 27 | yes | **fail** |

## Placebo (confirmation window, 40 seeds)

| Test | Real net R | Placebo median | Placebo 95th pct | min / max |
|---|---|---|---|---|
| JP225 | −0.012 | −0.047 | −0.022 | −0.082 / −0.016 |
| AU200 | −0.106 | −0.090 | −0.063 | −0.122 / −0.055 |
| Pooled | −0.059 | −0.065 | −0.051 | −0.093 / −0.047 |

## Reported only: early (fill before 06:00 UTC) against late fills, confirmation window

| Market | Early n | Early net R | Early month t | Late n | Late net R | Late month t |
|---|---|---|---|---|---|---|
| JP225 | 1243 | +0.026 | +0.68 | 822 | −0.068 | −2.46 |
| AU200 | 1188 | −0.139 | −4.00 | 856 | −0.061 | −2.56 |
| Pooled | 2431 | −0.055 | −2.03 | 1678 | −0.064 | −3.23 |

## Sides, skipped days, by year

- JP225, confirmation: buys n 1006 +0.067R, sells n 1059 −0.086R; days without a trade (whole file): noprev 1, noopen 1390, thin 540, nofill 952.
- AU200, confirmation: buys n 1034 −0.059R, sells n 1010 −0.154R; days without a trade (whole file): noprev 1, thin 1820, noopen 235, nofill 861, flatprev 41.

| Year | JP225 | AU200 | Pooled |
|---|---|---|---|
| 2006 | — | −1.054 (1) | −1.054 (1) |
| 2007 | — | +0.410 (44) | +0.410 (44) |
| 2008 | — | −0.122 (23) | −0.122 (23) |
| 2009 | — | +0.027 (31) | +0.027 (31) |
| 2010 | −0.125 (4) | +0.359 (2) | +0.037 (6) |
| 2011 | +0.179 (9) | +0.129 (45) | +0.137 (54) |
| 2012 | +0.071 (141) | +0.205 (45) | +0.103 (186) |
| 2013 | +0.192 (190) | −0.024 (51) | +0.146 (241) |
| 2014 | +0.118 (183) | −0.070 (159) | +0.031 (342) |
| 2015 | +0.112 (195) | −0.046 (184) | +0.035 (379) |
| 2016 | −0.065 (195) | −0.049 (184) | −0.057 (379) |
| 2017 | +0.028 (184) | −0.194 (171) | −0.079 (355) |
| 2018 | +0.048 (194) | −0.254 (200) | −0.106 (394) |
| 2019 | −0.143 (186) | −0.037 (188) | −0.090 (374) |
| 2020 | −0.002 (191) | +0.065 (198) | +0.032 (389) |
| 2021 | +0.063 (189) | −0.255 (190) | −0.096 (379) |
| 2022 | −0.129 (186) | −0.064 (184) | −0.097 (370) |
| 2023 | +0.065 (190) | −0.098 (187) | −0.016 (377) |
| 2024 | +0.060 (184) | −0.135 (184) | −0.038 (368) |
| 2025 | −0.120 (190) | −0.093 (190) | −0.107 (380) |
| 2026 | +0.072 (176) | −0.051 (168) | +0.012 (344) |

## Reading

JP225 confirmation −0.012R net (n 2065, month t −0.45; gross +0.050R, gross t +1.96; discovery +0.126R, n 722; 2x cost −0.073R; 40 of 40 placebos beaten; failed: confPos, t2, holm, cost2x). AU200 confirmation −0.106R net (n 2044, month t −4.49; gross −0.019R, gross t −0.84; discovery +0.017R, n 585; 2x cost −0.193R; 3 of 40 placebos beaten; failed: confPos, t2, holm, cost2x, placebo). Pooled confirmation −0.059R net (n 4109, month t −3.33; gross +0.016R, gross t +0.90; discovery +0.077R, n 1307; 2x cost −0.133R; 27 of 40 placebos beaten; failed: confPos, t2, holm, cost2x, placebo). Costs take 0.074R a trade pooled in confirmation. Before costs the breakout leans the right way on JP225 and not after: a before-cost tilt is not an edge. Nothing passes: the breakout's early-hours gain on gold and USD/JPY does not carry to the Asian index CFDs on this evidence. Not an edge; nothing live changes and no proposal is written.

## Data and method

- OANDA mid M5 through the candle proxy (edgekit cache): jp225 1246311 rows 2005-01-03T14:00 → 2026-11-24T11:45 (5670 weekdays built); au200 1102773 rows 2005-01-03T22:50 → 2026-11-24T11:50 (5587 weekdays built); trading days to 2026-11-23
- Rule: gold-vol-breakout T1 unchanged: O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange, sell stop O − 0.5 × prevRange, live 00:00-20:55 UTC, first filled wins; stop back at O (worst case in the fill candle); out at the close of the last candle before 21:00 UTC; days under 200 candles or without a 00:00-00:55 candle skipped
- Costs: round trip 0.04 % of the entry price (gotobi-jp225's figure, assumed, not measured on the demo account), 2x reported; financing per 22:00 UTC rollover by index-vol-breakout's formula (DGS2 assumed 5 %): no trade crosses 22:00 UTC, so 0
- To repeat: fill the edgekit cache (`node --use-env-proxy research/edge/_lib/fetch-cache.mjs <jp225|au200> 5m 2005 2026`), then `node research/edge/asia-index-vol-breakout/run.mjs`.
