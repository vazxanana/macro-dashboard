# Result: fading (or following) gold's move that the dollar, Treasuries and US equities do not explain (14 Nov 2026)

**Verdict: FAIL, 0 of 3: fading a 5-day residual makes +0.017R a trade over the same-side baseline out of sample 2017-26 (n 86, month t 0.14, Holm p 1.00), -0.036R net; it beats 25 of 40 placebos.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any number was computed). Paper research only,
a **stand-alone rule on gold**: not a gate, entry, exit or size of the live gold book; the book's 2006-17 positions and window
were not used (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changed. No
proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json`, `eurusd`, `usb10y`, `spx500`, weekends folded
  with `council/fills.mjs` `foldWeekend`; 5,364 gold days, 5,341 joined with all three drivers.
- Signal: on each close, gold's daily log returns regressed on EUR/USD, the 10-year Treasury CFD and the S&P 500 CFD (with an
  intercept) over 60 joined days that end before the judged days (a 5-day gap); z = the sum of the last L days' residuals /
  (residual sd x sqrt L). |z| >= 2 -> fade (sell a rich gold, buy a cheap one) or follow. Entry at the next open, stop
  2 x ATR(14) never moved, out at the open H days later, one position at a time. Every trade has a stop.
- Costs: $0.60 a round trip, plus `nights x FIN.xau.long x entry` on buys. Excess = net R less the same-side every-day
  baseline's mean net R (the same trade entered at every open of the window). The primary statistic is the t on calendar-month
  sums of excess R (by exit month, every month counted).

## Results

| Test | Window | n | Win | Gross R | Net R | Net 2x costs | Excess R | Month t net | Month t excess | Total net | Worst DD | Median stop |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 fade, 5-day residual, 10 days (primary) | IS 2007-16 | 82 | 40 % | -0.060 | -0.098 | -0.136 | -0.049 | -0.87 | -0.44 | -8.05R | -11.78R | $39.56 |
| | OOS 2017-26 | 86 | 43 % | 0.002 | -0.036 | -0.074 | 0.017 | -0.28 | 0.14 | -3.07R | -10.59R | $51.31 |
| T2 fade, 20-day residual, 20 days | IS 2007-16 | 65 | 49 % | 0.133 | 0.078 | 0.022 | 0.131 | 0.62 | 1.04 | +5.04R | -5.97R | $39.18 |
| | OOS 2017-26 | 70 | 34 % | -0.126 | -0.172 | -0.219 | -0.091 | -1.20 | -0.67 | -12.07R | -17.19R | $60.40 |
| T3 follow, 5-day residual, 10 days | IS 2007-16 | 80 | 49 % | 0.057 | 0.014 | -0.029 | 0.048 | 0.14 | 0.48 | +1.12R | -8.78R | $39.76 |
| | OOS 2017-26 | 81 | 48 % | 0.179 | 0.131 | 0.084 | 0.147 | 1.09 | 1.24 | +10.65R | -6.82R | $52.88 |

Holm over the three OOS excess p-values: T1 1.00, T2 1.00, T3 0.65. Months: 120 IS, 118 OOS.

## The pass bar, check by check

| Check | T1 (primary) | T2 | T3 |
|---|---|---|---|
| OOS excess month t >= 2, Holm p < 0.05 | no (t 0.14) | no (t -0.67) | no (t 1.24, Holm p 0.65) |
| IS excess R positive | no (-0.049) | yes (+0.131) | yes (+0.048) |
| OOS net R > 0 at 2x costs | no (-0.074) | no (-0.219) | yes (+0.084) |
| Beats >= 38 of 40 placebos | no (25; placebo median -0.060R) | no (5; median -0.040R) | no (36; median +0.013R) |
| OOS n >= 30, median stop >= $10 | yes | yes | yes |

## Baseline comparison (the same trade at every open, net R a trade)

| Window | 10-day buy | 10-day sell | 20-day buy | 20-day sell |
|---|---|---|---|---|
| IS 2007-16 | +0.018 (n 2,602) | -0.096 | +0.053 | -0.124 |
| OOS 2017-26 | +0.114 (n 2,547) | -0.163 | +0.232 (n 2,537) | -0.245 |

Gold's rise shows plainly in the baseline: out of sample a random 10-day buy made +0.114R and a random sell lost -0.163R. The
rule's sides are close to balanced (T1 OOS 34 buys of 86), so its raw net R is pulled toward the average of the two baselines;
the excess column takes that out.

## What it shows

- **The residual carries no usable information at these horizons.** Fading a week of unexplained gold move (T1) is flat
  against the baseline in both windows (-0.049R IS, +0.017R OOS, t under 0.5) and its OOS halves disagree (2017-21 excess
  -0.075R, 2022-26 +0.106R). The slower fade (T2) reverses sign from in to out of sample (+0.131R -> -0.091R).
- **Following the residual (T3) is the best of the three and still nowhere near the bar**: +0.147R a trade over the baseline
  out of sample (both halves +0.147R), but t 1.24 on 118 months, Holm p 0.65, and only +0.048R in sample. Its OOS buys did
  better than its sells (+0.262R vs +0.017R excess), which is where most of the number comes from. A hypothesis at most; it
  would need its own pre-registration on other data, and it is not proposed.
- **Costs**: $0.60 and financing take 0.04-0.06R a trade (median stop $39-60, 2 x ATR(14)). As a share of gross R: T1 63 % in
  sample and many times the near-zero gross out of sample; T2 42 % / 37 %; T3 75 % / 26 %. Costs are not what sinks these
  rules: the gross excess is near zero.

Not an edge on any test; do not use the multi-factor residual as a gold rule, filter or bias. Nothing live changed and no
proposal is written.

To repeat: `node research/edge/gold-factor-residual/run.mjs fetch <dir>` (git show from `origin/council-data`, no network),
then `node research/edge/gold-factor-residual/run.mjs full <dir>`. Tests: `tests/gold-factor-residual.test.mjs`.
