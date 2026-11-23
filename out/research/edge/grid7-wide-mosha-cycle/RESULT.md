# Grid 7: the Mosha storyline and the market cycle on ten markets and 22 years (result)

**Verdict: FAIL. 0 of 54 cells passed (placebo 0); the best confirmation cell, Mosha H4>H1 with the CF clear of the VR, the MSNR call agreeing and a 2R target, made +0.110R a trade before costs in 2015-26 (n 360, month t 1.77) after −0.032R in 2005-14 (n 328, t −0.50).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). OANDA mid 5-minute candles of
xau xag eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy (gold and silver from 2006), discovery 2005-2014,
confirmation 2015 to Oct 2026; the Mosha storyline is grid 5's (`research/edge/grid5-mosha-cycle` `storylines`, the page's own
structure engine), the cycle and continuation use the structure definitions of `research/edge/_lib/phase.mjs`, the Daily MSNR
call is `council/eg-methods.mjs` `direction()`. Market entries only; judged before costs on calendar-month sums. Research only:
nothing live changed, nothing was placed.

## What was run

129,699 signals and 128,570 simulated trades (xau 11,556, xag 11,372, eurusd 13,331, gbpusd 13,160, usdjpy 12,934, audusd
13,647, nzdusd 13,456, usdcad 13,263, usdchf 12,723, eurjpy 13,128; most are the control's every H1 break); 848 dropped on the
data-quality list, 31 not finished by the end of the data, none without its stop on the losing side. 40 of the 48 reading cells
reached n >= 300 in both windows (the eight that did not are all "ext" cells, where the H4 leg extreme was often under 1R away).

Cut test: 30 random cuts in 2011-2012 on xau, eurusd and eurjpy, 56,675 signals known by a cut compared with the ones computed
on candles cut there (reading, side, trigger time, fill, stop, H4 leg extreme, variant, MSNR call): 0 mismatches. A look at
`phase.mjs` itself: at the first 40 cycle triggers of each market `readPhase` reads the H4 stage as "continuation" 349 times of
400 and "range" 51 times (two ChoChs in a row; this study's cycle does not leave those legs out, as pre-registered).

## The bar, line by line (before costs)

| | Reading cells (48) | Placebo (the other side, levels mirrored) |
|---|---:|---:|
| n >= 300 in both windows | 46 of 54 cells (control included) | 46 |
| mean R > 0 and month t >= 2 in 2005-14 | 2 | 4 |
| mean R > 0 and month t >= 2 in 2015-26 | 0 | 6 |
| both windows | 0 | 2 |
| Holm p <= 0.05 in 2015-26 (either sign) | 1 (a loss) | 1 |
| beats its matched control (Welch t >= 2) in both windows | 0 | 26 |
| **pass** | **0** | **0** |

No reading made money before costs in both windows. Only two reading cells cleared the discovery line (the cycle with a
pullback past 50 % at 2R: +0.058R, t 2.23, and the same with the MSNR call: +0.082R, t 2.38), and both were flat in
2015-26 (−0.008R, t −0.36; +0.011R, t 0.43). No reading beat its matched control (an H1 break drawn at random in the same
market, month and side) in either window; most did worse than it.

## Every cell

R a trade before costs, month-sum t, R a trade after costs (`COSTS` of combo-grid-2; xag, nzdusd, usdcad, usdchf and eurjpy
ASSUMED), the confirmation p after Holm over the 54 cells, and the matched control's R a trade / the Welch t of reading minus
control. The control rows (every H1 break, unmatched) are the plain baseline.

| Cell | n 05-14 | R | t | R net | n 15-26 | R | t | R net | Holm p | Control 05-14 R / Welch t | Control 15-26 R / Welch t |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mosha H4>H1 CF clear · all · 1R | 544 | −0.000 | 0.00 | −0.018 | 620 | +0.025 | 0.69 | +0.003 | 1 | +0.024 / −0.41 | +0.057 / −0.59 |
| mosha H4>H1 CF clear · all · 2R | 544 | +0.019 | 0.35 | +0.002 | 620 | +0.050 | 1.02 | +0.028 | 1 | +0.043 / −0.31 | +0.049 / 0.01 |
| mosha H4>H1 CF clear · all · ext | 259 | −0.066 | −0.76 | −0.089 | 311 | +0.006 | 0.07 | −0.023 | 1 | +0.197 / −1.87 | +0.078 / −0.60 |
| mosha H4>H1 CF clear · msnr agrees · 1R | 328 | −0.061 | −1.11 | −0.077 | 360 | +0.066 | 1.48 | +0.045 | 1 | +0.029 / −1.19 | +0.059 / 0.09 |
| mosha H4>H1 CF clear · msnr agrees · 2R | 328 | −0.032 | −0.50 | −0.049 | 360 | +0.110 | 1.77 | +0.090 | 1 | +0.117 / −1.46 | +0.096 / 0.14 |
| mosha H4>H1 CF clear · msnr agrees · ext | 148 | −0.025 | −0.22 | −0.046 | 183 | +0.056 | 0.59 | +0.030 | 1 | +0.183 / −1.14 | −0.086 / 0.98 |
| mosha H4>H1 CF inside VR · all · 1R | 868 | −0.037 | −1.05 | −0.055 | 877 | −0.018 | −0.53 | −0.039 | 1 | +0.059 / −2.08 | +0.114 / −2.86 |
| mosha H4>H1 CF inside VR · all · 2R | 868 | −0.030 | −0.62 | −0.048 | 877 | −0.042 | −1.01 | −0.063 | 1 | +0.150 / −2.92 | +0.103 / −2.41 |
| mosha H4>H1 CF inside VR · all · ext | 177 | −0.190 | −2.04 | −0.221 | 211 | +0.032 | 0.35 | +0.004 | 1 | +0.120 / −1.61 | +0.198 / −1.20 |
| mosha H4>H1 CF inside VR · msnr agrees · 1R | 630 | −0.064 | −1.74 | −0.081 | 594 | −0.009 | −0.22 | −0.030 | 1 | +0.097 / −2.97 | +0.064 / −1.32 |
| mosha H4>H1 CF inside VR · msnr agrees · 2R | 630 | −0.049 | −0.97 | −0.066 | 594 | −0.045 | −0.92 | −0.067 | 1 | +0.098 / −2.05 | +0.025 / −0.97 |
| mosha H4>H1 CF inside VR · msnr agrees · ext | 115 | −0.244 | −2.09 | −0.271 | 132 | −0.004 | −0.03 | −0.035 | 1 | +0.199 / −2.41 | +0.116 / −0.71 |
| mosha H1>M15 CF clear · all · 1R | 1,531 | −0.050 | −1.98 | −0.087 | 1,920 | −0.083 | −3.57 | −0.133 | 0.027 | +0.076 / −3.69 | −0.004 / −2.56 |
| mosha H1>M15 CF clear · all · 2R | 1,531 | −0.042 | −1.25 | −0.079 | 1,920 | −0.086 | −2.78 | −0.137 | 0.322 | +0.056 / −2.16 | −0.025 / −1.53 |
| mosha H1>M15 CF clear · all · ext | 1,114 | −0.081 | −1.64 | −0.121 | 1,446 | −0.086 | −1.96 | −0.142 | 1 | +0.043 / −2.01 | +0.095 / −3.25 |
| mosha H1>M15 CF clear · msnr agrees · 1R | 924 | −0.054 | −1.73 | −0.092 | 1,208 | −0.085 | −3.03 | −0.135 | 0.154 | +0.034 / −2.01 | +0.064 / −3.85 |
| mosha H1>M15 CF clear · msnr agrees · 2R | 924 | −0.040 | −0.92 | −0.078 | 1,208 | −0.083 | −2.14 | −0.133 | 1 | +0.147 / −3.19 | +0.007 / −1.79 |
| mosha H1>M15 CF clear · msnr agrees · ext | 652 | −0.093 | −1.64 | −0.134 | 881 | −0.079 | −1.25 | −0.135 | 1 | +0.166 / −3.30 | +0.127 / −2.87 |
| mosha H1>M15 CF inside VR · all · 1R | 3,089 | −0.014 | −0.76 | −0.051 | 3,447 | −0.034 | −2.03 | −0.080 | 1 | +0.023 / −1.56 | +0.033 / −2.91 |
| mosha H1>M15 CF inside VR · all · 2R | 3,089 | −0.018 | −0.72 | −0.055 | 3,447 | −0.039 | −1.73 | −0.085 | 1 | +0.070 / −2.78 | +0.066 / −3.50 |
| mosha H1>M15 CF inside VR · all · ext | 1,159 | +0.029 | 0.56 | −0.019 | 1,363 | −0.103 | −2.71 | −0.160 | 0.388 | +0.133 / −1.41 | +0.068 / −3.16 |
| mosha H1>M15 CF inside VR · msnr agrees · 1R | 2,053 | −0.002 | −0.09 | −0.038 | 2,291 | −0.038 | −1.92 | −0.083 | 1 | +0.065 / −2.26 | +0.058 / −3.46 |
| mosha H1>M15 CF inside VR · msnr agrees · 2R | 2,053 | −0.005 | −0.17 | −0.041 | 2,291 | −0.031 | −1.10 | −0.075 | 1 | +0.067 / −1.83 | +0.065 / −2.61 |
| mosha H1>M15 CF inside VR · msnr agrees · ext | 695 | +0.038 | 0.65 | −0.009 | 821 | −0.103 | −2.04 | −0.160 | 1 | +0.153 / −1.51 | +0.097 / −2.97 |
| cycle pullback past 50% · all · 1R | 4,177 | +0.021 | 1.15 | −0.011 | 4,813 | −0.025 | −1.57 | −0.062 | 1 | +0.003 / 0.85 | +0.020 / −2.23 |
| cycle pullback past 50% · all · 2R | 4,177 | +0.058 | 2.23 | +0.025 | 4,813 | −0.008 | −0.36 | −0.045 | 1 | +0.032 / 0.88 | −0.017 / 0.32 |
| cycle pullback past 50% · all · ext | 1,934 | +0.043 | 1.09 | −0.002 | 2,289 | −0.020 | −0.61 | −0.068 | 1 | +0.094 / −1.04 | +0.058 / −1.72 |
| cycle pullback past 50% · msnr agrees · 1R | 2,596 | +0.039 | 1.69 | +0.008 | 3,045 | −0.017 | −0.89 | −0.056 | 1 | +0.064 / −0.90 | +0.040 / −2.28 |
| cycle pullback past 50% · msnr agrees · 2R | 2,596 | +0.082 | 2.38 | +0.051 | 3,045 | +0.011 | 0.43 | −0.027 | 1 | +0.086 / −0.10 | +0.040 / −0.85 |
| cycle pullback past 50% · msnr agrees · ext | 1,146 | +0.044 | 0.87 | +0.001 | 1,416 | −0.001 | −0.01 | −0.051 | 1 | +0.116 / −1.13 | +0.077 / −1.34 |
| cycle pullback under 50% · all · 1R | 2,038 | −0.038 | −1.44 | −0.070 | 2,452 | −0.029 | −1.43 | −0.065 | 1 | +0.060 / −3.16 | +0.021 / −1.80 |
| cycle pullback under 50% · all · 2R | 2,038 | −0.058 | −1.59 | −0.090 | 2,452 | −0.056 | −2.04 | −0.091 | 1 | +0.118 / −4.20 | +0.086 / −3.70 |
| cycle pullback under 50% · all · ext | 378 | −0.019 | −0.24 | −0.072 | 466 | −0.056 | −0.84 | −0.110 | 1 | +0.055 / −0.70 | +0.036 / −0.98 |
| cycle pullback under 50% · msnr agrees · 1R | 1,482 | −0.050 | −1.67 | −0.083 | 1,775 | −0.024 | −0.96 | −0.059 | 1 | +0.091 / −3.91 | +0.122 / −4.42 |
| cycle pullback under 50% · msnr agrees · 2R | 1,482 | −0.048 | −1.19 | −0.080 | 1,775 | −0.049 | −1.47 | −0.084 | 1 | +0.115 / −3.28 | +0.114 / −3.60 |
| cycle pullback under 50% · msnr agrees · ext | 258 | −0.046 | −0.51 | −0.102 | 349 | −0.028 | −0.37 | −0.081 | 1 | +0.230 / −2.14 | +0.097 / −1.14 |
| continuation pullback past 50% · all · 1R | 1,393 | +0.024 | 0.91 | −0.009 | 1,641 | +0.006 | 0.24 | −0.034 | 1 | +0.013 / 0.29 | +0.029 / −0.67 |
| continuation pullback past 50% · all · 2R | 1,393 | +0.032 | 0.88 | −0.001 | 1,641 | +0.045 | 1.30 | +0.005 | 1 | +0.045 / −0.25 | +0.037 / 0.17 |
| continuation pullback past 50% · all · ext | 489 | −0.040 | −0.63 | −0.082 | 622 | +0.089 | 1.32 | +0.042 | 1 | +0.091 / −1.30 | +0.034 / 0.63 |
| continuation pullback past 50% · msnr agrees · 1R | 887 | +0.035 | 1.05 | +0.003 | 1,039 | +0.017 | 0.56 | −0.024 | 1 | +0.109 / −1.56 | +0.007 / 0.24 |
| continuation pullback past 50% · msnr agrees · 2R | 887 | +0.054 | 1.12 | +0.022 | 1,039 | +0.051 | 1.14 | +0.010 | 1 | +0.137 / −1.28 | +0.055 / −0.06 |
| continuation pullback past 50% · msnr agrees · ext | 275 | −0.024 | −0.30 | −0.067 | 362 | +0.063 | 0.73 | +0.014 | 1 | +0.104 / −1.08 | +0.184 / −1.05 |
| continuation pullback under 50% · all · 1R | 528 | −0.069 | −1.39 | −0.104 | 686 | +0.023 | 0.64 | −0.018 | 1 | +0.106 / −2.86 | +0.092 / −1.31 |
| continuation pullback under 50% · all · 2R | 528 | −0.062 | −1.02 | −0.097 | 686 | +0.041 | 0.79 | +0.001 | 1 | +0.210 / −3.24 | +0.162 / −1.61 |
| continuation pullback under 50% · all · ext | 79 | −0.041 | −0.30 | −0.100 | 106 | +0.065 | 0.50 | +0.004 | 1 | +0.318 / −1.56 | +0.040 / 0.13 |
| continuation pullback under 50% · msnr agrees · 1R | 394 | −0.063 | −1.15 | −0.096 | 508 | +0.032 | 0.77 | −0.009 | 1 | +0.171 / −3.33 | +0.034 / −0.03 |
| continuation pullback under 50% · msnr agrees · 2R | 394 | −0.056 | −0.79 | −0.088 | 508 | +0.056 | 1.00 | +0.015 | 1 | +0.189 / −2.50 | +0.093 / −0.44 |
| continuation pullback under 50% · msnr agrees · ext | 51 | −0.147 | −0.81 | −0.200 | 83 | +0.113 | 0.78 | +0.050 | 1 | +0.069 / −0.84 | +0.136 / −0.11 |
| control every H1 break · all · 1R | 45,136 | −0.012 | −1.95 | −0.044 | 52,810 | −0.013 | −2.29 | −0.051 | 1 | - | - |
| control every H1 break · all · 2R | 45,136 | +0.000 | 0.02 | −0.032 | 52,810 | −0.010 | −0.99 | −0.047 | 1 | - | - |
| control every H1 break · all · ext | 17,837 | +0.010 | 0.57 | −0.031 | 21,548 | −0.009 | −0.64 | −0.054 | 1 | - | - |
| control every H1 break · msnr agrees · 1R | 23,399 | −0.005 | −0.47 | −0.037 | 27,561 | −0.011 | −1.20 | −0.049 | 1 | - | - |
| control every H1 break · msnr agrees · 2R | 23,399 | +0.011 | 0.69 | −0.020 | 27,561 | −0.009 | −0.61 | −0.046 | 1 | - | - |
| control every H1 break · msnr agrees · ext | 6,805 | +0.023 | 0.83 | −0.020 | 8,413 | +0.001 | 0.04 | −0.047 | 1 | - | - |

## What it shows

- **The Mosha storyline does not make money mechanically, on any ladder.** H4->H1: about zero (CF clear) or negative (CF
  inside the VR, which the method calls likely to fail: −0.02 to −0.04R in 2015-26). H1->M15 loses in both windows; with the CF
  clear of the VR and a 1R target it lost −0.083R a trade in 2015-26 (n 1,920, month t −3.57, Holm p 0.027): the one cell
  significant after Holm, and it is a loss.
- **The cycle's pullback end and the continuation break are at zero.** The cycle with a pullback past 50 % of the H4 leg is a
  little better than under 50 % in both windows (the under-50 % cells are negative everywhere), but past 50 % is flat in
  2015-26. The continuation break is flat to slightly positive and never near t 2.
- **The Daily MSNR call adds nothing measurable.** In most pairs of cells "msnr agrees" moves the mean R by under 0.03R and
  flips sign between the windows.
- **Every H1 break, the baseline, sits at zero before costs** (2R: +0.000R in 2005-14, −0.010R in 2015-26) and loses
  0.03-0.05R a trade after them.

## Placebo (the other side, same fill, stop and target mirrored)

Placebo cells with n >= 300 in both windows and a month t >= 2 in either window:

| Cell traded the other way | n 05-14 | R | t | n 15-26 | R | t | R net | Holm p |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| mosha H1>M15 CF clear · all · 1R | 1,531 | +0.049 | 1.92 | 1,920 | +0.078 | 3.41 | +0.027 | 0.0432 |
| mosha H1>M15 CF clear · all · 2R | 1,531 | +0.079 | 2.42 | 1,920 | +0.099 | 2.96 | +0.048 | 0.191 |
| mosha H1>M15 CF clear · all · ext | 1,114 | +0.109 | 2.35 | 1,446 | +0.066 | 1.40 | +0.010 | 1 |
| mosha H1>M15 CF clear · msnr agrees · 1R | 924 | +0.052 | 1.66 | 1,208 | +0.081 | 2.92 | +0.031 | 0.213 |
| mosha H1>M15 CF clear · msnr agrees · 2R | 924 | +0.071 | 1.70 | 1,208 | +0.090 | 2.30 | +0.040 | 1 |
| mosha H1>M15 CF clear · msnr agrees · ext | 652 | +0.120 | 2.08 | 881 | +0.074 | 1.23 | +0.018 | 1 |
| control every H1 break · all · 2R | 45,136 | +0.025 | 3.51 | 52,794 | +0.019 | 2.92 | −0.019 | 0.213 |
| control every H1 break · all · ext | 17,837 | +0.035 | 1.93 | 21,545 | +0.028 | 2.03 | −0.017 | 1 |

No placebo cell passes either (the "beats its control" line is met by many placebo cells because their matched control is
drawn on the placebo's side, where the readings' losses become gains). Fading the M15 CF of an H1 BO with the CF clear of
the VR, at 2R, was positive in both windows (+0.079R, t 2.42; +0.099R, t 2.96) but fails Holm (p 0.19), and after the costs
it is +0.048R in 2015-26. Fading every H1 break at 2R was +0.025R / +0.019R (t 3.51 / 2.92) and loses after costs. These are
side-flipped mirrors found after looking: hypotheses for their own pre-registration on other data at most, never an edge.

## Limits

- One structure engine per reading (the page's `msAnalyze` for the storyline, edgekit `structure(bars, 3)` for the cycle),
  market entries only, the stop past the trigger's swing by 0.1 ATR(14); limit entries, other stops and other exits were not
  tested here (grid 5 tested many of them on 2010-2019 and found none either).
- Today's demo costs are charged on every year; five markets' costs are assumed.
- This study read the 2005-2009 years and the five holdout markets that the studies of 22-23 Nov had left untouched: they are
  no longer a holdout for anything built from these readings.

To repeat: fetch the cache (`research/edge/_lib/fetch-cache.mjs <m> 5m 2004 2026` and `<m> 1d 2003 2026` for the ten markets,
`EDGE_DATA` set), then `node research/edge/grid7-wide-mosha-cycle/run.mjs market <m> <dir>` for each market (about 10 s each),
`… cut <m> 30 <dir>` for xau, eurusd, eurjpy, and `… report <dir>` (writes `result.json`). Test:
`tests/grid7-wide-mosha-cycle.test.mjs`.
