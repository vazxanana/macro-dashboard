# The market cycle read three ways at once: H1 ChoCh, H4 stage, the Daily MSNR call, the Mosha CF (result)

**Verdict: FAIL. 0 of 48 cells passed (placebo 0); the best confirmation cell made +0.019R a trade before costs in 2015-26 (n 2,729, month t 0.68), and the all-aligned cell had n 101 (2R +0.107R, month t 0.81).**

Run 23 Nov 2026 exactly as `PREREGISTRATION.md` (committed alone first). Research only: nothing live changed, no rule is
proposed. Not an edge: no cell has a month-sum t of 2 in both windows, and none beats "every H1 ChoCh" by a Welch t of 2.

## What was tested

Every H1 change of character (edgekit `structure(H1, 3)`, a close beyond the last confirmed 3-a-side H1 swing against the
side H1 held), on ten markets (xau xag eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy; OANDA mid 5m; gold and silver
from 2006, the rest from 2005), traded in its direction at market at the next 5-minute open, stop past the ChoCh's swing by
0.1 x ATR(14) of H1, exits 1R / 2R / the H4 leg's extreme (only when 1R or more away), out after 5 days. Each ChoCh carries
four readings made from candles closed at its close:

- **(a) H4 cycle position** (phase.mjs's rules on whole-series events): pullback end (H4 in a pullback, the ChoCh turns H1
  back with H4), pullback start (H4 in its move, the ChoCh starts a pullback), other with H4, other against H4.
- **(b) Daily MSNR call** (`direction()` through `h4Calls`): agrees with the ChoCh or not.
- **(c) Mosha CF of an H4 BO** (`grid5-mosha-cycle` `storylines` H4 > H1, the page's structure engine): the CF's break candle
  is this very H1 candle, same side.
- **(d) H4 pullback depth** at the ChoCh: past or under 50 % of the H4 leg.

17 combinations x 3 exits = 51 cells (48 judged, 3 control). Discovery 2005-2014 (120 months), confirmation 2015 to Oct 2026
(142 months). Bar (before costs): n >= 300 in each window, mean R > 0 and month-sum t >= 2 in both, Holm p <= 0.05 over the
48 confirmation tests, and Welch t >= 2 against every H1 ChoCh (same exit) in both windows.

## Counts and checks

- 49,431 ChoChs, 48,942 simulated trades; 351 dropped for a bad-data interval, 3 not built (the next open had already gone
  past the stop), 12 unfinished at the end of the data.
- Positions (a), 2005 to Oct 2026: pullback start 19,097, pullback end 12,172, other against 10,917, other with 7,122.
  Mosha CF matches: 1,127 in all (the two structure engines often disagree on which side H4 is on, so some CFs fall in the
  "against" rows, where (c) is not split, as pre-registered); 209 in the all-aligned cell.
- Cut test: 51,861 signals (200 cuts, 2011-2012, ten markets) known by a cut equal the ones computed on candles cut there:
  0 mismatches. Every simulated trade has its stop on the losing side (gate).
- (a) against `phase.mjs` `readPhase` itself on the first 60 ChoChs of each market: 585 of 600 agree (the rest differ
  because readPhase reads a 600-candle tail; reported, not judged).
- 28 of the 48 judged cells reach n >= 300 in both windows (not INCONCLUSIVE).

## Findings

- **Nothing passes.** The best confirmation cell, pullback end · MSNR agrees · not a CF · past 50 % · 2R, made +0.076R a trade
  in 2005-14 (n 2,373, month t 2.12) and +0.019R in 2015-26 (n 2,729, t 0.68); against the control Welch t 2.05 / 1.13.
  The one discovery t over 2 did not repeat.
- **The all-aligned cell** (pullback end, MSNR agrees, Mosha CF, past 50 %): about 100 trades a window. 2015-26: 1R −0.013R
  (n 101), 2R +0.107R (n 101, t 0.81), ext +0.105R (n 48, t 0.62); 2005-14: +0.062R, +0.045R, +0.022R. Too few to judge and
  no better than every ChoCh (Welch t 0.03-0.90).
- **The control itself**: every H1 ChoCh made +0.003R / +0.016R / +0.012R a trade in 2005-14 and −0.016R / −0.011R / −0.018R
  in 2015-26 (n 26,387 at 1R), −0.053R / −0.047R / −0.061R after costs. Splitting it by cycle position, the MSNR call, the
  Mosha CF or the depth does not move it: in the 28 cells with 300+ trades in both windows the Welch t against it lies between −1.73 and +2.05.
- Worst large cell: pullback end · MSNR agrees · not a CF · under 50 % · 2R, −0.072R in 2015-26 (n 1,470, month t −2.00).
- **Side-flipped check**: 0 placebo cells pass; its best confirmation cell (pullback start · MSNR agrees · 2R) +0.053R
  (n 3,101, t 1.76) after +0.006R in discovery.
- After costs (assumed for xag nzdusd usdcad usdchf eurjpy) every one of the 28 cells with 300+ trades loses in 2015-26.

The three lenses together do not pick better H1 ChoChs than the ChoCh alone, before costs, on ten markets and 22 years. The
question is closed on these data: no further splits of these readings on these years.

## Every cell (before costs; month t; Welch t against every H1 ChoCh, discovery / confirmation)

| Cell | n 05-14 | R 05-14 | t 05-14 | n 15-26 | R 15-26 | t 15-26 | R 15-26 after costs | vs control |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| pullback end · msnr agrees · Mosha CF · past 50% · 1R | 108 | +0.062 | 0.58 | 101 | −0.013 | −0.14 | −0.052 | 0.62 / 0.03 |
| pullback end · msnr agrees · Mosha CF · past 50% · 2R | 108 | +0.045 | 0.35 | 101 | +0.107 | 0.81 | +0.068 | 0.23 / 0.90 |
| pullback end · msnr agrees · Mosha CF · past 50% · ext | 47 | +0.022 | 0.11 | 48 | +0.105 | 0.62 | +0.065 | 0.05 / 0.66 |
| pullback end · msnr agrees · Mosha CF · under 50% · 1R | 35 | −0.116 | −0.63 | 39 | +0.138 | 0.81 | +0.118 | −0.69 / 0.95 |
| pullback end · msnr agrees · Mosha CF · under 50% · 2R | 35 | −0.060 | −0.28 | 39 | +0.037 | 0.17 | +0.018 | −0.35 / 0.24 |
| pullback end · msnr agrees · Mosha CF · under 50% · ext | 7 | −0.305 | −0.70 | 9 | −0.121 | −0.26 | −0.145 | −0.70 / −0.23 |
| pullback end · msnr agrees · not a CF · past 50% · 1R | 2,373 | +0.040 | 1.59 | 2,729 | −0.003 | −0.16 | −0.042 | 1.74 / 0.64 |
| pullback end · msnr agrees · not a CF · past 50% · 2R | 2,373 | +0.076 | 2.12 | 2,729 | +0.019 | 0.68 | −0.019 | 2.05 / 1.13 |
| pullback end · msnr agrees · not a CF · past 50% · ext | 1,032 | +0.044 | 0.83 | 1,267 | −0.007 | −0.17 | −0.057 | 0.67 / 0.25 |
| pullback end · msnr agrees · not a CF · under 50% · 1R | 1,183 | −0.045 | −1.29 | 1,470 | −0.029 | −1.10 | −0.062 | −1.63 / −0.48 |
| pullback end · msnr agrees · not a CF · under 50% · 2R | 1,183 | −0.050 | −1.05 | 1,470 | −0.072 | −2.00 | −0.105 | −1.69 / −1.73 |
| pullback end · msnr agrees · not a CF · under 50% · ext | 202 | −0.051 | −0.52 | 274 | +0.036 | 0.42 | −0.012 | −0.67 / 0.64 |
| pullback end · msnr not · Mosha CF · past 50% · 1R | 40 | +0.159 | 1.06 | 55 | −0.125 | −0.99 | −0.154 | 1.02 / −0.82 |
| pullback end · msnr not · Mosha CF · past 50% · 2R | 40 | −0.003 | −0.02 | 55 | −0.179 | −1.16 | −0.208 | −0.10 / −1.01 |
| pullback end · msnr not · Mosha CF · past 50% · ext | 19 | +0.105 | 0.35 | 27 | −0.194 | −0.72 | −0.219 | 0.33 / −0.63 |
| pullback end · msnr not · Mosha CF · under 50% · 1R | 6 | +0.508 | 1.37 | 13 | −0.538 | −1.61 | −0.568 | 1.49 / −2.15 |
| pullback end · msnr not · Mosha CF · under 50% · 2R | 6 | +0.496 | 0.90 | 13 | −0.308 | −0.68 | −0.337 | 0.86 / −0.81 |
| pullback end · msnr not · Mosha CF · under 50% · ext | 1 | −1.000 | −1.00 | 3 | −1.000 | −1.74 | −1.045 | - / −77.28 |
| pullback end · msnr not · not a CF · past 50% · 1R | 1,385 | −0.021 | −0.69 | 1,524 | −0.026 | −1.06 | −0.061 | −0.87 / −0.38 |
| pullback end · msnr not · not a CF · past 50% · 2R | 1,385 | −0.010 | −0.25 | 1,524 | −0.027 | −0.76 | −0.062 | −0.70 / −0.45 |
| pullback end · msnr not · not a CF · past 50% · ext | 673 | +0.006 | 0.09 | 739 | −0.017 | −0.32 | −0.063 | −0.10 / 0.01 |
| pullback end · msnr not · not a CF · under 50% · 1R | 442 | −0.034 | −0.77 | 573 | −0.041 | −0.99 | −0.079 | −0.77 / −0.60 |
| pullback end · msnr not · not a CF · under 50% · 2R | 442 | −0.075 | −1.09 | 573 | −0.055 | −1.02 | −0.092 | −1.44 / −0.80 |
| pullback end · msnr not · not a CF · under 50% · ext | 85 | +0.042 | 0.30 | 96 | −0.126 | −1.01 | −0.189 | 0.22 / −0.85 |
| other, with · msnr agrees · Mosha CF · 1R | 56 | −0.072 | −0.56 | 61 | −0.183 | −1.63 | −0.212 | −0.55 / −1.36 |
| other, with · msnr agrees · Mosha CF · 2R | 56 | +0.110 | 0.59 | 61 | −0.145 | −1.08 | −0.174 | 0.51 / −0.86 |
| other, with · msnr agrees · Mosha CF · ext | 22 | +0.244 | 0.83 | 24 | −0.060 | −0.24 | −0.092 | 0.75 / −0.16 |
| other, with · msnr agrees · not a CF · 1R | 1,943 | +0.002 | 0.09 | 2,395 | −0.007 | −0.34 | −0.044 | −0.02 / 0.41 |
| other, with · msnr agrees · not a CF · 2R | 1,943 | +0.025 | 0.74 | 2,395 | −0.005 | −0.16 | −0.042 | 0.28 / 0.21 |
| other, with · msnr agrees · not a CF · ext | 602 | +0.005 | 0.07 | 795 | +0.015 | 0.27 | −0.039 | −0.12 / 0.60 |
| other, with · msnr not · Mosha CF · 1R | 22 | +0.230 | 1.08 | 16 | +0.334 | 1.38 | +0.308 | 1.14 / 1.48 |
| other, with · msnr not · Mosha CF · 2R | 22 | +0.023 | 0.11 | 16 | +0.434 | 1.22 | +0.408 | 0.03 / 1.27 |
| other, with · msnr not · Mosha CF · ext | 8 | +0.031 | 0.08 | 7 | −0.195 | −0.40 | −0.232 | 0.05 / −0.34 |
| other, with · msnr not · not a CF · 1R | 1,198 | +0.046 | 1.46 | 1,375 | −0.003 | −0.11 | −0.037 | 1.48 / 0.47 |
| other, with · msnr not · not a CF · 2R | 1,198 | +0.018 | 0.44 | 1,375 | +0.004 | 0.11 | −0.030 | 0.06 / 0.42 |
| other, with · msnr not · not a CF · ext | 454 | +0.071 | 0.88 | 566 | −0.015 | −0.21 | −0.060 | 0.75 / 0.04 |
| pullback start · msnr agrees · 1R | 2,831 | +0.002 | 0.11 | 3,103 | −0.035 | −1.60 | −0.071 | −0.02 / −0.98 |
| pullback start · msnr agrees · 2R | 2,831 | +0.022 | 0.80 | 3,103 | −0.037 | −1.42 | −0.074 | 0.24 / −1.06 |
| pullback start · msnr agrees · ext | 1,753 | +0.049 | 1.10 | 1,999 | −0.048 | −1.30 | −0.091 | 0.88 / −0.79 |
| pullback start · msnr not · 1R | 6,025 | −0.011 | −0.70 | 7,011 | −0.003 | −0.25 | −0.041 | −0.95 / 0.97 |
| pullback start · msnr not · 2R | 6,025 | +0.004 | 0.19 | 7,011 | −0.003 | −0.15 | −0.040 | −0.62 / 0.46 |
| pullback start · msnr not · ext | 4,263 | +0.002 | 0.07 | 4,994 | −0.011 | −0.41 | −0.053 | −0.33 / 0.27 |
| other, against · msnr agrees · 1R | 1,737 | +0.045 | 1.99 | 2,057 | −0.020 | −0.84 | −0.058 | 1.73 / −0.17 |
| other, against · msnr agrees · 2R | 1,737 | +0.035 | 1.01 | 2,057 | −0.008 | −0.24 | −0.046 | 0.57 / 0.09 |
| other, against · msnr agrees · ext | 973 | −0.017 | −0.35 | 1,209 | −0.007 | −0.13 | −0.051 | −0.57 / 0.23 |
| other, against · msnr not · 1R | 3,171 | −0.008 | −0.43 | 3,865 | −0.026 | −1.42 | −0.062 | −0.59 / −0.59 |
| other, against · msnr not · 2R | 3,171 | +0.018 | 0.75 | 3,865 | −0.000 | −0.01 | −0.036 | 0.08 / 0.47 |
| other, against · msnr not · ext | 2,217 | −0.006 | −0.15 | 2,693 | −0.028 | −0.85 | −0.068 | −0.47 / −0.31 |
| control: every H1 ChoCh · 1R | 22,555 | +0.003 | 0.39 | 26,387 | −0.016 | −2.35 | −0.053 | - |
| control: every H1 ChoCh · 2R | 22,555 | +0.016 | 1.89 | 26,387 | −0.011 | −1.17 | −0.047 | - |
| control: every H1 ChoCh · ext | 12,358 | +0.012 | 0.71 | 14,750 | −0.018 | −1.24 | −0.061 | - |

## To repeat

```sh
export EDGE_DATA=<cache dir>   # fill with research/edge/_lib/fetch-cache.mjs <m> 5m 2004 2026 for the ten markets
for m in xau xag eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy; do
  node research/edge/cycle-choch-mosha-msnr/run.mjs market $m <out>; node research/edge/cycle-choch-mosha-msnr/run.mjs cut $m 20 <out>; done
node research/edge/cycle-choch-mosha-msnr/run.mjs report <out>
```
