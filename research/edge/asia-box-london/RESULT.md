# The Asia box met by London and New York (result)

**Verdict: FAIL. 0 of 44 cells pass; the best confirmation cell, b fade box, made +0.133R a trade before costs in 2015-26 (n 24,194, month t 4.78; discovery +0.138R, t 4.22; against its control Welch t -0.16 / 0.17).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

The Asia box = the high and low of the 5-minute candles starting 00:00-07:00 UTC on a weekday. On closed M15 candles that
start 07:00-16:45 UTC: (a) the first close out of the box, traded WITH it; (b) the same close, FADED; (c) the first wick
beyond the box that closes back inside within 3 candles, traded back; (d) after (a), the first close out of the OTHER side,
traded with it. Market entry at the next 5-minute open, stop past the relevant candle extreme by 0.1 M15 ATR, exits 1R, 2R,
the box height projected from the fill, or the 21:00 UTC close (everything closed by 21:00). Splits at 2R: box height against
the Daily ATR, the Daily MSNR call agreeing with the trade, London (close by 12:00) or New York. Ten markets pooled, OANDA mid
5-minute candles; discovery 2005-2014, confirmation 2015 to October 2026; judged before costs on month sums, Holm over the 44
confirmation tests, and against a control (b, c: the plain M15 fade rule in the same hours; a, d: a random-time M15 entry,
same side and session, on another day of the same window).
Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 43 of 44.
- Mean R > 0 and month t >= 2 in discovery: 13; in confirmation: 9; both: 8.
- Holm-adjusted p < 0.05: 4.
- Beats its control (Welch t >= 2 in both windows): 3.
- **All five: 0.**
- Of those, positive after costs in both windows: 0.

## Every cell

R a trade before costs (month-sum t), after costs beside; control = the cell's control in the same window; vs = Welch t of
the cell against its control (discovery / confirmation).

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | control R 05-14 / 15-26 | vs | Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| a with 1R | 23,559 | -0.011 (-1.34) | -0.119 | 28,423 | -0.012 (-1.69) | -0.135 | -0.010 / -0.041 | -0.10 / 3.50 | 1.000 | no |
| a with 2R | 23,559 | -0.006 (-0.54) | -0.114 | 28,423 | -0.004 (-0.38) | -0.127 | +0.045 / -0.006 | -3.98 / 0.18 | 1.000 | no |
| a with box | 23,559 | +0.013 (0.92) | -0.095 | 28,423 | +0.001 (0.10) | -0.121 | +0.093 / +0.030 | -3.32 / -1.31 | 1.000 | no |
| a with 21:00 | 23,559 | +0.033 (1.58) | -0.075 | 28,423 | -0.003 (-0.15) | -0.126 | +0.112 / +0.037 | -2.33 / -1.36 | 1.000 | no |
| b fade 1R | 20,431 | -0.093 (-11.00) | -0.375 | 24,194 | -0.091 (-12.19) | -0.444 | -0.081 / -0.102 | -1.45 / 1.45 | 1.000 | no |
| b fade 2R | 20,431 | +0.017 (1.54) | -0.265 | 24,194 | +0.018 (1.71) | -0.335 | +0.028 / +0.004 | -0.90 / 1.38 | 1.000 | no |
| b fade box | 20,431 | +0.138 (4.22) | -0.144 | 24,194 | +0.133 (4.78) | -0.221 | +0.143 / +0.127 | -0.16 / 0.17 | 0.000 | no |
| b fade 21:00 | 20,431 | +0.169 (3.45) | -0.113 | 24,194 | +0.172 (4.25) | -0.182 | +0.178 / +0.166 | -0.19 / 0.13 | 0.001 | no |
| c false break 1R | 16,290 | +0.018 (1.99) | -0.136 | 19,922 | -0.002 (-0.24) | -0.182 | -0.081 / -0.102 | 11.33 / 12.52 | 1.000 | no |
| c false break 2R | 16,290 | +0.056 (4.35) | -0.098 | 19,922 | +0.034 (2.86) | -0.147 | +0.028 / +0.004 | 2.28 / 2.67 | 0.098 | no |
| c false break box | 16,290 | +0.089 (3.75) | -0.065 | 19,922 | +0.051 (2.74) | -0.130 | +0.143 / +0.127 | -2.19 / -3.42 | 0.135 | no |
| c false break 21:00 | 16,290 | +0.179 (5.05) | +0.025 | 19,922 | +0.049 (1.72) | -0.132 | +0.178 / +0.166 | 0.05 / -3.70 | 1.000 | no |
| d second break 1R | 6,403 | +0.013 (0.96) | -0.074 | 7,304 | -0.008 (-0.62) | -0.104 | -0.041 / -0.042 | 3.14 / 2.11 | 1.000 | no |
| d second break 2R | 6,403 | +0.037 (1.94) | -0.050 | 7,304 | -0.005 (-0.29) | -0.101 | -0.007 / +0.013 | 1.85 / -0.80 | 1.000 | no |
| d second break box | 6,403 | +0.045 (2.13) | -0.041 | 7,304 | -0.014 (-0.72) | -0.110 | +0.056 / +0.068 | -0.26 / -2.23 | 1.000 | no |
| d second break 21:00 | 6,403 | +0.047 (1.51) | -0.040 | 7,304 | +0.011 (0.36) | -0.085 | +0.077 / +0.122 | -0.57 / -2.14 | 1.000 | no |
| a with 2R height<0.3 | 7,956 | +0.005 (0.31) | -0.131 | 8,532 | +0.010 (0.61) | -0.120 | +0.064 / +0.004 | -2.63 / 0.26 | 1.000 | no |
| a with 2R height 0.3-0.6 | 12,563 | -0.007 (-0.50) | -0.105 | 16,034 | -0.015 (-1.20) | -0.139 | +0.037 / -0.011 | -2.50 / -0.27 | 1.000 | no |
| a with 2R height>0.6 | 3,040 | -0.030 (-1.24) | -0.104 | 3,857 | +0.010 (0.38) | -0.093 | +0.031 / -0.010 | -1.74 / 0.64 | 1.000 | no |
| a with 2R MSNR agree | 11,878 | +0.021 (1.42) | -0.087 | 14,274 | -0.009 (-0.66) | -0.133 | +0.041 / +0.005 | -1.12 / -0.83 | 1.000 | no |
| a with 2R MSNR disagree | 11,681 | -0.033 (-2.24) | -0.141 | 14,149 | +0.001 (0.05) | -0.121 | +0.050 / -0.017 | -4.53 / 1.09 | 1.000 | no |
| a with 2R London | 20,016 | -0.008 (-0.67) | -0.120 | 23,775 | -0.005 (-0.47) | -0.131 | +0.055 / -0.007 | -4.45 / 0.10 | 1.000 | no |
| a with 2R New York | 3,543 | +0.006 (0.26) | -0.079 | 4,648 | +0.003 (0.17) | -0.107 | -0.007 / -0.003 | 0.42 / 0.22 | 1.000 | no |
| b fade 2R height<0.3 | 6,405 | +0.026 (1.45) | -0.289 | 7,046 | +0.005 (0.26) | -0.365 | +0.035 / +0.004 | -0.44 / 0.04 | 1.000 | no |
| b fade 2R height 0.3-0.6 | 11,178 | +0.007 (0.46) | -0.269 | 13,687 | +0.028 (2.05) | -0.327 | +0.017 / +0.007 | -0.68 / 1.50 | 0.766 | no |
| b fade 2R height>0.6 | 2,848 | +0.041 (1.39) | -0.195 | 3,461 | +0.009 (0.41) | -0.306 | +0.050 / -0.006 | -0.29 / 0.55 | 1.000 | no |
| b fade 2R MSNR agree | 10,111 | +0.023 (1.55) | -0.255 | 12,078 | +0.024 (1.64) | -0.327 | +0.019 / +0.007 | 0.25 / 1.16 | 1.000 | no |
| b fade 2R MSNR disagree | 10,320 | +0.012 (0.84) | -0.274 | 12,116 | +0.013 (0.93) | -0.343 | +0.036 / +0.001 | -1.51 / 0.79 | 1.000 | no |
| b fade 2R London | 17,179 | +0.024 (1.93) | -0.263 | 20,100 | +0.022 (1.83) | -0.338 | +0.038 / +0.013 | -1.08 / 0.77 | 1.000 | no |
| b fade 2R New York | 3,252 | -0.017 (-0.65) | -0.272 | 4,094 | -0.002 (-0.10) | -0.321 | +0.017 / -0.004 | -1.34 / 0.09 | 1.000 | no |
| c false break 2R height<0.3 | 5,203 | +0.068 (3.14) | -0.118 | 5,776 | +0.038 (1.80) | -0.150 | +0.035 / +0.004 | 1.52 / 1.62 | 1.000 | no |
| c false break 2R height 0.3-0.6 | 8,842 | +0.043 (2.61) | -0.101 | 11,279 | +0.044 (3.12) | -0.139 | +0.017 / +0.007 | 1.57 / 2.52 | 0.044 | no |
| c false break 2R height>0.6 | 2,245 | +0.077 (2.39) | -0.037 | 2,867 | -0.016 (-0.56) | -0.169 | +0.050 / -0.006 | 0.81 / -0.33 | 1.000 | no |
| c false break 2R MSNR agree | 8,108 | +0.064 (3.96) | -0.088 | 9,916 | +0.033 (2.14) | -0.146 | +0.019 / +0.007 | 2.58 / 1.66 | 0.643 | no |
| c false break 2R MSNR disagree | 8,182 | +0.048 (3.02) | -0.108 | 10,006 | +0.035 (2.14) | -0.147 | +0.036 / +0.001 | 0.65 / 2.12 | 0.643 | no |
| c false break 2R London | 14,820 | +0.058 (4.27) | -0.097 | 17,831 | +0.040 (3.17) | -0.142 | +0.038 / +0.013 | 1.38 / 2.07 | 0.039 | no |
| c false break 2R New York | 1,470 | +0.034 (1.05) | -0.104 | 2,091 | -0.018 (-0.59) | -0.188 | +0.017 / -0.004 | 0.46 / -0.44 | 1.000 | no |
| d second break 2R height<0.3 | 3,405 | +0.047 (2.02) | -0.051 | 3,466 | -0.008 (-0.35) | -0.107 | -0.007 / -0.002 | 1.67 / -0.19 | 1.000 | no |
| d second break 2R height 0.3-0.6 | 2,815 | +0.029 (1.02) | -0.046 | 3,583 | -0.004 (-0.14) | -0.098 | -0.008 / +0.024 | 1.04 / -0.87 | 1.000 | no |
| d second break 2R height>0.6 | 183 | -0.040 (-0.40) | -0.099 | 255 | +0.014 (0.16) | -0.061 | +0.013 / +0.052 | -0.39 / -0.33 | 1.000 | no |
| d second break 2R MSNR agree | 3,193 | +0.043 (1.80) | -0.048 | 3,563 | +0.018 (0.72) | -0.079 | +0.027 / +0.024 | 0.48 / -0.19 | 1.000 | no |
| d second break 2R MSNR disagree | 3,210 | +0.030 (1.19) | -0.052 | 3,741 | -0.027 (-1.20) | -0.122 | -0.041 / +0.002 | 2.14 / -0.94 | 1.000 | no |
| d second break 2R London | 1,989 | +0.057 (1.52) | -0.032 | 2,104 | +0.034 (0.96) | -0.064 | -0.028 / +0.021 | 1.93 / 0.31 | 1.000 | no |
| d second break 2R New York | 4,414 | +0.027 (1.32) | -0.058 | 5,200 | -0.021 (-1.06) | -0.116 | +0.002 / +0.009 | 0.90 / -1.18 | 1.000 | no |

## Checks

- Cut test: 15 cuts on xau, eurusd, usdjpy: 123,025 events known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (events and controls alike).
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | Asia boxes | events | trades (a / b / c / d) | fade control trades | twins not found | dropped | past the stop | risk under cost |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 5,310 | 14,970 | 13,801 (4,991 / 3,969 / 3,478 / 1,363) | 13,330 | 0 | 0 | 130 | 4,634 |
| xag | 2006-03-19 | 5,229 | 14,806 | 8,783 (4,036 / 1,284 / 2,216 / 1,247) | 4,878 | 0 | 76 | 696 | 23,094 |
| eurusd | 2004-01-01 | 5,663 | 16,651 | 16,408 (5,532 / 5,311 / 3,829 / 1,736) | 16,593 | 0 | 24 | 72 | 703 |
| gbpusd | 2004-01-01 | 5,662 | 16,778 | 16,503 (5,529 / 5,282 / 3,844 / 1,848) | 16,497 | 0 | 49 | 51 | 740 |
| usdjpy | 2004-01-01 | 5,664 | 14,657 | 14,155 (5,108 / 4,643 / 3,547 / 857) | 15,029 | 0 | 31 | 78 | 2,032 |
| audusd | 2004-01-01 | 5,660 | 14,942 | 14,473 (5,164 / 4,721 / 3,749 / 839) | 15,514 | 0 | 26 | 220 | 1,707 |
| nzdusd | 2004-01-01 | 5,659 | 15,258 | 14,651 (5,222 / 4,636 / 3,886 / 907) | 15,034 | 0 | 0 | 143 | 2,445 |
| usdcad | 2004-01-01 | 5,660 | 17,308 | 16,593 (5,575 / 4,901 / 4,045 / 2,072) | 16,400 | 0 | 45 | 124 | 2,234 |
| usdchf | 2004-01-01 | 5,661 | 16,832 | 16,138 (5,538 / 4,890 / 3,904 / 1,806) | 15,606 | 0 | 48 | 203 | 2,136 |
| eurjpy | 2004-01-01 | 5,663 | 15,337 | 15,021 (5,287 / 4,988 / 3,714 / 1,032) | 15,468 | 0 | 0 | 48 | 1,217 |

## What it means

No cell clears the bar: trading the first London / New York move out of the Asia box with it, against it, back after a
false break, or with a second break the other way does not make money before costs in both decades while beating its control.
Do not re-test variants of these 44 cells on these years. Nothing live changed; no rule is proposed.

**Near misses** (every check but one; reported, not a pass):

- b fade box: +0.133R a trade before costs in 2015-26 (n 24,194, month t 4.78; 2005-14 +0.138R, t 4.22), Holm 0.000, against its control Welch t -0.16 / 0.17; after costs -0.221R. Missed: control.
- b fade 21:00: +0.172R a trade before costs in 2015-26 (n 24,194, month t 4.25; 2005-14 +0.169R, t 3.45), Holm 0.001, against its control Welch t -0.19 / 0.13; after costs -0.182R. Missed: control.
- c false break 2R: +0.034R a trade before costs in 2015-26 (n 19,922, month t 2.86; 2005-14 +0.056R, t 4.35), Holm 0.098, against its control Welch t 2.28 / 2.67; after costs -0.147R. Missed: holm.
- c false break 2R height 0.3-0.6: +0.044R a trade before costs in 2015-26 (n 11,279, month t 3.12; 2005-14 +0.043R, t 2.61), Holm 0.044, against its control Welch t 1.57 / 2.52; after costs -0.139R. Missed: control.
- c false break 2R London: +0.040R a trade before costs in 2015-26 (n 17,831, month t 3.17; 2005-14 +0.058R, t 4.27), Holm 0.039, against its control Welch t 1.38 / 2.07; after costs -0.142R. Missed: control.

**The fade is the plain fade.** Fading the first close out of the Asia box made +0.133R (box target) and +0.172R (21:00 close)
a trade before costs in 2015-26, and the plain M15 fade rule in the same hours made +0.127R and +0.166R (Welch t 0.17 and 0.13):
the Asia box adds nothing to the short-term pull-back `grid7-wide-fade` already found, and after costs every fade cell loses.
