# Right after an MSNR switch: fade the first pullback, take the first break, enter on the switch (result)

**Verdict: INCONCLUSIVE. 0 of 42 cells pass; the best confirmation cell, LH a0-1 key, made +0.291R a trade before costs in 2015-26 (n 4,198, month t 3.72; discovery +0.230R, t 2.70; aOld Welch t -0.17 / 0.82, aPlain Welch t -0.46 / 1.19).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

The desk's direction call (`council/eg-methods.mjs` `direction()`, imported unchanged) on two ladders: **L4** working H4 with
Daily key levels, trades on M15; **LH** working H1 with H4 key levels, trades on M5. After each switch of the call to side s:
**(a)** the first trigger-chart structure break AGAINST s, faded (entered with s); **(b)** the first break WITH s, entered with
it; **(c)** entry with s on the switch candle's close. (a) and (b) split by the call's age at the trigger (0-1, 2-5, 6-20
working candles). Market entry at the next 5-minute open; stop past the trigger leg + 0.1 ATR (a, b) or past the tapped key
zone + 0.1 ATR (c); exits 1R, 2R or the nearest opposite key-timeframe turn of the closes (only when 1R or more away); time
limit 1 day (L4) / 8 hours (LH). 42 cells, ten markets pooled, OANDA mid 5-minute candles, discovery 2005-14, confirmation
2015 to October 2026. Judged before costs on month sums, Holm over the 42, and against controls: the same triggers under a call
older than 20 working candles (and, for (a), the plain fade of every break whatever the call).
Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 35 of 42.
- Mean R > 0 and month t >= 2 in discovery: 6; in confirmation: 1; both: 1.
- Holm-adjusted p < 0.05: 1.
- Beats its control(s) by Welch t >= 2 in both windows: 1.
- **All: 0.**

## Every cell

R a trade before costs (month-sum t); after costs beside ("net"). "vs ctl" = trade-level Welch t of the cell minus each control,
discovery / confirmation (for (a): old-call fade, then plain fade).

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | cost R | Holm | vs ctl | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| L4 a0-1 1R | 1,396 | -0.016 (-0.59) | -0.343 | 1,757 | -0.055 (-2.17) | -0.426 | 0.371 | 1.000 | 0.28 / -0.44; 0.33 / -0.32 | no |
| L4 a0-1 2R | 1,396 | +0.129 (3.29) | -0.198 | 1,757 | +0.032 (0.87) | -0.339 | 0.371 | 1.000 | 0.77 / -0.66; 0.92 / -0.66 | no |
| L4 a0-1 key | 1,294 | +0.138 (1.08) | -0.192 | 1,617 | +0.021 (0.19) | -0.356 | 0.377 | 1.000 | -1.26 / -1.29; -0.91 / -1.39 | no |
| L4 a2-5 1R | 642 | +0.092 (2.32) | -0.254 | 903 | -0.019 (-0.56) | -0.418 | 0.399 | 1.000 | 2.90 / 0.74; 2.95 / 0.84 | no |
| L4 a2-5 2R | 642 | +0.243 (4.16) | -0.103 | 903 | +0.088 (1.83) | -0.312 | 0.399 | 1.000 | 2.45 / 0.67; 2.55 / 0.68 | no |
| L4 a2-5 key | 569 | +0.142 (0.70) | -0.207 | 787 | +0.016 (0.09) | -0.393 | 0.409 | 1.000 | -0.80 / -0.83; -0.57 / -0.88 | no |
| L4 a6-20 1R | 54 | -0.069 (-0.59) | -0.422 | 54 | +0.108 (0.86) | -0.249 | 0.357 | 1.000 | -0.33 / 1.11; -0.32 / 1.13 | no |
| L4 a6-20 2R | 54 | -0.171 (-1.00) | -0.523 | 54 | +0.275 (1.28) | -0.083 | 0.357 | 1.000 | -1.46 / 1.08; -1.43 / 1.08 | no |
| L4 a6-20 key | 47 | +1.242 (0.83) | +0.879 | 40 | -0.749 (-2.56) | -1.110 | 0.361 | 1.000 | 0.62 / -3.11; 0.66 / -3.15 | no |
| L4 b0-1 1R | 1,726 | -0.041 (-1.62) | -0.100 | 2,326 | +0.005 (0.22) | -0.066 | 0.071 | 1.000 | -1.17 / 1.41 | no |
| L4 b0-1 2R | 1,726 | -0.023 (-0.69) | -0.082 | 2,326 | -0.005 (-0.15) | -0.076 | 0.071 | 1.000 | -0.73 / 0.79 | no |
| L4 b0-1 key | 1,311 | -0.103 (-2.17) | -0.167 | 1,720 | -0.003 (-0.06) | -0.078 | 0.076 | 1.000 | -2.42 / 0.51 | no |
| L4 b2-5 1R | 669 | -0.004 (-0.10) | -0.087 | 945 | -0.032 (-1.05) | -0.125 | 0.093 | 1.000 | 0.25 / -0.23 | no |
| L4 b2-5 2R | 669 | -0.054 (-1.07) | -0.137 | 945 | -0.004 (-0.10) | -0.097 | 0.093 | 1.000 | -1.05 / 0.50 | no |
| L4 b2-5 key | 545 | -0.138 (-1.93) | -0.225 | 768 | -0.008 (-0.12) | -0.106 | 0.098 | 1.000 | -1.79 / 0.25 | no |
| L4 b6-20 1R | 47 | -0.095 (-0.62) | -0.163 | 35 | +0.220 (1.47) | +0.161 | 0.059 | 1.000 | -0.57 / 1.49 | no |
| L4 b6-20 2R | 47 | -0.204 (-0.99) | -0.273 | 35 | +0.072 (0.31) | +0.013 | 0.059 | 1.000 | -1.12 / 0.42 | no |
| L4 b6-20 key | 35 | -0.259 (-1.25) | -0.340 | 29 | -0.027 (-0.08) | -0.094 | 0.066 | 1.000 | -1.25 / -0.01 | no |
| L4 c 1R | 2,501 | +0.025 (2.28) | +0.012 | 3,388 | +0.011 (1.10) | -0.004 | 0.016 | 1.000 | 1.50 / 0.39 | no |
| L4 c 2R | 2,501 | +0.024 (1.97) | +0.011 | 3,388 | +0.012 (1.03) | -0.004 | 0.016 | 1.000 | 0.80 / 0.81 | no |
| L4 c key | 884 | +0.000 (0.01) | -0.018 | 1,195 | +0.006 (0.25) | -0.017 | 0.023 | 1.000 | -0.26 / 0.85 | no |
| LH a0-1 1R | 4,381 | -0.128 (-8.24) | -0.531 | 4,710 | -0.132 (-8.65) | -0.615 | 0.482 | 1.000 | -0.73 / -0.34; -0.88 / -0.13 | no |
| LH a0-1 2R | 4,381 | +0.041 (1.72) | -0.362 | 4,710 | +0.018 (0.87) | -0.464 | 0.482 | 1.000 | -0.28 / -0.39; -0.57 / -0.22 | no |
| LH a0-1 key | 3,857 | +0.230 (2.70) | -0.178 | 4,198 | +0.291 (3.72) | -0.197 | 0.488 | 0.006 | -0.17 / 0.82; -0.46 / 1.19 | no |
| LH a2-5 1R | 3,180 | -0.113 (-6.38) | -0.523 | 3,451 | -0.144 (-7.93) | -0.637 | 0.494 | 1.000 | 0.22 / -0.95; 0.10 / -0.78 | no |
| LH a2-5 2R | 3,180 | +0.040 (1.38) | -0.371 | 3,451 | +0.016 (0.65) | -0.478 | 0.494 | 1.000 | -0.29 / -0.41; -0.53 / -0.27 | no |
| LH a2-5 key | 2,604 | +0.255 (2.78) | -0.158 | 2,824 | +0.115 (1.30) | -0.386 | 0.500 | 1.000 | 0.12 / -1.23; -0.13 / -0.92 | no |
| LH a6-20 1R | 389 | -0.207 (-3.71) | -0.635 | 447 | -0.210 (-4.31) | -0.720 | 0.511 | 1.000 | -1.79 / -1.77; -1.83 / -1.70 | no |
| LH a6-20 2R | 389 | -0.066 (-0.91) | -0.494 | 447 | -0.078 (-1.18) | -0.589 | 0.511 | 1.000 | -1.61 / -1.58; -1.70 / -1.53 | no |
| LH a6-20 key | 250 | +0.220 (0.66) | -0.216 | 295 | -0.060 (-0.30) | -0.589 | 0.529 | 1.000 | -0.08 / -1.44; -0.15 / -1.30 | no |
| LH b0-1 1R | 6,911 | -0.018 (-1.52) | -0.106 | 8,511 | -0.022 (-1.79) | -0.129 | 0.107 | 1.000 | 0.94 / 1.40 | no |
| LH b0-1 2R | 6,911 | -0.016 (-0.97) | -0.104 | 8,511 | -0.007 (-0.41) | -0.114 | 0.107 | 1.000 | 1.11 / 2.72 | no |
| LH b0-1 key | 4,191 | -0.029 (-1.09) | -0.126 | 5,290 | -0.036 (-1.52) | -0.151 | 0.115 | 1.000 | 1.11 / 1.03 | no |
| LH b2-5 1R | 3,838 | -0.014 (-0.89) | -0.124 | 4,569 | -0.024 (-1.75) | -0.148 | 0.124 | 1.000 | 0.91 / 0.87 | no |
| LH b2-5 2R | 3,838 | -0.013 (-0.58) | -0.123 | 4,569 | -0.016 (-0.94) | -0.140 | 0.124 | 1.000 | 0.93 / 1.51 | no |
| LH b2-5 key | 2,664 | -0.057 (-1.69) | -0.177 | 3,143 | +0.041 (1.19) | -0.090 | 0.131 | 1.000 | 0.02 / 3.10 | no |
| LH b6-20 1R | 443 | -0.024 (-0.55) | -0.157 | 438 | +0.042 (0.87) | -0.091 | 0.133 | 1.000 | 0.11 / 1.65 | no |
| LH b6-20 2R | 443 | -0.037 (-0.60) | -0.170 | 438 | +0.012 (0.17) | -0.122 | 0.133 | 1.000 | -0.06 / 0.90 | no |
| LH b6-20 key | 362 | -0.094 (-0.91) | -0.236 | 357 | -0.057 (-0.57) | -0.187 | 0.130 | 1.000 | -0.38 / 0.03 | no |
| LH c 1R | 11,805 | +0.006 (1.09) | -0.024 | 14,388 | +0.009 (1.35) | -0.030 | 0.039 | 1.000 | 3.18 / 1.40 | no |
| LH c 2R | 11,805 | +0.007 (1.12) | -0.023 | 14,388 | +0.011 (1.57) | -0.028 | 0.039 | 1.000 | 2.87 / 1.50 | no |
| LH c key | 3,584 | +0.010 (0.60) | -0.037 | 4,499 | +0.013 (0.72) | -0.044 | 0.057 | 1.000 | 3.25 / 2.96 | no |

## The controls

| Control | n 05-14 | R 05-14 (t) | n 15-26 | R 15-26 (t) | net 15-26 |
|---|---:|---:|---:|---:|---:|
| L4 aOld 1R | 51,796 | -0.023 (-4.72) | 56,318 | -0.044 (-8.71) | -0.423 |
| L4 aOld 2R | 51,796 | +0.099 (14.98) | 56,318 | +0.055 (8.13) | -0.323 |
| L4 aOld key | 38,997 | +0.311 (8.24) | 43,414 | +0.169 (5.11) | -0.214 |
| L4 aPlain 1R | 146,496 | -0.025 (-7.12) | 166,715 | -0.047 (-13.35) | -0.429 |
| L4 aPlain 2R | 146,496 | +0.093 (19.44) | 166,715 | +0.055 (12.53) | -0.327 |
| L4 aPlain key | 129,413 | +0.261 (11.91) | 147,866 | +0.178 (9.31) | -0.207 |
| L4 bOld 1R | 63,406 | -0.013 (-2.01) | 71,232 | -0.025 (-4.64) | -0.105 |
| L4 bOld 2R | 63,406 | +0.000 (0.01) | 71,232 | -0.027 (-3.21) | -0.107 |
| L4 bOld key | 40,212 | +0.008 (0.43) | 46,969 | -0.025 (-1.70) | -0.112 |
| L4 cOld 1R | 1,693 | +0.002 (0.17) | 2,153 | +0.006 (0.53) | -0.009 |
| L4 cOld 2R | 1,693 | +0.010 (0.76) | 2,153 | -0.001 (-0.06) | -0.016 |
| L4 cOld key | 434 | +0.014 (0.27) | 531 | -0.034 (-0.87) | -0.068 |
| LH aOld 1R | 113,454 | -0.116 (-20.42) | 118,392 | -0.127 (-23.65) | -0.622 |
| LH aOld 2R | 113,454 | +0.047 (8.76) | 118,392 | +0.026 (4.77) | -0.468 |
| LH aOld key | 87,273 | +0.243 (10.05) | 92,179 | +0.224 (9.47) | -0.274 |
| LH aPlain 1R | 341,097 | -0.114 (-21.19) | 360,796 | -0.130 (-25.52) | -0.626 |
| LH aPlain 2R | 341,097 | +0.053 (13.52) | 360,796 | +0.022 (5.06) | -0.474 |
| LH aPlain key | 298,790 | +0.267 (18.47) | 317,758 | +0.195 (15.78) | -0.303 |
| LH bOld 1R | 171,986 | -0.029 (-7.05) | 204,180 | -0.037 (-11.32) | -0.162 |
| LH bOld 2R | 171,986 | -0.034 (-5.17) | 204,180 | -0.046 (-8.32) | -0.171 |
| LH bOld key | 100,148 | -0.058 (-6.09) | 121,546 | -0.060 (-6.34) | -0.193 |
| LH cOld 1R | 7,406 | -0.022 (-2.87) | 8,711 | -0.003 (-0.42) | -0.035 |
| LH cOld 2R | 7,406 | -0.022 (-2.61) | 8,711 | -0.003 (-0.40) | -0.035 |
| LH cOld key | 1,414 | -0.117 (-3.24) | 1,718 | -0.080 (-3.03) | -0.156 |

## Checks

- Cut test: 10 cuts on xau, eurusd: 1,381,828 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades (cells and controls alike).
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | signals | simulated | dropped (bad data) | past the stop | risk under cost | unresolved at data end | no key level 1R+ away |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 245,125 | 159,366 | 18 | 4,740 | 81,001 | 2 | 37,516 |
| xag | 2006-03-19 | 244,059 | 73,279 | 480 | 17,249 | 153,051 | 3 | 25,087 |
| eurusd | 2004-01-01 | 276,099 | 229,835 | 142 | 4,944 | 41,121 | 2 | 48,944 |
| gbpusd | 2004-01-01 | 277,026 | 225,631 | 301 | 6,310 | 44,726 | 4 | 48,745 |
| usdjpy | 2004-01-01 | 271,204 | 213,057 | 240 | 5,245 | 52,602 | 4 | 46,321 |
| audusd | 2004-01-01 | 278,771 | 223,631 | 208 | 10,776 | 44,102 | 3 | 51,812 |
| nzdusd | 2004-01-01 | 277,555 | 206,734 | 8 | 7,236 | 63,525 | 5 | 49,050 |
| usdcad | 2004-01-01 | 278,019 | 212,171 | 280 | 6,281 | 59,217 | 0 | 48,432 |
| usdchf | 2004-01-01 | 276,602 | 205,352 | 234 | 12,913 | 58,041 | 4 | 47,701 |
| eurjpy | 2004-01-01 | 271,298 | 220,708 | 8 | 4,899 | 45,616 | 2 | 48,516 |

## What it means

No cell clears the bar. Fading the first pullback after a fresh switch, taking the first break with it, or entering on the
switch candle does not do measurably better than the same triggers under an old call (or, for the fade, than the plain fade of every
break): the timing of the switch adds nothing the fade or the call did not already show. Never call any of these an edge; do not
re-test variants of these 42 cells on these years. Nothing live changed; no rule is proposed.

INCONCLUSIVE, not a pass, by the pre-registered rule: LH a0-1 key clears the before-cost and Holm checks but not its control(s)
(aOld Welch t -0.17 / 0.82, aPlain Welch t -0.46 / 1.19). The same exit under an old call and on every break faded does
about as well, so the result belongs to fading a lower-timeframe break with a far target, not to the switch; and after costs it
loses (-0.197R a trade in 2015-26).
