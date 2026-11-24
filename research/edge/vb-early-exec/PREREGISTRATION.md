# Pre-registration: early against late fills of the volatility breakout, at the broker's own fills (vb-early-exec, 24 Nov 2026)

Written and pushed alone, before the early / late split is computed on any broker fill. Paper research only; nothing live changes.

## Why
`holdout-vb-early` (23 Nov 2026) took T1 (the gold / USD/JPY volatility breakout, k 0.5, both sides, stop at the day's open,
out at 21:00 UTC) only when it filled before 06:00 UTC. It failed narrowly on the untouched holdout, but early fills beat late
ones on both holdout sets (early minus late +0.097R a trade, Welch t 3.83). Separately, `gold-vol-breakout-exec` and
`usdjpy-vol-breakout-exec` filled T1 at the demo broker's own ticks, 24 Nov 2023 to Nov 2026 (both PASS overall). The question:
at the broker's real fills, do trades that fill before 06:00 UTC do better than those that fill at or after it?

## What was read before, said plainly
These years are in sample for T1 (both exec studies read them, and the hour split was found on 2010-2026 OANDA mid candles in
the first overnight run of 23 Nov 2026, which included them). The early / late split has never been computed on the BROKER's
fills. So this is a measurement on in-sample years at real execution, not new evidence: a PASS is a hypothesis for the forward
records (`gold-vol-breakout-forward`, `usdjpy-vol-breakout-forward`) to judge, never an edge and never a rule change.

## Data (no new read of the broker)
- Trades: the two studies' committed `trades.json` (T1 on OANDA mid, unchanged).
- Broker fills: the same tick-probe files those studies reported from, read with `git show origin/council-data:<path>` at the
  commits they name: gold `research/probe/ticks-XAUUSD.json` at a00d5984d plus `ticks-XAUUSD-x.json` at 5d2ae2dcd (exit marks,
  one-hour look-back); USD/JPY `research/probe/ticks-USDJPY-exec-a.json` at 02a36d2f9 and `-exec-b.json` at 00aa6bc59.
- Each trade's broker result is computed by the studies' own exported code (`brokerTrade`, imported, not edited), with each
  study's own exit-mark rules (gold: the second file's one-hour look-back replaces an empty quote; USD/JPY: quote at most 1 h
  old). **Gate**: the reproduced rows must give each study's published n filled, net R a trade and month t to 4 decimals; a miss
  = INCONCLUSIVE, no split is reported as a result.

## The split (fixed)
- **Early** = the T1 fill candle (OANDA M5, `fillT`) starts before 06:00 UTC of the trade's UTC day (`fillT - d0 < 21600`),
  the definition `holdout-vb-early` used (both orders cancelled at 06:00). **Late** = every other trade.
- Rows as the exec studies counted them: a trade the broker never filled is kept with net 0 in its group (by `fillT`);
  skipped trades (no exit quote) are left out as there.
- Reported only: the same split on the broker's own entry tick time (filled trades only).

## Statistic, family and bar
- R a trade after the broker's commission (the studies' `net`), early minus late.
- Per test: Welch t of early minus late on trades, and a month-sum check: the month-by-month difference (early month mean minus
  late month mean, months with both) and its t.
- Tests: pooled (gold + USD/JPY rows together), gold alone, USD/JPY alone. Holm over the three Welch p values (two-sided).
- **PASS** = pooled early minus late > 0 with Welch t >= 2 and Holm-adjusted p < 0.05, AND the difference is positive on BOTH
  markets alone, AND the month-sum difference t is > 0. Otherwise FAIL. Under 60 early or 60 late trades on a market =
  INCONCLUSIVE for that market (the pooled verdict then needs the other market's sign alone to be stated as missing).
- Also reported: early alone and late alone per market and pooled (n, mean net R, month-sum t), by year.

## What a result means
In sample, at real fills, one split, two markets: at most a hypothesis that early fills carry T1. It changes no rule, no demo
job and no forward record; a forward check would need its own pre-registration.

## Files
`research/edge/vb-early-exec/{PREREGISTRATION.md, run.mjs, RESULT.md, result.json}`, `tests/vb-early-exec.test.mjs`.
