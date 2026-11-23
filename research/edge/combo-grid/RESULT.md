# Combination grid: engulf, Mosha and direction pieces on 2020 to now

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed.

**Verdict: FAIL. 0 combinations confirmed.**

## What was run

Every combination of 5 chains x 8 key-zone kinds x 2 visit rules x 5 direction filters x 6 triggers x their entries and
stops x 7 exits: 131,600 rules, each on the five markets pooled and on each market alone, so 463,064 rule-and-market cells
with at least 100 trades in 2020-23. About 3.1 million signals and 38 million simulated trades on OANDA mid 5-minute
candles of xau, eurusd, gbpusd, usdjpy and audusd, 1 Jan 2020 to 22 Nov 2026, after the demo account's costs.

## Result

| | Count |
|---|---:|
| Cells tested (n >= 100 in 2020-23) | 463,064 |
| Positive in 2020-23 with month t >= 2 | 2,276 (0.5 %) |
| Of those, also positive with month t >= 2 in 2024-now | 24 |
| Expected by chance among 2,276 (one-sided rate of t >= 2 with no edge) | about 52 |
| Confirmed after Holm and at twice the cost | **0** |
| Placebo (the same signals, side flipped; rules with a trigger only): 2020-23 / 2024-now / confirmed | 2,480 / 38 / 0 |

The real rules did WORSE than chance: fewer passed discovery (0.5 % against about 2.3 % with no edge) and fewer held out of
sample (24 against about 52). The average rule lost money after costs, whatever the piece:

| Piece | Average R a trade, 2020-23 / 2024-now |
|---|---|
| Entry at the trigger's close / 50 % / near edge | -0.051 / -0.054, -0.088 / -0.089, -0.061 / -0.064 |
| Trigger engulf / EF / break / VR -> CF / QM / none | about -0.04 to -0.09 in both windows |
| Chain D1>H4 / H4>H1 / H4>M15 / H1>M15 / H1>M5 | -0.007 / -0.035 ... -0.104 / -0.095 (worse the lower the chain) |
| Exit 1R ... 6R, opposite zone, trail | -0.06 to -0.08 (the trail least bad, -0.056 / -0.059) |

The 24 cells that held in both windows are mostly one family on one market: USD/JPY, an H4 dominant zone (DOM) with an M15
failed engulf (EF) as the trigger, in several entry / stop / exit variants (best: market entry, stop past the zone, 2R:
+0.106R a trade in 2020-23, n 688, t 2.34; +0.190R in 2024-now, n 500, t 3.01; Holm p 1). Variants of one rule are not
independent tries, and USD/JPY rose for most of these years, which a buy-heavy rule collects. By the pre-registration it is
a hypothesis for its own test on data this grid did not read (USD/JPY 2005-2019), never an edge.

## Notes

- The placebo of a rule with no trigger was left out after the run: its order is placed at the start of the candle that is
  chosen because it touches the zone, so the flipped side knows where that candle goes (it "won" 0.47R a trade). The real
  rule is not affected (a resting limit only fills when the price comes).
- Month sums use the month of the fill. Each signal is its own trade; overlapping trades make the trade count larger than
  the independent evidence, which the month-sum t partly allows for.
- No look-ahead: the signals before a cut are identical when every later candle is removed (32,447 signals on EUR/USD, and
  the seeded test in `tests/combo-grid.test.mjs`).

To repeat: `node research/edge/combo-grid/run.mjs market <m> <dir>` for the five markets (about 8 minutes each), then
`node research/edge/combo-grid/run.mjs report <dir>`.
