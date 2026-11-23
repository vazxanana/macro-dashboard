# Pre-registration: the end of an H4 pullback, only after a pullback past the 50 % line (holdout, 23 Nov 2026)

Written and committed before any holdout candle is read for this study. Paper research only.

## Why
`h4-pullback-end` (23 Nov 2026) was the closest near miss of the first run: +0.125R a trade out of sample (n 120, month t
0.77), positive before costs in two of its three windows, but negative in sample. Its location step had two branches: a
pullback that reached the 50 % line of the H4 move ("external range", enter at or below the line) and a shallow one ("internal
range", enter in the lower half of the pullback's own range). Out of sample the deep branch made +0.145R (n 75) against +0.090R
(n 45). This study keeps the deep branch only: the H4 pullback must have come back at least half the move before its end is
traded. In plain words: buy the end of a pullback only once it has given back half the move (discount), never in the upper
half. One change, read on the holdout only; the split above was seen after that study's result and is a hypothesis.

## The rule (fixed)
Exactly `research/edge/h4-pullback-end/PREREGISTRATION.md` ("The rule (fixed)"), run by its `run.mjs` `candidates`, with one
change in the location step:
- **Only the external branch**: enter only when the pullback extreme P went to or past M = (O + X) / 2 (buys: P <= M; sells:
  P >= M) AND the entry close is at or below M (sells: at or above). A pullback that never reached M gives no trade (the
  internal fallback is removed).
- Everything else as written there: H4 trend and leg from `structure(·, 3)`, pullback start = the first H1 ChoCh against the H4
  side, entry = the next H1 break with it, market at its close; void rules; stop P minus one round-trip cost; target X; skip under
  1R or a stop under 3 costs; out after 10 days; one position at a time per market; fills by toolkit `simulate` on M5.

## Harness gate
`candidates` with the internal branch restored must reproduce `h4-pullback-end/result.json`'s T1 counts and net R a trade per
window (within 2 % and 0.01R) on the cached 2010-2026 candles. That rerun is a code check only; its numbers are not part of the
verdict. A miss = INCONCLUSIVE.

## Tests
- **Primary (enters the five-study Holm)**: the rule above, all ten market-sets pooled.
- Reported only: the removed internal-branch trades of the holdout as a comparison (Welch t); gold alone; forex alone.

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

Pinned: `research/edge/h4-pullback-end/run.mjs` c7abd9c768f0821b, `research/edge/_lib/edgekit.mjs` (structure, simulate unchanged by this study).
