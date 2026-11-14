# Result: does the US dollar lead spot gold when gold lags it? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold after a dollar down week that gold lagged makes +0.174R a trade net out of sample 2017-26 (n 30, month t 1.12); the mirror short and the daily version lose.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 19c7ff67e, pushed alone before any number was computed).
The dollar counterpart of `gold-bond-lead` (same trade, costs, windows and bar). Paper research only, a **standalone
cross-asset signal**: not a gate, entry, exit or size of the live gold book, and nothing here was compared with or applied
to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changed. No
proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json` and the six DXY pairs `eurusd`, `usdjpy`,
  `gbpusd`, `usdcad`, `usdsek`, `usdchf` at commit `717f3ffe` (gold 2006-03-20 to 2026-11-06; the index from 2004-06-01,
  where USD/SEK starts), weekends folded into Monday with `council/fills.mjs` `foldWeekend`. The dollar index is the ICE DXY
  formula of `council/macro.mjs` on the folded closes, a value only on a UTC day with all six pairs, with the real USD/SEK
  (the council's build uses 11.2 / EURUSD; that form is I3 below).
- Weekly signal (T1, T2): the index's weekly return as a z-score against the 52 weekly returns before it; gold's "lag" = its
  weekly return less beta x the dollar's, beta fitted on the same 52 earlier weeks (median beta −1.16 in 2007-16, −1.09 in
  2017-26: gold falls about 1.1 % for each 1 % the index rises, the same week). T1: z < −1 and lag < 0 (gold rose less than
  its co-move), long gold. T2: z > +1 and lag > 0, short gold. Entry at gold's Monday open, out at the close of the 5th gold
  candle.
- Daily signal (T3): the same with 250 earlier days (median beta −1.02 / −1.05); gold against the dollar, held one candle.
- Every trade: stop 2 x ATR(20) of gold's candles before the entry (1R), gaps through the stop fill at the open, one
  position at a time. Costs $0.30 spread + $0.15 slippage on each of the two market orders ($0.60 a trade) plus financing on
  longs by `nights()` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's long swap, today's rate every year).
  Mean stop $41-47 in sample, $59-75 out of sample, so costs are 0.014-0.046R a trade.
- t on calendar-month sums of net R (every month of the window counts, empty ones as 0), Holm over T1-T3 on the one-sided
  OOS p. In sample = signals from the first with full history (March 2007) to 2016; out of sample 2017-01 to 2026-10.

## The three tests

| Test | Window | n (long / short) | Win % | Gross R a trade | Net R a trade | Net at 2x costs | Total net R | Month t gross | Month t net | Stops |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 dollar down, gold lagged, long (primary) | IS 2007-16 | 28 (28 / 0) | 60.7 | +0.166 | +0.125 | +0.083 | +3.49 | 1.16 | 0.88 | 4 |
| | OOS 2017-26 | 30 (30 / 0) | 56.7 | +0.220 | +0.174 | +0.128 | +5.22 | 1.41 | **1.12** | 6 |
| T2 dollar up, gold lagged, short | IS 2007-16 | 47 (0 / 47) | 40.4 | -0.024 | -0.038 | -0.053 | -1.80 | -0.22 | -0.35 | 9 |
| | OOS 2017-26 | 44 (0 / 44) | 34.1 | -0.193 | -0.207 | -0.222 | -9.13 | -2.00 | **-2.14** | 8 |
| T3 dollar day, gold lagged, 1 day | IS 2007-16 | 388 (168 / 220) | 45.4 | -0.001 | -0.019 | -0.038 | -7.52 | -0.05 | -1.14 | 6 |
| | OOS 2017-26 | 344 (158 / 186) | 40.1 | -0.051 | -0.069 | -0.086 | -23.69 | -2.64 | **-3.51** | 9 |

| Test | OOS p (one-sided) | Holm p | OOS t >= 2 and Holm < 0.05 | IS net > 0 | OOS 2x > 0 | OOS n >= 30 | Pass |
|---|---|---|---|---|---|---|---|
| T1 | 0.131 | 0.394 | no | yes | yes | yes | no |
| T2 | 0.984 | 1 | no | no | no | yes | no |
| T3 | 1 | 1 | no | no | no | yes | no |

Placebo (40 seeds: the same number of random eligible OOS weeks / days, the real side mix, identical trade):

| Test | Real OOS month t | Seeds with t >= 2 | Seeds at or above the real t | Median / 5th / 95th percentile |
|---|---|---|---|---|
| T1 | 1.12 | 0 | 5 | 0.24 / -1.73 / 1.62 |
| T2 | -2.14 | 0 | 36 | -1.11 / -3.11 / 0.38 |
| T3 | -3.51 | 0 | 40 | -0.85 / -2.3 / 0.7 |

T1's placebo row equals `gold-bond-lead`'s: both draw 30 of the same aligned gold weeks with the same seeds and all-long
sides, so the draws and trades are identical. T1 sits above 35 of 40 random long weeks of 2017-26, below the bar.

## Informational (no test, not in Holm, not in the verdict)

| Row | Window | n | Gross R | Net R | 2x | Month t net |
|---|---|---|---|---|---|---|
| I1 every dollar down week > 1 sd, long (no lag condition) | IS | 69 | +0.061 | +0.017 | -0.028 | 0.20 |
| | OOS | 64 | +0.162 | +0.115 | +0.069 | 1.17 |
| I2 every dollar up week > 1 sd, short (no lag condition) | IS | 81 | +0.008 | -0.007 | -0.022 | -0.10 |
| | OOS | 76 | -0.101 | -0.115 | -0.128 | -1.60 |
| I3 T1 rule on the council's DXY build (USD/SEK = 11.2 / EURUSD) | IS | 26 | +0.083 | +0.043 | +0.002 | 0.31 |
| | OOS | 30 | +0.240 | +0.194 | +0.147 | 1.26 |

- The lag condition raises the long's mean (OOS +0.174R on 30 trades against +0.115R on 64 for every big dollar-down week)
  but not its month t (1.12 against 1.17): it halves the sample, so the evidence is no stronger.
- The council's own index (I3) gives the same picture; the USD/SEK leg (weight 0.042) does not matter.

## Reading

- Not an edge, and no proposal. T1 is positive in both windows before and after costs, and better than the bond version
  (+0.174R against +0.088R a trade), but at 30 trades in ten years its month t is 1.12 (bar 2) and the Holm p 0.39.
- The shorts lose: after a big dollar-up week gold went UP on average in 2017-26 (T2 and I2 negative, gross too). That is
  gold's rising decade, as the short placebo's own negative median (-1.11) shows; T2 sits inside its placebo spread.
- T3's out-of-sample t of -3.51 is the wrong side of the hypothesis, and below every one of the 40 random draws (5th
  percentile -2.3): on the day after a big dollar day that gold lagged, gold tended to keep lagging rather than catch up,
  by 0.05R a trade gross. It is not a finding: the test is one-sided by design, the in-sample half is flat (-0.001R gross),
  and a reverse ("fade the catch-up") rule chosen now would be post hoc and need its own pre-registration on other data.
- With `gold-bond-lead` (bond prices, the same design: FAIL), `intermarket-lead` F3 (the dollar's past month into metals:
  FAIL) and `macro-gold` (the broad dollar's 20-day fall: Sharpe 0.09), the dollar's lead on gold at the day, week and month
  horizons is closed on the council's data. The co-move is real and same-period (beta about −1.1); it does not carry into
  the next day or week by enough to trade.

## What was not tested

Other thresholds, look-backs, betas or holds; the broad trade-weighted dollar (FRED); single pairs (EUR/USD alone);
intraday timing; gold leading the dollar; any use inside the gold book.

## To repeat

`node research/edge/gold-dollar-lead/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-dollar-lead/run.mjs full <dir>`. Tests: `tests/gold-dollar-lead.test.mjs`.
