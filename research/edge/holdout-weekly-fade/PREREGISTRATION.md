# Pre-registration: with the Weekly, against the Daily, at a Daily level (holdout, 23 Nov 2026)

Written and committed before any holdout candle is read for this study. Paper research only.

## Why
Two of the owner's marked fades (a EUR/USD sell of 21 Aug 2026 and a gold sell of 10 Nov 2026) share one shape: the trade is
with the Weekly structure, against a Daily that has just run, at a Daily swing level: the end of a Daily pullback inside the
Weekly move. The in-sample scan of the first run's trades (a reason to choose, not evidence) gave it a small, broad lift (+0.048R
a trade within method, 8 of 10 methods better, n 11,130) that faded after 2016 (+0.112R in 2010-16, -0.004R in 2017-26), so the
prior is weak. It is tested once, on one plain entry.

## The rule (fixed)
- Entry: the H1 box break of `research/edge/direction-chain-gate/run.mjs` `candidates`, ungated (H1 box break with the H1 side,
  market at the next M5 open, stop the box's far edge, target 2R, out after 48 h, no trade when the stop is under 5 round-trip
  costs, Monday to Friday), its costs as written there.
- Read at the breaking H1 candle's close, from candles closed by then; s = the trade's side:
  - **Weekly side** = toolkit `structure(W, 3)` side, W = Monday weeks built from the `dailyNY` days (`direction-chain-gate`
    `weekly`); must equal s.
  - **Daily side** = toolkit `structure(D, 3)` side on the `dailyNY` days; must equal -s.
  - **At a Daily level**: the entry price (the breaking candle's close) within 0.5 x the Daily ATR(14) (simple mean of true
    ranges of the last 14 closed days) of any of the last 40 confirmed Daily swing highs or lows (toolkit `swings(D, 3)`,
    confirmed by then).
- All three must hold. One open position at a time per market, in order of fill time.

## Harness gate
`direction-chain-gate`'s ungated entry reproduces its `result.json` counts and net R a trade per window on the cached 2010-2026
candles (within 2 % and 0.01R). A code check only; a miss = INCONCLUSIVE.

## Tests
- **Primary (enters the five-study Holm)**: the rule above, all ten market-sets pooled.
- Reported only: the ungated entry on the holdout as a control; each of the three conditions alone; buys and sells.

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

Pinned: `research/edge/direction-chain-gate/run.mjs` 2c891e09c4bf3463.
