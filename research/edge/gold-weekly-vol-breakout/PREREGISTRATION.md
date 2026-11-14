# Pre-registration: the weekly volatility breakout on spot gold (week open ± k × the previous week's range)

Written 14 Nov 2026, committed and pushed alone before any week of this rule is simulated. Paper research only.

## Why

The daily rule of `research/edge/gold-vol-breakout` (branch `gold-vol-breakout`: buy stop at the 00:00 UTC open + 0.5 × the
previous day's range, sell stop at the open − 0.5 × that range, first fill wins, stop back at the open, out at 21:00 UTC) leaned
the right way before costs, and its replication on 2007-15 (`gold-vol-breakout-replicate`) held; a cost study found that its
stops are about $13, so the $0.60 round trip is a large share of R. The question here: does the same mechanism work one
timeframe up, on weeks, where stops are about five times wider and costs a much smaller share of R?

**This is a separate rule with its own test. No claim carries over from the daily result**, in either direction. It is a new
stand-alone rule on spot gold, **never a gate, exit, entry or size of the live gold book** (Gold trend, Gold daily engulf; owner
decision 44): none of the book's records or rules are read. Nothing live changes whatever the result; a pass is at most a
proposal for the owner, with its own forward record.

Dedupe (read before writing this): `gold-inside-week` (bracket at the inside week's own high / low, stop the other side),
`gold-weekly-open` (limits around the weekly open, scaled by a 14-week ATR), `gold-week-raid` (previous-week high / low raid and
reversal) and `gold-weekly-momentum` (last week's sign) do not test stop entries at the week's open ± k × the previous week's
range with the stop at the open.

## Data

- OANDA mid XAU/USD M5 candles `[t, o, h, l, c]` (unix seconds, UTC), 2006-11-01 to 2026-11-13, read through the keyless
  candle proxy into a file kept out of git (`xau-5m.json.gz`). Fills and exits are walked on M5.
- **Week** (keyed by its Monday's UTC date): every M5 candle from Sunday 00:00 UTC (in practice the Sunday reopen, 21:00-23:00
  UTC) through Saturday 00:00 UTC. The **week's open O** = the open of its first candle (the Sunday reopen, or the first
  candle of the trading week when the Sunday session is missing). The **trading window** = the week's candles that start at or
  before Friday 20:55 UTC; the **exit** is the close of the last of them (Friday 20:55, or earlier when the market shut early).
- **Previous week's range** = high − low over all candles of the previous week (Sunday reopen to Friday's last candle: the
  weekend-folded week).
- A week is used only when it has at least 600 candles in its trading window and the previous week has at least 600 candles
  (holiday stubs and data holes are skipped and counted).

## Rule

- **T1 (primary)**: k = 0.5. A buy stop at O + k × the previous week's range and a sell stop at O − k × that range, both live
  from the week's first candle to the Friday 20:55 UTC candle. The first one filled wins and the other is cancelled.
  The stop is the week's open O. Exit at the close of the Friday 20:55 UTC candle (the end of the trading window), or the stop.
- **T2**: T1 with k = 0.3.
- **T3**: T1 (k 0.5), buys only (no sell order).
- Fill mechanics on M5: a candle that opens beyond a level fills at its open (a gap fills at the open, the worse price); else a
  candle that trades through the level fills at the level. If one candle trades both levels, the level nearer that candle's
  open fills. **If the fill and the stop fall in the same candle, the stop is counted** (−1R before costs). After that a candle
  that opens beyond the stop exits at its open, else one that trades the stop exits at the stop.
- Every trade has a stop (absolute rule 1); paper only.
- 1R = |entry − O|; R = side × (exit − entry) / 1R.

## Costs

- **$0.60 a round trip per ounce** (spread + slippage, as the daily study), subtracted as 0.60 / 1R.
- **Financing on buys**: `council/fills.mjs` `nights(fill, exit)` (rollovers Monday-Friday 22:00 UTC, Wednesday three) ×
  `FIN.xau.long` (0.000148 of price a rollover: the demo broker's XAUUSD swap of 11 Nov 2026, the same source every earlier gold
  study used; today's rate charged for every year) × entry / 1R. Sells are charged and credited nothing. A Monday-to-Friday
  hold crosses six rollovers, so financing matters here.
- **2× costs**: $1.20 a round trip and twice the financing, reported for every test.

## Windows

- In sample: weeks whose Monday is 2007-01-01 to 2016-12-31.
- Out of sample (decisive): weeks whose Monday is 2017-01-01 to the last complete week of the file (Monday 9 Nov 2026).
- Nothing from 2006 is used except as the previous-week range of the first 2007 week.

## Statistics and pass bar

- Per test and window: n, win rate, gross / net R a trade, net at 2× costs, total, worst drawdown, median stop in $, buys / sells.
- **t on calendar-month sums of net R** (each trade booked in the month of its exit), gross t too.
- One-sided p = normal tail of the out-of-sample month t; **Holm across the three tests**.
- **Placebo, 40 seeds** (seeded generator, seeds 1-40), out of sample, per test: for every real trade, one market entry in the
  SAME week at a random 5-minute mark between the week's first candle and Thursday 20:55 UTC, at that candle's open; side drawn
  with P(buy) = the test's own share of buys out of sample (T3: always buy); stop at the real trade's 1R distance; out at the
  week's exit or the stop; same costs and financing. A test "beats" a seed when its out-of-sample net R a trade is above that
  seed's.
- **Comparison (reported, not a test)**: long every eligible week at O, stop O − 0.5 × the previous week's range, out at the
  week's exit, same costs.
- **A test passes only with all of**: out-of-sample net R a trade > 0; out-of-sample month t ≥ 2 and Holm p < 0.05; in-sample net
  R a trade > 0 (positive in both halves); out-of-sample net at 2× costs > 0; it beats at least 38 of the 40 placebo seeds;
  out-of-sample n ≥ 30. The verdict is PASS when T1 passes; a T2 or T3 pass alone is a hypothesis for its own pre-registration.

## Power, said before the result

At most one trade a week: about 45-50 trades a year, about 470 out of sample and 470 in sample, and month sums of one to five
trades. A weekly R has a wide spread, so a true edge of +0.10R a trade would reach a month t of 2 only rarely in ten years. The
test has limited power: a FAIL is "not shown", never "shown not to work", and a PASS has to clear the full bar above.

## What is fixed now and will not change

The three rules, k values, week definition, exit time, fill and stop conventions, costs, financing source, windows, placebo,
comparison and pass bar above. The study is run once; nothing is tuned after a result is seen. A change after the first run
would need a new pre-registration.
