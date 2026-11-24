# Equal highs / lows taken by one H1 candle, entered on an M5 break back (result)

**Verdict: FAIL. 0 of 6 cells pass; best pool 3R all: +0.063R a trade after costs in 2015-26 (n 1,056, month t 1.41; +0.100R before), -0.076R in 2005-14 (n 899, t -1.69).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed,
nothing is proposed. One run, no variants.

## What was run

An H1 candle trades through two or more equal, untouched H1 swing lows / highs (the detector of
`research/edge/ict-equal-lows/eq.mjs`: 3 candles a side, last 96 candles, within 0.1 x the daily ATR, 4+ candles apart),
judged on the part of the hour seen so far. In that hour or the next, the first 5-minute candle that closes back through the
last 5-minute swing (3 a side) made before the extreme, and back past the deepest swept level, is the signal: market at the
next 5-minute open against the sweep, stop past the extreme by 0.1 x the H1 ATR(14), target 2R or 3R, out after one day.
Gold and four forex majors pooled, OANDA mid 5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October
2026. Judged AFTER costs (the demo account's round trips) on calendar-month sums. Control = exactly one swing taken the
same way.

## The bar, cell by cell

- n >= 300 in both windows: 4 of 6.
- Mean R after costs > 0 and month t >= 2 in discovery: 0; in confirmation: 0; both: 0.
- Holm-adjusted p < 0.05: 0.
- **All three: 0.**

## Every cell

R a trade before costs ("gross") and after costs ("net", with its month-sum t); "ctrl" = the same cell on single-swing
events, after costs; W = Welch t of pool minus control, after costs, trade by trade.

### Discovery 2005-14

| Cell | n | win | gross R (t) | cost R | net R (t) | ctrl n | ctrl net R (t) | W |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| pool 2R all | 899 | 37.9 % | -0.007 (-0.17) | 0.04 | -0.044 (-1.08) | 5,418 | -0.017 (-1.02) | -0.58 |
| pool 2R london | 253 | 36.4 % | -0.073 (-1.01) | 0.04 | -0.109 (-1.51) | 1,605 | +0.062 (1.73) | -1.99 |
| pool 2R ny | 312 | 43.3 % | +0.076 (1.11) | 0.03 | +0.045 (0.67) | 1,549 | -0.002 (-0.05) | 0.65 |
| pool 3R all | 899 | 34.5 % | -0.039 (-0.87) | 0.04 | -0.076 (-1.69) | 5,418 | -0.029 (-1.41) | -0.94 |
| pool 3R london | 253 | 34.4 % | -0.037 (-0.42) | 0.04 | -0.073 (-0.84) | 1,605 | +0.070 (1.58) | -1.45 |
| pool 3R ny | 312 | 41.0 % | +0.042 (0.59) | 0.03 | +0.011 (0.16) | 1,549 | -0.032 (-0.78) | 0.55 |

### Confirmation 2015-26

| Cell | n | win | gross R (t) | cost R | net R (t) | ctrl n | ctrl net R (t) | W | Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| pool 2R all | 1,056 | 41.2 % | +0.058 (1.53) | 0.04 | +0.021 (0.57) | 7,087 | -0.053 (-3.38) | 1.78 | 1.000 | no |
| pool 2R london | 265 | 35.5 % | -0.068 (-0.84) | 0.04 | -0.109 (-1.34) | 1,894 | -0.020 (-0.65) | -1.05 | 1.000 | no |
| pool 2R ny | 432 | 41.9 % | +0.000 (0.01) | 0.03 | -0.029 (-0.49) | 2,132 | -0.072 (-2.60) | 0.71 | 1.000 | no |
| pool 3R all | 1,056 | 38.6 % | +0.100 (2.22) | 0.04 | +0.063 (1.41) | 7,087 | -0.048 (-2.75) | 2.30 | 0.478 | no |
| pool 3R london | 265 | 34.0 % | +0.024 (0.25) | 0.04 | -0.017 (-0.17) | 1,894 | +0.014 (0.38) | -0.30 | 1.000 | no |
| pool 3R ny | 432 | 40.1 % | +0.020 (0.30) | 0.03 | -0.010 (-0.14) | 2,132 | -0.095 (-3.20) | 1.25 | 1.000 | no |

## Per market, all hours

After costs (before costs in brackets), pool events; "ctrl" = single-swing events after costs.

### pool 2R all

| Market | n 05-14 | net R (t) [gross] | ctrl net 05-14 | n 15-26 | net R (t) [gross] | ctrl net 15-26 |
|---|---:|---:|---:|---:|---:|---:|
| xau | 167 | -0.039 (-0.40) [+0.032] | -0.082 | 210 | -0.047 (-0.60) [+0.002] | -0.064 |
| eurusd | 215 | -0.087 (-1.03) [-0.064] | +0.056 | 206 | +0.029 (0.29) [+0.059] | -0.012 |
| gbpusd | 186 | +0.008 (0.08) [+0.033] | -0.039 | 227 | +0.008 (0.11) [+0.037] | -0.049 |
| usdjpy | 169 | +0.082 (0.83) [+0.126] | -0.046 | 201 | +0.072 (0.77) [+0.109] | -0.021 |
| audusd | 162 | -0.182 (-2.22) [-0.155] | +0.006 | 212 | +0.049 (0.59) [+0.086] | -0.116 |

### pool 3R all

| Market | n 05-14 | net R (t) [gross] | ctrl net 05-14 | n 15-26 | net R (t) [gross] | ctrl net 15-26 |
|---|---:|---:|---:|---:|---:|---:|
| xau | 167 | -0.017 (-0.17) [+0.054] | -0.111 | 210 | -0.021 (-0.23) [+0.028] | -0.044 |
| eurusd | 215 | -0.224 (-2.70) [-0.201] | +0.027 | 206 | +0.088 (0.73) [+0.118] | -0.018 |
| gbpusd | 186 | +0.063 (0.56) [+0.089] | -0.031 | 227 | +0.007 (0.08) [+0.037] | -0.055 |
| usdjpy | 169 | -0.043 (-0.41) [+0.001] | -0.045 | 201 | +0.173 (1.51) [+0.209] | +0.013 |
| audusd | 162 | -0.134 (-1.40) [-0.107] | -0.002 | 212 | +0.080 (0.88) [+0.117] | -0.132 |

## Checks

- Cut test: 10 cuts on xau, eurusd: 15,080 events known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).
- Reading of the pre-registration, fixed in the code before the run: when the first confirming candle finds two or more swept swings that are not an equal pool, that hour and side give no event (the walk stops).

| Market | candles from | events | pool trades | single trades | dropped (bad data) | past the stop | risk under cost | unresolved |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 2,652 | 377 | 2,269 | 0 | 5 | 1 | 0 |
| eurusd | 2005-01-02 | 3,171 | 421 | 2,732 | 5 | 13 | 0 | 0 |
| gbpusd | 2005-01-02 | 3,078 | 413 | 2,655 | 2 | 8 | 0 | 0 |
| usdjpy | 2005-01-02 | 2,713 | 370 | 2,339 | 2 | 2 | 0 | 0 |
| audusd | 2005-01-02 | 2,895 | 374 | 2,510 | 2 | 8 | 0 | 1 |

## What it means

No cell clears the bar. All hours pooled, the 2R cell makes +0.058R a trade before costs and +0.021R after in 2015-26
(n 1,056, month t 0.57; 2005-14 -0.007R before, -0.044R after), the 3R cell +0.100R before and +0.063R after
(month t 1.41). The stop sits just past a 5-minute extreme, so the round trip costs about 0.04R a trade.
A pool of equal swings does no better than a single swing taken the same way (0 of 6 cells with Welch t >= 2 in both windows).
Waiting for the 5-minute break back does not turn the sweep of equal highs / lows into a rule that pays after costs on
these five markets. Do not re-test variants of these cells on these years. Nothing live changed; no rule is proposed.
