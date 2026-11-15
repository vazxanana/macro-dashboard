# Silver: the share of the day's range New York made, followed for 2-5 days (gold-ny-range-share replicated). Result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: on silver, following a New York-made day for 5 days beat the same side by +0.078R out of sample (month t +1.46, n 198, Holm p 0.33), not the t of 2 gold showed.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A replication of `gold-ny-range-share`
(gold: out-of-sample excess +0.138R, t +2.63, n 198; in sample -0.012R, t -0.25) on a market it was not found on, with the
rule, thresholds, hold, stop, baseline, placebo and control copied unchanged. A stand-alone rule on spot silver, not a gate,
exit, entry or size of the live gold book; none of the book's positions read (docs/owner-decisions.md item 44). Paper research
only: nothing live changed and no proposal is written.

## Rule (as pre-registered)

- OANDA mid XAG/USD H1 via the candle proxy, 19 Mar 2006 to 30 Oct 2026 (125,140 candles); UTC days, weekend candles to Monday.
- NY share = 1 - (00-13 UTC range) / (00-21 UTC range). Median over 5,231 eligible days: 0.270 (gold 0.275).
- Signal: NY share >= 0.60 → follow New York's move. 478 signal days, 242 up.
- T1: 5-day hold, out of sample 2017-26 (primary). T2: 2-day hold, out of sample. T3: 5-day hold, 2007-26 pooled as one test.
- Entry at the next day's first H1 open, stop 2 x ATR(14) of the daily candles, out at the close of the last day or the stop.
- Costs: $0.03 a round trip (gold-drd-silver's silver cost). **No financing is charged**: `council/fills.mjs` has no silver
  rate. Gold's rate applied to silver buys (reported only) moves the out-of-sample T1 excess from +0.078R to +0.077R and its
  net from +0.078R to +0.066R.
- Excess = net R minus the mean net R of the every-day trade of the same side in the same calendar year; t on calendar-month
  sums; Holm over the three tests' judged-window p.

## Tests (R of the 2 x ATR stop)

| Test | Window | n | Gross R | Net R | Excess R | Month t (excess) | Net month t |
|---|---|---|---|---|---|---|---|
| T1 follow NY, 5 days | IS | 254 | +0.020 | -0.010 | +0.014 | +0.31 | -0.21 |
| T1 follow NY, 5 days | OOS | 198 | +0.112 | +0.078 | +0.078 | +1.46 | +1.46 |
| T2 follow NY, 2 days | IS | 254 | +0.038 | +0.008 | +0.040 | +1.29 | +0.25 |
| T2 follow NY, 2 days | OOS | 198 | +0.074 | +0.040 | +0.063 | +1.61 | +1.00 |
| T3 follow NY, 5 days, pooled | 2007-26 | 452 | +0.060 | +0.028 | +0.042 | +1.20 | +0.79 |

| Test | Holm p | 2x costs (excess / net) | Placebo beaten | Control beaten | Failed checks |
|---|---|---|---|---|---|
| T1 | 0.332 | +0.078 / +0.044 | 38 of 40 | 37 of 40 | excess t, net t, control |
| T2 | 0.332 | +0.063 / +0.006 | 38 of 40 | 36 of 40 | excess t, net t, control |
| T3 | 0.332 | +0.042 / -0.004 | 35 of 40 | 29 of 40 | excess t, net t, 2x costs, placebo, control |

Out-of-sample halves, T1: 2017-21 excess +0.093R (n 107, t +1.19), 2022-26 +0.061R (n 91, t +0.83).
Baseline every-day trade out of sample, 5 days: long +0.033R net (t +0.97), short -0.079R (t -2.60).
Placebo = the real signal days with seeded random sides (T1 median t -0.15); control = per year as many random days on their
own rule side (T1 median t +0.16).

## Reading

The sign replicated, the size did not. On silver the rule's excess is positive in both windows (+0.014R in sample, +0.078R
out of sample, about half gold's +0.138R), and T1 / T2 sit above 38 of 40 placebo draws, but no test reaches a month t of 2
(T1 +1.46, T2 +1.61, the pooled 20 years +1.20), Holm p is 0.33 for all three, and 36-37 of 40 control draws is under the
bar of 38. At this size the result is what a market with no such effect also gives now and then. Two markets with the same
sign is mild support for a small New York-follow-through effect in precious metals; it is not evidence of an edge, and
nothing here is a council rule. The gold result stays a one-decade, one-market finding. A further test needs data neither
study has seen (both metals after October 2026 as a forward record) and its own pre-registration.

## Files

`run.mjs` (fetch / count / full; gold-ny-range-share's code with the market, the cost and the three tests changed),
`result.json`, `tests/silver-ny-range-share.test.mjs`. Candles kept out of git and deleted.
To repeat: `node --use-env-proxy research/edge/silver-ny-range-share/run.mjs fetch <dir>`, then `… full <dir>`.
