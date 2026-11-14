# Result: ten days of wick pressure on gold (14 Nov 2026)

Pre-registered in `PREREGISTRATION.md` (pushed alone, first); computed by `run.mjs`; every figure below is in `result.json`.
Paper research only. Item 44 holds: this is a stand-alone daily rule, not a gate, exit, entry or size of the live gold book,
and nothing live changed.

**Verdict: FAIL**: ten days of long lower (or upper) wicks do not predict gold's next week better than an ordinary day.

T1 (primary, 5-day hold, excess over the same-side every-day baseline) is negative in both windows: out of sample −0.039R a
trade, t −0.78 on calendar-month sums (n 346, 118 months, Holm p 0.87); in sample −0.058R (n 362). The pre-registered bar
(OOS t ≥ 2, Holm p < 0.05, same sign in sample, still positive at 2x costs) fails on every line. Long lower wicks over two
weeks do not tell gold's next week better than an ordinary day does, and long upper wicks do not either.

## Data

Spot gold, council-data `research/daily/xau.json` (OANDA mid, UTC days, written 7 Nov 2026), read through git, weekend stubs
folded into Monday with `council/fills.mjs` `foldWeekend`: 5,364 trading days, 20 Mar 2006 to 6 Nov 2026. In sample: entries
2007-2016; out of sample (decisive): 2017 to October 2026. 2,156 signal days; one position at a time.

## Tests (Holm over three)

| Test | What | OOS t | OOS p | Holm p | In-sample mean |
|---|---|---|---|---|---|
| T1 | excess over same-side baseline, 5-day hold | -0.78 | 0.4354 | 0.8708 | -0.058R |
| T2 | both-sided net R, 5-day hold | -1.1 | 0.2713 | 0.814 | -0.09R |
| T3 | excess over same-side baseline, 10-day hold | -0.43 | 0.6672 | 0.8708 | -0.068R |

## The rule's trades (5-day hold)

| Window | n | gross R | net R | excess R | total net | win | worst drawdown | median stop |
|---|---|---|---|---|---|---|---|---|
| 2007-16 | 362 | -0.048 | -0.090 | -0.058 | -32.7R | 44.2 % | -32.7R | $28.31 |
| 2017-26 | 346 | -0.013 | -0.056 | -0.039 | -19.4R | 45.7 % | -23.67R | $35.69 |

By side, out of sample: buys 178, +0.089R gross, +0.025R net, against +0.084R net for a buy taken on every day (excess
−0.060R); sells 168, −0.141R net against −0.125R for every-day sells (excess −0.016R). The buys made money only because
every buy in 2017-26 did: the signal days did worse than an ordinary day. In sample: buys −0.097R net (baseline −0.004R),
sells −0.084R (baseline −0.062R).

At 2x costs (both sides recosted): out of sample −0.099R net, excess −0.037R. Costs were 5.5-5.7 % of gross |R| (stops are
wide: median $35.69 out of sample, so above the $10 asked for).

10-day hold (T3), out of sample: 245 trades, −0.060R net, excess −0.034R (buys +0.129R net against +0.153R every day; sells
−0.233R against −0.191R).

## Placebo (40 seeded shuffles of buy / sell among the actual trades)

Median OOS t −0.09, largest 2.13; 28 of 40 shuffles reach the actual t (−0.78). The direction the wicks point carries no
information beyond the timing: random labels on the same days do as well or better.

## Year by year (net R, 5-day hold)

2007 -4.82 · 2008 +0.42 · 2009 +0.68 · 2010 +2.59 · 2011 -6.54 · 2012 -12.51 · 2013 -8.31 · 2014 +4.19 · 2015 -5.47 ·
2016 -2.93 · 2017 -10.32 · 2018 -5.34 · 2019 -2.48 · 2020 +5.15 · 2021 +3.5 · 2022 +1.67 · 2023 -5.15 · 2024 +2.55 ·
2025 -7.01 · 2026 -1.95. Positive in 8 of 20 years.

## What this means

Not an edge, not a filter, not a bias input; no proposal is written. It measures one mechanical reading (10-day lower-minus-upper
wick sum over ATR, 20th / 80th percentiles of the past year) on daily gold; it says nothing about a single pin bar at a level,
other timeframes or other markets. Any variant (another window, threshold or hold) would be chosen after seeing this and needs
its own pre-registration on other data.

To repeat: `node research/edge/gold-wick-pressure/run.mjs` (no network; reproduces `result.json` byte for byte).
Tests: `tests/gold-wick-pressure.test.mjs`.
