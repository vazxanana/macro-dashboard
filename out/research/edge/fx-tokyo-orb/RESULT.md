# Tokyo-open range breakout on USD/JPY, AUD/USD and NZD/USD: result

**Verdict: FAIL: 0 of 3 tests pass. T1 usdjpy FAIL (2016 on -0.08R a trade net, n 862, t -3.9; to 2015 -0.088R, n 456); T2 audusd FAIL (2016 on -0.08R a trade net, n 607, t -3.24; to 2015 -0.047R, n 456); T3 nzdusd FAIL (2016 on -0.07R a trade net, n 585, t -2.63; to 2015 -0.092R, n 404)**

Pre-registered in PREREGISTRATION.md (committed and pushed before any trade was computed). OANDA mid M15, decisive window
2016-01-01 to 2026-11-12, replication 2008-01-03 to 2015-12-31. Range = the 00:00-01:00 UTC candles (09:00-10:00 Tokyo, no daylight
saving in Japan); the first M15 close beyond it from the 01:00-05:30 candles; entry at the next open; stop the other side of the range;
exit at the 06:00 UTC close. Costs: spread 0.3 pip + commission 22.5 USD per million a side (2 x 22.5e-6 x price a round trip) + 0.5 pip slippage on the entry and on the exit (all market). t on calendar-month sums. Paper research only: nothing live changed.

## The three tests, net of costs

| Test | Pair | Window | n | Gross R a trade | Net R a trade | t (months, net) | Total net R | Win rate | Net at 2x costs | t at 2x |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | usdjpy | 2016 on | 862 | −0.020 | −0.080 | −3.90 | −69.2 | 41.3 % | −0.140 | −6.55 |
| T1 | usdjpy | to 2015 | 456 | −0.028 | −0.088 | −2.96 | −39.9 | 41.7 % | −0.148 | −4.85 |
| T2 | audusd | 2016 on | 607 | −0.006 | −0.080 | −3.24 | −48.3 | 41.8 % | −0.153 | −6.01 |
| T2 | audusd | to 2015 | 456 | −0.002 | −0.047 | −1.73 | −21.5 | 46.7 % | −0.092 | −3.35 |
| T3 | nzdusd | 2016 on | 585 | +0.008 | −0.070 | −2.63 | −40.8 | 43.4 % | −0.148 | −5.28 |
| T3 | nzdusd | to 2015 | 404 | −0.039 | −0.092 | −2.91 | −37.1 | 40.1 % | −0.145 | −4.34 |

t of the gross (before costs) month sums, 2016 on: T1 −1.00, T2 −0.23, T3 0.32; to 2015: T1 −0.94, T2 −0.07, T3 −1.29.

## The pass bar

| Test | Verdict | decisive n >= 300 | decisive net R a trade > 0 | replication net R a trade > 0 | decisive month-sum t >= 2 | Holm-adjusted p < 0.05 | one-sided p | Holm p |
|---|---|---|---|---|---|---|---|---|
| T1 | FAIL | yes | no | no | no | no | 0.99995 | 1 |
| T2 | FAIL | yes | no | no | no | no | 0.9994 | 1 |
| T3 | FAIL | yes | no | no | no | no | 0.99573 | 1 |

## Placebo (decisive window, 40 seeds: same pair, day, entry candle and stop distance, side at random)

| Test | Real net R a trade | Placebo mean | Placebo 95th pct | Placebo range | Real above the 95th pct |
|---|---|---|---|---|---|
| T1 | −0.080 | −0.060 | −0.017 | −0.097 to −0.015 | no |
| T2 | −0.080 | −0.075 | −0.039 | −0.131 to −0.037 | no |
| T3 | −0.070 | −0.061 | −0.030 | −0.116 to −0.023 | no |

Pooled, not judged (the three pairs together): 2016 on −0.077R a trade net (n 2054, t −5.22, gross −0.008); to 2015 −0.075R (n 1316, t −3.82, gross −0.022).

## By year (net R a trade / total net R, n)

| Year | T1 usdjpy | T2 audusd | T3 nzdusd |
|---|---|---|---|
| 2008 | −0.150 / −8.1 (n 54) | −0.067 / −3.1 (n 46) | −0.139 / −6.4 (n 46) |
| 2009 | −0.034 / −1.9 (n 57) | −0.086 / −4.6 (n 54) | −0.090 / −4.0 (n 44) |
| 2010 | −0.142 / −7.0 (n 49) | −0.157 / −9.6 (n 61) | −0.120 / −6.8 (n 57) |
| 2011 | −0.147 / −10.4 (n 71) | +0.066 / +4.1 (n 62) | +0.084 / +5.0 (n 60) |
| 2012 | −0.060 / −3.7 (n 61) | −0.067 / −3.7 (n 55) | −0.147 / −7.2 (n 49) |
| 2013 | +0.033 / +1.7 (n 51) | −0.006 / −0.4 (n 63) | +0.004 / +0.2 (n 43) |
| 2014 | −0.058 / −3.7 (n 64) | −0.099 / −6.0 (n 61) | −0.267 / −17.1 (n 64) |
| 2015 | −0.138 / −6.8 (n 49) | +0.034 / +1.8 (n 54) | −0.023 / −0.9 (n 41) |
| 2016 | −0.125 / −9.7 (n 78) | −0.165 / −9.6 (n 58) | −0.006 / −0.3 (n 52) |
| 2017 | −0.153 / −9.3 (n 61) | −0.185 / −12.4 (n 67) | +0.030 / +1.6 (n 54) |
| 2018 | −0.142 / −13.0 (n 92) | −0.053 / −2.6 (n 50) | −0.029 / −1.8 (n 62) |
| 2019 | −0.105 / −9.0 (n 86) | −0.095 / −6.5 (n 69) | −0.187 / −11.8 (n 63) |
| 2020 | +0.012 / +1.1 (n 91) | −0.062 / −4.8 (n 77) | −0.092 / −6.3 (n 68) |
| 2021 | −0.181 / −11.9 (n 66) | −0.026 / −1.3 (n 48) | −0.109 / −3.8 (n 35) |
| 2022 | +0.010 / +0.9 (n 90) | −0.004 / −0.2 (n 47) | −0.003 / −0.2 (n 50) |
| 2023 | −0.049 / −2.7 (n 54) | +0.009 / +0.3 (n 36) | −0.188 / −8.5 (n 45) |
| 2024 | −0.143 / −11.1 (n 78) | −0.021 / −1.2 (n 58) | −0.146 / −8.5 (n 58) |
| 2025 | +0.009 / +0.9 (n 102) | −0.148 / −7.3 (n 49) | +0.042 / +1.9 (n 45) |
| 2026 | −0.083 / −5.3 (n 64) | −0.057 / −2.8 (n 48) | −0.063 / −3.3 (n 53) |

## Exits and costs, decisive window

- T1: stop 93, time 769; median stop distance 34.2 pips, median cost 0.054 R a trade
- T2: time 535, stop 72; median stop distance 22.4 pips, median cost 0.072 R a trade
- T3: time 507, stop 78; median stop distance 21 pips, median cost 0.076 R a trade

## Days

| Pair | Candles | First | Last | Days with the range | Warm-up | New year | Thin (holiday proxy) | Narrow | Kept | Trades |
|---|---|---|---|---|---|---|---|---|---|---|
| usdjpy | 488398 | 2007-06-01 00:00 | 2026-11-13 21:45 | 5045 | 20 | 19 | 210 | 3165 | 1631 | 1318 |
| audusd | 488188 | 2007-06-01 00:00 | 2026-11-13 21:45 | 5044 | 20 | 19 | 186 | 3513 | 1306 | 1063 |
| nzdusd | 487962 | 2007-06-01 00:00 | 2026-11-13 21:45 | 5043 | 20 | 19 | 227 | 3595 | 1182 | 989 |

## What it means, and what it does not

- **No continuation after a close out of the Tokyo first hour, on any of the three pairs, in either window.** Before costs
  every stream is within 0.04R a trade of zero (gross t between −1.3 and +0.3 on month sums); after the raw-spread model's
  costs every stream loses 0.05-0.09R a trade, and the decisive month-sum t is negative on all three (−2.6 to −3.9). The
  loss is the cost: the median cost is 0.05-0.08R a trade (stops of 21-34 pips in the median, table above), which is the
  whole of the net loss; most trades (about seven in eight) end at the 06:00 UTC close, not at the stop.
- **The placebo says the same**: the real side does no better than a coin-flip side on the same days, entries and stops
  (the real figure sits inside the placebo's range for every pair, never above its 95th percentile). Nothing about the
  direction of the break carries information to 06:00 UTC.
- **Twice the costs** only deepens the loss (net about −0.15R a trade, t −5 to −6.6); even with no costs at all the gross
  figures sit at zero, so no cost assumption turns this into an edge.
- **The skips were fixed in advance and are heavy**: the 0.25 x daily ATR minimum width removes about two days in three (the
  Tokyo first hour is usually narrow against a whole day's range); it was not tuned. The volume proxy for Japanese public
  holidays removes about 10 days a year; the days it caught in 2024-26 include Coming of Age Day, Shōwa Day, Children's Day,
  Mountain Day, Respect for the Aged Day and Culture Day, and also Good Friday (thin everywhere), so it does what it was
  written for, not more.
- **What it does not say**: it does not test a target, a later exit, a retest entry, other markets (gold, the yen crosses,
  the Nikkei), a fade of the break, or the M5 detail of the session; and a fail on M15 mid candles with this cost model is not
  a judgement on discretionary Asian-session trading. Any of those needs its own pre-registration. Paper research only:
  nothing live changed, and no proposal is written.

To repeat: `node --use-env-proxy research/edge/fx-tokyo-orb/run.mjs fetch <dir>` (candles outside git), then `node research/edge/fx-tokyo-orb/run.mjs full <dir>`. Tests: `tests/fx-tokyo-orb.test.mjs`.
