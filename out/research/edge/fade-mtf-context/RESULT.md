# Fade of the M15 break, split by the higher timeframes (result)

**Verdict: FAIL. 0 of 10 primary tests hold; the unsplit 2R fade made +0.042R a trade before costs in 2015-26 (n 201,769, month t 11.33); the strongest difference, h4 opposite minus h4 same, swing, +0.019R (Welch t 2.18; 2005-14 +0.007R, t 0.74).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

`grid7-wide-fade`'s M15 fade (every M15 structure break, entered AGAINST it at the next 5-minute open, stop 1 ATR(14) of M15,
exits 2R or the opposite M15 swing, time limit 1 day), split five ways by what the higher timeframes showed at the break's
close (closed candles only): the H1 and H4 last break (same direction as the M15 break / opposite), the H4 stage (phase.mjs's
move / pullback / range), whether the break is the first M15 one against a fresh H1 break, and whether its candle ran the prior
New York day's high (up) or low (down). Ten markets pooled, discovery 2005-14, confirmation 2015 to October 2026, before costs
on month sums; after costs beside (**ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).

## Primary tests (the level named first was expected higher: the break AGAINST the higher timeframe)

Difference of mean R a trade, trade-level Welch t; Holm over the 10 tests on the confirmation t. Mirror = the same split traded
WITH the break.

| Test | 2005-14 diff (t) | 2015-26 diff (t) | Holm | Holds | Mirror 2005-14 (t) | Mirror 2015-26 (t) |
|---|---:|---:|---:|---|---:|---:|
| h1 opposite minus h1 same, 2R | -0.007 (-1.06) | -0.012 (-1.83) | 1.00 | no | -0.018 (-2.72) | -0.009 (-1.39) |
| h4 opposite minus h4 same, 2R | -0.002 (-0.36) | +0.007 (1.15) | 1.00 | no | -0.019 (-2.79) | -0.014 (-2.15) |
| stage pullback minus stage move, 2R | +0.003 (0.33) | -0.005 (-0.60) | 1.00 | no | +0.009 (1.12) | +0.020 (2.63) |
| counter yes minus counter no, 2R | -0.012 (-1.39) | -0.015 (-1.89) | 1.00 | no | -0.026 (-3.18) | -0.008 (-1.04) |
| prior-day yes minus prior-day no, 2R | -0.014 (-1.82) | -0.008 (-1.13) | 1.00 | no | +0.027 (3.52) | +0.021 (2.90) |
| h1 opposite minus h1 same, swing | -0.009 (-1.00) | -0.019 (-2.20) | 1.00 | no | -0.026 (-2.94) | -0.014 (-1.75) |
| h4 opposite minus h4 same, swing | +0.007 (0.74) | +0.019 (2.18) | 0.15 | no | -0.024 (-2.66) | -0.030 (-3.64) |
| stage pullback minus stage move, swing | +0.001 (0.08) | -0.004 (-0.37) | 1.00 | no | +0.001 (0.05) | +0.027 (2.75) |
| counter yes minus counter no, swing | -0.012 (-1.10) | -0.032 (-3.09) | 1.00 | no | -0.037 (-3.51) | -0.011 (-1.10) |
| prior-day yes minus prior-day no, swing | -0.010 (-0.92) | -0.004 (-0.39) | 1.00 | no | +0.035 (3.33) | +0.028 (2.86) |

Held: none.

## Every cell

R a trade before costs (month-sum t), after costs beside; "vs control" = Welch t of the cell against the unsplit rule; a level
cell passes with n >= 300, mean > 0 and month t >= 2 in both windows, Holm < 0.05 over the 22 level cells, and vs control >= 2
in both windows.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | vs control 05-14 / 15-26 | Holm | Mirror R 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| control 2R | 171,523 | +0.054 (11.38) | -0.088 | 201,769 | +0.042 (11.33) | -0.118 | - | - | -0.057 (-14.88) | control |
| h1 same 2R | 90,394 | +0.058 (8.61) | -0.084 | 106,220 | +0.048 (8.58) | -0.111 | 0.59 / 1.02 | 0.000 | -0.053 (-9.16) | no |
| h1 opposite 2R | 81,129 | +0.050 (8.24) | -0.094 | 95,549 | +0.036 (6.12) | -0.127 | -0.63 / -1.09 | 0.000 | -0.062 (-11.06) | no |
| h4 same 2R | 85,995 | +0.055 (7.81) | -0.087 | 102,075 | +0.039 (6.67) | -0.122 | 0.21 / -0.66 | 0.000 | -0.051 (-8.69) | no |
| h4 opposite 2R | 85,521 | +0.053 (9.47) | -0.089 | 99,694 | +0.046 (8.77) | -0.114 | -0.20 / 0.67 | 0.000 | -0.064 (-12.59) | no |
| stage move 2R | 110,237 | +0.052 (9.25) | -0.093 | 131,179 | +0.043 (10.15) | -0.117 | -0.40 / 0.23 | 0.000 | -0.064 (-14.48) | no |
| stage pullback 2R | 42,793 | +0.055 (6.67) | -0.085 | 49,188 | +0.039 (5.44) | -0.120 | 0.06 / -0.47 | 0.000 | -0.044 (-6.07) | no |
| stage range 2R | 18,493 | +0.067 (6.55) | -0.066 | 21,402 | +0.043 (4.30) | -0.123 | 1.11 / 0.05 | 0.000 | -0.049 (-4.36) | no |
| counter yes 2R | 36,928 | +0.045 (6.12) | -0.092 | 43,170 | +0.031 (4.05) | -0.125 | -1.12 / -1.52 | 0.000 | -0.064 (-8.50) | no |
| counter no 2R | 134,595 | +0.057 (10.13) | -0.087 | 158,599 | +0.045 (10.71) | -0.116 | 0.48 / 0.65 | 0.000 | -0.056 (-12.49) | no |
| prior-day yes 2R | 43,214 | +0.043 (5.34) | -0.079 | 51,386 | +0.036 (4.97) | -0.106 | -1.40 / -0.87 | 0.000 | -0.042 (-5.25) | no |
| prior-day no 2R | 128,309 | +0.058 (10.78) | -0.092 | 150,383 | +0.044 (9.92) | -0.122 | 0.69 / 0.43 | 0.000 | -0.063 (-14.47) | no |
| control swing | 161,032 | +0.059 (9.45) | -0.084 | 186,577 | +0.040 (8.72) | -0.120 | - | - | -0.063 (-12.78) | control |
| h1 same swing | 85,325 | +0.063 (6.74) | -0.078 | 99,209 | +0.049 (7.06) | -0.109 | 0.55 / 1.20 | 0.000 | -0.056 (-7.22) | no |
| h1 opposite swing | 75,707 | +0.054 (6.31) | -0.090 | 87,368 | +0.030 (3.68) | -0.132 | -0.60 / -1.34 | 0.001 | -0.071 (-9.45) | no |
| h4 same swing | 80,804 | +0.055 (5.46) | -0.087 | 94,911 | +0.031 (4.31) | -0.130 | -0.42 / -1.24 | 0.000 | -0.048 (-6.43) | no |
| h4 opposite swing | 80,221 | +0.062 (7.92) | -0.080 | 91,666 | +0.050 (6.15) | -0.110 | 0.43 / 1.27 | 0.000 | -0.078 (-11.38) | no |
| stage move swing | 103,532 | +0.057 (7.73) | -0.088 | 121,332 | +0.041 (7.15) | -0.119 | -0.28 / 0.07 | 0.000 | -0.071 (-12.47) | no |
| stage pullback swing | 40,191 | +0.058 (6.13) | -0.082 | 45,506 | +0.037 (4.14) | -0.122 | -0.12 / -0.34 | 0.000 | -0.043 (-4.42) | no |
| stage range swing | 17,309 | +0.074 (5.42) | -0.058 | 19,739 | +0.045 (3.52) | -0.121 | 1.02 / 0.34 | 0.001 | -0.061 (-4.89) | no |
| counter yes swing | 34,082 | +0.049 (4.64) | -0.088 | 38,719 | +0.015 (1.47) | -0.140 | -0.89 / -2.52 | 0.072 | -0.072 (-6.99) | no |
| counter no swing | 126,950 | +0.061 (8.10) | -0.082 | 147,858 | +0.047 (9.29) | -0.114 | 0.36 / 1.01 | 0.000 | -0.061 (-10.93) | no |
| prior-day yes swing | 41,043 | +0.051 (4.12) | -0.071 | 48,444 | +0.038 (3.87) | -0.105 | -0.71 / -0.30 | 0.000 | -0.042 (-3.51) | no |
| prior-day no swing | 119,989 | +0.061 (8.95) | -0.088 | 138,133 | +0.041 (7.49) | -0.125 | 0.36 / 0.16 | 0.000 | -0.070 (-13.10) | no |

Cells passing the cell bar: none.

## Checks

- Cut test: 10 cuts: 198,733 signals (with their five labels) known by the cut dates, 0 missing or extra when the candles are cut there.
- H4 stage against `phase.mjs` `readPhase` (600-candle tails) on 800 sampled signals: the same stage on 800 (100 %); the rest differ because the tail starts the structure later.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost | unresolved |
|---|---|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 35,387 | 35,214 | 3 | 0 | 170 | 2 |
| xag | 2006-03-19 | 35,575 | 23,332 | 67 | 0 | 12,176 | 1 |
| eurusd | 2004-01-01 | 39,580 | 39,527 | 19 | 0 | 6 | 1 |
| gbpusd | 2004-01-01 | 39,311 | 39,228 | 49 | 0 | 6 | 2 |
| usdjpy | 2004-01-01 | 38,671 | 38,598 | 33 | 0 | 10 | 0 |
| audusd | 2004-01-01 | 40,108 | 40,046 | 29 | 0 | 6 | 0 |
| nzdusd | 2004-01-01 | 39,757 | 39,725 | 1 | 0 | 5 | 1 |
| usdcad | 2004-01-01 | 39,996 | 39,916 | 43 | 0 | 2 | 1 |
| usdchf | 2004-01-01 | 39,250 | 39,175 | 41 | 0 | 3 | 1 |
| eurjpy | 2004-01-01 | 38,581 | 38,542 | 2 | 0 | 4 | 2 |

## What it means

None of the pre-registered differences holds in both decades: reading the higher timeframes' structure at the break does
not pick the fades that work better. The unsplit tilt stays a before-cost figure that the spread takes. Nothing adopted;
do not re-test variants of these splits on these years.
