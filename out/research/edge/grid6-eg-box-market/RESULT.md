# Grid 6: engulf zones on D1 / H4, the working-timeframe box, market entries only (result)

**Verdict: PASS. 1 of 7,245 cells confirmed before costs after Holm (placebo 0): Daily engulf zone, H1 box close-out, H1 structure break, New York hours, box stop, 1R: +0.174R a trade in 2015-19, n 435, month t 3.98; the placebo out-scores the real trades on every chance count, so the grid as a whole is chance.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first, commit 339a86e). Research only:
nothing live changed. A pass here is a before-cost tilt in one cell on 2010-2019, never an edge.

## What was run

OANDA mid 5-minute candles 2009-2019 (2009 warm-up; fills 2010-2019) for xau, eurusd, gbpusd, usdjpy, audusd, the data-quality
exclusions applied (140 fills dropped), costs of combo-grid-2. Zones: engulf zones (`combo-grid-3` `buildZones('eg')`, which uses
`council/eg-methods.mjs` `engulfAt` with a 3-candle span) and failed zones (`buildZones('ef')`) on the Daily trading day and on
H4. Factors: zone timeframe (D1, H4); state (fresh = first visit, any = visits 1-3, ef = a failed zone traded the other way);
box on H1 or M15 (close out with the side, or a false break back in); confirmation (none, an engulf within 3 candles, a structure
break within 3 candles); session (London 07-12, New York 12-17, other UTC); stop (past the box's other side, or past the zone's
far side + 0.1 ATR of the zone timeframe); exit 1R, 2R, 3R, trail (1R behind from +1R), the next opposite zone of the zone
timeframe. Market entry only: the open of the next 5-minute candle. 311,900 signals, 618,920 trades and 619,159 side-flipped
placebo trades (one row per stop, five exits each). Every trade has its stop on the losing side; 621 orders (real and placebo) were not
taken because the next open was already past the stop or the risk was under the round trip.

Cut test: each market cut at five moments (2011-2019); the signals before every cut are the same as in the full run (0
missing, 0 extra in all 25 cuts).

## The bar (before costs, the pre-registered judgement; after costs beside)

| | Real, before costs | Placebo, before costs | Real, after costs | Placebo, after costs |
|---|---:|---:|---:|---:|
| Cells with n >= 100 in 2010-14 | 7,245 | 7,250 | 7,245 | 7,250 |
| Discovery winners (mean > 0, month t >= 2) | 208 | 368 | 126 | 125 |
| Expected by chance (2.3 %) | about 165 | about 165 | about 165 | about 165 |
| Confirmed in 2015-19 without Holm | 17 | 25 | 6 | 4 |
| Expected by chance (2.3 % of the winners) | about 4.7 | about 8.4 | about 2.9 | about 2.9 |
| Confirmed after Holm | **1** | **0** | **0** | **0** |

By the pre-registered rule this is a PASS (1 confirmed, the placebo 0). Read with the counts beside it, it is not evidence: the
side-flipped placebo has more discovery winners (368 against 208) and more raw confirmations (25 against 17) than the real
trades. Both sides sit above the 2.3 % line because the cells overlap (the same trades under five exits, three states that nest,
pooled and per market), so neither count is independent. After costs the real grid has fewer discovery winners than chance
(126 against about 165) and nothing survives Holm.

## The confirmed cell

Daily engulf zone (any of the first three visits), H1 box (swing low to swing high, 2 a side) closes out with the zone's side,
then an H1 structure break of that side within 3 candles, signal in New York hours (12-17 UTC), market entry at the next 5-minute
open, stop past the box's other side, exit at 1R.

| | 2010-14 | 2015-19 |
|---|---|---|
| Before costs | +0.117R (n 392, month t 2.04) | +0.174R (n 435, month t 3.98), Holm p 0.020 |
| After costs | +0.101R (month t 1.77) | +0.154R (month t 3.53) |

By market (2010-14 / 2015-19, before costs): xau -0.101 / +0.220 (n 79 / 113), eurusd +0.042 / +0.257 (71 / 63), gbpusd +0.006 /
+0.120 (66 / 92), usdjpy +0.222 / +0.076 (76 / 86), audusd +0.335 / +0.211 (100 / 81).

**This is the same rule grid5-msnr-box confirmed on the same years and markets** (its Daily engulf zone, H1 box close-out, H1
structure break, New York, market entry, box stop; there with 2 visits and a 6-candle window). Finding it again here is a
re-reading of the same trades, not a second test. Its own test on data neither grid read (2005-2009 and the holdout markets of
`edgekit`) is the open step; until then it is a hypothesis, not an edge. After costs it is not a discovery winner (its 2010-14
after-cost t is 1.77), so it fails the after-cost bar.

The best after-cost raw confirmation is usdjpy on H4 engulf zones, H1 box out, structure break, New York, box stop, 3R: +0.277R
before costs in 2015-19 (n 332, month t 2.68), Holm p 0.96: one of thousands, not past the bar.

## Every trade at a 2R exit, by factor level (pooled, before costs; 2015-19 after costs in brackets)

| Factor | Level | 2010-14 | 2015-19 |
|---|---|---|---|
| State | fresh | -0.003R | -0.004R (-0.039) |
| | later visits | +0.005R | -0.002R (-0.039) |
| | ef | -0.003R | -0.006R (-0.042) |
| Zone | D1 | +0.008R | -0.005R (-0.033) |
| | H4 | -0.002R | -0.004R (-0.042) |
| Box | H1 | +0.006R | -0.001R (-0.026) |
| | M15 | -0.005R | -0.007R (-0.051) |
| Confirmation | none / eg / sb | +0.003 / -0.005 / +0.000R | +0.002 / -0.004 / -0.016R |
| Session | London / NY / other | +0.012 / -0.008 / -0.002R | +0.013 / +0.015 / -0.026R |
| Stop | box / zone | +0.000 / -0.001R | -0.004 / -0.005R |

Every level is within 0.03R of zero before costs; after costs every level loses (about -0.02R to -0.07R a trade). Fresh zones
are no better than later visits, failed zones no better than intact ones, and no confirmation lifts the average.

## Reading

Market entries at engulf zones with a box event are at zero before costs and lose after costs, at every level of every factor.
The one confirmed cell repeats the grid5-msnr-box finding on the same data; its weight rests on the coming holdout test, not on
this grid. Nothing changes on any desk.

To repeat: `export EDGE_DATA=<cache>`, fill it with `research/edge/_lib/fetch-cache.mjs` (5m 2009-2019, 1d 2008-2019, the five
markets), then `run.mjs market <m> <dir>` and `run.mjs cut <m> <dir>` for each market (about 10 s each), then `run.mjs report
<dir>`. Test: `tests/grid6-eg-box-market.test.mjs`.
