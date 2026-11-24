# The H1 dominant-zone limit on the side of the day's volatility breakout (result)

**Verdict: FAIL. 0 of 3 tests pass, control beaten in 87 of 200 draws; in 2015-26 DOM limits WITH the day's breakout made -0.060R a trade after costs (n 50835, month t -7.13; before costs +0.029R), AGAINST -0.057R (n 34611, t -6.33), all DOM trades -0.052R (n 257521, t -15.2).**

Run 2026-11-24 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live changed,
nothing is proposed. One run, no variants. A before-cost tilt is not an edge.

## What was run

Gold and the six forex majors of `fx-vol-breakout` (xau, eurusd, gbpusd, usdjpy, audusd, usdcad, usdchf), OANDA mid 5-minute
candles. DOM trades = `dom-zone-holdout`'s rule (trailing exit), checked trade for trade against its own `trades()` (xau 2016: 2736 trades, 0 differ; eurusd 2016: 3181 trades, 0 differ; gbpusd 2016: 3040 trades, 0 differ; usdjpy 2016: 3111 trades, 0 differ; audusd 2016: 3194 trades, 0 differ; usdcad 2016: 3166 trades, 0 differ; usdchf 2016: 2969 trades, 0 differ).
Breakout days from the T1 studies' own `buildDays` / `daySkip` / `vbTrade` (k 0.5, both sides). A DOM limit armed after the
breakout's fill candle closed and before 21:00 UTC is WITH when on the breakout's side, AGAINST otherwise. Costs = `combo-grid-3`
`COSTS` as cost / risk (usdcad and usdchf ASSUMED). Discovery 2005-2014, confirmation 2015 to October 2026.

## The tests (Holm over three) and the control

| Test | Pass | Holm p |
|---|---|---:|
| T1 WITH alone after costs | no | 1.000 |
| T2 WITH against ALL after costs: WITH minus ALL +0.006R in 2005-14, -0.008R in 2015-26 (Welch t against the rest 0.91 / -1.52) | no | 1.000 |
| T3 WITH against AGAINST after costs: +0.009R (Welch t 0.91) in 2005-14, -0.004R (t -0.41) in 2015-26 | no | 1.000 |
| Control: WITH 2015-26 after costs beats 87 of 200 random-day draws (needed 190; draws p5 -0.071, median -0.058, p95 -0.046R) | no | |

## Pooled (trailing exit)

| Set | n 2005-14 | R before costs | R after | month t (after) | n 2015-26 | R before costs (month t) | R after | month t (after) | cost R |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ALL DOM | 205754 | +0.064 | -0.028 | -6.56 | 257521 | +0.052 (t 16.63) | -0.052 | -15.2 | 0.104 |
| WITH breakout | 37739 | +0.055 | -0.022 | -2.36 | 50835 | +0.029 (t 3.45) | -0.060 | -7.13 | 0.089 |
| AGAINST breakout | 28007 | +0.051 | -0.031 | -3.16 | 34611 | +0.039 (t 4.38) | -0.057 | -6.33 | 0.095 |

4R exit (reported): WITH -0.015R / -0.068R after costs (2005-14 / 2015-26), ALL -0.024R / -0.060R.

## Per market

### xau

Breakout days 3851, DOM trades 58908.

| Set | n 2005-14 | R before costs | R after | month t (after) | n 2015-26 | R before costs (month t) | R after | month t (after) | cost R |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ALL | 24794 | +0.049 | -0.126 | -10.58 | 34114 | +0.049 (t 6.36) | -0.096 | -9.85 | 0.144 |
| WITH | 4246 | +0.068 | -0.082 | -3.14 | 6767 | +0.071 (t 3.58) | -0.055 | -2.65 | 0.126 |
| AGAINST | 3042 | +0.001 | -0.157 | -5.58 | 4690 | +0.030 (t 1.23) | -0.103 | -4.09 | 0.134 |

### eurusd

Breakout days 4232, DOM trades 67027.

| Set | n 2005-14 | R before costs | R after | month t (after) | n 2015-26 | R before costs (month t) | R after | month t (after) | cost R |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ALL | 29884 | +0.082 | +0.016 | 1.82 | 37143 | +0.046 (t 6.64) | -0.045 | -6.27 | 0.091 |
| WITH | 5134 | +0.086 | +0.033 | 1.38 | 6942 | +0.012 (t 0.59) | -0.062 | -2.93 | 0.074 |
| AGAINST | 4045 | +0.062 | +0.004 | 0.19 | 4616 | +0.088 (t 3.38) | +0.007 | 0.28 | 0.081 |

### gbpusd

Breakout days 4255, DOM trades 67157.

| Set | n 2005-14 | R before costs | R after | month t (after) | n 2015-26 | R before costs (month t) | R after | month t (after) | cost R |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ALL | 30279 | +0.074 | +0.003 | 0.37 | 36878 | +0.043 (t 5.57) | -0.046 | -6.02 | 0.089 |
| WITH | 5372 | +0.028 | -0.028 | -1.32 | 6800 | +0.030 (t 1.36) | -0.043 | -1.95 | 0.073 |
| AGAINST | 4091 | +0.078 | +0.014 | 0.55 | 4870 | +0.013 (t 0.61) | -0.065 | -3.01 | 0.078 |

### usdjpy

Breakout days 4157, DOM trades 66880.

| Set | n 2005-14 | R before costs | R after | month t (after) | n 2015-26 | R before costs (month t) | R after | month t (after) | cost R |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ALL | 29820 | +0.068 | -0.034 | -3.67 | 37060 | +0.077 (t 9.69) | -0.023 | -2.7 | 0.100 |
| WITH | 5856 | +0.098 | +0.009 | 0.45 | 7698 | +0.041 (t 2.06) | -0.047 | -2.3 | 0.088 |
| AGAINST | 4477 | +0.058 | -0.039 | -1.95 | 5492 | +0.056 (t 2.49) | -0.039 | -1.73 | 0.095 |

### audusd

Breakout days 4255, DOM trades 68766.

| Set | n 2005-14 | R before costs | R after | month t (after) | n 2015-26 | R before costs (month t) | R after | month t (after) | cost R |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ALL | 31154 | +0.069 | +0.001 | 0.14 | 37612 | +0.058 (t 7.27) | -0.039 | -4.75 | 0.097 |
| WITH | 6496 | +0.053 | -0.007 | -0.32 | 8026 | +0.016 (t 0.9) | -0.071 | -3.95 | 0.086 |
| AGAINST | 4982 | +0.071 | +0.006 | 0.27 | 5830 | +0.020 (t 0.89) | -0.074 | -3.26 | 0.094 |

### usdcad (cost ASSUMED)

Breakout days 4239, DOM trades 68217.

| Set | n 2005-14 | R before costs | R after | month t (after) | n 2015-26 | R before costs (month t) | R after | month t (after) | cost R |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ALL | 30458 | +0.043 | -0.045 | -4.96 | 37759 | +0.038 (t 5.23) | -0.055 | -7.41 | 0.094 |
| WITH | 5472 | +0.013 | -0.060 | -3.02 | 7331 | +0.025 (t 1.15) | -0.056 | -2.62 | 0.081 |
| AGAINST | 3577 | +0.017 | -0.061 | -2.53 | 4464 | +0.024 (t 1.1) | -0.060 | -2.74 | 0.085 |

### usdchf (cost ASSUMED)

Breakout days 4253, DOM trades 66320.

| Set | n 2005-14 | R before costs | R after | month t (after) | n 2015-26 | R before costs (month t) | R after | month t (after) | cost R |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ALL | 29365 | +0.060 | -0.027 | -2.95 | 36955 | +0.051 (t 6.31) | -0.065 | -7.47 | 0.116 |
| WITH | 5163 | +0.037 | -0.036 | -1.42 | 7271 | +0.010 (t 0.48) | -0.087 | -4.22 | 0.097 |
| AGAINST | 3793 | +0.046 | -0.030 | -1.17 | 4649 | +0.042 (t 2.05) | -0.060 | -2.84 | 0.102 |

## No look-ahead

Cut test (breakout labels and the set of every DOM trade filled before a cut, recomputed on candles cut there, against the full
run): xau 2008-06-11: 66 days, labels differing 0, 968 trades, missing 0; xau 2012-03-14: 61 days, labels differing 0, 985 trades, missing 0; xau 2017-09-20: 55 days, labels differing 0, 800 trades, missing 0; xau 2021-02-17: 59 days, labels differing 0, 853 trades, missing 0; xau 2025-05-07: 64 days, labels differing 0, 992 trades, missing 0; usdjpy 2008-06-11: 70 days, labels differing 0, 1015 trades, missing 0; usdjpy 2012-03-14: 58 days, labels differing 0, 923 trades, missing 0; usdjpy 2017-09-20: 62 days, labels differing 0, 948 trades, missing 0; usdjpy 2021-02-17: 63 days, labels differing 0, 1017 trades, missing 0; usdjpy 2025-05-07: 71 days, labels differing 0, 1072 trades, missing 0.

## Caveats

- DOM trades overlap freely (as the parent rule); trades of one day are not independent, so Welch t overstates certainty.
- Costs are today's demo figures (two assumed) charged on every year.
- Only the DOM limits armed after the breakout filled are split; the breakout itself is not traded here.
