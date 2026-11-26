# The FVG tap after a continuation move on other timeframes, judged on the untouched holdout: result (25 Nov 2026)

**Verdict: FAIL.** Holdout R a trade after costs: R1 −0.035 (n 418), R2 −0.064 (n 1003), R3 −0.097 (n 3301), R4 −0.099 (n 8751), R5 +0.042 (n 180); none passes.

Pre-registered in PREREGISTRATION.md (committed before any code); run by `run.mjs` on the toolkit's OANDA mid 5m cache, holdout only
(Set A: gold, EUR/USD, GBP/USD, USD/JPY, AUD/USD 2005-2009; Set B: NZD/USD, USD/CAD, USD/CHF, EUR/JPY, silver 2005 to now). **Set B costs are
assumed, not measured.** R after the toolkit's round-trip costs unless said; t on calendar-month sums; p one-sided; Holm across R1-R5.

| Reading | Sample | n | R a trade after costs | month t | at 2x costs | before costs | Holm p | passes |
|---|---|---|---|---|---|---|---|---|
| R1 H4 gap, H1 QM | pooled | 418 | −0.035 | −0.44 | −0.070 | −0.000 | 1.00 | no |
| | Set A | 84 | −0.091 | −0.61 | −0.111 | −0.071 | | |
| | Set B | 334 | −0.021 | −0.23 | −0.059 | +0.017 | | |
| R2 H4 gap, H1 CHoCH | pooled | 1003 | −0.064 | −1.19 | −0.096 | −0.032 | 1.00 | no |
| | Set A | 199 | −0.029 | −0.23 | −0.048 | −0.011 | | |
| | Set B | 804 | −0.073 | −1.38 | −0.108 | −0.037 | | |
| R3 M15 gap, M5 QM | pooled | 3301 | −0.097 | −3.79 | −0.174 | −0.018 | 1.00 | no |
| | Set A | 652 | −0.075 | −1.48 | −0.134 | −0.017 | | |
| | Set B | 2649 | −0.102 | −3.51 | −0.185 | −0.019 | | |
| R4 M15 gap, M5 CHoCH | pooled | 8751 | −0.099 | −6.11 | −0.176 | −0.022 | 1.00 | no |
| | Set A | 1847 | −0.074 | −2.30 | −0.132 | −0.016 | | |
| | Set B | 6904 | −0.106 | −5.99 | −0.188 | −0.024 | | |
| R5 H1 gap, H1 QM (head need dropped) | pooled | 180 | +0.042 | 0.40 | −0.005 | +0.088 | 1.00 | no |
| | Set A | 29 | −0.196 | −0.81 | −0.220 | −0.171 | | |
| | Set B | 151 | +0.087 | 0.75 | +0.037 | +0.137 | | |

R1: lines missed: mean, t, holm, setA, setB, x2, halves; buys −0.066R (n 203), sells −0.006R (n 215); median target +1.69R, median cost +0.018R; exits target 146, stop 272.

R2: lines missed: mean, t, holm, setA, setB, x2, halves; buys −0.090R (n 505), sells −0.038R (n 498); median target +1.80R, median cost +0.018R; exits stop 665, target 336, time 2.

R3: lines missed: mean, t, holm, setA, setB, x2, halves; buys −0.110R (n 1589), sells −0.084R (n 1712); median target +1.73R, median cost +0.060R; exits target 1100, stop 2126, time 75.

R4: lines missed: mean, t, holm, setA, setB, x2, halves; buys −0.120R (n 4287), sells −0.079R (n 4464); median target +1.73R, median cost +0.059R; exits target 2906, stop 5604, time 241.

R5: lines missed: t, holm, setA, x2; buys −0.052R (n 76), sells +0.110R (n 104); median target +1.45R, median cost +0.025R; exits stop 103, target 74, time 3.

## In plain words

- R1 H4 gap, H1 QM: before costs −0.000R, after −0.035R; Set A −0.091R (n 84), Set B −0.021R (n 334).
- R2 H4 gap, H1 CHoCH: before costs −0.032R, after −0.064R; Set A −0.029R (n 199), Set B −0.073R (n 804).
- R3 M15 gap, M5 QM: before costs −0.018R, after −0.097R; Set A −0.075R (n 652), Set B −0.102R (n 2649).
- R4 M15 gap, M5 CHoCH: before costs −0.022R, after −0.099R; Set A −0.074R (n 1847), Set B −0.106R (n 6904).
- R5 H1 gap, H1 QM (head need dropped): before costs +0.088R, after +0.042R; Set A −0.196R (n 29), Set B +0.087R (n 151).

## What it does NOT show

- Only five fixed readings of the owner's idea on 2005-2009 (five markets) and 2005 to now (five more); 2010 onward on the first five markets was spent by `fvg-qm-continuation` and not loaded.
- No FVG size, tap rule, stop, target or hold was varied. Set B costs are assumed; financing is not charged; stop slippage beyond a gap is not modelled.
- A FAIL judges this mechanical reading, not the owner's own marking.

Nothing live changed. Files: result.json, trades.json, tests/fvg-qm-timeframes.test.mjs.
