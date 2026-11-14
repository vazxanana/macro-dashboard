# Result: gold at a 20-day high in most other currencies but not in dollars (14 Nov 2026)

**Verdict: FAIL, 0 of 3: gold at a 20-day high (low) in 2 of 5 other currencies but not in dollars makes +0.066R a trade net 2017-26 (n 183, month t +1.11, Holm p 0.4); beats 29 of 40 placebos, 36 of 40 controls.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any trade result was computed). Paper research
only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here was compared with
or applied to that book; its 2006-17 positions were not read (owner decision 44). No live rule, size, filter, stop, config, cost
constant or council member changed. No proposal is written. This page is written by `run.mjs` from `result.json`.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/` `xau`, `eurusd`, `gbpusd`, `usdjpy`, `usdchf`, `audusd` at commit `f2370a08` (gold 2006-03-20 to 2026-11-13; 5368 common days), weekends folded into Monday with `council/fills.mjs` `foldWeekend`.
- Gold in EUR, GBP, AUD = gold / the pair; in JPY, CHF = gold x the pair. Signal: at least `need` of the five close above (below) the
  highest (lowest) close of their 20 common days before while XAU/USD does not: long (short) XAU/USD at the next daily open.
- Trade: stop k x ATR(20) of the 20 gold candles before the entry (1R), gaps through the stop fill at the open, one position at
  a time per test. Costs $0.60 a round trip plus financing on buys, `nights()` x `FIN.xau.long` x entry (today's demo rate for every year).
- Baseline: the same trade entered after every eligible day of the same calendar year, same side; excess = net R minus that mean.
- t on calendar-month sums of net R (empty months 0), Holm over T1-T3 on the one-sided OOS p.
- Placebo (40 seeds): each out-of-sample signal day moved to a random day of the same year, same side. Control (40 seeds):
  each pair shifted in time by its own random offset of at least 250 common days, signals rebuilt; the pairs keep their drift and
  volatility, gold is untouched, the timing link between the currencies and gold is gone.

## Results

| Test | Window | signal days | n | gross R | net R | net at 2x | month t (gross) | month t (net) | excess R | excess t | stops |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 2007-16 | 306 | 187 | +0.031 | −0.003 | −0.038 | +0.56 | −0.06 | +0.021 | +0.37 | 35 |
| T1 | 2017-26 | 321 | 183 | +0.108 | +0.066 | +0.023 | +1.80 | +1.11 | +0.057 | +1.05 | 25 |
| T2 | 2007-16 | 143 | 116 | +0.079 | +0.051 | +0.023 | +1.08 | +0.70 | +0.060 | +0.82 | 9 |
| T2 | 2017-26 | 132 | 100 | +0.092 | +0.060 | +0.029 | +1.39 | +0.92 | +0.047 | +0.75 | 6 |
| T3 | 2007-16 | 306 | 224 | +0.057 | +0.028 | +0.000 | +1.30 | +0.65 | +0.044 | +1.00 | 18 |
| T3 | 2017-26 | 321 | 226 | +0.082 | +0.050 | +0.019 | +1.80 | +1.11 | +0.052 | +1.21 | 14 |

| Test | what | OOS p | Holm p | placebo beaten (median t) | control beaten (median t) | pass |
|---|---|---|---|---|---|---|
| T1 | 2 of 5 currencies, both sides, hold 5 candles, stop 2 x ATR(20) (primary) | 0.133 | 0.4 | 29 of 40 (+0.32) | 36 of 40 (+0.44) | no |
| T2 | 3 of 5 currencies, both sides, hold 3 candles, stop 2 x ATR(20) | 0.179 | 0.4 | 35 of 40 (+0.23) | 37 of 40 (−0.03) | no |
| T3 | 2 of 5 currencies, both sides, hold 3 candles, stop 2 x ATR(20) | 0.133 | 0.4 | 32 of 40 (+0.08) | 36 of 40 (+0.05) | no |

## By side (reported, not judged)

| Test | Window | side | n | gross R | net R | excess R | baseline net R (every day) |
|---|---|---|---|---|---|---|---|
| T1 | 2007-16 | long | 105 | −0.001 | −0.049 | −0.053 | −0.001 |
| T1 | 2007-16 | short | 82 | +0.072 | +0.056 | +0.114 | −0.065 |
| T1 | 2017-26 | long | 116 | +0.201 | +0.143 | +0.075 | +0.063 |
| T1 | 2017-26 | short | 67 | −0.053 | −0.069 | +0.027 | −0.109 |
| T2 | 2007-16 | long | 64 | +0.059 | +0.022 | +0.014 | −0.008 |
| T2 | 2007-16 | short | 52 | +0.102 | +0.086 | +0.115 | −0.040 |
| T2 | 2017-26 | long | 67 | +0.146 | +0.106 | +0.053 | +0.033 |
| T2 | 2017-26 | short | 33 | −0.017 | −0.033 | +0.037 | −0.075 |
| T3 | 2007-16 | long | 130 | +0.021 | −0.017 | −0.012 | −0.008 |
| T3 | 2007-16 | short | 94 | +0.108 | +0.091 | +0.121 | −0.040 |
| T3 | 2017-26 | long | 143 | +0.157 | +0.116 | +0.079 | +0.033 |
| T3 | 2017-26 | short | 83 | −0.046 | −0.062 | +0.006 | −0.075 |

Median risk (1R) per T1 trade: $37.41 in sample, $45.46 out of sample; mean cost 0.035R / 0.042R.

## Reading

Gold reaching a 20-day extreme in most other currencies while it does not in dollars does not lead XAU/USD by enough to trade on the pre-registered bar. Not an edge; never use it as a filter, gate or size step. No re-run with other counts, look-backs, holds or stops (any such look would be post hoc).

## To repeat

`node research/edge/gold-fx-high-count/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-fx-high-count/run.mjs full <dir>`; delete `<dir>` afterwards. Tests: `tests/gold-fx-high-count.test.mjs`.
