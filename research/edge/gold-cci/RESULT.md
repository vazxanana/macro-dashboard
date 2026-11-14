# Result: the Commodity Channel Index on gold's daily chart (14 Nov 2026)

**Verdict: FAIL, 0 of 3: the primary both-sided CCI(20) trend rule makes +0.064R a trade out of sample (n 133, month t 0.45, Holm p 1.00), beats 26 of 40 placebos and loses at 2x costs.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any number was computed). OANDA mid gold daily candles,
council-data `research/daily/xau.json`, weekends folded with `council/fills.mjs` `foldWeekend`, March 2006 to 6 November
2026 (5,364 days). Every trade has a stop (2 x ATR(14) of the signal day, never moved; median $36-46); $0.60 a round trip
and overnight financing on buys at `FIN.xau.long`. In sample = entries 2007-16, out of sample = 2017 to 6 Nov 2026. A
stand-alone rule: not a gate, exit, entry or size of the gold book, and owner decision 44 is untouched. Nothing live
changed; no proposal.

| Test | Window | n | Win | R a trade, gross | R a trade, net | Total net | Worst DD | Month t | 2x costs |
|---|---|---|---|---|---|---|---|---|---|
| T1 Lambert trend, both sides (primary) | IS 2007-16 | 140 | 33 % | +0.113 | +0.046 | +6.4R | -8.6R | 0.37 | -0.022 |
| | OOS 2017-26 | 133 | 31 % | +0.148 | +0.064 | +8.5R | -9.8R | 0.45 | -0.020 |
| T2 Lambert trend, long only | IS 2007-16 | 72 | 33 % | +0.272 | +0.157 | +11.3R | -9.1R | 0.79 | +0.042 |
| | OOS 2017-26 | 72 | 33 % | +0.493 | +0.351 | +25.2R | -6.0R | 1.47 | +0.208 |
| T3 Retail fade, both sides | IS 2007-16 | 195 | 62 % | -0.019 | -0.051 | -9.9R | -13.1R | -1.05 | -0.082 |
| | OOS 2017-26 | 186 | 61 % | -0.002 | -0.033 | -6.1R | -13.5R | -0.55 | -0.064 |

Month t: net R summed by exit month over every calendar month of the window (IS 120, OOS 119 months).

## The pass bar, check by check

| Check | T1 (primary) | T2 | T3 |
|---|---|---|---|
| OOS net > 0, month t >= 2, Holm p < 0.05 | no (t 0.45, Holm p 1.00) | no (t 1.47, Holm p 0.43) | no (net -0.033R) |
| Positive IS and both OOS halves (2017-21, 2022-26) | no (2017-21 -0.036R, n 72) | yes (+0.157, +0.196, +0.533) | no |
| OOS net > 0 at 2x costs | no (-0.020) | yes (+0.208) | no |
| Beats >= 38 of 40 placebos | no (26; median +0.027R) | no (37; median +0.114R) | no (22; median -0.043R) |
| OOS n >= 30, median stop >= $10 | yes (133, $44.15) | yes (72, $43.28) | yes (186, $46.34) |

## Baseline: the unconditional same-side placebo

The placebo keeps each OOS trade's side, holding length and 2 x ATR stop and only moves its entry to a random OOS day
(40 seeds). It is the rule without the CCI timing.

- **T1**: rule +0.064R a trade against a placebo median of +0.027R: 0.04R of timing, inside the placebo spread (26 of 40).
- **T2**: rule +0.351R against +0.114R, 37 of 40 (one short of the bar); the long-only gain is mostly gold's rise over
  2017-26 (a random long held as long earns +0.11R net), and the t of 1.47 does not separate the rest from luck.
- **T3**: rule -0.033R against -0.043R: the fade is as good as a random entry, i.e. nothing.

The two sides of T1 out of sample: buys +0.351R a trade (n 72), sells -0.274R (n 61). The both-sided trend rule is a long
gold bet that the short side gives back; the conditional signal adds nothing a same-side random entry does not.

## Costs

T1 OOS: $0.60 a round trip is 0.015R a trade, financing on buys 0.069R a trade (averaged over all 133 trades); together
**57 % of the gross R** (cost share). T2: 0.015R + 0.128R, **29 % of gross**. T3: gross is negative, so the cost share is
not defined (0.014R + 0.017R a trade). Median holds: 11-13 days (trend), 4 days (fade). OOS exits of T1: 86 on the CCI
zero cross, 18 at the 30-day limit, 29 at the stop.

## What this means

CCI(20) at Lambert's +/-100 is not a gold rule: neither the trend entry nor the fade separates from its same-side random
baseline after costs, in sample or out of sample. T2's positive numbers are the long side of a rising market and do not
pass the placebo or the month t. Not an edge, no proposal; no live rule changes.

To repeat: `node research/edge/gold-cci/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-cci/run.mjs full <dir>`. Tests: `tests/gold-cci.test.mjs`.
