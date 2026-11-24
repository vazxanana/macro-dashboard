# Gold FVG return on H4 and D1 gaps at the broker's measured costs (result)

**Verdict: FAIL. 0 of 2 pass. T1 gold H4 large 1R: -0.003R a trade after measured costs in 2015-26 (n 1697, month t -0.14; +0.023R before costs), +0.095R in 2005-14 (n 1249); T2 gold D1 large 1R: +0.023R a trade after measured costs in 2015-26 (n 312, month t 0.46; +0.045R before costs), -0.050R in 2005-14 (n 241).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, no rule is proposed. One run, no variants. The H4 before-cost figures were already published by `grid7-fvg-wide`
and the D1 entries already read by `fvg-htf-exits` (other exits): this is cost accounting on entries already seen, not new
evidence. A before-cost tilt is not an edge.

## What was run

`fvg-htf-exits` `signals` on gold (grid7's gap, band and market entry; H4 from 5-minute candles, D1 = 17:00 New York days),
large gaps only (height / ATR above gold's 2005-14 median: H4 0.3059, D1 0.3330),
market entry at the next 5-minute open after the first M15 close inside the gap, stop past the far side + 0.1 ATR, target 1R,
out at the time limit (H4 5 days, D1 20 days). Cost: fvg-hourcost costFrac (gold hourProfile median frac; half spread in + out, + half on a stop) + commission + nights x FIN.xau.long on buys (profile council-data 0459ec37e2 research/probe/ticks-XAUUSD.json hourProfile (at 2026-11-20T00:58:29.569Z); commission 0.000024;
financing 0.000148 of price a rollover on buys, council/fills.mjs).

## Checks of the harness

- Gate H4 (before costs): n 1249 / 1697 (want 1249 / 1697), R +0.115 / +0.023 (want +0.115 / +0.023): ok.
- Gate D1 (before costs): n 241 / 312 (want 241 / 312): ok.
- Exit walk reproduces manage's R: 0 mismatches of 6,855 (ok).
- No look-ahead (signals known at five dates, recomputed on candles cut there): 2008-06-11 1208 (0 missing, 0 extra); 2012-03-14 3141 (0 missing, 0 extra); 2016-09-21 5459 (0 missing, 0 extra); 2021-02-17 7704 (0 missing, 0 extra); 2025-05-07 10066 (0 missing, 0 extra) (ok).

## Tests (after measured costs; Holm over two)

| Test | n 05-14 | net 05-14 (t) | n 15-26 | before costs 15-26 (t) | spread / comm / fin R | net 15-26 (t) | net at 2x cost | control net 15-26 | vs control | Holm p | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| T1 gold H4 large 1R | 1,249 | +0.095 (2.99) | 1,697 | +0.023 | 0.011 / 0.010 / 0.006 | -0.003 (-0.14) | -0.030 | -0.044 | 1.18 | 0.649 | no |
| T2 gold D1 large 1R | 241 | -0.050 (-0.88) | 312 | +0.045 | 0.004 / 0.003 / 0.014 | +0.023 (0.46) | +0.002 | +0.027 | -0.04 | 0.649 | no |

Failed checks: T1: positive, tConf, holm, cost2x, control; T2: positive, tConf, holm, control.

Month-sum t on calendar months by fill month (empty months 0). Before costs (2005-14): T1 +0.115, T2 -0.035.

## Sensitivity (reported, not judged)

| Row | test | net 05-14 (t) | net 15-26 (t) |
|---|---|---:|---:|
| no financing (the task's spread + commission model only) | T1 | +0.099 (3.14) | +0.003 (0.13) |
| no financing (the task's spread + commission model only) | T2 | -0.041 (-0.72) | +0.038 (0.73) |
| 90th percentile spread of each hour | T1 | +0.093 (2.93) | -0.006 (-0.24) |
| 90th percentile spread of each hour | T2 | -0.051 (-0.89) | +0.023 (0.44) |
| no cost (mid, before costs) | T1 | +0.115 (3.66) | +0.023 (1.01) |
| no cost (mid, before costs) | T2 | -0.035 (-0.61) | +0.045 (0.87) |

## Stops, holds, exits, sides

| Test | median stop (share of price) | median hold h | stop / target / time | buys net 15-26 (n, t) | sells net 15-26 (n, t) |
|---|---:|---:|---|---:|---:|
| T1 H4 | 0.346 % | 3.08 | 1357 / 1540 / 49 | -0.033 (912, -1) | +0.032 (785, 0.92) |
| T2 D1 | 0.897 % | 17.42 | 272 / 277 / 4 | +0.060 (183, 0.89) | -0.029 (129, -0.32) |

## Year by year (after measured costs; n, net R a trade)

| Year | H4 | D1 |
|---|---:|---:|
| 2006 | 114, +0.221 | 22, -0.012 |
| 2007 | 150, +0.103 | 26, -0.093 |
| 2008 | 147, +0.149 | 30, -0.078 |
| 2009 | 131, +0.204 | 24, +0.238 |
| 2010 | 138, +0.130 | 27, -0.128 |
| 2011 | 149, +0.247 | 27, -0.199 |
| 2012 | 140, -0.162 | 32, -0.209 |
| 2013 | 145, -0.025 | 26, +0.220 |
| 2014 | 135, +0.005 | 27, -0.108 |
| 2015 | 140, +0.081 | 22, -0.291 |
| 2016 | 128, -0.037 | 33, -0.048 |
| 2017 | 135, +0.035 | 25, +0.327 |
| 2018 | 141, +0.015 | 21, +0.216 |
| 2019 | 145, +0.004 | 24, -0.191 |
| 2020 | 122, -0.079 | 30, -0.103 |
| 2021 | 148, -0.074 | 27, -0.051 |
| 2022 | 134, +0.020 | 26, -0.326 |
| 2023 | 172, -0.079 | 26, -0.109 |
| 2024 | 139, -0.009 | 25, +0.338 |
| 2025 | 158, +0.115 | 27, +0.308 |
| 2026 | 135, -0.037 | 26, +0.237 |

## Reading (written after the results)

- The larger stop does cut the cost in R: about 0.027R a trade on H4 and 0.021R on D1 (of which financing
  0.014R) in 2015-26, against 0.048R on H1 in `fvg-hourcost`. But the before-cost return shrinks with it: gold
  H4 +0.023R (month t 1.01) and D1 +0.045R (t 0.87) in 2015-26; D1 was -0.035R before costs in 2005-14.
- No test is positive after costs in both windows, none reaches a confirmation month t of 1, neither beats its random bands.
  The question is answered for gold: a bigger gap timeframe does not rescue the FVG return. Do not test other exits or
  timeframes of this cell on gold on these years.

## Caveats

- In sample: grid7 chose the cell on these years, and fvg-htf-exits read the D1 entries. Even a pass would only be a candidate for
  a forward paper record.
- Today's measured spread (Nov 2026 profile, first two minutes of each hour on 44 weekdays) and today's financing rate charged
  on every past year; slippage beyond the quote is only the extra half spread on stops. OANDA mid candles, not broker ticks.
