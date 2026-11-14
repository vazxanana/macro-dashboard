# Intraday momentum on gold, silver and crude oil: result

**Verdict: FAIL** (0 of 3 tests pass). T1 Gold, 2016 → now: n 2713, −0.157R a trade net of costs (before costs −0.015R), month-sum t −9.24, Holm p 1.000; 2007-2015 −0.103R (n 2238). T2 Silver, 2016 → now: n 2712, −0.642R a trade net of costs (before costs −0.010R), month-sum t −20.00, Holm p 1.000; 2007-2015 −0.465R (n 2222). T3 WTI crude, 2016 → now: n 2698, −0.168R a trade net of costs (before costs −0.022R), month-sum t −9.50, Holm p 1.000; 2007-2015 −0.110R (n 2235).

Pre-registered in `PREREGISTRATION.md` (committed and pushed alone before any return was computed). Claim from Gao, Han, Li and Zhou (2018), Journal of Financial Economics, "Market intraday momentum" (S&P 500); here on gold, silver and WTI crude. Rule: signal = the first 30 minutes of the US floor session (gold / silver 08:20-08:50, crude 09:00-09:30 New York); at 30 minutes before the close (13:00 / 14:00) long if > 0, short if < 0; exit at the close (13:30 / 14:30); stop 1.5 x the 20-day mean |last half-hour move|. Costs, round trip: gold $0.30, silver $0.03, crude $0.04 (crude assumed; no financing, the trade is intraday). Data: OANDA mid M5 candles through the candle proxy; New York time from `council/histdata.mjs` `nyOffsetH`; CME holidays and early closes skipped with `ict/calendar.mjs` `cmeShut`.

A stand-alone study: not a gate, exit, entry or size on the live gold book; it reads no gold-book positions (owner decision 44). Nothing live changes.

## Pass bar, per test

Window B = 2016 → 2026-11-13 decides; window A = 2007 (or first data) to 2015 replicates. A test passes when net R a trade > 0 in A and B, the B month-sum t ≥ 2, Holm p < 0.05 over the three tests (one-sided p of the B month-sum t), and B n ≥ 300.

| test | market | B n | B gross R | B net R | B month-sum t | months | p (one-sided) | Holm p | A net R | A n | net > 0 both | t ≥ 2 | Holm < 0.05 | n ≥ 300 | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | Gold | 2713 | −0.015 | −0.157 | −9.24 | 131 | 1.000 | 1.000 | −0.103 | 2238 | no | no | no | yes | **no** |
| T2 | Silver | 2712 | −0.010 | −0.642 | −20.00 | 131 | 1.000 | 1.000 | −0.465 | 2222 | no | no | no | yes | **no** |
| T3 | WTI crude | 2698 | −0.022 | −0.168 | −9.50 | 131 | 1.000 | 1.000 | −0.110 | 2235 | no | no | no | yes | **no** |

## Per market and window (descriptive beyond the pass bar)

| test | window | span | days | trades | net R | t (trades) | month-sum t | gross R | t gross | cost R | win | stops | longs | total net R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 Gold | A 2007-2015 | 2007-01-02 → 2015-12-31 | 2246 | 2238 | −0.103 | −5.55 | −4.93 | +0.044 | +2.40 | 0.147 | 42.1 % | 499 | 1096 | −230.2 |
| T1 Gold | B 2016 → now | 2016-01-04 → 2026-11-13 | 2714 | 2713 | −0.157 | −9.64 | −9.24 | −0.015 | −0.92 | 0.142 | 40.9 % | 683 | 1397 | −425.9 |
| T2 Silver | A 2007-2015 | 2007-01-02 → 2015-12-31 | 2244 | 2222 | −0.465 | −23.99 | −15.49 | +0.024 | +1.27 | 0.489 | 26.9 % | 519 | 1114 | −1034.0 |
| T2 Silver | B 2016 → now | 2016-01-04 → 2026-11-13 | 2714 | 2712 | −0.642 | −36.89 | −20.00 | −0.010 | −0.59 | 0.633 | 22.4 % | 681 | 1330 | −1741.5 |
| T3 WTI crude | A 2007-2015 | 2007-01-02 → 2015-12-30 | 2243 | 2235 | −0.110 | −6.09 | −5.71 | −0.015 | −0.85 | 0.095 | 42.5 % | 546 | 1119 | −246.3 |
| T3 WTI crude | B 2016 → now | 2016-01-04 → 2026-11-13 | 2714 | 2698 | −0.168 | −10.19 | −9.50 | −0.022 | −1.34 | 0.146 | 39.3 % | 666 | 1378 | −453.9 |

## Placebo, 40 seeds (reported, decides nothing)

Same traded days, a random long / short sign per day and seed; same entry, stop, exit and cost.

| test | window | rule net R | placebo mean | placebo 95th pct | placebo max | rule beats seeds | sign hit rate | placebo hit mean | placebo hit 95th pct | hit beats seeds |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 Gold | 2007-2015 | −0.103 | −0.146 | −0.120 | −0.089 | 39 / 40 | 52.0 % | 49.8 % | 51.4 % | 39 / 40 |
| T1 Gold | 2016 → now | −0.157 | −0.137 | −0.115 | −0.102 | 3 / 40 | 50.6 % | 50.2 % | 51.6 % | 25 / 40 |
| T2 Silver | 2007-2015 | −0.465 | −0.486 | −0.469 | −0.430 | 38 / 40 | 51.6 % | 49.9 % | 51.6 % | 37 / 40 |
| T2 Silver | 2016 → now | −0.642 | −0.641 | −0.620 | −0.615 | 21 / 40 | 50.3 % | 50.3 % | 51.9 % | 20 / 40 |
| T3 WTI crude | 2007-2015 | −0.110 | −0.102 | −0.075 | −0.067 | 10 / 40 | 48.9 % | 49.8 % | 50.9 % | 6 / 40 |
| T3 WTI crude | 2016 → now | −0.168 | −0.154 | −0.131 | −0.116 | 5 / 40 | 48.3 % | 49.9 % | 51.2 % | 1 / 40 |

## At 2× cost (reported, decides nothing)

| test | A net R | A month-sum t | B net R | B month-sum t |
|---|---|---|---|---|
| T1 Gold | −0.250 | −10.29 | −0.299 | −15.29 |
| T2 Silver | −0.954 | −18.92 | −1.275 | −21.83 |
| T3 WTI crude | −0.205 | −9.95 | −0.315 | −15.61 |

## The paper's regression (descriptive)

OLS of the last half-hour return on the first half-hour return of the floor session, both in %, on every eligible day with prices.

| test | window | n | slope | t (OLS) | t (White) | R² |
|---|---|---|---|---|---|---|
| T1 Gold | 2007-2015 | 2246 | +0.0133 | +1.09 | +0.87 | 0.05 % |
| T1 Gold | 2016 → now | 2714 | +0.0276 | +2.80 | +1.27 | 0.29 % |
| T2 Silver | 2007-2015 | 2244 | +0.0254 | +1.94 | +1.55 | 0.17 % |
| T2 Silver | 2016 → now | 2714 | +0.0347 | +2.91 | +0.69 | 0.31 % |
| T3 WTI crude | 2007-2015 | 2243 | +0.0916 | +3.57 | +2.02 | 0.56 % |
| T3 WTI crude | 2016 → now | 2714 | −0.0289 | −1.34 | −0.78 | 0.07 % |

## Net R by year (descriptive)

| year | Gold n | Gold net R | Gold total | Silver n | Silver net R | Silver total | WTI crude n | WTI crude net R | WTI crude total |
|---|---|---|---|---|---|---|---|---|---|
| 2006 | 20 | −0.057 | −1.1 | 19 | −0.576 | −10.9 | 20 | +0.069 | +1.4 |
| 2007 | 246 | −0.202 | −49.8 | 241 | −0.603 | −145.3 | 248 | −0.077 | −19.1 |
| 2008 | 249 | −0.164 | −40.9 | 244 | −0.348 | −84.8 | 250 | −0.097 | −24.3 |
| 2009 | 247 | −0.112 | −27.6 | 245 | −0.433 | −106.2 | 249 | −0.101 | −25.2 |
| 2010 | 251 | −0.080 | −20.1 | 247 | −0.443 | −109.4 | 251 | −0.184 | −46.1 |
| 2011 | 250 | +0.011 | +2.7 | 250 | −0.064 | −15.9 | 251 | −0.118 | −29.7 |
| 2012 | 248 | −0.021 | −5.1 | 248 | −0.270 | −67.1 | 246 | −0.104 | −25.5 |
| 2013 | 248 | −0.034 | −8.4 | 248 | −0.515 | −127.6 | 245 | −0.210 | −51.3 |
| 2014 | 249 | −0.229 | −57.1 | 249 | −0.724 | −180.3 | 247 | −0.083 | −20.6 |
| 2015 | 250 | −0.097 | −24.1 | 250 | −0.789 | −197.2 | 248 | −0.018 | −4.5 |
| 2016 | 250 | −0.091 | −22.8 | 251 | −0.634 | −159.2 | 251 | −0.210 | −52.8 |
| 2017 | 249 | −0.078 | −19.4 | 249 | −0.673 | −167.7 | 240 | −0.230 | −55.3 |
| 2018 | 249 | −0.239 | −59.6 | 249 | −0.973 | −242.2 | 248 | −0.205 | −50.8 |
| 2019 | 249 | −0.275 | −68.5 | 249 | −1.171 | −291.6 | 248 | −0.129 | −32.1 |
| 2020 | 251 | −0.180 | −45.2 | 251 | −0.503 | −126.3 | 251 | −0.246 | −61.6 |
| 2021 | 251 | −0.243 | −61.1 | 250 | −0.653 | −163.2 | 249 | −0.176 | −43.8 |
| 2022 | 250 | −0.159 | −39.7 | 250 | −0.647 | −161.8 | 250 | −0.067 | −16.7 |
| 2023 | 248 | −0.169 | −41.8 | 248 | −0.650 | −161.1 | 246 | −0.087 | −21.4 |
| 2024 | 249 | −0.063 | −15.6 | 248 | −0.492 | −122.0 | 248 | −0.150 | −37.2 |
| 2025 | 248 | −0.145 | −36.0 | 248 | −0.437 | −108.4 | 248 | −0.255 | −63.3 |
| 2026 | 219 | −0.074 | −16.2 | 219 | −0.173 | −37.9 | 219 | −0.086 | −18.8 |

## Days left out

- T1 Gold: 2 eligible days without a price at one of the four times, 20 days of the 20-day warm-up, 9 days with a zero signal.
- T2 Silver: 4 eligible days without a price at one of the four times, 20 days of the 20-day warm-up, 25 days with a zero signal.
- T3 WTI crude: 5 eligible days without a price at one of the four times, 20 days of the 20-day warm-up, 24 days with a zero signal.

## What it means, and what it does not

No test met the pre-registered bar. Trading the last half hour of the floor session on the sign of its first half hour is not an edge on these OANDA feeds after costs, on gold, silver or WTI crude. No proposal is written and nothing live changes. Never call it an edge.

- Before costs, 2016 → now: Gold −0.015R a trade (t −0.92), Silver −0.010R a trade (t −0.59), WTI crude −0.022R a trade (t −1.34); 2007-2015: Gold +0.044R (t +2.40), Silver +0.024R (t +1.27), WTI crude −0.015R (t −0.85). The cost a trade in R (Gold 0.142R, Silver 0.633R, WTI crude 0.146R) is large against a half-hour move, so even a small gross edge would have to clear it.
- The placebo and the hit rates say the same: in 2016 → now the sign of the first half hour is no better at calling the last half hour than a coin on gold, silver or crude.
- It tests one rule (one predictor half hour, one traded half hour, one stop) as fixed in advance; it does not test other half hours, the overnight gap, volatility or news splits.
- The prices are OANDA spot / CFD mid prices on the futures' floor-session clock, not the futures; the crude cost is an assumption (the 2× cost line shows its weight).
- It is stand-alone: it says nothing about the live gold book's systems and was not used to judge, gate or size them (owner decision 44).

To repeat: `node --use-env-proxy research/edge/metals-intraday-momentum/fetch.mjs <dir>`, then `node research/edge/metals-intraday-momentum/run.mjs <dir>`. Test: `tests/metals-intraday-momentum.test.mjs`.
