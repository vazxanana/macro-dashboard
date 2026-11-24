# The volatility breakouts: where should the stop go? (vb-stop-place, 24 Nov 2026)

**Verdict: FAIL: 0 of 6 stop places beat the stop at the open after costs; d vs the open stop a trade (discovery / confirmation, month t of d in confirmation): gold A −0.046 / −0.084 (t −2.94, WORSE); gold B −0.180 / −0.148 (t −4.65, WORSE); gold C −0.090 / −0.039 (t −2.76, WORSE); USD/JPY A −0.073 / −0.054 (t −1.98, NO BETTER); USD/JPY B −0.145 / −0.119 (t −3.74, WORSE); USD/JPY C −0.029 / −0.020 (t −1.40, NO BETTER); rule gold +0.205 / +0.098R, USD/JPY +0.092 / +0.055R**

Paper research only. Variants, costs, windows, tests and bar were fixed in `PREREGISTRATION.md` (pushed alone before any moved-stop figure was computed; sha256 in `result.json`). The rule's functions come unchanged from `index-vol-breakout/original.mjs`; gold is charged `gold-vol-breakout-hourcost`'s C1 (frozen from its result.json), USD/JPY `fx-vol-breakout`'s cost. Each variant's R is on its own opening risk and its cost in R is cost / its own risk. **Nothing is adopted and nothing live changed.**

Gates: gold O reproduces hourcost's C1 grid (W1 n 929 +0.202 t +4.93; W2 n 728 +0.170 t +2.93; W3 n 935 +0.094 t +2.41; W4 n 1121 +0.105 t +2.79; POOLED n 3713 +0.139 t +6.47): yes; USD/JPY O reproduces usdjpy-vb-exit (early n 2089 +0.079; late n 2079 +0.063): yes; the walker with the open stop equals vbTrade on 8030 of 8030 trades. Days without 15 closed H1 candles before the fill: 0 (dropped for all four).

## Gold

| Variant | Window | n | Win | Gross R | Net R | Net 2x | Cost R | Month t | Stopped | Max DD R | Same-size net (rule distances) | d vs O | Month t of d |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| O: stop at the open (rule) | 2007-01-01 → 2014-12-31 | 1467 | 46.2 % | +0.220 | +0.205 | +0.189 | +0.015 | +5.50 | 33 % | −19.4 | +0.205 | — | — |
| O: stop at the open (rule) | 2015-01-01 → 2026-11-20 | 2250 | 43.2 % | +0.115 | +0.098 | +0.082 | +0.016 | +3.84 | 35 % | −28.3 | +0.098 | — | — |
| A: half way open → trigger | 2007-01-01 → 2014-12-31 | 1467 | 31.4 % | +0.190 | +0.159 | +0.129 | +0.031 | +2.64 | 62 % | −47.3 | +0.080 | −0.046 | −1.10 |
| A: half way open → trigger | 2015-01-01 → 2026-11-20 | 2250 | 29.7 % | +0.048 | +0.015 | −0.018 | +0.033 | +0.39 | 63 % | −85.8 | +0.007 | −0.084 | −2.94 |
| B: 1 x ATR(14) H1 from the fill | 2007-01-01 → 2014-12-31 | 1467 | 21.5 % | +0.067 | +0.025 | −0.017 | +0.042 | +0.34 | 76 % | −129.0 | +0.163 | −0.180 | −3.17 |
| B: 1 x ATR(14) H1 from the fill | 2015-01-01 → 2026-11-20 | 2250 | 23.6 % | −0.007 | −0.050 | −0.092 | +0.042 | −1.17 | 73 % | −163.7 | +0.010 | −0.148 | −4.65 |
| C: the opposite trigger | 2007-01-01 → 2014-12-31 | 1467 | 51.2 % | +0.122 | +0.115 | +0.107 | +0.008 | +5.30 | 12 % | −12.7 | +0.229 | −0.090 | −4.17 |
| C: the opposite trigger | 2015-01-01 → 2026-11-20 | 2250 | 48.7 % | +0.067 | +0.059 | +0.051 | +0.008 | +3.87 | 12 % | −16.8 | +0.118 | −0.039 | −2.76 |

## USD/JPY

| Variant | Window | n | Win | Gross R | Net R | Net 2x | Cost R | Month t | Stopped | Max DD R | Same-size net (rule distances) | d vs O | Month t of d |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| O: stop at the open (rule) | 2005-01-04 → 2014-12-31 | 1894 | 45.5 % | +0.121 | +0.092 | +0.063 | +0.029 | +3.32 | 32 % | −42.2 | +0.092 | — | — |
| O: stop at the open (rule) | 2015-01-01 → 2026-11-20 | 2275 | 43.9 % | +0.087 | +0.055 | +0.023 | +0.032 | +2.22 | 34 % | −33.8 | +0.055 | — | — |
| A: half way open → trigger | 2005-01-04 → 2014-12-31 | 1894 | 32.8 % | +0.077 | +0.019 | −0.039 | +0.058 | +0.44 | 59 % | −105.9 | +0.010 | −0.073 | −2.22 |
| A: half way open → trigger | 2015-01-01 → 2026-11-20 | 2275 | 32.0 % | +0.065 | +0.001 | −0.064 | +0.065 | +0.02 | 59 % | −74.1 | +0.000 | −0.054 | −1.98 |
| B: 1 x ATR(14) H1 from the fill | 2005-01-04 → 2014-12-31 | 1894 | 25.7 % | +0.022 | −0.052 | −0.127 | +0.074 | −0.99 | 71 % | −173.8 | +0.007 | −0.145 | −3.54 |
| B: 1 x ATR(14) H1 from the fill | 2015-01-01 → 2026-11-20 | 2275 | 25.7 % | +0.018 | −0.064 | −0.146 | +0.082 | −1.48 | 70 % | −181.9 | −0.008 | −0.119 | −3.74 |
| C: the opposite trigger | 2005-01-04 → 2014-12-31 | 1894 | 50.0 % | +0.078 | +0.064 | +0.049 | +0.014 | +4.12 | 10 % | −22.1 | +0.127 | −0.029 | −1.79 |
| C: the opposite trigger | 2015-01-01 → 2026-11-20 | 2275 | 48.7 % | +0.051 | +0.035 | +0.018 | +0.016 | +2.38 | 12 % | −15.0 | +0.069 | −0.020 | −1.40 |

## Tests (Holm over six, one-sided p of the confirmation month t of d)

| Market | Variant | d discovery | d confirmation | Month t of d | p | Holm p | (1) d > 0 both | (2) t ≥ 2, Holm | (3) net > 0 both, t ≥ 2 | (4) n ≥ 200 | Reading |
|---|---|---|---|---|---|---|---|---|---|---|---|
| xau | A | −0.046 | −0.084 | −2.94 | 0.998 | 1 | no | no | no | yes | **WORSE** |
| xau | B | −0.180 | −0.148 | −4.65 | 1 | 1 | no | no | no | yes | **WORSE** |
| xau | C | −0.090 | −0.039 | −2.76 | 0.997 | 1 | no | no | yes | yes | **WORSE** |
| usdjpy | A | −0.073 | −0.054 | −1.98 | 0.976 | 1 | no | no | no | yes | **NO BETTER** |
| usdjpy | B | −0.145 | −0.119 | −3.74 | 1 | 1 | no | no | no | yes | **WORSE** |
| usdjpy | C | −0.029 | −0.020 | −1.40 | 0.919 | 1 | no | no | yes | yes | **NO BETTER** |

## Control: the same stop places on random entries (40 seeds, whole span, not in the verdict)

| Market | Variant | T1 d (pooled) | Placebo d, median | 5-95 % over seeds | T1 inside the band |
|---|---|---|---|---|---|
| xau | A | −0.069 | +0.015 | −0.010 … +0.032 | no |
| xau | B | −0.160 | −0.009 | −0.027 … +0.034 | no |
| xau | C | −0.059 | −0.011 | −0.024 … +0.005 | no |
| usdjpy | A | −0.063 | −0.011 | −0.037 … +0.007 | no |
| usdjpy | B | −0.130 | −0.025 | −0.056 … −0.001 | no |
| usdjpy | C | −0.024 | +0.004 | −0.007 … +0.016 | no |

**What it says.** Net R a trade, discovery / confirmation (confirmation gross, cost in R, month t): gold O +0.205 / +0.098R (gross +0.115, cost +0.016, t +3.84), A +0.159 / +0.015R (gross +0.048, cost +0.033, t +0.39), B +0.025 / −0.050R (gross −0.007, cost +0.042, t −1.17), C +0.115 / +0.059R (gross +0.067, cost +0.008, t +3.87); USD/JPY O +0.092 / +0.055R (gross +0.087, cost +0.032, t +2.22), A +0.019 / +0.001R (gross +0.065, cost +0.065, t +0.02), B −0.052 / −0.064R (gross +0.018, cost +0.082, t −1.48), C +0.064 / +0.035R (gross +0.051, cost +0.016, t +2.38). Control, mean d on random entries (median over 40 seeds): gold A +0.015 (T1 −0.069), gold B −0.009 (T1 −0.160), gold C −0.011 (T1 −0.059); USD/JPY A −0.011 (T1 −0.063), USD/JPY B −0.025 (T1 −0.130), USD/JPY C +0.004 (T1 −0.024). No stop place meets the pre-registered bar: the rule keeps its stop at the open. Described, not tested: at equal position size (not equal risk) the opposite-trigger stop C nets +0.118 of the rule's distance a trade on gold in confirmation against +0.098 (USD/JPY +0.069 against +0.055), but it risks about twice the money a trade, so at equal risk it is worse; it does cut the drawdown in R (gold −16.8 against −28.3R). The tighter stops (A, B) are stopped far more often and pay two to three times the cost in R. Paper research; nothing live changes and no proposal is written.

Data: OANDA mid M5 from the shared candle cache (edgekit): xau 2006-03-19 → 2026-11-20 (1474554 M5 candles); usdjpy 2005-01-02 → 2026-11-20 (1644641 M5 candles). "Same-size net" = the variant's net P&L per trade in units of the rule's own stop distance (equal position size, not equal risk); described, not tested. Cautions: today's demo cost on every past year; gold stop slippage modelled (0.05 x M), not measured; OANDA mid candles are not broker fills; a stop reached inside the fill candle is taken (worst case), which counts against the tighter stops; both windows were read before for the rule itself.
