# DOM zone on gold: can the better trades be told apart at the fill? (result)

**Verdict: PASS. On 2024 to now the kept third made +0.190R a trade after costs (n 2965, month t 5.01) against +0.072R for all trades; better than the rest by Welch t 3.86, and it beat 40 of 40 shuffled refits.**

Built 2026-11-26. Pre-registered (PREREGISTRATION.md, committed alone before any figure). Paper research only; nothing live changed, no rule is proposed.

## What was run

The trades are `dom-gold-hourcost`'s own list (the H1 dominant-zone limit on gold, OANDA mid 5-minute candles to 2026-11-22), 4R exit, R after costs = R less the demo broker's measured spread of the fill and exit hours, commission, 0.05 x M stop slippage and long financing (route C1). Ten features known at the fill were turned into levels; on window A (fills 2021-23, 8850 trades) each level got the value (its mean R after costs less the mean of all A trades) x n / (n + 200), and a trade's score is the sum of its ten values. The terciles of the A scores (-0.0803 and 0.0681) split window B (fills 2024 to now, 8909 trades) with nothing refitted: KEEP = top third, AVOID = bottom third, MID = the rest.

Gates: the exit walk agrees with the grid's on every trade (yes); the trade list is the hourcost study's (8850 and 8909 trades, −0.015R and +0.072R after costs; that study published 8850 and 8911 on candles to 2026-11-23 12:45 UTC, this cache ends 2026-11-22 23:55 UTC; gate G2 holds); the cost profile is the probe file of that study (yes).

## The three groups

n / R a trade after costs (month t) / R before costs

| Group | 2021-23 (where the score was fitted) | 2024-now (the test) |
|---|---|---|
| all | 8850 / −0.015 (-0.48) / +0.060 | 8909 / +0.072 (3.34) / +0.142 |
| KEEP | 2960 / +0.072 (1.34) / +0.125 | 2965 / +0.190 (5.01) / +0.239 |
| MID | 2940 / +0.029 (0.51) / +0.108 | 3207 / −0.056 (-1.01) / +0.015 |
| AVOID | 2950 / −0.146 (-2.87) / −0.054 | 2737 / +0.094 (1.83) / +0.186 |

## The test on 2024-now

| Condition | Result | Met |
|---|---|---|
| (a) KEEP above all trades, and KEEP minus the rest Welch t >= 2 | +0.190R against +0.072R; Welch t 3.86 | yes |
| (b) KEEP month-sum t >= 2 and mean > 0 | t 5.01, +0.190R | yes |
| (c) placebo: beats at least 38 of 40 shuffled refits | 40 of 40 | yes |
| USEFUL TO AVOID: AVOID minus the rest Welch t <= -2 and AVOID mean < 0 | +0.094R; Welch t 0.66 | no |

Placebo: with the 2021-23 outcomes shuffled among the 2021-23 trades and the score refitted, the "kept" third of 2024-now made between −0.035R and +0.165R a trade (median +0.068R) over 40 seeds; the real kept third (+0.190R) beat 40 of them. In sample (2021-23, descriptive): KEEP against the rest Welch t 2.96, AVOID against the rest -4.45.

## By year (R a trade after costs, n)

| Year | all | KEEP | MID | AVOID |
|---|---|---|---|---|
| 2021 | −0.007 (2876) | +0.071 (958) | −0.032 (965) | −0.060 (953) |
| 2022 | +0.007 (3080) | +0.066 (1072) | +0.094 (1030) | −0.149 (978) |
| 2023 | −0.047 (2894) | +0.079 (930) | +0.020 (945) | −0.224 (1019) |
| 2024 | +0.044 (3097) | +0.184 (1023) | −0.081 (1078) | +0.035 (996) |
| 2025 | +0.112 (3078) | +0.204 (993) | −0.042 (1103) | +0.194 (982) |
| 2026 | +0.059 (2734) | +0.184 (949) | −0.043 (1026) | +0.043 (759) |

## Every feature level, both windows (descriptive)

n / R after costs (month t) / R before costs. "Value" is the level's fitted share of the score. "Same side" = the level sits on the same side of its window's average in both windows.

| Feature | Level | Value | 2021-23 | 2024-now | Same side |
|---|---|---|---|---|---|
| side | buy | +0.0024 | 4517 / −0.012 (-0.25) / +0.073 | 4900 / +0.152 (3.25) / +0.230 | yes |
| side | sell | −0.0025 | 4333 / −0.018 (-0.33) / +0.046 | 4009 / −0.025 (-0.61) / +0.035 | yes |
| session | Asia | −0.0380 | 3141 / −0.055 (-1.16) / +0.006 | 3215 / +0.086 (2) / +0.146 | no |
| session | London | +0.0796 | 2001 / +0.073 (1.35) / +0.145 | 1990 / +0.096 (1.89) / +0.156 | yes |
| session | New York | +0.0060 | 2632 / −0.009 (-0.17) / +0.076 | 2549 / +0.095 (2.56) / +0.176 | yes |
| session | late | −0.0510 | 1076 / −0.075 (-1.18) / +0.020 | 1155 / −0.056 (-0.85) / +0.031 | yes |
| cost | low | +0.0507 | 2950 / +0.039 (0.9) / +0.083 | 3799 / +0.072 (1.98) / +0.112 | no |
| cost | mid | −0.0055 | 2950 / −0.021 (-0.38) / +0.042 | 2695 / +0.084 (1.95) / +0.145 | no |
| cost | high | −0.0452 | 2950 / −0.063 (-1.49) / +0.054 | 2415 / +0.059 (1.51) / +0.184 | yes |
| stop | low | −0.0662 | 2950 / −0.086 (-1.71) / +0.027 | 3180 / +0.074 (1.7) / +0.181 | no |
| stop | mid | −0.0231 | 2950 / −0.040 (-0.75) / +0.024 | 2987 / +0.034 (0.67) / +0.089 | yes |
| stop | high | +0.0893 | 2950 / +0.080 (1.82) / +0.129 | 2742 / +0.112 (2.82) / +0.154 | yes |
| sideways | yes | +0.0431 | 3784 / +0.030 (0.57) / +0.104 | 3921 / +0.084 (2.38) / +0.156 | yes |
| sideways | no | −0.0326 | 5066 / −0.049 (-1.43) / +0.027 | 4988 / +0.063 (1.81) / +0.131 | yes |
| trend | with | +0.0260 | 5100 / +0.012 (0.24) / +0.086 | 5268 / +0.118 (2.75) / +0.189 | yes |
| trend | against | −0.0349 | 3750 / −0.052 (-1.03) / +0.024 | 3641 / +0.006 (0.11) / +0.074 | yes |
| move20 | with | −0.0020 | 4711 / −0.017 (-0.38) / +0.057 | 4908 / +0.139 (2.88) / +0.209 | no |
| move20 | against | +0.0023 | 4139 / −0.013 (-0.26) / +0.063 | 4001 / −0.009 (-0.19) / +0.060 | no |
| er | low | −0.0410 | 2953 / −0.059 (-1.26) / +0.019 | 3212 / +0.004 (0.09) / +0.073 | yes |
| er | mid | +0.0433 | 2955 / +0.031 (0.55) / +0.107 | 2912 / +0.103 (2.52) / +0.174 | yes |
| er | high | −0.0024 | 2942 / −0.018 (-0.34) / +0.053 | 2785 / +0.118 (2.56) / +0.187 | no |
| age | 0-3 | −0.0315 | 5556 / −0.048 (-1.62) / +0.027 | 5452 / +0.081 (2.57) / +0.150 | no |
| age | 4-12 | +0.0352 | 1734 / +0.024 (0.34) / +0.099 | 1849 / +0.101 (1.75) / +0.171 | yes |
| age | over 12 | +0.0644 | 1560 / +0.058 (0.79) / +0.133 | 1608 / +0.009 (0.18) / +0.080 | no |
| weekday | Monday | −0.0791 | 1695 / −0.103 (-1.94) / −0.033 | 1759 / +0.081 (1.22) / +0.147 | no |
| weekday | Tuesday-Thursday | +0.0219 | 5442 / +0.008 (0.21) / +0.085 | 5414 / +0.108 (3.37) / +0.180 | yes |
| weekday | Friday | +0.0137 | 1713 / +0.000 (0) / +0.073 | 1736 / −0.048 (-0.87) / +0.019 | no |

Tercile cuts from 2021-23: cost share 0.0385 and 0.0660; stop / ATR 0.529 and 0.889; efficiency ratio 0.143 and 0.317.

## Cut test

- Candles cut at 2022-06-15: 4223 trades that ended before it, with their exits and all their features, identical when later candles are removed.
- Candles cut at 2024-03-15: 9481 trades that ended before it, with their exits and all their features, identical when later candles are removed.
- Candles cut at 2025-09-15: 14076 trades that ended before it, with their exits and all their features, identical when later candles are removed.

## How the pre-registration was read

- Cost share: M is the median range of the 12 five-minute candles closed before the fill candle (the cost itself uses 12 candles ending with the fill candle, which is not closed at the fill).
- Sideways: combo-grid-3's definition, read when the order was placed (the start of the candle that touched the zone), which is at or before the fill.
- Daily candles are UTC calendar days built from the 5-minute candles, the short Sunday reopen candle included as a day (as written: "UTC daily").
- Weekday: a fill in the Sunday reopen hours (22:00-24:00 UTC) counts as Monday.
- H1 trend and the 20-day move: "with" needs the sign to equal the side; an exact tie counts as against.
- Month-sum t: every calendar month of the window (or year), empty months as zero.
- Every trade was tied to its zone by fill time, side, entry and stop; no two signals share them.

## What it means

The score fitted on 2021-23 picked a better third on 2024-now: +0.190R a trade after costs against −0.056R and +0.094R for the other two thirds. That meets the pre-registered bar, and it is a hypothesis for the forward demo record, nothing more.

Read it with care: the score does not order the trades. The third it said to avoid made +0.094R a trade on 2024-now, more than the middle third (−0.056R) and above zero, while in 2021-23 it was the worst (−0.146R). So the bottom of the score did not carry over at all; only the top did. A score that works at one end and is upside down at the other is weaker evidence than the verdict word suggests.

All trades made −0.015R a trade after costs in 2021-23 and +0.072R in 2024-now, so most of what any group shows on 2024-now is the window itself, not the selection.

These are in-sample years: 2020-26 has been read by the grids that chose this family, and the costs are one demo broker's quotes on mid candles (at the broker's own ticks the limit filled worse). Whatever the verdict, this is not an edge and no rule follows from it. One run; no feature, level, shrinkage or cut is changed after it, and no variant is tried on these years.
