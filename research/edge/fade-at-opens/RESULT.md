# Opening prices as levels: cross, fade, failed cross (result)

**Verdict: FAIL. 0 of 57 cells pass; the best confirmation cell, nymid m15 fade 2R, made +0.029R a trade before costs in 2015-26 (n 130,258, month t 5.88; discovery +0.069R, t 13.32) against +0.082R for the plain fade rule at matched times (Welch t -8.79).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

Five opening prices as levels (the open of the 5-minute candle at 00:00 New York, at 08:30 New York, at 00:00 UTC, the
first candle of the week and of the month). On M15 (and H1 for the Weekly and Monthly opens): a close across the level
traded WITH it (1 ATR stop) or FADED (stop past the cross candle + 0.1 ATR), and a failed cross (through the level by 0.2 ATR,
a close back within 3 candles) traded back (stop past the extreme + 0.1 ATR); market entry at the next 5-minute open; 1R or
2R. 42 cells by level and timeframe, 15 by session and first / later cross (M15 levels pooled, 1R): 57. Ten markets pooled,
OANDA mid 5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026. Judged before costs on month
sums, Holm over the 57 confirmation tests, and against the plain `grid7-wide-fade` rule (every structure break on the same
timeframe, faded, same exit) at the nearest fill within 2 hours (trade-level Welch t >= 2 in both windows).
Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 57 of 57.
- Mean R > 0 and month t >= 2 in discovery: 10; in confirmation: 6; both: 6.
- Holm-adjusted p < 0.05: 5. Bars 1-4 together: 5 (nymid m15 fade 2R; ny0830 m15 fade 2R; dopen m15 fade 2R; wopen m15 fade 2R; wopen h1 fade 2R).
- Beats the plain fade rule at matched times in both windows (Welch t >= 2): 15.
- **All five: 0.**
- Of those, positive after costs in both windows: 0.
- Side flipped (same fills, traded the other way) passing bars 1-4: 8 (nymid m15 with 1R; nymid m15 with 2R; ny0830 m15 with 1R; ny0830 m15 with 2R; wopen m15 with 1R; wopen m15 with 2R; m15all with 1R other; m15all with 1R later).

## Every cell

R a trade before costs (month-sum t), after costs ("net") beside; "ctl" = the matched plain-fade trades' mean R, "W" = the
Welch t of the cell minus its control; "cost R" = mean round-trip cost / risk in 2015-26; "flip" = the same fills traded the
other way, before costs in 2015-26.

| Cell | n 05-14 | R 05-14 (t) | net | ctl (W) 05-14 | n 15-26 | R 15-26 (t) | net | ctl (W) 15-26 | cost R | Holm | flip 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| nymid m15 with 1R | 135,136 | -0.023 (-8.06) | -0.164 | -0.028 (1.29) | 160,764 | -0.017 (-6.23) | -0.178 | -0.036 (4.88) | 0.160 | 1.000 | +0.010 (3.65) | no |
| nymid m15 with 2R | 135,136 | -0.013 (-3.42) | -0.154 | +0.119 (-22.60) | 160,764 | -0.013 (-3.04) | -0.174 | +0.093 (-19.40) | 0.160 | 1.000 | +0.012 (3.76) | no |
| nymid m15 fade 1R | 113,238 | -0.049 (-13.18) | -0.378 | -0.040 (-2.18) | 130,258 | -0.072 (-18.36) | -0.468 | -0.048 (-5.55) | 0.397 | 1.000 | -0.150 (-35.30) | no |
| nymid m15 fade 2R | 113,238 | +0.069 (13.32) | -0.259 | +0.107 (-5.92) | 130,258 | +0.029 (5.88) | -0.368 | +0.082 (-8.79) | 0.397 | 0.000 | -0.068 (-14.90) | no |
| nymid m15 failed 1R | 81,722 | -0.009 (-2.16) | -0.154 | -0.005 (-0.73) | 95,186 | -0.002 (-0.52) | -0.170 | -0.016 (2.78) | 0.168 | 1.000 | -0.010 (-2.26) | no |
| nymid m15 failed 2R | 81,722 | +0.006 (0.88) | -0.139 | +0.159 (-20.28) | 95,186 | +0.008 (1.17) | -0.160 | +0.125 (-16.57) | 0.168 | 1.000 | +0.003 (0.51) | no |
| ny0830 m15 with 1R | 111,394 | -0.032 (-9.36) | -0.157 | -0.024 (-1.88) | 129,462 | -0.029 (-10.16) | -0.174 | -0.056 (6.19) | 0.145 | 1.000 | +0.022 (7.63) | no |
| ny0830 m15 with 2R | 111,394 | -0.032 (-6.50) | -0.156 | +0.104 (-20.97) | 129,462 | -0.026 (-5.45) | -0.171 | +0.067 (-15.14) | 0.145 | 1.000 | +0.019 (5.99) | no |
| ny0830 m15 fade 1R | 96,561 | -0.037 (-9.26) | -0.354 | -0.031 (-1.28) | 108,810 | -0.075 (-18.77) | -0.448 | -0.062 (-2.77) | 0.373 | 1.000 | -0.157 (-32.05) | no |
| ny0830 m15 fade 2R | 96,561 | +0.073 (12.87) | -0.243 | +0.096 (-3.30) | 108,810 | +0.026 (5.38) | -0.348 | +0.064 (-5.84) | 0.373 | 0.000 | -0.084 (-14.58) | no |
| ny0830 m15 failed 1R | 66,590 | -0.004 (-0.86) | -0.137 | -0.012 (1.32) | 76,387 | -0.007 (-1.64) | -0.162 | -0.031 (4.24) | 0.155 | 1.000 | -0.005 (-1.18) | no |
| ny0830 m15 failed 2R | 66,590 | +0.005 (0.64) | -0.127 | +0.120 (-13.58) | 76,387 | -0.005 (-0.77) | -0.160 | +0.101 (-13.31) | 0.155 | 1.000 | -0.002 (-0.35) | no |
| dopen m15 with 1R | 128,671 | -0.026 (-8.50) | -0.169 | -0.026 (0.02) | 152,657 | -0.013 (-4.89) | -0.175 | -0.050 (9.44) | 0.162 | 1.000 | +0.005 (1.78) | no |
| dopen m15 with 2R | 128,671 | -0.013 (-2.71) | -0.157 | +0.115 (-21.15) | 152,657 | -0.006 (-1.35) | -0.168 | +0.072 (-13.86) | 0.162 | 1.000 | +0.009 (3.04) | no |
| dopen m15 fade 1R | 107,364 | -0.045 (-11.92) | -0.378 | -0.038 (-1.59) | 123,621 | -0.077 (-18.18) | -0.477 | -0.062 (-3.33) | 0.399 | 1.000 | -0.142 (-33.43) | no |
| dopen m15 fade 2R | 107,364 | +0.067 (12.17) | -0.266 | +0.104 (-5.58) | 123,621 | +0.021 (4.32) | -0.379 | +0.061 (-6.46) | 0.399 | 0.001 | -0.054 (-11.16) | no |
| dopen m15 failed 1R | 77,520 | -0.002 (-0.42) | -0.149 | -0.012 (1.81) | 90,944 | +0.001 (0.29) | -0.170 | -0.027 (5.54) | 0.171 | 1.000 | -0.013 (-3.31) | no |
| dopen m15 failed 2R | 77,520 | +0.018 (2.92) | -0.129 | +0.136 (-15.06) | 90,944 | +0.015 (2.55) | -0.156 | +0.100 (-11.67) | 0.171 | 0.311 | -0.000 (-0.01) | no |
| wopen m15 with 1R | 61,014 | -0.033 (-7.79) | -0.168 | -0.052 (3.13) | 72,574 | -0.025 (-7.34) | -0.180 | -0.082 (9.58) | 0.154 | 1.000 | +0.019 (5.38) | no |
| wopen m15 with 2R | 61,014 | -0.027 (-4.14) | -0.163 | +0.078 (-11.91) | 72,574 | -0.027 (-5.30) | -0.182 | +0.036 (-7.75) | 0.154 | 1.000 | +0.014 (3.43) | no |
| wopen m15 fade 1R | 51,481 | -0.037 (-7.75) | -0.363 | -0.062 (3.76) | 59,494 | -0.073 (-13.75) | -0.462 | -0.094 (3.16) | 0.388 | 1.000 | -0.147 (-24.36) | no |
| wopen m15 fade 2R | 51,481 | +0.077 (10.07) | -0.249 | +0.063 (1.41) | 59,494 | +0.033 (4.80) | -0.355 | +0.026 (0.81) | 0.388 | 0.000 | -0.071 (-10.64) | no |
| wopen m15 failed 1R | 36,934 | -0.001 (-0.18) | -0.143 | -0.035 (4.25) | 42,790 | -0.020 (-3.59) | -0.182 | -0.057 (5.12) | 0.163 | 1.000 | +0.007 (1.27) | no |
| wopen m15 failed 2R | 36,934 | +0.004 (0.47) | -0.137 | +0.091 (-7.63) | 42,790 | -0.020 (-2.55) | -0.183 | +0.065 (-8.12) | 0.163 | 1.000 | +0.013 (1.58) | no |
| wopen h1 with 1R | 30,402 | -0.013 (-2.24) | -0.091 | +0.044 (-5.44) | 35,999 | +0.003 (0.56) | -0.087 | -0.000 (0.35) | 0.090 | 1.000 | -0.005 (-0.96) | no |
| wopen h1 with 2R | 30,402 | +0.015 (1.67) | -0.064 | +0.153 (-9.18) | 35,999 | +0.006 (0.68) | -0.084 | +0.080 (-5.41) | 0.090 | 1.000 | -0.004 (-0.65) | no |
| wopen h1 fade 1R | 28,761 | +0.027 (4.03) | -0.176 | +0.044 (-1.57) | 33,653 | -0.016 (-3.06) | -0.255 | +0.000 (-1.66) | 0.239 | 1.000 | -0.064 (-11.59) | no |
| wopen h1 fade 2R | 28,761 | +0.084 (9.18) | -0.119 | +0.155 (-4.61) | 33,653 | +0.025 (3.37) | -0.214 | +0.080 (-3.85) | 0.239 | 0.026 | -0.032 (-3.98) | no |
| wopen h1 failed 1R | 18,624 | -0.008 (-0.83) | -0.089 | +0.087 (-6.87) | 21,137 | -0.011 (-1.40) | -0.106 | +0.045 (-4.32) | 0.095 | 1.000 | +0.008 (1.05) | no |
| wopen h1 failed 2R | 18,624 | -0.005 (-0.38) | -0.086 | +0.218 (-11.16) | 21,137 | +0.010 (0.79) | -0.085 | +0.158 (-7.90) | 0.095 | 1.000 | +0.033 (2.84) | no |
| mopen m15 with 1R | 26,931 | -0.043 (-6.70) | -0.172 | -0.091 (5.16) | 30,872 | -0.022 (-3.81) | -0.164 | -0.095 (7.64) | 0.142 | 1.000 | +0.014 (2.55) | no |
| mopen m15 with 2R | 26,931 | -0.038 (-3.81) | -0.167 | +0.029 (-5.12) | 30,872 | -0.014 (-1.62) | -0.156 | -0.007 (-0.50) | 0.142 | 1.000 | +0.013 (2.04) | no |
| mopen m15 fade 1R | 23,219 | -0.042 (-5.93) | -0.353 | -0.101 (6.09) | 26,091 | -0.079 (-11.38) | -0.452 | -0.104 (2.35) | 0.372 | 1.000 | -0.156 (-15.56) | no |
| mopen m15 fade 2R | 23,219 | +0.077 (7.38) | -0.235 | +0.024 (3.80) | 26,091 | +0.015 (1.55) | -0.357 | -0.014 (2.08) | 0.372 | 1.000 | -0.079 (-6.90) | no |
| mopen m15 failed 1R | 16,399 | +0.008 (0.88) | -0.123 | -0.065 (6.16) | 18,229 | -0.012 (-1.41) | -0.165 | -0.064 (4.22) | 0.153 | 1.000 | +0.000 (0.03) | no |
| mopen m15 failed 2R | 16,399 | +0.013 (0.96) | -0.118 | +0.053 (-2.39) | 18,229 | -0.000 (-0.01) | -0.153 | +0.032 (-1.95) | 0.153 | 1.000 | +0.021 (1.80) | no |
| mopen h1 with 1R | 13,740 | -0.019 (-2.23) | -0.092 | +0.011 (-2.00) | 15,699 | +0.002 (0.34) | -0.080 | -0.028 (2.10) | 0.082 | 1.000 | -0.006 (-0.87) | no |
| mopen h1 with 2R | 13,740 | -0.004 (-0.29) | -0.076 | +0.107 (-5.00) | 15,699 | +0.007 (0.61) | -0.075 | +0.048 (-1.98) | 0.082 | 1.000 | -0.001 (-0.17) | no |
| mopen h1 fade 1R | 13,074 | +0.051 (4.77) | -0.139 | +0.010 (2.60) | 14,925 | -0.026 (-3.12) | -0.253 | -0.026 (-0.04) | 0.226 | 1.000 | -0.063 (-6.86) | no |
| mopen h1 fade 2R | 13,074 | +0.121 (8.28) | -0.069 | +0.106 (0.67) | 14,925 | +0.002 (0.13) | -0.225 | +0.051 (-2.34) | 0.226 | 1.000 | -0.035 (-2.91) | no |
| mopen h1 failed 1R | 8,457 | -0.003 (-0.23) | -0.078 | +0.071 (-3.67) | 9,244 | -0.009 (-0.75) | -0.097 | +0.029 (-1.94) | 0.088 | 1.000 | +0.005 (0.46) | no |
| mopen h1 failed 2R | 8,457 | -0.017 (-0.83) | -0.091 | +0.185 (-6.88) | 9,244 | -0.019 (-1.09) | -0.106 | +0.143 (-5.75) | 0.088 | 1.000 | +0.024 (1.38) | no |
| m15all with 1R london | 110,655 | -0.009 (-2.23) | -0.142 | -0.058 (10.82) | 130,050 | -0.009 (-2.01) | -0.155 | -0.087 (17.68) | 0.146 | 1.000 | +0.004 (0.95) | no |
| m15all with 1R ny | 124,065 | -0.009 (-2.18) | -0.124 | -0.081 (16.99) | 148,983 | -0.009 (-2.63) | -0.139 | -0.082 (18.85) | 0.129 | 1.000 | -0.001 (-0.20) | no |
| m15all with 1R other | 228,426 | -0.048 (-17.03) | -0.198 | +0.009 (-17.59) | 267,296 | -0.032 (-12.31) | -0.206 | -0.018 (-4.43) | 0.174 | 1.000 | +0.024 (9.48) | no |
| m15all with 1R first | 69,341 | -0.027 (-6.09) | -0.174 | -0.073 (8.09) | 83,088 | -0.009 (-2.17) | -0.174 | -0.091 (15.27) | 0.165 | 1.000 | +0.002 (0.56) | no |
| m15all with 1R later | 393,805 | -0.029 (-12.29) | -0.163 | -0.026 (-1.11) | 463,241 | -0.022 (-11.77) | -0.176 | -0.047 (10.82) | 0.154 | 1.000 | +0.015 (7.82) | no |
| m15all fade 1R london | 95,661 | -0.070 (-13.99) | -0.377 | -0.069 (-0.08) | 110,044 | -0.101 (-16.80) | -0.484 | -0.096 (-1.02) | 0.383 | 1.000 | -0.148 (-26.93) | no |
| m15all fade 1R ny | 111,376 | -0.077 (-15.12) | -0.359 | -0.090 (2.99) | 131,950 | -0.107 (-23.11) | -0.437 | -0.091 (-4.14) | 0.329 | 1.000 | -0.165 (-32.01) | no |
| m15all fade 1R other | 184,826 | -0.009 (-2.52) | -0.371 | +0.001 (-2.88) | 206,280 | -0.039 (-9.50) | -0.470 | -0.028 (-3.48) | 0.431 | 1.000 | -0.141 (-28.92) | no |
| m15all fade 1R first | 57,588 | -0.051 (-9.55) | -0.383 | -0.083 (5.19) | 66,878 | -0.082 (-15.73) | -0.479 | -0.105 (3.86) | 0.397 | 1.000 | -0.151 (-26.48) | no |
| m15all fade 1R later | 334,275 | -0.042 (-15.80) | -0.366 | -0.037 (-1.98) | 381,396 | -0.073 (-21.67) | -0.461 | -0.057 (-6.40) | 0.388 | 1.000 | -0.149 (-40.99) | no |
| m15all failed 1R london | 69,452 | -0.005 (-1.10) | -0.137 | -0.035 (5.28) | 79,082 | +0.001 (0.28) | -0.152 | -0.051 (9.78) | 0.153 | 1.000 | -0.011 (-2.46) | no |
| m15all failed 1R ny | 76,321 | -0.000 (-0.03) | -0.118 | -0.058 (10.79) | 91,116 | -0.010 (-2.08) | -0.144 | -0.058 (9.60) | 0.134 | 1.000 | -0.004 (-0.74) | no |
| m15all failed 1R other | 133,392 | -0.005 (-1.54) | -0.165 | +0.022 (-6.42) | 153,338 | -0.006 (-1.84) | -0.194 | -0.000 (-1.31) | 0.188 | 1.000 | -0.007 (-2.12) | no |
| m15all failed 1R first | 64,266 | -0.004 (-1.04) | -0.151 | -0.029 (4.25) | 76,995 | -0.004 (-0.85) | -0.173 | -0.048 (8.00) | 0.169 | 1.000 | -0.008 (-1.73) | no |
| m15all failed 1R later | 214,899 | -0.004 (-1.26) | -0.143 | -0.012 (2.49) | 246,541 | -0.006 (-2.19) | -0.168 | -0.025 (6.23) | 0.163 | 1.000 | -0.007 (-2.49) | no |

## Checks

- Cut test: 10 cuts on xau, eurusd: 926,084 events known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (same for the side-flipped check and the control).
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`). The control is the plain fade rule with the same filters; a cell trade with no control fill within 2 hours counts in the cell but not in the control comparison.

| Market | candles from | events | control M15 / H1 | simulated | dropped (bad data) | past the stop | risk under cost | unresolved | no control |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 166,857 | 25,764 / 8,510 | 243,020 | 15 | 762 | 26,973 | 0 | 71,855 |
| xag | 2006-03-19 | 167,464 | 8,169 / 4,904 | 145,801 | 326 | 4,014 | 122,204 | 0 | 88,046 |
| eurusd | 2004-01-01 | 183,937 | 36,011 / 10,054 | 290,220 | 87 | 722 | 7,744 | 0 | 55,804 |
| gbpusd | 2004-01-01 | 188,711 | 35,321 / 10,025 | 296,130 | 320 | 884 | 8,921 | 12 | 58,243 |
| usdjpy | 2004-01-01 | 176,664 | 33,859 / 9,882 | 272,881 | 253 | 696 | 12,099 | 13 | 63,940 |
| audusd | 2004-01-01 | 180,484 | 35,473 / 10,163 | 282,324 | 111 | 1,504 | 9,845 | 28 | 60,000 |
| nzdusd | 2004-01-01 | 185,660 | 33,713 / 9,944 | 286,625 | 2 | 1,160 | 13,785 | 25 | 67,700 |
| usdcad | 2004-01-01 | 193,209 | 34,228 / 10,024 | 299,734 | 237 | 1,009 | 13,373 | 2 | 66,438 |
| usdchf | 2004-01-01 | 190,374 | 32,266 / 9,768 | 291,101 | 277 | 2,213 | 15,201 | 22 | 70,219 |
| eurjpy | 2004-01-01 | 183,985 | 34,789 / 9,968 | 288,300 | 4 | 563 | 8,971 | 6 | 63,158 |

## What it means

No cell clears the bar. Opening prices as levels do not pick trades that beat the plain fade-the-break rule at the same
times in both decades, before costs. Do not re-test variants of these 57 cells on these years. Nothing live changed; no rule is proposed.

**The near misses.** 5 cell(s) clear bars 1-4 (nymid m15 fade 2R +0.029R, t 5.88; ny0830 m15 fade 2R +0.026R, t 5.38; dopen m15 fade 2R +0.021R, t 4.32; wopen m15 fade 2R +0.033R, t 4.80; wopen h1 fade 2R +0.025R, t 3.37),
but each does worse than or no better than the plain fade rule at the same times (2015-26 control +0.082 / +0.064 / +0.061 / +0.026 / +0.080R;
Welch t -8.79 / -5.84 / -6.46 / 0.81 / -3.85): fading a cross of an opening price is the general short-term pull-back
`grid7-wide-fade` already measured, and the opening price adds nothing to it. After costs every one loses (about -0.35R a trade:
the stop past the cross candle is small, so the round trip is about 0.4R).

**Side flipped.** 8 flipped cells clear bars 1-4 (the "with" cells traded against the cross with a
1 ATR stop): +0.01 to +0.02R a trade before costs, about a tenth of their round trip. Not pre-registered as cells, not a
finding: the same pull-back tilt again. The fade-at-1R cells (and their flips) are depressed by the pre-registered rule that
books a 5-minute candle holding both stop and target as the stop, which hits small stops hardest.
