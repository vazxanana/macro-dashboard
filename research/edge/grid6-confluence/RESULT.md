# Grid 6: does stacking context signals help an H1 trigger? (result)

**Verdict: FAIL. 0 of 21 tests pass after Holm (placebo 0); 27,328 trades, the 2R slope of R on the count is +0.004R a signal in 2010-14 (month-cluster t 0.36) and −0.005R in 2015-19 (t −0.46), and score >= 5 makes −0.006R a trade in 2015-19 (n 4,650, month t −0.29).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first, commit 004dea4). Research only:
nothing live changed. Never call any of this an edge.

## What was run

OANDA mid 5-minute candles 2009-2019 (2009 warm-up; fills 2010-2019) for xau, eurusd, gbpusd, usdjpy, audusd; the data-quality
exclusions applied (4 fills dropped); costs of combo-grid-2. Triggers: every H1 structure break (`structure(H1, 3)`, BO
or ChoCh) and every H1 box close-out (`boxesHL(H1, 3)`), one trigger per candle and side: 27,389 triggers,
27,328 trades (the rest had a stop past the fill, a risk under one round trip, or filled outside 2010-19)
and 27,340 side-flipped placebo trades. Each trigger counts ten context signals that agree with its
side (closed candles only): a Daily engulf zone (`eg`), a Daily dominant zone (`dom`), a fresh Daily supply / demand zone
(`sd`) touched in the last 24 H1 candles; the MSNR call (`direction()`, imported), the H4 and the Daily structure side
(`h4`, `d1`); the last H4 box closed out on the side (`h4box`); price in the discount / premium half of the H4 range
(`half`); a failed opposite Daily engulf (`ef`) touched; New York hours 12-17 UTC (`ny`). Entry at the next 5-minute
open, stop past the trigger's H1 swing + 0.1 H1 ATR(14), exits 1R, 2R and a 1R trail from +1R, all out after 2 days. Every
trade has its stop on the losing side.

Cut test: each market cut at five moments (2011-2019); the triggers and their ten signals before every cut are the same as
in the full run (0 missing, 0 extra in all 25 cuts).

## The primary test: is R a rising function of the count? (before costs)

| Exit | slope 2010-14 (R a signal) | cluster t | slope 2015-19 | cluster t | Spearman of R by count, 2010-14 / 2015-19 | placebo t 2010-14 / 2015-19 | after costs t 2010-14 / 2015-19 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1R | +0.0007 | 0.1 | −0.0035 | -0.45 | 0.43 / 0.08 | -0.17 / 0.52 | 0.08 / -0.47 |
| 2R | +0.0039 | 0.36 | −0.0049 | -0.46 | 0.73 / 0.17 | -0.44 / 1.23 | 0.34 / -0.47 |
| trail | +0.0058 | 0.59 | +0.0020 | 0.21 | 0.73 / 0.05 | -0.4 / 0.49 | 0.58 / 0.2 |

The slope is within noise of zero for every exit, in both halves, real and placebo. The Spearman ranks of R by count (counts
with 30+ trades) look high in 2010-14 (0.73 at 2R) and vanish in 2015-19 (0.17): the 2010-14 rise did not repeat.

## R by count, 2R exit (before costs)

| Count | n 2010-14 | R 2010-14 | month t | n 2015-19 | R 2015-19 | month t |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 286 | −0.009 | −0.14 | 228 | −0.036 | −0.41 |
| 1 | 798 | +0.028 | 0.57 | 718 | +0.026 | 0.48 |
| 2 | 1,646 | −0.008 | −0.22 | 1,587 | +0.038 | 1.01 |
| 3 | 2,828 | +0.042 | 1.66 | 2,794 | +0.019 | 0.68 |
| 4 | 3,689 | −0.001 | −0.05 | 3,499 | −0.021 | −0.94 |
| 5 | 2,677 | +0.040 | 1.50 | 2,700 | −0.017 | −0.64 |
| 6 | 1,379 | +0.028 | 0.67 | 1,322 | −0.018 | −0.53 |
| 7 | 415 | +0.055 | 0.85 | 494 | +0.082 | 1.56 |
| 8 | 119 | +0.095 | 0.80 | 119 | −0.011 | −0.10 |
| 9 | 13 | −0.750 | −2.56 | 13 | +0.005 | 0.02 |
| 10 | 2 | −1.000 | −1.43 | 2 | +0.320 | 0.57 |

Counts 9-10 are too rare to read. No count is positive with month t >= 2 in both halves at any exit.

## The bucket tests, score >= k (before costs; Holm over the 21 tests)

| Test | n 2010-14 | R | month t | n 2015-19 | R | month t | Holm p | placebo t 2010-14 / 2015-19 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| score>=3 1R | 11,122 | +0.007 | 0.64 | 10,943 | −0.008 | −0.73 | 1 | −0.65 / 0.64 |
| score>=4 1R | 8,294 | +0.004 | 0.30 | 8,149 | −0.011 | −0.82 | 1 | −0.41 / 0.77 |
| score>=5 1R | 4,605 | +0.020 | 1.13 | 4,650 | −0.003 | −0.16 | 1 | −1.04 / 0.07 |
| score>=6 1R | 1,928 | +0.017 | 0.65 | 1,950 | +0.001 | 0.03 | 1 | −0.59 / −0.15 |
| score>=7 1R | 549 | +0.050 | 1.09 | 628 | +0.024 | 0.65 | 1 | −1.08 / −0.67 |
| score>=8 1R | 134 | −0.012 | −0.13 | 134 | −0.015 | −0.19 | 1 | 0.13 / 0.19 |
| score>=3 2R | 11,122 | +0.025 | 1.69 | 10,943 | −0.005 | −0.32 | 1 | 0.82 / 3.04 |
| score>=4 2R | 8,294 | +0.019 | 1.04 | 8,149 | −0.013 | −0.73 | 1 | 0.74 / 3.29 |
| score>=5 2R | 4,605 | +0.036 | 1.36 | 4,650 | −0.006 | −0.29 | 1 | 0.18 / 1.87 |
| score>=6 2R | 1,928 | +0.031 | 0.83 | 1,950 | +0.009 | 0.28 | 1 | 0.07 / 0.79 |
| score>=7 2R | 549 | +0.041 | 0.65 | 628 | +0.064 | 1.32 | 1 | −0.69 / −0.27 |
| score>=8 2R | 134 | −0.004 | −0.03 | 134 | −0.005 | −0.04 | 1 | −0.52 / 0.11 |
| score>=3 trail | 11,122 | +0.042 | 3.01 | 10,943 | +0.005 | 0.35 | 1 | 1.17 / 3.03 |
| score>=4 trail | 8,294 | +0.035 | 2.05 | 8,149 | +0.005 | 0.29 | 1 | 1.31 / 2.90 |
| score>=5 trail | 4,605 | +0.052 | 2.23 | 4,650 | +0.017 | 0.78 | 1 | 0.75 / 1.65 |
| score>=6 trail | 1,928 | +0.046 | 1.33 | 1,950 | +0.020 | 0.61 | 1 | 0.63 / 0.09 |
| score>=7 trail | 549 | +0.081 | 1.32 | 628 | +0.059 | 1.29 | 1 | −0.37 / −0.45 |
| score>=8 trail | 134 | +0.026 | 0.23 | 134 | −0.027 | −0.26 | 1 | 0.01 / 0.07 |

No bucket passes: the trail buckets score >= 3 / 4 / 5 have month t >= 2 in 2010-14 only, and fall to t 0.3-0.8 in 2015-19.
The placebo (the side flipped) reaches t 3.0-3.3 in 2015-19 at k 3-4, so windows like these give t of 3 by chance.
Raw passes (both halves t >= 2): 0 real, 0 placebo; about 0.011 expected by chance.

After costs every bucket at 2R is negative in 2015-19 (k 3: −0.026R, t −1.71; k 5: −0.027R, t −1.23) except k 7 (+0.041R,
t 0.86, n 628).

## Each signal on its own (2R exit, before costs; reported, not judged)

| Signal | share of trades | with − without 2010-14 (R) | Welch t | with − without 2015-19 | Welch t |
|---|---:|---:|---:|---:|---:|
| eg | 50.1 % | +0.064 | 3.44 | −0.016 | −0.88 |
| dom | 43.9 % | +0.043 | 2.28 | −0.005 | −0.24 |
| sd | 1.9 % | −0.127 | −1.97 | −0.130 | −2.09 |
| msnr | 52.7 % | −0.007 | −0.39 | −0.017 | −0.91 |
| h4 | 55.3 % | −0.008 | −0.44 | +0.052 | 2.77 |
| d1 | 50.2 % | −0.031 | −1.68 | −0.056 | −2.97 |
| h4box | 52.6 % | −0.022 | −1.21 | −0.009 | −0.46 |
| half | 23.5 % | −0.016 | −0.68 | −0.071 | −3.04 |
| ef | 27.2 % | +0.011 | 0.54 | −0.016 | −0.74 |
| ny | 27.6 % | +0.019 | 0.94 | +0.092 | 4.54 |

Welch t here counts overlapping trades as independent, so it overstates. Not one of the ten signals adds R with t >= 2 in
BOTH halves at any exit. Four flip between the halves (`eg`, `dom` help in 2010-14 only; `h4`, `ny` in 2015-19 only).
Two are against in both halves: a fresh Daily supply / demand zone (`sd`, 1.9 % of trades, about −0.13R) and the Daily
structure side (`d1`, −0.03R / −0.06R): trading WITH the Daily structure was not better. The MSNR call adds nothing
(−0.007R, −0.017R).

## What it means

Stacking these ten readings does not pick better H1 trades on 2010-2019: more agreeing signals did not give more R, before or
after costs, and the placebo does as well. The same finding as `ltf-structure`, `direction-chain-gate` and
`regime-switch-book`: agreement with the context, however many pieces of it, is not where R comes from on these markets. By
trigger type and by market the slope stays within |t| 1.4 everywhere (result.json `byTrig`, `byMarket`). Nothing live
changed; do not re-test weighted or picked subsets of these signals on these years.

Repeat: `EDGE_DATA=<cache> node --max-old-space-size=6000 research/edge/grid6-confluence/run.mjs market <m> <dir>` for the
five markets (a few seconds each), `… cut <m> <dir>`, then `… report <dir>` (writes result.json).
