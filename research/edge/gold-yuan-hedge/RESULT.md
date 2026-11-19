# Result: gold after the Chinese yuan weakens or strengthens on its own (14 Nov 2026)

**Verdict: FAIL, 0 of 3: trading gold the way of a yuan-specific 20-day USD/CNH move makes +0.029R a trade net out of sample 2017-26 (n 50, month t 0.15); it beats 21 of 40 placebos.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 1b49b4888, pushed alone before any number was computed).
Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here
was compared with or applied to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant or
council member changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json`, `usdcnh.json` and the five dollar-index pairs
  at commit `603d2d595` (gold 2006-03-20 to 2026-11-06, USD/CNH from 2011-02-07), weekends folded into Monday with
  `council/fills.mjs` `foldWeekend`. Dollar index = the council's ICE DXY build (`council/macro.mjs` `dxySeries`).
- Signal at each day's close: the yuan-specific move = the 20-day sum of USD/CNH log returns less beta x the dollar index's,
  beta and the residual's sd fitted on the 250 common-day returns before the day; z beyond +/-1.5. Yuan weak on its own
  (z > 1.5): buy gold; yuan strong on its own (z < -1.5): sell gold.
- Trade: next gold open, stop 2 x ATR(20) of the 20 candles before (1R; every trade has one; gaps fill at the open), out at the
  close of the 20th (T1, T2) or 5th (T3) candle, one at a time per test. Costs $0.60 a round trip plus `nights()` x
  `FIN.xau.long` x entry / risk on buys; 2x costs doubles both.
- Windows: in sample signal days to 2016-12-31 (USD/CNH and the 250-day warm-up make the first signal row 2012-01-27, as the
  pre-registration said); out of sample 2017-01-01 to 2026-10-31. t on calendar-month sums, Holm over T1-T3, 40 seeded
  placebos (random out-of-sample days with the test's real sides in date order).

## Verdict table

| Test | Window | n | Gross R | Net R | Net at 2x | Month t (net) | Month t (gross) | Median stop | Cost share |
|---|---|---|---|---|---|---|---|---|---|
| T1 both sides, 20 days (primary) | IS 2012-16 | 21 | +0.105 | +0.044 | -0.018 | 0.13 | 0.31 | $38.95 | 59% |
| T1 | OOS 2017-26 | 50 | +0.094 | +0.029 | -0.035 | 0.15 | 0.47 | $51.13 | 68% |
| T2 buys only, 20 days | IS 2012-16 | 11 | -0.384 | -0.488 | -0.593 | -1.94 | -1.62 | $35.52 | n/a |
| T2 | OOS 2017-26 | 21 | +0.292 | +0.155 | +0.019 | 0.47 | 0.86 | $43.39 | 47% |
| T3 both sides, 5 days | IS 2012-16 | 41 | -0.068 | -0.103 | -0.138 | -1.00 | -0.67 | $35.71 | n/a |
| T3 | OOS 2017-26 | 94 | +0.080 | +0.049 | +0.018 | 0.65 | 1.07 | $51.51 | 39% |

Cost share = mean cost R / mean gross R (n/a where gross is not positive). Every median stop is well over $10.

| Test | OOS month t | Placebos beaten (of 40) | Placebo median t | One-sided p | Holm p | Pass |
|---|---|---|---|---|---|---|
| T1 | 0.15 | 21 | 0.05 | 0.440 | 0.774 | no |
| T2 | 0.47 | 3 | 1.36 | 0.319 | 0.774 | no |
| T3 | 0.65 | 32 | 0.19 | 0.258 | 0.774 | no |

Checks failed: T1 month t and Holm, 2x costs, placebo; T2 in sample, month t and Holm, placebo, n < 30; T3 in sample, month
t and Holm, placebo.

## Baseline: the same trade on every day

| Test, window | Signal buys: n, net | Every-day buy: net | Signal sells: n, net | Every-day sell: net |
|---|---|---|---|---|
| T1 IS | 11, -0.488 | -0.148 | 10, +0.630 | +0.110 |
| T1 OOS | 21, +0.155 | +0.225 | 29, -0.062 | -0.246 |
| T3 IS | 22, -0.083 | -0.083 | 19, -0.127 | +0.017 |
| T3 OOS | 43, +0.115 | +0.063 | 51, -0.007 | -0.109 |

Out of sample the 20-day buys after a weak yuan did WORSE than a buy on any day (+0.155R against +0.225R); the sells after a
strong yuan lost less than a sell on any day only because gold rose through the decade. The direction the hypothesis predicts
is not there in either window: in sample the buys lost and the sells won (the opposite way), out of sample the sign flips.
Gold's rise from 2019 carries every buy; the signal adds nothing to it.

## Context

- Signal days: in sample 93 yuan-weak and 68 yuan-strong of 983 rows; out of sample 161 and 130 of 2,552.
- The beta of USD/CNH on the dollar index is small in 2012-16 (median 0.08, the managed peg) and larger since (median 0.38),
  so the "yuan-specific" part is most of the yuan's move in the early years.
- The in-sample window is short (2012-2016, 21 primary trades): the pre-registration said so; it does not change the verdict,
  which fails on the out-of-sample window alone.

## Reading

Not an edge, not a lead. Whatever Chinese hedging demand does to the physical premium, it does not show up as a tradable
move in spot gold over the following one to four weeks once costs are paid. Nothing here should be used as a filter or a
bias on any gold rule. Not tested: the onshore yuan (CNY), the Shanghai premium itself (no data), other thresholds or holds.

To repeat: `node research/edge/gold-yuan-hedge/run.mjs fetch <dir>` (git show from council-data at the pinned commit, no
network), then `node research/edge/gold-yuan-hedge/run.mjs full <dir>`. Test: `tests/gold-yuan-hedge.test.mjs`.
