# The US cash-session midday turn on index CFDs: result

**Verdict: FAIL.** Decisive window 2016 → now: T1 NAS100 fade: n 2308, −0.042R a trade net (month-sum t −7.14), before costs −0.016R; Holm p 1.000. T2 NAS100 follow: n 2308, −0.010R a trade net (month-sum t −1.60), before costs +0.016R; Holm p 1.000. T3 SPX500 fade: n 2329, −0.047R a trade net (month-sum t −7.54), before costs −0.011R; Holm p 1.000. T4 SPX500 follow: n 2329, −0.025R a trade net (month-sum t −4.07), before costs +0.011R; Holm p 1.000.

Pre-registered in `PREREGISTRATION.md` (committed before any figure was computed). Rule: morning move = 09:30 to 11:30 New York; skip when |move| < 0.25 x the 20-day median |move|; enter 11:30, exit 14:00 New York; fade = against the move, follow = with it; stop 1 x the 20-day ATR of daily candles. Costs: 0.04 % of notional round trip (a check at 0.08 %), no financing. Data: OANDA mid M5 candles through the candle proxy; the NYSE calendar stated in the pre-registration (half days skipped). Paper research only: nothing live changed.

This is not the `intraday-momentum` study: that one traded the last half hour (15:30-16:00) on the sign of the previous close to 10:00 and followed only; this one reads the cash-session morning (09:30-11:30, no overnight gap) and trades 11:30-14:00 both ways.

## Per test and window

| test | market | side | window | trades | months | gross R | net R | net R at 2x | t (month sums) | t gross | t at 2x | cost R | win | stops | total net R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | NAS100 | fade | to 2015 | 1764 | 99 | −0.003 | −0.029 | −0.055 | −4.25 | −0.50 | −7.80 | 0.026 | 44.9 % | 17 | −51.7 |
| T1 | NAS100 | fade | 2016 → now | 2308 | 131 | −0.016 | −0.042 | −0.069 | −7.14 | −2.71 | −11.34 | 0.026 | 41.5 % | 19 | −97.8 |
| T2 | NAS100 | follow | to 2015 | 1764 | 99 | +0.002 | −0.024 | −0.050 | −3.39 | +0.31 | −6.81 | 0.026 | 45.8 % | 6 | −41.9 |
| T2 | NAS100 | follow | 2016 → now | 2308 | 131 | +0.016 | −0.010 | −0.036 | −1.60 | +2.64 | −5.49 | 0.026 | 49.1 % | 17 | −23.2 |
| T3 | SPX500 | fade | to 2015 | 1739 | 99 | +0.001 | −0.029 | −0.059 | −4.22 | +0.13 | −8.22 | 0.030 | 45.3 % | 9 | −50.3 |
| T3 | SPX500 | fade | 2016 → now | 2329 | 131 | −0.011 | −0.047 | −0.083 | −7.54 | −1.82 | −12.54 | 0.036 | 40.9 % | 18 | −109.3 |
| T4 | SPX500 | follow | to 2015 | 1739 | 99 | −0.002 | −0.032 | −0.062 | −4.57 | −0.29 | −8.33 | 0.030 | 44.0 % | 9 | −55.2 |
| T4 | SPX500 | follow | 2016 → now | 2329 | 131 | +0.011 | −0.025 | −0.061 | −4.07 | +1.79 | −9.14 | 0.036 | 46.5 % | 22 | −58.6 |

Replication window: first trade 2007-10-30 (NAS100) / 2007-10-30 (SPX500) to 2015-12-31.

## Pass bar

Per test: net R a trade > 0 in both windows, decisive Holm p < 0.05 over the four tests, decisive n ≥ 200.

| test | p (one-sided) | Holm p | net > 0 both windows | Holm < 0.05 | n ≥ 200 | pass |
|---|---|---|---|---|---|---|
| T1 | 1.000 | 1.000 | no | no | yes | no |
| T2 | 0.945 | 1.000 | no | no | yes | no |
| T3 | 1.000 | 1.000 | no | no | yes | no |
| T4 | 1.000 | 1.000 | no | no | yes | no |

## Placebo (decides nothing)

Per market, 40 seeds: on the same decisive days, a random 2.5-hour cash-session window (start 09:30 to 13:30 on the 5-minute grid, not 11:30) with a random side, the same ATR stop and cost.

| market | trades a seed | placebo mean net R | 95th pct | max | 95th pct of t | fade beats seeds | follow beats seeds |
|---|---|---|---|---|---|---|---|
| NAS100 | 2308 | −0.027 | −0.019 | −0.015 | −2.95 | 0 / 40 | 40 / 40 |
| SPX500 | 2329 | −0.036 | −0.027 | −0.023 | −3.80 | 2 / 40 | 39 / 40 |

## Midday return on the morning move (descriptive)

OLS of P(14:00) / P(11:30) − 1 on the morning move, both in %, every eligible day with prices after the warm-ups (filtered or not). A negative slope leans to a reversal, a positive one to continuation.

| market | window | n | slope | t (OLS) | t (White) | R² |
|---|---|---|---|---|---|---|
| NAS100 | to 2015 | 2033 | +0.0227 | +1.43 | +0.83 | 0.10 % |
| NAS100 | 2016 → now | 2706 | +0.0407 | +2.80 | +1.94 | 0.29 % |
| SPX500 | to 2015 | 2033 | +0.0342 | +2.00 | +0.93 | 0.20 % |
| SPX500 | 2016 → now | 2705 | +0.0395 | +2.45 | +1.52 | 0.22 % |

## Net R a trade by year (descriptive)

| year | T1 n | T1 NAS100 fade | T2 NAS100 follow | T3 n | T3 SPX500 fade | T4 SPX500 follow |
|---|---|---|---|---|---|---|
| 2007 | 37 | +0.044 | −0.082 | 35 | +0.040 | −0.085 |
| 2008 | 216 | −0.058 | +0.030 | 216 | −0.038 | +0.002 |
| 2009 | 219 | −0.009 | −0.028 | 209 | −0.021 | −0.016 |
| 2010 | 219 | −0.023 | −0.027 | 212 | −0.013 | −0.042 |
| 2011 | 212 | −0.055 | +0.006 | 220 | −0.022 | −0.029 |
| 2012 | 210 | −0.027 | −0.033 | 220 | −0.029 | −0.037 |
| 2013 | 219 | −0.016 | −0.056 | 208 | −0.017 | −0.067 |
| 2014 | 213 | −0.042 | −0.031 | 206 | −0.049 | −0.044 |
| 2015 | 219 | −0.018 | −0.040 | 213 | −0.054 | −0.015 |
| 2016 | 211 | −0.033 | −0.027 | 211 | −0.052 | −0.019 |
| 2017 | 215 | −0.048 | −0.033 | 215 | −0.069 | −0.063 |
| 2018 | 222 | −0.065 | +0.006 | 221 | −0.096 | +0.011 |
| 2019 | 209 | −0.032 | −0.022 | 212 | −0.033 | −0.041 |
| 2020 | 211 | −0.042 | +0.005 | 210 | −0.035 | −0.011 |
| 2021 | 209 | −0.046 | −0.010 | 206 | −0.024 | −0.043 |
| 2022 | 215 | −0.032 | +0.001 | 220 | −0.038 | −0.006 |
| 2023 | 207 | −0.027 | −0.022 | 211 | −0.039 | −0.026 |
| 2024 | 213 | −0.054 | −0.001 | 219 | −0.036 | −0.041 |
| 2025 | 207 | −0.042 | −0.001 | 213 | −0.057 | −0.002 |
| 2026 | 189 | −0.044 | −0.008 | 191 | −0.032 | −0.040 |

## Days left out

- NAS100: 11 eligible days without a price at 09:30, 11:30 or 14:00; 20 days of the 20-day median warm-up; 1 without a 20-day ATR; 13 with a zero morning move; 654 with a morning move under 0.25 x the 20-day median.
- SPX500: 12 eligible days without a price at 09:30, 11:30 or 14:00; 20 days of the 20-day median warm-up; 1 without a 20-day ATR; 43 with a zero morning move; 627 with a morning move under 0.25 x the 20-day median.

## Reading

No test met the pre-registered bar. Neither fading nor following the morning move over the midday window is an edge on these feeds after costs; no proposal is written and nothing live changes. Never call it an edge.

Descriptive, decides nothing: there is no midday turn. Fading the morning loses before costs in 2016 → now on both markets (NAS100 −0.016R, t −2.71; SPX500 −0.011R, t −1.82), and the midday return leans the other way, a little: the slope on the morning move is positive in every market and window (2016 → now NAS100 +0.0407, White t +1.94; SPX500 +0.0395, White t +1.52). Following it makes +0.016R (NAS100) and +0.011R (SPX500) a trade before costs, under the round trip of 0.026R and 0.036R, and near zero before costs to 2015. Every random cash-session window with a random side loses about its cost (placebo means −0.027R and −0.036R), so "follow beats most seeds" only says it loses less than paying the spread for nothing; it is not a reason to trade it.

To repeat: `node --use-env-proxy research/edge/index-midday-turn/fetch.mjs <dir>`, then `node research/edge/index-midday-turn/run.mjs <dir>`. Test: `tests/index-midday-turn.test.mjs`.
