# Market-cycle regime book: trade each method only in its own H4 regime: pre-registration (23 Nov 2026)

Written before any code of this study and before any of its regime labels or filtered results is computed. Paper research
only: nothing live changes, no rule, gate or size of any system follows from it, whatever the result. It runs LAST, after the
other studies of the night have saved their trade lists; it never changes them.

## The question
The other studies each tested one method on every day. The idea here: a method may only work in one state of the market
cycle (an H4 trend, or an H4 consolidation). Choose, on the in-sample years only, which states each method trades in; then
see whether that choice, applied unchanged, improves the out-of-sample record.

## Inputs (fixed now)
- **Trade lists**: every `research/edge/<study>/trades.json` that exists when this study runs, among the studies started on
  22-23 Nov 2026 (`barrier-qm-janda`, `box-touch-trend`, `daily-zone-retest`, `direction-chain-gate`, `eg-chain-50`,
  `h4-pullback-end`, `session-sweep`, `storyline-daily-gold`, `storyline-qm-sop`, `vb-structure-filter`), one method per list
  (a list split by its own test name counts each test as a method). **All of them, whatever their own verdict**: none is
  picked or dropped by its result. A list is left out only when it lacks a field this study needs (market, side, fill time,
  R before costs, R after costs) or has no trade in 2020-2023; the report names each left out and why.
- **Fallback**: if fewer than two lists qualify, this study runs two rules itself exactly as their own pre-registrations
  write them: the box-edge touch with the H1 trend (`box-touch-trend` T1) and the end of an H1 pullback inside an H4 trend
  (`h4-pullback-end`), with the toolkit's `simulate`.
- **Candles**: the toolkit cache (`research/edge/_lib/edgekit.mjs`, OANDA mid 5m), five markets xau, eurusd, gbpusd, usdjpy,
  audusd; H4 = `resample(5m, 14400)`; trading days = `dailyNY`.

## The regime of a day (fixed now, closed candles only)
At the START of each trading day, from the H4 candles closed by then (`closedBy`):
- **Consolidation**: the last H4 close is inside the H4 box still open (`boxesHL(H4, 3)`, not yet ended by a close outside)
  and that box has been known for 12 or more H4 candles (two days or more).
- **Trend**: not consolidation, and the last H4 break of `structure(H4, 3)` is a BO (a break with the side held before it)
  made within the last 30 H4 candles.
- **Transition**: everything else (the last break is a ChoCh, or no break in 30 H4 candles).
- **Side**: the H4 side of `structure` at that moment; a trade is "with" when its side equals it.
A trade takes the regime of the trading day that holds its fill time.

## The choice (made on 2020-2023 only, per method)
Menu of eight filters, fixed now: all days; each non-empty set of the three states (seven); and "trend days, with the H4
side". For each method the filter with the highest in-sample t of calendar-month sums of R after costs is chosen, among
filters keeping at least 30 in-sample trades; "all days" when none beats it. Nothing is chosen on 2024 or later.

## Windows, costs, statistic
In sample 2020-01-01 to 2023-12-31; out of sample 2024-01-01 to 2026-11-13 (fill times; the week the owner shaped these
ideas is left out). Replication (the classifier was shaped on 2020-26 today): choose on 2010-2015, test on 2016-2019, for the
methods whose lists cover those years. Costs: each list's own after-cost R (the toolkit `COSTS`); 2x costs = 2 x R after costs
minus R before costs. Statistic: mean R a trade after costs, t on calendar-month sums (by exit month), each kept trade 1R.

## Tests (Holm over the three out-of-sample p values from the month t)
1. **T1 (primary)**: the regime book = every method's out-of-sample trades kept by its in-sample filter, pooled.
2. **T2**: the same with an anchored walk-forward: the filter re-chosen before each of 2024, 2025, 2026 on all years before it.
3. **T3**: T1 on gold trades only.
Reported only, no verdict: each method's chosen filter, kept and dropped trades per method, the unfiltered pool, by year.

## Pass bar
T1 PASSES only if all hold: OOS mean > 0; OOS month t >= 2 with Holm p < 0.05; IS mean > 0; OOS mean > 0 at 2x costs; 30 or
more OOS trades; AND the filter helps: OOS kept trades beat OOS dropped trades (Welch t >= 2) and the book's OOS mean is above
the unfiltered pool's; AND it beats 95 % of 200 placebos (regime labels shuffled across trading days, each state's share kept,
same choice procedure); AND on the replication the chosen filters give a mean > 0 and above the unfiltered 2016-2019 pool.
- **FAIL**: OOS mean <= 0, IS mean <= 0, negative at 2x costs, OOS kept no better than dropped, or the replication mean <= 0.
- **INCONCLUSIVE**: positive everywhere but a t, Holm or placebo bar missed; fewer than 30 OOS trades; or no list covers
  2010-2019 (the replication cannot be run).
T2 and T3 get their own verdicts and cannot rescue T1. No other classifier, threshold (12 / 30 candles), swing size, menu or
timeframe is tried after the result. A pass earns a forward paper record only, never the word edge beyond its n and t.

## Prior
Weak. Regime gates have failed here before (`cycle-gate` 0 of 11, `ltf-structure`, `msnr-direction` as a filter, the
trend-up gate of `regime-switch` at t 1.43), and choosing a subset per method on four years invites overfitting: the placebo
and the dropped-vs-kept test are there for that.
