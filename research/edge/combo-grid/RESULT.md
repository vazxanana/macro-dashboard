# Combination grid: engulf, Mosha and direction pieces on 2020 to now

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first), and run again the same day with the
limit-fill fix (section "Rerun with the limit-fill fix" below; the figures here are the rerun's). Research only: nothing
live changed.

**Verdict: FAIL. 0 combinations confirmed, before or after costs.**

## What was run

Every combination of 5 chains x 8 key-zone kinds x 2 visit rules x 5 direction filters x 6 triggers x their entries and
stops x 7 exits: 131,600 rules, each on the five markets pooled and on each market alone, so 466,242 rule-and-market cells
with at least 100 trades in 2020-23. About 3.1 million signals and 38 million simulated trades on OANDA mid 5-minute
candles of xau, eurusd, gbpusd, usdjpy and audusd, 1 Jan 2020 to 22 Nov 2026, after the demo account's costs.

## Result

| | Before costs | After costs |
|---|---:|---:|
| Cells tested (n >= 100 in 2020-23) | 466,242 | 466,242 |
| Positive in 2020-23 with month t >= 2 | 10,555 (2.3 %) | 1,957 (0.4 %) |
| Of those, also positive with month t >= 2 in 2024-now | 227 | 21 |
| Expected by chance among those (one-sided rate of t >= 2 with no edge) | about 241 | about 45 |
| Confirmed after Holm (after costs: and at twice the cost) | **0** | **0** |
| Placebo (the same signals, side flipped; rules with a trigger only; after costs): 2020-23 / 2024-now / confirmed | | 1,509 / 36 / 0 |

Before costs the grid looks exactly like no edge at all: 2.3 % passed discovery (the chance rate of a one-sided t >= 2) and
227 held out of sample against about 241 by chance. After costs the real rules did WORSE than chance (0.4 % passed discovery;
21 held against about 45). The average rule (the plain average over the cells, each cell's R a trade) lost money whatever the
piece:

| Piece | Average R a trade, 2020-23 / 2024-now, after costs | Before costs |
|---|---|---|
| Entry at the trigger's close / 50 % / near edge | -0.051 / -0.054, -0.139 / -0.137, -0.080 / -0.082 | -0.004 / -0.010, -0.022 / -0.023, -0.009 / -0.014 |
| No trigger: limit at the zone's near edge / its 50 % | -0.056 / -0.081, -0.142 / -0.162 | +0.008 / -0.019, -0.019 / -0.043 |
| Trigger engulf / EF / break / VR -> CF / QM / none | about -0.06 to -0.15 in both windows | about +0.01 to -0.04 |
| Chain D1>H4 / H4>H1 / H4>M15 / H1>M15 / H1>M5 | -0.013 / -0.043 ... -0.143 / -0.131 (worse the lower the chain) | +0.011 / -0.020 ... -0.023 / -0.015 |
| Exit 1R ... 6R, opposite zone, trail | -0.08 to -0.10 (the trail least bad, -0.080 / -0.083) | about -0.01 to -0.03 (trail -0.002 / -0.008) |
| Every cell | -0.089 / -0.091 | -0.011 / -0.016 |

The 21 cells (after costs) that held in both windows are mostly one family on one market: USD/JPY, an H4 dominant zone (DOM) with an M15
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

## Rerun with the limit-fill fix (23 Nov 2026)

The engine had a bug (fixed in commit 1b76561): a limit order whose price a 5-minute candle reached, on a candle that also
CLOSED past the stop, was cancelled instead of filled and stopped on that candle. That dropped losing limit trades, so it
flattered every limit entry (the 50 % and near-edge entries, and the rules with no trigger). Market entries are unaffected.

The grid was run again with the fixed engine on candles fetched again (OANDA mid 5-minute, through the site's candle proxy,
cut at 23 Nov 2026 00:00 UTC). As a check, the OLD engine on the same candles gives the published figures exactly (463,064 /
2,276 / 24 / 0, placebo 2,480 / 38 / 0), so every change below is the fix and nothing else. The rerun also keeps before-cost
month sums (owner, 23 Nov 2026: judge before costs too; `run.mjs gross <dir>`).

| | Published (bug) | Rerun, after costs | Rerun, before costs |
|---|---:|---:|---:|
| Cells tested | 463,064 | 466,242 | 466,242 |
| Passed 2020-23 | 2,276 | 1,957 | 10,555 |
| Also held 2024-now | 24 | 21 | 227 |
| Expected by chance | about 52 | about 45 | about 241 |
| Confirmed | 0 | 0 | 0 |
| Placebo 2020-23 / 2024-now / confirmed | 2,480 / 38 / 0 | 1,509 / 36 / 0 | (placebo kept after costs only) |

More cells reach 100 trades now (the limits that were cancelled now fill). Average R a trade after costs by entry type,
2020-23 / 2024-now, published -> rerun:

| Entry | Published (bug) | Rerun |
|---|---|---|
| At the trigger's close (market) | -0.051 / -0.054 | -0.051 / -0.054 (unchanged) |
| Limit at the trigger zone's 50 % | -0.088 / -0.089 | -0.139 / -0.137 |
| Limit at the trigger zone's near edge | -0.061 / -0.064 | -0.080 / -0.082 |
| No trigger, limit at the zone's near edge | -0.027 / -0.049 | -0.056 / -0.081 |
| No trigger, limit at the zone's 50 % | -0.064 / -0.079 | -0.142 / -0.162 |
| Every cell | -0.065 / -0.068 | -0.089 / -0.091 |

The verdict does not change: FAIL, 0 confirmed, before or after costs. The USD/JPY DOM + M15 EF family still leads the cells
that held after costs (its best cell is a market entry, unchanged). Before costs the leaders are USD/JPY H1 A / V level zones
with an M15 engulf (best: near-edge limit, stop past the trigger, 2R: +0.069R a trade in 2020-23, n 4,639, t 2.41; +0.097R in
2024-now, n 3,477, t 4.02; Holm p 1): one family of variants on the market that rose for most of these years, like the
after-cost leader, and 227 such cells is what chance alone gives. The USD/JPY follow-up (`research/edge/usdjpy-dom-ef`) used
this engine for its market-entry rule only (no limit order), so the fix does not touch it and its result stands.
