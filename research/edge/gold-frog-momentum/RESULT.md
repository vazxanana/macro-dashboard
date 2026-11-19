# Result: gold's 60-day trend made of many small days, not a few jumps (14 Nov 2026)

**Verdict: FAIL, 0 of 2: trading gold's 60-day trend only after a steady run of same-way days made +0.151R a trade net in 2017-26 (n 96, month t 1.04, Holm p 0.30); 36 of 40 placebos beaten.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any candle was read). Paper research only, a
**stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here was compared with or
applied to that book; its 2006-17 window and positions were not used (owner decision 44). No live rule, size, filter, stop,
config, cost constant or council member changed. No proposal is written.

## What was tested

- Data: OANDA mid daily XAU/USD (UTC), council-data `research/daily/xau.json` at commit `3d5c953d9`, weekends folded into
  Monday with `council/fills.mjs` `foldWeekend`; 5,364 candles, 2006-03-20 to 2026-11-06.
- On the last candle of each ISO week: R60 = the 60-candle return; ID = sign(R60) x (share of the 60 days against the move -
  share with it). **Continuous** (C) when ID <= -0.10, else **discrete** (D); B = every signal. Half the signals (50.4 %) were
  continuous.
- Trade: the next open the way R60 points, stop 2 x ATR(20) (1R; median $37 in sample, $48 out of sample), out at the close of
  the 20th candle; one position at a time per stream. $0.60 a round trip plus `nights` x `FIN.xau.long` x entry on buys.
- T1 (primary) stream C both sides, month t on calendar-month sums of net R; T2 C minus D, Welch t on trades; Holm over both.
  Placebo: random continuous labels at the sample's 50.4 % share, 40 seeds.

## The tests (R a trade)

| Test | Window | n (buys / sells) | gross | net | net at 2x costs | t net (gross) | Holm p | placebo beaten | pass |
|---|---|---|---|---|---|---|---|---|---|
| T1 continuous, both sides | 2007-16 | 98 | +0.145 | +0.060 | -0.025 | 0.51 (1.10) | | | |
| T1 continuous, both sides | 2017-26 | 96 (79 / 17) | +0.265 | +0.151 | +0.036 | 1.04 (1.79) | 0.30 | 36 / 40 | no |
| T2 continuous minus discrete | 2007-16 | 98 vs 97 | | +0.074 | | 0.38 (Welch) | | | |
| T2 continuous minus discrete | 2017-26 | 96 vs 96 | | +0.144 | | 0.73 (Welch) | 0.30 | | no |

T1 fails on the month t (1.04 against 2), the Holm p and the placebo (36 of 40 against 38). T2 has the expected sign in both
windows but a Welch t under 1: the continuous moves did better than the discrete ones by an amount the sample cannot tell
from noise.

## Baseline comparison (the same trades without the condition)

| Stream | Window | n | gross | net | t net (gross) |
|---|---|---|---|---|---|
| C continuous | 2007-16 | 98 | +0.145 | +0.060 | 0.51 (1.10) |
| D discrete | 2007-16 | 97 | +0.051 | -0.014 | -0.07 (0.39) |
| B every signal | 2007-16 | 164 | +0.078 | +0.005 | 0.07 (0.77) |
| C continuous | 2017-26 | 96 | +0.265 | +0.151 | 1.04 (1.79) |
| D discrete | 2017-26 | 96 | +0.090 | +0.007 | 0.05 (0.66) |
| B every signal | 2017-26 | 164 | +0.154 | +0.061 | 0.54 (1.35) |

Out of sample, the baseline's buys made +0.228R net (n 107, t 1.61) and its sells -0.253R (n 57, t -1.57): the plain 60-day
rule out of sample is gold's 2017-26 rise. C's buys made +0.178R (n 79), its sells +0.024R (n 17): the condition mostly
removes losing sells, which is where its edge over B comes from, and 17 sells are too few to read.

## Costs

C out of sample: 0.115R a trade of costs, **43 % of the gross** (buys 0.137R, sells 0.014R: almost all of it is overnight
financing on buys held up to 20 candles; the $0.60 spread is about 0.01R at a $48 stop). At twice the costs C is +0.036R
out of sample and -0.025R in sample.

## Context, not tested

- ID cut -0.20: 43 trades out of sample, +0.259R net, t 1.04. ID cut 0.00: 137 trades, +0.127R, t 1.02. No cut was chosen
  after the fact; none reaches t 2.
- Year by year (C, net R): positive in 2007, 2009, 2011-13, 2018-20, 2024-25; the 2024-25 run (+18.9R) is most of the
  out-of-sample total (+14.5R).
- Placebo OOS mean net R per trade: median about +0.07R, range -0.05 to +0.36R.

## What this means

No edge. The discreteness condition points the right way in both windows, as the published idea says, but on one market
the difference is within noise (Welch t 0.38 and 0.73), and what the stream earns out of sample is mostly gold's rise held
long, with financing taking 43 % of it. Not a rule, not a filter, not a proposal.

To repeat: `node research/edge/gold-frog-momentum/run.mjs` (reads council-data with `git show`, no network). Test:
`tests/gold-frog-momentum.test.mjs`.
