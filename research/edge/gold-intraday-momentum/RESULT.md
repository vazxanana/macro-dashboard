# Gold intraday momentum on the 17:00 New York day: result

**Verdict: FAIL, 0 of 3: gross R near zero (OOS +0.003 to +0.008R a trade); at $0.60 a round trip every test loses in both windows.**

Pre-registered in `PREREGISTRATION.md` (committed and pushed alone before any return was computed). Data: OANDA mid XAU/USD M5,
1 Nov 2006 to 13 Nov 2026 (1,431,423 candles, a local cache out of git). New York time from `council/histdata.mjs` `nyOffsetH`
(checked against the system time zone in the test; the 08:30 and 10:00 New York release candles are the day's widest, as they
should be). Signal days skipped for a missing price: T1 243 (mostly the day after a US holiday's early close), T2 54.

A stand-alone research rule: not a gate, exit, entry or size of the live gold book, and it reads none of that book's
positions. Nothing live changed.

## Rule (as pre-registered)

- T1: signal = previous 17:00 New York close to 10:00; trade 15:30 to 16:55 New York in its sign.
- T2: signal = 08:30 to 10:00 New York; trade 15:00 to 16:55.
- T3: T1 only when abs(signal) is above the median of the 250 previous signal days (past days only).
- Stop 1.0 x ATR(14) of 17:00-New-York daily candles from the entry (gaps fill at the open, a candle reaching the stop takes it);
  R in units of that ATR. Cost judged at $0.60 a round trip; $0.16 (demo all-in) and $1.20 (2 x) reported. No financing
  (closed before the 17:00 rollover).

## Pass bar, per test

In sample (IS) 2007-2016, out of sample (OOS) 2017 to Oct 2026. t on calendar-month sums of net R; Holm over the three tests.

| test | IS n | IS gross R | IS net R | IS month t | OOS n | OOS gross R | OOS net R | OOS month t (gross) | OOS month t (net) | Holm p | OOS net at 2x | placebo beaten (OOS) | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 2428 | -0.001 | -0.035 | -15.32 | 2366 | +0.003 | -0.025 | 1.52 | -9.92 | 1.000 | -0.053 | 38 / 40 | **no** |
| T2 | 2500 | +0.004 | -0.030 | -11.16 | 2458 | +0.003 | -0.025 | 1.12 | -8.48 | 1.000 | -0.053 | 31 / 40 | **no** |
| T3 | 1130 | +0.000 | -0.030 | -8.30 | 1235 | +0.008 | -0.018 | 2.60 | -5.16 | 1.000 | -0.045 | 39 / 40 | **no** |

Checks failed: every test fails (1) net > 0 in both windows, (2) OOS t >= 2 after Holm and (5) positive at 2x cost. OOS n
>= 200 holds for all three; the placebo check holds for T1 and T3 (their net is less negative than random signs, by about
0.002-0.009R a trade), not for T2.

## Costs in R, and the demo cost

| test | window | cost R a trade at $0.60 | net at $0.16 | net at $0.60 | net at $1.20 | win (net) | stops hit | longs |
|---|---|---|---|---|---|---|---|---|
| T1 | IS | 0.034 | -0.010 | -0.035 | -0.069 | 31.9 % | 2 | 1239 |
| T1 | OOS | 0.028 | -0.004 | -0.025 | -0.053 | 36.6 % | 1 | 1294 |
| T2 | IS | 0.034 | -0.005 | -0.030 | -0.064 | 35.6 % | 0 | 1134 |
| T2 | OOS | 0.028 | -0.005 | -0.025 | -0.053 | 38.3 % | 2 | 1220 |
| T3 | IS | 0.030 | -0.008 | -0.030 | -0.060 | 34.8 % | 2 | 578 |
| T3 | OOS | 0.027 | +0.001 | -0.018 | -0.045 | 39.8 % | 0 | 687 |

The 1 x daily-ATR stop is almost never reached in 85-115 minutes (at most 2 stops a window), so a trade's R is its last-hour
move divided by a daily range: a few hundredths of R either way, against a cost of about 0.03R. Even at the demo's $0.16 only
T3 out of sample is above zero (+0.001R), which is nothing.

## Placebo, 40 seeds (same days, random sign)

| test | OOS rule net R | placebo mean | placebo 95th pct | placebo max | beaten OOS | beaten IS |
|---|---|---|---|---|---|---|
| T1 | -0.025 | -0.027 | -0.025 | -0.023 | 38 / 40 | 7 / 40 |
| T2 | -0.025 | -0.027 | -0.024 | -0.023 | 31 / 40 | 40 / 40 |
| T3 | -0.018 | -0.027 | -0.023 | -0.017 | 39 / 40 | 28 / 40 |

## Regression of the last-window return on the signal (descriptive)

OLS of the return from the entry price to 16:55 (no stop, %) on the signal (%), classical standard errors.

| test | window | n | slope | t | R² (%) |
|---|---|---|---|---|---|
| T1 | IS | 2428 | -0.0011 | -0.27 | 0.00 |
| T1 | OOS | 2366 | +0.0136 | +3.44 | 0.50 |
| T2 | IS | 2500 | +0.0002 | +0.02 | 0.00 |
| T2 | OOS | 2458 | +0.0073 | +0.75 | 0.02 |

T1's out-of-sample slope is positive and its classical t is 3.44, but it is absent in sample, it is not robust to the
month-sum test (gross month t 1.52), and its size (0.0136 % of last hour per 1 % of signal) is far below the cost of trading
it. Not an edge; a heteroskedasticity-robust t was not pre-registered and was not computed.

## Net R a trade by year (at $0.60)

| year | T1 n | T1 gross | T1 net | T2 n | T2 gross | T2 net | T3 n | T3 gross | T3 net |
|---|---|---|---|---|---|---|---|---|---|
| 2007 | 245 | +0.009 | -0.052 | 250 | +0.017 | -0.044 | 26 | +0.048 | +0.014 |
| 2008 | 245 | -0.007 | -0.034 | 253 | +0.012 | -0.015 | 157 | -0.010 | -0.035 |
| 2009 | 242 | -0.001 | -0.035 | 249 | +0.008 | -0.026 | 91 | -0.002 | -0.034 |
| 2010 | 242 | -0.004 | -0.037 | 248 | -0.001 | -0.034 | 103 | -0.006 | -0.038 |
| 2011 | 248 | -0.008 | -0.033 | 254 | +0.004 | -0.021 | 153 | -0.005 | -0.029 |
| 2012 | 245 | -0.010 | -0.038 | 249 | +0.001 | -0.026 | 96 | -0.011 | -0.038 |
| 2013 | 240 | -0.002 | -0.027 | 249 | +0.009 | -0.017 | 141 | +0.002 | -0.023 |
| 2014 | 239 | +0.000 | -0.037 | 248 | +0.004 | -0.033 | 111 | +0.007 | -0.030 |
| 2015 | 240 | +0.007 | -0.031 | 249 | +0.002 | -0.035 | 133 | +0.012 | -0.025 |
| 2016 | 242 | +0.006 | -0.029 | 251 | -0.013 | -0.047 | 119 | +0.000 | -0.032 |
| 2017 | 241 | +0.009 | -0.038 | 250 | +0.003 | -0.044 | 111 | +0.018 | -0.029 |
| 2018 | 241 | -0.008 | -0.057 | 250 | -0.001 | -0.051 | 124 | -0.013 | -0.063 |
| 2019 | 241 | +0.003 | -0.040 | 250 | +0.003 | -0.040 | 121 | +0.011 | -0.030 |
| 2020 | 242 | +0.005 | -0.017 | 251 | +0.011 | -0.012 | 138 | +0.022 | +0.001 |
| 2021 | 242 | +0.005 | -0.020 | 251 | +0.003 | -0.022 | 112 | +0.008 | -0.017 |
| 2022 | 240 | -0.001 | -0.025 | 249 | +0.005 | -0.020 | 140 | -0.003 | -0.027 |
| 2023 | 239 | +0.000 | -0.027 | 249 | +0.000 | -0.027 | 106 | -0.002 | -0.028 |
| 2024 | 240 | +0.012 | -0.008 | 250 | +0.012 | -0.007 | 138 | +0.028 | +0.009 |
| 2025 | 239 | -0.004 | -0.016 | 249 | +0.001 | -0.011 | 125 | -0.005 | -0.017 |
| 2026 (to Oct) | 201 | +0.010 | +0.005 | 209 | -0.011 | -0.017 | 120 | +0.018 | +0.013 |

## Reading

With the near neighbour `metals-intraday-momentum` (gold on the COMEX floor session, FAIL), two specifications of intraday
momentum on gold have now failed. Before costs the sign of the morning does not carry into the last hour by any measurable
amount (gross 0.000-0.008R a trade); after costs every test loses in every window. Do not trade it, do not use it as a filter on
anything, and do not write another window of it on gold's history: a further variant would be a search over windows.

To repeat: `node research/edge/gold-intraday-momentum/run.mjs <xau-5m.json.gz>` (about 3 s). Test:
`tests/gold-intraday-momentum.test.mjs`.
