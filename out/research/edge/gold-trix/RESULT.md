# Result: TRIX signal-line crosses on spot gold, against the same trade on every day (14 Nov 2026)

**Verdict: FAIL: 0 of 3 pass; the long after a TRIX bull cross did no better than the same trade after any day: -0.020R excess a trade net in 2017-26 (n 106, month t -0.25), +0.129R in 2007-16.**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit 55d3d66e4). Paper research: nothing live changed and no
proposal follows. **Item 44**: a new stand-alone daily rule judged on 2017-26; it is not a gate, exit, entry or size of the gold
book (Gold trend / Gold daily engulf), reads none of its trades and says nothing about it.

Rule: council-data `research/daily/xau.json` (OANDA mid, UTC days, 2006-03-20 to 2026-11-13, 5,369 days after folding weekend
candles into the next weekday with `council/fills.mjs` `foldWeekend`). TRIX = the one-day % change of EMA9(EMA9(EMA9(close))),
signal line = EMA5 of TRIX; a bull cross = TRIX closes above its signal line after closing at or below it the day before (bear
cross: the mirror). Trade: market at the next day's open, stop 2 x ATR(20) away (1R), a touch of the stop on the entry day is a
stop-out, a later open through the stop fills at the open, else out at the close of the fifth day. One position at a time.
**The baseline** is the same trade after EVERY day (no TRIX condition), so the primary test is the cross's excess over gold's
drift. Costs: $0.60 a round trip and `FIN.xau.long` (0.000148 of price a rollover) on longs; 2x costs doubles both. t =
calendar-month sums (every month counts, 0 when nothing closed), one-sided p, Holm over three; placebo = 40 seeded draws of
the same trade after a random day of the same year.

## The three tests

| Test | Window | n | Gross R | Net R | Tested mean | Month t (tested) | Month t (gross) | 2x costs | Holm p | Placebo beaten |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 long after a bull cross, excess (primary) | 2007-16 | 102 | +0.176 | +0.127 | **+0.129** | +1.90 | +2.60 | +0.129 | | |
| | **2017-26** | **106** | +0.096 | +0.042 | **-0.020** | **-0.25** | +1.23 | -0.020 | 0.88 | 15 of 40 |
| T2 short after a bear cross, excess | 2007-16 | 102 | -0.044 | -0.061 | +0.002 | +0.03 | -0.55 | +0.002 | | |
| | 2017-26 | 108 | -0.066 | -0.080 | +0.028 | +0.41 | -0.94 | +0.028 | 0.88 | 24 of 40 |
| T3 long after a bull cross, absolute net R | 2007-16 | 102 | +0.176 | +0.127 | +0.127 | +1.88 | +2.60 | +0.079 | | |
| | 2017-26 | 106 | +0.096 | +0.042 | +0.042 | +0.54 | +1.23 | -0.012 | 0.88 | 15 of 40 |

"Tested mean" is the excess net R for T1 / T2 (net R minus the baseline's mean net R in the same window) and the net R for T3.
Placebo seed means (2017-26, 5th / 50th / 95th percentile): T1 -0.170 / +0.007 / +0.093; T2 -0.094 / +0.008 / +0.135;
T3 -0.108 / +0.069 / +0.155. Every test sits in the middle of its placebo.

## The baselines (the same trade after every day)

| Side | Window | n | Gross R | Net R | 2x costs | Month t |
|---|---|---|---|---|---|---|
| Long | 2007-16 | 2,602 | +0.047 | -0.002 | -0.051 | -0.09 |
| Long | 2017-26 | 2,552 | +0.115 | +0.062 | +0.009 | +1.80 |
| Short | 2007-16 | 2,602 | -0.047 | -0.064 | -0.081 | -1.92 |
| Short | 2017-26 | 2,552 | -0.095 | -0.109 | -0.123 | -3.52 |

## What it means
- The primary test fails out of sample: after a bull cross the long made +0.042R a trade net in 2017-26, LESS than the same long
  taken after any day (+0.062R), so the excess is -0.020R (t -0.25). The in-sample excess (+0.129R, t 1.90) did not carry over.
- By year (T1 excess) 8 of 10 in-sample years are positive and 5 of 10 out-of-sample years: 2018, 2019, 2020, 2021 and 2026
  negative. What looked like a selection in 2007-16 was not stable.
- The short after a bear cross loses money in both windows (-0.061R, -0.080R net); it loses about what any short of gold lost
  (excess +0.002R, +0.028R, t under 0.5). The cross adds nothing on that side either.
- T3: the long does pay a little in absolute terms out of sample (+0.042R, t 0.54), but that is gold's drift, as the baseline
  shows; at 2x costs it turns negative (-0.012R).
- Costs are small for this trade (a 2 x ATR stop: $0.60 is 0.014R; financing 0.040R a long), so the verdict does not hinge on
  them: before costs the out-of-sample long excess is also under the baseline's gross (+0.096R against +0.115R).
- Not an edge, not a filter for anything. Only TRIX(9) / signal 5 / a 5-day hold was run (fixed before any outcome for the event
  count); other settings were not tried and would be a re-fit of this study.

## Files
- `run.mjs` (the study; pure pieces exported), `result.json` (every figure above, by year), `PREREGISTRATION.md`.
- To repeat: `git show origin/council-data:research/daily/xau.json > <dir>/xau.json`, then
  `node research/edge/gold-trix/run.mjs <dir>` (the cache stays out of git).
- Test: `tests/gold-trix.test.mjs`.
