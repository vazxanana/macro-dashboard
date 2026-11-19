# Result: gold follows its own FOMC-day reaction for two weeks (14 Nov 2026)

**Verdict: FAIL, 0 of 2: following gold's FOMC statement-day move for 10 days lost -0.114R a trade net in 2017-26 (n 77, month t -0.98) after +0.239R in 2007-16; 3 of 40 placebos beaten.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 8bdcb391d, pushed alone before any candle was read).
Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here
was compared with or applied to that book; its 2006-17 window and positions were not used (owner decision 44). No live rule,
size, filter, stop, config, cost constant or council member changed. No proposal is written.

## What was tested

- Data: OANDA mid daily XAU/USD (UTC), council-data `research/daily/xau.json` at commit `648d6b1e6`, weekends folded into
  Monday with `council/fills.mjs` `foldWeekend`; 2006-03-20 to 2026-11-06.
- Meetings: 159 scheduled FOMC statement days from 2007 (the list of branch `gold-fomc-cycle`; 2022 on from
  `council/events.mjs`). 155 gave a trade: 2007-08-07 and 2010-04-28 were dropped (an unscheduled announcement inside their
  window), 2026-10-28 has no complete 10-day window yet, 2026-12-09 is still ahead.
- Rule: side = the sign of close(statement day) / close(day before) - 1; entry at the next open, stop 2 x ATR(20) (1R; median
  $37 in sample, $49 out of sample), out at the close of the 10th candle or at the stop. $0.60 a round trip plus `nights` x
  `FIN.xau.long` x entry on buys. Baselines: the same window long after every meeting, and short after every meeting.
- T1 (primary) the follow stream, both sides, month t on calendar-month sums of net R; T2 each follow trade's net R minus the
  mean of the same-side baseline of its window, month t on the sums of that excess. Holm over both. Placebo: 40 seeded draws of
  random sides at the follow stream's 55 % long share.

## The tests (R a trade)

| Stream | Window | n (buys / sells) | gross | net | net at 2x costs | month t net (gross) | cost share |
|---|---|---|---|---|---|---|---|
| **Follow (T1)** | 2007-16 | 78 (44 / 34) | +0.290 | +0.239 | +0.187 | 2.12 (2.56) | 18 % |
| **Follow (T1)** | 2017-26 | 77 (46 / 31) | -0.061 | -0.114 | -0.167 | -0.98 (-0.52) | n/a (gross < 0) |
| Long after every meeting | 2007-16 | 78 | -0.053 | -0.125 | | -1.22 | |
| Long after every meeting | 2017-26 | 77 | +0.096 | +0.017 | | 0.14 | 82 % |
| Short after every meeting | 2007-16 | 78 | +0.056 | +0.039 | | 0.36 | 30 % |
| Short after every meeting | 2017-26 | 77 | +0.022 | +0.008 | | 0.07 | 65 % |
| Fade (reported) | 2007-16 | 78 | -0.287 | -0.324 | | -3.55 | |
| Fade (reported) | 2017-26 | 77 | +0.179 | +0.139 | | 1.08 | 22 % |

| Test | 2007-16 | 2017-26 | Holm p | placebo beaten | pass |
|---|---|---|---|---|---|
| T1 follow, net R a trade | +0.239 (t 2.12) | -0.114 (t -0.98) | 1.00 | 3 of 40 | no |
| T2 follow minus same-side baseline | +0.292 (t 2.61) | -0.128 (t -1.10) | 1.00 | | no |

## Against the baseline

The follow stream beat the unconditional same-side trades by +0.292R a trade in 2007-16 and fell behind them by -0.128R in
2017-26. The baselines themselves are near zero net in both windows (long +0.017R, short +0.008R out of sample), so the
in-sample result was the reaction's direction, not gold's drift, and it reversed: from 2017 the fade made +0.139R (t 1.08,
reported, not a test). The placebo's median is +0.025R and its 95th percentile +0.187R; the follow stream's -0.114R beats
only 3 of 40.

## Reported only

- Follow buys / sells, 2017-26: -0.119R (n 46) / -0.107R (n 31); in 2007-16 +0.107R / +0.409R.
- Hold 5 candles: +0.184R in sample, -0.130R out of sample; hold 20: +0.313R / -0.141R. Reading the reaction to the close of
  the next day and entering a day later: -0.158R / +0.029R. No hold rescues the out-of-sample window.
- By year (net R summed): positive in 8 of 10 years 2007-16, in 3 of 10 years 2017-26 (2017, 2023, 2026).

## Reading

A post-FOMC drift in gold was there in 2007-16 (t 2.1 net, in the direction of the statement day's move, on both sides) and
is gone since 2017; out of sample the sign flipped. Not an edge, not a lead; no follow-up is proposed. The costs were not the
cause: before costs the 2017-26 stream already lost (-0.061R).

To repeat: `node research/edge/gold-post-fomc-drift/run.mjs` (reads council-data with `git show`, no network). Test:
`tests/gold-post-fomc-drift.test.mjs`.
