# Result: weekly momentum of the gold / silver ratio, traded as a pair (14 Nov 2026)

**Verdict: FAIL, 0 of 3: following the 13-week gold / silver ratio trend for a week as a two-leg pair lost -0.024R a week net out of sample 2017-26 (n 513, month t -2.77), -0.032R in 2007-16.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone, commit `9809740f7`, before any R was computed; only
the signal weeks were counted). Paper research only, a **stand-alone relative-value rule**: not a gate, entry, exit or size of
the live gold book, and none of its 2006-17 positions is read (owner decision 44). No live rule, size, filter, stop, config,
cost constant or council member changed. No proposal is written. Not an edge.

## What was tested

- Data: OANDA mid daily candles, council-data `research/daily/xau.json`, `xag.json`, `xpt.json` at commit `d5a08193`
  (gold and silver 2006-03-20 to 2026-11-13, platinum from 2005-01-04), weekend stubs folded with `foldWeekend`, days matched
  by their UTC stamp.
- Signal at the last joint close of a week: the sign of ln(gold / metal) minus the same `look` weeks before. Ratio up → in
  the next calendar week long gold, short the metal; down → the reverse. Each leg enters at its first open of the week, has a
  fixed stop at 3 x ATR(20) (filled at the open when gapped) and leaves at its last close of the week; each leg risks 0.5R, so
  1R = both stops. Every week is its own round trip on both legs.
- Costs: round trip gold $0.60, silver $0.06, platinum $2.00 (assumed); `nights()` x 0.000148 of price on every long leg
  (`FIN.xau.long`, silver and platinum assumed equal); shorts credited nothing. Mean cost 0.028-0.035R a week, of which
  financing 0.008-0.009R.
- Windows by entry date: in sample 2007-01 to 2016-12 (120 months), out of sample 2017-01 to 2026-10 (118 months). t on
  calendar-month sums of net R; Holm over the three tests.

## The three tests

| Test | Window | n (long / short ratio) | Win % | Gross R a week | Net R a week | Net at 2x | Month t gross | Month t net | Total net R |
|---|---|---|---|---|---|---|---|---|---|
| T1 gold / silver, 13 weeks (primary) | IS 2007-16 | 521 (284 / 237) | 39.3 | +0.001 | −0.032 | −0.065 | +0.19 | −4.70 | −16.72 |
| | OOS 2017-26 | 513 (298 / 215) | 42.9 | +0.011 | −0.024 | −0.060 | +1.24 | −2.77 | −12.55 |
| T2 gold / platinum, 13 weeks | IS 2007-16 | 517 (285 / 232) | 42.7 | −0.000 | −0.028 | −0.056 | −0.01 | −3.09 | −14.47 |
| | OOS 2017-26 | 508 (312 / 196) | 40.4 | −0.008 | −0.036 | −0.065 | −0.71 | −3.24 | −18.45 |
| T3 gold / silver, 4 weeks | IS 2007-16 | 521 (283 / 238) | 39.5 | −0.000 | −0.034 | −0.067 | −0.04 | −4.73 | −17.58 |
| | OOS 2017-26 | 513 (271 / 242) | 38.6 | −0.006 | −0.042 | −0.077 | −0.70 | −4.46 | −21.32 |

Holm-adjusted p (one-sided, OOS month t): T1 1.00, T2 1.00, T3 1.00.

## Against the same pair trade every week

| Test | Window | Rule net | Random side, 40 seeds: median / 95th pct | Rule above n of 40 | Always long ratio | Always short ratio |
|---|---|---|---|---|---|---|
| T1 | IS | −0.032 | −0.034 / −0.020 | 26 | −0.029 | −0.038 |
| | OOS | −0.024 | −0.034 / −0.021 | 35 | −0.018 | −0.050 |
| T2 | IS | −0.028 | −0.027 / −0.010 | 17 | −0.014 | −0.041 |
| | OOS | −0.036 | −0.029 / −0.009 | 9 | −0.004 | −0.051 |
| T3 | IS | −0.034 | −0.034 / −0.020 | 22 | −0.029 | −0.038 |
| | OOS | −0.042 | −0.034 / −0.021 | 6 | −0.018 | −0.050 |

## Reading

- **Every pre-registered check fails for every test**: no OOS t is positive after costs, no in-sample mean is positive, all
  are negative at 2x costs, and none beats 38 of 40 random-side draws (best: T1 OOS above 35).
- Before costs the ratio trend is within 0.011R a week of zero in all six windows (largest gross month t +1.24, T1 out of
  sample). A week of a two-leg pair pays about 0.03R in spread, slippage and the long leg's financing, so the net is that cost.
- Following the trend is no better than the side taken at random, and worse than simply always holding gold long against the
  other metal (gold's relative drift against silver and platinum since 2017), which itself loses after costs.
- Market-neutral does not rescue it: holding no net gold removes gold's drift, and what is left is no signal at all.
- Not tested (no pre-registration): other lookbacks, a carried-over position without the weekly round trip, volatility-scaled
  legs. The gross figures leave no room a lower cost could open (gross t at most +1.24).

To repeat: `node research/edge/gold-silver-ratio-trend/run.mjs fetch <dir>` (git show from `origin/council-data`, no
network), then `… full <dir>`. Tests: `tests/gold-silver-ratio-trend.test.mjs`.
