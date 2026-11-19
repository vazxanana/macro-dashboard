# Gold: the volatility breakout taken only on the side of the H4 trend

Paper research only. A filter on a stand-alone intraday rule, not a gate, exit, entry or size of the live gold book (owner decision 44 concerns that book; none of its records were read). Nothing live changed, no proposal. The filter, tests and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). The base rule is the `gold-vol-breakout` study's T1, its functions imported from `original.mjs`, a verbatim copy (sha256 in `result.json`). Every window of the base rule had already been read; the H4 split had not. This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL, 0 of 2: H4-side gold breakout 2007-26 +0.087R a trade net (n 1893, month t +2.73) vs base +0.072R; failed beatsBaseH2, againstLowerH2, placebo**

## Harness gate

Base rule on 2007-01-01 → 2015-12-31: n 1657, +0.111R net, gross +0.203R, month t +3.19 (replication: n 1657, +0.111R, +0.203R, t +3.19): equal.

## Streams

| Stream | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Total R | t (months) | Gross t | Max DD R |
|---|---|---|---|---|---|---|---|---|---|---|
| Base (no filter) | 2007 → 2026-10-31 | 3706 | 42.7 % | +0.072 | +0.154 | −0.010 | +268.24 | +3.30 | +7.19 | −42.89 |
| Base (no filter) | 2007-2016 | 1837 | 43.2 % | +0.101 | +0.193 | +0.008 | +185.19 | +3.14 | +6.13 | −25.66 |
| Base (no filter) | 2017 → 2026-10-31 | 1869 | 42.2 % | +0.044 | +0.116 | −0.027 | +83.05 | +1.49 | +4.01 | −39.18 |
| T1 H4 side only | 2007 → 2026-10-31 | 1893 | 43.2 % | +0.087 | +0.170 | +0.004 | +165.01 | +2.73 | +5.30 | −36.55 |
| T1 H4 side only | 2007-2016 | 925 | 44.2 % | +0.152 | +0.246 | +0.059 | +140.91 | +3.18 | +5.12 | −17.91 |
| T1 H4 side only | 2017 → 2026-10-31 | 968 | 42.1 % | +0.025 | +0.098 | −0.048 | +24.10 | +0.59 | +2.32 | −36.55 |
| T2 H4 side or none | 2007 → 2026-10-31 | 1893 | 43.2 % | +0.087 | +0.170 | +0.004 | +165.01 | +2.73 | +5.30 | −36.55 |
| T2 H4 side or none | 2007-2016 | 925 | 44.2 % | +0.152 | +0.246 | +0.059 | +140.91 | +3.18 | +5.12 | −17.91 |
| T2 H4 side or none | 2017 → 2026-10-31 | 968 | 42.1 % | +0.025 | +0.098 | −0.048 | +24.10 | +0.59 | +2.32 | −36.55 |
| Against-side (dropped by T1) | 2007 → 2026-10-31 | 1813 | 42.2 % | +0.057 | +0.138 | −0.024 | +103.23 | +1.82 | +4.44 | −59.19 |
| Against-side (dropped by T1) | 2007-2016 | 912 | 42.2 % | +0.049 | +0.140 | −0.043 | +44.28 | +1.08 | +3.12 | −33.41 |
| Against-side (dropped by T1) | 2017 → 2026-10-31 | 901 | 42.2 % | +0.065 | +0.136 | −0.005 | +58.96 | +1.50 | +3.14 | −32.62 |
| State none | 2007 → 2026-10-31 | 0 | 0.0 % | — | — | — | +0.00 | +0.00 | +0.00 | +0.00 |
| State none | 2007-2016 | 0 | 0.0 % | — | — | — | +0.00 | +0.00 | +0.00 | +0.00 |
| State none | 2017 → 2026-10-31 | 0 | 0.0 % | — | — | — | +0.00 | +0.00 | +0.00 | +0.00 |

## Decision (T1 primary; Holm over T1 and T2 on the whole record)

| Test | p | Holm p | t ≥ 2 | Holm < 0.05 | beats base H1 | beats base H2 | > 0 H1 | > 0 H2 | 2x cost > 0 | against lower H1 | against lower H2 | placebos beaten (need 38) | n ≥ 30 | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.003 | 0.006 | yes | yes | yes | no | yes | yes | yes | yes | no | 27 | yes | **fail** |
| T2 | 0.003 | 0.006 | yes | yes | yes | no | yes | yes | yes | yes | no | 27 | yes | **fail** |

## Kept against dropped (T1 kept minus against-side, net R a trade, Welch t)

| Period | Difference | Welch t |
|---|---|---|
| whole | +0.030 | +0.67 |
| 2007-2016 | +0.104 | +1.54 |
| 2017 → 2026-10-31 | −0.041 | −0.66 |

## What the filter drops

Base trades 3706; H4 state at those days: bullish 1993, bearish 1713, none 0. T1 keeps 1893 (drops 1813: 1813 against the state, 0 on a none day); T2 keeps 1893. Buys kept by T1 1009, sells 884.

## Placebo (whole record, 40 seeds)

Random subsets of the base trades, the same size as T1's kept set, drawn without replacement.

| T1 net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |
|---|---|---|---|
| +0.087 | +0.071 | +0.117 | +0.040 / +0.119 |

## By year (net R a trade, n)

| Year | Base | T1 | T2 | Against |
|---|---|---|---|---|
| 2007 | +0.208 (183) | +0.353 (99) | +0.353 (99) | +0.037 (84) |
| 2008 | +0.191 (188) | +0.259 (88) | +0.259 (88) | +0.132 (100) |
| 2009 | +0.021 (190) | +0.031 (102) | +0.031 (102) | +0.011 (88) |
| 2010 | +0.137 (182) | +0.007 (86) | +0.007 (86) | +0.254 (96) |
| 2011 | +0.044 (186) | +0.068 (102) | +0.068 (102) | +0.015 (84) |
| 2012 | +0.038 (186) | −0.025 (96) | −0.025 (96) | +0.105 (90) |
| 2013 | +0.258 (181) | +0.272 (95) | +0.272 (95) | +0.243 (86) |
| 2014 | +0.136 (171) | +0.260 (74) | +0.260 (74) | +0.042 (97) |
| 2015 | −0.025 (190) | +0.181 (90) | +0.181 (90) | −0.209 (100) |
| 2016 | +0.008 (180) | +0.147 (93) | +0.147 (93) | −0.139 (87) |
| 2017 | −0.006 (187) | +0.155 (112) | +0.155 (112) | −0.247 (75) |
| 2018 | −0.097 (188) | −0.156 (92) | −0.156 (92) | −0.040 (96) |
| 2019 | −0.040 (191) | −0.109 (90) | −0.109 (90) | +0.022 (101) |
| 2020 | +0.178 (189) | +0.023 (95) | +0.023 (95) | +0.335 (94) |
| 2021 | +0.021 (179) | −0.031 (83) | −0.031 (83) | +0.066 (96) |
| 2022 | +0.016 (193) | +0.039 (100) | +0.039 (100) | −0.008 (93) |
| 2023 | −0.095 (186) | +0.022 (109) | +0.022 (109) | −0.261 (77) |
| 2024 | +0.053 (200) | −0.103 (106) | −0.103 (106) | +0.228 (94) |
| 2025 | +0.181 (193) | −0.031 (106) | −0.031 (106) | +0.439 (87) |
| 2026 | +0.256 (163) | +0.521 (75) | +0.521 (75) | +0.030 (88) |

## Reading

T1 does not pass (failed: beatsBaseH2, againstLowerH2, placebo). Whole record 2007 → 2026-10-31: base +0.072R a trade net (n 3706, month t +3.30); T1 (H4 side only) +0.087R (n 1893, month t +2.73, gross +0.170R, 2x cost +0.004R); T2 (side or none) +0.087R (n 1893, t +2.73), fails (beatsBaseH2, againstLowerH2, placebo); against-side trades +0.057R (n 1813, t +1.82). By half, T1 against the base: 2007-16 +0.152R vs +0.101R, 2017-26 +0.025R vs +0.044R; kept minus against +0.104R (Welch t +1.54) and −0.041R (t −0.66). The state was never "none": a 20-close H4 break always occurred within 60 H4 candles, so T2 is the same set as T1 (as the pre-registered definition gives). T1 beats 27 of 40 random subsets of the same size (median +0.071R). The H4 trend side does not improve the breakout measurably and repeatably; the base rule stays as it is, nothing live changes and no proposal is written.

## Data and method

- OANDA mid XAU/USD M5 through the keyless candle proxy; 5206 weekdays built 2006-11-01 → 2026-11-12; D1 = complete UTC days folded with council/fills.mjs foldWeekend
- Base rule: O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins; stop back at O; out at the 20:55 candle close
- H4 state: H4 candles from M5 on 4-hour blocks aligned to 17:00 New York (council/histdata.mjs nyOffsetH), blocks of 12+ M5 candles, only those ended by 00:00 UTC; bullish / bearish = direction of the latest close beyond the 20 prior H4 closes' high / low, none if no such break in the last 60 H4 candles
- Costs: $0.60 a round trip per ounce, 2x reported; financing `FIN.xau.long` × `nights` on buys (no trade crosses the 22:00 UTC rollover: 0).
- To repeat: `node research/edge/gold-vol-breakout-h4-side/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD 2006-11 on, from the candle proxy, kept out of git).
