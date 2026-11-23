# The Mosha barrier entry with market fills, ten markets (result)

**Verdict: FAIL. 0 of 36 cells pass; the best confirmation cell, 4h bo against 1R, made +0.076R a trade before costs in 2015-26 (n 418, month t 1.49; discovery -0.060R, t -0.99).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

The desk's barrier boxes on H4 and H1 (`assets/mosha-sop.js` `zonesOf`, imported: major BO origin, internal BO origin, engulf
zone), first return only; the QM (BO Structure) with the barrier on the table's timeframe (H4 on M15, H1 on M5) within 60
candles, read as the desk reads it; then a MARKET entry at the next 5-minute open, stop past the extreme made at the barrier
by the desk's buffer (as a share of price off gold), targets 1R / 3R / 6R, 5-day limit. Split by the structure of the
timeframe above (with / against). Control: a band of the same height and side at a matched random distance, run through the
same steps. Ten markets pooled, OANDA mid candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026.
Costs after the fact only; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The bar, cell by cell

- n >= 300 in both windows: 36 of 36.
- Mean R > 0 and month t >= 2 in discovery: 0; in confirmation: 0; both: 0.
- Holm-adjusted p < 0.05 over the 36 confirmation tests: 0.
- Beats its control (Welch t >= 2 in both windows): 0 of 36.
- **All four: 0.**
- Side-flipped trades passing bars 1-3: 0.

All 1R cells pooled (barriers): discovery -0.034R a trade before costs over 57,540 trades (-0.082R after),
confirmation -0.023R over 77,338 (-0.088R after). The control bands at 1R: discovery
-0.027R over 61,222, confirmation -0.018R over 82,298.

## Every cell

R a trade before costs (month-sum t), after costs beside; control = the no-barrier bands of that cell; "vs ctl" = Welch t of
the cell against its control (discovery / confirmation); Holm on the confirmation test; flipped = the same trades taken the
other way.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 | n 15-26 | R 15-26 (t) | net 15-26 | ctl R 05-14 / 15-26 | vs ctl | Holm | Flipped R 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 4h bo with 1R | 481 | -0.088 (-1.89) | -0.119 | 560 | -0.100 (-2.37) | -0.136 | -0.020 / -0.071 | -1.06 / -0.49 | 1.000 | +0.089 (2.10) | no |
| 4h bo with 3R | 481 | -0.120 (-1.69) | -0.151 | 560 | -0.158 (-2.48) | -0.194 | -0.057 / -0.071 | -0.64 / -0.98 | 1.000 | +0.071 (0.99) | no |
| 4h bo with 6R | 481 | -0.103 (-1.12) | -0.134 | 560 | -0.178 (-2.58) | -0.214 | -0.006 / -0.095 | -0.80 / -0.79 | 1.000 | +0.093 (1.03) | no |
| 4h bo against 1R | 322 | -0.060 (-0.99) | -0.095 | 418 | +0.076 (1.49) | +0.041 | -0.012 / -0.052 | -0.67 / 2.00 | 1.000 | -0.081 (-1.58) | no |
| 4h bo against 3R | 322 | -0.055 (-0.56) | -0.089 | 418 | +0.048 (0.58) | +0.012 | -0.025 / -0.023 | -0.25 / 0.67 | 1.000 | -0.011 (-0.13) | no |
| 4h bo against 6R | 322 | -0.104 (-0.95) | -0.139 | 418 | -0.015 (-0.17) | -0.051 | +0.011 / +0.050 | -0.84 / -0.52 | 1.000 | -0.018 (-0.18) | no |
| 4h ibo with 1R | 1,057 | +0.004 (0.15) | -0.026 | 1,317 | -0.020 (-0.74) | -0.061 | -0.015 / -0.026 | 0.44 / 0.17 | 1.000 | +0.013 (0.49) | no |
| 4h ibo with 3R | 1,057 | +0.028 (0.55) | -0.003 | 1,317 | -0.027 (-0.63) | -0.069 | -0.027 / -0.037 | 0.79 / 0.16 | 1.000 | -0.021 (-0.45) | no |
| 4h ibo with 6R | 1,057 | +0.073 (1.06) | +0.043 | 1,317 | -0.020 (-0.35) | -0.061 | +0.044 / -0.056 | 0.33 / 0.50 | 1.000 | -0.010 (-0.16) | no |
| 4h ibo against 1R | 1,022 | -0.049 (-1.61) | -0.078 | 1,425 | -0.012 (-0.45) | -0.055 | -0.032 / +0.007 | -0.40 / -0.52 | 1.000 | +0.008 (0.29) | no |
| 4h ibo against 3R | 1,022 | -0.031 (-0.60) | -0.060 | 1,425 | -0.001 (-0.02) | -0.043 | -0.061 / +0.010 | 0.44 / -0.18 | 1.000 | +0.012 (0.27) | no |
| 4h ibo against 6R | 1,022 | +0.039 (0.58) | +0.009 | 1,425 | -0.023 (-0.38) | -0.065 | +0.005 / +0.032 | 0.38 / -0.76 | 1.000 | -0.037 (-0.66) | no |
| 4h eg with 1R | 3,612 | -0.001 (-0.04) | -0.031 | 5,154 | -0.036 (-2.25) | -0.076 | -0.024 / -0.057 | 1.01 / 1.07 | 1.000 | +0.033 (2.08) | no |
| 4h eg with 3R | 3,612 | +0.009 (0.32) | -0.021 | 5,154 | -0.064 (-2.26) | -0.104 | -0.022 / -0.083 | 0.83 / 0.61 | 1.000 | +0.048 (1.84) | no |
| 4h eg with 6R | 3,612 | +0.062 (1.52) | +0.032 | 5,154 | -0.043 (-1.15) | -0.083 | +0.030 / -0.092 | 0.68 / 1.28 | 1.000 | +0.049 (1.52) | no |
| 4h eg against 1R | 3,542 | -0.029 (-1.61) | -0.060 | 5,135 | +0.011 (0.66) | -0.031 | -0.049 / -0.000 | 0.85 / 0.56 | 1.000 | -0.014 (-0.85) | no |
| 4h eg against 3R | 3,542 | -0.014 (-0.43) | -0.045 | 5,135 | +0.031 (1.14) | -0.010 | -0.037 / +0.032 | 0.60 / -0.01 | 1.000 | -0.015 (-0.51) | no |
| 4h eg against 6R | 3,542 | -0.030 (-0.72) | -0.061 | 5,135 | +0.022 (0.60) | -0.019 | -0.048 / +0.048 | 0.39 / -0.64 | 1.000 | -0.048 (-1.34) | no |
| 1h bo with 1R | 2,392 | -0.065 (-3.16) | -0.111 | 2,853 | -0.020 (-1.06) | -0.080 | -0.074 / -0.006 | 0.33 / -0.53 | 1.000 | +0.015 (0.83) | no |
| 1h bo with 3R | 2,392 | -0.052 (-1.53) | -0.098 | 2,853 | -0.071 (-1.99) | -0.132 | -0.045 / -0.022 | -0.14 / -1.12 | 1.000 | +0.069 (2.02) | no |
| 1h bo with 6R | 2,392 | -0.021 (-0.46) | -0.067 | 2,853 | -0.087 (-1.77) | -0.148 | -0.074 / -0.015 | 0.85 / -1.27 | 1.000 | +0.051 (1.14) | no |
| 1h bo against 1R | 1,553 | -0.060 (-2.63) | -0.107 | 2,090 | -0.053 (-2.33) | -0.118 | -0.056 / -0.053 | -0.14 / 0.02 | 1.000 | +0.050 (2.22) | no |
| 1h bo against 3R | 1,553 | -0.083 (-2.26) | -0.130 | 2,090 | -0.073 (-2.05) | -0.138 | -0.073 / -0.019 | -0.19 / -1.14 | 1.000 | +0.046 (1.23) | no |
| 1h bo against 6R | 1,553 | -0.088 (-1.65) | -0.135 | 2,090 | -0.077 (-1.52) | -0.143 | -0.049 / +0.044 | -0.56 / -1.91 | 1.000 | +0.072 (1.38) | no |
| 1h ibo with 1R | 4,694 | -0.046 (-3.37) | -0.099 | 6,440 | -0.039 (-3.04) | -0.107 | -0.059 / -0.034 | 0.65 / -0.29 | 1.000 | +0.035 (2.67) | no |
| 1h ibo with 3R | 4,694 | -0.011 (-0.45) | -0.064 | 6,440 | -0.056 (-2.55) | -0.123 | -0.055 / -0.039 | 1.31 / -0.58 | 1.000 | +0.052 (2.19) | no |
| 1h ibo with 6R | 4,694 | -0.006 (-0.19) | -0.059 | 6,440 | -0.045 (-1.53) | -0.113 | -0.089 / -0.038 | 1.87 / -0.19 | 1.000 | +0.066 (2.01) | no |
| 1h ibo against 1R | 5,013 | -0.014 (-0.90) | -0.066 | 6,790 | -0.018 (-1.31) | -0.087 | -0.008 / -0.030 | -0.35 / 0.69 | 1.000 | +0.013 (0.92) | no |
| 1h ibo against 3R | 5,013 | -0.007 (-0.23) | -0.058 | 6,790 | -0.021 (-0.92) | -0.089 | +0.009 / -0.019 | -0.47 / -0.05 | 1.000 | -0.005 (-0.21) | no |
| 1h ibo against 6R | 5,013 | +0.008 (0.20) | -0.043 | 6,790 | -0.043 (-1.52) | -0.111 | -0.007 / -0.017 | 0.36 / -0.71 | 1.000 | +0.025 (0.80) | no |
| 1h eg with 1R | 16,842 | -0.040 (-4.86) | -0.093 | 22,463 | -0.022 (-2.63) | -0.093 | -0.030 / -0.011 | -0.92 / -1.13 | 1.000 | +0.017 (1.98) | no |
| 1h eg with 3R | 16,842 | -0.022 (-1.27) | -0.075 | 22,463 | -0.034 (-2.23) | -0.105 | -0.010 / -0.020 | -0.66 / -0.88 | 1.000 | +0.048 (2.94) | no |
| 1h eg with 6R | 16,842 | -0.001 (-0.04) | -0.054 | 22,463 | -0.032 (-1.34) | -0.104 | -0.002 / -0.014 | 0.04 / -0.90 | 1.000 | +0.042 (1.81) | no |
| 1h eg against 1R | 17,010 | -0.030 (-3.84) | -0.084 | 22,693 | -0.026 (-3.34) | -0.096 | -0.010 / -0.009 | -1.92 / -1.82 | 1.000 | +0.021 (2.74) | no |
| 1h eg against 3R | 17,010 | -0.026 (-1.50) | -0.080 | 22,693 | -0.026 (-1.73) | -0.097 | +0.009 / +0.007 | -1.95 / -2.13 | 1.000 | +0.018 (1.20) | no |
| 1h eg against 6R | 17,010 | -0.013 (-0.48) | -0.066 | 22,693 | -0.028 (-1.33) | -0.099 | +0.030 / +0.015 | -1.75 / -2.04 | 1.000 | +0.011 (0.51) | no |

## Checks

- Cut test: 10 cuts on xau, eurusd: 159,728 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop, a risk outside the desk's limits, or a risk under the round trip is no trade (same for barriers and controls).
- Readings with no trend on the timeframe above are in no cell (column "no trend").

| Market | candles from | signals | barrier trades | control trades | no trend | dropped (bad data) | past the stop | outside risk limits | risk under cost |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 27,855 | 11,618 | 12,336 | 54 | 0 | 2 | 1,184 | 0 |
| xag | 2006-03-19 | 27,321 | 5,108 | 4,701 | 32 | 49 | 0 | 14,344 | 569 |
| eurusd | 2004-01-01 | 34,932 | 14,474 | 15,609 | 0 | 11 | 12 | 1,573 | 0 |
| gbpusd | 2004-01-01 | 34,874 | 14,377 | 15,582 | 0 | 13 | 1 | 1,671 | 0 |
| usdjpy | 2004-01-01 | 34,209 | 14,168 | 14,962 | 0 | 13 | 2 | 1,867 | 0 |
| audusd | 2004-01-01 | 40,233 | 16,068 | 17,040 | 0 | 13 | 3 | 3,496 | 0 |
| nzdusd | 2004-01-01 | 39,425 | 15,386 | 16,166 | 0 | 3 | 5 | 4,083 | 0 |
| usdcad | 2004-01-01 | 37,166 | 15,390 | 16,746 | 0 | 16 | 0 | 1,630 | 0 |
| usdchf | 2004-01-01 | 33,930 | 13,991 | 15,113 | 0 | 16 | 3 | 1,698 | 0 |
| eurjpy | 2004-01-01 | 35,632 | 14,298 | 15,265 | 0 | 3 | 2 | 2,749 | 0 |

## What it means

Taken at market, with no resting limit to be flattered by touch fills, the desk's barrier entry does not clear the bar on any of
the 36 cells over ten markets and 22 years. Do not re-test variants of these cells on these years. Nothing live changed; no rule is proposed.

Before costs the barrier trades sit a few hundredths of an R under zero, like the bands placed at random, so the barrier picks no
better place than a random band of the same size; the side-flipped trades are only the mirror of that small loss and lose
after costs too. Silver: the desk's risk limits, scaled as a share of price, rule out most of its signals (column "outside risk
limits"), so silver adds few trades; the verdict rests on the other nine markets.
