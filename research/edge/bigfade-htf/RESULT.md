# Big-candle fade on H4 candles, after costs (result)

**Verdict: FAIL. 0 of 2 H4 big-candle fade tests pass after costs; the better, h4 k1.5 nobreak half, made -0.150R a trade after costs in 2015-26 (n 3,906, month t -3.97; -0.011R before costs, t -0.29; discovery -0.098R after costs, +0.036R before).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live changed, nothing is proposed. One run, no variants.

## H1: already answered by big-candle-fade (not re-run)

That study's own H1 cells, same rule and costs, R a trade (after costs):

| Cell | n 05-14 | before | after | n 15-26 | before (t) | after |
|---|---:|---:|---:|---:|---:|---:|
| h1 k1.5 nobreak half | 15,349 | +0.189 | -0.043 | 18,425 | +0.070 (3.68) | -0.190 |
| h1 k2 nobreak half | 6,603 | +0.122 | -0.107 | 7,256 | +0.057 (1.73) | -0.189 |

Every one of its 18 H1 cells is negative after costs in 2015-26.

## The two tests (H4), judged after costs

R a trade, month-sum t in brackets; "after" = after the round-trip cost (`combo-grid-2` `COSTS`; ASSUMED, not measured, for xag, nzdusd, usdcad, usdchf, eurjpy).

| Cell | n 05-14 | before (t) | after (t) | n 15-26 | before (t) | after (t) | cost R 15-26 | Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| h4 k1.5 nobreak half | 3,970 | +0.036 (0.82) | -0.098 (-2.39) | 3,906 | -0.011 (-0.29) | -0.150 (-3.97) | 0.139 | 1.000 | no |
| h4 k2 nobreak half | 1,630 | +0.042 (0.58) | -0.100 (-1.45) | 1,387 | -0.060 (-0.93) | -0.196 (-3.07) | 0.136 | 1.000 | no |

Checks per test: h4 k1.5 nobreak half: n yes, discNet no, confNet no, confT no, holm no; h4 k2 nobreak half: n yes, discNet no, confNet no, confT no, holm no.

## Controls

| Cell | n 05-14 | before (t) | after (t) | n 15-26 | before (t) | after (t) | cost R 15-26 |
|---|---:|---:|---:|---:|---:|---:|---:|
| h4 k1.5 nobreak half (mirror: with the candle) | 3,970 | -0.092 (-2.72) | -0.227 (-5.96) | 3,906 | -0.045 (-1.17) | -0.184 (-4.78) | 0.139 |
| h4 k2 nobreak half (mirror: with the candle) | 1,630 | -0.128 (-2.69) | -0.270 (-4.75) | 1,387 | -0.028 (-0.43) | -0.163 (-2.53) | 0.136 |
| h4 plain fade 1R | 12,317 | +0.030 (2.60) | -0.076 (-6.32) | 13,787 | +0.026 (2.34) | -0.101 (-8.94) | 0.127 |
| h4 plain fade 2R | 12,317 | +0.020 (1.26) | -0.086 (-5.47) | 13,787 | +0.037 (2.30) | -0.090 (-5.68) | 0.127 |
| h4 plain fade half | 7,520 | +0.047 (1.99) | -0.082 (-3.51) | 8,713 | +0.012 (0.59) | -0.139 (-7.02) | 0.151 |

## Every H4 cell (reported, not judged)

| Cell | n 05-14 | before (t) | after (t) | n 15-26 | before (t) | after (t) | cost R 15-26 |
|---|---:|---:|---:|---:|---:|---:|---:|
| h4 k1.5 break 1R | 3,663 | -0.013 (-0.58) | -0.124 (-5.29) | 3,838 | -0.009 (-0.46) | -0.137 (-6.82) | 0.128 |
| h4 k1.5 break 2R | 3,663 | -0.022 (-0.71) | -0.132 (-4.37) | 3,838 | +0.008 (0.29) | -0.120 (-4.24) | 0.128 |
| h4 k1.5 break half | 3,073 | -0.086 (-2.10) | -0.208 (-5.17) | 3,311 | -0.065 (-1.66) | -0.205 (-5.18) | 0.139 |
| h4 k1.5 nobreak 1R | 5,021 | +0.042 (2.36) | -0.075 (-4.09) | 4,681 | +0.018 (1.02) | -0.106 (-5.67) | 0.124 |
| h4 k1.5 nobreak 2R | 5,021 | +0.054 (1.97) | -0.063 (-2.44) | 4,681 | +0.016 (0.64) | -0.109 (-4.32) | 0.124 |
| h4 k1.5 nobreak half | 3,970 | +0.036 (0.82) | -0.098 (-2.39) | 3,906 | -0.011 (-0.29) | -0.150 (-3.97) | 0.139 |
| h4 k2 break 1R | 2,034 | -0.017 (-0.59) | -0.131 (-4.28) | 2,094 | -0.021 (-0.80) | -0.150 (-5.56) | 0.129 |
| h4 k2 break 2R | 2,034 | -0.032 (-0.84) | -0.146 (-3.87) | 2,094 | +0.012 (0.33) | -0.117 (-3.21) | 0.129 |
| h4 k2 break half | 1,774 | -0.127 (-2.29) | -0.251 (-4.56) | 1,886 | -0.063 (-1.09) | -0.201 (-3.44) | 0.138 |
| h4 k2 nobreak 1R | 2,060 | +0.051 (1.74) | -0.073 (-2.30) | 1,615 | +0.007 (0.21) | -0.117 (-3.86) | 0.124 |
| h4 k2 nobreak 2R | 2,060 | +0.078 (1.92) | -0.046 (-1.17) | 1,615 | -0.009 (-0.23) | -0.133 (-3.31) | 0.124 |
| h4 k2 nobreak half | 1,630 | +0.042 (0.58) | -0.100 (-1.45) | 1,387 | -0.060 (-0.93) | -0.196 (-3.07) | 0.136 |

## Per market, the two tests (after costs in brackets; * = cost ASSUMED)

### h4 k1.5 nobreak half

| Market | n 05-14 | before [after] | n 15-26 | before (t) [after] | cost R 15-26 |
|---|---:|---:|---:|---:|---:|
| xau | 376 | +0.106 [-0.078] | 362 | -0.078 (-0.82) [-0.219] | 0.142 |
| xag* | 341 | +0.016 [-0.417] | 307 | -0.003 (-0.03) [-0.435] | 0.433 |
| eurusd | 442 | -0.143 [-0.208] | 406 | -0.065 (-0.68) [-0.159] | 0.094 |
| gbpusd | 449 | -0.051 [-0.133] | 422 | -0.072 (-0.77) [-0.161] | 0.089 |
| usdjpy | 388 | +0.118 [-0.018] | 428 | +0.009 (0.09) [-0.104] | 0.114 |
| audusd | 371 | +0.035 [-0.050] | 405 | -0.155 (-1.51) [-0.276] | 0.120 |
| nzdusd* | 354 | +0.235 [+0.132] | 312 | -0.203 (-2.16) [-0.333] | 0.130 |
| usdcad* | 414 | +0.190 [+0.078] | 423 | +0.028 (0.30) [-0.076] | 0.104 |
| usdchf* | 414 | -0.007 [-0.102] | 385 | +0.268 (2.06) [+0.142] | 0.127 |
| eurjpy* | 421 | -0.083 [-0.187] | 456 | +0.108 (1.01) [-0.006] | 0.114 |

### h4 k2 nobreak half

| Market | n 05-14 | before [after] | n 15-26 | before (t) [after] | cost R 15-26 |
|---|---:|---:|---:|---:|---:|
| xau | 191 | +0.119 [-0.060] | 143 | -0.147 (-1.10) [-0.278] | 0.131 |
| xag* | 159 | -0.021 [-0.420] | 138 | -0.054 (-0.32) [-0.443] | 0.389 |
| eurusd | 186 | -0.105 [-0.174] | 152 | -0.010 (-0.06) [-0.099] | 0.089 |
| gbpusd | 183 | -0.089 [-0.175] | 161 | -0.190 (-1.23) [-0.269] | 0.079 |
| usdjpy | 136 | +0.067 [-0.081] | 138 | -0.076 (-0.45) [-0.191] | 0.115 |
| audusd | 129 | +0.190 [+0.093] | 113 | -0.328 (-1.57) [-0.456] | 0.128 |
| nzdusd* | 138 | +0.460 [+0.347] | 107 | -0.278 (-1.41) [-0.403] | 0.126 |
| usdcad* | 166 | +0.101 [-0.029] | 163 | -0.013 (-0.07) [-0.111] | 0.098 |
| usdchf* | 166 | -0.032 [-0.129] | 140 | +0.336 (1.48) [+0.226] | 0.111 |
| eurjpy* | 176 | -0.134 [-0.248] | 132 | +0.070 (0.33) [-0.042] | 0.111 |

## Checks

- Cut test: 10 cuts on xau, eurusd: 10,364 big-candle signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a risk under the round-trip cost is no trade; the ATR that sizes a candle is taken on the 14 candles before it; the fill is the next 5-minute open; time limit 8 days.
- Exclusions: the data-quality audit's bad intervals.

## What it means

The big-candle fade does not survive costs on H4 either. A before-cost tilt is not an edge. Nothing is adopted; do not re-test variants on these years.
