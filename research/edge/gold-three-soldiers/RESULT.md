# Result: gold after three strong daily candles one way (three white soldiers / three black crows) (14 Nov 2026)

**Verdict: FAIL: 0 of 3 tests pass; following three soldiers / crows for 10 days made +0.122R a trade net in 2017-26 (n 32, month t 0.58), no better than the same-side baseline.**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit e2d413acf). The test ran once; nothing was changed after the
result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged on
2017-26; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf), does not use its 2006-17
positions and says nothing about it.

## Data and rule
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show`, no network), 2006-03-20 to 2026-11-06, weekend
candles folded into the next weekday (`council/fills.mjs` `foldWeekend`): 5,364 trading days. A strong up day = close above
open by at least `body` of the day's range and above the previous close; three in a row = three white soldiers (crows the
mirror). Entry at the next day's open, stop 2 x ATR(20) (days ending at the signal day) on the losing side, gap fills at the
open, out at the close of the last day held; one position at a time per test. Costs: $0.60 a round trip and `FIN.xau.long`
financing on buys (`nights` x 0.000148 of price); sells pay nothing. t = calendar-month sums of net R by entry month (every
month counts), one-sided, Holm over three. Placebo: the same OOS trade days and holds with the side drawn at random, 40 seeds.

## Tests (R a trade; IS 2007-16, OOS 2017-01 to 2026-10)
| Test | IS n | IS gross | IS net | IS month t | OOS n | OOS gross | OOS net | OOS month t | Holm p | OOS 2x costs | OOS 2017-21 | OOS 2022-26 | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 body >= 0.5, continuation, 10 days (primary) | 39 | +0.236 | +0.186 | 1.26 | 32 | +0.190 | +0.122 | 0.58 | 0.843 | +0.053 | +0.208 | +0.011 | 35 of 40 | no |
| T2 body >= 0.5, fade, 5 days | 45 | +0.002 | -0.026 | -0.22 | 33 | -0.078 | -0.106 | -0.83 | 0.9366 | -0.133 | -0.051 | -0.179 | 7 of 40 | no |
| T3 body >= 0.3, continuation, 10 days | 98 | +0.189 | +0.136 | 1.32 | 96 | +0.069 | +0.009 | 0.08 | 0.9366 | -0.051 | -0.003 | +0.021 | 35 of 40 | no |

Gross OOS month t: T1 0.89, T2 -0.61, T3 0.61. Signals 2006-26: 93 at body >= 0.5 (57 soldiers, 36 crows), 347 at body >= 0.3
(219 / 128); one position at a time leaves the trades above. Median OOS stop $45.10 (T1), $41.59 (T2), $49.35 (T3): the round
trip is about 0.016R; financing on T1's OOS buys took 1.69R of its 6.08R gross.

## Against the unconditional same-side baseline (OOS)
| Test | Buys n / net | Sells n / net | Baseline (same mix) | Difference | Welch t |
|---|---|---|---|---|---|
| T1 | 22 / +0.294 | 10 / -0.259 | +0.011 (buy every day +0.097, sell -0.177) | +0.110 | 0.50 |
| T2 | 10 / -0.050 | 23 / -0.130 | -0.068 (buy +0.045, sell -0.118) | -0.037 | -0.26 |
| T3 | 58 / +0.217 | 38 / -0.309 | -0.011 (buy +0.097, sell -0.177) | +0.020 | 0.18 |

## Reading
- **Nothing here is an edge.** The primary T1 is positive net in sample and out of sample and at 2x costs, but with 32 OOS
  trades its month t is 0.58 (needs 2, Holm p 0.843) and it beats 35 of 40 random-side draws (needs 38). The power was known
  to be low before the run (the pre-registration said about +0.3R a trade would be needed); the observed +0.12R is far short.
- What the continuation tests earn is gold's rise: the buys after three soldiers make +0.29R (T1) and +0.22R (T3), the sells
  after three crows lose -0.26R and -0.31R, about what buying or selling on ANY day with the same hold and stop does (+0.10R /
  -0.18R). Against that same-side baseline the pattern adds +0.11R (Welch t 0.50) and +0.02R (t 0.18): noise.
- Fading the pattern (T2) loses in both windows. The looser body (T3) gives three times the trades and nothing out of sample.
- Not tested, and not to be inferred from this: intraday versions, other markets, a long-only soldiers rule (it would be a
  same-side reading of gold's trend, which T1's buys already show is the baseline).

Files: `run.mjs` (`node research/edge/gold-three-soldiers/run.mjs fetch <dir>`, then `… full <dir>`), `result.json`,
`PREREGISTRATION.md`; test `tests/gold-three-soldiers.test.mjs`.
