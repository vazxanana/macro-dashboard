# Pre-registration: frozen replication of the volatility-spike rebound on other index markets (14 Nov 2026)

Written and committed (alone) before any number of this study was computed. Paper research: nothing here is read by the
council, the mirror or the page, and no live rule changes whatever the reading. Not an ICT study.

## Why
`vol-spike-rebound` (#860, branch `vol-spike-rebound`, commit 8389fe6, not on `main`) passed its bar on the pre-stated
10-day hold only: buy SPX500 / NAS100 / US30 when the 5-day realised volatility is over 2x its prior 120-day median and the
close is under its 20-day average, +0.151R a trade net in 2016-26 (n 165, t 2.53, Holm p 0.011). It is weak: 2008-15 gave
+0.013R a trade, counted by entry week t is 1.68 (the three indices fire together), and it sat just over the random-entry
95th percentile (+0.141R). The cleanest test left is the SAME rule, frozen, on index markets it never saw.

## The frozen rule
- `frozen.mjs` = #860's `research/edge/vol-spike-rebound/run.mjs` copied byte for byte (sha256
  `339077aa9b4193eed610095fd75862195cf259c7ed29f78d4a26ac8f71beb8c1`, pinned in `tests/vol-spike-replicate.test.mjs`).
  This study's `run.mjs` imports its functions (`candles`, `simulate`, `net`, `summary`, `tstat`, `normP`, `holm`, `rng`,
  `randomTrades`, `pct`, `study`) and never edits them.
- Unchanged: RV5 > 2 x MED120 (values before the day) AND close < SMA20 on the signal close; fill at the next open; stop
  3 x ATR(20) below the fill, checked from the entry day, gap at the open; **hold 10 trading days only** (the hold that
  passed; the 5-day hold is not tested here), exit at the close of the 10th day; one position per market; a trade open on the
  last candle closed at its close. Weekend candles dropped. No parameter is chosen here.

## Gate (before any reading)
`study()` of `frozen.mjs`, run on #860's own markets and data (council-data `research/daily/{spx500,nas100,us30}.json`,
`macro/cache.json` DGS2), must reproduce #860's published 10-day block exactly: every field of `holds["10"]` (windows A
and B, the random-entry block, per-market rows, by year, checks) equal to #860's committed `result.json`. If the gate
fails, nothing below is read and the study is reported as "gate failed".

## New markets (chosen before running; every candidate the task named that has OANDA daily candles on file)
All seven have a `research/daily/<key>.json` in council-data with status ok (index of 6 Nov 2026), so all seven are used:

| key | OANDA instrument | spread, points a round trip (stated) |
|---|---|---|
| de40 | DE30_EUR | 2.0 |
| uk100 | UK100_GBP | 2.0 |
| eu50 | EU50_EUR | 2.0 |
| fr40 | FR40_EUR | 2.0 |
| au200 | AU200_AUD | 3.0 |
| jp225 | JP225_USD | 10.0 |
| hk33 | HK33_HKD | 15.0 |

The spreads are stated, not measured (#860's three were stated figures too): about 0.01-0.08 % of today's price, the order
of #860's. The 2x-cost run below covers the doubt.

## Financing
#860's `net()` takes one rate series and charges (rate + 2.5 %) / 365 x entry price a calendar night. Its code would accept
another series, but council-data holds no rate series for the euro, sterling, yen, Australian or Hong Kong dollar over
2005-26 (`macro/cache.json` has US DGS2 / DGS10 / DFII10 only). So **#860's method is used for every market: DGS2 + 2.5 %
a year**, the last DGS2 on or before the entry day (none before 2006-01-06: the code charges 2.5 % then). Said in RESULT.md.

## Windows and tests (all on the 10-day hold, net of spread and financing, R = net points / (3 x ATR20))
- **R1**: the seven new markets' trades pooled, entries 2016-01-01 to the last candle on file (decisive). t = mean / (sd /
  sqrt n) of net R a trade; one-sided normal p.
- **R2**: the same pool, entries 2005-01-01 to 2015-12-31.
- **R3**: R1 counted by entry week: one observation per week with at least one entry = the MEAN net R of the trades entered
  that week (#860's week key: floor((tIn - 4 days) / 7 days)); t and one-sided p over those weekly means.
- Holm over R1 and R3 (two tests).

## Pre-registered reading
- **REPLICATES** if R1 and R3 each have mean net R > 0 with t >= 2 and Holm-adjusted p < 0.05, AND R2 mean net R > 0.
- **PARTLY** if not that, but R1 mean net R > 0 with t >= 1.
- **DOES NOT REPLICATE** otherwise.

## Reported beside the reading (not part of it)
- Random-entry placebo: 40 seeds (`rng(7001)` … `rng(7040)`), per market the same number of trades the rule took in R1's
  window, on uniform random signal days of that window, with the frozen `randomTrades` (same hold, stop and costs). The
  seeds' pooled mean, 95th percentile and how many the rule beats.
- 2x costs: R1, R2, R3 with spread AND financing doubled (R recomputed from the stored `fin` and spread).
- Per market rows, stops, win rate, by year; t on calendar-month sums.

## What a result means
None of the three readings changes anything live. REPLICATES would support #860's paper-shadow proposal (owner decision);
PARTLY or DOES NOT REPLICATE would be written beside it as evidence against. The rule is not tuned on these data.
