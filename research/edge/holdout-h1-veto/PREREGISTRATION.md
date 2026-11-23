# Pre-registration: no breakout fill against a fresh H1 break (holdout, 23 Nov 2026)

Written and committed before any holdout candle is read for this study. Paper research only.

## Why
The in-sample scan of the first run's trades (2010-2026, five main markets; a reason to choose, not evidence) found one veto
that held across methods and both halves: entries made while the last H1 break was AGAINST the trade and at most 6 H1 candles
old did worse (-0.305R a trade, n 741, against -0.101R for the rest; within-method +0.22R; 3 of 3 methods with enough trades
agreed, the volatility breakout among them at +0.10R). In the owner's cycle words: a fresh lower-timeframe break against you
means the pullback is still running, so do not enter in front of it. The veto only helps an entry that is positive, so it is
stacked here on the one entry with evidence, the volatility breakout (all fill hours). A different question from
`holdout-vb-early` (time of day): here, who controls the H1 at the fill.

## The rule (fixed)
- Base rule unchanged: `research/edge/gold-vol-breakout/run.mjs` `vbTrade` (k 0.5, both sides), as in `holdout-vb-early`
  ("The rule", base part), all fill hours; the same costs.
- H1 structure: toolkit `structure(resample(m5, 3600), 3)` over the continuous history (a close beyond the last confirmed
  3-a-side swing is a break, BO or ChoCh alike).
- **The veto, the only change**: at the first fill, read the last H1 break among H1 candles CLOSED at or before the fill time. If
  its direction is against the fill side and its candle closed 6 or fewer H1 candles before the fill (counting closed H1
  candles), the day has no trade; the other stop order is cancelled too (the day is not switched to the other side).

## Harness gate
As `holdout-vb-early`: the unfiltered base rule reproduces the published counts and net R a trade on each overlapping holdout
window (within 2 % and 0.01R). A miss = INCONCLUSIVE.

## Tests
- **Primary (enters the five-study Holm)**: the vetoed rule, all ten market-sets pooled.
- Reported only: the vetoed days as a comparison (kept minus vetoed, Welch t); the base rule pooled; each set alone.

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
