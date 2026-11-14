# Asian-session move reversed in London, forex majors: result

**Verdict: FAIL.** The pool made -0.048R a trade net out of sample (n 2250, month-sum t -3.24; gross -0.011R, at 2x costs -0.085R), in sample -0.031R (n 2183, t -2.58); placebo 95th percentile -0.022R (real above 4 of 40). Best pair out of sample usdjpy -0.009R (n 409, t -0.36, Holm p 1); 0 of 7 pairs pass on their own.

Pre-registered in PREREGISTRATION.md (committed before any candle was read). Seven pairs (eurusd, gbpusd, audusd, nzdusd, usdjpy, usdcad, usdchf), OANDA mid M5,
in sample 2016-01-01 to 2021-06-30, out of sample 2021-07-01 to 2026-11-12. Asia = 00:00-07:00 UTC; a trade when |Asia move| > 0.3 x ATR20 (New York days),
against the move at the 07:00 UTC open, stop one Asia range beyond the Asia extreme, out at 12:00 UTC or the stop.
Costs: spread 0.3 pip + commission 22.5 USD per million a side (2 x 22.5e-6 x price a round trip) + 0.5 pip slippage on the entry and on the exit. t on calendar-month sums. Paper research only: nothing live changed.

## Pool and pairs

| Stream | Window | n | Net R a trade | Gross R a trade | Net at 2x | t net (months) | t gross | Total net R | Win rate | Stops | Median stop (pips) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Pool | IS 2016-21H1 | 2183 | −0.031 | +0.005 | −0.067 | -2.58 | 0.37 | −68.3 | 47.1 % | 121 | 50.9 |
| Pool | OOS 2021H2-26 | 2250 | −0.048 | −0.011 | −0.085 | -3.24 | -0.77 | −107.8 | 45.7 % | 139 | 49.55 |
| eurusd | IS 2016-21H1 | 219 | −0.012 | +0.028 | −0.052 | -0.35 | 0.82 | −2.6 | 45.2 % | 13 | 46 |
| eurusd | OOS 2021H2-26 | 220 | −0.052 | −0.010 | −0.094 | -1.49 | -0.28 | −11.4 | 45.5 % | 25 | 46.8 |
| gbpusd | IS 2016-21H1 | 208 | +0.020 | +0.049 | −0.010 | 0.45 | 1.11 | +4.1 | 52.9 % | 22 | 66.15 |
| gbpusd | OOS 2021H2-26 | 231 | −0.050 | −0.016 | −0.085 | -1.39 | -0.44 | −11.7 | 48.1 % | 28 | 56.8 |
| audusd | IS 2016-21H1 | 479 | −0.036 | −0.002 | −0.070 | -2.22 | -0.10 | −17.0 | 45.9 % | 17 | 51.4 |
| audusd | OOS 2021H2-26 | 446 | −0.052 | −0.017 | −0.088 | -2.93 | -0.93 | −23.4 | 43.7 % | 12 | 48.35 |
| nzdusd | IS 2016-21H1 | 452 | −0.060 | −0.024 | −0.096 | -3.77 | -1.53 | −27.3 | 45.1 % | 20 | 46.6 |
| nzdusd | OOS 2021H2-26 | 460 | −0.055 | −0.017 | −0.093 | -3.07 | -0.97 | −25.3 | 44.6 % | 14 | 43.8 |
| usdjpy | IS 2016-21H1 | 423 | −0.034 | −0.002 | −0.067 | -1.68 | -0.08 | −14.4 | 48.2 % | 13 | 57 |
| usdjpy | OOS 2021H2-26 | 409 | −0.009 | +0.015 | −0.034 | -0.36 | 0.60 | −3.8 | 48.4 % | 9 | 95.9 |
| usdcad | IS 2016-21H1 | 227 | −0.022 | +0.017 | −0.061 | -0.60 | 0.44 | −5.1 | 48.0 % | 16 | 50.6 |
| usdcad | OOS 2021H2-26 | 247 | −0.105 | −0.061 | −0.149 | -2.89 | -1.68 | −26.0 | 43.7 % | 20 | 43.9 |
| usdchf | IS 2016-21H1 | 175 | −0.034 | +0.013 | −0.081 | -0.66 | 0.24 | −6.0 | 46.9 % | 20 | 38.3 |
| usdchf | OOS 2021H2-26 | 237 | −0.026 | +0.020 | −0.072 | -0.64 | 0.48 | −6.2 | 46.8 % | 31 | 38 |

## The pass bar (pool decides)

| Stream | OOS month-sum t >= 2 (net) | IS net R a trade > 0 | OOS net R a trade > 0 at 2x costs | beats the placebo 95th percentile | Holm p (OOS) | Verdict |
|---|---|---|---|---|---|---|
| Pool | no | no | no | no | 1 | FAIL |
| eurusd | no | no | no | no | 1 | FAIL |
| gbpusd | no | yes | no | no | 1 | FAIL |
| audusd | no | no | no | no | 1 | FAIL |
| nzdusd | no | no | no | no | 1 | FAIL |
| usdjpy | no | no | no | no | 1 | FAIL |
| usdcad | no | no | no | no | 1 | FAIL |
| usdchf | no | no | no | no | 1 | FAIL |

## Placebo (out of sample, 40 seeds: same pair, day, entry candle and stop distance, random direction)

| Stream | Real net R a trade | Placebo mean | Placebo 95th pct | Placebo range | Real ranks above |
|---|---|---|---|---|---|
| Pool | −0.048 | −0.037 | −0.022 | −0.060 to −0.014 | 4 of 40 |
| eurusd | −0.052 | −0.045 | +0.005 | −0.097 to +0.026 | 16 of 40 |
| gbpusd | −0.050 | −0.047 | +0.021 | −0.138 to +0.032 | 20 of 40 |
| audusd | −0.052 | −0.030 | +0.005 | −0.081 to +0.013 | 4 of 40 |
| nzdusd | −0.055 | −0.038 | −0.011 | −0.084 to +0.001 | 7 of 40 |
| usdjpy | −0.009 | −0.019 | +0.019 | −0.059 to +0.025 | 27 of 40 |
| usdcad | −0.105 | −0.037 | +0.029 | −0.109 to +0.070 | 1 of 40 |
| usdchf | −0.026 | −0.055 | +0.000 | −0.141 to +0.029 | 30 of 40 |

## By year, pool (net R a trade / total net R / n)

| Year | Net R a trade | Gross R a trade | Total net R | n |
|---|---|---|---|---|
| 2016 | +0.001 | +0.028 | +0.5 | 409 |
| 2017 | −0.034 | +0.001 | −12.8 | 380 |
| 2018 | −0.039 | −0.001 | −16.8 | 425 |
| 2019 | −0.035 | +0.009 | −12.2 | 349 |
| 2020 | −0.048 | −0.013 | −20.4 | 428 |
| 2021 | −0.057 | −0.014 | −23.3 | 411 |
| 2022 | +0.012 | +0.042 | +5.1 | 412 |
| 2023 | −0.031 | +0.002 | −12.2 | 389 |
| 2024 | −0.077 | −0.039 | −29.2 | 378 |
| 2025 | −0.059 | −0.023 | −27.1 | 462 |
| 2026 | −0.071 | −0.029 | −27.8 | 390 |

## Days

| Pair | Candles | First | Last | Traded | Small move | Asia candles missing | Warm-up | Entry late | Past stop |
|---|---|---|---|---|---|---|---|---|---|
| eurusd | 821744 | 2015-11-01 22:00 | 2026-11-12 23:55 | 439 | 2372 | 24 | 0 | 0 | 0 |
| gbpusd | 821204 | 2015-11-01 22:00 | 2026-11-12 23:55 | 439 | 2363 | 33 | 0 | 0 | 0 |
| audusd | 818540 | 2015-11-01 22:00 | 2026-11-12 23:55 | 925 | 1878 | 32 | 0 | 0 | 0 |
| nzdusd | 820871 | 2015-11-01 22:00 | 2026-11-12 23:55 | 912 | 1898 | 25 | 0 | 0 | 0 |
| usdjpy | 822120 | 2015-11-01 22:00 | 2026-11-12 23:55 | 832 | 1981 | 22 | 0 | 0 | 0 |
| usdcad | 821525 | 2015-11-01 22:00 | 2026-11-12 23:55 | 474 | 2328 | 33 | 0 | 0 | 0 |
| usdchf | 813417 | 2015-11-01 22:00 | 2026-11-12 23:55 | 412 | 2223 | 200 | 0 | 0 | 0 |

## Reading

- Written after the run. There is no reversal to trade: before any cost the pooled fade made +0.005R a trade in sample (t 0.37) and -0.011R out of sample (t -0.77); the costs (0.3 pip spread, commission, 1 pip of slippage, about 0.035-0.04R on a median 50-pip stop) turn both clearly negative.
- The real fade sits close to a random-direction entry on the same days with the same stop: -0.048R against a placebo mean of -0.037R and a 95th percentile of -0.022R (above 4 of 40 seeds). The direction chosen from the Asian move adds nothing.
- No pair works alone: every pair is negative net out of sample, USD/JPY nearest to flat (-0.009R, t -0.36, gross +0.015R); USD/CAD worst (-0.105R, t -2.89). USD/CHF lost 200 days to missing Asian candles (thin night hours on OANDA), counted in the funnel.
- The wide stop (one Asia range past the extreme) is rarely hit (121 + 139 stops in 4,433 trades): almost every trade ends at 12:00 UTC, so the result is the London morning's drift against the Asian move, which is about zero.
- Not an edge. No proposal is written; nothing live changes. Other k, entry or exit times were not tried and must not be tried on this data without a new pre-registration.

To repeat: `node --use-env-proxy research/edge/fx-asia-london-reversal/run.mjs fetch <dir>` (candles outside git), then `node research/edge/fx-asia-london-reversal/run.mjs full <dir>`. Tests: `tests/fx-asia-london-reversal.test.mjs`.
