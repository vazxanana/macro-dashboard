# Result: premium / discount of the 20-day dealing range on spot gold (14 Nov 2026)

**Verdict: FAIL: 0 of 3 tests pass; buying the bottom quarter of the 20-day range made +0.009R a trade net in 2017-26 (n 138, month t 0.14) and lost to 40 of 40 random buy-day placebos.**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit dfcf1f701). The test ran once; nothing was changed after the
result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged on
2017-26; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf) and says nothing about it.

Rule: the dealing range = the highest high and lowest low of the last 20 trading days, today included (OANDA mid daily XAU_USD,
council-data `research/daily/xau.json`, weekends folded by `council/fills.mjs` `foldWeekend`; 2006-03-20 to 2026-11-06, 5,364
trading days). Position = (close - low20) / (high20 - low20). Entry at the next open, stop 1.5 x ATR(14), target the range's
50 % (equilibrium, fixed at the signal) when it is on the winning side, else out after 10 days; stop first when both fall in one
day; one position at a time. T1 buy when position < 0.25; T2 sell when position > 0.75; T3 T1 only with the close above its
100-day mean. Costs: $0.60 a round trip and `FIN.xau.long` financing on buys. t = calendar-month sums of net R, Holm over three.

## The three tests (R a trade; IS 2008-16, OOS 2017 to 2026-10, by entry date)

| test | IS n | IS gross | IS net | IS t | OOS n | OOS gross | OOS net | OOS t | Holm p | OOS 2x costs | 2017-21 | 2022-26 | placebo beaten | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 147 | +0.007 | -0.055 | -0.66 | 138 | +0.080 | +0.009 | 0.14 | 0.8856 | -0.061 | -0.059 | +0.086 | 0 of 40 | no |
| T2 | 170 | -0.074 | -0.096 | -1.10 | 224 | -0.200 | -0.220 | -2.66 | 0.9961 | -0.239 | -0.203 | -0.236 | 1 of 40 | no |
| T3 | 42 | +0.013 | -0.048 | -0.33 | 56 | +0.159 | +0.097 | 0.87 | 0.576 | +0.035 | -0.160 | +0.320 | 4 of 40 | no |

Gross month t out of sample: T1 1.28, T2 -2.46, T3 1.40 (in sample 0.08, -0.87, 0.09).

- **T1, buy in discount**: flat after costs out of sample (+1.27R over 138 trades; costs 2.64R, financing 7.09R) and negative in
  sample. It is worse than buying on any day: the buy-every-day baseline with the same exit made +0.078R a trade net OOS (n 419,
  t 1.49), T1 minus baseline -0.069R (Welch t -0.70). The placebo of random buy days at T1's frequency (20 % of OOS days) had a
  median of +0.116R and a maximum of +0.197R; T1 beat none of them. Gold rose over 2017-26, so buying anywhere with a 10-day
  hold did better than buying the bottom of its range.
- **T2, sell in premium**: loses in both windows (-0.220R a trade OOS, month t -2.66; -0.096R in sample) and in 2017-21 and
  2022-26 alike; 125 of 224 OOS trades stopped out. Selling the top of the range is selling into gold's trend; the sell-every-day
  baseline lost -0.167R a trade OOS too, so T2 is that drift plus a little more (-0.052R, Welch t -0.63).
- **T3, buy in discount with the 100-day trend up**: +0.097R a trade OOS (n 56, month t 0.87, Holm p 0.58), all of it in
  2022-26 (+0.320R) after a loss in 2017-21 (-0.160R) and in sample (-0.048R). It survives 2x costs (+0.035R) but beat only 4 of
  the 40 placebos (random up-trend buy days at the same 10 % frequency: median +0.201R, maximum +0.380R).

The place of the close in the 20-day range adds nothing over the day it is taken on: in every test the random days of the same
side and frequency did as well or better. Not an edge, not a filter for anything; no proposal.

## Baselines (same exit code, one position at a time)

| baseline | IS n | IS net | IS t | OOS n | OOS gross | OOS net | OOS t |
|---|---|---|---|---|---|---|---|
| buy every day | 410 | -0.037 | -0.71 | 419 | +0.156 | +0.078 | 1.49 |
| sell every day | 432 | -0.035 | -0.64 | 473 | -0.149 | -0.167 | -3.49 |

## Exits out of sample

| test | target (50 %) | stop | gap through stop | 10 days |
|---|---|---|---|---|
| T1 | 56 | 52 | 0 | 30 |
| T2 | 61 | 125 | 1 | 37 |
| T3 | 28 | 18 | 0 | 10 |

## Not tested here
Other range lengths, other thresholds, other exits (to the far side of the range), intraday entries, other markets. Any of these
would be a new rule chosen after this result and needs its own pre-registration on other data. To repeat:
`node research/edge/gold-premium-discount/run.mjs fetch <dir>` (git show from `origin/council-data`, no network, cache kept out
of git), then `node research/edge/gold-premium-discount/run.mjs full <dir>`. Tests: `tests/gold-premium-discount.test.mjs`.
