# Result: gold after a haven day in Australian-dollar terms (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold after a day it rose while the Australian dollar fell makes +0.065R a trade net out of sample 2017-26 (n 103, month t +0.95), excess −0.019R over the year's buy.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any trade result was computed). Paper research
only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here was compared with
or applied to that book; its 2006-17 positions were not read (owner decision 44). No live rule, size, filter, stop, config, cost
constant or council member changed. No proposal is written. This page is written by `run.mjs` from `result.json`.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json` and `audusd.json` at commit `63b761c8` (gold 2006-03-20 to 2026-11-13), weekends folded into Monday with `council/fills.mjs` `foldWeekend`.
- Signal (haven day): gold's daily log return >= z_g x sd AND AUD/USD's <= -z_a x sd, sd of the 60 matched daily returns before
  the day; buy XAU/USD at the next daily open (long only). Haven days with z 0.5 / 0.5: 115 in sample, 133 out of sample; with z 1.0 / 0.5: 62 and 60.
  (The pre-registration counted 134 out-of-sample haven days through November 2026; the window ends 31 Oct 2026.)
- Trade: stop k x ATR(20) of the 20 gold candles before the entry (1R), gaps through the stop fill at the open, one position at
  a time per test. Costs $0.60 a round trip plus financing on buys, `nights()` x `FIN.xau.long` x entry (today's demo rate for every year).
- Baseline: the same trade entered after every eligible day of the same calendar year, same side; excess = net R minus that mean.
- t on calendar-month sums of net R (empty months 0), Holm over T1-T3 on the one-sided OOS p; 40 seeded placebos per test.

## Results

| Test | Window | n | gross R | net R | net at 2x | month t (gross) | month t (net) | excess R | excess t | stops |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 2007-16 | 88 | +0.068 | +0.020 | −0.027 | +0.80 | +0.24 | +0.020 | +0.23 | 16 |
| T1 | 2017-26 | 103 | +0.121 | +0.065 | +0.010 | +1.73 | +0.95 | −0.019 | −0.30 | 18 |
| T2 | 2007-16 | 72 | +0.068 | +0.014 | −0.039 | +0.72 | +0.15 | +0.010 | +0.11 | 13 |
| T2 | 2017-26 | 86 | +0.116 | +0.053 | −0.010 | +1.31 | +0.61 | −0.040 | −0.48 | 12 |
| T3 | 2007-16 | 49 | +0.122 | +0.077 | +0.031 | +0.96 | +0.61 | +0.052 | +0.42 | 10 |
| T3 | 2017-26 | 50 | +0.140 | +0.087 | +0.035 | +1.16 | +0.74 | −0.018 | −0.16 | 9 |

| Test | what | OOS p | Holm p | placebo beaten | placebo median t | pass |
|---|---|---|---|---|---|---|
| T1 | z 0.5 / 0.5, hold 5 candles, stop 2 x ATR(20) (primary) | 0.171 | 0.513 | 24 of 40 | +0.88 | no |
| T2 | z 0.5 / 0.5, hold 10 candles, stop 3 x ATR(20) | 0.271 | 0.513 | 14 of 40 | +0.90 | no |
| T3 | z 1.0 / 0.5, hold 5 candles, stop 2 x ATR(20) | 0.23 | 0.513 | 24 of 40 | +0.48 | no |

## Against the baseline (the same buy after every day of the year)

| Test | Window | side | n | gross R | net R | baseline net R a trade |
|---|---|---|---|---|---|---|
| T1 | 2007-16 | long | 88 | +0.068 | +0.020 | −0.001 |
| T1 | 2017-26 | long | 103 | +0.121 | +0.065 | +0.063 |
| T2 | 2007-16 | long | 72 | +0.068 | +0.014 | +0.012 |
| T2 | 2017-26 | long | 86 | +0.116 | +0.053 | +0.070 |
| T3 | 2007-16 | long | 49 | +0.122 | +0.077 | −0.001 |
| T3 | 2017-26 | long | 50 | +0.140 | +0.087 | +0.063 |

Median risk (1R) per T1 trade: $38.7 in sample, $44.93 out of sample; mean cost 0.047R / 0.055R.

## Reading

A day on which gold rises while the Australian dollar falls does not lead XAU/USD by enough to trade on the pre-registered bar. Not an edge; never use it as a filter, gate or size step. No re-run with other thresholds, holds or stops (any such look would be post hoc).

## To repeat

`node research/edge/gold-aud-haven-day/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-aud-haven-day/run.mjs full <dir>`; delete `<dir>` afterwards. Tests: `tests/gold-aud-haven-day.test.mjs`.
