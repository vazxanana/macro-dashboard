# Result: does a commodity-price impulse lead spot gold? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: gold the way of a strong eight-commodity month lost -0.100R a trade net out of sample 2017-26 (n 69, month t -0.86); the residual and quarter forms lose too.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 334bc769e, pushed alone before any number was computed).
Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here
was compared with or applied to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant or
council member changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC) from council-data `research/daily/` at commit `9fe2c7ac` (gold 2006-03-20 to
  2026-11-06), weekends folded into Monday with `council/fills.mjs` `foldWeekend`. Basket = equal-weight mean of the weekly
  log returns of WTI, Brent, natural gas, corn, wheat, soybeans, sugar and copper, at gold's last close of each week.
- T1 (primary): the basket's last 4 weeks beyond ±1 sd (sd from the 52 weeks before) → gold the same way at the next daily
  open, held 20 candles. T2: the part of those 4 weeks gold did not follow (residual of the basket on gold, 52-week fit).
  T3: the last 13 weeks. Stop 3 x ATR(20), one position at a time. Costs $0.60 a round trip plus `nights` x `FIN.xau.long`
  on longs. In sample 2007-16, out of sample 2017 to 2026-10; t on calendar-month sums; Holm over the three; 40-seed placebo.

## Results (R a trade; t on calendar-month sums of net R)

| Test | Window | n | longs / shorts | gross | net | net at 2x costs | month t net (gross) | Holm p | placebo beaten |
|---|---|---|---|---|---|---|---|---|---|
| T1 month impulse | IS 2007-16 | 76 | 36 / 40 | +0.156 | +0.107 | +0.059 | 1.04 (1.49) | | |
| T1 month impulse | OOS 2017-26 | 69 | 36 / 33 | -0.047 | -0.100 | -0.153 | -0.86 (-0.39) | 1.00 | 10 of 40 |
| T2 gold behind basket | IS | 78 | 44 / 34 | +0.096 | +0.041 | -0.014 | 0.42 (0.97) | | |
| T2 gold behind basket | OOS | 78 | 35 / 43 | -0.013 | -0.063 | -0.112 | -0.58 (-0.12) | 1.00 | 14 of 40 |
| T3 quarter impulse | IS | 66 | 32 / 34 | +0.112 | +0.062 | +0.012 | 0.59 (1.04) | | |
| T3 quarter impulse | OOS | 66 | 36 / 30 | -0.121 | -0.174 | -0.226 | -1.54 (-1.06) | 1.00 | 3 of 40 |

Every test fails the OOS t, Holm, 2x-cost and placebo lines; each is positive in sample only.

## Against the unconditional same-side baseline

The same trade taken long (or short) on every eligible week, one at a time:

| Window | all-weeks long | all-weeks short | T1 longs | T1 shorts | T2 longs | T2 shorts | T3 longs | T3 shorts |
|---|---|---|---|---|---|---|---|---|
| IS 2007-16 | -0.006 (n 144) | -0.108 (n 142) | +0.195 | +0.028 | +0.101 | -0.038 | +0.192 | -0.061 |
| OOS 2017-26 | +0.192 (n 136, t 2.10) | -0.255 (n 150, t -3.24) | +0.162 | -0.386 | +0.120 | -0.211 | -0.030 | -0.346 |

In sample the basket's longs beat the all-weeks long by about 0.1-0.2R; out of sample every signal long is BELOW simply
being long gold (+0.192R), and the shorts are worse than shorting every week. The signal adds nothing to gold's own drift
out of sample (post hoc reading, not tested: the in-sample gain is consistent with the years gold and commodities moved
together, which did not repeat after 2017).

## Cost

Mean cost 0.05R a trade (spread and financing); cost share about 6-7 % of the absolute gross R. Median stop $57-81 (3 x daily
ATR). The failure is not the cost: the OOS gross is already negative in every test.

## Reading

Not an edge, never a council rule or filter. A month or a quarter of broad commodity inflation does not lead spot gold at a
tradeable horizon on 2017-26. Not tested (not pre-registered): other weights, energy or grains alone, other horizons.
To repeat: `node research/edge/gold-commodity-inflation/run.mjs fetch <dir>`, then `… full <dir>`. Test:
`tests/gold-commodity-inflation.test.mjs`.
