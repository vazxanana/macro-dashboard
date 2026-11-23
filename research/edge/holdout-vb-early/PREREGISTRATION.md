# Pre-registration: the volatility breakout taken only when it fills before 06:00 UTC (holdout, 23 Nov 2026)

Written and committed before any holdout candle is read for this study. Paper research only.

## Why
A scan of the first run's trades (23 Nov 2026, 2010-2026 on the five main markets, in sample, about 1,000 comparisons, so a
reason to choose, never evidence) found one split that held in both halves on both breakout markets: the day's breakout made
its money when the stop order filled early in the UTC day (gold fills 00-03 UTC +0.34R a trade, n 388; USD/JPY Asia hours
+0.14R, n 1,120) and nothing when it filled in the afternoon. The idea in plain words: an early break of the day's open is
overnight order flow that has already moved price half a range and has the whole day to run; a late fill gets a few hours and
pays the same cost. The breakout works at the start of the day's expansion, not at its end.

## What was read before, said plainly
The pooled breakout (every fill hour) has been read on parts of this holdout: gold 2007-26 (`gold-vol-breakout`), USD/JPY
2005-26, EUR/USD, GBP/USD, AUD/USD, USD/CAD and USD/CHF 2005-26 (`fx-vol-breakout`, `fx-majors-vb-early`), EUR/JPY
(`yen-crosses-vol-breakout`) and silver (`silver-vol-breakout`). The split by fill hour has never been computed on any holdout
year; NZD/USD has never been in a breakout study. So the holdout is untouched for the HOUR SPLIT, not for the breakout itself.
The pooled breakout failed on most of these markets: a pass here would be strong evidence; a fail is the expected outcome.
NZD/USD alone is reported as the cleanest slice (no verdict).

## The rule (fixed)
- Base rule unchanged: `research/edge/gold-vol-breakout/run.mjs` `vbTrade` (k 0.5, both sides) on every market: O = open of the
  first M5 candle of the UTC day (00:00-00:55); buy stop O + 0.5 x the previous UTC day's range, sell stop O - 0.5 x it; the
  first fill wins and the other order is cancelled; stop at O; out at the 21:00 UTC close (gold: the 20:55 candle close, as the
  base rule). A day the base rule skips (`daySkip`) is skipped.
- **The new step, the only one**: both orders are cancelled at 06:00 UTC if neither has filled. A fill at or after 06:00 UTC is
  not taken. Nothing else changes (stop, exit, size 1R).
- Cost: the larger of the market's toolkit `COSTS` and its own breakout study's cost (gold $0.60 a round trip per ounce; the
  forex pairs `fx-vol-breakout`'s commission + half a pip of spread).

## Harness gate (no verdict without it)
The unfiltered base rule on the toolkit's candles reproduces, on each holdout window that overlaps a published result, that
study's trade count within 2 % and its net R a trade within 0.01R. A miss = INCONCLUSIVE.

## Tests
- **Primary (enters the five-study Holm)**: the rule above, all ten market-sets pooled (Set A + Set B).
- Reported only: the late fills (06:00-21:00 UTC) of the same days as a comparison, kept minus late, Welch t; NZD/USD alone;
  gold and USD/JPY alone; the 2x-cost line per set.

## Holdout data (the only data that judges this study)
- **Set A, early years**: entries 2005-01-01 to 2009-12-31 on gold, EUR/USD, GBP/USD, USD/JPY, AUD/USD (toolkit `MARKETS`).
  The source starts later for some markets (OANDA gold M5 from mid 2006): each market from its first candle on file.
- **Set B, fresh markets**: entries 2010-01-01 to the last complete day on file on NZD/USD, USD/CAD, USD/CHF, EUR/JPY and
  silver (toolkit `HOLDOUT_MARKETS`).
- Candles: OANDA mid M5 through the toolkit (`research/edge/_lib/edgekit.mjs` `load`), fetched into the cache outside git
  before the run; H1 / H4 by `resample` (UTC blocks), the Daily by `dailyNY` (17:00 New York days), M15 by `resample`. Closed
  candles only. Candles before a set's first entry date are read for warm-up (structure, ranges, ATR) only, never for a trade.
- Not read for this study: 2010-2026 on the five main markets (the first run of 23 Nov 2026 read it under twelve rules; it
  chose this hypothesis and cannot judge it). No result on those years is part of the verdict.
- A trade belongs to the set and month of its entry; month sums use the exit month (toolkit `stats().tMonth`); empty months
  inside a set's span count as 0.

## Costs
Each market's round trip from toolkit `COSTS` (Set B's figures are ASSUMED, not measured on the demo account: said, not
hidden), charged in R of the trade's own opening risk (`Rnet`). Every figure is also computed at 2x costs. Financing is not
charged unless said below.

## Statistic, family and pass bar
- Statistic: mean R a trade after costs; t of calendar-month sums of R, Set A and Set B months pooled (each set's own months);
  one-sided p (mean > 0) from the toolkit's t distribution.
- Family: this is one of five holdout studies pre-registered together on 23 Nov 2026 (`holdout-vb-early`,
  `holdout-pullback-deep`, `holdout-phase-pick`, `holdout-h1-veto`, `holdout-weekly-fade`). Holm across the five primary p
  values.
- **PASS** only if every line holds: (1) mean R after costs > 0 on Set A; (2) mean R after costs > 0 on Set B; (3) pooled
  holdout month t >= 2 and Holm-adjusted p < 0.05; (4) at least 100 pooled holdout trades; (5) pooled mean R > 0 at 2x costs.
- **FAIL** = any line missed with at least 100 pooled trades. **INCONCLUSIVE** = fewer than 100 pooled trades, the harness
  gate below missed, or a defect found after the run (then a new pre-registration, never a fix and re-run under this one).
- Reported, never judged: each market alone, each set alone at 2x costs, before costs, buys and sells, by year, exits.

## Rules of the run
One run. No variant (swing size, threshold, timeframe, stop, target, market list) is tried under this pre-registration; what is
seen after the result is a hypothesis for other data. The code is written after this file is committed. Imported modules are
pinned by the first 16 hex characters of their sha256 below; a different hash at run time makes the study INCONCLUSIVE.
Never called an edge without its n and t. Paper research only: nothing live changes, whatever the result; at most a proposal
for the owner.

Pinned: `research/edge/gold-vol-breakout/run.mjs` afa36e031e39daab, `research/edge/fx-vol-breakout/run.mjs` 5ecca28799940b38.
