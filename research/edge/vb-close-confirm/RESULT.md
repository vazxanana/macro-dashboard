# The volatility breakouts entered on a close beyond the trigger (vb-close-confirm, 24 Nov 2026)

**Verdict: FAIL: 0 of 4 close-confirmed entries beat the touch fill after costs; d a signal day vs the touch (discovery / confirmation, month t of d in confirmation): gold M15 close −0.037 / −0.013 (t −1.08, NO BETTER); gold H1 close −0.071 / −0.036 (t −2.29, WORSE); USD/JPY M15 close −0.041 / −0.005 (t −0.33, NO BETTER); USD/JPY H1 close −0.050 / −0.015 (t −0.93, NO BETTER); touch fill gold +0.205 / +0.098R, USD/JPY +0.092 / +0.055R**

Paper research only. Variants, costs, windows, tests and bar were fixed in `PREREGISTRATION.md` (pushed alone before any close-confirmed figure was computed; sha256 in `result.json`). The rule's functions come unchanged from `index-vol-breakout/original.mjs`; gold is charged `gold-vol-breakout-hourcost`'s C1 (frozen from its result.json), USD/JPY `fx-vol-breakout`'s cost (commission measured, the 0.5 pip assumed). Each variant's R is on its own risk (entry to the open) and its cost in R is cost / its own risk. A signal day with no confirming close counts 0R for the variant in the paired difference d. **Nothing is adopted and nothing live changed.**

Gate: V0 reproduces vb-stop-place's O rows and hourcost's C1 pooled figure (xau early n 1467 +0.205; xau late n 2250 +0.098; xau POOLED n 3713 +0.139; usdjpy early n 1894 +0.092; usdjpy late n 2275 +0.055): yes.

## Gold

| Entry | Window | Trades (of signal days) | Win | Gross R | Net R | Net 2x | Cost R | Month t | Stopped | Max DD R | Mean delay (min) | d vs V0 a signal day (gross) | Month t of d |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| V0: touch fill (rule) | 2007-01-01 → 2014-12-31 | 1467 (of 1467) | 46.2 % | +0.220 | +0.205 | +0.189 | +0.015 | +5.50 | 33 % | −19.4 | 0 | — | — |
| V0: touch fill (rule) | 2015-01-01 → 2026-11-20 | 2250 (of 2250) | 43.2 % | +0.115 | +0.098 | +0.082 | +0.016 | +3.84 | 35 % | −28.3 | 0 | — | — |
| V1: first M15 close beyond the trigger | 2007-01-01 → 2014-12-31 | 1278 (of 1467) | 47.4 % | +0.206 | +0.193 | +0.180 | +0.013 | +5.42 | 26 % | −16.1 | 50.9 | −0.037 (−0.040) | −2.33 |
| V1: first M15 close beyond the trigger | 2015-01-01 → 2026-11-20 | 1978 (of 2250) | 45.8 % | +0.111 | +0.097 | +0.082 | +0.015 | +3.87 | 27 % | −17.4 | 59.97 | −0.013 (−0.017) | −1.08 |
| V2: first H1 close beyond the trigger | 2007-01-01 → 2014-12-31 | 1153 (of 1467) | 49.2 % | +0.183 | +0.170 | +0.158 | +0.013 | +4.94 | 22 % | −11.4 | 96.6 | −0.071 (−0.076) | −3.49 |
| V2: first H1 close beyond the trigger | 2015-01-01 → 2026-11-20 | 1786 (of 2250) | 46.8 % | +0.093 | +0.079 | +0.064 | +0.014 | +3.43 | 24 % | −16.8 | 110.36 | −0.036 (−0.041) | −2.29 |

## USD/JPY

| Entry | Window | Trades (of signal days) | Win | Gross R | Net R | Net 2x | Cost R | Month t | Stopped | Max DD R | Mean delay (min) | d vs V0 a signal day (gross) | Month t of d |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| V0: touch fill (rule) | 2005-01-04 → 2014-12-31 | 1894 (of 1894) | 45.5 % | +0.121 | +0.092 | +0.063 | +0.029 | +3.32 | 32 % | −42.2 | 0 | — | — |
| V0: touch fill (rule) | 2015-01-01 → 2026-11-20 | 2275 (of 2275) | 43.9 % | +0.087 | +0.055 | +0.023 | +0.032 | +2.22 | 34 % | −33.8 | 0 | — | — |
| V1: first M15 close beyond the trigger | 2005-01-04 → 2014-12-31 | 1706 (of 1894) | 46.5 % | +0.083 | +0.057 | +0.032 | +0.025 | +2.30 | 25 % | −48.2 | 61.18 | −0.041 (−0.047) | −3.35 |
| V1: first M15 close beyond the trigger | 2015-01-01 → 2026-11-20 | 2025 (of 2275) | 46.4 % | +0.085 | +0.057 | +0.028 | +0.028 | +2.64 | 26 % | −20.1 | 62.75 | −0.005 (−0.012) | −0.33 |
| V2: first H1 close beyond the trigger | 2005-01-04 → 2014-12-31 | 1569 (of 1894) | 46.6 % | +0.075 | +0.051 | +0.028 | +0.024 | +2.28 | 22 % | −37.2 | 106.62 | −0.050 (−0.059) | −3.07 |
| V2: first H1 close beyond the trigger | 2015-01-01 → 2026-11-20 | 1856 (of 2275) | 46.6 % | +0.076 | +0.049 | +0.023 | +0.027 | +2.31 | 22 % | −17.9 | 111.43 | −0.015 (−0.025) | −0.93 |

## Tests (Holm over four, one-sided p of the confirmation month t of d)

| Test | Market | Variant | d discovery | d confirmation | Month t of d | p | Holm p | (1) d > 0 both | (2) t ≥ 2, Holm | (3) net > 0 both, t ≥ 2 | (4) n ≥ 200 | Reading |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | xau | V1 | −0.037 | −0.013 | −1.08 | 0.859 | 1 | no | no | yes | yes | **NO BETTER** |
| T2 | xau | V2 | −0.071 | −0.036 | −2.29 | 0.989 | 1 | no | no | yes | yes | **WORSE** |
| T3 | usdjpy | V1 | −0.041 | −0.005 | −0.33 | 0.628 | 1 | no | no | yes | yes | **NO BETTER** |
| T4 | usdjpy | V2 | −0.050 | −0.015 | −0.93 | 0.823 | 1 | no | no | yes | yes | **NO BETTER** |

## Control: the same wait on random entries (40 seeds, whole span, not in the verdict)

| Market | Variant | T1 d (pooled) | Placebo d, median | 5-95 % over seeds | T1 inside the band |
|---|---|---|---|---|---|
| xau | V1 | −0.023 | −0.002 | −0.013 … +0.007 | no |
| xau | V2 | −0.050 | −0.003 | −0.019 … +0.008 | no |
| usdjpy | V1 | −0.021 | +0.001 | −0.008 … +0.008 | no |
| usdjpy | V2 | −0.031 | +0.004 | −0.009 … +0.013 | no |

**What it says.** Net R a trade, discovery / confirmation: gold V0 +0.205 / +0.098R a trade (confirmation n 2250, gross +0.115, cost +0.016, t +3.84), V1 +0.193 / +0.097R a trade (confirmation n 1978, gross +0.111, cost +0.015, t +3.87), V2 +0.170 / +0.079R a trade (confirmation n 1786, gross +0.093, cost +0.014, t +3.43); USD/JPY V0 +0.092 / +0.055R a trade (confirmation n 2275, gross +0.087, cost +0.032, t +2.22), V1 +0.057 / +0.057R a trade (confirmation n 2025, gross +0.085, cost +0.028, t +2.64), V2 +0.051 / +0.049R a trade (confirmation n 1856, gross +0.076, cost +0.027, t +2.31). Control, mean d on random entries (median over 40 seeds): gold V1 −0.002 (T1 −0.023), gold V2 −0.003 (T1 −0.050); USD/JPY V1 +0.001 (T1 −0.021), USD/JPY V2 +0.004 (T1 −0.031). No close-confirmed entry meets the pre-registered bar: the rule keeps its stop-order entry on the touch. Paper research; nothing live changes and no proposal is written.

Data: OANDA mid M5 from the shared candle cache (edgekit): xau 2006-03-19 → 2026-11-20 (1474554 M5 candles); usdjpy 2005-01-02 → 2026-11-20 (1644641 M5 candles). Cautions: today's demo cost on every past year; gold stop slippage modelled (0.05 x M), not measured; OANDA mid candles are not broker fills (an entry at a candle close is a market order a few seconds later in practice); both windows were read before for the rule itself.
