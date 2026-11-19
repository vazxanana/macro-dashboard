# Platinum and palladium: gold-vol-breakout's T1 rule, unchanged

Paper research only. A supporting robustness check for the gold rule (`gold-vol-breakout` T1, passed on XAU/USD 2007-15, branch `gold-vol-breakout-replicate`): is the daily volatility breakout a precious-metals effect, or gold's alone? The same rule on the other two precious metals. Not a rule for these markets, never a gate, exit, entry or size of the live gold book (owner decision 44). Nothing live changed, no proposal. The markets, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`); the trading functions are imported from `original.mjs`, a verbatim copy of the original study's `run.mjs` (sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 2: gold's T1 breakout on platinum −0.285R net (t −12.47, gross t +3.11), palladium −0.643R net (t −19.39, gross t +4.24)**

## Platinum (XPT/USD), T1 (cost 0.30 % of price a round trip)

| Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | 2x-cost t | Stops / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2005-02 → 2026-10 (pooled) | 3222 | 34.0 % | −0.285 | +0.061 | −0.630 | +0.346 | −916.77 | −12.47 | +3.11 | −20.59 | 1032 / 2190 | −919.66 | 10.64 |
| 2005-02 → 2016-12 (IS) | 1334 | 32.3 % | −0.315 | +0.084 | −0.714 | +0.399 | −420.18 | −8.95 | +2.67 | −14.05 | 426 / 908 | −420.32 | 10.62 |
| 2017-01 → 2026-10 (OOS) | 1888 | 35.2 % | −0.263 | +0.045 | −0.571 | +0.308 | −496.60 | −8.80 | +1.79 | −15.19 | 606 / 1282 | −499.33 | 10.7 |

Cost multiples, pooled: 0.5x −0.112R (t −5.45), 1x −0.285R (t −12.47), 2x −0.630R (t −20.59). Buys n 1577 −0.310R, sells n 1645 −0.261R; financing +0.000R a trade. First candle served 2005-01-03 02:00 UTC. Days without a trade: noopen 649, thin 740, nofill 1006, flatprev 4.

## Palladium (XPD/USD), T1 (cost 0.80 % of price a round trip)

| Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | 2x-cost t | Stops / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2005-02 → 2026-10 (pooled) | 2688 | 24.5 % | −0.643 | +0.094 | −1.380 | +0.737 | −1727.53 | −19.39 | +4.24 | −24.09 | 823 / 1865 | −1727.53 | 13.13 |
| 2005-02 → 2016-12 (IS) | 877 | 22.6 % | −0.735 | +0.152 | −1.621 | +0.887 | −644.54 | −10.95 | +4.16 | −12.65 | 261 / 616 | −644.54 | 6.69 |
| 2017-01 → 2026-10 (OOS) | 1811 | 25.5 % | −0.598 | +0.067 | −1.263 | +0.665 | −1083.00 | −16.18 | +2.39 | −21.66 | 562 / 1249 | −1083.00 | 19.29 |

Cost multiples, pooled: 0.5x −0.274R (t −11.19), 1x −0.643R (t −19.39), 2x −1.380R (t −24.09). Buys n 1336 −0.675R, sells n 1352 −0.610R; financing +0.000R a trade. First candle served 2005-01-03 05:25 UTC. Days without a trade: noopen 925, thin 1138, nofill 865, flatprev 5.

## Decision (pooled per market, Holm over the two markets)

| Market | p (one-sided) | Holm p | t ≥ 2 | Holm < 0.05 | IS > 0 | OOS > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 each half | pass |
|---|---|---|---|---|---|---|---|---|---|---|
| Platinum (XPT/USD) | 1 | 1 | no | no | no | no | no | 36 | yes | **fail** |
| Palladium (XPD/USD) | 1 | 1 | no | no | no | no | no | 36 | yes | **fail** |

## Placebo (pooled window, 40 seeds)

The original study's placebo: every day T1 could trade, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin, stop 0.5 × the previous day's range away, out at 21:00 UTC or the stop, the same cost per day.

| Market | Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |
|---|---|---|---|---|
| Platinum (XPT/USD) | −0.285 | −0.309 | −0.282 | −0.357 / −0.267 |
| Palladium (XPD/USD) | −0.643 | −0.662 | −0.640 | −0.707 / −0.628 |

## By year (net and gross R a trade, n)

| Year | Platinum net | Platinum gross | Palladium net | Palladium gross | XAU/USD net (n) |
|---|---|---|---|---|---|
| 2005 | −0.293 (7) | +0.194 | −1.664 (1) | −1.000 | — |
| 2006 | −0.055 (14) | +0.346 | — | — | −0.287 (27) |
| 2007 | −0.822 (23) | −0.283 | — | — | +0.208 (183) |
| 2008 | −0.277 (83) | −0.083 | −0.902 (9) | −0.504 | +0.191 (188) |
| 2009 | −0.289 (104) | +0.028 | — | — | +0.021 (190) |
| 2010 | −0.442 (137) | −0.059 | −0.249 (30) | +0.176 | +0.137 (182) |
| 2011 | −0.227 (56) | +0.184 | −0.678 (10) | +0.015 | +0.044 (186) |
| 2012 | −0.348 (148) | +0.069 | −0.707 (134) | +0.138 | +0.038 (186) |
| 2013 | −0.223 (189) | +0.195 | −0.812 (175) | +0.125 | +0.258 (181) |
| 2014 | −0.374 (192) | +0.169 | −0.970 (185) | +0.238 | +0.136 (171) |
| 2015 | −0.312 (193) | +0.092 | −0.609 (160) | +0.187 | −0.025 (190) |
| 2016 | −0.248 (188) | +0.089 | −0.617 (173) | +0.109 | +0.008 (180) |
| 2017 | −0.527 (199) | −0.059 | −0.912 (189) | +0.077 | −0.006 (187) |
| 2018 | −0.491 (205) | −0.054 | −0.695 (187) | +0.251 | −0.097 (188) |
| 2019 | −0.275 (193) | +0.120 | −0.891 (188) | +0.079 | −0.040 (191) |
| 2020 | −0.317 (163) | −0.085 | −0.575 (131) | +0.096 | +0.178 (189) |
| 2021 | −0.131 (168) | +0.116 | −0.621 (152) | +0.068 | +0.021 (179) |
| 2022 | −0.155 (200) | +0.076 | −0.286 (189) | +0.139 | +0.016 (193) |
| 2023 | −0.229 (198) | +0.063 | −0.694 (205) | −0.196 | −0.095 (186) |
| 2024 | −0.150 (205) | +0.161 | −0.382 (208) | +0.125 | +0.053 (200) |
| 2025 | −0.222 (201) | +0.019 | −0.498 (206) | +0.029 | +0.181 (193) |
| 2026 | −0.081 (156) | +0.098 | −0.418 (156) | +0.023 | +0.256 (163) |

## Against XAU/USD (descriptive, pre-registered)

The same T1 on OANDA XAU/USD M5 (the replicate study's cache, from 2006-11-01), $0.60 a round trip.

| Market | Period | n | Net R/trade | Gross R/trade | t (months) | Gross t |
|---|---|---|---|---|---|---|
| XAU/USD | pooled (2005-02 on) | 3733 | +0.070 | +0.152 | +3.19 | +7.13 |
| XAU/USD | IS | 1864 | +0.095 | +0.189 | +2.99 | +6.04 |
| XAU/USD | OOS | 1869 | +0.044 | +0.116 | +1.49 | +4.01 |

- Platinum (XPT/USD): 2534 days both took a T1 trade (metal only 688, XAU/USD only 1199); daily correlation of gross R 0.328, of net R 0.312; same side 77.9 % of those days.
- Palladium (XPD/USD): 2042 days both took a T1 trade (metal only 646, XAU/USD only 1691); daily correlation of gross R 0.149, of net R 0.123; same side 69.9 % of those days.

## Reading

Platinum (XPT/USD): pooled −0.285R a trade net (n 3222, month t −12.47; gross +0.061R, gross t +3.11); IS −0.315R net / +0.084R gross (n 1334, gross t +2.67); OOS −0.263R net / +0.045R gross (n 1888, gross t +1.79); costs 0.346R a trade; at 0.5x cost −0.112R (t −5.45); 36 of 40 placebo seeds beaten (median −0.309R); failed: t2, holm, isPos, oosPos, cost2x, placebo. Palladium (XPD/USD): pooled −0.643R a trade net (n 2688, month t −19.39; gross +0.094R, gross t +4.24); IS −0.735R net / +0.152R gross (n 877, gross t +4.16); OOS −0.598R net / +0.067R gross (n 1811, gross t +2.39); costs 0.737R a trade; at 0.5x cost −0.274R (t −11.19); 36 of 40 placebo seeds beaten (median −0.662R); failed: t2, holm, isPos, oosPos, cost2x, placebo. Before costs the breakout shows on Palladium (XPD/USD) in both halves (gross month t ≥ 2 each), so by the pre-registered reading the mechanism is a precious-metals one and the wider CFD cost, not the absence of the move, keeps it from paying. On Platinum (XPT/USD) the gross pooled month t is +3.11 but IS +2.67 / OOS +1.79, so it shows there less firmly. The placebo pays the same cost, so its net seeds are deeply negative too and the real streams beating 36 and 36 of 40 of them says little; the gross t is the pre-registered measure of the mechanism here. On the days both traded, the metal's T1 result correlates with XAU/USD's at 0.328 (platinum, same side 78 %) and 0.149 (palladium, same side 70 %) in gross R. The costs are the repository's stated CFD model for these metals, not a measured spread. This is a check of the gold rule, not a rule for these markets: nothing live changes and no proposal is written.

## Data and method

- OANDA mid XPT/USD and XPD/USD M5 through the keyless candle proxy; Platinum (XPT/USD) 5650 weekdays built 2005-01-03 → 2026-11-12; Palladium (XPD/USD) 5651 weekdays built 2005-01-03 → 2026-11-12; D1 = complete UTC days folded with council/fills.mjs foldWeekend
- Rule: O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop back at O (worst case in the fill candle); out at the 20:55 candle close
- Costs: platinum 0.30 %, palladium 0.80 % of the day's open a round trip (the repository's CFD cost model for these metals in `research/edge/ict-breadth-2/preregistration.md`, from typical OANDA spreads of about 0.22 % and 0.6 %; stated, not measured), 0.5x / 1x / 2x reported; financing `FIN.xau.long` × `nights` on buys, assumed (no trade crosses the 22:00 UTC rollover: 0).
- To repeat: `node --use-env-proxy research/edge/pgm-vol-breakout/run.mjs fetch <dir>`, then `node research/edge/pgm-vol-breakout/run.mjs <dir> <xauDir>` (`<xauDir>/xau-5m.json.gz` = the replicate study's XAU/USD cache); candle caches stay out of the repository.
