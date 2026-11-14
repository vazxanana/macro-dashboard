# Index CFDs: gold's intraday volatility breakout, unchanged (UTC open ± 0.5 × the previous day's range)

Paper research only. A robustness check of `gold-vol-breakout` (branch `gold-vol-breakout`) on two markets the rule was not found on; not a rule for any live book, never a gate, exit, entry or size of the live gold book (owner decision 44), and not part of the ICT edge. Nothing live changed, no proposal. The rule, markets, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). The rule's functions are imported from `original.mjs`, a byte-for-byte copy of that study's `run.mjs` (sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 2, not a general effect: gold's T1 breakout 2016 → now on NAS100 −0.004R net (n 2040, t −0.16; gross +0.055R, t +2.58), SPX500 −0.036R net (n 2015, t −1.64; gross +0.032R, t +1.49)**

## Results

| Market | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | 2x-cost t | Stops / time | Max DD R | Median stop (points) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NAS100 | 2016-2020 | 924 | 42.1 % | −0.035 | +0.062 | −0.133 | +0.097 | −32.67 | −0.97 | +1.82 | −3.30 | 342 / 582 | −53.55 | 39.25 |
| NAS100 | 2021 → 2026-11-11 | 1116 | 45.6 % | +0.023 | +0.049 | −0.004 | +0.027 | +25.34 | +0.83 | +1.82 | −0.14 | 404 / 712 | −35.90 | 133.9 |
| NAS100 | 2016 → 2026-11-11 | 2040 | 44.0 % | −0.004 | +0.055 | −0.062 | +0.059 | −7.33 | −0.16 | +2.58 | −2.56 | 746 / 1294 | −53.55 | 93.2 |
| SPX500 | 2016-2020 | 898 | 44.2 % | −0.039 | +0.059 | −0.137 | +0.098 | −34.93 | −1.04 | +1.67 | −3.40 | 316 / 582 | −62.64 | 11.8 |
| SPX500 | 2021 → 2026-11-11 | 1117 | 45.2 % | −0.033 | +0.010 | −0.076 | +0.043 | −37.24 | −1.29 | +0.38 | −2.89 | 423 / 694 | −60.02 | 28 |
| SPX500 | 2016 → 2026-11-11 | 2015 | 44.8 % | −0.036 | +0.032 | −0.103 | +0.067 | −72.17 | −1.64 | +1.49 | −4.46 | 739 / 1276 | −91.35 | 20.6 |
| Pooled | 2016-2020 | 1822 | 43.1 % | −0.037 | +0.061 | −0.135 | +0.098 | −67.60 | −1.12 | +1.97 | −3.71 | 658 / 1164 | −94.98 | 22 |
| Pooled | 2021 → 2026-11-11 | 2233 | 45.4 % | −0.005 | +0.030 | −0.040 | +0.035 | −11.90 | −0.22 | +1.26 | −1.66 | 827 / 1406 | −60.02 | 60.15 |
| Pooled | 2016 → 2026-11-11 | 4055 | 44.4 % | −0.020 | +0.043 | −0.083 | +0.063 | −79.50 | −0.99 | +2.30 | −3.87 | 1485 / 2570 | −98.34 | 36.1 |

## Decision (2016 → now per market, Holm over the two markets)

| Market | p | Holm p | 2016-20 > 0 | 2021 → now > 0 | t ≥ 2 | Holm < 0.05 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 each window | pass |
|---|---|---|---|---|---|---|---|---|---|---|
| NAS100 | 0.564 | 1 | no | yes | no | no | no | 34 | yes | **fail** |
| SPX500 | 0.949 | 1 | no | no | no | no | no | 25 | yes | **fail** |

Outcome: **not general** (pre-registered: "generalises" only when both markets pass).

## Placebo (2016 → now, 40 seeds)

Every day the rule could trade, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin, stop 0.5 × the previous day's range away, out at 21:00 UTC or the stop, the same costs.

| Market | Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |
|---|---|---|---|---|
| NAS100 | −0.004 | −0.024 | +0.004 | −0.059 / +0.014 |
| SPX500 | −0.036 | −0.046 | −0.006 | −0.095 / +0.014 |

## Sides and skipped days

- NAS100, 2016 → now: buys n 1053 +0.052R, sells n 987 −0.063R; financing +0.000R a trade; days without a trade: noopen 21, flatprev 1, thin 9, nofill 752.
- SPX500, 2016 → now: buys n 1041 +0.015R, sells n 974 −0.090R; financing +0.000R a trade; days without a trade: noopen 21, flatprev 1, thin 75, nofill 711.

## By year (net R a trade, n)

| Year | NAS100 | SPX500 | Pooled |
|---|---|---|---|
| 2016 | −0.091 (182) | −0.144 (192) | −0.118 (374) |
| 2017 | −0.111 (175) | −0.169 (149) | −0.138 (324) |
| 2018 | +0.027 (183) | +0.037 (185) | +0.032 (368) |
| 2019 | −0.037 (190) | +0.004 (184) | −0.017 (374) |
| 2020 | +0.028 (194) | +0.055 (188) | +0.041 (382) |
| 2021 | −0.010 (194) | −0.038 (195) | −0.024 (389) |
| 2022 | +0.044 (191) | +0.007 (182) | +0.026 (373) |
| 2023 | −0.007 (198) | −0.031 (200) | −0.019 (398) |
| 2024 | +0.096 (177) | −0.016 (180) | +0.040 (357) |
| 2025 | −0.108 (191) | −0.160 (192) | −0.134 (383) |
| 2026 | +0.143 (165) | +0.052 (168) | +0.097 (333) |

## Reading

NAS100 2016 → now −0.004R net (n 2040, month t −0.16, Holm p 1; gross +0.055R, gross t +2.58; 2016-20 −0.035R, 2021 → now +0.023R; at 2x costs −0.062R; 34 of 40 placebos beaten; failed: isPos, t2, holm, cost2x, placebo). SPX500 2016 → now −0.036R net (n 2015, month t −1.64, Holm p 1; gross +0.032R, gross t +1.49; 2016-20 −0.039R, 2021 → now −0.033R; at 2x costs −0.103R; 25 of 40 placebos beaten; failed: isPos, oosPos, t2, holm, cost2x, placebo). Pooled (descriptive, not a test): −0.020R net (n 4055, month t −0.99; gross +0.043R, t +2.30). Costs take 0.059R a trade on NAS100 and 0.067R on SPX500 (2016-20 0.097R / 0.098R, when the index levels were lower and a fixed point cost was a larger share of 1R; gold's out-of-sample cost was about 0.05R). Before costs the breakout is positive on NAS100 (gross month t +2.58) and positive on SPX500 (gross t +1.49), smaller than on gold (+0.121R a trade gross 2021 → now); as on silver, gross and net split: the lean survives on paper before costs and not after. Neither market passes: the same rule does not carry from gold to the US index CFDs, so on this evidence the gold result (with its 2007-15 replication) is a gold-specific effect, not a general intraday volatility-breakout effect. Not an edge on indices; nothing live changes and no proposal is written.

## Data and method

- OANDA mid M5 through the keyless candle proxy: nas100 770832 rows 2015-12-01T00:00 → 2026-11-12T23:55 (2845 weekdays built); spx500 753827 rows 2015-12-01T00:00 → 2026-11-12T23:55 (2845 weekdays built); trading days 2016-01-01 → 2026-11-11
- Correction: the pre-registration gave the files' last candle as 2026-11-13 21:55 UTC; it is 2026-11-12 23:55 UTC (a reading slip of the timestamp; the rule, markets, windows and tests do not depend on it). SPX500 has more thin days (fewer than 200 candles) than NAS100, most in 2017, where its file has gaps; they are skipped by the pre-registered rule.
- Halt: OANDA's US index CFDs halt 21:00-22:00 UTC (US daylight time) or 22:00-23:00 UTC and from Friday 21:00 / 22:00 UTC to the Sunday reopen; 00:00 UTC is always inside the session and the 00:00-20:55 UTC trading day never contains the halt; D1 = the UTC calendar day of M5 candles (the halt hour has none), Sunday's reopen stub folded into Monday with foldWeekend; US early-close days exit at the last candle on file before 21:00; days under 200 candles or without a 00:00-00:55 candle are skipped (gold-vol-breakout's skips)
- Rule: O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop back at O (worst case in the fill candle); out at the close of the last candle starting before 21:00 UTC; unchanged from gold-vol-breakout T1
- Costs: round trip NAS100 3 points, SPX500 1 point (research/edge/nr7-breakout RESULT.md "Costs"), 2x reported; financing per 22:00 UTC rollover (`nights`) by nr7-breakout's index formula, longs (DGS2 + 2.5 %) / 365, shorts max(0, 2.5 % − DGS2) / 365, DGS2 assumed 5 % (an upper bound): no trade crosses the rollover, so 0 on every trade
- To repeat: `node research/edge/index-vol-breakout/run.mjs <dir>` with `<dir>/nas100-5m.json.gz` and `<dir>/spx500-5m.json.gz` (OANDA mid M5 from the candle proxy, rows `[t, o, h, l, c]`, kept out of git).
