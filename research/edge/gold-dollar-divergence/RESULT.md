# Result: gold and the US dollar moving the same way on one day (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold after a day both gold and the dollar rose makes +0.120R a trade net out of sample 2017-26 (n 92, month t 1.23, Holm p 0.33); it beats 34 of 40 placebos.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 08908907b, pushed alone before any number was computed).
Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here
was compared with or applied to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant or
council member changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json` and `eurusd`, `gbpusd`, `usdjpy`, `usdcad`,
  `usdchf` at commit `8ddb14b5` (gold 2006-03-20 to 2026-11-06), weekends folded into Monday with `council/fills.mjs`
  `foldWeekend`. Dollar index = the council's ICE DXY build of `council/macro.mjs` `dxySeries` (USD/SEK = 11.2 / EURUSD).
- Signal: gold's and the index's close-to-close returns, each divided by the sample sd of its 20 previous daily returns (the
  day itself excluded). Up day: both above +0.5; down day: both below -0.5. Gold and the dollar moved together that strongly
  on 4.7 % (up) and 3.2 % (down) of in-sample days, 4.1 % and 3.1 % out of sample; the same-day correlation of the two scaled
  returns is -0.42 in 2008-16 and -0.47 in 2017-26.
- T1 (primary) up day, buy gold, 3 candles; T2 down day, sell gold, 3 candles; T3 up day, buy gold, 1 candle.
- Trade: entry at gold's next UTC daily open, stop 1.5 x ATR(14) of the 14 candles before it (1R), gaps through the stop
  fill at the open, one position at a time per test. Costs $0.60 a round trip plus financing on buys by `nights()` x
  `FIN.xau.long` (0.000148 of price a rollover, today's demo rate for every year). Mean cost 0.046-0.049R a T1 trade,
  0.017-0.021R a T2 trade (no financing on sells).
- t on calendar-month sums of net R (empty months count as 0), Holm over T1-T3 on the one-sided OOS p. In sample = signal
  days 2008-01 to 2016-12; out of sample 2017-01 to 2026-10.

## The three tests

| Test | Window | Signals | n | Win % | Gross R a trade | Net R a trade | Net at 2x costs | Total net R | Month t gross | Month t net | Stops |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 both up, buy, 3 days (primary) | IS 2008-16 | 110 | 98 | 58.2 | +0.167 | +0.121 | +0.075 | +11.86 | 2.39 | 1.77 | 11 |
| | OOS 2017-26 | 105 | 92 | 52.2 | +0.169 | +0.120 | +0.071 | +11.05 | 1.69 | **1.23** | 16 |
| T2 both down, sell, 3 days | IS 2008-16 | 74 | 67 | 41.8 | -0.144 | -0.165 | -0.186 | -11.05 | -1.72 | -1.95 | 14 |
| | OOS 2017-26 | 78 | 74 | 52.7 | +0.101 | +0.083 | +0.066 | +6.17 | 1.14 | **0.95** | 12 |
| T3 both up, buy, 1 day | IS 2008-16 | 110 | 110 | 50.0 | +0.048 | +0.020 | -0.008 | +2.19 | 1.35 | 0.57 | 2 |
| | OOS 2017-26 | 105 | 105 | 55.2 | +0.087 | +0.060 | +0.033 | +6.28 | 1.69 | **1.20** | 6 |

Baseline (the same trade on every eligible day, no one-at-a-time rule), net R a trade:

| Hold | Window | Buy every day | Sell every day |
|---|---|---|---|
| 3 days | IS 2008-16 (n 2,340) | -0.023 | -0.028 |
| | OOS 2017-26 (n 2,552) | +0.044 | -0.088 |
| 1 day | IS 2008-16 (n 2,340) | -0.020 | |
| | OOS 2017-26 (n 2,552) | 0.000 | |

| Test | OOS net > 0 | OOS p (one-sided) | Holm p | OOS t >= 2 and Holm < 0.05 | IS net > 0 | OOS 2x > 0 | Placebo beaten (of 40) | OOS n >= 30 | Pass |
|---|---|---|---|---|---|---|---|---|---|
| T1 | yes | 0.109 | 0.328 | no | yes | yes | 34 | yes | no |
| T2 | yes | 0.171 | 0.328 | no | no | yes | 40 | yes | no |
| T3 | yes | 0.115 | 0.328 | no | yes | yes | 33 | yes | no |

Placebo (40 seeds: as many random eligible OOS days as the test had signal days, the test's side, identical trade):

| Test | Real OOS month t | Seeds below the real t | Seeds with t >= 2 | Median / 5th / 95th percentile |
|---|---|---|---|---|
| T1 | 1.23 | 34 | 2 | 0.54 / -1.00 / 2.67 |
| T2 | 0.95 | 40 | 0 | -0.98 / -3.22 / 0.71 |
| T3 | 1.20 | 33 | 2 | 0.13 / -1.02 / 2.31 |

## Reading

- Not an edge, and no proposal. The buy after a day gold rose WITH the dollar is positive in both windows, before and after
  costs and at 2x costs (+0.121R / +0.120R a trade net), and above the buy-every-day baseline in both (by +0.14R in sample,
  +0.08R out of sample). But at about ten trades a year its out-of-sample month t is 1.23 (bar 2), the Holm p 0.33, and two of
  40 random sets of long days do better: gold's rising decade carries much of it (random long days have a median t of 0.54).
- The sell after a day both fell is the only test above all 40 placebos out of sample, but that is because random SELLS lose
  in 2017-26 (median t -0.98); it lost in sample (-0.165R a trade, t -1.95), so the sign is not stable.
- The one-day buy (T3) is the same signal at a shorter hold: +0.060R out of sample, t 1.20, and only +0.020R in sample.
- Relation to `gold-dollar-lead` (read before this registration): its daily T3 found that gold that lagged its dollar co-move
  kept lagging the next day. This study's continuation buy is in the same direction as that finding and also does not reach
  the bar. Same-day gold / dollar co-movement days, as a continuation signal at these thresholds, are closed on the
  council's data.

## What was not tested

Other thresholds, look-backs, holds or stops; a residual / beta form (that is `gold-dollar-lead`); single pairs; intraday
timing; other metals; any use inside the gold book.

## To repeat

`node research/edge/gold-dollar-divergence/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-dollar-divergence/run.mjs full <dir>`. Tests: `tests/gold-dollar-divergence.test.mjs`.
