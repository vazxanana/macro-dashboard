# Wide sweep grid: sweeps of the Asia range, the previous day and the previous week on ten markets (result)

**Verdict: FAIL. 0 of 36 sweep cells pass; the best confirmation cell, asia london 2R agree, made +0.072R a trade before costs in 2015-26 (n 1,886, month t 2.19; discovery +0.023R, t 0.72; -0.006R after costs).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

For every weekday, the Asia range (00:00-06:59 UTC), the last closed New York trading day and the last closed week. In London
(07-12 UTC) or New York (12-17 UTC) an M15 candle trades beyond the range edge from inside, and an M15 candle closes back
inside within 3 candles, the extreme at least 0.1 Daily ATR beyond the edge: the first such sweep of each edge and session.
Market entry against the sweep at the next 5-minute open, stop past the sweep's extreme + 0.1 M15 ATR; exits 1R, 2R, or the
range's other side (only when 1R or more away); time limit 1 day. Each also with the Daily MSNR call agreeing. Control:
`grid7-wide-fade`'s M15 fade of the first structure break in the same sessions (exits 1R, 2R, opposite swing). Ten markets
pooled, OANDA mid 5-minute candles. Discovery = fills 2005-2014, confirmation = 2015 to October 2026. Judged before costs on
month sums; Holm over the 48 confirmation tests. Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, sweep cell by sweep cell (36)

- n >= 300 in both windows: 33.
- Mean R > 0 and month t >= 2 in discovery: 4; in confirmation: 2; both: 0.
- Holm-adjusted p < 0.05: 0.
- Beats its control (Welch t >= 2 in both windows): 8.
- **All five: 0.**
- Of those, positive after costs in both windows: 0.
- Side-flipped (traded WITH the sweep) passing bars 1-4: 0.

Best confirmation cell: asia london 2R agree. Best on the weaker of the two windows: week london range all (discovery +0.088R,
t 1.02; confirmation +0.163R, t 1.61).

## The control (the plain M15 fade, same sessions)

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Holm |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| fade london 1R all | 32,446 | -0.073 (-10.21) | -0.370 | 37,546 | -0.092 (-13.00) | -0.467 | 0.375 | 1.000 |
| fade london 1R agree | 16,123 | -0.078 (-8.70) | -0.372 | 18,824 | -0.086 (-8.47) | -0.458 | 0.372 | 1.000 |
| fade london 2R all | 32,446 | +0.041 (4.41) | -0.256 | 37,546 | +0.014 (1.47) | -0.362 | 0.375 | 1.000 |
| fade london 2R agree | 16,123 | +0.038 (3.03) | -0.257 | 18,824 | +0.018 (1.33) | -0.354 | 0.372 | 1.000 |
| fade london swing all | 29,776 | +0.133 (5.48) | -0.164 | 34,029 | +0.106 (4.57) | -0.270 | 0.377 | 0.000 |
| fade london swing agree | 14,717 | +0.164 (4.88) | -0.130 | 17,047 | +0.119 (3.67) | -0.254 | 0.372 | 0.008 |
| fade ny 1R all | 35,034 | -0.089 (-12.12) | -0.354 | 41,058 | -0.112 (-19.08) | -0.434 | 0.322 | 1.000 |
| fade ny 1R agree | 17,251 | -0.101 (-10.96) | -0.362 | 20,645 | -0.107 (-13.37) | -0.426 | 0.319 | 1.000 |
| fade ny 2R all | 35,034 | +0.015 (1.51) | -0.250 | 41,058 | -0.005 (-0.57) | -0.327 | 0.322 | 1.000 |
| fade ny 2R agree | 17,251 | +0.004 (0.32) | -0.257 | 20,645 | -0.001 (-0.10) | -0.320 | 0.319 | 1.000 |
| fade ny swing all | 32,530 | +0.156 (6.22) | -0.110 | 37,501 | +0.106 (5.10) | -0.218 | 0.324 | 0.000 |
| fade ny swing agree | 15,997 | +0.149 (4.23) | -0.113 | 18,803 | +0.097 (3.62) | -0.225 | 0.321 | 0.009 |

## Every sweep cell

R a trade before costs (month-sum t), after costs beside; "cost R" = mean round-trip cost / risk in 2015-26; "vs ctl" = Welch t
of the cell against its control (discovery / confirmation); flipped = the same trades taken WITH the sweep.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | vs ctl | Holm | Flipped R 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| asia london 1R all | 3,462 | +0.013 (0.74) | -0.050 | 3,639 | +0.008 (0.43) | -0.073 | 0.080 | 4.83 / 5.74 | 1.000 | -0.013 (-0.74) | no |
| asia london 1R agree | 1,831 | +0.007 (0.31) | -0.056 | 1,886 | +0.032 (1.29) | -0.047 | 0.079 | 3.45 / 4.86 | 1.000 | -0.036 (-1.45) | no |
| asia london 2R all | 3,462 | +0.040 (1.71) | -0.023 | 3,639 | +0.017 (0.69) | -0.063 | 0.080 | -0.06 / 0.14 | 1.000 | -0.010 (-0.37) | no |
| asia london 2R agree | 1,831 | +0.023 (0.72) | -0.040 | 1,886 | +0.072 (2.19) | -0.006 | 0.079 | -0.43 / 1.60 | 0.660 | -0.022 (-0.61) | no |
| asia london range all | 2,853 | +0.016 (0.55) | -0.049 | 3,016 | +0.019 (0.60) | -0.069 | 0.087 | -3.27 / -2.57 | 1.000 | -0.013 (-0.42) | no |
| asia london range agree | 1,516 | +0.030 (0.78) | -0.037 | 1,573 | +0.089 (2.17) | +0.004 | 0.085 | -2.67 / -0.61 | 0.678 | -0.025 (-0.59) | no |
| asia ny 1R all | 4,654 | +0.011 (0.75) | -0.062 | 5,628 | -0.022 (-1.86) | -0.105 | 0.083 | 6.56 / 6.47 | 1.000 | +0.017 (1.41) | no |
| asia ny 1R agree | 2,345 | +0.011 (0.53) | -0.061 | 2,901 | -0.026 (-1.39) | -0.107 | 0.082 | 5.19 / 4.17 | 1.000 | +0.022 (1.15) | no |
| asia ny 2R all | 4,654 | +0.050 (2.56) | -0.023 | 5,628 | -0.019 (-1.03) | -0.102 | 0.083 | 1.66 / -0.75 | 1.000 | +0.003 (0.21) | no |
| asia ny 2R agree | 2,345 | +0.065 (2.12) | -0.008 | 2,901 | -0.019 (-0.84) | -0.101 | 0.082 | 2.03 / -0.69 | 1.000 | -0.000 (-0.01) | no |
| asia ny range all | 3,214 | +0.025 (0.95) | -0.053 | 3,859 | -0.031 (-1.28) | -0.127 | 0.096 | -4.00 / -4.64 | 1.000 | -0.014 (-0.60) | no |
| asia ny range agree | 1,623 | +0.009 (0.22) | -0.069 | 1,973 | -0.054 (-1.75) | -0.147 | 0.093 | -3.04 / -3.68 | 1.000 | -0.027 (-0.84) | no |
| day london 1R all | 1,577 | +0.016 (0.62) | -0.050 | 1,625 | -0.040 (-1.56) | -0.120 | 0.080 | 3.47 / 2.07 | 1.000 | +0.035 (1.38) | no |
| day london 1R agree | 781 | +0.036 (0.94) | -0.031 | 808 | -0.050 (-1.35) | -0.127 | 0.077 | 3.10 / 1.00 | 1.000 | +0.045 (1.23) | no |
| day london 2R all | 1,577 | +0.010 (0.33) | -0.056 | 1,625 | -0.029 (-0.81) | -0.109 | 0.080 | -0.86 / -1.23 | 1.000 | +0.068 (2.02) | no |
| day london 2R agree | 781 | +0.040 (0.81) | -0.027 | 808 | -0.055 (-1.09) | -0.132 | 0.077 | 0.04 / -1.47 | 1.000 | +0.089 (1.77) | no |
| day london range all | 1,541 | -0.018 (-0.37) | -0.085 | 1,594 | -0.052 (-1.01) | -0.133 | 0.081 | -2.86 / -3.07 | 1.000 | +0.120 (2.52) | no |
| day london range agree | 760 | +0.018 (0.24) | -0.050 | 790 | -0.095 (-1.29) | -0.173 | 0.078 | -1.86 / -2.99 | 1.000 | +0.243 (3.07) | no |
| day ny 1R all | 2,830 | +0.024 (1.28) | -0.049 | 3,544 | -0.016 (-0.82) | -0.097 | 0.081 | 5.89 / 5.57 | 1.000 | +0.011 (0.56) | no |
| day ny 1R agree | 1,389 | +0.027 (1.09) | -0.044 | 1,780 | -0.021 (-0.77) | -0.102 | 0.081 | 4.69 / 3.50 | 1.000 | +0.018 (0.65) | no |
| day ny 2R all | 2,830 | +0.043 (1.71) | -0.029 | 3,544 | -0.006 (-0.24) | -0.087 | 0.081 | 1.06 / -0.07 | 1.000 | +0.020 (0.74) | no |
| day ny 2R agree | 1,389 | +0.061 (1.77) | -0.010 | 1,780 | -0.027 (-0.76) | -0.108 | 0.081 | 1.53 / -0.81 | 1.000 | +0.022 (0.61) | no |
| day ny range all | 2,745 | +0.026 (0.70) | -0.048 | 3,342 | -0.025 (-0.76) | -0.108 | 0.083 | -3.28 / -3.86 | 1.000 | +0.006 (0.18) | no |
| day ny range agree | 1,345 | +0.007 (0.14) | -0.066 | 1,673 | -0.070 (-1.64) | -0.154 | 0.084 | -2.53 / -3.58 | 1.000 | +0.007 (0.15) | no |
| week london 1R all | 687 | -0.104 (-2.91) | -0.165 | 622 | +0.065 (1.60) | -0.013 | 0.078 | -0.81 / 3.92 | 1.000 | -0.065 (-1.60) | no |
| week london 1R agree | 334 | -0.127 (-2.52) | -0.187 | 279 | -0.003 (-0.05) | -0.076 | 0.073 | -0.90 / 1.39 | 1.000 | +0.003 (0.05) | no |
| week london 2R all | 687 | -0.055 (-1.16) | -0.116 | 622 | +0.101 (1.84) | +0.023 | 0.078 | -1.83 / 1.53 | 1.000 | -0.041 (-0.78) | no |
| week london 2R agree | 334 | +0.002 (0.03) | -0.058 | 279 | +0.113 (1.42) | +0.040 | 0.073 | -0.46 / 1.12 | 1.000 | +0.029 (0.42) | no |
| week london range all | 686 | +0.088 (1.02) | +0.027 | 620 | +0.163 (1.61) | +0.085 | 0.078 | -0.49 / 0.58 | 1.000 | +0.090 (0.94) | no |
| week london range agree | 333 | +0.097 (0.73) | +0.037 | 277 | +0.127 (0.95) | +0.053 | 0.073 | -0.50 / 0.06 | 1.000 | +0.253 (1.86) | no |
| week ny 1R all | 1,352 | +0.025 (0.86) | -0.046 | 1,534 | -0.007 (-0.31) | -0.090 | 0.082 | 4.21 / 4.10 | 1.000 | +0.005 (0.20) | no |
| week ny 1R agree | 597 | -0.002 (-0.05) | -0.067 | 685 | -0.037 (-1.04) | -0.122 | 0.085 | 2.42 / 1.82 | 1.000 | +0.031 (0.89) | no |
| week ny 2R all | 1,352 | +0.085 (2.17) | +0.014 | 1,534 | +0.001 (0.02) | -0.082 | 0.082 | 1.84 / 0.15 | 1.000 | -0.009 (-0.26) | no |
| week ny 2R agree | 597 | +0.063 (1.11) | -0.002 | 685 | -0.044 (-0.85) | -0.129 | 0.085 | 1.04 / -0.84 | 1.000 | +0.023 (0.47) | no |
| week ny range all | 1,350 | +0.133 (2.08) | +0.062 | 1,526 | -0.083 (-1.78) | -0.166 | 0.083 | -0.38 / -3.92 | 1.000 | +0.034 (0.70) | no |
| week ny range agree | 597 | +0.085 (1.03) | +0.020 | 682 | -0.135 (-1.90) | -0.221 | 0.085 | -0.77 / -3.42 | 1.000 | +0.109 (1.44) | no |

## Checks

- Cut test: 10 cuts on xau, eurusd: 216,863 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (same for every cell and for the flipped trades).
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).
- Control gate: the "fade <session> 1R all" cells equal `grid7-wide-fade`'s "m15 none ext 1R <session>" cells trade for trade (london: n 32,446 / 37,546, -0.073 / -0.092R, same; ny: n 35,034 / 41,058, -0.089 / -0.112R, same).

| Market | candles from | signals | sweeps | simulated | dropped (bad data) | past the stop | risk under cost | unresolved | control off-session |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 38,668 | 3,281 | 16,711 | 3 | 97 | 2,886 | 1 | 18,971 |
| xag | 2006-03-19 | 38,911 | 3,336 | 8,227 | 31 | 455 | 11,056 | 0 | 19,142 |
| eurusd | 2004-01-01 | 43,144 | 3,564 | 20,459 | 8 | 53 | 462 | 0 | 22,134 |
| gbpusd | 2004-01-01 | 43,113 | 3,802 | 20,525 | 24 | 41 | 460 | 2 | 22,035 |
| usdjpy | 2004-01-01 | 41,038 | 2,367 | 17,563 | 14 | 50 | 1,365 | 0 | 22,016 |
| audusd | 2004-01-01 | 42,493 | 2,385 | 18,101 | 13 | 151 | 1,181 | 1 | 23,020 |
| nzdusd | 2004-01-01 | 42,314 | 2,557 | 17,754 | 0 | 101 | 1,689 | 2 | 22,744 |
| usdcad | 2004-01-01 | 43,685 | 3,689 | 20,218 | 18 | 83 | 1,398 | 1 | 21,933 |
| usdchf | 2004-01-01 | 42,855 | 3,605 | 19,435 | 23 | 132 | 1,375 | 1 | 21,859 |
| eurjpy | 2004-01-01 | 41,193 | 2,612 | 18,254 | 0 | 29 | 812 | 1 | 22,065 |

## What it means

No sweep cell clears the bar. Before costs the 36 sweep cells sit around zero in both decades (every cell between
-0.135 and +0.163R a trade; none has month t >= 2 in both windows, none survives Holm).
A sweep of the Asia range, the previous day or the previous week, entered against it at the next 5-minute open, is not a
tilt of its own, and the MSNR call agreeing does not change that.

**The control comparison.** 8 sweep cells beat their control in both windows, 8 of them at 1R. That is the control's
weakness, not the sweeps' strength: the plain M15 fade's stops are a few pips (a round trip takes
0.32-0.38R of it, against 0.07-0.10R for the sweeps), so a 5-minute candle that holds both its stop and its 1R target
is common and is booked as the stop (the pre-registered rule; see `grid7-wide-fade`): that weighs on the fade at 1R, which loses about 0.1R.
The fade's swing exit (+0.10R to +0.16R before costs, month t 3.6 to 6.2 in both decades) is a steadier before-cost tilt
than any sweep cell, and loses after costs. The sweeps' wider stops make them far cheaper to trade (about a fifth of the cost
in R), but there is no before-cost tilt to keep.

After costs 2 sweep cell(s) stay above zero in both windows (week london range all: +0.027 / +0.085R, n 686 / 620, before-cost t 1.02 / 1.61; week london range agree: +0.037 / +0.053R, n 333 / 277, before-cost t 0.73 / 0.95): picked after the fact
from 36, under t 2, not evidence. The side-flipped trades (WITH the sweep) pass nothing either.

Do not re-test variants of these 36 cells on these years. Nothing live changed; no rule is proposed.
