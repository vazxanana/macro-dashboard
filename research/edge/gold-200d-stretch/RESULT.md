# Result: gold stretched far from its 200-day average, does it snap back? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: fading gold 2 sd from its 200-day average lost −0.200R a trade net in 2017-26 (n 74, month t −1.52); the short side lost in both windows, the long side had 8 trades.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any number was computed). Paper research only,
a **stand-alone daily rule**: not a gate, entry, exit or size of the live gold book, and it reads none of that book's positions
(owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changed. No proposal is written.

## What was tested

- Data: OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (2006-03-20 to 2026-11-06, 5,364 trading days after
  folding weekend stubs into Monday with `council/fills.mjs` `foldWeekend`). First z on 2006-12-22.
- z = (close − SMA200) / population sd of the same 200 closes. Low stretch z < −2 (193 days), high stretch z > +2 (684 days).
- Entry at the next day's open, stop 2 x ATR(14) (1R), exit at the first close back inside ±1 sd of the average, else the 20th
  day; one position at a time. T1 buys the low stretch, T2 sells the high stretch, T3 (primary) both as one stream.
- Costs $0.60 a round trip plus financing on buys, `nights()` x `FIN.xau.long` (0.000148 of price a rollover). t on calendar-month
  sums, Holm over T1-T3. IS 2007-16, OOS 2017 to Oct 2026.

## The three tests

| Test | Window | n | Win % | Gross R a trade | Net R a trade | Month t gross | Month t net | Net at 2x costs |
|---|---|---|---|---|---|---|---|---|
| T1 buy z < −2 | IS 2007-16 | 21 | 47.6 % | +0.270 | +0.191 | 1.41 | 1.02 | |
| T1 buy z < −2 | OOS 2017-26 | 8 | 50.0 % | +0.143 | +0.011 | 0.39 | 0.03 | −0.120 |
| T2 sell z > +2 | IS 2007-16 | 48 | 27.1 % | −0.267 | −0.285 | −1.26 | −1.33 | |
| T2 sell z > +2 | OOS 2017-26 | 66 | 31.8 % | −0.215 | −0.226 | −1.53 | −1.60 | −0.237 |
| **T3 both (primary)** | IS 2007-16 | 69 | 33.3 % | −0.104 | −0.140 | −0.65 | −0.87 | |
| **T3 both (primary)** | OOS 2017-26 | 74 | 33.8 % | −0.177 | −0.200 | −1.34 | −1.52 | −0.224 |

OOS halves (net R a trade): T3 2017-21 −0.164 (n 28), 2022-26 −0.222 (n 46); T2 −0.119 (n 23) and −0.283 (n 43); T1 −0.375
(n 5) and +0.656 (n 3). Holm-adjusted p is 1.00 for all three. OOS exits of T3: 44 stops, 20 time exits, 10 back inside the band.

## Baseline and placebo (OOS, net R a trade)

| Test | Rule | Same side on any day (same hold) | Placebo median (40 seeds) | Placebo max | Placebos beaten |
|---|---|---|---|---|---|
| T1 | +0.011 | +0.160 (buy, 14 days) | +0.085 | +1.556 | 17 of 40 |
| T2 | −0.226 | −0.162 (sell, 10 days) | −0.132 | +0.113 | 10 of 40 |
| T3 | −0.200 | −0.140 (mix, 11 days) | −0.126 | +0.150 | 8 of 40 |

The placebo moves each OOS trade to a random OOS day, keeping its side and days held. Every test is below its unconditional
baseline: buying gold on ANY day of 2017-26 for 14 days made more than buying it at a 2-sd low stretch, and selling a 2-sd high
stretch lost more than selling on any day. Gold's rises are what the sell side fought: of the 684 high-stretch days 257 fall in
2007-11 and 316 in 2019-20 and 2023-26, and the stops took 40 of the 66 OOS shorts.

## Reading

Gold far above its 200-day average did not snap back over the following weeks in either window; it kept going often enough to
stop the fades out (in sample 27 % winners, out of sample 32 %). The low stretch is rare (8 OOS trades) and its in-sample
+0.19R (t 1.02) is not evidence. Not an edge, not a filter, not a lead. A follow-the-stretch version was not tested and would
need its own pre-registration (it is close to `gold-daily-bollinger` T3 and `gold-tsmom`, which also did not pass).

## Repeat

`node research/edge/gold-200d-stretch/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-200d-stretch/run.mjs full <dir>`. Tests: `tests/gold-200d-stretch.test.mjs`.
