# The earlier scalp method in its 12-16 UTC window at 1R to 6R, on 2010-2019: result (23 Nov 2026)

**Verdict: FAIL. 6R at 12-16 UTC lost -0.124R a trade before costs on 2010-2019 (n 1943, month t -1.07 / -2.79), and 6R did worse than 1R on the same entries.**

Paper research only; nothing live changed. The reading, the data, the three tests, Holm and the placebo were fixed in
`PREREGISTRATION.md` (commit 99446db) before any trade was simulated.

## What was tested

The MSNR desk's own reading of the earlier scalp method (`council/edge-desks.mjs` `msnrTrades`, imported, not edited: the
direction call on H4 with the Daily key levels, a 15-minute then 5-minute engulf with the two-candle check, market at the next
5-minute open, stop past the trigger pair, the desk's 5-day limit), on OANDA mid 5-minute candles of gold, EUR/USD, GBP/USD,
USD/JPY and AUD/USD, entries 2010-2019 (2009 warm-up), with targets 1R to 6R. Each target is its own stream with the desk's
one-position rule. `msnr-entry` (11 Nov 2026) had already read gold 2007-19 with the study's own entry at 1.5R and 12 hours
(FAIL); new here are the desk's version of the entry, four more markets, the targets and the window split.

Checks: the copy of the desk's simulation used for the paired 1R re-run equals the desk's R on all 9,348 6R trades (gate 0
mismatches); the cut test (gold, cut 30 Jun 2013) gives the same 509 closed trades as the uncut file; every trade has its stop
on the losing side.

## The three tests (before costs; Holm over three)

| Test | 2010-14: n, R a trade, month t | 2015-19: n, R a trade, month t | Holm p | Pass |
|---|---|---|---|---|
| T1: 6R, 12-16 UTC | 1,030, -0.074R, -1.07 | 913, -0.181R, -2.79 | 1 | no |
| T2: 6R minus 1R, same entries | 1,030, -0.081R, -1.27 | 913, -0.134R, -2.31 | 1 | no |
| T3: 6R, other hours (control) | 3,953, -0.141R, -3.33 | 3,452, -0.064R, -1.31 | 1 | no |

Placebo (entries against the call, 6R, 12-16 UTC): -0.009R (n 1,014) and +0.033R (n 953), both above the real stream: the
call did not pick the better side. After costs (round trips of `combo-grid-2` `COSTS`): T1 -0.227R a trade (month t -4.71),
T3 -0.237R. The desk's own mix (6R in the window, 3R at other hours): -0.141R (n 2,005) and -0.112R (n 7,725) before costs.

## Per target, pooled (before costs; R a trade, n, month t 2010-14 / 2015-19; after costs)

| Target | 12-16 UTC | Other hours |
|---|---|---|
| 1R | -0.024 (2,171; -0.17 / -1.59); -0.127 | -0.084 (8,458; -5.21 / -4.87); -0.216 |
| 2R | -0.059 (2,087; -0.51 / -2.38); -0.162 | -0.113 (8,087; -5.43 / -3.71); -0.244 |
| 3R | -0.065 (2,043; 0.14 / -3.06); -0.168 | -0.115 (7,857; -5.47 / -1.99); -0.247 |
| 4R | -0.076 (1,998; 0.28 / -3.26); -0.179 | -0.103 (7,688; -4.13 / -1.57); -0.235 |
| 5R | -0.086 (1,965; -0.35 / -2.60); -0.190 | -0.107 (7,533; -3.63 / -1.56); -0.239 |
| 6R | -0.124 (1,943; -1.07 / -2.79); -0.227 | -0.105 (7,405; -3.33 / -1.31); -0.237 |

## Per market, 12-16 UTC, before costs (R a trade, 2010-2019)

| Market | 1R | 2R | 3R | 4R | 5R | 6R |
|---|---|---|---|---|---|---|
| xau | -0.013 | -0.022 | -0.131 | -0.112 | -0.105 | -0.068 |
| eurusd | -0.115 | -0.122 | -0.076 | -0.086 | -0.068 | -0.100 |
| gbpusd | -0.006 | -0.095 | -0.120 | -0.110 | -0.123 | -0.191 |
| usdjpy | +0.036 | -0.050 | +0.008 | -0.076 | -0.056 | -0.074 |
| audusd | -0.012 | +0.010 | +0.002 | +0.010 | -0.076 | -0.174 |

## Reading

The 2026 pattern (the window's result rising with the target) is the opposite on 2010-2019: in the 12-16 UTC window the
result FALLS as the target grows (-0.024R at 1R to -0.124R at 6R), and no target or market is positive with any weight. Before
costs the reading sits slightly below zero; costs take about 0.10R a trade more. The 2026 rise was one year's luck among the
readings looked at. Do not test other targets, windows or markets of this reading on these years. The desk's 6R target in the
window stays a paper choice with no support here.

To repeat: `node --use-env-proxy research/edge/_lib/fetch-cache.mjs <m> 5m 2009 2019` for the five markets (EDGE_DATA set),
then `node research/edge/msnr-main-6r/run.mjs market <m> <dir>` for each, `… report <dir>`, `… cut`.
Test: `tests/msnr-main-6r.test.mjs`.
