# Result: does Monday tell the rest of gold's week? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: following a big Monday made -0.048R a trade against the same-side week out of sample (n 188, month t -0.73) and +0.036R in sample (t 0.58).**

PREREGISTRATION.md was committed and pushed alone (52a587c3f) before any candle was read; the study ran once and nothing was
changed after the result. A new stand-alone rule on spot gold: not a gate, exit, entry or size of the gold book, and none of its
positions were read (owner item 44). Nothing live changes and no proposal is written.

## What was tested
Spot gold, council-data `research/daily/xau.json` (OANDA mid, UTC days, weekend folded into Monday with `foldWeekend`).
M = Monday's close minus the previous trading day's close; ATR = mean true range of the 20 days before Monday. When
|M| >= 0.5 ATR, trade the sign of M from Tuesday's open to Friday's close, stop 1.5 ATR (checked on daily candles, a gap fills
at the open). Each trade is scored against the **same-side baseline**: the identical Tuesday-to-Friday trade taken in every
eligible week of the window. Costs: $0.60 a round trip and, on buys, `nights` x `FIN.xau.long` x entry (today's demo rate for
every year). t on calendar-month sums (every month counts), Holm over three tests, 40 seeded placebos.

## The tests (excess = net R minus the window's same-side baseline)

| Test | Window | n | Gross R | Net R | Excess R | Month t (net) | Month t (excess) | Cost share |
|---|---|---|---|---|---|---|---|---|
| T1 follow Monday, both sides | 2007-16 | 169 | +0.042 | +0.005 | +0.036 | 0.08 | 0.58 | 0.88 |
| T1 follow Monday, both sides | 2017-26 | 188 | -0.026 | -0.063 | -0.048 | -0.95 | -0.73 | 1.42 |
| T2 buy after an up Monday | 2007-16 | 86 | +0.136 | +0.085 | +0.070 | 0.95 | 0.78 | 0.37 |
| T2 buy after an up Monday | 2017-26 | 100 | +0.123 | +0.071 | -0.009 | 0.75 | -0.09 | 0.43 |
| T3 sell after a down Monday | 2007-16 | 83 | -0.056 | -0.078 | +0.001 | -0.76 | 0.01 | 0.39 |
| T3 sell after a down Monday | 2017-26 | 88 | -0.196 | -0.216 | -0.092 | -2.55 | -1.11 | 0.10 |

Baselines (net R a trade, every eligible week): 2007-16 buy +0.015 / sell -0.079 (514 weeks); 2017-26 buy +0.079 / sell -0.124
(500 weeks). Holm-adjusted p (out of sample, excess): T1 0.93, T2 0.93, T3 0.80. Median stop $28.28 in sample, $35.85 out of
sample. At 2x costs T1 nets -0.031R (in sample) and -0.101R (out of sample) a trade.

## Placebo
40 draws of 188 random out-of-sample weeks with the same buy / sell split: the real T1 excess t (-0.73) beats 12 of 40
(placebo t from -2.63 to +2.44). The real rule sits inside the noise.

## Reading
- The buy after an up Monday makes money (+0.071R net out of sample) only because buying gold any Tuesday did (+0.079R): its
  excess is -0.009R. The sell after a down Monday loses less than gold's drift alone in sample and more out of sample. Monday
  carries no measurable information about Tuesday to Friday beyond the drift.
- Pass checks: out-of-sample t >= 2 after Holm no; same sign in sample no; positive at 2x costs no; placebo 38 of 40 no.
- Not an edge, never a filter for the gold book. No variant (threshold, stop, exit) was tried and none should be.

To repeat: `node research/edge/gold-monday-tell/run.mjs` (reads `origin/council-data` through git, no network). Test:
`tests/gold-monday-tell.test.mjs`.
