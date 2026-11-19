# Result: does gold catch up with the other havens? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: fading gold's weekly gap to the yen, franc and 10-year Treasury made -0.004R a trade net out of sample 2017-26 (n 159, month t -0.07); it beats 30 of 40 placebos.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 57cac646f, pushed alone before any number was computed).
Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here
was compared with or applied to that book; its 2006-17 positions were not read (owner decision 44). No live rule, size,
filter, stop, config, cost constant or council member changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/` at commit `0448a3d7` (gold from 2006-03-20, USD/JPY,
  USD/CHF, USB10Y), weekends folded into Monday with `council/fills.mjs` `foldWeekend`. Haven index H = the equal-weight mean
  of the weekly log returns of 1 / USD/JPY, 1 / USD/CHF and the US 10-year Treasury CFD.
- Weekly rows on gold's last candle of each Monday week. Gold's week regressed on H's week over the 52 weeks before (OLS);
  residual z beyond 1 sd. T1 (primary): fade it (gold lagged the havens: buy; ran ahead: sell), 5 candles, stop 2 x ATR(20).
  T2: the same, 10 candles, stop 3 x ATR(20). T3: the raw haven week beyond 1 sd, gold the same way, 5 candles, stop 2 x ATR(20).
- Entry at gold's next daily open; an open through the stop fills at the open; one position at a time. Costs $0.60 a round
  trip plus financing on longs by `nights()` x `FIN.xau.long` (0.000148 of price a rollover, today's demo rate every year).
- t on calendar-month sums of net R (empty months count as 0), Holm over T1-T3 on the one-sided OOS p. In sample = signal
  weeks 2007-04 to 2016-12; out of sample 2017-01 to 2026-10. Same-side baseline: the same trade entered on every eligible
  week, long and short. Placebo: 40 seeded draws of the same sides on random eligible OOS weeks.

## Results (R a trade; n = trades (longs / shorts))

| Test | Window | n | Gross | Net | Net x2 cost | Month t (net) | Stops | Median stop $ | Cost R | Net longs / shorts | Baseline long / short | Excess |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 2007-16 | 129 (67 / 62) | -0.016 | -0.043 | -0.070 | -0.75 | 23 | 40.8 | 0.027 | -0.056 / -0.029 | -0.012 / -0.042 | -0.017 |
| T1 | 2017-26 | 159 (77 / 82) | +0.023 | -0.004 | -0.032 | -0.07 | 34 | 55.13 | 0.028 | +0.148 / -0.147 | +0.044 / -0.119 | +0.035 |
| T2 | 2007-16 | 97 (50 / 47) | +0.014 | -0.014 | -0.041 | -0.22 | 14 | 60.31 | 0.027 | -0.044 / +0.019 | -0.015 / -0.051 | +0.019 |
| T2 | 2017-26 | 124 (57 / 67) | +0.036 | +0.005 | -0.025 | 0.09 | 24 | 76.64 | 0.030 | +0.215 / -0.173 | +0.075 / -0.148 | +0.051 |
| T3 | 2007-16 | 129 (66 / 63) | +0.056 | +0.026 | -0.004 | 0.40 | 19 | 38.71 | 0.030 | +0.020 / +0.032 | -0.012 / -0.042 | +0.052 |
| T3 | 2017-26 | 139 (66 / 73) | +0.080 | +0.049 | +0.019 | 0.81 | 17 | 47.81 | 0.030 | +0.155 / -0.047 | +0.044 / -0.119 | +0.090 |

| Test | OOS p (one-sided) | Holm p | Placebo t beaten of 40 |
|---|---|---|---|
| T1 | 0.528 | 0.928 | 30 (median -0.5, 95th 0.76) |
| T2 | 0.464 | 0.928 | 26 (median -0.36, 95th 0.9) |
| T3 | 0.209 | 0.627 | 38 (median -0.44, 95th 1.02) |

## Reading

- **T1, the primary, is flat**: out of sample -0.004R a trade net (gross +0.023R), month t -0.07; in sample it lost
  (-0.043R, t -0.75). The cost (0.028R a trade, $0.60 plus financing on wide $40-55 stops) is larger than the gross effect
  (cost share 1.19 out of sample). The OOS buys made +0.148R only because gold rose: buying every week made +0.044R and the
  shorts lost -0.147R against a short baseline of -0.119R. Against the same-side baseline the excess is +0.035R out of sample
  and -0.017R in sample: no consistent signal beyond drift.
- **T2** (the same signal held two weeks) is the same picture: +0.005R net OOS, t 0.09, negative in sample.
- **T3** (gold follows a strong haven week) is the best of the three and still far from the bar: +0.049R net OOS (t 0.81,
  Holm p 0.63), +0.026R in sample (t 0.40); its excess over the baseline is +0.090R OOS and +0.052R IS, and it beats exactly
  38 of 40 placebos, but the month t is under 1 in both windows. A hint at most, not a lead: n and t do not support it.
- Gold's beta on the haven index rose from a median 1.04 (in sample rows) to 1.34 (out of sample): gold moves more with the
  yen / franc / Treasury complex than it used to, and the part it does not share is not followed by a catch-up.

## What this does not say

- Not a judgement of gold as a haven: only of a weekly catch-up of gold's residual against these three markets.
- Not tested: other baskets, thresholds, horizons or stops (any of them now would be chosen after seeing this table).

To repeat: `node research/edge/gold-haven-catchup/run.mjs fetch <dir>` (git show from `origin/council-data`, no network),
then `node research/edge/gold-haven-catchup/run.mjs full <dir>`. Test: `tests/gold-haven-catchup.test.mjs`.
