# Result: buying gold after a large Nikkei 225 down day (14 Nov 2026)

**Verdict: FAIL, 0 of 3: a gold buy after a Nikkei day in its worst 10 % made +0.099R a trade over the same-year any-day buy 2017-26 (n 179, month t 1.80, Holm p 0.11).**

Pre-registered in `PREREGISTRATION.md` (committed and pushed alone before any return was computed; only event counts were
read first). Paper research only: a stand-alone gold rule, never a gate, entry, exit or size of the live gold book, and the
book's 2006-17 positions were not used (owner decision 44). Nothing live changed and no proposal is written.

## The rule and the data

- OANDA mid daily candles (UTC) from council-data `research/daily/xau.json` and `jp225.json` at commit `d5a081937`, weekends
  folded into Monday (`foldWeekend`). Gold 2006-03 to 2026-11.
- Drop day: the Nikkei 225's one-day log return at or below the q-quantile of its 250 previous daily returns.
- Trade: buy gold at the next gold candle's open, stop 2 x ATR(20) below, out at the close of the H-th candle or at the
  stop, one at a time. Costs $0.60 a round trip plus `nights` x `FIN.xau.long` x entry.
- Baseline: the same buy after every eligible day (overlap allowed); excess = a trade's net R minus the baseline's mean net
  R over the days of the same calendar year. "Base net" below is the baseline's mean over the whole window, for reference.

## Results

| Test | window | drop days | n | gross R | net R | base net | excess | month t | excess x2 costs |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 2007-16 | 262 | 165 | +0.114 | +0.068 | -0.002 | +0.079 | 1.32 | +0.081 |
| T1 | 2017-26 | 266 | 179 | +0.194 | +0.145 | +0.063 | +0.099 | 1.80 | +0.099 |
| T2 | 2007-16 | 149 | 119 | +0.003 | -0.031 | -0.009 | -0.016 | -0.32 | -0.014 |
| T2 | 2017-26 | 147 | 126 | +0.063 | +0.027 | +0.033 | +0.009 | 0.14 | +0.010 |
| T3 | 2007-16 | 393 | 169 | +0.191 | +0.119 | +0.014 | +0.108 | 1.47 | +0.108 |
| T3 | 2017-26 | 405 | 175 | +0.244 | +0.160 | +0.113 | +0.067 | 0.89 | +0.066 |

T1 = worst 10 %, held 5 candles (primary); T2 = worst 5 %, 3 candles; T3 = worst 15 %, 10 candles. Excess gross of costs is
within 0.002R of the net excess in every row: costs are charged alike on the signal and the baseline trades.

| Test | Holm p | placebo (real month t above) | checks failed |
|---|---|---|---|
| T1 | 0.108 | 40 of 40 | OOS t under 2, Holm p over 0.05 |
| T2 | 0.444 | 25 of 40 | OOS t, Holm, in-sample excess negative, placebo |
| T3 | 0.373 | 35 of 40 | OOS t, Holm, placebo |

## Reading

- The primary test has the right sign in both windows (+0.079R and +0.099R a trade over the year's any-day buy), survives
  twice the costs and beats all 40 placebos, but its month t is 1.32 and 1.80: under the bar of 2, Holm p 0.11. A near miss,
  not an edge.
- There is no dose response: the deepest drops (T2, worst 5 %) show nothing (-0.016R / +0.009R), which is the opposite of
  what a haven flow after the largest Nikkei falls would give. T3 is positive in both windows but weaker out of sample
  (t 0.89).
- Not re-tested on these years: the result cannot be confirmed on 2007-26 again. A replication would need data outside these
  windows (gold before 2007 is only March 2006 on OANDA) or a forward record, with its own pre-registration.
- Nothing in this study is a gate, filter, size or exit for the live gold systems.

To repeat: `node research/edge/gold-nikkei-drop/run.mjs fetch <dir>` (git show, no network), then `… full <dir>`.
Tests: `tests/gold-nikkei-drop.test.mjs`.
