# Pre-registration: discretion made explicit, the phase reader picks which entry to take (holdout, 23 Nov 2026)

Written and committed before any holdout candle is read for this study. Paper research only.

## Why
The owner's description of good trading is not one entry but knowing where price is in the market cycle on each timeframe
and using each kind of entry only where it belongs: a breakout at the start of an expansion, the end of a pullback once the
pullback has ended, a retest of a Daily zone while the Daily is pulling back into it. The first run tested each entry alone and
every one failed; none was tested as a BOOK in which the cycle chooses the entry. This study writes that choice down as a rule,
using the repository's phase reader (`research/edge/_lib/phase.mjs` `readPhase`), so the "discretion" can be measured.
The prior is weak and is said so: the in-sample scan of the first run's trades found that the phase features, one at a time,
did not separate winners from losers (largest within-method differences 0.02-0.06R). This tests the combination as the owner
describes it, once.

## Candidates (three entry generators, imported unchanged)
1. **Pullback end** (`research/edge/h4-pullback-end/run.mjs` `candidates`, the rule as written there, location step included).
2. **H1 box break** (`research/edge/direction-chain-gate/run.mjs` `candidates`, the ungated entry: H1 box break with the H1
   side, market at the next M5 open, stop the box's far edge, 2R, 48 h).
3. **Daily zone retest** (`research/edge/daily-zone-retest/run.mjs` `signals` / `trades`, as written there).
Each candidate keeps its own stop, target and exit. Costs as each generator's study charges them (the larger of that and toolkit
`COSTS`); gold buys of the zone retest pay financing as in that study.

## The choice (fixed; the phase is read at the signal candle's close, from candles closed by then)
`P = readPhase({ '1d', '4h', '1h', '15m', '5m' }, t)` with the reader's defaults; s = the candidate's side.
- **Never**: no candidate is taken while `P.tf['4h'].stage === 'range'`.
- **Pullback end**: taken only when `P.tf['4h'].side === s`, `P.tf['4h'].stage === 'continuation'` (the reader agrees the H4
  pullback has ended) and `P.tf['1d'].side !== -s`.
- **H1 box break** (expansion): taken only when `P.tf['4h'].side === s`, `P.tf['4h'].confirmed`, `P.tf['4h'].stage` is `'move'`
  or `'continuation'`, and `P.tf['1h'].stage !== 'pullback'`.
- **Daily zone retest**: taken only when `P.tf['1d'].side === s` and `P.tf['1d'].stage` is `'pullback'` or `'continuation'`.
- **Book**: one open position at a time per market across the three generators, in order of fill time; two fills in the same
  M5 candle: pullback end first, then zone retest, then box break (fixed order). A candidate that cannot be taken because a
  position is open is dropped, not queued.

## Harness gate
Each generator, unchanged, reproduces its own `result.json` counts and net R a trade per window on the cached 2010-2026 candles
(within 2 % and 0.01R); `phase.mjs` passes `tests/phase.test.mjs`. A code check only; a miss = INCONCLUSIVE.

## Tests
- **Primary (enters the five-study Holm)**: the book above, all ten market-sets pooled.
- Reported only: the same three generators without the choice (one position at a time per market, same order) as a control;
  per generator kept against rejected (Welch t); which phase condition removed how many candidates.

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

Pinned: `research/edge/_lib/phase.mjs` 6a204f93814b50bc, `research/edge/h4-pullback-end/run.mjs` c7abd9c768f0821b, `research/edge/direction-chain-gate/run.mjs` 2c891e09c4bf3463, `research/edge/daily-zone-retest/run.mjs` de00379cac36fb31.
