# USD/JPY T1 breakout on gotobi days (24 Nov 2026)

**Verdict: NO DIFFERENCE, 0 of 2: T1 on gotobi days minus other days −0.063R a trade in 2015 on (Welch t −1.08, n 627 vs 1648), sells +0.067R (t +0.80, n 323 vs 838)**

Paper research only, pre-registered in `PREREGISTRATION.md` (committed alone first). Rule, days and cost imported unchanged from `index-vol-breakout/original.mjs` and `fx-vol-breakout` (`charge`: 0.000045 of the entry + 0.5 pip); calendar `council/gotobi-calendar.mjs`; OANDA mid M5. Nothing live changed.

| Test | Window | Gotobi n | Gotobi R before / after costs | Other n | Other R before / after | Difference (after) | Welch t | Months / month t of the difference | Placebo share ≥ |diff| |
|---|---|---|---|---|---|---|---|---|---|
| G1 all trades | 2005-2014 | 542 | −0.007 / −0.035 | 1352 | +0.173 / +0.144 | −0.179 | −2.80 | 120 / −2.48 | 0.008 |
| G1 all trades | 2015 → 2026-11-20 | 627 | +0.040 / +0.009 | 1648 | +0.105 / +0.072 | −0.063 | −1.08 | 143 / −1.53 | 0.317 |
| G2 sell fills | 2005-2014 | 298 | −0.057 / −0.084 | 712 | +0.119 / +0.090 | −0.174 | −2.02 | 113 / −2.94 | 0.039 |
| G2 sell fills | 2015 → 2026-11-20 | 323 | +0.049 / +0.019 | 838 | −0.015 / −0.048 | +0.067 | +0.80 | 125 / +0.71 | 0.408 |

Holm p (confirmation): G1 0.563, G2 0.563. Checks: G1 sameSign yes, t2 no, holm no, n200 yes, placebo no; G2 sameSign no, t2 no, holm no, n200 yes, placebo no, gotobiPositive no.

## G3, descriptive: T1 and the gotobi fade (T2) on the same gotobi days

| Window | Days with both | Correlation of daily net R | T1 net R | Fade net R | Book (sum) net R a day | Book month t |
|---|---|---|---|---|---|---|
| 2005-2014 | 537 | 0.03 | −0.041 | +0.287 | +0.246 | +3.15 |
| 2015 → now | 627 | 0.043 | +0.009 | +0.181 | +0.190 | +2.32 |

**Reading.** No pre-registered test passes. G1: in 2005-2014 T1 did worse on gotobi days (−0.035R against +0.144R a trade after costs, difference −0.179R, Welch t −2.80, 0.8 % of random day sets as far apart), but in 2015 on the gap shrank to −0.063R (t −1.08, Holm p 0.56, 31.7 % of random sets): the same sign, not confirmed. G2: sell fills on gotobi days were worse in 2005-2014 (−0.174R, t −2.02) and better in 2015 on (+0.067R, t 0.80): the sign flipped, so the gotobi fade does not show up as better T1 sells. T1 on gotobi days is about flat after costs in both windows (n 542 and 627). G3 (descriptive): on gotobi days T1 and the fade are nearly uncorrelated (daily net R correlation 0.03 and 0.04); the fade carries the sum (+0.29R and +0.18R a day against T1 −0.04R and +0.01R). Do not skip or add T1 trades by the gotobi calendar on this evidence; the discovery gap is a hypothesis at most, and it did not repeat. Costs: the demo commission + 0.5 pip charged on every year (2005-14 spreads were wider). Nothing live changed.

Data: OANDA mid M5 usdjpy 2005-01-03 → 2026-11-20, 1644664 candles, 4169 T1 trades.
