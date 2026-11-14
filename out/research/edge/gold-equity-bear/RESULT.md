# Result: gold during US equity bear markets (14 Nov 2026)

**Verdict: FAIL, 0 of 3: gold bought while the S&P 500 is 10 % below its 52-week high makes -0.238R a trade over the plain gold buy out of sample 2017-26 (n 35, month t -0.96).**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any candle was read). Paper research only, a
**stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here was compared with or
applied to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changed.
No proposal is written.

## The rule (as registered)

Index day D is a bear day when its close is X or more below the highest close of the 252 index candles ending at D. Long
gold at the open of the first gold candle after D, stop 2 x ATR(20) of gold's daily candles before the entry (= 1R), out at
the close of the 20th candle or at the stop; one position at a time. Baseline: the same long from every non-bear day of the
window (overlapping). Costs: $0.60 a round trip plus `nights()` x `FIN.xau.long` (0.000148 of price a rollover). OANDA mid
daily candles (council-data `research/daily`), weekends folded into Monday. In sample 2007-16, out of sample 2017 to Oct 2026.

## Verdict table

R a trade; excess = net minus the baseline's mean net in the same window; t on calendar-month sums of the excess.

| test | window | n | gross | net | baseline net | excess | month t (excess) | month t (net) | x2 costs net | cost share | Holm p | placebo beaten |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 S&P 500 -10 % (primary) | 2007-16 | 47 | +0.239 | +0.151 | +0.018 | +0.133 | 0.72 | 0.82 | +0.063 | 0.37 | | |
| | 2017-26 | 35 | +0.106 | −0.016 | +0.221 | **−0.238** | **−0.96** | −0.07 | −0.139 | 1.15 | 1.00 | 5 of 40 |
| T2 S&P 500 -20 % | 2007-16 | 19 | +0.313 | +0.233 | +0.041 | +0.192 | 0.74 | 0.89 | +0.152 | 0.26 | | |
| | 2017-26 | 10 | +0.270 | +0.158 | +0.218 | −0.060 | −0.11 | 0.30 | +0.045 | 0.42 | 1.00 | 19 of 40 |
| T3 Nasdaq 100 -10 % | 2007-16 | 46 | +0.231 | +0.138 | +0.031 | +0.108 | 0.53 | 0.69 | +0.046 | 0.40 | | |
| | 2017-26 | 47 | +0.316 | +0.187 | +0.201 | −0.014 | −0.07 | 0.88 | +0.058 | 0.41 | 1.00 | 14 of 40 |

None passes: no out-of-sample excess is positive, no t reaches 1, every Holm p is 1.00, and T1's out-of-sample excess beats
only 5 of the 40 random-day placebos (it needed 38).

## Baseline comparison

The plain long gold buy (same entry, stop, hold and costs from every non-bear day) made +0.018R a trade net in 2007-16 and
+0.221R in 2017-26: that is gold's rise. Buying only inside an S&P 500 bear was +0.133R better than that in 2007-16 (t 0.72)
and −0.238R worse in 2017-26. The out-of-sample bear days are dominated by 2022,
a bear market made by Fed TIGHTENING: of the 35 trades, 20 were entered in 2022-23 and 11 of those were stopped. The
economic reason holds only for bears the central bank answers with easing; the drawdown alone cannot tell the two kinds apart
when the trade is placed.

## Stops and costs

Median stop: $42.5 (T1, 2007-16) and $49.8 (2017-26), well over the $10 floor. Costs are about 0.09-0.13R a trade, mostly
financing on 20 nights of a buy (mean 19.7-22.4 nights); the cost share is 0.26-0.42 of gross except T1 out of sample, where
the cost (0.122R) is larger than the gross (+0.106R).

## Not tested

Bears split by the central bank's response (rate cuts against hikes), other indices, short gold inside bears, holds other than
20 days. Any of these would need its own pre-registration; choosing one now after reading this table would be a re-fit.

## To repeat

`node research/edge/gold-equity-bear/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-equity-bear/run.mjs full <dir>`. Test: `tests/gold-equity-bear.test.mjs`.
