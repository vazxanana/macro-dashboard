# Breakouts on the side of the H4 structure (vb-structure-filter, 23 Nov 2026)

**Verdict: FAIL: out of sample 2024 → 2026-11-20, T1 gold + USD/JPY pooled: kept +0.124R a trade (n 557, month t +1.93) against unfiltered +0.143R (n 1119); kept − against-side −0.036R (Welch t −0.44); 2010 → now Welch t +1.16**

Paper research only. The rule, filter, costs, windows and bar were fixed in `PREREGISTRATION.md` (committed alone first; sha256 in `result.json`). Nothing live changed; the two forward records run on unchanged. This page is written by `run.mjs` from `result.json`.

## The one table (net R a trade after each rule's own cost; month t on calendar-month sums)

| Test | Window | Unfiltered n | Unfiltered net | Kept n | Kept net | Kept 2x cost | Kept gross | Kept month t | Against-side n | Against net | Kept − against (Welch t) | Placebos beaten |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 gold + USD/JPY pooled | REP 2010-2019 | 3727 | +0.044 | 1879 | +0.075 | +0.011 | +0.139 | +2.20 | 1845 | +0.012 | +0.063 (+1.46) | 37 of 40 |
| T1 gold + USD/JPY pooled | IS 2020-2023 | 1508 | +0.050 | 761 | +0.068 | +0.018 | +0.119 | +1.59 | 747 | +0.032 | +0.036 (+0.53) | 27 of 40 |
| T1 gold + USD/JPY pooled | OOS 2024-2026-11-20 | 1119 | +0.143 | 557 | +0.124 | +0.095 | +0.154 | +1.93 | 562 | +0.161 | −0.036 (−0.44) | 7 of 40 |
| T2 gold | REP 2010-2019 | 1841 | +0.042 | 942 | +0.074 | −0.019 | +0.168 | +1.57 | 899 | +0.009 | +0.066 (+1.01) | 33 of 40 |
| T2 gold | IS 2020-2023 | 747 | +0.031 | 378 | +0.035 | −0.031 | +0.101 | +0.60 | 369 | +0.026 | +0.009 (+0.09) | 24 of 40 |
| T2 gold | OOS 2024-2026-11-20 | 567 | +0.169 | 285 | +0.167 | +0.134 | +0.199 | +2.18 | 282 | +0.171 | −0.004 (−0.04) | 20 of 40 |
| T3 USD/JPY | REP 2010-2019 | 1886 | +0.046 | 937 | +0.075 | +0.041 | +0.109 | +1.78 | 946 | +0.015 | +0.061 (+1.05) | 38 of 40 |
| T3 USD/JPY | IS 2020-2023 | 761 | +0.070 | 383 | +0.102 | +0.067 | +0.136 | +1.64 | 378 | +0.038 | +0.063 (+0.66) | 33 of 40 |
| T3 USD/JPY | OOS 2024-2026-11-20 | 552 | +0.116 | 272 | +0.080 | +0.053 | +0.108 | +0.97 | 280 | +0.151 | −0.071 (−0.61) | 12 of 40 |

## The bar, item by item (out of sample unless named)

| Test | OOS p | Holm p | OOS > 0 | t ≥ 2 | Holm < 0.05 | IS > 0 | 2x cost > 0 | n ≥ 30 | REP > 0 | adds IS | adds OOS | adds REP | Welch t ≥ 2 (2010 → now) | 38 of 40 placebos | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.027 | 0.054 | yes | no | no | yes | yes | yes | yes | yes | no | yes | no (t +1.16) | no | FAIL |
| T2 | 0.015 | 0.044 | yes | yes | yes | yes | yes | yes | yes | yes | no | yes | no (t +0.79) | no | FAIL, direction adds nothing |
| T3 | 0.165 | 0.165 | yes | no | no | yes | yes | yes | yes | yes | no | yes | no (t +0.85) | no | FAIL |

## In plain words

T1 (both markets pooled, the primary test): FAIL; items not met: oosT2, holm, addsOOS, welch2, placebo38. T2 gold: FAIL, direction adds nothing (not met: addsOOS, welch2, placebo38). T3 USD/JPY: FAIL (not met: oosT2, holm, addsOOS, welch2, placebo38). T1 gold + USD/JPY pooled: kept +0.124R a trade (n 557, month t +1.93) against unfiltered +0.143R (n 1119); kept − against-side −0.036R (Welch t −0.44); 2010 → now Welch t +1.16. T2 gold: kept +0.167R a trade (n 285, month t +2.18) against unfiltered +0.169R (n 567); kept − against-side −0.004R (Welch t −0.04); 2010 → now Welch t +0.79. T3 USD/JPY: kept +0.080R a trade (n 272, month t +0.97) against unfiltered +0.116R (n 552); kept − against-side −0.071R (Welch t −0.61); 2010 → now Welch t +0.85. Replication 2010-2019, kept minus against-side: T1 +0.063R (t +1.46), in sample 2020-2023 +0.036R (t +0.53). The filtered trades are a subset of rules that already pass, so a profitable filtered rule says nothing about direction; only the kept-versus-against comparison does. Read it as the pre-registration says: unless every direction item holds, trading only with the H4 structure adds nothing that can be told from chance to these breakouts.

## Sides (kept and dropped, out of sample)

- T1: kept buys n 328 +0.217R, kept sells n 229 −0.008R; dropped against-side buys n 243 +0.275R, sells n 319 +0.074R; days with side 0: 0.
- T2: kept buys n 175 +0.127R, kept sells n 110 +0.230R; dropped against-side buys n 129 +0.283R, sells n 153 +0.076R; days with side 0: 0.
- T3: kept buys n 153 +0.321R, kept sells n 119 −0.229R; dropped against-side buys n 114 +0.265R, sells n 166 +0.073R; days with side 0: 0.

## By year (kept net R a trade, n; unfiltered beside it)

| Year | T1 kept | T1 all | T2 kept | T2 all | T3 kept | T3 all |
|---|---|---|---|---|---|---|
| 2010 | +0.043 (174) | +0.042 (360) | +0.077 (90) | +0.124 (181) | +0.007 (84) | −0.041 (179) |
| 2011 | +0.048 (205) | −0.043 (377) | +0.099 (108) | +0.044 (186) | −0.009 (97) | −0.129 (191) |
| 2012 | +0.170 (188) | +0.132 (368) | +0.006 (97) | +0.038 (186) | +0.344 (91) | +0.229 (182) |
| 2013 | +0.261 (165) | +0.289 (361) | +0.318 (90) | +0.258 (181) | +0.194 (75) | +0.320 (180) |
| 2014 | +0.130 (176) | +0.095 (363) | +0.077 (73) | +0.136 (171) | +0.168 (103) | +0.057 (192) |
| 2015 | +0.128 (178) | −0.036 (385) | +0.192 (88) | −0.025 (190) | +0.066 (90) | −0.047 (195) |
| 2016 | +0.044 (201) | +0.003 (373) | +0.017 (94) | +0.008 (180) | +0.068 (107) | −0.002 (193) |
| 2017 | +0.092 (208) | +0.014 (383) | +0.117 (111) | −0.006 (187) | +0.062 (97) | +0.033 (196) |
| 2018 | −0.004 (194) | +0.003 (379) | −0.039 (96) | −0.097 (188) | +0.031 (98) | +0.102 (191) |
| 2019 | −0.129 (190) | −0.043 (378) | −0.106 (95) | −0.040 (191) | −0.152 (95) | −0.047 (187) |
| 2020 | +0.124 (189) | +0.136 (377) | +0.190 (88) | +0.178 (189) | +0.067 (101) | +0.094 (188) |
| 2021 | +0.099 (179) | +0.095 (367) | +0.027 (85) | +0.021 (179) | +0.164 (94) | +0.166 (188) |
| 2022 | +0.088 (186) | +0.060 (381) | −0.047 (92) | +0.016 (193) | +0.219 (94) | +0.105 (188) |
| 2023 | −0.026 (207) | −0.087 (383) | −0.013 (113) | −0.095 (186) | −0.042 (94) | −0.078 (197) |
| 2024 | +0.124 (205) | +0.124 (391) | +0.046 (104) | +0.053 (200) | +0.204 (101) | +0.198 (191) |
| 2025 | −0.015 (201) | +0.114 (396) | −0.007 (98) | +0.181 (193) | −0.023 (103) | +0.051 (203) |
| 2026 | +0.311 (151) | +0.199 (332) | +0.523 (83) | +0.289 (174) | +0.054 (68) | +0.100 (158) |

## Harness gate (unfiltered rules at the studies' own costs, against the published results)

| Source | Window | Published n / net | Here n / net | Within 2 % and 0.01R |
|---|---|---|---|---|
| gold-vol-breakout IS | 2016-01-01 → 2020-12-31 | 935 / +0.009 | 935 / +0.009 | yes |
| gold-vol-breakout OOS | 2021-01-01 → 2026-11-12 | 1121 / +0.072 | 1121 / +0.072 | yes |
| fx-vol-breakout usdjpy IS | 2016-01-01 → 2020-12-31 | 955 / +0.036 | 955 / +0.036 | yes |
| fx-vol-breakout usdjpy OOS | 2021-01-01 → 2026-11-19 | 1124 / +0.087 | 1124 / +0.087 | yes |
| usdjpy-vol-breakout-early 2010-2015 (its byYear, the cache starts 2010) | 2010-01-01 → 2015-12-31 | 1119 / +0.062 | 1119 / +0.062 | yes |

## What this does NOT show

- It does not re-test the breakouts themselves: their trades were read before; only the split by the H4 side is new.
- It tests ONE fixed reading of "direction" (the last break of a 3-a-side H4 swing, UTC-aligned blocks, known at 00:00 UTC). Other readings (Daily structure, a chain of timeframes, New York-aligned H4) are not covered, and trying them on these same trades now would be a search.
- Costs are fixed figures charged on every year; no broker ticks. Past years are charged today's cost.
- Whatever the verdict, nothing here is an edge on its own and nothing live changes; the forward records of the two unfiltered rules stay the judge.

## Data and method

- xau: 1202716 M5 candles 2010-01-03 → 2026-11-22 (last day on file left out), 26998 H4 candles; usdjpy: 1263496 M5 candles 2010-01-03 → 2026-11-22 (last day on file left out), 27262 H4 candles. Source: the shared toolkit's OANDA mid M5 cache.
- Base rules imported unchanged (gold-vol-breakout vbTrade k 0.5, out 20:55 UTC; fx-vol-breakout trades for USD/JPY, the same rule on its 2010-2015 days). H4 = toolkit resample(m5, 14400), blocks under 12 M5 candles dropped; side = toolkit structure(h4, 3); a day takes the side of the last H4 candle closed at or before its 00:00 UTC. Kept = first fill on that side; side 0 = no trade. Cost: gold $0.60, USD/JPY max(0.000045 × entry + 0.005, 0.008) a round trip; 2x reported. Month t on calendar months with a trade; p one-sided normal; Holm over T1-T3 on the OOS p. Placebo: 40 seeded random subsets of the window's unfiltered trades of the kept size.
- To repeat: `node research/edge/vb-structure-filter/run.mjs` (reads the toolkit cache at EDGE_DATA, kept out of git).

