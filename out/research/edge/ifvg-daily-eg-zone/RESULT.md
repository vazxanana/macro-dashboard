# H1 inversion-gap reversal inside a Daily engulf zone: result (24 Nov 2026)

**Verdict: FAIL. 0 of 9 cells pass; the best cell, in 3R, made -0.012R a trade after costs in 2015-26 (n 9,289, month t -0.80; discovery -0.008R, n 7,592, t -0.55).**

Pre-registered in PREREGISTRATION.md (committed alone before this run). The ICT desk's H1 signal function, every signal, split by
whether the sweep's extreme lay inside a Daily engulf zone (`eg`), a failed and turned Daily engulf zone (`ef`), either (`in`) or
neither (`out`, the control) of the trade's side. Five markets pooled (xau, eurusd, gbpusd, usdjpy, audusd), OANDA mid 5-minute
candles, market entry after the H1 close, the signal's stop, a 1R / 2R / 3R target, out after 36 hours. Research only.

Signals: 27,779 (fills already past the stop, no trade: 9; still open at the end of the data: 3).

## Every cell

R a trade before costs / after costs; month t = t of calendar-month sums after costs; Holm over the 9 tested cells (confirmation, one-sided).

| cell | disc n | disc win | disc before | disc after | disc month t | conf n | conf win | conf before | conf after | conf month t | Holm p | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| in 1R | 7592 | 50% | +0.005 | -0.023 | -2.17 | 9291 | 50% | +0.001 | -0.029 | -3.20 | 1.000 | no |
| in 2R | 7592 | 39% | +0.020 | -0.008 | -0.66 | 9290 | 39% | +0.017 | -0.014 | -1.15 | 1.000 | no |
| in 3R | 7592 | 36% | +0.021 | -0.008 | -0.55 | 9289 | 36% | +0.019 | -0.012 | -0.80 | 1.000 | no |
| eg 1R | 5673 | 50% | +0.015 | -0.013 | -0.98 | 6962 | 50% | -0.002 | -0.033 | -3.01 | 1.000 | no |
| eg 2R | 5673 | 40% | +0.036 | +0.008 | 0.46 | 6962 | 39% | +0.014 | -0.017 | -1.07 | 1.000 | no |
| eg 3R | 5673 | 37% | +0.047 | +0.018 | 1.03 | 6961 | 36% | +0.018 | -0.013 | -0.68 | 1.000 | no |
| ef 1R | 3785 | 50% | -0.003 | -0.031 | -2.02 | 4640 | 49% | -0.011 | -0.041 | -2.94 | 1.000 | no |
| ef 2R | 3785 | 38% | -0.006 | -0.034 | -1.67 | 4639 | 39% | +0.001 | -0.030 | -1.64 | 1.000 | no |
| ef 3R | 3785 | 35% | -0.007 | -0.035 | -1.55 | 4639 | 36% | -0.006 | -0.036 | -1.69 | 1.000 | no |
| out 1R (control) | 5217 | 49% | -0.007 | -0.039 | -2.93 | 5667 | 50% | +0.002 | -0.029 | -2.19 |  |  |
| out 2R (control) | 5217 | 38% | -0.007 | -0.039 | -2.22 | 5666 | 38% | +0.013 | -0.018 | -1.16 |  |  |
| out 3R (control) | 5217 | 35% | +0.009 | -0.023 | -1.18 | 5666 | 35% | +0.027 | -0.004 | -0.20 |  |  |

## Inside a zone against outside (after costs, Welch t on trades; reported, not part of the bar)

| target | discovery in - out | t | confirmation in - out | t |
|---|---|---|---|---|
| 1R | +0.015 | 0.89 | -0.001 | -0.05 |
| 2R | +0.031 | 1.37 | +0.003 | 0.16 |
| 3R | +0.015 | 0.60 | -0.008 | -0.34 |

## By market, the `in 2R` cell (after costs)

| market | signals | in a zone | disc n | disc after | conf n | conf after |
|---|---|---|---|---|---|---|
| xau | 5120 | 3074 | 1337 | -0.047 | 1735 | -0.020 |
| eurusd | 5685 | 3370 | 1464 | +0.006 | 1905 | +0.007 |
| gbpusd | 5705 | 3553 | 1642 | +0.048 | 1910 | -0.009 |
| usdjpy | 5441 | 3259 | 1485 | -0.021 | 1772 | -0.002 |
| audusd | 5828 | 3634 | 1664 | -0.034 | 1968 | -0.046 |

## Reading

No cell cleared the bar. The Daily engulf zone does not turn the H1 inversion-gap reversal into a rule that makes money after costs on these five markets; see the in-minus-out table for whether the zone picks better trades at all.

Note: 61% of all signals fall inside such a zone (a Daily zone lives up to 120 days, so several usually stand near price): the condition is loose, and it does not separate better trades from worse ones in the confirmation window.

Limits: OANDA mid candles, no spread widening, a flat round-trip cost per market for every year; H1 candles are UTC hours of
spot candles (the desk itself trades futures hours); gold starts in March 2006; no data-quality exclusion list; `eg` and `ef` overlap
with `in`, so the nine cells are not independent. One run, no variant tested after the result. Nothing live changed.
