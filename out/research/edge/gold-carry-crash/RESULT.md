# Result: gold after an AUD/JPY carry crash day (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold for 5 days after an AUD/JPY carry crash beats the year's every-day buy by +0.117R a trade out of sample 2017-26 (n 141, month t 1.42, Holm p 0.23).**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 679e12f54, pushed alone before any gold outcome was
computed). Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and
nothing here was compared with or applied to that book; its 2006-17 positions were not read (owner decision 44). No live
rule, size, filter, stop, config, cost constant or council member changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json` and `audjpy.json` at the pre-registered commit
  `d8d68407b` (gold 2006-03-20 to 2026-11-13, AUD/JPY 2004-06-01 to 2026-11-13), weekends folded into Monday with
  `council/fills.mjs` `foldWeekend`.
- Signal: AUD/JPY's close-to-close return divided by the sample sd of its 20 previous daily returns (the day itself
  excluded). Carry crash: below −1.5; carry rally: above +1.5. In sample 216 crash and 182 rally days of 2,605; out of
  sample 191 and 177 of 2,563 (counted before the pre-registration).
- T1 (primary) crash day, buy gold, 5 candles; T2 rally day, sell gold, 5 candles; T3 crash day, buy gold, 10 candles.
- Trade: entry at gold's next UTC daily open, stop 1.5 x ATR(14) of the 14 candles before it (1R; a gap through the stop fills
  at the open), exit at the close of the hold's last candle, one position at a time per test. Costs $0.60 a round trip plus
  `nights` x `FIN.xau.long` x entry / risk on buys (today's demo rate for every year); sells pay and get nothing.
- Baseline: the same trade (same side, hold, stop, costs) after every eligible day of the same calendar year. Excess = a
  trade's net R minus its entry year's baseline mean.
- Windows: signal days 2007-01-01 to 2016-12-31 (in sample) and 2017-01-01 to 2026-10-31 (out of sample). t on
  calendar-month sums by exit month, every month counted; Holm over T1-T3 on the one-sided out-of-sample p of the excess.

## Results (R a trade)

| Test | Window | n | Won | Stopped | Gross R | Month t gross | Net R | Month t net | Baseline net | Excess R | Month t excess | Net at 2x costs | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 crash, buy 5 d (primary) | IS 2007-16 | 160 | 48.1 % | 40 | +0.115 | +1.75 | +0.054 | +0.83 | −0.003 | +0.047 | +0.75 | −0.006 |  |  |
|  | OOS 2017-26 | 141 | 54.6 % | 33 | +0.265 | +2.96 | +0.195 | +2.22 | +0.087 | +0.117 | +1.42 | +0.126 | 0.23 | no |
| T2 rally, sell 5 d | IS 2007-16 | 146 | 45.9 % | 46 | +0.005 | +0.05 | −0.018 | −0.20 | −0.063 | +0.034 | +0.38 | −0.041 |  |  |
|  | OOS 2017-26 | 142 | 36.6 % | 48 | −0.118 | −1.59 | −0.137 | −1.84 | −0.127 | +0.000 | +0.00 | −0.156 | 0.50 | no |
| T3 crash, buy 10 d | IS 2007-16 | 135 | 43.7 % | 57 | +0.139 | +1.32 | +0.049 | +0.47 | +0.025 | +0.008 | +0.08 | −0.041 |  |  |
|  | OOS 2017-26 | 119 | 50.4 % | 42 | +0.379 | +2.84 | +0.270 | +2.06 | +0.152 | +0.131 | +1.04 | +0.161 | 0.30 | no |

The baseline counts every eligible day (2,605 in sample, 2,563 out of sample) with no one-at-a-time rule. T1's net
out-of-sample month t of 2.22 is mostly gold's own rise in 2017-26: a 5-day buy on any day of those years made +0.087R.
Against that baseline the crash-day buys add +0.117R a trade, month t 1.42, under the bar of 2.

| Check | T1 | T2 | T3 |
|---|---|---|---|
| OOS excess month t >= 2 and Holm p < 0.05 | no | no | no |
| OOS net R > 0 | yes | no | yes |
| OOS net R > 0 at 2x costs | yes | no | yes |
| IS excess R > 0 | yes | yes | yes |
| Real OOS excess t above 38 of 40 placebos | yes (39) | no (22) | no (36) |
| OOS n >= 30 | yes | yes | yes |

## Placebo (40 seeds; random out-of-sample eligible days, as many as the signal days, same side, trade and excess)

| Test | p5 | median | p95 | Real OOS excess month t | Placebos beaten |
|---|---|---|---|---|---|
| T1 | −1.60 | +0.07 | +1.40 | +1.42 | 39 of 40 |
| T2 | −2.23 | −0.14 | +1.58 | +0.00 | 22 of 40 |
| T3 | −1.73 | +0.03 | +1.27 | +1.04 | 36 of 40 |

## Reading

- The crash-day gold buy leans the right way in both windows (excess +0.047R in sample, +0.117R out of sample) and sits at
  the top of its placebo, but the month t of its excess is 1.42 and Holm p 0.23: not apart from luck on this sample. In
  sample its net is +0.054R and it loses at 2x costs. Not an edge; never call it one.
- A carry rally tells nothing about gold falling: the rally-day sells do exactly as badly as any sell out of sample.
- What this does not cover: other thresholds, holds or stops, other carry crosses (NZD/JPY, MXN/JPY), the intraday timing of
  the AUD/JPY move. None was looked at, and none should be tuned on these results; a follow-up needs its own
  pre-registration on other data.

## Repeat

```sh
node research/edge/gold-carry-crash/run.mjs fetch <dir>   # git show of the pinned council-data commit, no network
node research/edge/gold-carry-crash/run.mjs full <dir>    # writes result.json next to run.mjs
node --test tests/gold-carry-crash.test.mjs
```
