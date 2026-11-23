# Fading the first structure break on new markets and a second feed (result)

**Verdict: PASS. 5 of 5 fade rules hold before costs on eight new markets and on HistData; m15 none atr 2R all: A +0.032R (n 288,544, t 8.74), B +0.056R (n 118,499, t 10.98); after costs -0.138R and -0.112R.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed, never an edge. One run, no variants. The rules are five passing cells of `grid7-wide-fade`,
its code imported unchanged.

## Gate

The runner reproduces `grid7-wide-fade`'s eurusd rows for 2015-26 (n, mean R, month t, mean R after costs, six decimals): **yes, all five**.

| Rule | grid n | grid R (t) | here n | here R (t) | equal |
|---|---:|---:|---:|---:|---|
| m15 none atr 2R all | 21,256 | +0.055 (5.50) | 21,256 | +0.055 (5.50) | yes |
| m15 none ext swing all | 17,356 | +0.167 (4.84) | 17,356 | +0.167 (4.84) | yes |
| m15 none ext 2R all | 18,881 | +0.065 (5.54) | 18,881 | +0.065 (5.54) | yes |
| h1 none ext 2R all | 5,340 | +0.084 (4.42) | 5,340 | +0.084 (4.42) | yes |
| m5 none atr 2R all | 63,969 | +0.063 (10.65) | 63,969 | +0.063 (10.65) | yes |

## The bar

Before costs, month-sum t pooled per test; Holm over the ten tests (5 rules x A, B). Test A = eight markets the fade grid never
read (nas100, spx500, de40, gbpjpy, audjpy, cadjpy, eurgbp, euraud), OANDA mid, fills 2005 to Oct 2026. Test B = HistData M1 grouped to 5 minutes for xau, xag, eurusd, gbpusd, usdjpy, audusd, usdcad, usdchf,
fills Feb 2018 to Oct 2026. After costs beside: costs **ASSUMED, not measured** for every Test A market and for xag, usdcad,
usdchf in Test B (`combo-grid-2` `COSTS`).

| Rule | A n | A R (t) | A net | A Holm | B n | B R (t) | B net | B Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| m15 none atr 2R all | 288,544 | +0.032 (8.74) | -0.138 | 0.0000 | 118,499 | +0.056 (10.98) | -0.112 | 0.0000 | yes |
| m15 none ext swing all | 215,975 | +0.096 (10.80) | -0.295 | 0.0000 | 87,633 | +0.151 (11.91) | -0.252 | 0.0000 | yes |
| m15 none ext 2R all | 232,277 | +0.033 (8.46) | -0.355 | 0.0000 | 95,254 | +0.051 (9.84) | -0.349 | 0.0000 | yes |
| h1 none ext 2R all | 72,372 | +0.058 (8.77) | -0.188 | 0.0000 | 28,958 | +0.042 (4.11) | -0.196 | 0.0000 | yes |
| m5 none atr 2R all | 837,955 | +0.062 (25.18) | -0.211 | 0.0000 | 344,462 | +0.058 (18.44) | -0.211 | 0.0000 | yes |

Passing: m15 none atr 2R all; m15 none ext swing all; m15 none ext 2R all; h1 none ext 2R all; m5 none atr 2R all. Of those, positive after costs on both tests: none.

## Test A by decade, and HistData against OANDA on the same window

| Rule | A 2005-14 R (t) | A 2015-26 R (t) | B HistData R (t) | OANDA same 8 markets, same window R (t) |
|---|---:|---:|---:|---:|
| m15 none atr 2R all | +0.043 (7.17) | +0.023 (5.24) | +0.056 (10.98) | +0.047 (10.34) |
| m15 none ext swing all | +0.087 (6.61) | +0.103 (8.58) | +0.151 (11.91) | +0.152 (11.86) |
| m15 none ext 2R all | +0.049 (8.83) | +0.021 (3.91) | +0.051 (9.84) | +0.051 (9.45) |
| h1 none ext 2R all | +0.095 (9.33) | +0.028 (3.55) | +0.042 (4.11) | +0.037 (3.78) |
| m5 none atr 2R all | +0.072 (17.13) | +0.054 (19.00) | +0.058 (18.44) | +0.060 (19.87) |

## The mirror (traded WITH the break) and the side split

Mirror = same fill, the stop at the same distance on the other side, the same targets in R. Buys = fading down breaks,
sells = fading up breaks. Before costs, R a trade (month t).

| Rule | mirror A | mirror B | fade buys A | fade sells A | fade buys B | fade sells B |
|---|---:|---:|---:|---:|---:|---:|
| m15 none atr 2R all | -0.052 (-11.64) | -0.063 (-13.47) | +0.049 (8.69) | +0.016 (3.31) | +0.051 (8.29) | +0.061 (7.91) |
| m15 none ext swing all | -0.050 (-4.73) | -0.049 (-4.26) | +0.134 (10.13) | +0.060 (5.22) | +0.155 (9.12) | +0.147 (8.65) |
| m15 none ext 2R all | -0.100 (-24.50) | -0.098 (-17.75) | +0.034 (6.44) | +0.032 (6.19) | +0.058 (7.88) | +0.044 (6.21) |
| h1 none ext 2R all | -0.066 (-9.81) | -0.056 (-5.38) | +0.057 (6.00) | +0.058 (6.66) | +0.044 (2.96) | +0.040 (3.29) |
| m5 none atr 2R all | -0.078 (-22.73) | -0.049 (-15.00) | +0.071 (21.46) | +0.053 (17.91) | +0.060 (14.55) | +0.056 (13.04) |

## Per market

Before costs, R a trade (month t) [after costs]; * = cost ASSUMED.

### Test A (OANDA mid, 2005 to Oct 2026)

| Market | m15 none atr 2R | m15 none ext swing | m15 none ext 2R | h1 none ext 2R | m5 none atr 2R |
|---|---:|---:|---:|---:|---:|
| nas100* | +0.010 (1.29) [-0.244] n 34,711 | +0.052 (2.19) [-0.313] n 22,257 | -0.037 (-3.64) [-0.399] n 24,406 | +0.031 (2.13) [-0.251] n 8,612 | +0.020 (3.91) [-0.296] n 88,261 |
| spx500* | +0.024 (3.16) [-0.221] n 36,289 | +0.059 (2.71) [-0.364] n 23,871 | -0.012 (-1.06) [-0.431] n 25,751 | +0.045 (3.15) [-0.247] n 8,864 | +0.036 (7.01) [-0.321] n 97,930 |
| de40* | -0.018 (-1.83) [-0.130] n 25,867 | +0.053 (1.96) [-0.264] n 21,647 | -0.042 (-4.04) [-0.354] n 23,598 | -0.008 (-0.44) [-0.165] n 6,631 | +0.005 (0.86) [-0.199] n 76,182 |
| gbpjpy* | +0.030 (3.89) [-0.084] n 38,008 | +0.124 (5.76) [-0.235] n 32,081 | +0.055 (6.72) [-0.301] n 34,222 | +0.046 (2.89) [-0.148] n 9,844 | +0.066 (11.71) [-0.141] n 115,679 |
| audjpy* | +0.023 (2.93) [-0.105] n 38,387 | +0.088 (4.26) [-0.303] n 31,223 | +0.037 (4.47) [-0.352] n 33,198 | +0.067 (4.57) [-0.156] n 9,824 | +0.062 (11.28) [-0.170] n 116,028 |
| cadjpy* | +0.033 (4.15) [-0.107] n 38,865 | +0.116 (5.57) [-0.289] n 30,277 | +0.043 (5.14) [-0.359] n 32,380 | +0.071 (4.44) [-0.173] n 9,877 | +0.063 (12.14) [-0.193] n 116,993 |
| eurgbp* | +0.082 (9.84) [-0.157] n 37,918 | +0.118 (4.85) [-0.372] n 23,082 | +0.105 (10.74) [-0.382] n 25,032 | +0.114 (7.23) [-0.228] n 8,999 | +0.127 (24.61) [-0.271] n 110,214 |
| euraud* | +0.051 (6.93) [-0.070] n 38,499 | +0.129 (6.79) [-0.254] n 31,537 | +0.081 (9.54) [-0.299] n 33,690 | +0.077 (4.99) [-0.143] n 9,721 | +0.086 (18.80) [-0.134] n 116,668 |

### Test B (HistData, Feb 2018 to Oct 2026)

| Market | m15 none atr 2R | m15 none ext swing | m15 none ext 2R | h1 none ext 2R | m5 none atr 2R |
|---|---:|---:|---:|---:|---:|
| xau | +0.005 (0.35) [-0.167] n 14,552 | +0.011 (0.29) [-0.375] n 10,645 | -0.019 (-1.48) [-0.404] n 11,582 | -0.008 (-0.31) [-0.245] n 3,489 | +0.034 (5.25) [-0.264] n 42,994 |
| xag* | +0.049 (3.47) [-0.427] n 11,227 | -0.016 (-0.42) [-0.557] n 4,023 | -0.008 (-0.34) [-0.548] n 4,411 | +0.024 (0.77) [-0.433] n 2,253 | +0.039 (3.48) [-0.522] n 22,110 |
| eurusd | +0.077 (5.92) [-0.046] n 15,660 | +0.229 (5.51) [-0.151] n 12,542 | +0.081 (5.96) [-0.295] n 13,686 | +0.089 (3.79) [-0.105] n 3,905 | +0.070 (10.24) [-0.157] n 46,703 |
| gbpusd | +0.060 (4.51) [-0.057] n 15,379 | +0.189 (5.62) [-0.185] n 12,531 | +0.064 (4.97) [-0.306] n 13,614 | +0.038 (1.91) [-0.154] n 3,885 | +0.068 (8.31) [-0.150] n 46,548 |
| usdjpy | +0.019 (1.56) [-0.112] n 15,059 | +0.118 (3.60) [-0.253] n 12,141 | +0.025 (1.90) [-0.341] n 13,072 | +0.001 (0.04) [-0.203] n 3,804 | +0.028 (4.15) [-0.213] n 45,709 |
| audusd | +0.079 (6.36) [-0.045] n 15,533 | +0.180 (5.31) [-0.223] n 12,503 | +0.075 (6.02) [-0.325] n 13,506 | +0.068 (2.72) [-0.145] n 3,926 | +0.070 (9.41) [-0.161] n 46,863 |
| usdcad* | +0.079 (6.97) [-0.047] n 15,630 | +0.204 (5.41) [-0.210] n 12,252 | +0.072 (5.13) [-0.339] n 13,356 | +0.083 (3.44) [-0.144] n 3,911 | +0.072 (9.21) [-0.162] n 46,934 |
| usdchf* | +0.074 (6.35) [-0.085] n 15,459 | +0.160 (4.52) [-0.289] n 10,996 | +0.068 (4.84) [-0.376] n 12,027 | +0.026 (1.03) [-0.243] n 3,785 | +0.072 (9.87) [-0.227] n 46,601 |

### OANDA mid on Test B's window (comparison, not the bar)

| Market | m15 none atr 2R | m15 none ext swing | m15 none ext 2R | h1 none ext 2R | m5 none atr 2R |
|---|---:|---:|---:|---:|---:|
| xau | +0.019 (1.55) [-0.153] n 14,760 | +0.038 (1.01) [-0.349] n 10,766 | -0.013 (-0.94) [-0.399] n 11,732 | -0.004 (-0.18) [-0.241] n 3,547 | +0.030 (4.20) [-0.267] n 43,656 |
| xag* | +0.046 (3.14) [-0.443] n 10,674 | +0.077 (1.57) [-0.455] n 3,495 | +0.024 (0.96) [-0.507] n 3,869 | +0.031 (0.91) [-0.429] n 2,090 | +0.032 (2.99) [-0.522] n 19,034 |
| eurusd | +0.062 (5.43) [-0.063] n 15,835 | +0.183 (4.37) [-0.193] n 12,698 | +0.073 (5.27) [-0.299] n 13,851 | +0.092 (4.10) [-0.100] n 3,963 | +0.064 (9.22) [-0.167] n 47,263 |
| gbpusd | +0.041 (3.13) [-0.079] n 15,492 | +0.160 (5.23) [-0.212] n 12,549 | +0.053 (3.68) [-0.317] n 13,647 | +0.044 (2.05) [-0.148] n 3,981 | +0.065 (8.89) [-0.158] n 47,112 |
| usdjpy | +0.005 (0.41) [-0.128] n 15,201 | +0.109 (3.86) [-0.258] n 12,291 | +0.026 (2.02) [-0.338] n 13,235 | -0.028 (-1.25) [-0.230] n 3,882 | +0.024 (3.72) [-0.220] n 46,150 |
| audusd | +0.061 (5.19) [-0.069] n 15,814 | +0.182 (5.24) [-0.223] n 12,395 | +0.074 (5.58) [-0.326] n 13,418 | +0.046 (1.93) [-0.171] n 3,988 | +0.081 (10.96) [-0.162] n 47,852 |
| usdcad* | +0.074 (6.46) [-0.055] n 15,881 | +0.232 (6.58) [-0.183] n 12,306 | +0.084 (6.09) [-0.327] n 13,405 | +0.088 (4.10) [-0.141] n 3,994 | +0.076 (10.95) [-0.164] n 47,507 |
| usdchf* | +0.065 (5.52) [-0.100] n 15,573 | +0.167 (5.08) [-0.280] n 10,927 | +0.057 (4.70) [-0.385] n 11,924 | +0.014 (0.60) [-0.261] n 3,857 | +0.089 (12.08) [-0.221] n 47,404 |

### Test A by group (before costs, R a trade (month t))

| Rule | indices (nas100, spx500, de40) | crosses (5) |
|---|---:|---:|
| m15 none atr 2R all | +0.008 (1.44) | +0.044 (9.52) |
| m15 none ext swing all | +0.055 (3.47) | +0.115 (10.83) |
| m15 none ext 2R all | -0.030 (-4.48) | +0.062 (13.66) |
| h1 none ext 2R all | +0.025 (2.40) | +0.074 (9.12) |
| m5 none atr 2R all | +0.022 (5.83) | +0.080 (26.58) |

Markets positive before costs: m15 none atr 2R all A 7 of 8, B 8 of 8; m15 none ext swing all A 8 of 8, B 7 of 8; m15 none ext 2R all A 5 of 8, B 6 of 8; h1 none ext 2R all A 7 of 8, B 7 of 8; m5 none atr 2R all A 8 of 8, B 8 of 8.

## Checks

- Cut test: 15 cuts (A nas100, A gbpjpy, B eurusd HistData): 1,047,448 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.
- Exclusions: Test A the data-quality audit's intervals (`combo-grid-2` `exclusions`); Test B none.

| Series | market | candles from | to | signals | simulated | dropped | past the stop | risk under cost | unresolved |
|---|---|---|---|---:|---:|---:|---:|---:|---:|
| A OANDA | nas100 | 2004-01-02 | 2026-10-30 | 161,526 | 155,990 | 10 | 1,704 | 35,543 | 0 |
| A OANDA | spx500 | 2004-01-02 | 2026-10-30 | 158,658 | 168,834 | 7 | 2,512 | 18,444 | 0 |
| A OANDA | de40 | 2004-01-02 | 2026-10-30 | 112,443 | 132,279 | 4 | 437 | 2,192 | 1 |
| A OANDA | gbpjpy | 2004-01-01 | 2026-10-30 | 163,723 | 197,755 | 1 | 138 | 3,738 | 2 |
| A OANDA | audjpy | 2004-05-31 | 2026-10-30 | 164,493 | 197,439 | 0 | 233 | 5,169 | 2 |
| A OANDA | cadjpy | 2004-05-31 | 2026-10-30 | 166,162 | 198,119 | 1 | 200 | 6,663 | 4 |
| A OANDA | eurgbp | 2004-01-01 | 2026-10-30 | 163,450 | 182,164 | 3 | 464 | 18,670 | 1 |
| A OANDA | euraud | 2004-05-31 | 2026-10-30 | 165,064 | 198,582 | 0 | 271 | 4,672 | 4 |
| B HistData | xau | 2018-01-01 | 2026-10-30 | 62,705 | 72,619 | 0 | 68 | 3,968 | 2 |
| B HistData | xag | 2018-01-01 | 2026-10-30 | 61,393 | 40,002 | 0 | 137 | 34,998 | 1 |
| B HistData | eurusd | 2018-01-01 | 2026-10-30 | 67,012 | 79,957 | 0 | 68 | 2,012 | 3 |
| B HistData | gbpusd | 2018-01-01 | 2026-10-30 | 66,557 | 79,430 | 0 | 121 | 1,718 | 4 |
| B HistData | usdjpy | 2018-01-01 | 2026-10-30 | 65,404 | 77,648 | 0 | 125 | 2,029 | 4 |
| B HistData | audusd | 2018-01-01 | 2026-10-30 | 67,095 | 79,830 | 0 | 123 | 1,998 | 2 |
| B HistData | usdcad | 2018-01-01 | 2026-10-30 | 67,214 | 79,833 | 0 | 98 | 2,270 | 2 |
| B HistData | usdchf | 2018-01-01 | 2026-10-30 | 66,793 | 77,874 | 0 | 174 | 3,559 | 2 |
| B-window OANDA | xau | 2018-01-01 | 2026-10-30 | 63,493 | 73,697 | 5 | 56 | 3,920 | 2 |
| B-window OANDA | xag | 2018-01-01 | 2026-10-30 | 64,764 | 35,669 | 284 | 578 | 42,589 | 2 |
| B-window OANDA | eurusd | 2018-01-01 | 2026-10-30 | 67,935 | 80,915 | 88 | 86 | 2,040 | 3 |
| B-window OANDA | gbpusd | 2018-01-01 | 2026-10-30 | 67,496 | 80,236 | 175 | 75 | 1,850 | 4 |
| B-window OANDA | usdjpy | 2018-01-01 | 2026-10-30 | 66,196 | 78,471 | 134 | 60 | 2,054 | 3 |
| B-window OANDA | audusd | 2018-01-01 | 2026-10-30 | 68,579 | 81,073 | 117 | 264 | 2,252 | 1 |
| B-window OANDA | usdcad | 2018-01-01 | 2026-10-30 | 68,313 | 80,789 | 165 | 80 | 2,511 | 2 |
| B-window OANDA | usdchf | 2018-01-01 | 2026-10-30 | 67,987 | 78,760 | 160 | 433 | 3,575 | 2 |

## What it means

5 of the five rules keep their before-cost tilt on eight markets the grid never read AND on a second feed, so the tilt is
not particular to the ten markets nor an artefact of OANDA's mid candles. It is still a before-cost tilt: the after-cost column
shows it is smaller than the round trip everywhere. Not an edge, nothing adopted, no live change.

Three limits, said plainly. (1) The tilt lives in the currencies: on the three indices it is a third or less of what the crosses make, and negative for the
break-candle stop with a 2R target (see the group table); the pooled pass of Test A is carried by the five crosses. (2) HistData
agrees with OANDA on the same window almost figure for figure, so the tilt is not an artefact of OANDA's mid candles; but both
are quote feeds, and a reversal of the quote at the scale of the bid / ask would show on both. Only executable prices (the
broker's own bid / ask, as `gold-vol-breakout-exec` used) can tell whether a taker can capture any of it. (3) Every rule loses
after costs on both tests, by more than its tilt (ASSUMED costs for all of Test A).
