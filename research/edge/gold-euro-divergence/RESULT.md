# Result: gold at a 20-day high in euros but not in dollars (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying (selling) gold after a 20-day high (low) in euros but not in dollars makes +0.103R a trade net out of sample 2017-26 (n 121, month t +1.38); it beats 39 of 40 placebos.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any trade result was computed). Paper research
only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here was compared with
or applied to that book; its 2006-17 positions were not read (owner decision 44). No live rule, size, filter, stop, config, cost
constant or council member changed. No proposal is written. This page is written by `run.mjs` from `result.json`.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json` and `xaueur.json` at commit `1a92be24` (gold 2006-03-20 to 2026-11-13), weekends folded into Monday with `council/fills.mjs` `foldWeekend`.
- Signal: XAU/EUR closes above (below) the highest (lowest) close of the 20 matched days before it while XAU/USD does not:
  long (short) XAU/USD at the next daily open. Signal days: in sample 134 long + 98 short, out of sample 128 + 83.
- Trade: stop k x ATR(20) of the 20 gold candles before the entry (1R), gaps through the stop fill at the open, one position at
  a time per test. Costs $0.60 a round trip plus financing on buys, `nights()` x `FIN.xau.long` x entry (today's demo rate for every year).
- Baseline: the same trade entered after every eligible day of the same calendar year, same side; excess = net R minus that mean.
- t on calendar-month sums of net R (empty months 0), Holm over T1-T3 on the one-sided OOS p; 40 seeded placebos per test.

## Results

| Test | Window | n | gross R | net R | net at 2x | month t (gross) | month t (net) | excess R | excess t | stops |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 2007-16 | 147 | +0.061 | +0.027 | −0.008 | +0.94 | +0.41 | +0.040 | +0.63 | 28 |
| T1 | 2017-26 | 121 | +0.144 | +0.103 | +0.062 | +1.89 | +1.38 | +0.078 | +1.13 | 16 |
| T2 | 2007-16 | 84 | +0.095 | +0.048 | +0.001 | +1.27 | +0.64 | +0.032 | +0.45 | 15 |
| T2 | 2017-26 | 77 | +0.236 | +0.181 | +0.125 | +2.14 | +1.69 | +0.084 | +0.87 | 11 |
| T3 | 2007-16 | 117 | +0.065 | +0.031 | −0.003 | +0.96 | +0.46 | +0.033 | +0.49 | 18 |
| T3 | 2017-26 | 97 | +0.146 | +0.101 | +0.055 | +1.62 | +1.14 | +0.082 | +0.99 | 14 |

| Test | what | OOS p | Holm p | placebo beaten | placebo median t | pass |
|---|---|---|---|---|---|---|
| T1 | both sides, hold 5 candles, stop 2 x ATR(20) (primary) | 0.0838 | 0.168 | 39 of 40 | +0.00 | no |
| T2 | long signals only, hold 5 candles, stop 2 x ATR(20) | 0.0455 | 0.137 | 32 of 40 | +0.97 | no |
| T3 | both sides, hold 10 candles, stop 3 x ATR(20) | 0.127 | 0.168 | 38 of 40 | +0.16 | no |

## By side (reported, not judged)

| Test | Window | side | n | gross R | net R | baseline net R (every day) |
|---|---|---|---|---|---|---|
| T1 | 2007-16 | long | 84 | +0.095 | +0.048 | +0.000 |
| T1 | 2007-16 | short | 63 | +0.015 | −0.002 | −0.065 |
| T1 | 2017-26 | long | 77 | +0.236 | +0.181 | +0.063 |
| T1 | 2017-26 | short | 44 | −0.016 | −0.033 | −0.108 |
| T2 | 2007-16 | long | 84 | +0.095 | +0.048 | +0.000 |
| T2 | 2017-26 | long | 77 | +0.236 | +0.181 | +0.063 |
| T3 | 2007-16 | long | 67 | +0.122 | +0.071 | +0.012 |
| T3 | 2007-16 | short | 50 | −0.011 | −0.022 | −0.072 |
| T3 | 2017-26 | long | 60 | +0.276 | +0.210 | +0.069 |
| T3 | 2017-26 | short | 37 | −0.066 | −0.077 | −0.134 |

Median risk (1R) per T1 trade: $37.05 in sample, $45.46 out of sample; mean cost 0.034R / 0.041R.

## Reading

The divergence of gold in euros and gold in dollars at a 20-day extreme does not lead XAU/USD by enough to trade on the pre-registered bar. Not an edge; never use it as a filter, gate or size step. No re-run with other look-backs, holds or stops (any such look would be post hoc).

## To repeat

`node research/edge/gold-euro-divergence/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-euro-divergence/run.mjs full <dir>`; delete `<dir>` afterwards. Tests: `tests/gold-euro-divergence.test.mjs`.
