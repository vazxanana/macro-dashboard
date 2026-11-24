# Big-candle fade plus: two complemented fades on fresh markets (result)

**Verdict: FAIL. neither rule passes after costs on the ten fresh markets; the better, B rejection wick + confirmation, made +0.012R a trade after costs (n 1,332, month t 0.32; before costs +0.048R).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first; the two rules were picked in
`EXPLORATION.md` on the ten markets `big-candle-fade` read). Research only: nothing live changed, nothing is proposed. One run.

## The rules

- **A, overnight shock fade**: an M15 candle (body > 1.5 x ATR, range >= 0.5 x D1 ATR) starting 21:00-06:59 UTC, faded at the next
  5-minute open, stop 0.1 ATR past its extreme, target its open (when 1R or more away), 1 day.
- **B, rejection wick + confirmation**: the same size, a wick of 25 % or more, the next M15 candle the other colour; faded after it,
  stop 0.5 ATR past the extreme, 2R, 1 day.

Ten markets never read by the big-candle work: eurgbp, euraud, eurchf, gbpjpy, audjpy, cadjpy, gbpaud, nas100, spx500, de40. Costs: `combo-grid-2` `COSTS`; assumed here for eurchf and
gbpaud; none measured on these markets at these hours. Bar: after costs, n >= 300 a window, positive in both windows, month t >= 2
over 2005-2026 with Holm over the 2 rules, positive without the best 1 % of trades and at 1.5x costs.

## Results (pooled)

| Rule | n | R before | R after | month t after | Holm | 2005-14 n / after (t) | 2015-26 n / after (t) | without best 1 % | at 1.5x cost | median | 10 best share | cost R | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| A overnight shock fade | 1,939 | +0.167 | +0.004 | 0.05 | 0.751 | 779 / -0.027 (-0.22) | 1,160 / +0.025 (0.22) | -0.197 | -0.077 | -1.082 | 2896 % | 0.163 | no |
| B rejection wick + confirmation | 1,332 | +0.048 | +0.012 | 0.32 | 0.751 | 569 / -0.018 (-0.33) | 763 / +0.035 (0.66) | -0.008 | -0.006 | -0.488 | 130 % | 0.036 | no |

## Per market

| Market | cost | A n | A before | A after (t) | B n | B before | B after (t) |
|---|---:|---:|---:|---:|---:|---:|---:|
| eurgbp | 0.00009 | 94 | +0.217 | -0.035 (-0.10) | 143 | -0.090 | -0.135 (-1.46) |
| euraud | 0.00013 | 411 | +0.179 | +0.021 (0.14) | 149 | +0.079 | +0.052 (0.52) |
| eurchf* | 0.0001 | 144 | +0.537 | +0.290 (1.34) | 169 | -0.020 | -0.079 (-0.92) |
| gbpjpy | 0.014 | 197 | +0.264 | +0.150 (0.71) | 142 | +0.140 | +0.118 (1.22) |
| audjpy | 0.01 | 395 | -0.004 | -0.161 (-1.24) | 129 | +0.109 | +0.084 (0.90) |
| cadjpy | 0.01 | 163 | +0.575 | +0.441 (1.60) | 154 | +0.083 | +0.057 (0.57) |
| gbpaud* | 0.00016 | 372 | +0.116 | -0.040 (-0.25) | 126 | +0.039 | +0.013 (0.12) |
| nas100 | 1 | 69 | -0.405 | -0.544 (-2.82) | 99 | +0.023 | -0.029 (-0.25) |
| spx500 | 0.4 | 70 | -0.093 | -0.278 (-0.91) | 104 | +0.152 | +0.104 (0.80) |
| de40 | 1.5 | 24 | -0.038 | -0.201 (-0.46) | 117 | -0.010 | -0.040 (-0.34) |

* = cost assumed in this study.

## What it means

Neither complement carries the fade past its costs on markets it was not picked on: what looked positive in the exploration
was selection among many cells. The big-candle fade stays a before-cost tilt. Close this line on M15; do not re-test variants
on these markets.
