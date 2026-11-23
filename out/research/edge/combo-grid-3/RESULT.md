# Combination grid 3: the documents' and charts' pieces on gold, EUR/USD and GBP/USD, 2020 to now

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, with the before-cost amendment written before the run). Research
only: nothing live changed.

**Verdict: FAIL after costs (0 of 2,426,380 cells confirmed); before costs 9 confirmed, eight of them one family, a hypothesis for untouched years.**

## What was run

11 chains (M30 included) x 9 key zones x 14 filters x 6 triggers and none x their entries and stops (the fixed-30-pip stop
and the stop past the zone by a quarter ATR among them) x 9 exits (the far H4 / D1 target and the M5 EF trail among them):
about 1.2 million rules on each of xau, eurusd, gbpusd and pooled, 2,426,380 cells with 100+ trades in 2020-23. About 8.2
million signals and 90 million simulated trades on OANDA mid 5-minute candles, 1 Jan 2020 to 22 Nov 2026, with the engine's
limit-fill fix and the data-quality exclusions.

## Result

| | Before costs (the owner's judgement) | After costs |
|---|---:|---:|
| Positive in 2020-23 with month t >= 2 | 29,843 | 4,662 |
| Of those, also positive with month t >= 2 in 2024-now | 1,740 | 44 |
| Expected by chance among those | about 679 | about 106 |
| Confirmed after Holm | **9** | **0** |

After costs the rules did worse than chance, as in grids 1 and 2. Before costs there is an excess (1,740 against about 679),
and eight of the nine confirmed cells are one family (the ninth is EUR/USD A / V level zones on the 30m>5m chain with the same
entry and stop): an **H1 dominant zone** (two H1 candles of one colour, the second closing beyond
the first's extreme; zone = the first candle's body), touched on M5 (the 30m>5m chain in one cell), **a limit at the zone's
near edge, no trigger, no filter, the stop past the zone's far side by a quarter of the H1 ATR(14)**. Grid 2's one before-cost
confirmation was the same zone and entry.

The leading cell on each market, R a trade (n, month t):

| Market, exit | Before costs 2020-23 | Before costs 2024-now | After costs 2020-23 | After costs 2024-now |
|---|---|---|---|---|
| Gold, 4R | +0.080 (11,577, 2.88) | +0.142 (8,909, 6.62) | -0.050 (-1.77) | +0.073 (3.17) |
| EUR/USD, 1R | +0.052 (12,704, 5.83) | +0.041 (9,127, 3.44) | -0.036 | -0.061 |
| GBP/USD, 1R | +0.037 (12,941, 3.54) | +0.049 (9,059, 3.55) | -0.047 | -0.056 |
| Pooled, trailing stop | +0.043 (37,222, 7.45) | +0.055 (27,095, 6.13) | -0.056 | -0.038 |

A before-cost tilt of 0.04-0.06R a trade, about a third to a half of a round trip's cost on the forex pairs; on gold, where
the cost is a smaller share of the stop, the 2024-now window is positive after costs and 2020-23 is not. It was picked from
millions of cells on years three grids have read, so it is tested once on years no grid read: `research/edge/dom-zone-holdout`.

To repeat: `node research/edge/combo-grid-3/run.mjs market <m> <dir>` for xau, eurusd, gbpusd (about 55 minutes each), then
`report <dir>` and `gross <dir>`.
