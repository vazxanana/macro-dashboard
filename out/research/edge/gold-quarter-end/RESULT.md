# Result: gold against its quarter-to-date move in the last days of a quarter (14 Nov 2026)

**Verdict: FAIL: fading gold's quarter-to-date move over the last 4 days of the quarter made -0.008R a trade net out of sample (n 39, t -0.06), -0.075R in sample; 27 of 40 placebos; 0 of 3 pass.**

A calendar study of its own: no rule of the live gold book was read, tested or touched (docs/owner-decisions.md item 44; the
reading is in the pre-registration). Pre-registration: `PREREGISTRATION.md` (pushed alone before any figure, commit
`39aca3cfb`). Code: `run.mjs`. Every figure and every trade: `result.json`. Not an edge; nothing live changed and no proposal
is written.

Data: council-data `research/daily/xau.json` (OANDA mid spot gold, UTC days, weekends folded into Monday with `foldWeekend`),
20 Mar 2006 to 6 Nov 2026 (5,364 candles); stops checked on OANDA mid XAU/USD H1 (125,704 candles, 19 Mar 2006 to 13 Nov
2026, kept outside git). The last H1 close of every UTC day equals the daily close on all 5,364 days (same feed). No trade
needed the daily-candle fallback for its stop.

**The sample is small, as the pre-registration said**: one trade a quarter, 39 out of sample. A t of 2 would have needed a
mean of about +0.28R a trade at this spread of results (sd 0.86R); the rule made -0.008R.

## The three tests (net R a trade after $0.60 and financing on buys; t on calendar-month sums = per trade here)

| Test | Window | n | net R | t | gross R | t gross | net R at 2x costs | win % | stops | buys (n, net R) | sells (n, net R) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 quarter end (primary) | IS 2007-16 | 40 | -0.075 | -0.75 | -0.040 | -0.40 | -0.110 | 45.0 | 7 | 17, -0.043 | 23, -0.098 |
| T1 quarter end (primary) | OOS 2017-26 | 39 | -0.008 | -0.06 | +0.023 | 0.17 | -0.038 | 48.7 | 9 | 13, -0.158 | 26, +0.067 |
| T2 non-quarter month ends | IS 2007-16 | 80 | +0.023 | 0.27 | +0.059 | 0.67 | -0.012 | 43.8 | 13 | 29, -0.037 | 51, +0.058 |
| T2 non-quarter month ends | OOS 2017-26 | 78 | +0.012 | 0.14 | +0.044 | 0.51 | -0.019 | 50.0 | 16 | 25, -0.067 | 53, +0.050 |
| T3 large quarters only | IS 2008-16 | 19 | -0.091 | -0.74 | -0.061 | -0.49 | -0.122 | 42.1 | 2 | 7, -0.160 | 12, -0.051 |
| T3 large quarters only | OOS 2017-26 | 22 | -0.041 | -0.21 | -0.016 | -0.09 | -0.065 | 45.5 | 6 | 6, -0.494 | 16, +0.129 |

## The bar (each test needs every check)

| Test | OOS net > 0, t >= 2 | Holm p (one-sided) < 0.05 | IS net > 0 | OOS net at 2x > 0 | Placebo beaten (38 needed) | Pass |
|---|---|---|---|---|---|---|
| T1 | no (t -0.06) | no (1.00) | no | no | 27 / 40 | no |
| T2 | no (t 0.14) | no (1.00) | yes | no | 34 / 40 | no |
| T3 | no (t -0.21) | no (1.00) | no | no | 24 / 40 | no |

Placebo (40 seeds, seed 20261114): each out-of-sample event replaced by a 4-day window earlier in the same quarter (T1, T3)
or month (T2), side by the same rule at that entry, same stop and costs. Placebo mean net R: median -0.051R, 95th percentile
+0.158R (T1); -0.057R, +0.088R (T2); -0.151R, +0.211R (T3). The rule sits inside the placebo spread in every test.

## By year (net R summed over the year's trades; 2006 events fall before either window and are shown only)

| Year | T1 n | T1 R | T2 n | T2 R |
|---|---|---|---|---|
| 2006 | 3 | -1.83 | 6 | -1.67 |
| 2007 | 4 | -2.34 | 8 | +1.09 |
| 2008 | 4 | +2.39 | 8 | +0.40 |
| 2009 | 4 | +0.21 | 8 | -2.42 |
| 2010 | 4 | -1.10 | 8 | -2.38 |
| 2011 | 4 | -1.17 | 8 | -1.76 |
| 2012 | 4 | +0.95 | 8 | +0.91 |
| 2013 | 4 | -1.60 | 8 | +1.50 |
| 2014 | 4 | +0.08 | 8 | +5.42 |
| 2015 | 4 | -1.52 | 8 | +1.25 |
| 2016 | 4 | +1.10 | 8 | -2.12 |
| 2017 | 4 | +2.99 | 8 | -2.46 |
| 2018 | 4 | -2.14 | 8 | -1.01 |
| 2019 | 4 | +2.87 | 8 | -0.46 |
| 2020 | 4 | -0.26 | 8 | +3.05 |
| 2021 | 4 | -1.44 | 8 | -0.58 |
| 2022 | 4 | -0.04 | 8 | -0.51 |
| 2023 | 4 | -1.62 | 8 | +1.14 |
| 2024 | 4 | -0.41 | 8 | +1.24 |
| 2025 | 4 | -0.14 | 8 | +0.76 |
| 2026 | 3 | -0.10 | 7 | -1.23 |

## What is in the numbers (reported, not judged)

- No sign that gold's last four days of a quarter turn against the quarter: gross R is within 0.06R of zero in both windows
  and in T3, where the rebalancing pressure should be largest.
- Out of sample the sells (gold up for the quarter) made a little and the buys lost, the shape of gold's rise over
  2017-26 rather than of a flow (a short held four days in a rising market pays the drift, a long earns it, so this goes the
  wrong way for a drift story too, and with n 13 and 6 buys it is noise).
- Costs are small here (median stop distance $32, $12 to $262, on a 1.5 x ATR(20) daily stop): $0.60 and financing take about 0.03R a
  trade.
- It agrees with the stock-index versions (`index-quarter-end`, `rebalance-flow`), which also found no rebalancing reversal.

To repeat: `node research/edge/gold-quarter-end/run.mjs <xau-h1.json>` (H1 as `[[t, o, h, l, c], ...]`, OANDA mid, from the
candle proxy; daily from `origin/council-data` with `git show`). Test: `tests/gold-quarter-end.test.mjs`.
