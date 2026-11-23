# The Engulfing desk's zone readings on 18 markets, 2020 to now

**Verdict: FAIL. Before costs 0 of 6 readings pass (pooled from 2024 on 27501 trades, −0.028R a trade, month t -2.98); after costs 0 of 6 readings pass: pooled over the six from 2024 on 27501 trades, −0.073R a trade after costs (month t -7.97); best T3 −0.018R (n 570, t -0.29).**

Built 2026-11-23. Pre-registered (PREREGISTRATION.md, committed alone before any trade was computed). Paper research only: nothing live changed.
The desk's own code (`council/eg-methods.mjs`, imported, not edited) on 18 markets, OANDA mid 5-minute candles to 2026-11-23T11:00 UTC; discovery 2020-2023, confirmation 2024 on; R a trade after the round-trip costs of `combo-grid-2`; t on calendar-month sums. 66287 closed trades.

## Before costs (asked by the owner after the run; not pre-registered)

The same bar on R before costs: n, mean > 0 and month-sum t ≥ 2 in both windows, Holm over the six; no twice-cost check.

| | Reading | Disc. n | Disc. R | Disc. t | Conf. n | Conf. R | Conf. t | Holm p | Verdict before costs |
|---|---|---|---|---|---|---|---|---|---|
| T1 | The plan (with the Daily) | 14580 | −0.009 | -1.33 | 10378 | −0.031 | -2.77 | 1 | FAIL |
| T2 | The short method (H4 zone, not with the Daily) | 12806 | −0.020 | -2.39 | 9313 | −0.033 | -3.12 | 1 | FAIL |
| T3 | The direct entry (fresh zones, M5 EF trail) | 848 | +0.025 | 0.7 | 570 | +0.023 | 0.37 | 1 | FAIL |
| T4 | The plan, next-candle engulf | 4665 | −0.028 | -1.92 | 3201 | +0.018 | 0.85 | 1 | FAIL |
| T5 | The short method, next-candle engulf | 4147 | −0.003 | -0.1 | 2800 | −0.025 | -0.72 | 1 | FAIL |
| T6 | H4 EF barrier to the next H4 EG | 1740 | +0.045 | 0.97 | 1239 | −0.105 | -2.29 | 1 | FAIL |

## After costs (the pre-registered verdict)

| | Reading | Disc. n | Disc. net R | Disc. t | Conf. n | Conf. before costs | Conf. net R | Conf. t | Holm p | Conf. at 2x cost | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | The plan (with the Daily) | 14580 | −0.051 | -7.07 | 10378 | −0.031 | −0.076 | -6.63 | 1 | −0.122 | FAIL |
| T2 | The short method (H4 zone, not with the Daily) | 12806 | −0.062 | -7.34 | 9313 | −0.033 | −0.079 | -7.55 | 1 | −0.125 | FAIL |
| T3 | The direct entry (fresh zones, M5 EF trail) | 848 | −0.014 | -0.4 | 570 | +0.023 | −0.018 | -0.29 | 1 | −0.060 | FAIL |
| T4 | The plan, next-candle engulf | 4665 | −0.069 | -4.71 | 3201 | +0.018 | −0.025 | -1.12 | 1 | −0.068 | FAIL |
| T5 | The short method, next-candle engulf | 4147 | −0.043 | -1.42 | 2800 | −0.025 | −0.069 | -1.96 | 1 | −0.112 | FAIL |
| T6 | H4 EF barrier to the next H4 EG | 1740 | −0.018 | -0.38 | 1239 | −0.105 | −0.163 | -3.55 | 1 | −0.222 | FAIL |

Look-ahead check (three cuts on xau): every trade closed before a cut is the same in the cut run and the full run.

## Gold, EUR/USD, GBP/USD alone (descriptive, no verdict)

| | xau disc. n / net R / t | xau conf. n / net R / t | eurusd disc. n / net R / t | eurusd conf. n / net R / t | gbpusd disc. n / net R / t | gbpusd conf. n / net R / t |
|---|---|---|---|---|---|---|
| T1 | 1368 / −0.065 / -2.4 | 1250 / −0.212 / -4.81 | 607 / +0.038 / 0.99 | 406 / −0.003 / -0.06 | 834 / −0.048 / -1.4 | 467 / −0.033 / -0.67 |
| T2 | 1413 / −0.105 / -3.53 | 1141 / −0.229 / -6.75 | 531 / −0.044 / -1.09 | 322 / +0.085 / 1.42 | 791 / −0.081 / -2.16 | 365 / −0.062 / -1.15 |
| T3 | 73 / +0.097 / 0.45 | 51 / −0.148 / -0.42 | 40 / −0.011 / -0.08 | 26 / −0.034 / -0.34 | 57 / −0.006 / -0.06 | 22 / +0.019 / 0.1 |
| T4 | 436 / −0.176 / -3.36 | 302 / −0.060 / -1.1 | 201 / −0.057 / -0.68 | 131 / +0.079 / 0.86 | 256 / −0.105 / -1.71 | 159 / +0.143 / 1.69 |
| T5 | 368 / −0.231 / -2.12 | 278 / −0.257 / -1.83 | 219 / −0.087 / -0.75 | 117 / +0.004 / 0.03 | 271 / +0.020 / 0.18 | 129 / −0.096 / -0.68 |
| T6 | 98 / +0.101 / 0.49 | 68 / −0.021 / -0.09 | 109 / −0.047 / -0.3 | 64 / −0.401 / -1.89 | 104 / +0.129 / 0.65 | 69 / +0.169 / 0.53 |

## Confirmation by market (net R a trade, n)

| Market | T1 | T2 | T3 | T4 | T5 | T6 |
|---|---|---|---|---|---|---|
| xau | −0.212 (1250) | −0.229 (1141) | −0.148 (51) | −0.060 (302) | −0.257 (278) | −0.021 (68) |
| eurusd | −0.003 (406) | +0.085 (322) | −0.034 (26) | +0.079 (131) | +0.004 (117) | −0.401 (64) |
| gbpusd | −0.033 (467) | −0.062 (365) | +0.019 (22) | +0.143 (159) | −0.096 (129) | +0.169 (69) |
| usdjpy | −0.075 (666) | −0.029 (631) | +0.271 (33) | −0.050 (211) | −0.141 (192) | −0.179 (67) |
| audusd | −0.040 (346) | +0.037 (240) | −0.045 (19) | +0.102 (123) | −0.160 (93) | −0.155 (73) |
| nzdusd | −0.120 (280) | −0.107 (213) | −0.056 (21) | +0.056 (105) | −0.167 (87) | −0.528 (67) |
| usdcad | +0.044 (382) | −0.073 (301) | −0.104 (22) | +0.008 (126) | +0.494 (112) | +0.003 (77) |
| usdchf | −0.050 (298) | +0.077 (261) | +0.142 (17) | +0.017 (126) | +0.377 (75) | −0.381 (74) |
| eurjpy | −0.025 (704) | −0.081 (668) | −0.270 (29) | −0.046 (227) | −0.228 (202) | +0.246 (72) |
| xag | −0.165 (645) | −0.141 (634) | −0.013 (32) | −0.158 (210) | +0.121 (172) | −0.651 (76) |
| gbpjpy | −0.090 (843) | −0.047 (748) | −0.107 (31) | −0.123 (242) | −0.318 (237) | −0.423 (65) |
| eurgbp | +0.133 (129) | +0.084 (113) | −0.182 (10) | +0.176 (48) | +0.049 (41) | −0.233 (58) |
| audjpy | −0.029 (557) | −0.100 (489) | −0.006 (30) | −0.093 (180) | −0.014 (160) | −0.085 (71) |
| cadjpy | −0.051 (531) | −0.083 (433) | +0.219 (30) | −0.106 (179) | −0.388 (147) | −0.244 (62) |
| euraud | −0.008 (646) | −0.025 (582) | −0.000 (37) | +0.058 (187) | −0.079 (184) | −0.064 (59) |
| nas100 | −0.097 (957) | −0.110 (1040) | +0.130 (68) | +0.004 (299) | +0.102 (251) | +0.011 (72) |
| spx500 | +0.019 (396) | −0.061 (321) | +0.127 (41) | +0.067 (116) | +0.097 (115) | −0.218 (83) |
| de40 | −0.114 (875) | −0.052 (811) | −0.324 (51) | −0.103 (230) | +0.000 (208) | +0.242 (62) |

## By year (net R summed, trades)

| Reading | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| T1 | −211.2 (3936) | −174.6 (3098) | −235.9 (4133) | −114.3 (3413) | −190.6 (3142) | −300.6 (3934) | −302.0 (3302) |
| T2 | −195.3 (3330) | −168.2 (2604) | −225.4 (3857) | −202.2 (3015) | −221.8 (2855) | −251.9 (3408) | −261.9 (3050) |
| T3 | −9.8 (196) | +4.5 (205) | +6.8 (264) | −13.6 (183) | −8.5 (165) | −24.6 (225) | +22.6 (180) |
| T4 | −77.0 (1208) | −77.1 (1018) | −131.8 (1307) | −37.0 (1132) | −63.1 (991) | −2.4 (1236) | −13.3 (974) |
| T5 | +1.5 (1101) | −61.4 (893) | −104.4 (1173) | −16.2 (980) | −78.8 (917) | −29.8 (1031) | −83.6 (852) |
| T6 | +4.9 (412) | −88.9 (437) | +44.1 (415) | +8.3 (476) | −80.7 (455) | −65.9 (435) | −55.6 (349) |

## Notes

- Eight markets (nzdusd, usdchf, eurgbp, euraud, eurjpy, gbpjpy, audjpy, cadjpy) are not listed in `assets/mosha-sop.js` `ALL`, so the code would take gold's 0.10 as their pip; the study added their quoted decimals in memory, as pre-registered, so each stop is 30 of the market's own pips. The desk itself runs only five markets.
- Costs for the 13 markets outside the demo-measured five are assumed (combo-grid-2), not measured.
- 15-minute, 1-hour and 4-hour candles are grouped from the 5-minute cache in UTC buckets; the desk reads OANDA's own candles, which can differ in a bucket with a missing 5-minute candle.
- A paper reading of one desk's code before any owner change; no variant of these readings is tried on these years after this.
