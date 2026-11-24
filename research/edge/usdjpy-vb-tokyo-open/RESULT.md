# USD/JPY T1: a New York or a Tokyo day instead of the UTC day (24 Nov 2026)

**Verdict: NO DIFFERENCE SHOWN: A. New York day NO DIFFERENCE SHOWN; B. Tokyo day NO DIFFERENCE SHOWN. Paired monthly difference against the UTC rule, net R a trade, discovery / confirmation: New York day −0.047 (t −2.18) / −0.013 (t −0.83); Tokyo day −0.063 (t −1.77) / −0.014 (t −0.43); the rule stays the UTC day**

Paper research only. Days, tests and bar fixed in `PREREGISTRATION.md` (pushed alone before any variant figure; sha256 in `result.json`). The rule's functions come unchanged from `index-vol-breakout/original.mjs`, the cost from `fx-vol-breakout` `charge` (commission 0.000045 of the entry, measured, + 0.5 pip, ASSUMED), the New York day from `gold-vol-breakout-k`. Nothing is adopted: the rule stays the 00:00 UTC day with the 21:00 UTC exit. Nothing live changed.

Gate: the UTC rule on this cache gives early n 2089 / +0.079R and late n 2079 / +0.063R against the published 2089 / +0.079R and 2079 / +0.063R: inside the tolerance.

## The three days, after costs

| Day | Window | n | Win | Gross R | Net R | Net 2x cost | Month t (net) | Max DD R | Held over 17:00 NY |
|---|---|---|---|---|---|---|---|---|---|
| UTC (the rule) | discovery | 1894 | 45.5 % | +0.121 | +0.092 | +0.063 | +3.32 | −42.2 | 0 |
| UTC (the rule) | confirmation | 2275 | 43.9 % | +0.087 | +0.055 | +0.023 | +2.22 | −33.8 | 0 |
| UTC (the rule) | pooled | 4169 | 44.6 % | +0.103 | +0.072 | +0.041 | +3.89 | −42.2 | 0 |
| A. New York day (17:00 NY, 24 h) | discovery | 1921 | 44.1 % | +0.080 | +0.051 | +0.021 | +1.94 | −39.8 | 0 |
| A. New York day (17:00 NY, 24 h) | confirmation | 2309 | 43.0 % | +0.072 | +0.039 | +0.006 | +1.56 | −35.1 | 0 |
| A. New York day (17:00 NY, 24 h) | pooled | 4230 | 43.5 % | +0.076 | +0.044 | +0.013 | +2.46 | −39.8 | 0 |
| B. Tokyo day (00:00 Tokyo = 15:00 UTC, 24 h) | discovery | 1645 | 42.3 % | +0.069 | +0.039 | +0.008 | +1.24 | −38.0 | 451 |
| B. Tokyo day (00:00 Tokyo = 15:00 UTC, 24 h) | confirmation | 1915 | 40.7 % | +0.072 | +0.039 | +0.005 | +1.19 | −55.9 | 499 |
| B. Tokyo day (00:00 Tokyo = 15:00 UTC, 24 h) | pooled | 3560 | 41.5 % | +0.071 | +0.039 | +0.007 | +1.71 | −55.9 | 950 |

## The two tests: variant minus the UTC rule, paired by month

| Test | Window | Months | Mean diff, net R a trade | Paired t | Mean diff, month sums (R) | Paired t (sums) |
|---|---|---|---|---|---|---|
| A. New York day (17:00 NY, 24 h) | discovery | 120 | −0.047 | −2.18 | −0.64 | −2.03 |
| A. New York day (17:00 NY, 24 h) | confirmation | 143 | −0.013 | −0.83 | −0.25 | −0.98 |
| B. Tokyo day (00:00 Tokyo = 15:00 UTC, 24 h) | discovery | 120 | −0.063 | −1.77 | −0.93 | −1.88 |
| B. Tokyo day (00:00 Tokyo = 15:00 UTC, 24 h) | confirmation | 143 | −0.014 | −0.43 | −0.35 | −0.78 |

| Test | one-sided p (better) | Holm | one-sided p (worse) | Holm | Decision |
|---|---|---|---|---|---|
| A. New York day (17:00 NY, 24 h) | 0.797 | 1 | 0.203 | 0.406 | **NO DIFFERENCE SHOWN** |
| B. Tokyo day (00:00 Tokyo = 15:00 UTC, 24 h) | 0.666 | 1 | 0.334 | 0.406 | **NO DIFFERENCE SHOWN** |

## Control: the same rule on every other whole UTC hour as the day's start (24-hour day, pooled 2005 → now)

| Anchor (UTC) | n | Net R | Month t |
|---|---|---|---|
| 00:00 | 4639 | +0.046 | +2.17 |
| 01:00 | 4616 | +0.048 | +2.20 |
| 02:00 | 4584 | +0.039 | +1.80 |
| 03:00 | 4535 | +0.029 | +1.36 |
| 04:00 | 4520 | +0.025 | +1.14 |
| 05:00 | 4030 | +0.049 | +2.38 |
| 06:00 | 3772 | +0.051 | +2.57 |
| 07:00 | 3782 | +0.053 | +2.53 |
| 08:00 | 3735 | +0.053 | +2.51 |
| 09:00 | 3663 | +0.043 | +2.01 |
| 10:00 | 3638 | +0.060 | +2.70 |
| 11:00 | 3640 | +0.050 | +2.29 |
| 12:00 | 3619 | +0.063 | +2.84 |
| 13:00 | 3600 | +0.040 | +1.81 |
| 14:00 | 3584 | +0.027 | +1.23 |
| 15:00 | 3560 | +0.039 | +1.71 |
| 16:00 | 3506 | +0.011 | +0.52 |
| 17:00 | 3528 | +0.040 | +1.75 |
| 18:00 | 3717 | +0.000 | −0.01 |
| 19:00 | 3840 | −0.045 | −2.08 |
| 20:00 | 4317 | −0.086 | −3.27 |
| 21:00 | 4433 | −0.043 | −1.89 |
| 22:00 | 4545 | −0.065 | −2.53 |
| 23:00 | 4662 | +0.011 | +0.44 |

Among the 22 other whole-hour anchors (pooled net R a trade from -0.086 to 0.063, median 0.04), the UTC rule (+0.072R, its 21-hour day) is above 22 of 22, the New York day (+0.044R) above 14 and the Tokyo day (+0.039R) above 10. Hours 21 and 22 UTC are close to the New York day (its anchor is 21:00 or 22:00 UTC with daylight saving). The control is reported only; it decides nothing.

## Reading

Neither other open does better. Pooled after costs the UTC rule makes +0.072R a trade (n 4169, month t +3.89), the New York day +0.044R (n 4230, t +2.46) and the Tokyo day +0.039R (n 3560, t +1.71); before costs +0.103 / +0.076 / +0.071R. Both variants trail the UTC rule in both windows (per-trade monthly difference New York −0.047 / −0.013R, Tokyo −0.063 / −0.014R), but the confirmation-window paired t (−0.83 and −0.43) is far from the pre-registered bar, so the result is NO DIFFERENCE SHOWN, not WORSE; in discovery the New York day trails at t −2.18 (not a test window). Neither variant clears the parent bar on its own: New York confirmation +0.039R (t +1.56), Tokyo +0.039R (t +1.19); at 2x costs the Tokyo day is +0.007R and the New York day +0.013R against the rule's +0.041R. The Tokyo day also holds 950 of its 3560 trades over the 17:00 New York rollover, where financing (not charged here) and the break-hour spread (hidden by mid candles) would cost more, so its true figure is lower than shown. What the control adds: the effect is not special to 00:00 UTC; days started anywhere from about 00:00 to 12:00 UTC give similar pooled net R (most +0.04 to +0.06R), while days started 18:00-22:00 UTC (around the New York close) lose. The 00:00 UTC rule with its 21:00 exit is the best of the three tested here mainly because it stops before the rollover hours (the same 00:00 UTC day held 24 hours gives +0.046R). A before-cost tilt common to many anchors is not an edge, and none of these settings is chosen from this reading. Paper research; nothing live changes.

Data: OANDA mid USD/JPY M5, 2005-01-02 → 2026-11-21 (1644641 candles). To repeat: `node research/edge/usdjpy-vb-tokyo-open/run.mjs` (candle cache of `research/edge/_lib/edgekit.mjs`, out of git). Test: `tests/usdjpy-vb-tokyo-open.test.mjs`.
