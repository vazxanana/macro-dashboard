# Result: gold after a large Asian-session dollar move against the yen or the Australian dollar (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold 07-20 UTC after the dollar falls hard against the yen in Asia lost -0.042R a trade net out of sample 2017-26 (n 166, month t -0.98), below the every-day buy.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 46489ff25, pushed alone before any gold outcome was
computed). Paper research only, a **new stand-alone intraday rule on gold**: not a gate, entry, exit or size of the live gold
book, and nothing here was compared with or applied to that book or its 2006-17 positions (owner decision 44). No live rule,
size, filter, stop, config, cost constant or council member changed. No proposal is written.

## What was tested

- Data: OANDA mid H1 candles via the site's proxy (`/md/bars`), `xau`, `usdjpy`, `audusd`, June 2006 to 30 Oct 2026 (124,242
  gold candles, 5,139 eligible gold days). Cache kept outside git and deleted after the run.
- Signal: a currency's Asian move = ln(close of the 06:00 UTC candle / open of the 00:00 UTC candle), divided by the sd of its
  60 previous Asian moves (the day itself excluded). T1 (primary): USD/JPY z <= -1.5, buy gold. T2: USD/JPY z >= +1.5, sell
  gold. T3: AUD/USD |z| >= 1.5, gold the same way as AUD/USD.
- Trade: gold's 07:00 UTC H1 open to the close of the 19:00 UTC candle, stop 1 x ATR(20) of gold's UTC daily candles before the
  day (1R; median $18-24), stop first, a gap through it fills at the open. Costs $0.60 a round trip plus `nights` x
  `FIN.xau.long` x entry on buys (a 07-20 UTC hold crosses no 22:00 UTC rollover: 0 here); also at 2x costs.
- Baseline: the same trade on every eligible day of the window, same side. Excess = net R a trade minus that baseline's mean.
- In sample 2007-16, out of sample 2017 to Oct 2026. t on calendar-month sums (every month counted); Holm over T1-T3 on the
  one-sided p of the out-of-sample excess. Placebo: 40 seeded draws of the same buys / sells on random days of the window.
  Control: 40 seeded draws keeping each signal's year and side, on random days of that same year (drift and volatility kept,
  the currency signal removed).

## Results (R a trade)

| Test | Window | n | Gross R | Net R | Net at 2x | Baseline | Excess | Month t gross | Month t net | t excess | Total net R | Won | Stopped | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 yen up in Asia, buy (primary) | IS 2007-16 | 184 | +0.110 | +0.073 | +0.037 | -0.046 | +0.119 | +2.14 | +1.45 | +2.30 | +13.52 | 51.6 % | 16 | |
| | OOS 2017-26 | 166 | -0.014 | -0.042 | -0.071 | -0.012 | -0.030 | -0.32 | -0.98 | -0.71 | -7.01 | 50.6 % | 20 | 0.76 |
| T2 yen down in Asia, sell | IS 2007-16 | 131 | +0.124 | +0.089 | +0.055 | -0.008 | +0.098 | +2.37 | +1.75 | +1.90 | +11.72 | 57.3 % | 9 | |
| | OOS 2017-26 | 156 | +0.054 | +0.025 | -0.004 | -0.038 | +0.063 | +0.99 | +0.46 | +1.16 | +3.89 | 46.8 % | 10 | 0.34 |
| T3 AUD/USD in Asia, follow | IS 2007-16 | 329 | +0.007 | -0.027 | -0.060 | -0.028 | +0.001 | +0.16 | -0.61 | +0.02 | -8.82 | 44.7 % | 44 | |
| | OOS 2017-26 | 302 | +0.045 | +0.017 | -0.011 | -0.025 | +0.043 | +1.29 | +0.50 | +1.21 | +5.26 | 50.7 % | 33 | 0.34 |

T3 out of sample: 148 buys, 154 sells; in sample 170 / 159.

## Placebo and control (mean net R a trade of 40 seeded draws)

| Test | Window | Test net R | Placebo 95th pct | Beats placebo | Control 95th pct | Beats control |
|---|---|---|---|---|---|---|
| T1 | IS | +0.073 | +0.025 | 40 of 40 | +0.042 | 40 of 40 |
| T1 | OOS | -0.042 | +0.048 | 10 of 40 | +0.074 | 10 of 40 |
| T2 | IS | +0.089 | +0.087 | 39 of 40 | +0.088 | 39 of 40 |
| T2 | OOS | +0.025 | +0.060 | 35 of 40 | +0.041 | 36 of 40 |
| T3 | IS | -0.027 | +0.022 | 18 of 40 | +0.026 | 16 of 40 |
| T3 | OOS | +0.017 | +0.017 | 39 of 40 | +0.023 | 37 of 40 |

## Reading

- The primary test looked real in sample (excess +0.119R a trade, t 2.30, above all 40 placebos and controls) and vanished out of
  sample: -0.042R net, excess -0.030R, beaten by 30 of 40 placebo draws. T2 points the same way out of sample (+0.063R excess,
  t 1.16) but is too weak and negative at 2x costs. T3 is noise in sample and weak out of sample.
- The cost is small (about 0.03R a trade at a $18-24 stop), so the failure is not the cost: the gross out-of-sample excess of
  the primary is negative.
- Not an edge; never a council rule, filter or bias. Nothing live changed.

## To repeat

`node --use-env-proxy research/edge/gold-asia-fx-move/run.mjs fetch <dir>` (candles outside git), then
`node research/edge/gold-asia-fx-move/run.mjs count <dir>` (signal counts) and `… full <dir>`. Test:
`tests/gold-asia-fx-move.test.mjs`.
