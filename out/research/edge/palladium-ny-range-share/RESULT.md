# Palladium: the share of the day's range New York made, followed for 2-5 days (gold-ny-range-share replicated). Result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: on palladium, following a New York-made day for 5 days trailed the same side by -0.035R out of sample (month t -0.67, n 201, Holm p 1.00); it led only in sample.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A replication of `gold-ny-range-share`
(gold: out-of-sample excess +0.138R, t +2.63, n 198; in sample -0.012R, t -0.25) on a market it was not found on, with the
rule, thresholds, hold, stop, baseline, placebo and control copied unchanged (the code of `silver-ny-range-share`). A
stand-alone rule on spot palladium, not a gate, exit, entry or size of the live gold book; none of the book's positions read
(docs/owner-decisions.md item 44). Paper research only: nothing live changed and no proposal is written.

## Rule (as pre-registered)

- OANDA mid XPD/USD H1 via the candle proxy, 1 Jan 2006 to 30 Oct 2026 (119,286 candles; the proxy's palladium history starts
  1 Jan 2006); UTC days, weekend candles to Monday, 18+ candles a day.
- NY share = 1 - (00-13 UTC range) / (00-21 UTC range). Median over 4,600 eligible days: 0.307 (gold 0.275, silver 0.270).
- Signal: NY share >= 0.60 → follow New York's move. 513 signal days, 269 up. (The pre-registered count read 311 / 200 by
  signal day; by entry time one late-December 2016 signal enters in January 2017, so the windows hold 310 / 201 trades.)
- T1: 5-day hold, out of sample 2017-26 (primary). T2: 2-day hold, out of sample. T3: 5-day hold, 2007-26 pooled as one test.
- Entry at the next day's first H1 open, stop 2 x ATR(14) of the daily candles, out at the close of the last day or the stop.
- Costs: 0.20 % of the entry price a round trip (the palladium cost of `research/edge/trend-breadth`). **No financing is
  charged**: `council/fills.mjs` has no palladium rate. Gold's rate applied to palladium buys (reported only) leaves the
  out-of-sample T1 excess at -0.035R and moves its net from -0.062R to -0.071R.
- Excess = net R minus the mean net R of the every-day trade of the same side in the same calendar year; t on calendar-month
  sums; Holm over the three tests' judged-window p.

## Tests (R of the 2 x ATR stop)

| Test | Window | n | Gross R | Net R | Excess R | Month t (excess) | Net month t |
|---|---|---|---|---|---|---|---|
| T1 follow NY, 5 days | IS | 310 | +0.104 | +0.066 | +0.085 | +2.08 | +1.54 |
| T1 follow NY, 5 days | OOS | 201 | -0.028 | -0.062 | -0.035 | -0.67 | -1.21 |
| T2 follow NY, 2 days | IS | 310 | +0.041 | +0.002 | +0.036 | +1.55 | +0.10 |
| T2 follow NY, 2 days | OOS | 201 | -0.012 | -0.047 | -0.013 | -0.38 | -1.34 |
| T3 follow NY, 5 days, pooled | 2007-26 | 511 | +0.052 | +0.015 | +0.038 | +1.17 | +0.46 |

| Test | Holm p | 2x costs (excess / net) | Placebo beaten | Control beaten | Failed checks |
|---|---|---|---|---|---|
| T1 | 1.000 | -0.035 / -0.097 | 10 of 40 | 8 of 40 | excess t, net t, 2x costs, placebo, control |
| T2 | 1.000 | -0.013 / -0.082 | 14 of 40 | 10 of 40 | excess t, net t, 2x costs, placebo, control |
| T3 | 0.727 | +0.038 / -0.022 | 35 of 40 | 21 of 40 | excess t, net t, 2x costs, placebo, control |

Out-of-sample halves, T1: 2017-21 excess -0.037R (n 128, t -0.55), 2022-26 -0.032R (n 73, t -0.38).
Baseline every-day trade out of sample, 5 days: long +0.021R net (t +0.75), short -0.075R (t -2.64).
Placebo = the real signal days with seeded random sides (T1 median t +0.04); control = per year as many random days on their
own rule side (T1 median t +0.16).

## Reading

Palladium gives the mirror image of gold. In sample (2007-16) following a New York-made day beat the same-side every-day trade
by +0.085R a trade (month t +2.08, n 310), where gold showed nothing; out of sample (2017-26), the window gold's result came
from, it lost to the baseline (-0.035R, t -0.67, n 201, both halves negative) and sat below most placebo and control draws.
Neither window replicates the other on the same market, and the pooled 20 years are +0.038R at t +1.17. With silver's
same-sign but weaker result (OOS +0.078R, t +1.46), the three metals together do not show a stable New York follow-through:
each market has its own good decade, which is what chance across markets and decades looks like. Not an edge, not a council
rule. Palladium stops are wide (median 2 x ATR $85 out of sample) and the cost is 0.20 %; at 2x costs every judged net is below
zero.

## Files

`run.mjs` (fetch / count / full; silver-ny-range-share's code with the market and the cost changed), `result.json`,
`tests/palladium-ny-range-share.test.mjs`. Candles kept out of git and deleted.
To repeat: `node --use-env-proxy research/edge/palladium-ny-range-share/run.mjs fetch <dir>`, then `… full <dir>`.
