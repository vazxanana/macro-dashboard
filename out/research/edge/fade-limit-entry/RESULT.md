# Fade on a resting limit instead of at market (result)

**Verdict: FAIL. 0 of 12 limit cells are positive after the full cost with a confirmation month t of 2; the best, R1 X0.5 A, made -0.165R a filled trade after costs in 2015-26 (n 134,406, month t -28.37; 2005-14 -0.152R, n 113,082), against the market entry's -0.118R.**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants. These years were read by both source studies: this measures an
execution change, not new evidence of a signal.

## What was run

Two fade rules, each study's own signal code imported: **R1** = grid7-wide-fade m15 none atr 2R all; **R2** = big-candle-fade m15 k1.5 nobreak half. Instead of the market
entry at the next 5-minute open, a limit FURTHER in the break's direction: L = signal close + d x X x ATR (a fade of an up-move
is a sell limit above the close), X in {0.1, 0.25, 0.5}, valid 4 M15 candles (one hour). It fills on a 5-minute mid candle only
when price trades through it by one tick (the open when it gaps past); on the fill candle only the stop counts. Variant **A**
keeps the market trade's stop distance and target in R from the new entry; variant **B** keeps its stop and target PRICES. Ten
markets pooled, OANDA mid 5-minute candles; windows by the signal's market fill time (the moment the order is placed).
Judged AFTER the FULL `edgekit` round trip; "0.5 x cost" is a labelled sensitivity (an upper bound of what a passive entry
saves), never the verdict. Costs **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## Gate: the market baselines reproduce the source cells

| Rule | n 2015-26 | wanted | R before costs | wanted | ok |
|---|---:|---:|---:|---:|---|
| R1 | 201,769 | 201,769 | +0.042 | +0.042 | yes |
| R2 | 54,443 | 54,443 | +0.193 | +0.193 | yes |

## The bar, cell by cell

- At least 200 fills in each window: 12 of 12.
- After the full cost, mean R > 0 in 2005-14: 0; in 2015-26: 0.
- Confirmation month t >= 2 after costs: 0; Holm-adjusted one-sided p < 0.05: 0.
- **All: 0.**

## Market entry (baseline) and every limit cell

Per FILLED trade: R before costs, after the full cost (month-sum t), after 0.5 x cost (sensitivity), mean cost in R; fill rate =
fills / orders. B places no order when its limit is at or past the original stop (or the risk is under the cost).

| Stream | 05-14 fills (rate) | 05-14 gross | 05-14 net (t) | 15-26 fills (rate) | 15-26 gross | 15-26 net (t) | 15-26 0.5x cost | cost R 15-26 | Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| R1 market | 171,515 | +0.054 | -0.088 (-15.58) | 201,769 | +0.042 | -0.118 (-28.34) | -0.038 | 0.16 | | |
| R2 market | 47,354 | +0.307 | -0.061 (-4.13) | 54,443 | +0.193 | -0.246 (-20.30) | -0.027 | 0.44 | | |
| R1 X0.1 A | 152,265 (88.8 %) | -0.013 | -0.154 (-22.97) | 181,124 (89.8 %) | -0.014 | -0.174 (-36.47) | -0.094 | 0.16 | 1.000 | no |
| R1 X0.1 B | 151,133 (88.9 %) | -0.017 | -0.170 (-23.30) | 179,926 (90.0 %) | -0.015 | -0.189 (-37.47) | -0.102 | 0.17 | 1.000 | no |
| R1 X0.25 A | 136,398 (79.5 %) | -0.012 | -0.154 (-25.16) | 162,698 (80.6 %) | -0.012 | -0.173 (-33.98) | -0.093 | 0.16 | 1.000 | no |
| R1 X0.25 B | 133,884 (79.7 %) | -0.025 | -0.200 (-25.82) | 160,139 (80.9 %) | -0.018 | -0.221 (-37.14) | -0.120 | 0.20 | 1.000 | no |
| R1 X0.5 A | 113,082 (65.9 %) | -0.008 | -0.152 (-23.45) | 134,406 (66.6 %) | -0.003 | -0.165 (-28.37) | -0.084 | 0.16 | 1.000 | no |
| R1 X0.5 B | 107,500 (66.1 %) | -0.029 | -0.266 (-26.55) | 128,639 (66.9 %) | -0.023 | -0.305 (-34.41) | -0.164 | 0.28 | 1.000 | no |
| R2 X0.1 A | 42,518 (89.8 %) | -0.044 | -0.410 (-27.81) | 49,816 (91.5 %) | -0.079 | -0.516 (-46.05) | -0.297 | 0.44 | 1.000 | no |
| R2 X0.1 B | 32,132 (91.2 %) | -0.023 | -0.427 (-25.68) | 34,992 (92.8 %) | -0.061 | -0.526 (-38.41) | -0.294 | 0.46 | 1.000 | no |
| R2 X0.25 A | 38,986 (82.3 %) | -0.098 | -0.464 (-31.56) | 46,125 (84.7 %) | -0.103 | -0.540 (-48.20) | -0.322 | 0.44 | 1.000 | no |
| R2 X0.25 B | 17,003 (85.4 %) | -0.082 | -0.509 (-23.08) | 17,275 (87.1 %) | -0.103 | -0.590 (-29.59) | -0.347 | 0.49 | 1.000 | no |
| R2 X0.5 A | 33,877 (71.5 %) | -0.094 | -0.460 (-33.60) | 40,336 (74.1 %) | -0.104 | -0.542 (-46.00) | -0.323 | 0.44 | 1.000 | no |
| R2 X0.5 B | 4,634 (79.5 %) | -0.097 | -0.562 (-11.83) | 4,097 (78.8 %) | -0.120 | -0.622 (-13.91) | -0.371 | 0.50 | 1.000 | no |

## Adverse selection and the paired difference (2015-26)

The MARKET trade's R before costs on the signals the limit filled against those it did not; Welch t of the two. "Per signal" =
the limit's after-cost R with an unfilled order as 0R, minus the market trade's after-cost R on the same signal (month t).

| Cell | filled: market R (n) | unfilled: market R (n) | Welch t | per signal limit - market | month t | 2005-14 same |
|---|---:|---:|---:|---:|---:|---:|
| R1 X0.1 A | -0.102 (181,124) | +1.305 (20,645) | -142.90 | -0.038 | -18.82 | -0.049 (t -18.21) |
| R1 X0.1 B | -0.100 (179,926) | +1.214 (21,843) | -132.31 | -0.050 | -29.61 | -0.061 (t -24.06) |
| R1 X0.25 A | -0.239 (162,698) | +1.215 (39,071) | -189.08 | -0.022 | -7.57 | -0.034 (t -11.49) |
| R1 X0.25 B | -0.237 (160,139) | +1.118 (41,630) | -175.94 | -0.057 | -21.86 | -0.068 (t -22.42) |
| R1 X0.5 A | -0.470 (134,406) | +1.064 (67,363) | -239.65 | +0.008 | 2.33 | -0.012 (t -3.02) |
| R1 X0.5 B | -0.469 (128,639) | +0.941 (73,130) | -221.30 | -0.076 | -17.82 | -0.078 (t -18.01) |
| R2 X0.1 A | -0.129 (49,816) | +3.662 (4,627) | -92.87 | -0.226 | -21.79 | -0.307 (t -22.05) |
| R2 X0.1 B | -0.095 (34,992) | +0.711 (19,451) | -36.79 | -0.092 | -8.22 | -0.228 (t -17.71) |
| R2 X0.25 A | -0.308 (46,125) | +2.970 (8,318) | -110.02 | -0.211 | -18.74 | -0.321 (t -20.41) |
| R2 X0.25 B | -0.223 (17,275) | +0.386 (37,168) | -38.18 | +0.059 | 4.78 | -0.121 (t -8.08) |
| R2 X0.5 A | -0.425 (40,336) | +1.961 (14,107) | -101.11 | -0.155 | -11.94 | -0.267 (t -16.24) |
| R2 X0.5 B | -0.341 (4,097) | +0.236 (50,346) | -28.85 | +0.199 | 16.15 | +0.006 (t 0.45) |

## Random-limit control

The same order shape (X, stop and target distances in ATR units, one hour, the fill rule) at the close of a random M15 candle of
the same market and month, random side, one per signal. After the full cost, per filled trade.

| Cell | control 05-14 net (n) | control 15-26 net (t, n) | variant - control Welch t 15-26 | clears the bar |
|---|---:|---:|---:|---|
| R1 X0.1 A | -0.175 (151,221) | -0.195 (-46.20, 179,916) | 4.43 | no |
| R1 X0.1 B | -0.191 (149,933) | -0.213 (-43.22, 178,299) | 4.71 | no |
| R1 X0.25 A | -0.169 (135,199) | -0.188 (-43.84, 160,441) | 2.93 | no |
| R1 X0.25 B | -0.223 (131,563) | -0.244 (-40.57, 157,809) | 3.72 | no |
| R1 X0.5 A | -0.157 (109,279) | -0.177 (-33.55, 129,305) | 2.13 | no |
| R1 X0.5 B | -0.272 (103,195) | -0.314 (-36.21, 122,975) | 1.00 | no |
| R2 X0.1 A | -0.430 (40,206) | -0.473 (-48.26, 45,751) | -3.44 | no |
| R2 X0.1 B | -0.432 (29,386) | -0.518 (-41.21, 30,853) | -0.45 | no |
| R2 X0.25 A | -0.405 (35,743) | -0.461 (-46.35, 40,719) | -6.06 | no |
| R2 X0.25 B | -0.494 (14,610) | -0.527 (-27.04, 14,290) | -2.45 | no |
| R2 X0.5 A | -0.390 (28,954) | -0.435 (-36.24, 32,288) | -7.51 | no |
| R2 X0.5 B | -0.446 (3,429) | -0.430 (-8.20, 2,916) | -2.98 | no |

## Data

| Market | candles from | R1 signals | R2 signals | dropped (bad data) |
|---|---|---:|---:|---:|
| xau | 2006-03-19 | 35,212 | 7,798 | 3 |
| xag | 2006-03-19 | 23,331 | 2,084 | 93 |
| eurusd | 2005-01-02 | 39,524 | 11,830 | 38 |
| gbpusd | 2005-01-02 | 39,226 | 12,725 | 69 |
| usdjpy | 2005-01-02 | 38,596 | 10,438 | 46 |
| audusd | 2005-01-02 | 40,045 | 11,218 | 48 |
| nzdusd | 2005-01-02 | 39,723 | 10,604 | 1 |
| usdcad | 2005-01-02 | 39,914 | 12,609 | 61 |
| usdchf | 2005-01-02 | 39,173 | 11,767 | 69 |
| eurjpy | 2005-01-02 | 38,540 | 10,724 | 2 |

## What it means

**R1.** At market +0.042R before and -0.118R after costs a trade (cost 0.16R). The best limit cell after costs is R1 X0.5 A:
-0.165R a filled trade (cost 0.16R, fill rate 66.6 %, month t -28.37). Adverse selection: the filled signals' market R
minus the unfilled ones' ranges -1.534 to -1.313R across its cells.

**R2.** At market +0.193R before and -0.246R after costs a trade (cost 0.44R). The best limit cell after costs is R2 X0.1 A:
-0.516R a filled trade (cost 0.44R, fill rate 91.5 %, month t -46.05). Adverse selection: the filled signals' market R
minus the unfilled ones' ranges -3.791 to -0.578R across its cells.

**Why it fails.** The better price does not lower the cost in R: variant A keeps the stop distance, so the cost in R is the
same as at market, and variant B keeps the stop PRICE, so the stop gets closer and the cost in R rises. What the limit changes
is WHICH signals trade, and that works against the fade: the signals whose price never came back up to the limit are the
market fade's best trades (they went straight to the target), and the ones that filled are the ones where the break kept
going. Before costs every limit cell is at or below zero (-0.003R to -0.120R a filled trade in 2015-26), against +0.042R and
+0.193R at market; the 0.5 x cost sensitivity is negative in every cell too. The few positive "per signal" differences
(R1 X0.5 A, R2 X0.25 B, R2 X0.5 B) only mean that skipping a losing trade loses less than taking it: the limit still loses
per signal. Against the random-limit control the R1 cells are a little better (Welch t 1.0 to 4.7) and the R2 cells worse:
all of them, and every control, lose after costs.

Entering the two Equinox fades on a resting limit does not rescue them on this bar. Do not re-test X, N or the fill rule on
these years. Nothing live changed; no rule is proposed.

**Run note (said plainly).** The first full run measured R against the distance from the FILL to the stop. A limit that
filled on a gap open just short of its stop then had a tiny risk, and a few such trades booked hundreds to thousands of R (one
USD/CHF R1 X0.25 A trade of 21 Nov 2018: +3,227R). The pre-registration fixed the fill price but not this normalisation; it was
set after seeing those trades to the ORDER's planned risk |L - stop| (cost in R the same way) and the run was repeated. The
verdict is the same either way (0 of 12; in the first run the best after-cost cell was -0.153R with that outlier inside it).
