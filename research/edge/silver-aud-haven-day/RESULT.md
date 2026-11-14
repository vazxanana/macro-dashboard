# Result: silver after a haven day in Australian-dollar terms (14 Nov 2026)

**Verdict: FAIL, 0 of 3: silver after a day it rose while AUD/USD fell: +0.012R a trade net OOS 2017-26 (n 84, month t +0.14), excess −0.016R; under 100 events in sample.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any trade result was computed). A replication
of [gold-aud-haven-day](../gold-aud-haven-day/RESULT.md) (FAIL 0 of 3: +0.065R net OOS, n 103, t 0.95, excess −0.019R) on silver,
the rule unchanged except the market. Paper research only, a **stand-alone rule on silver**: not a gate, entry, exit or size of
the live gold book (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changed. No
proposal is written. This page is written by `run.mjs` from `result.json`.

**Too few events to judge, by the pre-registration**: 86 haven days in sample for T1 / T2 and 37 / 49 for T3, under the desk's
100 a window. Every figure below is descriptive only; no test could pass, whatever its t.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xag.json` and `audusd.json` at commit `001494dd` (silver 2006-03-20 to 2026-11-13), weekends folded into Monday with `council/fills.mjs` `foldWeekend`.
- Signal (haven day): silver's daily log return >= z_g x sd AND AUD/USD's <= -z_a x sd, sd of the 60 matched daily returns before
  the day; buy XAG/USD at the next daily open (long only). Haven days with z 0.5 / 0.5: 86 in sample, 103 out of sample; with z 1.0 / 0.5: 37 and 49.
- Trade: stop k x ATR(20) of the 20 silver candles before the entry (1R), gaps through the stop fill at the open, one position at
  a time per test. Costs $0.06 a round trip (silver-rates-shrug's). **No financing**: council/fills.mjs has no silver rate
  (FIN holds a gold long rate only), so silver buys pay none; this flatters the 5- and 10-candle holds.
- Baseline: the same trade entered after every eligible day of the same calendar year, same side; excess = net R minus that mean.
- t on calendar-month sums of net R (empty months 0), Holm over T1-T3 on the one-sided OOS p; 40 seeded placebos per test;
  control (reported only): AUD/USD's day return shuffled within each year, 40 seeds, silver's day kept real.

## Results

| Test | Window | n | gross R | net R | net at 2x | month t (gross) | month t (net) | excess R | excess t | stops |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 2007-16 | 74 | +0.034 | −0.026 | −0.086 | +0.32 | −0.25 | +0.002 | +0.02 | 20 |
| T1 | 2017-26 | 84 | +0.078 | +0.012 | −0.054 | +0.91 | +0.14 | −0.016 | −0.19 | 18 |
| T2 | 2007-16 | 63 | +0.063 | +0.023 | −0.018 | +0.58 | +0.21 | +0.017 | +0.16 | 10 |
| T2 | 2017-26 | 70 | +0.072 | +0.028 | −0.016 | +0.77 | +0.30 | −0.041 | −0.48 | 8 |
| T3 | 2007-16 | 34 | +0.006 | −0.050 | −0.106 | +0.04 | −0.31 | −0.026 | −0.17 | 9 |
| T3 | 2017-26 | 44 | +0.152 | +0.085 | +0.019 | +1.14 | +0.65 | +0.028 | +0.21 | 9 |

| Test | what | OOS p | Holm p | placebo beaten | placebo median t | control beaten | control median t (events) | pass |
|---|---|---|---|---|---|---|---|---|
| T1 | z 0.5 / 0.5, hold 5 candles, stop 2 x ATR(20) (primary) | 0.444 | 0.774 | 25 of 40 | −0.02 | 10 of 40 | +0.44 (223) | no |
| T2 | z 0.5 / 0.5, hold 10 candles, stop 3 x ATR(20) | 0.382 | 0.774 | 13 of 40 | +0.62 | 6 of 40 | +0.86 (223) | no |
| T3 | z 1.0 / 0.5, hold 5 candles, stop 2 x ATR(20) | 0.258 | 0.774 | 31 of 40 | +0.08 | 13 of 40 | +0.86 (106) | no |

## Against the baseline (the same buy after every day of the year)

| Test | Window | side | n | gross R | net R | baseline net R a trade |
|---|---|---|---|---|---|---|
| T1 | 2007-16 | long | 74 | +0.034 | −0.026 | −0.033 |
| T1 | 2017-26 | long | 84 | +0.078 | +0.012 | +0.004 |
| T2 | 2007-16 | long | 63 | +0.063 | +0.023 | −0.001 |
| T2 | 2017-26 | long | 70 | +0.072 | +0.028 | +0.036 |
| T3 | 2007-16 | long | 34 | +0.006 | −0.050 | −0.033 |
| T3 | 2017-26 | long | 44 | +0.152 | +0.085 | +0.004 |

Median risk (1R) per T1 trade: $1.08 in sample, $1.09 out of sample; mean cost 0.06R / 0.066R.

## Reading

The verdict was FAIL by construction (no test has 100 haven days in each window). Read descriptively, the question is whether silver
tells a different story from gold: it does not; the gold rule's failure stands and silver adds no support for it.
Not an edge; never use it as a filter, gate or size step. No re-run with other thresholds, holds or stops (any such look would be post hoc).

## To repeat

`node research/edge/silver-aud-haven-day/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/silver-aud-haven-day/run.mjs full <dir>`; delete `<dir>` afterwards. Tests: `tests/silver-aud-haven-day.test.mjs`.
