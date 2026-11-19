# Daily inside-day breakout on spot gold: result (2026-11-14)

**Verdict: FAIL, 0 of 3: the gold inside-day breakout (exit 21:00 UTC) made +0.028R a trade net out of sample (n 367, month t +0.62), +0.112R in sample; T2 and T3 fail too.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed; sha256 in `result.json`). A new stand-alone
rule, not a gate, exit, entry or size of the gold book (docs/owner-decisions.md item 44); nothing of that book was read. Paper
research only: nothing live changed and no proposal is written. This page is written by `run.mjs` from `result.json`.

## Rule (as pre-registered)

- Spot gold, OANDA mid XAU/USD M5 candles; daily candles built from the same M5 candles (UTC days, weekend folded into Monday
  as `council/fills.mjs` `foldWeekend`). A day needs 120+ M5 candles; the inside day, the day before and the order day must be full.
- Inside day: high below the previous day's high, low above its low. Next day: buy stop at its high, sell stop at its low, first
  filled wins, the other cancelled; orders live until 21:00 UTC. **Stop = the other side of the inside day on every trade.**
- M5 path: a gap fills at the open; a fill candle that also reaches the stop is a full loss; later candles exit at the stop (or
  the open when gapped). T1 exit 21:00 UTC; T2 1R target (stop first in one candle), else 21:00 UTC; T3 = T1 when the inside
  day's range is under 0.6 x ATR14.
- Costs: $0.60 a round trip (2x = $1.20), financing on buys by `nights` x `FIN.xau.long` (0.000148).
- In sample: order days 2008-2016; out of sample (decisive): 2017 to the last day on file. t on calendar-month sums of net R;
  Holm over the three out-of-sample p values; placebo = 40 seeds of random non-inside days under the same rule.

## Results

| Test | Window | Signals | Unfilled | n | Gross R | Net R | Net at 2x | Win % | Total net R | Worst DD R | Month t | One-sided p | Median risk $ | Fill-candle stops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | IS 2008-16 | 414 | 35 | 379 | +0.164 | +0.112 | +0.059 | 51.2 | +42.40 | −9.02 | +2.53 | 0.0057 | 12.18 | 0 |
| T1 | OOS 2017-now | 392 | 25 | 367 | +0.072 | +0.028 | −0.016 | 45.5 | +10.15 | −13.38 | +0.62 | 0.2684 | 16.05 | 0 |
| T1 | OOS 2017-21 (reported) | 206 | 13 | 193 | +0.047 | −0.012 | −0.071 | 40.4 | −2.33 | −13.38 | −0.18 | 0.5717 | 11.04 | 0 |
| T1 | OOS 2022-now (reported) | 186 | 12 | 174 | +0.099 | +0.072 | +0.044 | 51.1 | +12.48 | −7.29 | +1.22 | 0.1111 | 22.4 | 0 |
| T2 | IS 2008-16 | 414 | 35 | 379 | +0.118 | +0.066 | +0.013 | 53.0 | +24.83 | −10.12 | +1.71 | 0.044 | 12.18 | 0 |
| T2 | OOS 2017-now | 392 | 25 | 367 | +0.086 | +0.042 | −0.003 | 49.9 | +15.24 | −10.73 | +1.10 | 0.1348 | 16.05 | 0 |
| T2 | OOS 2017-21 (reported) | 206 | 13 | 193 | +0.062 | +0.003 | −0.056 | 45.6 | +0.62 | −10.73 | +0.06 | 0.4764 | 11.04 | 0 |
| T2 | OOS 2022-now (reported) | 186 | 12 | 174 | +0.112 | +0.084 | +0.057 | 54.6 | +14.62 | −4.73 | +1.62 | 0.053 | 22.4 | 0 |
| T3 | IS 2008-16 | 152 | 7 | 145 | +0.269 | +0.201 | +0.134 | 55.2 | +29.16 | −5.51 | +2.35 | 0.0093 | 9.22 | 0 |
| T3 | OOS 2017-now | 128 | 2 | 126 | +0.051 | −0.004 | −0.060 | 46.8 | −0.57 | −12.24 | −0.05 | 0.5195 | 12.72 | 0 |
| T3 | OOS 2017-21 (reported) | 64 | 1 | 63 | +0.001 | −0.076 | −0.153 | 38.1 | −4.80 | −12.24 | −0.51 | 0.6946 | 7.6 | 0 |
| T3 | OOS 2022-now (reported) | 64 | 1 | 63 | +0.100 | +0.067 | +0.034 | 55.6 | +4.23 | −3.91 | +0.63 | 0.2646 | 19.19 | 0 |

Tests: T1 inside day; OCO stops at its high / low the next day, stop the other side, exit 21:00 UTC; T2 inside day; the same bracket, 1R target, else exit 21:00 UTC; T3 tight inside day (range < 0.6 x ATR14); the T1 bracket and exit.

## The checks

| Test | OOS net > 0 | OOS t ≥ 2 | Holm | IS net > 0 | OOS at 2x > 0 | Beats ≥ 38 of 40 placebos | OOS n ≥ 30 | Pass |
|---|---|---|---|---|---|---|---|---|
| T1 | yes | no | no | yes | no | no | yes | no |
| T2 | yes | no | no | yes | no | yes | yes | no |
| T3 | no | no | no | yes | no | no | yes | no |

## Placebo (out of sample, 40 seeds)

Each seed draws as many random non-inside full days of the window as the test has real signals (T3: non-inside days that are also under 0.6 x ATR14) and runs the same bracket, exit and costs.

| Test | Real net R a trade | Seeds beaten | Placebo median | Placebo 95th pct | Placebo min / max | Pool |
|---|---|---|---|---|---|---|
| T1 | +0.028 | 32 of 40 | +0.007 | +0.047 | −0.069 / +0.091 | 2140 |
| T2 | +0.042 | 39 of 40 | +0.002 | +0.023 | −0.064 / +0.043 | 2140 |
| T3 | −0.004 | 3 of 40 | +0.122 | +0.273 | −0.117 / +0.316 | 165 |

## Buys and sells (reported, not judged)

| Test | Window | Buys n | Buys net R | Sells n | Sells net R |
|---|---|---|---|---|---|
| T1 | IS 2008-16 | 206 | +0.149 | 173 | +0.067 |
| T1 | OOS 2017-now | 185 | +0.042 | 182 | +0.013 |
| T2 | IS 2008-16 | 206 | +0.087 | 173 | +0.040 |
| T2 | OOS 2017-now | 185 | +0.086 | 182 | −0.004 |
| T3 | IS 2008-16 | 67 | +0.210 | 78 | +0.194 |
| T3 | OOS 2017-now | 65 | −0.056 | 61 | +0.050 |

## By year, T1 (reported)

| Year | n | Net R a trade | Total net R |
|---|---|---|---|
| 2008 | 40 | +0.279 | +11.16 |
| 2009 | 46 | +0.147 | +6.76 |
| 2010 | 40 | +0.099 | +3.97 |
| 2011 | 28 | +0.351 | +9.82 |
| 2012 | 38 | −0.031 | −1.19 |
| 2013 | 47 | −0.057 | −2.67 |
| 2014 | 48 | +0.139 | +6.66 |
| 2015 | 51 | +0.010 | +0.50 |
| 2016 | 41 | +0.180 | +7.40 |
| 2017 | 34 | −0.273 | −9.27 |
| 2018 | 43 | +0.082 | +3.52 |
| 2019 | 42 | −0.062 | −2.62 |
| 2020 | 37 | −0.022 | −0.83 |
| 2021 | 37 | +0.186 | +6.88 |
| 2022 | 30 | +0.010 | +0.31 |
| 2023 | 37 | −0.112 | −4.15 |
| 2024 | 42 | +0.094 | +3.94 |
| 2025 | 38 | +0.243 | +9.23 |
| 2026 | 27 | +0.117 | +3.15 |

## Data

- OANDA mid XAU/USD M5 candles (1431423 candles, 2006-11-01 to 2026-11-13), daily candles built from them (5207 folded days, 5173 full)
- Check only: of 5168 full days also in council-data research/daily/xau.json (folded the same way), 0 differ by more than $0.05 in high or low.
- To repeat: `node research/edge/gold-inside-day/run.mjs <xau-5m.json.gz>` (M5 cache outside git). Tests: `tests/gold-inside-day.test.mjs`.
