# Grid 6: the QM reversal at a higher-timeframe key level (result)

**Verdict: FAIL. 0 of 20,160 cells confirmed before costs after Holm (placebo 1); the best raw cell, pooled Daily engulf zone, M5 QM against the Daily trend, London, market entry, 3R: +0.173R a trade in 2015-19, n 919, month t 2.86 (Holm p 1).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first, commit 73a6b09). Research only:
nothing live changed. No cell passed; nothing here is an edge.

## What was run

OANDA mid 5-minute candles 2009-2019 (2009 warm-up; fills 2010-2019) for xau, eurusd, gbpusd, usdjpy, audusd, the data-quality
exclusions applied (10 fills dropped), costs of combo-grid-2. A QM (edgekit `qms`, 3-candle swings) on H1, M15 or M5 counts when
one of its last 12 candles touched a key level of its side: a Daily or H4 V / A turn, engulf zone (3-candle span), failed engulf
(EF) or DOM zone, or the previous trading day's / week's high or low. Factors: the key level (10), the QM timeframe (3), the key
timeframe's structure with / against / any, whether the head swept a prior swing beyond the shoulder (yes / no / any), session
(London 07-12, New York 12-17, other UTC, any), entry (market at the next 5-minute open, or a limit at the left shoulder filled
only when price trades through it by half the round trip), exit (1R, 2R, 3R, the measured move from the head through the break
candle, a 1R trail); stop past the head by half the round trip. 52,373 QM signals, 72,780 trades and 72,712 side-flipped placebo
trades (one per QM and entry; the cells only split them). Every trade has its stop on the losing side.

Cut test: each market cut at five moments (2011-2019); the signals before every cut are the same as in the full run (0 missing,
0 extra in all 25 cuts). The structure side was never 0 after warm-up, so `any` trend = `with` + `against`.

## The bar (before costs, the pre-registered judgement; after costs beside)

| | Real, before costs | Placebo, before costs | Real, after costs | Placebo, after costs |
|---|---:|---:|---:|---:|
| Cells with n >= 100 in 2010-14 | 20,160 | 20,245 | 20,160 | 20,245 |
| Discovery winners (mean > 0, month t >= 2) | 618 | 690 | 174 | 194 |
| Expected by chance (2.3 % of cells) | 459.6 | 461.6 | 459.6 | 461.6 |
| Raw confirmations in 2015-19 (n >= 100, mean > 0, t >= 2) | 22 | 90 | 5 | 0 |
| Expected by chance (2.3 % of winners) | 14.1 | 15.7 | 4.0 | 4.4 |
| Confirmed after Holm | 0 | 1 | 0 | 0 |

The real QM cells are at about chance level (618 discovery winners against about 460 expected, 22 raw confirmations against
about 14). The side-flipped placebo does better than the real trades on every count: trading THROUGH the reversal, the way the
move was going before it, confirms more cells (90 raw, 1 after Holm: H4 engulf zone, M5, outside London and New York hours,
market entry, trail, +0.077R a trade in 2015-19 before costs, n 4,767, t 4.27, and -0.021R after costs).

## What the factors say (pooled, 2R exit, before costs; a trade is counted once in each key-level cell it touched)

- **QM timeframe**: H1 +0.040R a trade in both halves (n about 13,400 and 13,800 cell-trades; -0.004R after costs in
  2015-19); M15 -0.020R / -0.018R; M5 -0.020R / -0.021R.
- **Entry**: market +0.008R / +0.004R; the limit at the left shoulder -0.064R / -0.057R (-0.229R after costs).
- **Trend**: against the key timeframe's structure +0.002R / +0.004R; with it -0.029R / -0.031R. A reversal against the
  higher timeframe was not worse than one with it.
- **Sweep**: yes -0.008R / 0.000R; no -0.016R / -0.022R.
- **Key level**: every kind within 0.05R of zero in both halves; the previous day's high / low the best at +0.022R / +0.022R.
- **Session**: no level positive in both halves.

## Reading

The QM at a key level, as written here, does not pick a side on 2010-2019 before costs: the grid is at chance and the placebo
(the other side) does better. After costs every factor level loses. The best real cells (Daily engulf zone, M5, against the
Daily trend, London, 3R: +0.173R, t 2.86) are raw winners of the size chance gives among 618 discovery winners and fail Holm.
Not tested: a QM read by eye, other swing sizes, entries inside the head-to-shoulder zone other than the shoulder itself.
