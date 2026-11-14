# The 5-minute opening range breakout at the European and Asian cash opens

Paper research only. No live rule, size, filter, stop, config or council member changed; ICT not involved. The rule (orb-nas100's,
unchanged), markets, costs, windows, placebo and pass bar were committed first (`PREREGISTRATION.md`). This page is written by
`run.mjs` from `result.json`.

**Verdict: FAIL: European ORB book −0.260R a trade net 2021 on (n 5875, monthly t −5.54; gross +0.046R); 0 of 8 tests pass after Holm**

- **T1 Europe pooled**, 2021 → now: −0.260R a trade net (n 5875, t −5.54 on 71 monthly sums; before costs +0.046R, t +1.05; 2× costs −0.566R); 2016-20 −0.395R (n 4954, t −7.25); placebo 95th percentile −0.683R; Holm p 1.000. Net > 0: no; t ≥ 2: no; Holm: no; beats the placebo: yes; in sample > 0: no; 2× costs > 0: no → **fail**.
- **T2 de40**, 2021 → now: −0.001R a trade net (n 1487, t −0.01 on 71 monthly sums; before costs +0.096R, t +1.49; 2× costs −0.097R); 2016-20 −0.025R (n 1257, t −0.33); placebo 95th percentile −0.257R; Holm p 1.000. Net > 0: no; t ≥ 2: no; Holm: no; beats the placebo: yes; in sample > 0: no; 2× costs > 0: no → **fail**.
- **T3 eu50**, 2021 → now: −0.687R a trade net (n 1437, t −8.85 on 71 monthly sums; before costs +0.020R, t +0.33; 2× costs −1.394R); 2016-20 −1.216R (n 1189, t −12.19); placebo 95th percentile −1.302R; Holm p 1.000. Net > 0: no; t ≥ 2: no; Holm: no; beats the placebo: yes; in sample > 0: no; 2× costs > 0: no → **fail**.
- **T4 fr40**, 2021 → now: −0.188R a trade net (n 1485, t −2.62 on 71 monthly sums; before costs +0.039R, t +0.55; 2× costs −0.414R); 2016-20 −0.300R (n 1259, t −4.06); placebo 95th percentile −0.529R; Holm p 1.000. Net > 0: no; t ≥ 2: no; Holm: no; beats the placebo: yes; in sample > 0: no; 2× costs > 0: no → **fail**.
- **T5 uk100**, 2021 → now: −0.178R a trade net (n 1466, t −3.24 on 71 monthly sums; before costs +0.027R, t +0.52; 2× costs −0.384R); 2016-20 −0.080R (n 1249, t −1.00); placebo 95th percentile −0.571R; Holm p 1.000. Net > 0: no; t ≥ 2: no; Holm: no; beats the placebo: yes; in sample > 0: no; 2× costs > 0: no → **fail**.
- **T6 jp225**, 2021 → now: −0.103R a trade net (n 1410, t −1.45 on 71 monthly sums; before costs +0.199R, t +2.91; 2× costs −0.405R); 2016-20 −0.737R (n 1178, t −9.80); placebo 95th percentile −0.655R; Holm p 1.000. Net > 0: no; t ≥ 2: no; Holm: no; beats the placebo: yes; in sample > 0: no; 2× costs > 0: no → **fail**.
- **T7 au200**, 2021 → now: −0.632R a trade net (n 1438, t −10.16 on 71 monthly sums; before costs −0.037R, t −0.64; 2× costs −1.227R); 2016-20 −0.748R (n 1237, t −8.96); placebo 95th percentile −1.410R; Holm p 1.000. Net > 0: no; t ≥ 2: no; Holm: no; beats the placebo: yes; in sample > 0: no; 2× costs > 0: no → **fail**.
- **T8 Asia pooled**, 2021 → now: −0.370R a trade net (n 2848, t −7.46 on 71 monthly sums; before costs +0.080R, t +1.75; 2× costs −0.820R); 2016-20 −0.743R (n 2415, t −12.04); placebo 95th percentile −1.072R; Holm p 1.000. Net > 0: no; t ≥ 2: no; Holm: no; beats the placebo: yes; in sample > 0: no; 2× costs > 0: no → **fail**.

**Reading.** The US gross tilt (+0.14R a trade at the New York open, orb-nas100) is much weaker at the European opens: the pooled book makes +0.046R a trade before costs in 2021 → now (t 1.05; DAX the best, +0.096R, t 1.49), and the CFD round trip (0.31R a trade on a median risk of 13 points) turns it into −0.260R (t −5.54). Every test is negative net in both windows; none passes even net > 0. Before costs no European market has t above 1.5, so this is not only a cost problem: the opening candle points the day far less in Europe than in New York. The Asian pair loses too (−0.370R net); the ASX loses even before costs. Not an edge; no proposal is written and nothing live changes.

## Windows

| Test | Window | n | Win | Net R/trade | Gross R/trade | Spread-only net | 2× cost net | Cost R/trade | Total R | t (months) | Gross t | Stops / targets / time | Max DD R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Europe pooled | 2016-2020 (in sample) | 4954 | 20.3 % | −0.395 | +0.070 | −0.150 | −0.859 | 0.465 | −1954.48 | −7.25 | +1.46 | 3859 / 163 / 932 | −2098.41 |
| T1 Europe pooled | 2021 → now (decides) | 5875 | 21.0 % | −0.260 | +0.046 | −0.100 | −0.566 | 0.306 | −1527.69 | −5.54 | +1.05 | 4538 / 167 / 1170 | −1619.53 |
| T1 Europe pooled | Mar 2023 → now | 3701 | 21.0 % | −0.266 | +0.027 | −0.113 | −0.558 | 0.292 | −984.16 | −5.35 | +0.57 | 2868 / 97 / 736 | −1078.70 |
| T2 de40 | 2016-2020 (in sample) | 1257 | 20.1 % | −0.025 | +0.121 | +0.033 | −0.170 | 0.146 | −31.23 | −0.33 | +1.59 | 993 / 50 / 214 | −107.19 |
| T2 de40 | 2021 → now (decides) | 1487 | 21.9 % | −0.001 | +0.096 | +0.038 | −0.097 | 0.097 | −0.90 | −0.01 | +1.49 | 1138 / 45 / 304 | −91.72 |
| T2 de40 | Mar 2023 → now | 937 | 21.1 % | −0.055 | +0.040 | −0.017 | −0.151 | 0.096 | −51.99 | −0.78 | +0.57 | 726 / 25 / 186 | −74.61 |
| T3 eu50 | 2016-2020 (in sample) | 1189 | 16.4 % | −1.216 | −0.071 | −0.562 | −2.361 | 1.145 | −1445.78 | −12.19 | −1.20 | 965 / 38 / 186 | −1453.31 |
| T3 eu50 | 2021 → now (decides) | 1437 | 18.2 % | −0.687 | +0.020 | −0.283 | −1.394 | 0.707 | −986.89 | −8.85 | +0.33 | 1153 / 48 / 236 | −1004.12 |
| T3 eu50 | Mar 2023 → now | 895 | 18.8 % | −0.633 | +0.038 | −0.249 | −1.303 | 0.671 | −566.30 | −7.55 | +0.55 | 716 / 27 / 152 | −583.79 |
| T4 fr40 | 2016-2020 (in sample) | 1259 | 20.3 % | −0.300 | +0.055 | −0.138 | −0.654 | 0.355 | −377.11 | −4.06 | +0.80 | 980 / 38 / 241 | −443.51 |
| T4 fr40 | 2021 → now (decides) | 1485 | 21.8 % | −0.188 | +0.039 | −0.085 | −0.414 | 0.226 | −278.87 | −2.62 | +0.55 | 1135 / 39 / 311 | −311.66 |
| T4 fr40 | Mar 2023 → now | 940 | 22.3 % | −0.161 | +0.054 | −0.063 | −0.376 | 0.215 | −151.37 | −1.87 | +0.63 | 714 / 25 / 201 | −185.23 |
| T5 uk100 | 2016-2020 (in sample) | 1249 | 24.3 % | −0.080 | +0.169 | +0.044 | −0.330 | 0.249 | −100.37 | −1.00 | +2.16 | 921 / 37 / 291 | −177.61 |
| T5 uk100 | 2021 → now (decides) | 1466 | 22.0 % | −0.178 | +0.027 | −0.075 | −0.384 | 0.206 | −261.03 | −3.24 | +0.52 | 1112 / 35 / 319 | −287.61 |
| T5 uk100 | Mar 2023 → now | 929 | 21.5 % | −0.231 | −0.026 | −0.128 | −0.436 | 0.205 | −214.50 | −3.43 | −0.40 | 712 / 20 / 197 | −247.84 |
| T6 jp225 | 2016-2020 (in sample) | 1178 | 21.9 % | −0.737 | +0.072 | −0.288 | −1.545 | 0.808 | −867.98 | −9.80 | +1.20 | 878 / 31 / 269 | −881.49 |
| T6 jp225 | 2021 → now (decides) | 1410 | 27.8 % | −0.103 | +0.199 | +0.065 | −0.405 | 0.302 | −145.08 | −1.45 | +2.91 | 965 / 38 / 407 | −218.56 |
| T6 jp225 | Mar 2023 → now | 893 | 27.2 % | −0.087 | +0.166 | +0.053 | −0.341 | 0.253 | −77.99 | −0.98 | +1.93 | 617 / 22 / 254 | −133.53 |
| T7 au200 | 2016-2020 (in sample) | 1237 | 20.0 % | −0.748 | +0.013 | −0.368 | −1.509 | 0.761 | −925.52 | −8.96 | +0.17 | 956 / 32 / 249 | −960.91 |
| T7 au200 | 2021 → now (decides) | 1438 | 20.0 % | −0.632 | −0.037 | −0.334 | −1.227 | 0.595 | −908.52 | −10.16 | −0.64 | 1109 / 32 / 297 | −913.39 |
| T7 au200 | Mar 2023 → now | 910 | 19.7 % | −0.663 | −0.079 | −0.371 | −1.247 | 0.584 | −603.06 | −9.02 | −1.15 | 704 / 18 / 188 | −603.06 |
| T8 Asia pooled | 2016-2020 (in sample) | 2415 | 21.0 % | −0.743 | +0.041 | −0.329 | −1.527 | 0.784 | −1793.49 | −12.04 | +0.79 | 1834 / 63 / 518 | −1832.12 |
| T8 Asia pooled | 2021 → now (decides) | 2848 | 23.9 % | −0.370 | +0.080 | −0.137 | −0.820 | 0.450 | −1053.60 | −7.46 | +1.75 | 2074 / 70 / 704 | −1061.81 |
| T8 Asia pooled | Mar 2023 → now | 1803 | 23.4 % | −0.378 | +0.042 | −0.161 | −0.798 | 0.420 | −681.06 | −6.25 | +0.79 | 1321 / 40 / 442 | −681.72 |

## Placebo (window B, a random side each day, 40 seeds)

| Test | Real net R/trade | Placebo median | Placebo 95th percentile |
|---|---|---|---|
| T1 Europe pooled | −0.260 | −0.728 | −0.683 |
| T2 de40 | −0.001 | −0.316 | −0.257 |
| T3 eu50 | −0.687 | −1.380 | −1.302 |
| T4 fr40 | −0.188 | −0.607 | −0.529 |
| T5 uk100 | −0.178 | −0.659 | −0.571 |
| T6 jp225 | −0.103 | −0.792 | −0.655 |
| T7 au200 | −0.632 | −1.510 | −1.410 |
| T8 Asia pooled | −0.370 | −1.159 | −1.072 |

## By year (net R a trade, n)

| Year | de40 | eu50 | fr40 | uk100 | jp225 | au200 |
|---|---|---|---|---|---|---|
| 2016 | +0.096 (253) | −0.811 (248) | −0.029 (251) | −0.134 (251) | −0.841 (237) | −0.863 (248) |
| 2017 | −0.260 (249) | −1.579 (235) | −0.512 (253) | −0.225 (252) | −1.007 (239) | −0.731 (247) |
| 2018 | +0.169 (249) | −1.567 (235) | −0.418 (252) | +0.099 (249) | −0.640 (239) | −1.010 (250) |
| 2019 | −0.204 (253) | −1.514 (225) | −0.498 (251) | −0.131 (248) | −0.619 (228) | −0.865 (245) |
| 2020 | +0.073 (253) | −0.669 (246) | −0.040 (252) | −0.008 (249) | −0.570 (235) | −0.269 (247) |
| 2021 | +0.050 (255) | −1.045 (250) | −0.354 (252) | −0.036 (249) | −0.006 (242) | −0.536 (248) |
| 2022 | +0.180 (253) | −0.599 (251) | −0.167 (251) | −0.103 (247) | −0.274 (237) | −0.525 (242) |
| 2023 | −0.105 (254) | −0.804 (244) | −0.250 (255) | −0.284 (249) | −0.284 (243) | −1.076 (245) |
| 2024 | −0.100 (252) | −0.861 (237) | −0.048 (253) | −0.414 (251) | +0.037 (241) | −0.716 (243) |
| 2025 | +0.085 (251) | −0.440 (238) | −0.209 (252) | −0.190 (250) | −0.228 (241) | −0.439 (239) |
| 2026 | −0.128 (222) | −0.324 (217) | −0.085 (222) | −0.020 (220) | +0.176 (206) | −0.479 (221) |

## Data, days and costs

- de40 (DAX, open 09:00 local, close 17:30): 615287 OANDA mid M5 candles 2015-12-01 → 2026-11-13; 2744 trades; cost 2 points round trip (spread only 1.2); median risk 2021 on 29.4 points; days skipped: 65 exchange holidays, 0 early closes, 13 with the first or entry candle missing, 14 doji, 0 with the entry at or past the stop.
- eu50 (Euro Stoxx 50, open 09:00 local, close 17:30): 551164 OANDA mid M5 candles 2015-12-01 → 2026-11-13; 2626 trades; cost 3.5 points round trip (spread only 1.5); median risk 2021 on 7 points; days skipped: 65 exchange holidays, 0 early closes, 13 with the first or entry candle missing, 87 doji, 45 with the entry at or past the stop.
- fr40 (CAC 40, open 09:00 local, close 17:30): 466595 OANDA mid M5 candles 2015-12-01 → 2026-11-13; 2744 trades; cost 2.2 points round trip (spread only 1.2); median risk 2021 on 12.8 points; days skipped: 53 exchange holidays, 12 early closes, 14 with the first or entry candle missing, 13 doji, 0 with the entry at or past the stop.
- uk100 (FTSE 100, open 08:00 local, close 16:30): 656133 OANDA mid M5 candles 2015-12-01 → 2026-11-13; 2715 trades; cost 2 points round trip (spread only 1); median risk 2021 on 12.8 points; days skipped: 89 exchange holidays, 12 early closes, 3 with the first or entry candle missing, 15 doji, 2 with the entry at or past the stop.
- jp225 (Nikkei 225, open 09:00 local, close 15:00, 15:30 from 2024-11-05): 760414 OANDA mid M5 candles 2015-12-01 → 2026-11-13; 2588 trades; cost 18 points round trip (spread only 8); median risk 2021 on 80 points; days skipped: 182 exchange holidays, 0 early closes, 21 with the first or entry candle missing, 37 doji, 8 with the entry at or past the stop.
- au200 (ASX 200, open 10:00 local, close 16:00): 680739 OANDA mid M5 candles 2015-12-01 → 2026-11-13; 2675 trades; cost 4 points round trip (spread only 2); median risk 2021 on 9 points; days skipped: 83 exchange holidays, 12 early closes, 12 with the first or entry candle missing, 50 doji, 4 with the entry at or past the stop.

## Notes

- Post hoc, descriptive only: the Nikkei (jp225) is the one market with a clear gross tilt in 2021 → now, +0.199R a trade before costs (monthly t +2.91, n 1410), but its 18-point round trip on a median 80-point risk costs 0.30R and it is −0.103R net (spread only, 8 points: +0.065R). In 2016-20 it was +0.072R gross and −0.737R net. A cheaper venue (OSE micro future) would be a different study with its own pre-registration; this one does not support it.
- Costs are the repo's published typical figures with slippage (open-run-breadth tables), not measured bid/ask at the open; spreads at the first five minutes of a cash session are usually wider than the daytime figure, so the true net is, if anything, lower. The spread-only column shows the conclusion does not hinge on the slippage part: the European book is −0.100R a trade at spread only.
- Euro Stoxx 50 opening ranges are small (median risk 7 points against a 3.5-point round trip), so its net figures are dominated by cost; its gross is +0.020R.
- Pooled drawdowns are on the union of the markets' trades in time order at 1R each, not a sized portfolio.
- The rule is orb-nas100's, unchanged (side of the first M5 candle, entry at the next open, stop at the other end, 10R target, stop first, out before the local cash close); only the clock, calendar and cost change.

To repeat: `node --use-env-proxy research/edge/intl-index-orb/fetch.mjs <dir>`, then `node research/edge/intl-index-orb/run.mjs <dir>`.
