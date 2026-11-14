# Result: does silver lead gold (or gold lead silver) by a few minutes inside the day? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: a silver M5 shock gold lags is followed by a tiny gold catch-up (+0.027R gross, 2021-26) that $0.60 of costs turns into -0.125R a trade (n 3295, month t -6.16).**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed and pushed alone before any return was computed). A
**stand-alone intraday rule** on gold: not a gate, entry, exit or size of the live gold book, it reads none of its positions and
uses no candle before 2016 (owner decision 44). Paper only; no live rule, size, filter, stop, config, cost constant or council
member changed. No proposal is written.

## Data
OANDA mid M5 through the site's candle proxy, from 1 January 2016 to 13 November 2026 21:55 UTC: gold 770,445 candles, silver
756,433, **756,327 joined by exact candle start**. CME holidays and early closes skipped whole (`ict/calendar.mjs`, read only); no
trade window touches 16:30-18:30 New York. Signals before the window filter: 7,576 silver shocks with gold lagging (3,675 up),
5,852 gold shocks with silver lagging (2,982 down, so bought on the fade).

Rule (as registered): silver M5 log return beyond 2 sd of the prior 28 days' M5 returns while gold moved less than half of
`beta x silver move` (beta from the same window) → trade gold in silver's direction at the next M5 open; T3 the mirror with gold
as the shock, faded. Stop 1 x the 28-day mean 30-minute gold range (median $3.02), exit after 30 minutes (T1, T3) or 60 (T2), one
position at a time. Cost $0.60 a round trip ($0.30 spread + half a spread of slippage on entry and exit; median 0.20R). In sample
2016-2020, out of sample 2021-now; t on calendar-month sums.

## Tests

| Test | Window | n | Gross R a trade | Net R a trade | Total net R | Win % | t net (months) | t gross | Worst drawdown |
|---|---|---|---|---|---|---|---|---|---|
| T1 silver leads, 30 min | in sample | 2653 | +0.009 | -0.272 | -720.6 | 31.4 | -12.10 | 0.52 | -720.6R |
| T1 silver leads, 30 min | out of sample | 3295 | +0.027 | -0.125 | -412.3 | 40.2 | -6.16 | 1.44 | -417.0R |
| T2 silver leads, 60 min | in sample | 2401 | +0.034 | -0.248 | -595.8 | 34.2 | -8.66 | 1.29 | -596.0R |
| T2 silver leads, 60 min | out of sample | 2990 | +0.039 | -0.113 | -337.4 | 38.4 | -4.37 | 1.60 | -343.8R |
| T3 gold alone, faded, 30 min | in sample | 2076 | +0.053 | -0.229 | -475.0 | 37.7 | -8.56 | 2.06 | -489.3R |
| T3 gold alone, faded, 30 min | out of sample | 2848 | +0.020 | -0.127 | -361.5 | 42.5 | -5.99 | 1.02 | -392.2R |

**Pass bar, per test** (all three fail): out-of-sample net R > 0 with Holm p < 0.05: no (one-sided p 1.00 each, Holm 1.00);
in-sample net R > 0: no; out of sample positive at 2x costs: no (-0.277R, -0.265R, -0.274R a trade); out-of-sample n >= 150: yes;
out-of-sample net t above the placebo's 95th percentile: yes (see below). Only two of five checks hold for any test.

## Placebo (40 seeds: each signal replaced by a random allowed joined M5 candle of the same year, same side)

| Test | Real OOS net R / t | Placebo median net R / t | Placebo 95th pct t | Placebo net R range | Placebo gross median / max | Seeds with t >= real |
|---|---|---|---|---|---|---|
| T1 | -0.125 / -6.16 | -0.144 / -10.05 | -7.92 | -0.168 to -0.116 | +0.004 / +0.032 | 0 of 40 |
| T2 | -0.113 / -4.37 | -0.142 / -8.37 | -6.72 | -0.168 to -0.113 | +0.006 / +0.035 | 0 of 40 |
| T3 | -0.127 / -5.99 | -0.138 / -9.44 | -7.49 | -0.167 to -0.110 | +0.005 / +0.033 | 0 of 40 |

The real signals do a little better than random candles (every seed's t is below the real one), so there is a small lead before
costs in the expected direction (silver ahead of gold; gold's unconfirmed spikes partly giving back). It is worth about 0.02 to
0.04R of a 30-minute range stop, and the round trip costs about 0.20R. The same shape as `bond-lead-intraday`.

## Detail
- By side, out of sample: T1 buys +0.019R gross / -0.131R net (n 1580), sells +0.033R / -0.119R (n 1715); T2 buys -0.010R /
  -0.161R, sells +0.084R / -0.068R (t -1.86); T3 buys +0.024R / -0.124R, sells +0.017R / -0.130R.
- Year by year, net: T1 and T2 negative every year 2016-2026; T3 negative every year but 2026 (+0.015R, n 360, a part year).
  The best year for the lead is 2022 (T2 gross +0.180R, net -0.014R).
- Stops were hit on 24-28 % of T1 trades, 37-41 % of T2, 33-36 % of T3.

## What it means
On gold, silver does arrive a few minutes earlier on average, and gold's moves that silver ignores do fade a little, but at the
five-minute scale the catch-up is a few cents on a $3 stop: smaller than the spread. Not an edge; never a council rule, filter or
timing aid. Not tested and not to be tuned on these data: other thresholds, co-move fractions, holds, stops, hours, a limit entry or
other metals (each would need its own pre-registration on other data). The session-high SMT version was not repeated: the H1
24-hour version failed in `gold-silver-divergence`.

To repeat: `node --use-env-proxy research/edge/gold-silver-lead-intraday/fetch.mjs <dir>` (about 1.5 million M5 candles, kept out
of git), then `node --max-old-space-size=6000 research/edge/gold-silver-lead-intraday/run.mjs <dir>` (about 15 minutes, mostly the
placebo). Tests: `tests/gold-silver-lead-intraday.test.mjs`.
