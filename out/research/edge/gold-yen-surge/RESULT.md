# Result: gold after a yen surge day (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold after a yen surge day makes +0.023R a trade net out of sample 2017-26 (n 160, month t 0.35), less than a buy on any day (+0.044R); it lost in sample.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 41f411117, pushed alone before any number was computed).
Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here
was compared with or applied to that book or its 2006-17 records (owner decision 44). No live rule, size, filter, stop,
config, cost constant, council member or the gold terminal's "Yen carry-unwind risk" row changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json` and `usdjpy.json` at the pre-registered commit
  `e3dbfa18e` (gold 2006-03-20 to 2026-11-06, USD/JPY 2002-05-07 to 2026-11-06), weekends folded into Monday with
  `council/fills.mjs` `foldWeekend`.
- Signal: USD/JPY's close-to-close return divided by the sample sd of its 20 previous daily returns (the day itself
  excluded). Yen surge day: below −1.5 (USD/JPY falls); yen slump day: above +1.5. In sample 184 surge and 193 slump days
  of 2,605; out of sample 188 and 187 of 2,563 (about 7 % each way).
- T1 (primary) surge day, buy gold, 3 candles; T2 slump day, sell gold, 3 candles; T3 surge day, buy gold, 1 candle.
- Trade: entry at gold's next UTC daily open, stop 1.5 x ATR(14) of the 14 candles before it (1R; a gap through the stop fills
  at the open), exit at the close of the hold's last candle, one position at a time per test. Costs $0.60 a round trip plus
  `nights` x `FIN.xau.long` x entry / risk on buys (today's demo rate for every year); sells pay and get nothing.
- Windows: signal days 2007-01-01 to 2016-12-31 (in sample, 120 months) and 2017-01-01 to 2026-10-31 (out of sample, 118
  months). t on calendar-month sums of net R by exit month, every month counted; Holm over T1-T3 on the one-sided
  out-of-sample p.

## Results (R a trade)

| Test | Window | n | Won | Stopped | Gross R | Net R | Month t gross | Month t net | Total net R | Net at 2x costs | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 surge, buy 3 d (primary) | IS 2007-16 | 155 | 50.3 % | 27 | +0.032 | −0.016 | +0.64 | −0.32 | −2.48 | −0.064 |  |  |
|  | OOS 2017-26 | 160 | 49.4 % | 33 | +0.074 | +0.023 | +1.09 | +0.35 | +3.72 | −0.027 | 1.00 | no |
| T2 slump, sell 3 d | IS 2007-16 | 176 | 43.8 % | 34 | −0.065 | −0.087 | −1.37 | −1.82 | −15.40 | −0.110 |  |  |
|  | OOS 2017-26 | 167 | 40.7 % | 35 | −0.121 | −0.140 | −2.03 | −2.34 | −23.32 | −0.158 | 1.00 | no |
| T3 surge, buy 1 d | IS 2007-16 | 184 | 49.5 % | 9 | +0.032 | +0.001 | +1.01 | +0.03 | +0.21 | −0.030 |  |  |
|  | OOS 2017-26 | 188 | 42.6 % | 12 | +0.006 | −0.022 | +0.15 | −0.57 | −4.21 | −0.051 | 1.00 | no |

Baseline (the same trade on every eligible day, no one-at-a-time rule, net R a trade): a 3-day buy −0.013 in sample and
+0.044 out of sample; a 3-day sell −0.042 and −0.089; a 1-day buy −0.018 and +0.001. T1's out-of-sample +0.023R is BELOW a
gold buy on any day (+0.044R); T3 is below its baseline too. T2 loses more than a sell on any day in both windows.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| OOS net R > 0 | yes | no | no |
| OOS month t >= 2 and Holm p < 0.05 | no | no | no |
| IS net R > 0 | no | no | yes |
| OOS net R > 0 at 2x costs | no | no | no |
| Real OOS t above 38 of 40 placebos | no (13) | no (4) | no (16) |
| OOS n >= 30 | yes | yes | yes |

## Placebo (40 seeds; random out-of-sample eligible days, as many as the signal days, same side and trade)

| Test | p5 | median | p95 | Real OOS month t | Placebos beaten |
|---|---|---|---|---|---|
| T1 | −0.64 | +0.51 | +2.00 | +0.35 | 13 of 40 |
| T2 | −3.09 | −1.49 | +0.08 | −2.34 | 4 of 40 |
| T3 | −1.54 | −0.16 | +1.62 | −0.57 | 16 of 40 |

Random buy days of 2017-26 did better than the yen surge days in 27 of 40 seeds: the out-of-sample gain of T1 is gold's own
rise in those years, not the yen. Random sell days lose in a rising gold market; the slump-day sells lose more than most of
them, which is the same drift and no sign that gold falls when the yen is sold.

## Reading

- A sharp yen rally does not tell gold's direction over the next one to three days on this sample: the surge-day buys are
  no better than any buy, in both windows, before and after costs; the slump-day sells are no better than any sell.
- What this does not cover: other thresholds, holds or stops, other yen crosses, the intraday timing of the yen move, gold
  priced in yen. None was looked at, and none should be tuned on these results.
- The gold terminal's "Yen carry-unwind risk" row stays as it is (`dir: null`, a volatility warning, never a direction); this
  result agrees with that design and changes nothing.

## Repeat

```sh
node research/edge/gold-yen-surge/run.mjs fetch <dir>   # git show of the pinned council-data commit, no network
node research/edge/gold-yen-surge/run.mjs full <dir>    # writes result.json next to run.mjs
node --test tests/gold-yen-surge.test.mjs
```
