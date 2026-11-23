# Grid 6: boxes inside boxes down the timeframe ladder (result)

**Verdict: FAIL. 0 of 52,385 cells confirmed before costs after Holm (placebo 22); every factor level loses a little before costs; the best real cell, +0.123R a trade in 2015-19, n 1,506, month t 3.29, is one of 35 raw confirmations against about 14.5 by chance.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first, commit 407d06b). Research only:
nothing live changed. No cell here is an edge.

## What was run

OANDA mid 5-minute candles 2009-2019 (2009 warm-up; fills 2010-2019) for xau, eurusd, gbpusd, usdjpy, audusd, the data-quality
exclusions applied (197 fills dropped), costs of combo-grid-2. A box on each timeframe = from the last confirmed swing low to
the last confirmed swing high (2 candles a side), closed out by a close beyond it. Chains D1 -> H4 -> H1, H4 -> H1 -> M15,
H1 -> M15 -> M5; the trade side is always the top box's last close-out. Factors: price inside / outside the top box; the middle
box's last close-out with the side or not; the bottom trigger (close-out with the side, or a false break against it closed back
in); the bottom box under / over a third of the middle box; session (London 07-12, New York 12-17, other UTC); entry (market at
the next 5-minute open, or a limit at the bottom box's broken edge that fills only when price trades through it by half the round
trip) x stop (past the bottom box / past the middle box); exit 1R, 2R, 3R, trail 1R behind from +1R, the top box's far edge.
251,123 signals, 808,510 trades and 794,823 side-flipped placebo trades (one row per entry / stop, five exits each). Every
trade has its stop on the losing side.

Cut test: each market cut at five moments (2011-2019); the signals before every cut are the same as in the full run (0
missing, 0 extra in all 25 cuts).

## The bar (before costs, the pre-registered judgement; after costs beside)

| | Real, before costs | Placebo, before costs | Real, after costs | Placebo, after costs |
|---|---:|---:|---:|---:|
| Cells with n >= 100 in 2010-14 | 52,385 | 52,305 | 52,385 | 52,305 |
| Discovery winners (mean > 0, month t >= 2) | 638 | 2,626 | 69 | 496 |
| Expected by chance (2.3 %) | about 1,194 | about 1,193 | about 1,194 | about 1,193 |
| Confirmed in 2015-19 without Holm | 35 | 499 | 0 | 11 |
| Expected by chance (2.3 % of the winners) | about 14.5 | about 59.9 | about 1.6 | about 11.3 |
| Confirmed after Holm | **0** | **22** | **0** | **0** |

No real cell survives Holm: FAIL. The real grid has about half the discovery winners chance alone would give, because before
costs nearly every real cell loses a little. The placebo, the same trades taken AGAINST the top box's side, confirms 22 cells
before costs; all of them lose after costs.

## The best real cells (raw confirmations, none after Holm)

| Cell | 2010-14 | 2015-19 | 2015-19 after costs | Holm p |
|---|---|---|---|---:|
| eurusd, H1 -> M15 -> M5, false break, London, market, bottom stop, trail | +0.118R (n 1,545, t 2.69) | +0.123R (n 1,506, t 3.29) | +0.011R (t 0.29) | 0.541 |
| pooled, H1 -> M15 -> M5, outside the top box, false break, London, market, bottom stop, 3R | +0.070R (n 4,782, t 2.57) | +0.081R (n 4,548, t 2.97) | -0.080R (t -2.78) | 1 |

Both are false breaks on M5 in London hours, and both are gone after costs.

## What the placebo shows

The placebo's confirmed cells are fades of an M5 box close-out on the H1 -> M15 -> M5 chain: market entry against the break,
the same stop distance, 1R target. Pooled, every session: +0.034R a trade in 2010-14 (n 55,776, t 5.72) and +0.031R in 2015-19
(n 54,640, t 5.90), but -0.053R after costs (t -8.98). This is the small bounce after a 5-minute close beyond a tight box; the
spread takes it and more. Not a rule to trade.

## Every trade at a 2R exit, by factor level (pooled, before costs; 2015-19 after costs in brackets)

| Factor | Level: 2010-14 / 2015-19 R a trade |
|---|---|
| Chain | D1-H4-H1 -0.025 / -0.054 [-0.088]; H4-H1-M15 -0.036 / -0.035 [-0.099]; H1-M15-M5 -0.039 / -0.047 [-0.150] |
| Top box | inside -0.030 / -0.060 [-0.174]; outside -0.039 / -0.040 [-0.122] |
| Middle close-out with the side | yes -0.041 / -0.046 [-0.120]; no -0.030 / -0.042 [-0.160] |
| Trigger | out -0.041 / -0.050 [-0.118]; false break -0.031 / -0.034 [-0.166] |
| Bottom size | small -0.052 / -0.047 [-0.143]; big -0.031 / -0.043 [-0.130] |
| Session | London -0.015 / -0.023 [-0.107]; New York -0.027 / -0.029 [-0.101]; other -0.051 / -0.061 [-0.161] |
| Entry / stop | market / bottom -0.022 / -0.029; market / middle -0.014 / -0.022; limit / bottom -0.075 / -0.082; limit / middle -0.041 / -0.048 |

Every level loses before costs in both halves. A middle box that has also closed out with the side does not help (-0.046R
against -0.042R in 2015-19). The trade-through limits lose more than market entries, as in the earlier grids.

## What this does not say

It tests these mechanical boxes (swing low to swing high, 2 a side) and these chains, not a person's choice of boxes. Nothing
changes on any desk from this study. Files: `run.mjs`, `result.json`; test `tests/grid6-box-in-box.test.mjs`.
