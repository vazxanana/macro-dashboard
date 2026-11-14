# Result: do the commodity currencies lead spot gold? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: trading gold the way of a dollar-neutral AUD/NZD/CAD/ZAR week lost -0.101R a trade net out of sample 2017-26 (n 144, month t -1.83); the raw and monthly forms lose too.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 3b26c49c0, pushed alone before any number was computed).
Paper research only, a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book, and nothing here
was compared with or applied to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant or
council member changed. No proposal is written.

## What was tested

- The published claim: Chen, Rogoff and Rossi (Quarterly Journal of Economics 2010) find that commodity-exporter currencies
  forecast commodity prices, because a floating exchange rate prices the expected terms of trade first. Australia and South
  Africa are among the largest gold producers.
- Data: OANDA mid daily candles (UTC), council-data `research/daily/` at commit `e3dbfa18` (gold 2006-03-20 to 2026-11-06),
  weekends folded into Monday with `council/fills.mjs` `foldWeekend`. Commodity-currency index CC = the equal-weight mean of
  the log returns of AUD/USD, NZD/USD, 1/USD/CAD, 1/USD/ZAR; dollar index = the ICE DXY on six pairs.
- Weekly rows on gold's last candle of each Monday week. T1 (primary): the CC week's residual after the dollar (OLS on the
  52 earlier weeks) beyond 1 sd, gold the same way for 5 candles, stop 2 x ATR(20). T2: the raw CC week (the papers'
  regressor), same trade. T3: the sum of the last 4 weekly residuals beyond 1 sd, gold for 20 candles, stop 3 x ATR(20).
- Entry at gold's next daily open; an open through the stop fills at the open; one position at a time. Costs $0.60 a round
  trip plus financing on longs by `nights()` x `FIN.xau.long` (0.000148 of price a rollover, today's demo rate every year).
  Stops are wide ($44-109 on average), so costs are 0.03-0.05R a trade.
- t on calendar-month sums of net R (empty months count as 0), Holm over T1-T3 on the one-sided OOS p. In sample = signal
  weeks 2007-03 to 2016-12; out of sample 2017-01 to 2026-10. Placebo: 40 seeded draws of the same sides on random eligible
  OOS weeks.

## The three tests

| Test | Window | n (long / short) | Win % | Gross R a trade | Net R a trade | Net at 2x costs | Total net R | Month t gross | Month t net | Stops |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 residual week | IS 2007-16 | 135 (63 / 72) | 51.9 | +0.027 | -0.001 | -0.030 | -0.19 | 0.40 | -0.02 | 22 |
| T1 residual week | OOS 2017-26 | 144 (73 / 71) | 45.1 | -0.069 | -0.101 | -0.132 | -14.47 | -1.26 | -1.83 | 35 |
| T2 raw week | IS 2007-16 | 131 (57 / 74) | 54.2 | +0.045 | +0.018 | -0.009 | +2.32 | 0.65 | 0.26 | 23 |
| T2 raw week | OOS 2017-26 | 156 (72 / 84) | 47.4 | -0.033 | -0.063 | -0.092 | -9.77 | -0.60 | -1.14 | 30 |
| T3 residual 4 weeks | IS 2007-16 | 60 (28 / 32) | 45.0 | -0.013 | -0.055 | -0.097 | -3.31 | -0.11 | -0.46 | 16 |
| T3 residual 4 weeks | OOS 2017-26 | 69 (32 / 37) | 46.4 | -0.006 | -0.057 | -0.109 | -3.97 | -0.05 | -0.48 | 23 |

| Test | OOS p (one-sided) | Holm p | Placebo: real t above n of 40 (median, 5th / 95th pct) | Pass |
|---|---|---|---|---|
| T1 | 0.966 | 1 | 10 (-0.85; -2.49 / +1.10) | no |
| T2 | 0.873 | 1 | 17 (-0.72; -2.50 / +1.20) | no |
| T3 | 0.684 | 1 | 17 (-0.29; -2.96 / +1.48) | no |

## Reading

- No test comes near the bar: every OOS month t is negative, every Holm p is 1, and each real t sits inside its placebo
  range. Before costs the out-of-sample means are also below zero (-0.069R, -0.033R, -0.006R a trade), so the costs are not
  what kills it: there is no lead to pay for.
- By side (reported, not judged): the longs did better than the shorts in every window (T1 OOS longs -0.034R, shorts
  -0.169R; T3 OOS longs +0.219R, shorts -0.297R). That is gold's rise over 2017-26, which costs any symmetric rule on its
  short side, not information from the currencies (the placebo, which keeps the same long / short mix, has a negative
  median for the same reason).
- The dollar explains much of the commodity currencies' week (median beta of CC on the DXY -0.76 in sample, -0.98 out of
  sample), and what is left does not lead gold over the following week or month. This fits Ferraro, Rogoff and Rossi
  (2015): at short horizons the link is contemporaneous, not predictive.

Not an edge; no proposal; nothing live changed. To repeat: `node research/edge/gold-commodity-fx-lead/run.mjs fetch <dir>`
(no network: `git show origin/council-data`), then `… full <dir>`. Test: `tests/gold-commodity-fx-lead.test.mjs`.
