# Wide grid: the three-timeframe engulf chain (result)

**Verdict: FAIL. 0 of 36 cells pass; the best confirmation cell, D1>H4>H1 mkt 1R +MSNR, made +0.012R a trade before costs in 2015-26 (n 7,219, month t 0.64; its control -0.049R, Welch t 3.63).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

Three chains [zone, engulf, confirmation] (D1>H4>H1, H4>H1>M15, H1>M15>M5) with `council/eg-methods.mjs` `zones` (3-candle
span): an engulf zone on the first timeframe gives the side; price comes back into it and an engulf of that side completes on
the second timeframe touching it; then one completes on the third timeframe touching the second, within 24 candles. Entry a
market order at the next 5-minute open, or a limit at the middle of the third zone filled only when traded through by half the
round trip (24 candles, cancelled by a close past the stop). Stop past the second zone's far side + 0.1 ATR of the second
timeframe; exits 1R, 2R, or the nearest opposite zone of the first timeframe (only when 1R or more away). The same 18 cells
with the Daily MSNR call agreeing: 36. Each cell against a control: a third-timeframe engulf of the same side and month with
no higher zones, drawn at random, the same entry and a stop at the matched ATR distance. Ten markets pooled, OANDA mid
5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026.
Costs after the fact only: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 36 of 36.
- Mean R > 0 and month t >= 2 in discovery: 0; in confirmation: 0; both: 0.
- Holm-adjusted p < 0.05 over the 36 confirmation tests: 0.
- Beats its control (Welch t >= 2 in both windows): 6 of 36.
- **All four: 0.**
- Side-flipped check passing bars 1-3: 2 (H1>M15>M5 mkt 1R; H1>M15>M5 mkt 2R).

Best confirmation cell: D1>H4>H1 mkt 1R +MSNR. Best on the weaker of the two windows: D1>H4>H1 mkt opp (discovery
+0.021R, t 0.62; confirmation +0.015R, t 0.44). Best against its control: D1>H4>H1 mkt 2R +MSNR
(Welch t 5.02 / 3.97).

## Every cell

R a trade before costs (month-sum t), after costs beside; "ctl" = its control in confirmation; "vs ctl" = Welch t of the cell
against its control (discovery / confirmation); Holm on the confirmation test; "flip" = the side-flipped check in confirmation.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | ctl 15-26 (n) | vs ctl | Holm | flip 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| D1>H4>H1 mkt 1R | 13,141 | +0.002 (0.19) | -0.031 | 15,505 | -0.007 (-0.63) | -0.053 | -0.029 (15,492) | 3.52 / 1.88 | 1.000 | +0.004 (0.32) | no |
| D1>H4>H1 mkt 1R +MSNR | 6,230 | -0.002 (-0.13) | -0.035 | 7,219 | +0.012 (0.64) | -0.032 | -0.049 (7,383) | 3.52 / 3.63 | 1.000 | -0.015 (-0.83) | no |
| D1>H4>H1 mkt 2R | 13,141 | +0.015 (0.73) | -0.019 | 15,505 | -0.001 (-0.05) | -0.046 | -0.057 (15,492) | 4.60 / 3.54 | 1.000 | +0.017 (1.03) | no |
| D1>H4>H1 mkt 2R +MSNR | 6,230 | +0.009 (0.30) | -0.024 | 7,219 | +0.003 (0.12) | -0.040 | -0.088 (7,383) | 5.02 / 3.97 | 1.000 | -0.002 (-0.07) | no |
| D1>H4>H1 mkt opp | 7,631 | +0.021 (0.62) | -0.018 | 9,092 | +0.015 (0.44) | -0.037 | -0.058 (9,005) | 2.94 / 2.38 | 1.000 | +0.002 (0.07) | no |
| D1>H4>H1 mkt opp +MSNR | 3,182 | +0.036 (0.65) | -0.001 | 3,809 | +0.008 (0.17) | -0.042 | -0.105 (3,679) | 3.36 / 2.78 | 1.000 | +0.023 (0.58) | no |
| D1>H4>H1 lim50 1R | 9,825 | -0.035 (-2.63) | -0.093 | 11,639 | -0.029 (-2.18) | -0.109 | -0.054 (12,157) | -0.23 / 1.90 | 1.000 | -0.035 (-2.67) | no |
| D1>H4>H1 lim50 1R +MSNR | 4,638 | -0.041 (-2.23) | -0.096 | 5,407 | -0.017 (-0.92) | -0.092 | -0.074 (5,833) | 0.80 / 2.94 | 1.000 | -0.055 (-3.09) | no |
| D1>H4>H1 lim50 2R | 9,825 | -0.031 (-1.57) | -0.089 | 11,639 | -0.037 (-2.14) | -0.118 | -0.071 (12,157) | 0.27 / 1.85 | 1.000 | -0.026 (-1.54) | no |
| D1>H4>H1 lim50 2R +MSNR | 4,638 | -0.036 (-1.32) | -0.091 | 5,407 | -0.012 (-0.47) | -0.087 | -0.091 (5,833) | 1.65 / 2.97 | 1.000 | -0.040 (-1.67) | no |
| D1>H4>H1 lim50 opp | 7,002 | -0.060 (-1.54) | -0.125 | 8,323 | -0.041 (-1.01) | -0.133 | -0.072 (8,422) | -0.60 / 0.76 | 1.000 | -0.040 (-1.14) | no |
| D1>H4>H1 lim50 opp +MSNR | 2,988 | -0.066 (-1.21) | -0.127 | 3,606 | +0.005 (0.09) | -0.082 | -0.107 (3,544) | 1.22 / 2.02 | 1.000 | -0.055 (-1.21) | no |
| H4>H1>M15 mkt 1R | 55,459 | -0.009 (-1.38) | -0.075 | 65,232 | -0.015 (-2.73) | -0.096 | -0.026 (65,288) | 1.39 / 2.06 | 1.000 | +0.010 (1.90) | no |
| H4>H1>M15 mkt 1R +MSNR | 28,377 | +0.006 (0.60) | -0.057 | 33,355 | -0.014 (-1.92) | -0.094 | -0.024 (32,574) | 3.75 / 1.32 | 1.000 | +0.010 (1.32) | no |
| H4>H1>M15 mkt 2R | 55,459 | -0.000 (-0.05) | -0.066 | 65,232 | -0.012 (-1.33) | -0.093 | -0.034 (65,288) | 2.77 / 2.96 | 1.000 | +0.025 (3.02) | no |
| H4>H1>M15 mkt 2R +MSNR | 28,377 | +0.019 (1.26) | -0.044 | 33,355 | -0.017 (-1.46) | -0.097 | -0.037 (32,574) | 4.17 / 1.87 | 1.000 | +0.025 (2.26) | no |
| H4>H1>M15 mkt opp | 28,491 | -0.013 (-0.68) | -0.088 | 33,358 | -0.035 (-2.10) | -0.127 | -0.061 (32,364) | 2.65 / 1.89 | 1.000 | +0.030 (1.69) | no |
| H4>H1>M15 mkt opp +MSNR | 13,659 | +0.013 (0.45) | -0.060 | 16,024 | -0.040 (-1.77) | -0.131 | -0.059 (14,611) | 2.88 / 0.98 | 1.000 | +0.038 (1.76) | no |
| H4>H1>M15 lim50 1R | 41,102 | -0.046 (-6.90) | -0.154 | 48,024 | -0.060 (-9.41) | -0.190 | -0.064 (49,344) | 0.09 / 0.65 | 1.000 | -0.038 (-5.85) | no |
| H4>H1>M15 lim50 1R +MSNR | 20,998 | -0.036 (-3.93) | -0.146 | 24,544 | -0.057 (-6.97) | -0.185 | -0.062 (24,634) | 1.35 / 0.43 | 1.000 | -0.039 (-4.46) | no |
| H4>H1>M15 lim50 2R | 41,102 | -0.040 (-3.88) | -0.148 | 48,024 | -0.053 (-5.89) | -0.183 | -0.067 (49,344) | 0.50 / 1.51 | 1.000 | -0.020 (-2.12) | no |
| H4>H1>M15 lim50 2R +MSNR | 20,998 | -0.027 (-1.79) | -0.137 | 24,544 | -0.056 (-4.57) | -0.184 | -0.059 (24,634) | 2.21 / 0.22 | 1.000 | -0.015 (-1.29) | no |
| H4>H1>M15 lim50 opp | 26,157 | -0.061 (-2.93) | -0.186 | 30,387 | -0.079 (-4.18) | -0.230 | -0.098 (30,449) | 0.49 / 1.11 | 1.000 | -0.038 (-2.18) | no |
| H4>H1>M15 lim50 opp +MSNR | 12,841 | -0.027 (-0.86) | -0.158 | 14,736 | -0.085 (-3.21) | -0.235 | -0.095 (13,887) | 2.67 / 0.39 | 1.000 | -0.008 (-0.35) | no |
| H1>M15>M5 mkt 1R | 214,863 | -0.016 (-5.01) | -0.133 | 266,181 | -0.024 (-8.53) | -0.166 | -0.023 (266,499) | 0.80 / -0.28 | 1.000 | +0.016 (5.69) | no |
| H1>M15>M5 mkt 1R +MSNR | 108,240 | -0.010 (-2.03) | -0.126 | 134,561 | -0.021 (-4.72) | -0.161 | -0.020 (133,355) | 0.82 / -0.35 | 1.000 | +0.013 (2.83) | no |
| H1>M15>M5 mkt 2R | 214,863 | -0.021 (-3.91) | -0.137 | 266,181 | -0.026 (-5.58) | -0.167 | -0.029 (266,499) | -0.59 / 0.91 | 1.000 | +0.022 (5.33) | no |
| H1>M15>M5 mkt 2R +MSNR | 108,240 | -0.008 (-1.01) | -0.124 | 134,561 | -0.023 (-3.24) | -0.163 | -0.023 (133,355) | 0.13 / -0.01 | 1.000 | +0.020 (2.94) | no |
| H1>M15>M5 mkt opp | 100,364 | -0.040 (-4.06) | -0.172 | 129,121 | -0.036 (-3.88) | -0.196 | -0.044 (126,540) | -1.02 / 1.09 | 1.000 | +0.023 (2.55) | no |
| H1>M15>M5 mkt opp +MSNR | 49,117 | -0.026 (-1.90) | -0.158 | 63,958 | -0.042 (-3.15) | -0.201 | -0.043 (61,361) | -0.40 / 0.12 | 1.000 | +0.020 (1.70) | no |
| H1>M15>M5 lim50 1R | 153,976 | -0.092 (-18.46) | -0.270 | 188,994 | -0.110 (-36.34) | -0.331 | -0.112 (191,917) | 2.39 / 0.47 | 1.000 | -0.089 (-24.33) | no |
| H1>M15>M5 lim50 1R +MSNR | 77,173 | -0.093 (-15.05) | -0.268 | 95,398 | -0.107 (-25.38) | -0.326 | -0.107 (95,956) | 1.24 / 0.09 | 1.000 | -0.088 (-18.45) | no |
| H1>M15>M5 lim50 2R | 153,976 | -0.088 (-15.08) | -0.266 | 188,994 | -0.107 (-23.97) | -0.328 | -0.112 (191,917) | 2.12 / 1.13 | 1.000 | -0.082 (-16.80) | no |
| H1>M15>M5 lim50 2R +MSNR | 77,173 | -0.085 (-11.12) | -0.260 | 95,398 | -0.100 (-15.15) | -0.319 | -0.107 (95,956) | 1.12 / 1.13 | 1.000 | -0.079 (-11.25) | no |
| H1>M15>M5 lim50 opp | 92,627 | -0.111 (-10.87) | -0.314 | 116,631 | -0.123 (-12.88) | -0.374 | -0.131 (117,094) | 0.71 / 0.87 | 1.000 | -0.123 (-14.24) | no |
| H1>M15>M5 lim50 opp +MSNR | 45,442 | -0.099 (-6.53) | -0.300 | 57,812 | -0.135 (-10.21) | -0.384 | -0.132 (57,076) | 1.41 / -0.23 | 1.000 | -0.122 (-10.69) | no |

## Checks

- Cut test: 15 cuts on xau, eurusd, usdjpy: 504,098 chain signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a market fill at or past the stop and a trade whose risk is under the round-trip cost are no trades; a limit whose fill candle opens past the stop is booked at -1R.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | signals (A / B / C) | orders filled | limits unfilled | dropped | risk under cost | no opp target | controls drawn / none |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 2600 / 10489 / 45274 | 98,587 | 28,839 | 8 | 5,305 | 90,787 | 58,361 / 0 |
| xag | 2006-03-19 | 2688 / 10823 / 40732 | 67,731 | 39,374 | 425 | 39,688 | 67,971 | 54,243 / 0 |
| eurusd | 2004-01-01 | 2662 / 11777 / 50975 | 113,790 | 28,779 | 136 | 2,313 | 102,582 | 65,413 / 0 |
| gbpusd | 2004-01-01 | 2769 / 11810 / 51204 | 114,583 | 28,839 | 262 | 2,327 | 103,493 | 65,783 / 0 |
| usdjpy | 2004-01-01 | 3088 / 13141 / 51790 | 117,328 | 32,165 | 242 | 2,854 | 108,257 | 68,019 / 0 |
| audusd | 2004-01-01 | 2975 / 12391 / 48173 | 110,313 | 28,724 | 98 | 2,194 | 101,225 | 63,539 / 0 |
| nzdusd | 2004-01-01 | 2966 / 12848 / 48659 | 111,973 | 28,794 | 5 | 2,746 | 105,153 | 64,473 / 0 |
| usdcad | 2004-01-01 | 3199 / 12699 / 49051 | 112,952 | 28,646 | 222 | 2,654 | 105,560 | 64,949 / 0 |
| usdchf | 2004-01-01 | 2750 / 12092 / 49850 | 111,954 | 28,923 | 226 | 3,331 | 103,387 | 64,692 / 0 |
| eurjpy | 2004-01-01 | 2988 / 13297 / 54999 | 124,730 | 31,134 | 8 | 2,755 | 116,854 | 71,283 / 0 |

## What it means

Trades taken after the full three-timeframe engulf chain, with a market entry or a trade-through limit, do not clear the
pre-registered bar on ten markets over 22 years, and the chain does not pick better trades than a matched engulf with no
higher zones in a way that makes money (see below). Do not re-test variants of these 36 cells on these years. Nothing live
changed; no rule is proposed.

**Beating the control is not a profit.** 6 cells beat their control in both windows (D1>H4>H1 mkt 1R +MSNR; D1>H4>H1 mkt 2R; D1>H4>H1 mkt 2R +MSNR; D1>H4>H1 mkt opp; D1>H4>H1 mkt opp +MSNR; H4>H1>M15 mkt 2R).
In each the chain trades themselves sit at about zero before costs (none has a month t of 2 in either window) while the
matched third-timeframe engulfs with no higher zones LOSE before costs; so the chain avoids part of a loss a plain engulf
entry carries, nothing more. After costs every one of them loses (confirmation: -0.032R, -0.046R, -0.040R, -0.037R, -0.042R, -0.093R).

**The side-flipped check.** 2 flipped cells clear bars 1-3 (H1>M15>M5 mkt 1R; H1>M15>M5 mkt 2R). With fixed R targets the
flipped trade mirrors the real one, so this says only that the real trades lose a few hundredths of an R before costs. It is
not a fade rule: after costs the flipped trades lose heavily (H1>M15>M5 mkt 1R flipped: +0.016R before costs, t 5.69;
-0.126R after costs, t -37.91, n 266,168 in 2015-26). A check is not a rule.

The trade-through limit at the middle of the third zone does worse than the market entry (H1>M15>M5 lim50 1R: -0.110R a trade before
costs in 2015-26 against -0.024R at market): once a touch no longer counts as a fill, the orders that fill are the ones price runs through.
