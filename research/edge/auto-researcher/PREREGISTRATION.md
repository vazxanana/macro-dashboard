# Auto-researcher: five workers searching rule combinations around the clock (pre-registered 24 Nov 2026)

Written and committed alone, before the engine ran. Paper research only: nothing here trades, alerts or changes a rule. Results
go to council-data `research/auto/`, never to main.

## Why

The owner asked for a researcher that never stops, tries "a million simulations of different combinations" and thinks out of the
box, with five workers. A million tries on the same years WILL produce winners by chance, so the protocol below counts every
try and makes a winner prove itself on years it was never searched on.

## The search

Five workers (GitHub Actions jobs, `researcher.yml`), each a seeded random generator of rules over H1 OANDA mid candles of ten
markets (xau eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy xag), costs from `research/edge/_lib/edgekit.mjs` `COSTS`
(round trip, charged in R), entry at the next open after the signal, stop first when one candle holds both, a candle opening
beyond the stop exits at its open, one position at a time per rule.

A rule = trigger + filters + exit. Triggers (the worker's family): **brk** (close beyond the prior N-bar high / low, followed),
**fade** (the same, traded the other way), **pull** (a moving-average trend with an RSI pullback), **big** (a candle over k ATR,
faded or followed), **blk** (a break of the previous clock block's range, followed or faded), **dev** (a close z ATR from its
moving average, faded or followed), and for the "wild" worker two triggers that must agree on the side. Filters: UTC hour
window, weekdays, trend with / against the 200-bar average, ATR percentile below / above. Exit: stop 0.5-3 ATR, target 0.5-6R or
none, a time limit of 4-240 candles. Side: long, short or both. The grids are in `engine.mjs` (`SPACE`); nothing is added after
a run starts.

Workers: 1 brk + fade, 2 pull + dev, 3 big + blk, 4 all families, 5 wild (two triggers). Seeds differ by worker and by chunk.

## The three stages (windows by entry date)

- **Stage A, search: 2005-2014.** Every try is scored here. It survives with n >= 250, mean net R >= 0.04 and a month-sum t >= 3.0.
- **Stage B, validation: 2015-2019.** A survivor needs n >= 100, mean net R > 0, month-sum t >= 1.5, and its side-flipped twin
  (placebo) must have mean net R < 0 on A. Passing A and B = a candidate.
- **Stage C, holdout: 2020 to the day of the run.** Never searched. Candidates are grouped by market, trigger and side; ONE
  member per group, the first to reach C, is looked at on C, once. Pass: n >= 100, mean net R > 0, month-sum t >= 2.0, and a
  Holm-adjusted p < 0.05 over every group looked at on C so far.

## What is counted and reported

Every worker's counters: tries, A survivors, B candidates, C looks, C passes; the trial count is the SUM over workers. With T
tries the chance count at A is roughly T x 0.0013 (one-sided p at t 3), at B about 7 % of those, so the file reports the
expected number of chance candidates beside the real one. A C pass is the only thing called a **lead**, never an edge: a lead
goes to a pre-registered forward record before anyone trades it.

## Honesty rules

No threshold, grid, window or stage changes after a run starts; a change is a new version (`VERSION`), counted separately.
Results are never edited. The ledger keeps every C look, passes and fails. A rule that depends on a stop being absent is not
generated: every rule has a stop.
