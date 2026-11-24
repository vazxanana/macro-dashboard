# FVG return on H4 and D1 with larger targets and a time exit (result)

**Verdict: FAIL. 0 of 6 pass after costs; the best, T4 (D1 large 2R), made +0.045R a trade after costs in 2015-26 (n 2,916, month t 1.62; +0.074R before costs), +0.003R in 2005-14**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants. Never call any figure below an edge.

## What was run

grid7-fvg-wide's own code, imported and not edited: the three-candle gap (`gapZones` via `bandsOf`), its random control
bands, its market entry (`eventsOf` kind 0: the first M15 close inside the gap, market at the next 5-minute open, stop past
the far side + 0.1 ATR). New here: gaps on **D1** (`edgekit` `dailyNY`, 17:00 New York days) beside H4, and the exits 3R and
**time** (no target: the original stop or the close at the time limit; `dom-trade-through` `manage` slot 8). Time limits:
H4 5 days, D1 20 days. Large gaps only (height / ATR over the market's 2005-14 median). Ten markets pooled, OANDA mid
5-minute candles; discovery = fills 2005-2014 (120 months), confirmation = 2015 to October 2026 (142 months). Judged AFTER
costs (combo-grid-2 `COSTS`; demo figures for gold and the four majors, **ASSUMED, not measured** for xag, nzdusd, usdcad,
usdchf, eurjpy), month sums of net R, Holm over six one-sided p.

**Gate passed**: T1 before costs reproduces grid7's `4h mkt large 2R` exactly (n 13,897 / 16,891; +0.069R / +0.053R).
It did so only after the candle cache's sparse 2004 forex rows (about 312 candles a market, the cache grid7 read) were
restored in a private copy of the cache: today's shared cache starts forex in 2005, which moved the gap medians a little
and the counts by under 1 % (first run: n 13,825 / 16,899). No code changed between the two runs.
**No look-ahead**: the cut test (signals known by five dates, computed on candles cut there) gives 0 missing / 0 extra on
xau and eurusd, both timeframes.

## The six tests (after costs; before costs beside)

| Test | n 05-14 | net 05-14 (month t) | n 15-26 | gross 15-26 (t) | net 15-26 (t) | control net 15-26 | vs control (Welch t) | Holm p | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| T1 H4 large 2R | 13,897 | +0.005 (0.39) | 16,891 | +0.053 (4.15) | -0.021 (-1.63) | -0.056 | 2.25 | 1.000 | no |
| T2 H4 large 3R | 13,897 | +0.015 (0.94) | 16,891 | +0.065 (4.10) | -0.009 (-0.55) | -0.043 | 1.83 | 1.000 | no |
| T3 H4 large time | 13,897 | +0.015 (0.43) | 16,891 | +0.098 (2.81) | +0.024 (0.69) | -0.010 | 0.97 | 0.771 | no |
| T4 D1 large 2R | 2,557 | +0.003 (0.10) | 2,916 | +0.074 (2.65) | +0.045 (1.62) | -0.014 | 1.58 | 0.321 | no |
| T5 D1 large 3R | 2,557 | -0.013 (-0.33) | 2,916 | +0.078 (2.27) | +0.050 (1.44) | -0.004 | 1.19 | 0.379 | no |
| T6 D1 large time | 2,557 | +0.026 (0.40) | 2,916 | +0.077 (1.37) | +0.049 (0.87) | -0.043 | 1.38 | 0.771 | no |

Bar checks: n >= 200 in both windows: 6 of 6. Positive after costs in both windows: 3 (T3, T4, T6). Confirmation month t
>= 2 after costs: 0 (best 1.62). Holm p < 0.05: 0. Beats its control (Welch t >= 2): 1 (T1, which loses after costs).

## Reading

- Going up in timeframe and target does what the arithmetic says: the cost in R falls (H4 1R -0.074R net on all gaps,
  H4 large 3R -0.009R, D1 large +0.05R), but what is left after costs is small and noisy. No test reaches a month t of 2
  after costs, and none is positive at t >= 1 in the 2005-14 window (largest 0.94).
- D1 is thin: about 250 trades a year across ten markets, so +0.045R a trade is about +11R a year with month t 1.62. The
  D1 cells are positive before costs in 2015-26 (t 1.4-2.7) but near zero in 2005-14 (+0.012R to +0.051R gross).
- D1 large 2R by market, 2015-26 after costs: xau +0.152R (n 312, t 1.93), audusd +0.123R, nzdusd +0.119R; xag -0.070R,
  eurjpy -0.060R, usdchf -0.030R. Picked after the fact; not a rule.
- Buys did better than sells on D1 (large 2R, 2015-26 net: buys +0.074R, sells +0.016R), as with most gold / dollar-down
  stretches; reported only.
- A before-cost tilt is not an edge. The H4 large gaps are positive before costs in both windows (t 4.1-4.2 in 2015-26)
  and beat their random bands on 1R / 2R, so the gap return is real before costs; after costs it is about zero.

## Reported only (pooled, after costs, month t; result.json `grid`)

| Cell | net 05-14 (t) | net 15-26 (t) |
|---|---:|---:|
| H4 large 4R | +0.008 (0.43) | -0.009 (-0.48) |
| H4 large 6R | -0.003 (-0.14) | +0.008 (0.35) |
| H4 large trail | +0.001 (0.07) | -0.029 (-2.65) |
| H4 all 2R | -0.045 (-3.85) | -0.059 (-5.63) |
| D1 large 1R | +0.017 (0.85) | +0.034 (1.54) |
| D1 large 4R | -0.007 (-0.16) | +0.061 (1.62) |
| D1 large trail | +0.018 (0.66) | +0.049 (1.90) |
| D1 all 2R | -0.020 (-0.86) | -0.004 (-0.18) |

None of these was a test; reading the best of them now would be picking after the fact.

## To repeat

`EDGE_DATA=<cache> node research/edge/fvg-htf-exits/run.mjs market <m> <dir>` for the ten markets (the cache must hold
the forex 2004 rows: `_lib/fetch-cache.mjs <m> 5m 2004 2004`), `… cut xau <dir>`, `… cut eurusd <dir>`, then
`node research/edge/fvg-htf-exits/run.mjs report <dir>`. About 10 s a market. Test: `tests/fvg-htf-exits.test.mjs`.
