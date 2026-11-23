# Combination grid 4: the dominant zone or the entry? 891 no-trigger rules on 2010-2019

**Verdict: PASS. Before costs 57 of 5,346 cells confirmed on 2010-2019, 42 of them dominant zones (H1 zone limit, pooled: +0.050R a trade in 2015-19, n 75,711, month t 8.54); after costs 0 confirmed (-0.064R).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed. A pass here is a before-cost tilt on years no grid had read, never an edge: it does not pay its costs.

## What was run

Grid 3's engine (`research/edge/combo-grid-3/run.mjs`, imported, not edited): the no-trigger entry `zedge` (a limit at the
zone's near edge) with the `zatr` stop (the far side plus half the cost and a quarter of the key timeframe's ATR(14)), filter
`none`, for every zone kind (9) x chain (11) x exit (9) = 891 rules, on xau, eurusd, gbpusd, usdjpy, audusd and pooled
(5,346 cells). OANDA mid 5-minute candles 2010-2019 (warm-up from March 2009), data-quality exclusions applied, costs of
combo-grid-2. 7,563,919 trades (one row per signal, nine exits each). Discovery 2010-2014, confirmation 2015-2019, month-sum t,
Holm over the discovery winners. Every trade has its stop on the losing side.

## Result

| | Before costs (the owner's judgement) | After costs |
|---|---:|---:|
| Cells with n >= 100 in 2010-14 | 5,026 | 5,026 |
| Discovery winners (mean > 0, month t >= 2) | 656 | 29 |
| Of those, confirmed in 2015-19 without Holm | 234 | 6 |
| Expected by chance | about 15 | about 0.7 |
| Confirmed after Holm | **57** | **0** |

The chance figure assumes independent cells; they are not (one signal feeds nine exits, chains share zones), so the excess is
smaller than 234 against 15 suggests. Holm controls the family-wise error whatever the dependence.

### Which zone kinds carry the passes (before costs)

| Zone kind | Cells (n >= 100) | Discovery | Raw confirmed | Holm confirmed |
|---|---:|---:|---:|---:|
| dom (dominant) | 582 | 217 | 135 | **42** |
| ef (failed engulf) | 579 | 106 | 33 | 7 |
| av (A / V level) | 582 | 42 | 27 | 6 |
| eg (engulf, 3 candles) | 579 | 124 | 19 | 2 |
| egn (engulf, next candle) | 574 | 83 | 12 | 0 |
| egb (body engulf) | 535 | 38 | 7 | 0 |
| bar (BO origin) | 567 | 32 | 1 | 0 |
| box | 548 | 14 | 0 | 0 |
| qm | 480 | 0 | 0 | 0 |

By chain, the Holm passes sit on the short chains ending on 5 or 15 minutes: 1h>5m 22, 30m>5m 15, 15m>5m 6, 4h>15m 5,
1h>15m 4, 30m>15m 3, 1d>1h 1, 1h>30m 1. By scope: pooled 30, usdjpy 13, gbpusd 6, eurusd 4, audusd 3, gold 1.

**Reading (fixed in advance): the tilt is about the dominant zone, not the entry.** The same limit and stop on the other zone
kinds confirm rarely (15 cells of 4,444) and the structure zones (qm, box, bar) not at all; dominant zones confirm 42 of 582.

### The H1 dominant-zone cell (1h>5m, dom, zedge / zatr)

Pooled, R a trade (n, month t):

| Exit | Before 2010-14 | Before 2015-19 | After 2010-14 | After 2015-19 |
|---|---|---|---|---|
| 1R | +0.046 (75,351, 11.56) | +0.045 (75,711, 8.63) | -0.053 | -0.069 |
| 2R | +0.053 (8.33) | +0.045 (6.47) | -0.046 | -0.069 |
| 4R | +0.065 (6.87) | +0.041 (3.86) | -0.034 | -0.074 |
| trail | +0.060 (12.15) | +0.050 (8.54) | -0.040 | -0.064 |
| eftrail | +0.057 (9.63) | +0.048 (7.61) | -0.043 | -0.066 |

Trailing exit by market, before costs 2015-19 (after costs beside): usdjpy +0.064 (t 5.69; -0.044), eurusd +0.049 (4.22;
-0.039), gbpusd +0.043 (3.40; -0.041), audusd +0.057 (4.25; -0.039), gold +0.037 (2.99; -0.167). Before costs it holds in every
market and both halves (gold 2010-14 only +0.023, t 1.51); after costs it loses everywhere in 2015-19.

After costs the six raw confirmations are all on the 1d>1h chain (egn, eg, dom), none survives Holm.

## What it means

The 2020-26 family repeats on 2010-2019: a limit at the edge of an H1 (or 30m / 15m) dominant zone touched on M5 is ahead
of zero by about 0.04-0.06R a trade before costs, in all five markets and both halves. It is the zone, not the generic entry.
But the cost of a round trip is about 0.10R of these stops, so after costs every such cell loses. A hypothesis about where
price pauses, not a trading rule; nothing is proposed.

## Checks

- Cut test (eurusd): trades built on candles cut at 2015-01-01 equal, row for row as a multiset, the full run's trades whose
  fill plus the longest time limit and order life ends before the cut: 774,739 of 774,739 (`result.json` `cuts`). A first
  version of the check keyed rows by chain, zone, fill time and first exit, which collides for distinct signals filling on
  the same candle, and reported 40,251 false differences; the whole-row comparison replaced it before the result was read.
- Offline test: `tests/combo-grid-4.test.mjs`.

To repeat: `EDGE_DATA=<cache> node research/edge/combo-grid-4/run.mjs market <m> <dir>` for the five markets (about 16
minutes each, side by side), `cut eurusd <dir>`, then `report <dir>`.
