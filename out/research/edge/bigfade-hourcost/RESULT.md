# Big-candle fade at the demo broker's measured hourly spreads (result)

**Verdict: FAIL. 0 of 4 tests pass; at the broker's measured hourly spreads the big-candle fade made -0.185R a trade pooled in 2015-26 (n 11634, month t -9.56; before costs +0.105R), gold -0.058R (t -1.74), silver -0.322R (t -4.8), USD/JPY -0.256R (t -10.54).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Paper research only: nothing live
changed, no rule is proposed. One run, no variants. These years were read by `big-candle-fade`: this is cost accounting on a
rule already chosen. A before-cost tilt is not an edge.

## What was run

`big-candle-fade` cell `m15 k1.5 nobreak half` (the Equinox Big-candle fade desk) by its own `signals()` and `trade()`,
selected as `council/edge-desks-2.mjs` `bigTrades` does; OANDA mid 5-minute candles, fills 2005-01 to 2026-10. Cost a trade:
half the measured spread of the entry hour and of the exit hour, the broker's commission round trip, and on a stop exit another
half spread of the exit hour (as `fade-late-hourcost`). Commission from council-data `ctrader/symbols.json` at 853060f780.

Measured spread by UTC hour (median, share of price):

- gold: hourProfile (first two minutes of each UTC hour, last 60 weekdays); council-data 0459ec37e2 `research/probe/ticks-XAUUSD.json` (probe of 2026-11-20).
- silver: hourProfile (first two minutes of each UTC hour, last 60 weekdays); council-data 19c2477d5b `research/probe/ticks-XAGUSD.json` (probe of 2026-11-20).
- USD/JPY: median bid / ask at fade-tick-exec's fills and exits, by UTC hour; `research/edge/fade-late-hourcost/profile.json`.
- No other market of the ten has a measured hourly spread (their `hourProfile` is empty): reported apart, not in the verdict.

## Gate

- Ten markets pooled, before costs: discovery n 47,354, +0.307R (study 47,354, +0.307R);
  confirmation n 54,443, +0.193R (study 54,443, +0.193R); 0 trades where the exit walk differs from `exits()`: passed.
- Hours with no measured spread: none.

## Tests (after measured costs)

| Test | n 05-14 | net 05-14 (before) | n 15-26 | net 15-26 (t) | before 15-26 (t) | cost R | 2x cost 15-26 | Holm p | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| gold | 3,205 | +0.129 (+0.238) | 4,593 | -0.058 (-1.74) | +0.095 (2.82) | 0.153 | -0.212 | 1.000 | no |
| silver | 827 | -0.179 (+0.135) | 1,257 | -0.322 (-4.8) | +0.102 (2.11) | 0.424 | -0.746 | 1.000 | no |
| USD/JPY | 4,654 | -0.023 (+0.297) | 5,784 | -0.256 (-10.54) | +0.114 (4.85) | 0.370 | -0.625 | 1.000 | no |
| pooled | 8,686 | +0.018 (+0.260) | 11,634 | -0.185 (-9.56) | +0.105 (5.83) | 0.290 | -0.475 | 1.000 | no |

Month-sum t on calendar months (empty months 0). Pass = n >= 200 in 2015-26, net > 0 in both windows, month t >= 2 in 2015-26,
Holm-adjusted one-sided p < 0.05 over the 4 tests, net at 2 x the measured cost >= 0 in 2015-26.

## Control and sensitivity (reported, not judged)

| Test | mirror net 05-14 | mirror net 15-26 (t) | 90th pct spread net 05-14 | 90th pct net 15-26 (t) | 2015-19 net (n) | 2020-26 net (n) |
|---|---:|---:|---:|---:|---:|---:|
| gold | -0.133 | -0.196 (-6.91) | +0.117 | -0.075 (-2.24) | -0.171 (1,320) | -0.013 (3,273) |
| silver | -0.340 | -0.415 (-4.65) | -0.245 | -0.410 (-5.3) | -0.217 (110) | -0.332 (1,147) |
| USD/JPY | -0.453 | -0.415 (-16.2) | -0.510 | -0.729 (-19.08) | -0.194 (2,270) | -0.296 (3,514) |
| pooled | -0.324 | -0.328 (-15.64) | -0.254 | -0.436 (-17.01) | -0.186 (3,700) | -0.184 (7,934) |

Mirror = the same trade WITH the candle (its exit at the cell's 50 % distance), same measured cost.

## Markets without a measured spread (apart, not in the verdict)

| Market | n 05-14 / 15-26 | before 05-14 / 15-26 (t) | flat COSTS (price) | after flat 05-14 / 15-26 (t) | commission only 05-14 / 15-26 (t) |
|---|---:|---:|---:|---:|---:|
| eurusd | 5,598 / 6,232 | +0.240 / +0.253 (7.9) | 0.00006 | -0.051 / -0.159 (-4.89) | -0.052 / -0.094 (-2.89) |
| gbpusd | 6,271 / 6,454 | +0.375 / +0.244 (8.42) | 0.00008 | +0.042 / -0.163 (-5.6) | +0.058 / -0.059 (-2.03) |
| audusd | 5,164 / 6,054 | +0.364 / +0.215 (7.34) | 0.00006 | +0.047 / -0.222 (-7.6) | +0.151 / -0.017 (-0.6) |
| nzdusd | 5,115 / 5,489 | +0.391 / +0.246 (8.32) | 0.00007 | +0.021 / -0.247 (-8.36) | +0.212 / +0.039 (1.34) |
| usdcad | 5,979 / 6,630 | +0.425 / +0.181 (6.2) | 0.00007 | +0.033 / -0.258 (-8.72) | +0.156 / -0.193 (-6.51) |
| usdchf | 5,537 / 6,230 | +0.212 / +0.240 (8.07) | 0.00007 | -0.151 / -0.239 (-7.85) | -0.030 / -0.046 (-1.56) |
| eurjpy | 5,004 / 5,720 | +0.202 / +0.138 (5.06) | 0.01 | -0.152 / -0.279 (-10.09) | -0.006 / -0.124 (-4.53) |

Commission only is a floor no real spread is below, not a cost estimate. Flat COSTS are ASSUMED for nzdusd, usdcad, usdchf, eurjpy.

## Measured spread by UTC hour (median, share of price x 10^5)

| Hour | gold | silver | USD/JPY |
|---:|---:|---:|---:|
| 00 | 2.41 | 42.39 | 0.00 |
| 01 | 2.60 | 49.22 | 0.00 |
| 02 | 2.05 | 42.58 | 0.00 |
| 03 | 1.70 | 41.02 | 0.00 |
| 04 | 1.96 | 38.99 | 0.00 |
| 05 | 2.20 | 40.21 | 0.00 |
| 06 | 1.85 | 40.75 | 0.00 |
| 07 | 2.31 | 39.58 | 0.00 |
| 08 | 2.41 | 40.38 | 0.00 |
| 09 | 1.90 | 39.57 | 0.00 |
| 10 | 1.91 | 38.66 | 0.00 |
| 11 | 1.76 | 39.58 | 0.00 |
| 12 | 2.03 | 37.33 | 0.00 |
| 13 | 2.51 | 39.48 | 0.00 |
| 14 | 2.32 | 40.48 | 0.00 |
| 15 | 1.92 | 39.17 | 0.00 |
| 16 | 1.94 | 35.47 | 0.00 |
| 17 | 1.81 | 36.81 | 0.00 |
| 18 | 1.75 | 37.94 | 0.00 |
| 19 | 2.19 | 36.68 | 0.00 |
| 20 | 2.41 | 37.66 | 0.67 |
| 21 | 2.39 | 38.60 | 45.99 |
| 22 | 2.63 | 72.22 | 3.09 |
| 23 | 2.23 | 53.66 | 0.67 |

## What it means

Before costs the cell is positive on all three measured markets in 2015-26 (pooled +0.105R, month t 5.83).
At the broker's measured spread and commission it is not: the measured cost is 0.153R a trade on gold,
0.424R on silver and 0.370R on USD/JPY, more than the tilt everywhere. Gold is the
nearest (2015-26 -0.058R, t -1.74; 2020-26 -0.013R) and fails at 2 x cost (-0.212R).
On USD/JPY the quoted spread is about zero, so the cost is almost all commission: the cell's stop is a few pips and the
commission alone takes about a third of R. The same holds for the forex markets without a measured spread: commission
alone (no spread at all) leaves 6 of 7 negative in 2015-26. The desk's rule is a before-cost tilt, not an edge, on this account.

## Limits

- Spreads were measured on 2023-26 quotes and applied to 2005-26 as a share of price; earlier years' relative spreads are unknown
  (probably wider, so the discovery window is, if anything, charged too little).
- OANDA mid candles, not fills: `fade-tick-exec` found real fills about 0.02R a trade worse than mid on a similar fade, on top.
- The trade set keeps the study's skip of trades whose risk is under its flat round trip (`COSTS`): the cell as defined.
- These years were read by `big-candle-fade`, which chose the cell: a PASS would only be a hypothesis for a forward paper record.
