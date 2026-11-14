# Result: buy gold when platinum's own short trend is up and gold's is down (14 Nov 2026)

**Verdict: FAIL, 0 of 2: the platinum catch-up long made +0.078R a trade net OOS 2017-26 (n 116, month t 1.2), lost in 2007-16 and beat only 25 of 40 gold-below-SMA20 placebos.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any outcome was computed; only signal and entry
counts were looked at). Paper research only, a **stand-alone rule on spot gold**: not a gate, entry, exit or size of the live
gold book, and that book's 2006-17 positions were not read (owner decision 44). Platinum and silver were read, never traded. No
live rule, size, filter, stop, config, cost constant or council member changed. No proposal is written. Not an edge.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json`, `xpt.json`, `xag.json` at commit `cb50bb73`,
  weekends folded with `foldWeekend`.
- T1 (primary): platinum close above its 20-day average and gold close below its own → buy gold at the next open, stop
  2 x ATR(20), out at the 5th close, one at a time. T2: platinum OR silver above its 20-day average, gold below.
- Costs: $0.60 a round trip plus `nights()` x `FIN.xau.long` x entry on every buy (median stop $37 in 2007-16, $48 in 2017-26).
- Baseline: the same long after every eligible day of the same calendar year. Placebo: 40 seeds, the same number of signal days
  per year drawn from the days gold closed below its own 20-day average (gold's state, drift and volatility kept, the platinum /
  silver information removed).

## Results (R a trade)

| Test | Window | n | Win % | Gross | Net | Net x2 cost | Month t net | Month t gross | Excess over same-year long | Excess month t | Total net R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 2007-16 | 105 | 41.0 | -0.021 | -0.068 | -0.115 | -1.06 | -0.33 | -0.076 | -1.23 | -7.15 |
| T1 | 2017-26 | 116 | 57.8 | +0.130 | +0.078 | +0.027 | 1.2 | 2 | +0.021 | 0.34 | +9.07 |
| T2 | 2007-16 | 133 | 48.1 | +0.070 | +0.023 | -0.024 | 0.38 | 1.17 | +0.017 | 0.3 | +3.03 |
| T2 | 2017-26 | 137 | 54.0 | +0.091 | +0.040 | -0.010 | 0.71 | 1.63 | -0.016 | -0.29 | +5.54 |

| Test | OOS p (one-sided) | Holm p | Placebo t beaten | Placebo median t / 95th | Placebo median net |
|---|---|---|---|---|---|
| T1 | 0.115 | 0.23 | 25 of 40 | 0.91 / 2.36 | +0.054 |
| T2 | 0.239 | 0.239 | 20 of 40 | 0.73 / 2.23 | +0.046 |

Checks for T1: OOS t >= 2 with Holm < 0.05 no; in sample positive no; x2 costs positive yes; beats the same-year long yes
(+0.021R, t 0.34); placebo 38 of 40 no; n >= 30 yes.

## Reading

The out-of-sample gain is gold's own drift: buying gold on any day it sat below its 20-day average in 2017-26 made +0.054R a
trade (placebo median), and the unconditional same-year long +0.061R; the platinum condition adds +0.02R, well inside noise, and
in 2007-16 it lost against both. Adding silver (T2) does no better. Platinum's (or silver's) short trend does not tell when a
lagging gold catches up. Costs are not the reason (cost share 0.40 of the gross OOS move).

## Not done, on purpose

No other average length, hold, stop, metal or short side was tried after seeing these numbers.

To repeat: `node research/edge/gold-platinum-catchup/run.mjs fetch <dir>` (git show from `origin/council-data`, no network),
then `… full <dir>`. Tests: `tests/gold-platinum-catchup.test.mjs`.
