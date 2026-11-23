# Market-cycle regime book: each method only in its own H4 regime: result (23 Nov 2026)

**Verdict: FAIL.** T1 (the regime book, 22 methods): −0.066R a trade after costs out of sample (n 2997, month t −1.59, Holm p 1.00); the same methods unfiltered −0.103R (n 13229). In sample the book made −0.020R (n 3848). Lines missed: oosMean, oosT, holm, isMean, twoX, keptBeatsDropped, placebo, repMean, repAbovePool. T2 (walk-forward) FAIL, T3 (gold) FAIL.

Pre-registered in PREREGISTRATION.md (committed before any regime label was computed); run by `run.mjs` on the toolkit's OANDA mid 5m cache and the trade lists the other studies of the night saved. R after each list's own costs; t on calendar-month sums (by exit month); windows by fill time; p two-sided; each kept trade 1R.

| Test | Window | n | R a trade after costs | month t | at 2x costs | before costs | Holm p | passes |
|---|---|---|---|---|---|---|---|---|
| T1 regime book | 2020-2023 (IS, filters chosen here) | 3848 | −0.020 | −0.59 | −0.090 | +0.051 |  |  |
| T1 regime book | 2024 - 13 Nov 2026 (OOS) | 2997 | −0.066 | −1.59 | −0.140 | +0.008 | 1.00 | no |
| Unfiltered pool (reported) | 2024 - 13 Nov 2026 (OOS) | 13229 | −0.103 | −5.45 | −0.184 | −0.022 |  |  |
| Dropped by the filters (reported) | 2024 - 13 Nov 2026 (OOS) | 10232 | −0.114 | −5.77 | −0.198 | −0.031 |  |  |
| T2 anchored walk-forward | 2024 - 13 Nov 2026 (OOS) | 2750 | −0.056 | −1.28 | −0.131 | +0.020 | 1.00 | no |
| T3 gold trades of T1 | 2024 - 13 Nov 2026 (OOS) | 1325 | −0.003 | −0.04 | −0.091 | +0.085 | 1.00 | no |
| T3 gold, unfiltered (reported) | 2024 - 13 Nov 2026 (OOS) | 5240 | −0.095 | −2.90 | −0.183 | −0.007 |  |  |
| Replication book (choose 2010-15) | 2016-2019 | 3878 | −0.139 | −4.57 | −0.225 | −0.053 |  |  |
| Replication unfiltered (reported) | 2016-2019 | 16109 | −0.125 | −8.06 | −0.214 | −0.036 |  |  |

Kept against dropped out of sample: −0.066R against −0.114R, Welch t 1.21 (bar 2). Placebo (200 shufflings of the day labels per market, same choice): the book's out-of-sample mean beats 59.5 % of them (bar 95 %; their median −0.074R, 95th percentile −0.016R).

## Each method: the filter chosen on 2020-2023, and what it kept

| Method | chosen filter (IS month t, n) | IS all | OOS all | OOS kept | OOS dropped | walk-forward 2024 / 25 / 26 | replication choice |
|---|---|---|---|---|---|---|---|
| barrier-qm-janda:P | C (0.25, 63) | −0.095 (431) | −0.101 (311) | +0.119 (57) | −0.150 (254) | C / C / C | X |
| barrier-qm-janda:S1 | C (−0.97, 149) | −0.101 (894) | −0.141 (612) | −0.088 (96) | −0.150 (516) | C / C / C | Tw |
| barrier-qm-janda:S2 | X (−0.50, 62) | −0.207 (153) | −0.374 (91) | −0.663 (33) | −0.210 (58) | X / X / X | X |
| barrier-qm-janda:S3 | C (0.49, 36) | −0.104 (255) | −0.041 (173) | +0.118 (26) | −0.069 (147) | C / C / C | Tw |
| box-touch-trend:T1 | C (−2.24, 1021) | −0.217 (6729) | −0.199 (4950) | −0.255 (747) | −0.189 (4203) | C / C / C | C |
| daily-zone-retest | C (0.29, 38) | −0.008 (417) | −0.036 (301) | −0.084 (39) | −0.029 (262) | T / C / X | C |
| direction-chain-gate | Tw (0.19, 1353) | −0.023 (5585) | −0.024 (3944) | −0.015 (920) | −0.027 (3024) | C / C / C | C |
| eg-chain-50:P | C (0.71, 42) | −0.399 (283) | −0.238 (1013) | −0.093 (178) | −0.269 (835) | C / C / C | C |
| eg-chain-50:S1 | X (0.95, 48) | +0.137 (144) | +0.206 (99) | +0.561 (50) | −0.158 (49) | X / X / X | X |
| eg-chain-50:S2 | CT (0.20, 54) | −0.050 (80) | −0.102 (318) | −0.027 (202) | −0.233 (116) | T / CT / C | CX |
| h4-pullback-end:kept | CT (0.50, 97) | −0.036 (154) | +0.125 (120) | +0.194 (54) | +0.068 (66) | C / C / C | CT |
| h4-pullback-end:rejected | X (−0.24, 59) | −0.106 (143) | −0.125 (88) | −0.428 (37) | +0.095 (51) | X / X / X | CX |
| session-sweep | all (1.00, 41) | +0.195 (41) | −0.007 (27) | −0.007 (27) | n/a | CX / CX / CX | CT |
| storyline-daily-gold:P | all (−0.91, 29) | −0.312 (29) | −0.333 (16) | −0.333 (16) | n/a | Tw / Tw / Tw | TX |
| storyline-daily-gold:S1 | all (−1.53, 28) | −0.397 (28) | −0.143 (18) | −0.143 (18) | n/a | T / T / T | TX |
| storyline-daily-gold:S2 | all (0.28, 15) | +0.171 (15) | −0.326 (7) | −0.326 (7) | n/a | TX / TX / CT | all |
| storyline-daily-gold:S3 | TX (−1.31, 33) | −0.421 (38) | −0.101 (19) | −0.379 (15) | +0.944 (4) | X / X / X | TX |
| storyline-qm-sop:T1 | all (−0.51, 4) | −0.347 (4) | −1.016 (1) | −1.016 (1) | n/a | all / all / all | all |
| storyline-qm-sop:T2 | all (−2.16, 5) | −0.873 (5) | −1.117 (3) | −1.117 (3) | n/a | all / all / all | all |
| storyline-qm-sop:T3 | all (−0.63, 4) | −0.445 (4) | −1.071 (3) | −1.071 (3) | n/a | all / all / all | all |
| storyline-qm-sop:T4 | all (0.07, 11) | +0.043 (11) | −1.080 (5) | −1.080 (5) | n/a | CX / CX / CX | all |
| vb-structure-filter | T (1.76, 656) | +0.051 (1508) | +0.139 (1110) | +0.125 (463) | +0.148 (647) | CX / CX / CX | CX |

Filter names: all = every day; C consolidation; T trend; X transition; CT, CX, TX = two states; Tw = trend days, with the H4 side.

## Per market, out of sample (R a trade after costs, n)

| Market | book | unfiltered | book in sample |
|---|---|---|---|
| xau | −0.003 (1325) | −0.095 (5240) | −0.014 (1389) |
| eurusd | −0.085 (382) | −0.172 (1812) | −0.059 (559) |
| gbpusd | −0.051 (321) | −0.044 (1811) | −0.024 (562) |
| usdjpy | −0.077 (585) | −0.059 (2495) | −0.007 (812) |
| audusd | −0.262 (384) | −0.177 (1871) | −0.008 (526) |

## By year (fill year; R a trade after costs, n)

2010 all −0.107 (4571) · 2011 all −0.109 (4601) · 2012 all −0.114 (4296) · 2013 all −0.102 (4316) · 2014 all −0.065 (3729) · 2015 all −0.108 (4114) · 2016 all −0.099 (4268) · 2017 all −0.107 (4150) · 2018 all −0.174 (4073) · 2019 all −0.122 (3618) · 2020 all −0.054 (4369), book +0.014 (993) · 2021 all −0.117 (4077), book −0.046 (977) · 2022 all −0.127 (4392), book −0.043 (965) · 2023 all −0.142 (4113), book −0.004 (913) · 2024 all −0.144 (4098), book −0.052 (988) · 2025 all −0.077 (4819), book −0.086 (986) · 2026 all −0.084 (4374), book −0.061 (1023)

## Share of trading days in each state (2010 on)

xau: consolidation 766, trend 2001, transition 1603 · eurusd: consolidation 805, trend 2008, transition 1568 · gbpusd: consolidation 598, trend 2111, transition 1672 · usdjpy: consolidation 941, trend 1773, transition 1668 · audusd: consolidation 695, trend 1940, transition 1746

## In plain words

Each method was allowed to trade only in the H4 states where it did best in 2020-2023. Out of sample that book made −0.066R a trade after costs against −0.103R for the same methods on every day; the trades the filters dropped made −0.114R. It did not clear the bar (oosMean, oosT, holm, isMean, twoX, keptBeatsDropped, placebo, repMean, repAbovePool).

## What it does NOT show

- It does not show that any method works: the trade lists are each study's own, mostly FAIL verdicts; a regime filter cannot turn a losing rule into an edge unless the losing trades sit in one state, and this tests only that.
- The regime is one fixed reading of the H4 market cycle (swing size 3, 12 and 30 candles); no other reading was tried and none should be after this result.
- Lists overlap (the same market move can be traded by several methods), so the pooled trades are not independent; the month t counts each month once, which only partly allows for that.
- The direction-chain-gate list holds every candidate signal before its own one-position rule; it is used as saved.
- Choices this run made where the pre-registration is silent: "known for 12 H4 candles" = 12 or more closed H4 candles since the box was confirmed; "within the last 30" = the break is one of the last 30 closed H4 candles; the walk-forward (T2) chooses on every year of a list before the test year; the placebo compares the book's out-of-sample mean R; Holm uses two-sided p (stricter than one-sided); T2 and T3 pass only on mean > 0, month t >= 2 with Holm p < 0.05, positive at 2x costs, 30+ trades and above their unfiltered pool. Nine box-touch rows are limits filled at an open already past the stop (closed at once, 0R before costs): used as saved.
- Nothing live changed. A pass would earn a forward paper record only.
