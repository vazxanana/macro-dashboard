# Result: spot gold after a 10-year bond shock it shrugged off (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold after yields jumped and gold held flat beats the year's every-day buy by +0.065R a trade net out of sample (n 98, month t 0.79), inside its placebo and control.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 561151de4, pushed alone before any return was computed; only
the event counts had been looked at). Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of
the live gold book, and none of the book's positions was read (docs/owner-decisions.md item 44). No live rule, size, filter,
stop, config, cost constant or council member changed. No proposal is written.

## What was tested

- Data: council-data `research/daily/xau.json` (traded) and `usb10y.json` (signal) at commit `38d484d7`, OANDA mid daily
  candles, UTC days, weekends folded into Monday (`council/fills.mjs` `foldWeekend`). `usb10y` is the bond PRICE (down = yields up).
- Event: on a common UTC day, the bond's return z (sd of its 250 previous common-day returns) is <= -1.0 (yields up hard, T1 / T3)
  or >= +1.0 (yields down hard, T2), AND gold's own z the same day is between -0.5 and +0.5: gold "ignored" the rates move.
  Events: yields-up 135 in sample (2007-03-14 to 2016), 115 out of sample (2017 to Oct 2026); yields-down 139 and 101.
  Gold's average same-day move on those days: -0.07 % / -0.05 % (yields-up), +0.05 % / +0.13 % (yields-down).
- Trade: gold's next daily open, stop 2 x ATR(20) (1R; about $38 in sample, $60-74 out of sample), gaps fill at the open, out at
  the close of the hold's last candle, one at a time. Costs $0.60 a round trip plus `nights` x `FIN.xau.long` x entry on buys.
- Excess = net R minus the mean net R of the same side and hold entered at every gold candle of the same year. t on
  calendar-month sums of excess R; one-sided OOS p, Holm over the three tests.

## The three tests (R a trade)

| Test | Window | Events | n | Gross R | Net R | Excess net | Month t net | Month t excess | Net at 2x | Excess at 2x | Win % |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 yields up, gold flat, buy 5 days (primary) | 2007-16 | 135 | 115 | +0.080 | +0.030 | +0.034 | 0.46 | 0.52 | -0.019 | +0.032 | 48.7 |
| | 2017-26 | 115 | 98 | +0.149 | +0.095 | +0.065 | 1.12 | **0.79** | +0.041 | +0.064 | 58.2 |
| T2 yields down, gold flat, sell 5 days | 2007-16 | 139 | 112 | +0.055 | +0.036 | +0.108 | 0.56 | 1.65 | +0.018 | +0.108 | 51.8 |
| | 2017-26 | 101 | 83 | +0.017 | +0.002 | +0.095 | 0.03 | **0.99** | -0.012 | +0.095 | 43.4 |
| T3 yields up, gold flat, buy 1 day | 2007-16 | 135 | 135 | +0.035 | +0.012 | +0.027 | 0.35 | 0.81 | -0.012 | +0.026 | 50.4 |
| | 2017-26 | 115 | 115 | +0.085 | +0.063 | +0.072 | 1.65 | **1.90** | +0.041 | +0.071 | 60.0 |

| Test | OOS p (one-sided) | Holm p | t >= 2 and Holm < 0.05 | IS excess > 0 | 2x net and excess > 0 | Events >= 100 | Placebo 38/40 | Control 38/40 | Pass |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.215 (Holm 0.322) | 0.322 | no | yes | yes | yes | no (33) | no (35) | no |
| T2 | 0.161 (Holm 0.322) | 0.322 | no | yes | no | yes | no (34) | no (31) | no |
| T3 | 0.0287 (Holm 0.0861) | 0.0861 | no | yes | yes | yes | yes (38) | yes (39) | no |

## Placebo and control (out of sample, 40 seeds each, real month t of excess against the draws)

Placebo = the same number of random eligible OOS days, same side, hold and baseline. Control = the bond's z shuffled among the
days of each calendar year (same yearly drift and spread of bond moves, no day alignment), gold's days and its quiet-day filter
kept real, so it asks whether the bond shock adds anything to "gold had a quiet day".

| Test | Real t | Placebo: real above | Placebo median / 5th / 95th | Control: real above | Control median / 5th / 95th |
|---|---|---|---|---|---|
| T1 | 0.79 | above 33 of 40 | -0.09 / -1.54 / 1.96 | above 35 of 40 | -0.06 / -1.47 / 1.37 |
| T2 | 0.99 | above 34 of 40 | 0.04 / -2.18 / 1.56 | above 31 of 40 | 0.06 / -2.11 / 2.11 |
| T3 | 1.90 | above 38 of 40 | 0.33 / -1.00 / 1.99 | above 39 of 40 | 0.29 / -1.24 / 1.56 |

## Reading

- The primary (buy for a week after gold ignored a yield jump) is positive in both windows, but small: +0.034R and +0.065R a
  trade over the year's plain buy, month t 0.52 and 0.79, and sits among the placebo and control draws. Not an edge.
- All three tests have the hypothesis's sign in both windows (T2's sell beats the year's plain sell by about +0.1R in both),
  which is worth saying, but none reaches the bar; T2 also loses at 2x costs out of sample.
- T3, the one-day buy, is the closest: OOS excess t 1.90 (one-sided p 0.029, Holm 0.086), above 38 of 40 placebos and 39 of 40
  controls, positive in sample (t 0.81). It misses condition 1 (t >= 2 and Holm < 0.05). It was one of three tests fixed in
  advance; it is not promoted after the fact, and any follow-up would need its own pre-registration on other data.
- Gold did hold flat on those days by construction; what it did next is mostly what gold did on any day of those years.

## Files

- `research/edge/gold-rates-shrug/PREREGISTRATION.md`, `run.mjs`, `RESULT.md`, `result.json`; `tests/gold-rates-shrug.test.mjs`.
- To repeat: `node research/edge/gold-rates-shrug/run.mjs fetch <dir>` (git show from `origin/council-data`, no network),
  then `node research/edge/gold-rates-shrug/run.mjs full <dir>`. The candle copies were deleted after the run.
