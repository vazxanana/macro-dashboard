# Result: is the gold / copper ratio a fear gauge for spot gold? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold on a 20-day high of the gold/copper ratio made -0.048R a trade less than the every-day buy out of sample 2017-26 (n 120, excess month t -0.67).**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit ba8fa48cf, pushed alone before any return was computed).
Paper research only, a **stand-alone rule on spot gold**: not a gate, entry, exit or size of the live gold book, and nothing
here was compared with or applied to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant or
council member changed. No proposal is written.

## What was tested

- The macro reading: copper is a growth metal, gold a fear metal, so a gold / copper ratio at a new high says fear is gaining
  and should lead gold up; a new low (growth gaining) should lead gold down.
- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json` and `xcu.json` at commit `bd4865a8` (gold
  2006-03-20 to 2026-11, copper from 2003), weekends folded into Monday with `council/fills.mjs` `foldWeekend`, days matched by
  UTC day stamp.
- Q = ln(gold / copper). T1 (primary): Q above its 19 previous rows → buy gold. T2: below them → sell. T3: the copper-driven
  part, Q at that extreme while gold's own close is not beyond its 19 previous closes the same way → gold the ratio's way.
- Entry at gold's next daily open, out at the 5th candle's close or the stop (2 x ATR(20); an open through the stop fills at
  the open), one position at a time. Costs $0.60 a round trip plus `nights()` x `FIN.xau.long` (0.000148 of price a rollover)
  on buys.
- **Excess** = a trade's net R minus the baseline: the same side traded on every eligible day of the window (overlapping, same
  entry, stop, hold and costs). t on calendar-month sums (empty months 0); Holm over T1-T3 on the one-sided OOS excess p.
  In sample 2007-16, out of sample 2017 to 2026-10. Placebo: 40 seeded draws of random OOS days with the test's sides shuffled.
  Control: 40 seeds, each real OOS trade moved to a random day of the same calendar year with the same side (each year's drift
  and volatility kept, the signal's timing removed).

## The three tests (R a trade)

| Test | Window | n (long / short) | Win % | Gross | Net | Net at 2x costs | Baseline (buy / sell) | Excess | Excess at 2x | Month t net | Month t excess | Month t gross |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 ratio high, buy | 2007-16 | 130 (130 / 0) | 52.3 | +0.042 | -0.006 | -0.054 | -0.003 / – | -0.004 | -0.004 | -0.12 | -0.07 | 0.77 |
| T1 ratio high, buy | 2017-26 | 120 (120 / 0) | 50.0 | +0.069 | +0.015 | -0.038 | +0.063 / – | -0.048 | -0.050 | 0.22 | -0.67 | 0.95 |
| T2 ratio low, sell | 2007-16 | 136 (0 / 136) | 41.2 | -0.033 | -0.050 | -0.067 | – / -0.063 | +0.013 | +0.013 | -0.89 | 0.23 | -0.58 |
| T2 ratio low, sell | 2017-26 | 131 (0 / 131) | 44.3 | -0.071 | -0.084 | -0.097 | – / -0.109 | +0.025 | +0.026 | -1.38 | 0.41 | -1.17 |
| T3 copper-driven | 2007-16 | 214 (96 / 118) | 48.6 | +0.044 | +0.013 | -0.018 | -0.003 / -0.063 | +0.049 | +0.049 | 0.28 | 1.06 | 0.96 |
| T3 copper-driven | 2017-26 | 197 (82 / 115) | 48.2 | -0.001 | -0.031 | -0.061 | +0.063 / -0.109 | +0.006 | +0.006 | -0.57 | 0.11 | -0.02 |

Mean risk (2 x ATR) $40 in sample, $57-78 out of sample; costs 0.01-0.05R a trade.

## Holm, placebo and control (out of sample, on the excess month t)

| Test | One-sided p | Holm p | Placebo: real beats (of 40), median t | Control: real beats (of 40), median t, mean excess |
|---|---|---|---|---|
| T1 | 0.749 | 1 | 9 (median -0.10) | 11 (median -0.26, mean excess -0.002) |
| T2 | 0.341 | 1 | 29 (median -0.09) | 23 (median 0.30, mean excess +0.008) |
| T3 | 0.456 | 1 | 25 (median -0.19) | 27 (median -0.24, mean excess -0.014) |

## Reading

- **T1 (primary) fails every line of the bar.** Out of sample the ratio-high buys made +0.015R net, but the plain every-day buy
  made +0.063R in the same years (gold's 2017-26 rise): the signal's buys were 0.048R a trade worse than buying any day, and
  the real excess t (-0.67) is beaten by most placebo and same-year control draws. In sample both are near zero.
- **T2**: selling on a ratio low loses less than selling every day (+0.013R / +0.025R excess), but it loses money on its own in
  both windows (net -0.050R / -0.084R, month t -0.89 / -1.38) and the excess t (0.41) is nowhere near 2.
- **T3**, the copper-driven part, had the best in-sample excess (+0.049R, t 1.06) and none out of sample (+0.006R, t 0.11);
  its buys trail the every-day buy out of sample (-0.052R) and its sells beat the every-day sell (+0.047R), the two cancelling.
- The control keeps each year's drift and volatility and lands where the signal does: whatever the ratio says over a week, it
  adds nothing to knowing the year. Not an edge, not a gate or filter for anything, and not evidence that copper and gold are
  unrelated (only that a 20-day ratio extreme does not time gold over the next five days).

## To repeat

`node research/edge/gold-copper-gauge/run.mjs fetch <dir>` (git show from `origin/council-data`, no network, two files kept
out of git), then `node research/edge/gold-copper-gauge/run.mjs full <dir>`. Test: `tests/gold-copper-gauge.test.mjs`.
