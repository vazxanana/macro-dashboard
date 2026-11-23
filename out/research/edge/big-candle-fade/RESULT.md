# Big-candle fade: an outsized candle rather than a break? (result)

**Verdict: PASS. 2 of 36 big-candle fade cells pass before costs and beat the plain fade; best m15 k1.5 nobreak half, +0.193R a trade in 2015-26 (n 54,443, month t 17.68; discovery +0.307R, t 20.56), -0.246R after costs.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

A closed M15 or H1 candle whose body is over k x ATR(14) of the 14 candles before it (k 1.5, 2, 3), FADED: market entry against
it at the next 5-minute open, stop past its extreme + 0.1 ATR, exit at 1R, 2R or back to its 50 % ("half", only when 1R or
more away), time limit 1 day (M15) / 2 days (H1). Split by whether the candle is also a structure break the same way
(`edgekit` `structure`, 3 candles a side) or not. 36 cells. Ten markets pooled, OANDA mid 5-minute candles. Discovery = fills
2005-2014, confirmation = 2015 to October 2026. Judged before costs on month sums, Holm over the 36 confirmation tests, and
against `grid7-wide-fade`'s plain fade of every structure break on the same timeframe and exit (Welch t per trade >= 2 in both
windows).
Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 36 of 36.
- Mean R > 0 and month t >= 2 in discovery: 15; in confirmation: 9; both: 9.
- Holm-adjusted p < 0.05: 8.
- Beats the plain fade (Welch t >= 2 in both windows): 2.
- **All five: 2 (m15 k1.5 nobreak half; m15 k2 nobreak half).**
- Of those, positive after costs in both windows: 0.

## The plain fade (the comparison, every structure break)

| Rule | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 |
|---|---:|---:|---:|---:|---:|---:|
| m15 plain fade 1R | 145,032 | -0.030 (-8.39) | -0.348 | 164,560 | -0.053 (-14.50) | -0.443 |
| m15 plain fade 2R | 145,032 | +0.094 (19.57) | -0.225 | 164,560 | +0.054 (12.17) | -0.335 |
| m15 plain fade half | 80,800 | +0.235 (23.30) | -0.161 | 93,782 | +0.132 (16.91) | -0.346 |
| h1 plain fade 1R | 43,062 | +0.035 (5.63) | -0.155 | 50,179 | -0.009 (-1.59) | -0.238 |
| h1 plain fade 2R | 43,062 | +0.105 (12.31) | -0.084 | 50,179 | +0.040 (5.18) | -0.189 |
| h1 plain fade half | 25,338 | +0.205 (12.91) | -0.030 | 30,622 | +0.078 (5.44) | -0.205 |

## Every cell

R a trade before costs (month-sum t), after costs beside; "cost R" = mean round-trip cost / risk in 2015-26; "vs plain" = Welch t
of the cell against the plain fade, discovery / confirmation; mirror = the same cell traded WITH the candle.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Holm | vs plain | Mirror R 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| m15 k1.5 break 1R | 39,077 | -0.094 (-15.15) | -0.407 | 39,631 | -0.113 (-16.60) | -0.485 | 0.371 | 1.000 | -11.10 / -9.91 | -0.215 (-28.55) | no |
| m15 k1.5 break 2R | 39,077 | +0.042 (4.95) | -0.272 | 39,631 | +0.010 (1.17) | -0.361 | 0.371 | 1.000 | -6.31 / -5.27 | -0.120 (-13.26) | no |
| m15 k1.5 break half | 30,328 | +0.245 (15.83) | -0.112 | 31,600 | +0.141 (10.56) | -0.282 | 0.423 | 0.000 | 0.65 / 0.66 | -0.046 (-3.33) | no |
| m15 k1.5 nobreak 1R | 62,039 | -0.060 (-10.29) | -0.382 | 68,283 | -0.105 (-19.18) | -0.492 | 0.387 | 1.000 | -5.91 / -11.36 | -0.228 (-38.62) | no |
| m15 k1.5 nobreak 2R | 62,039 | +0.093 (12.15) | -0.229 | 68,283 | +0.039 (5.52) | -0.347 | 0.387 | 0.000 | -0.15 / -2.26 | -0.126 (-18.76) | no |
| m15 k1.5 nobreak half | 47,354 | +0.307 (20.56) | -0.061 | 54,443 | +0.193 (17.68) | -0.246 | 0.439 | 0.000 | 5.71 / 5.55 | -0.052 (-4.98) | yes |
| m15 k2 break 1R | 20,790 | -0.116 (-13.58) | -0.420 | 21,065 | -0.138 (-14.56) | -0.486 | 0.348 | 1.000 | -11.49 / -10.03 | -0.208 (-20.87) | no |
| m15 k2 break 2R | 20,790 | +0.019 (1.70) | -0.284 | 21,065 | -0.013 (-1.06) | -0.361 | 0.348 | 1.000 | -6.99 / -6.03 | -0.108 (-8.40) | no |
| m15 k2 break half | 16,720 | +0.218 (10.50) | -0.124 | 17,150 | +0.112 (6.00) | -0.281 | 0.394 | 0.000 | -0.87 / -1.01 | -0.025 (-1.24) | no |
| m15 k2 nobreak 1R | 23,052 | -0.079 (-8.58) | -0.386 | 24,498 | -0.112 (-14.17) | -0.476 | 0.364 | 1.000 | -6.09 / -8.52 | -0.243 (-28.28) | no |
| m15 k2 nobreak 2R | 23,052 | +0.074 (5.92) | -0.233 | 24,498 | +0.035 (3.33) | -0.329 | 0.364 | 0.016 | -1.82 / -1.97 | -0.142 (-12.74) | no |
| m15 k2 nobreak half | 18,078 | +0.294 (13.30) | -0.055 | 19,982 | +0.219 (10.93) | -0.193 | 0.412 | 0.000 | 2.98 / 4.90 | -0.045 (-2.61) | yes |
| m15 k3 break 1R | 6,899 | -0.165 (-11.24) | -0.440 | 7,512 | -0.147 (-7.70) | -0.442 | 0.296 | 1.000 | -11.01 / -5.61 | -0.202 (-11.18) | no |
| m15 k3 break 2R | 6,899 | -0.049 (-2.75) | -0.324 | 7,512 | -0.026 (-1.08) | -0.322 | 0.296 | 1.000 | -8.28 / -3.96 | -0.099 (-4.33) | no |
| m15 k3 break half | 5,717 | +0.143 (4.16) | -0.164 | 6,134 | +0.088 (2.26) | -0.249 | 0.337 | 0.358 | -2.69 / -1.22 | +0.017 (0.43) | no |
| m15 k3 nobreak 1R | 5,153 | -0.107 (-7.19) | -0.385 | 5,056 | -0.137 (-9.10) | -0.446 | 0.309 | 1.000 | -5.31 / -5.88 | -0.230 (-13.98) | no |
| m15 k3 nobreak 2R | 5,153 | +0.034 (1.51) | -0.244 | 5,056 | +0.013 (0.56) | -0.297 | 0.309 | 1.000 | -2.89 / -2.05 | -0.127 (-5.75) | no |
| m15 k3 nobreak half | 4,058 | +0.234 (4.86) | -0.081 | 4,151 | +0.213 (4.24) | -0.139 | 0.352 | 0.001 | -0.03 / 1.86 | +0.009 (0.22) | no |
| h1 k1.5 break 1R | 13,825 | -0.032 (-2.84) | -0.218 | 14,643 | -0.058 (-5.37) | -0.279 | 0.221 | 1.000 | -6.74 / -5.22 | -0.108 (-10.16) | no |
| h1 k1.5 break 2R | 13,825 | +0.039 (2.60) | -0.148 | 14,643 | +0.004 (0.27) | -0.217 | 0.221 | 1.000 | -4.73 / -2.72 | -0.032 (-2.29) | no |
| h1 k1.5 break half | 10,900 | +0.157 (5.75) | -0.052 | 11,952 | +0.035 (1.35) | -0.214 | 0.249 | 1.000 | -1.84 / -1.89 | +0.025 (1.03) | no |
| h1 k1.5 nobreak 1R | 20,182 | -0.008 (-0.99) | -0.212 | 22,490 | -0.064 (-7.69) | -0.297 | 0.232 | 1.000 | -5.01 / -6.87 | -0.101 (-11.96) | no |
| h1 k1.5 nobreak 2R | 20,182 | +0.067 (5.56) | -0.136 | 22,490 | +0.008 (0.64) | -0.225 | 0.232 | 1.000 | -3.13 / -2.87 | -0.030 (-2.58) | no |
| h1 k1.5 nobreak half | 15,349 | +0.189 (8.52) | -0.043 | 18,425 | +0.070 (3.68) | -0.190 | 0.260 | 0.005 | -0.73 / -0.40 | -0.006 (-0.33) | no |
| h1 k2 break 1R | 7,988 | -0.057 (-4.19) | -0.242 | 8,202 | -0.072 (-4.86) | -0.282 | 0.210 | 1.000 | -7.52 / -5.29 | -0.110 (-7.54) | no |
| h1 k2 break 2R | 7,988 | +0.006 (0.33) | -0.179 | 8,202 | -0.006 (-0.32) | -0.217 | 0.210 | 1.000 | -5.74 / -2.78 | -0.032 (-1.67) | no |
| h1 k2 break half | 6,602 | +0.133 (3.47) | -0.071 | 6,894 | +0.006 (0.19) | -0.227 | 0.234 | 1.000 | -2.14 / -2.41 | +0.046 (1.26) | no |
| h1 k2 nobreak 1R | 8,432 | -0.042 (-3.40) | -0.246 | 8,588 | -0.083 (-6.02) | -0.305 | 0.222 | 1.000 | -6.36 / -6.36 | -0.096 (-7.02) | no |
| h1 k2 nobreak 2R | 8,432 | +0.027 (1.52) | -0.177 | 8,588 | -0.008 (-0.40) | -0.230 | 0.222 | 1.000 | -4.55 / -2.94 | -0.005 (-0.28) | no |
| h1 k2 nobreak half | 6,603 | +0.122 (3.50) | -0.107 | 7,256 | +0.057 (1.73) | -0.189 | 0.246 | 1.000 | -2.56 / -0.69 | +0.044 (1.41) | no |
| h1 k3 break 1R | 2,934 | -0.087 (-3.71) | -0.271 | 3,057 | -0.108 (-4.27) | -0.297 | 0.189 | 1.000 | -6.44 / -5.35 | -0.100 (-4.03) | no |
| h1 k3 break 2R | 2,934 | -0.032 (-0.96) | -0.215 | 3,057 | -0.043 (-1.26) | -0.232 | 0.189 | 1.000 | -5.15 / -3.24 | +0.002 (0.05) | no |
| h1 k3 break half | 2,521 | +0.096 (1.35) | -0.102 | 2,666 | -0.024 (-0.36) | -0.233 | 0.208 | 1.000 | -1.89 / -2.01 | +0.113 (1.73) | no |
| h1 k3 nobreak 1R | 2,182 | -0.049 (-1.98) | -0.262 | 1,766 | -0.139 (-4.88) | -0.336 | 0.197 | 1.000 | -3.82 / -5.44 | -0.041 (-1.36) | no |
| h1 k3 nobreak 2R | 2,182 | +0.031 (0.86) | -0.181 | 1,766 | -0.051 (-1.32) | -0.248 | 0.197 | 1.000 | -2.33 / -2.73 | +0.069 (1.60) | no |
| h1 k3 nobreak half | 1,671 | +0.029 (0.45) | -0.213 | 1,512 | +0.089 (1.04) | -0.130 | 0.218 | 1.000 | -2.95 / 0.15 | +0.119 (1.83) | no |

## Per market, passing cells

Before costs (after costs in brackets); * = cost ASSUMED.

### m15 k1.5 nobreak half

| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] | cost R 15-26 |
|---|---:|---:|---:|---:|---:|
| xau | 3,205 | +0.238 (6.29) [-0.288] | 4,593 | +0.095 (2.82) [-0.348] | 0.444 |
| xag* | 827 | +0.135 (2.33) [-0.519] | 1,257 | +0.102 (2.11) [-0.480] | 0.583 |
| eurusd | 5,598 | +0.240 (8.21) [-0.051] | 6,232 | +0.253 (7.90) [-0.159] | 0.412 |
| gbpusd | 6,271 | +0.375 (11.94) [+0.042] | 6,454 | +0.244 (8.42) [-0.163] | 0.406 |
| usdjpy | 4,654 | +0.297 (8.81) [-0.104] | 5,784 | +0.114 (4.85) [-0.287] | 0.401 |
| audusd | 5,164 | +0.364 (9.61) [+0.047] | 6,054 | +0.215 (7.34) [-0.222] | 0.437 |
| nzdusd* | 5,115 | +0.391 (9.92) [+0.021] | 5,489 | +0.246 (8.32) [-0.247] | 0.493 |
| usdcad* | 5,979 | +0.425 (13.56) [+0.033] | 6,630 | +0.181 (6.20) [-0.258] | 0.439 |
| usdchf* | 5,537 | +0.212 (6.67) [-0.151] | 6,230 | +0.240 (8.07) [-0.239] | 0.480 |
| eurjpy* | 5,004 | +0.202 (6.41) [-0.152] | 5,720 | +0.138 (5.06) [-0.279] | 0.417 |

### m15 k2 nobreak half

| Market | n 05-14 | R (t) [net] | n 15-26 | R (t) [net] | cost R 15-26 |
|---|---:|---:|---:|---:|---:|
| xau | 1,389 | +0.241 (4.52) [-0.244] | 1,822 | +0.088 (1.46) [-0.321] | 0.408 |
| xag* | 460 | +0.183 (2.17) [-0.445] | 643 | +0.183 (2.19) [-0.399] | 0.582 |
| eurusd | 2,161 | +0.207 (3.17) [-0.064] | 2,322 | +0.322 (5.52) [-0.062] | 0.384 |
| gbpusd | 2,527 | +0.411 (8.04) [+0.096] | 2,415 | +0.300 (6.08) [-0.087] | 0.387 |
| usdjpy | 1,753 | +0.208 (3.71) [-0.162] | 2,177 | +0.128 (2.76) [-0.242] | 0.370 |
| audusd | 1,748 | +0.387 (5.84) [+0.095] | 2,062 | +0.200 (3.53) [-0.205] | 0.405 |
| nzdusd* | 1,743 | +0.392 (5.75) [+0.044] | 1,840 | +0.218 (3.95) [-0.232] | 0.450 |
| usdcad* | 2,253 | +0.461 (7.47) [+0.089] | 2,248 | +0.207 (4.38) [-0.211] | 0.418 |
| usdchf* | 2,250 | +0.181 (3.56) [-0.154] | 2,401 | +0.348 (7.32) [-0.104] | 0.452 |
| eurjpy* | 1,794 | +0.130 (2.55) [-0.199] | 2,052 | +0.111 (2.05) [-0.272] | 0.383 |

## Checks

- Cut test: 10 cuts on xau, eurusd: 191,636 big-candle signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.
- The ATR that sizes a candle is taken on the 14 candles before it; the candle is known only at its close; the fill is the next 5-minute open.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | big signals | big simulated | plain signals | plain simulated | dropped (bad data) |
|---|---|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 33,143 | 25,274 | 44,349 | 34,274 | 4 |
| xag | 2006-03-19 | 37,107 | 11,638 | 44,574 | 13,073 | 145 |
| eurusd | 2004-01-01 | 36,255 | 33,255 | 49,724 | 46,065 | 49 |
| gbpusd | 2004-01-01 | 37,720 | 34,251 | 49,435 | 45,346 | 94 |
| usdjpy | 2004-01-01 | 32,396 | 28,815 | 48,700 | 43,741 | 60 |
| audusd | 2004-01-01 | 31,937 | 28,320 | 50,388 | 45,636 | 60 |
| nzdusd | 2004-01-01 | 31,293 | 26,599 | 49,832 | 43,657 | 1 |
| usdcad | 2004-01-01 | 37,443 | 32,266 | 50,174 | 44,252 | 86 |
| usdchf | 2004-01-01 | 37,881 | 31,944 | 49,243 | 42,034 | 95 |
| eurjpy | 2004-01-01 | 30,464 | 27,808 | 48,668 | 44,755 | 3 |

## What it means

2 cells clear the bar before costs in both decades and beat the plain fade. None stays positive after costs in both windows.
A before-cost tilt, not an edge: nothing is adopted; a forward record or any live change needs the owner. One run, no variants on these years.

**Size, not the break.** Both passing cells are M15 candles that are NOT a structure break, with the "back to the 50 %" exit:
among big candles the ones that break structure fade no better than the plain fade (their Welch t is near zero or negative in
every cell), and the ones that do not break fade better. So the fade's tilt follows an outsized candle giving part of itself
back more than it follows the break. On H1 nothing passes, and the 1R / 2R exits lose to the plain fade everywhere: the tilt is
in the retracement toward the candle's middle, which is far (often several R) from a stop just past the candle's extreme.

**How far from tradable.** The passing cells pay about 0.35-0.44R a trade in costs on these small stops and are negative
after costs in both windows (see "net" and "cost R"); the tilt is smaller than one bid / ask. Cautions: trades overlap freely
(no one-at-a-time), so the per-trade Welch t overstates independence; the big candles that are breaks are also inside the plain
fade; the costs of five markets are assumed. The plain fade's 1R and 2R rows reproduce `grid7-wide-fade`'s cells exactly.
