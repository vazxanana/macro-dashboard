# Result: spot gold around the turn of the month (14 Nov 2026)

**Verdict: FAIL: long gold TD-2 to TD+3 made +0.117R a trade net out of sample (n 118, month t 1.80, Holm p 0.11), +0.000R in sample, 36 of 40 placebos; 0 of 3 pass.**

A calendar study of its own: no rule of the live gold book was read, tested or touched (docs/owner-decisions.md item 44;
the reading is in the pre-registration). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure, commit
`667e34358`). Code: `run.mjs`. Every figure: `result.json`. Nothing is an edge here; nothing live changed and no proposal is
written.

Data: council-data `research/daily/xau.json` (OANDA mid spot gold, UTC daily candles, weekends folded into Monday with
`fills.mjs` `foldWeekend`), 20 Mar 2006 to 6 Nov 2026 (5,364 candles). Trading days are the folded candles (holiday
candles counted). Events by entry month: in sample 2008-01 to 2016-12 (108 months), out of sample 2017-01 to 2026-10 (118);
no event was dropped. Each trade enters and exits at a daily close, stop 2 x ATR(20), costs $0.60 a round trip (the $0.30
gold spread plus half a spread of slippage on each market order), financing on longs only (`FIN.xau.long`, 0.0148 % of
price a rollover).

## The three tests (net R a trade; t on calendar-month sums; one-sided p in the test's sign)

| Test | Side | Window | n | net R | t net | gross R | t gross | net at 2x costs | win % | stops | opposite side net (t) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 (primary): TD-2 close to TD+3 close | long | 2017-26 | 118 | +0.117 | 1.80 | +0.163 | 2.50 | +0.071 | 54.24 | 12 | -0.171 (-2.92) |
| T1 | long | 2008-16 | 108 | +0.000 | 0.01 | +0.042 | 0.64 | -0.041 | 52.78 | 15 | -0.097 (-1.41) |
| T2: TD-4 close to TD-1 close (month-end sales) | short | 2017-26 | 118 | +0.005 | 0.09 | +0.018 | 0.34 | -0.009 | 50.85 | 9 | -0.066 (-1.30) |
| T2 | short | 2008-16 | 108 | +0.025 | 0.52 | +0.040 | 0.84 | +0.009 | 53.70 | 4 | -0.075 (-1.50) |
| T3: TD-1 close to TD+5 close (first five days) | long | 2017-26 | 118 | +0.121 | 1.46 | +0.175 | 2.10 | +0.068 | 50.85 | 22 | -0.122 (-1.83) |
| T3 | long | 2008-16 | 108 | +0.015 | 0.21 | +0.062 | 0.88 | -0.033 | 50.00 | 20 | -0.117 (-1.66) |

| Test | Holm p (out of sample) | Placebo seeds beaten (38 of 40 needed) | Placebo mean / max | Pass |
|---|---|---|---|---|
| T1 | 0.111 | 36 | +0.049 / +0.177 | no (month t, Holm, placebo) |
| T2 | 0.4662 | 38 | -0.076 / +0.037 | no (month t, Holm, 2x costs) |
| T3 | 0.1472 | 33 | +0.067 / +0.199 | no (month t, Holm, placebo) |

Every test misses its bar. T1, the published stock window, is positive out of sample after costs (+0.117R a trade, total
+13.8R over 118 months) but its month t is 1.80, its Holm p 0.11, and in 2008-16 it made nothing (+0.0005R a trade, t 0.01).
T3 is the same picture (+0.121R, t 1.46; +0.015R in sample). T2 beats 38 placebo seeds only because a random short in a
rising gold market loses (placebo mean -0.076R); the rule itself is flat (+0.005R) and negative at 2x costs.

## Against the other windows (reported, not gating; gross log return, basis points, long sign)

| Test | Window | event windows | other windows | event bp | other bp | difference (Welch t) |
|---|---|---|---|---|---|---|
| T1 | 2017-26 | 118 | 2,434 | +44.52 | +18.17 | +26.35 (1.48) |
| T1 | 2008-16 | 108 | 2,233 | +9.59 | +5.08 | +4.51 (0.19) |
| T2 | 2017-26 | 118 | 2,434 | -15.47 | +15.98 | -31.44 (-1.95) |
| T2 | 2008-16 | 108 | 2,233 | -15.76 | +4.89 | -20.65 (-1.24) |
| T3 | 2017-26 | 118 | 2,434 | +50.80 | +22.98 | +27.82 (1.29) |
| T3 | 2008-16 | 108 | 2,233 | +15.01 | +6.22 | +8.79 (0.37) |

What the long windows earn out of sample is mostly gold's own rise over 2017-26 (any window of the same length with entry in
the same months gained 18-23 bp); the turn of the month adds about 26-28 bp with t under 1.5, and nothing measurable in
2008-16. The last three days of a month were weaker than other three-day windows in both halves (-31 bp, t -1.95; -21 bp,
t -1.24), a direction that matches the month-end selling story, but too small to pay the spread as a short (T2 above).
Read as a hint, not a finding: it was not the pre-registered test statistic.

## By year (T1 net R a trade, 12 trades a year; 2026 has 10)

2008 -0.440, 2009 +0.389, 2010 +0.267, 2011 +0.287, 2012 -0.167, 2013 -0.239, 2014 -0.333, 2015 -0.125, 2016 +0.365,
2017 -0.083, 2018 +0.103, 2019 +0.348, 2020 +0.088, 2021 -0.053, 2022 +0.122, 2023 -0.173, 2024 +0.240, 2025 +0.584,
2026 -0.030. The sign follows gold's year: losing in 2012-15 when gold fell, best in 2025 when it rose most.

## What this does not test

The London or New York close (the candles are UTC days), the COMEX futures (the CFD tracks spot), the dates ETF holdings or
central-bank purchases are actually published (taken as "the first days of the month"), and any other window. Nothing is
called an edge; nothing live changed. To repeat: `node research/edge/gold-turn-of-month/run.mjs` (reads council-data with
`git show`, no network). Tests: `tests/gold-turn-of-month.test.mjs`.
