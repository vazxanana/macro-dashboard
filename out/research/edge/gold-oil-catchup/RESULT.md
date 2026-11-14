# Result: does gold catch up with a large crude-oil move it has not followed? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: after a decile 10-day WTI move with gold flat, gold the way of oil for 3 days beat its own same-side drift by −0.003R a trade out of sample (n 116, month t −0.09).**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit e652118e8, pushed alone before any outcome was computed).
Paper research only, a **stand-alone rule on spot gold**: not a gate, entry, exit or size of the live gold book, and none of
that book's 2006-17 positions was read (owner decision 44). No live rule, size, filter, stop, config, cost constant or council
member changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json`, `wtico.json`, `bco.json` at commit
  `f2370a08` (gold 2006-03-20 to 2026-11-13), weekends folded into Monday with `council/fills.mjs` `foldWeekend`; oil and
  gold matched by the UTC day stamp.
- Signal at gold's close of day i: oil's 10-day log return at or beyond the 10th / 90th percentile of its previous 500
  ten-day returns, AND gold's |10-day log return| at or under the median of its previous 500 (gold has not followed). Gold
  traded the way of oil from the next open, stop 3 x ATR(20), out at the close of the hold-th candle, one position at a time.
- T1 (primary) WTI, 3 days; T2 Brent, 3 days; T3 WTI, 10 days.
- Costs: $0.60 a round trip plus `nights()` x `FIN.xau.long` x entry on longs (0.000148 of price a rollover, the demo
  broker's long swap). Mean cost 0.017R a trade on the 3-day holds, 0.03R on the 10-day hold.
- Measured: the **excess** of each trade's net R over the same-side every-day baseline (a long and a short opened at every
  gold open of the window, same stop, hold and costs). t on calendar-month sums of excess; Holm over the three one-sided
  OOS p. Placebo: the real signal days with seeded random sides (40 seeds). Control: each signal moved to a random gold day of
  the same calendar year, keeping its side (40 seeds).

## The three tests (R a trade)

| Test | Window | Signal days | n (long / short) | Win % | Stops | Gross | Net | Net 2x costs | Baseline long / short | Excess | Excess 2x | Month t excess | Month t net |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 WTI, 3 days | IS 2007-16 | 225 | 120 (65 / 55) | 39.2 | 2 | −0.063 | −0.080 | −0.097 | −0.007 / −0.030 | −0.063 | −0.061 | −1.78 | −2.25 |
| T1 WTI, 3 days | OOS 2017 to 2026-10 | 224 | 116 (56 / 60) | 49.1 | 3 | −0.005 | −0.022 | −0.039 | +0.018 / −0.054 | −0.003 | −0.003 | −0.09 | −0.70 |
| T2 Brent, 3 days | IS | 225 | 114 (62 / 52) | 43.9 | 1 | −0.039 | −0.056 | −0.073 | −0.007 / −0.030 | −0.039 | −0.038 | −1.21 | −1.73 |
| T2 Brent, 3 days | OOS | 220 | 123 (60 / 63) | 51.2 | 3 | +0.006 | −0.009 | −0.025 | +0.018 / −0.054 | +0.009 | +0.010 | 0.30 | −0.30 |
| T3 WTI, 10 days | IS | 225 | 73 (38 / 35) | 41.1 | 11 | −0.018 | −0.048 | −0.078 | +0.011 / −0.072 | −0.020 | −0.016 | −0.23 | −0.56 |
| T3 WTI, 10 days | OOS | 224 | 70 (34 / 36) | 48.6 | 14 | −0.073 | −0.107 | −0.142 | +0.070 / −0.135 | −0.072 | −0.072 | −0.95 | −1.38 |

| Test | OOS p (one-sided) | Holm p | OOS t ≥ 2 and Holm < 0.05 | IS excess > 0 | OOS at 2x > 0 | Placebo: draws ≥ real (OOS) | Control: draws ≥ real (OOS) | Pass |
|---|---|---|---|---|---|---|---|---|
| T1 (primary) | 0.536 | 1.000 | no | no | no | 21 of 40 (median t +0.04) | 28 of 40 (median t +0.46) | no |
| T2 | 0.382 | 1.000 | no | no | no | 19 of 40 (median t +0.18) | 18 of 40 (median t +0.18) | no |
| T3 | 0.829 | 1.000 | no | no | no | 37 of 40 (median t −0.04) | 32 of 40 (median t −0.02) | no |

In sample (IS) the placebo and control beat the real T1 in 40 of 40 draws each (the real IS excess t is −1.78): gold went
the OTHER way of oil a little more often than chance in 2008-16, and that did not carry into 2017-26 either (OOS excess
−0.003R, t −0.09).

## Reading

- Out of sample the signal adds nothing to gold's own drift for the side taken: every OOS excess is within ±0.07R of zero and
  every month t is under 1 in size; no test is above the placebo or the control.
- The net figures look worse than the excess because the shorts carry gold's 2017-26 rise (the every-day short lost
  −0.054R a 3-day trade and −0.135R a 10-day trade): the baseline takes that out, as pre-registered.
- Two signal markets and two holds agree: neither a WTI nor a Brent surge or collapse that gold has not yet followed tells
  which way gold goes next. Together with `gold-oil-lead` (one big oil day) and `gold-commodity-inflation` (a commodity
  basket), oil has now been read three ways as a lead for gold, with no pass.
- Not tested: an intraday catch-up, a lead of more than 10 days, oil measured against inflation expectations (breakevens are
  not on file beyond the weekly FRED cache), and any market other than gold.

## Files

- `run.mjs` (`fetch <dir>` copies the caches from `origin/council-data` with git, no network; `count <dir>` gives the counts
  of the pre-registration; `full <dir>` writes `result.json`), `result.json` (every figure above, every OOS trade, the 40
  placebo and 40 control t per test and window), `tests/gold-oil-catchup.test.mjs`. The candle copies were kept outside git
  and deleted after the run.
