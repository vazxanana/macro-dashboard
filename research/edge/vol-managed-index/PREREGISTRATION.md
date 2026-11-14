# Volatility-managed exposure on equity index CFDs: pre-registration

Written and committed **alone, before** `run.mjs` exists and before any return, Sharpe ratio or drawdown below was computed
(14 Nov 2026). The data, the strategies, the costs, the tests and the pass bar are fixed here; anything added later is labelled
post hoc in `RESULT.md`.

Paper research only. Nothing live changes, whatever the outcome: no council member, rule, size, filter, stop, config, cost
constant or mirror setting is touched, and no market is added to any trading rule.

**Scope.** Equity index CFDs only (S&P 500, Nasdaq 100, Dow 30, DAX). **Gold is not touched**: no gold candle is read, and
this is not a size, gate, exit or entry test on the gold book's 2006-17 window (owner decision 44 stands). ICT is not involved.

**Stops.** Every position here is a portfolio weight held from one daily close to the next, not a discretionary trade with
an entry and an exit. A stop rule does not apply to this research comparison (paper only, no order exists). Any live use of
anything this study finds would need a stopped execution (absolute rule 1) and the owner's approval (absolute rule 3); this
study proposes nothing of the kind.

## Why

Moreira and Muir (2017, "Volatility-Managed Portfolios") report that scaling an equity position by the inverse of its recent
realised variance raises its Sharpe ratio; Harvey et al. (2018, "The impact of volatility targeting") find that volatility
targeting mainly reduces tail risk and drawdowns for equities, with a smaller and less certain Sharpe gain, and that the gain
shrinks after trading costs. The question for this repository: on the OANDA index CFD prices the council already keeps, net of
a CFD's own costs (spread and daily financing), does an inverse-variance (or inverse-volatility) long position beat a constant
long position per unit of risk?

## What is already known (seen before this was written)

- The council-data branch holds OANDA daily candles `research/daily/<key>.json` (`{ rows: [[unixSec, o, h, l, c, v], …] }`,
  complete UTC days, written by `scripts/daily-cache.mjs`) for `spx500`, `nas100`, `us30` (from 24 Mar 2003) and `de40`
  (`DE30_EUR`, from 25 Mar 2003), all to 6 Nov 2026. Seen only for their first / last dates, row counts and weekday counts:
  the US indices carry a short Sunday candle (the evening reopen) most weeks, the DAX has 9; a few one-week holes over
  Christmas on the DAX. No return, volatility or Sharpe ratio was computed from them.
- `macro/cache.json` on council-data holds FRED `DGS2` weekly (`score.fred.DGS2`, `[date, percent]`, 6 Jan 2006 → 13 Nov 2026).
  Seen for its first and last values only.
- No earlier study in this repository has tested volatility scaling on equity indices (`research/edge/macro-vol` is about
  gold and macro volatility, not this rule).

## Data and returns

- Read with `git show origin/council-data:research/daily/<key>.json` and `…:macro/cache.json` (no network).
- **Weekday closes only**: Saturday and Sunday candles are dropped; a Monday's return is its close over the previous weekday
  close (so the Sunday-evening session is inside Monday's return). Holes are not filled: a return spans the gap.
- Daily simple return `r_t = C_t / C_{t−1} − 1` on consecutive kept closes. Each index in its own currency (DAX in euros).
- `sigma20_t` = sample standard deviation of the last 20 daily returns up to and including `r_t`, times √252: known at the
  close of day t. The first 20 returns of a market only warm it up.

## Strategies (position set at each daily close t, held to close t+1)

- **A**: constant weight 1 (long 1x notional).
- **B**: `w_t = min(2, c_B / sigma20_t²)`.
- **C**: `w_t = min(2, c_C / sigma20_t)`.
- **Scaling c** (primary, the tested version): c is chosen per market and per window, by bisection, so that the strategy's
  average weight over that window's days (after the 2x cap) equals 1. This removes the leverage advantage; it uses the
  window's own volatility level (the convention of Moreira and Muir).
- **Out-of-sample variant** (reported, not tested): c fitted the same way on the replication window only and applied
  unchanged to the decisive window (`B-oos`, `C-oos`); its average decisive weight is reported beside it.
- Day t+1's strategy return: `w_t · r_{t+1} − cost_{t} − fin_{t,t+1}` (below). Equity compounds daily; no rebalancing other
  than the weight change.

## Costs (net of costs everywhere)

- **Spread / commission**: 0.04 % of notional × |w_t − w_{t−1}| at each close (the whole round-trip cost charged on each
  change of weight: conservative), and 0.04 % × w on the first day of each window (opening the position). A's weight never
  changes after that. **Check at 2x**: 0.08 %.
- **Financing** on the long notional, every calendar day held (a Friday-to-Monday hold pays three days):
  `w_t × (y + 2.5 %) / 365 × days(t, t+1)`, y = US 2-year Treasury yield `DGS2` from `macro/cache.json`, the latest weekly
  value dated strictly before day t+1, floored at 0. Before 6 Jan 2006 (no value in the cache) a fixed 4 % stands for y and
  RESULT.md says so. The same US rate is used for the DAX (a simplification: a euro CFD is financed at a euro rate; stated in
  RESULT.md). Financing is not doubled in the 2x check.
- Because financing already charges a risk-free rate plus a markup, the Sharpe ratio is the mean of the net daily return over
  its standard deviation × √252, with no further risk-free rate taken off.

## Windows

- **Decisive**: 1 Jan 2016 → the last candle (6 Nov 2026).
- **Replication**: the first day with a 20-return sigma (late April 2003) → 31 Dec 2015.

## Measures (per market, strategy and window)

Sharpe ratio (above), Sortino ratio (mean ÷ the root mean square of the negative daily returns, × √252), maximum drawdown of
the compounded equity, annual return (compound, over the window's calendar length), Calmar ratio (annual return ÷ |maximum
drawdown|), average weight, share of days at the 2x cap, yearly turnover (Σ|Δw| a year), costs paid a year.

## Tests

- **T1**: spx500, Sharpe(B) − Sharpe(A) on the decisive window.
- **T2**: spx500, Sharpe(C) − Sharpe(A) on the decisive window.
- **T3**: pooled: an equal-weight portfolio of the four markets' B against the equal-weight portfolio of their A (each
  market's own c), Sharpe difference on the decisive window. Portfolio daily return = the mean of the four markets' strategy
  returns on each weekday of the union of their dates; a market with no close that day contributes 0 (its return lands on its
  next close).
- **p-value (decisive, used for Holm)**: one-sided (H1: the managed strategy has the higher Sharpe), paired circular block
  bootstrap of the daily net returns, 21-day blocks, 5,000 draws, seed fixed in `run.mjs`; p = share of draws whose
  difference minus the observed difference is at least the observed difference (the distribution centred on the null). The
  Jobson-Korkie test with Memmel's correction is reported beside it (one-sided), not used for the bar.
- **Holm** over T1-T3 at 0.05 on the bootstrap p.
- **Placebo** (reported, not part of the bar): the spx500 sigma20 series of the decisive window is shuffled in 21-day blocks
  (40 seeds), B and C are rebuilt from the shuffled sigma (c refitted to an average weight of 1) and their Sharpe gain over A
  recorded; RESULT.md gives the placebo gains' mean and maximum and how many reach the real gain. A real effect should beat
  them all.
- **2x cost**: every test's Sharpe gain recomputed at 0.08 %.

## Pass bar (fixed)

A test **passes** only when all three hold:
1. Sharpe gain > 0 in the decisive window AND in the replication window;
2. its Holm-adjusted bootstrap p < 0.05 in the decisive window;
3. the managed strategy's maximum drawdown in the decisive window is no worse (no deeper) than A's.

The study's **verdict** is PASS when T1 passes; T2 and T3 are judged and reported each on the same bar. A pass whose decisive
Sharpe gain is not above 0 at 2x cost is reported as "passes, not robust to costs". A PASS is a statement about a paper
weighting rule on index CFDs, not an edge of any council system, and proposes no live change.

## Not done, on purpose

No other lookback, cap, target volatility, market or window is tested; anything of that kind in RESULT.md is post hoc and
labelled. No short side, no leverage beyond 2x, no intraday rebalancing.
