# Result: when the gold day made its extreme (14 Nov 2026)

Pre-registered in `PREREGISTRATION.md` (pushed alone, first); computed by `run.mjs`; every figure below is in `result.json`.
Paper research only. Item 44 holds: this is a stand-alone daily rule, not a gate, exit, entry or size of the live gold book,
and nothing live changed.

**Verdict: FAIL: an up day that made its high in its last four hours (or a down day its low) does not lead to a better next day out of sample (excess −0.024R, t −1.11).**

T1 (primary, 1-day hold, excess over the same-side every-day baseline) was positive in sample (+0.063R a trade, t 2.65,
n 756) and turned negative out of sample: −0.024R a trade, t −1.11 on calendar-month sums (n 858, 118 months, Holm p 0.801).
The pre-registered bar (OOS t ≥ 2, Holm p < 0.05, same sign in sample, still positive at 2x costs) fails on the decisive
lines. The 2007-16 effect did not survive into 2017-26.

## Data

Spot gold, OANDA mid H1 candles through the site's keyless candle proxy (`/md/bars`), 125,474 candles from 19 Mar 2006 to
30 Oct 2026, grouped into New York sessions (17:00 to 17:00 New York, `council/histdata.mjs` `nyOffsetH`); sessions with
fewer than 20 H1 candles dropped: 5,272 usable days. In sample: entries 2007-2016; out of sample (decisive): 2017 to October
2026. 1,688 late-extreme signal days (about a third of all days); one position at a time. The candle cache was kept outside
git and deleted after the run.

## Tests (Holm over three)

| Test | What | OOS t | OOS p | Holm p | In-sample mean |
|---|---|---|---|---|---|
| T1 | late extreme, 1-day hold, excess over the every-day same-side baseline | -1.11 | 0.267 | 0.801 | +0.063R |
| T2 | late extreme, 1-day hold, excess over the same-direction-day baseline | -0.62 | 0.5353 | 0.8131 | +0.074R |
| T3 | late extreme, 5-day hold, excess over the every-day same-side baseline | -0.83 | 0.4065 | 0.8131 | +0.106R |

## The rule's trades (1-day hold)

| Window | n | gross R | net R | excess R | total net | month t gross | month t net | month t excess | worst drawdown | median stop |
|---|---|---|---|---|---|---|---|---|---|---|
| 2007-16 | 756 | 0.070 | 0.034 | 0.063 | 25.53R | 2.93 | 1.43 | 2.65 | -14.15R | $19.23 |
| 2017-26 | 858 | -0.015 | -0.043 | -0.024 | -36.92R | -0.71 | -1.97 | -1.11 | -43.62R | $24.09 |

By side, out of sample: buys 479, +0.004R gross, −0.024R net against +0.013R for a buy taken on every day (excess
−0.037R); sells 379, −0.067R net against −0.059R for every-day sells (excess −0.008R). In sample: buys +0.031R net (baseline
−0.017R), sells +0.037R (baseline −0.043R): both sides beat the baseline in 2007-16, neither did in 2017-26.

T2 (does the hour add anything beyond the day's direction): in sample +0.074R a trade over a buy after any up day / a sell
after any down day (t 3.10), out of sample −0.013R (t −0.62). The day's direction alone was worth nothing either out of sample
(buys after up days −0.002R net, sells after down days −0.065R).

5-day hold (T3): in sample 346 trades, +0.070R net, excess +0.106R (t 1.47); out of sample 371, −0.050R net, excess
−0.051R (t −0.83).

At 2x costs (rule and baseline recosted): out of sample −0.071R net, excess −0.024R. Costs were 5.7-7.0 % of gross |R|
(stop 1 x ATR14, median $19.23 in sample and $24.09 out of sample). Financing note: `nights` counts a rollover at 22:00
UTC, which is the New York 17:00 boundary in winter but an hour after it in summer, so a 1-day buy held 17:00 to 17:00 New
York pays no night in winter and one in summer (about 0.02-0.03R). That is the pre-registered cost model; it can only make
summer buys look slightly worse and does not decide the verdict (the gross excess is negative out of sample too).

Early-extreme control (descriptive: an up day whose high was in its FIRST four hours, a down day whose low was): rare, 55
trades in sample and 83 out of sample, excess −0.283R and −0.112R. It ran the other way to the late class in 2007-16 and was
negative in 2017-26 too, so the late / early contrast does not hold out of sample either.

## Placebo (40 seeded draws of random OOS days, same count and buy / sell mix)

Median t 0.11, 95th percentile 1.52, largest 1.93; 36 of 40 draws reach the actual t (−1.11). Random days did as well as or
better than the signal days.

## Year by year (net R, 1-day hold)

2007 -3.99 · 2008 +7.71 · 2009 +0.93 · 2010 -7.96 · 2011 +5.04 · 2012 +5.27 · 2013 +6.95 · 2014 -3.41 · 2015 +10.22 ·
2016 +4.76 · 2017 -18.53 · 2018 -6.38 · 2019 -6.37 · 2020 -4.04 · 2021 +3.21 · 2022 +3.36 · 2023 -3.98 · 2024 -9.42 ·
2025 +3.4 · 2026 +1.84. Positive in 7 of 10 years in sample, 4 of 10 out of sample.

## What this means

Not an edge, not a filter, not a bias input; no proposal is written. In 2007-16 a gold day that pushed to its extreme into
the New York afternoon was followed by a slightly better next day than an ordinary one, but the effect was gone in 2017-26
and the out-of-sample record is within what random days give. It measures one mechanical reading (the H1 candle holding the
day's extreme among the session's last four, on New York days, a 1-day or 5-day hold with a 1 x ATR14 stop); another
window, hour count or hold would be chosen after seeing this and needs its own pre-registration on other data.

To repeat: `node --use-env-proxy research/edge/gold-extreme-timing/run.mjs fetch <file.json.gz>` (candles outside git), then
`node research/edge/gold-extreme-timing/run.mjs <file.json.gz>` (writes `result.json`). Tests: `tests/gold-extreme-timing.test.mjs`.
