# Pre-registration: vb-structure-filter (23 Nov 2026)

Written and committed alone, before any trade of this study is split by the H4 structure side. No code, no data read for it yet.
Paper research only: nothing live changes, the two forward records keep running unchanged; at most a proposal for the owner.

## Question
Do the two passing breakout rules (gold T1 of `gold-vol-breakout`, USD/JPY T1 of `fx-vol-breakout` / `usdjpy-vol-breakout-early`)
get better when a day's breakout is taken only on the side of the H4 market structure? The owner's main idea is that trades
following the chain of timeframes make money. This asks whether direction adds anything to rules that already work, without
changing their entry, stop, exit or size.

## What was read before, said plainly
- Both base rules have been read on every window used here (gold 2007-26, USD/JPY 2005-26). Their trades are known; the structure
  split of them is not. So this tests the FILTER, not the breakouts.
- `gold-vol-breakout-h4-side` (14 Nov 2026) already FAILED a related gold filter: H4 side = the last close beyond the 20-close
  channel on New York-aligned H4 candles (kept +0.087R vs base +0.072R a trade, the later half no better, placebo failed). This
  study uses a different, fixed definition (swing structure, below) and adds USD/JPY, which no filter test has touched. A pass on
  gold alone would not overturn that FAIL; it would be a hypothesis for a forward record.
- `usdjpy-vb-side-control-v2` showed USD/JPY T1's buys carry most of its result: the side split is reported so a filter that
  only picks "buys in an uptrend" is not mistaken for direction skill.

## Base rules (unchanged, imported, never edited)
- **Gold**: `research/edge/gold-vol-breakout/run.mjs` `vbTrade` (k 0.5, both sides): O = open of the first M5 candle 00:00-00:55
  UTC; buy stop O + 0.5 x the previous folded UTC day's range, sell stop O - 0.5 x it, live to 20:55 UTC, first fill wins; stop at
  O; out at the 20:55 candle close.
- **USD/JPY**: the same T1 through `research/edge/fx-vol-breakout/run.mjs` (`trades` / `vbTrade`, out at 21:00 UTC).
- Data: the shared toolkit's OANDA mid M5 cache (`research/edge/_lib/edgekit.mjs` `load`, from 2010).
- **Harness gate** (no verdict without it): on the toolkit's candles the unfiltered rules must reproduce, per window that overlaps a
  published result (`gold-vol-breakout/result.json`, `fx-vol-breakout/result.json` USD/JPY series,
  `usdjpy-vol-breakout-early/result.json`), its trade count within 2 % and its net R a trade within 0.01R. A miss is reported and
  the study is INCONCLUSIVE.

## The filter (one, fixed)
- H4 candles: the toolkit's `resample(m5, 14400)` (UTC-aligned 4-hour blocks); a block with fewer than 12 M5 candles is dropped.
- H4 side: the toolkit's `structure(h4, 3)` (swing highs / lows confirmed 3 candles a side; a close above the last confirmed swing
  high makes the side up, a close below the last confirmed swing low makes it down), computed over the whole continuous history.
- The day's side = `side` of the last H4 candle that CLOSED at or before that day's 00:00 UTC (the candle holding 00:00 is never
  read). Known before both stop orders are placed.
- Filtered rule: both stop orders are placed as before; the day's trade is kept only if its first fill is on the H4 side (buy on
  up, sell on down). If the first fill is against the side the day has no trade (the other order is cancelled). Side 0 (no break
  yet) = no trade. So the filtered trades are exactly the base trades whose side agrees. Nothing else changes.

## Costs
Each rule's own cost, the larger of its study's cost and the toolkit's `COSTS`: gold $0.60 a round trip per ounce (study) vs toolkit
$0.30; USD/JPY 0.000045 x entry + 0.005 (study) vs toolkit 0.008. Financing as in the studies (no trade crosses the rollover). Every
figure is also reported at 2x that cost.

## Windows
In sample 2020-01-01..2023-12-31; out of sample 2024-01-01..the last complete day in the cache; replication 2010-01-01..2019-12-31
(the filter definition is fixed today, after 2020-26 lessons were read on other rules).

## Tests (three, Holm over three)
- **T1 (primary)**: gold and USD/JPY pooled (each trade 1R), filtered rule.
- **T2**: gold alone. **T3**: USD/JPY alone.

## Statistics
Mean net R a trade; t on calendar-month sums of net R (one-sided p, normal approximation, as the base studies); Holm over T1-T3 on the
out-of-sample p. "Direction adds" is measured paired, on the same days: kept trades minus against-side trades (the base trades the
filter drops), net R a trade, Welch t; and the filtered rule's net R a trade minus the unfiltered rule's in each window.
Placebo: 40 seeds, each a random subset of the same window's base trades of the kept set's size; the kept mean is ranked against them.

## Pass bar (per test)
All of: OOS mean > 0; OOS month t >= 2 with Holm p < 0.05; IS mean > 0; OOS mean > 0 at 2x costs; at least 30 OOS trades; replication
mean > 0; AND direction adds: kept minus against-side > 0 in IS, OOS and replication, with Welch t >= 2 on 2010..now pooled, and the
kept mean above at least 38 of 40 placebos.

## Verdicts
- **PASS** (T1): every item holds. Then a candidate for a forward paper record beside the two running ones, own pre-registration.
- **FAIL, direction adds nothing**: the filtered rule may still pass the profit items (it is a subset of passing rules), but the
  direction items do not hold. The expected honest outcome if the breakouts carry no structure effect; said in those words.
- **FAIL**: the filtered rule fails a profit item out of sample.
- **INCONCLUSIVE**: the harness gate misses, the cache lacks a window, or fewer than 30 OOS kept trades.
T2 or T3 passing alone is a hypothesis, never an edge. Reported: n, gross / net / 2x-cost R a trade, month t, by year and window,
drawdown, days dropped as against-side and as side 0, buys vs sells kept and dropped, placebo distribution.

## Deliverables
`research/edge/vb-structure-filter/{PREREGISTRATION.md, run.mjs, RESULT.md, result.json}` and its test. Nothing else is touched.
