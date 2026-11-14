# Platinum: the share of the day's range New York made, followed for 2-5 days (gold-ny-range-share replicated). Result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: on platinum, following a New York-made day for 5 days beat the same side by +0.054R out of sample (month t +0.93, n 145, Holm p 0.42); net of costs -0.007R.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). A replication of `gold-ny-range-share`
(gold: out-of-sample excess +0.138R, t +2.63, n 198; in sample -0.012R, t -0.25) on a market it was not found on, with the
rule, thresholds, hold, stop, baseline, placebo, control and the silver replication's three-test layout copied unchanged. A
stand-alone rule on spot platinum, not a gate, exit, entry or size of the live gold book; none of the book's positions read
(docs/owner-decisions.md item 44). Paper research only: nothing live changed and no proposal is written.

## Rule (as pre-registered)

- OANDA mid XPT/USD H1 via the candle proxy, 1 Jan 2006 to 30 Oct 2026 (121,786 candles); UTC days, weekend candles to Monday.
- NY share = 1 - (00-13 UTC range) / (00-21 UTC range). Median over 4,912 eligible days: 0.269 (gold 0.275, silver 0.270).
- Signal: NY share >= 0.60 → follow New York's move. 341 signal days, 152 up.
- T1: 5-day hold, out of sample 2017-26 (primary). T2: 2-day hold, out of sample. T3: 5-day hold, 2007-26 pooled as one test.
- Entry at the next day's first H1 open, stop 2 x ATR(14) of the daily candles, out at the close of the last day or the stop.
- Costs: 0.30 % of the entry price a round trip (`research/edge/ict-breadth-2`'s platinum spread + slippage; about 0.06R a
  trade at the median stop). **No financing is charged**: `council/fills.mjs` has no platinum rate. Gold's rate applied to
  platinum buys (reported only) moves the out-of-sample T1 excess from +0.054R to +0.053R and its net from -0.007R to -0.018R.
- Excess = net R minus the mean net R of the every-day trade of the same side in the same calendar year; t on calendar-month
  sums; Holm over the three tests' judged-window p.

## Tests (R of the 2 x ATR stop)

| Test | Window | n | Gross R | Net R | Excess R | Month t (excess) | Net month t |
|---|---|---|---|---|---|---|---|
| T1 follow NY, 5 days | IS | 191 | +0.091 | +0.012 | +0.074 | +0.95 | +0.15 |
| T1 follow NY, 5 days | OOS | 145 | +0.064 | -0.007 | +0.054 | +0.93 | -0.13 |
| T2 follow NY, 2 days | IS | 191 | +0.050 | -0.030 | +0.047 | +1.04 | -0.65 |
| T2 follow NY, 2 days | OOS | 145 | +0.058 | -0.013 | +0.055 | +1.49 | -0.35 |
| T3 follow NY, 5 days, pooled | 2007-26 | 336 | +0.079 | +0.004 | +0.065 | +1.28 | +0.07 |

| Test | Holm p | 2x costs (excess / net) | Placebo beaten | Control beaten | Failed checks |
|---|---|---|---|---|---|
| T1 | 0.419 | +0.053 / -0.078 | 36 of 40 | 26 of 40 | excess t, net t, 2x costs, placebo, control |
| T2 | 0.419 | +0.054 / -0.084 | 34 of 40 | 36 of 40 | excess t, net t, 2x costs, placebo, control |
| T3 | 0.419 | +0.065 / -0.072 | 35 of 40 | 34 of 40 | excess t, net t, 2x costs, placebo, control |

Out-of-sample halves, T1: 2017-21 excess +0.030R (n 95, t +0.41), 2022-26 +0.099R (n 50, t +1.07).
Baseline every-day trade out of sample, 5 days: long -0.033R net (t -1.16), short -0.077R (t -2.83); the 0.30 % cost takes
about 0.06-0.08R from every platinum trade, so the every-day trade is negative net on both sides.
Placebo = the real signal days with seeded random sides (T1 median t -0.03); control = per year as many random days on their
own rule side (T1 median t +0.46).

## Reading

Same sign, smaller still, and no money after costs. The rule's excess over the same-side every-day trade is positive in both
windows on platinum (+0.074R in sample, +0.054R out of sample), as on silver, but every t is under 1.5 (T1 +0.93, the pooled
20 years +1.28), Holm p is 0.42, T1 beats only 26 of 40 control draws, and the signal trades themselves lose money net of
platinum's wide spread (-0.007R out of sample, -0.078R at 2x costs). Three metals now show a positive New York-follow-through
excess (gold +0.138R, silver +0.078R, platinum +0.054R out of sample), only gold's with a t of 2 and none in both windows with
a t of 2: consistent with a small common effect, or with chance, and not tradable on platinum at its cost. Not an edge, not a
council rule. A further test needs data none of the three studies has seen (a forward record after October 2026) and its own
pre-registration.

## Files

`run.mjs` (fetch / count / full; the silver replication's code with the market and the cost changed), `result.json`,
`tests/platinum-ny-range-share.test.mjs`. Candles kept out of git.
To repeat: `node --use-env-proxy research/edge/platinum-ny-range-share/run.mjs fetch <dir>`, then `… full <dir>`.
