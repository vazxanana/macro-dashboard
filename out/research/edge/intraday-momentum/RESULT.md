# Market intraday momentum, out of sample: result

**Verdict: FAIL.** SPX500, 2016 → now: n 2672, −0.159R a trade net of costs, t −9.09 (before costs −0.012R, t −0.70); sign hit rate 48.5 % against a placebo 95th percentile of 51.2 %; Holm p 1.000. NAS100, 2016 → now: n 2682, −0.093R a trade net of costs, t −5.45 (before costs +0.003R, t +0.19); sign hit rate 50.4 % against a placebo 95th percentile of 51.6 %; Holm p 1.000.

Pre-registered in `PREREGISTRATION.md` (committed before any figure was computed). Paper: Gao, Han, Li and Zhou (2018), Journal of Financial Economics, "Market intraday momentum"; SPY data 1993-2013. Rule: signal = previous 16:00 New York price to 10:00; at 15:30 long if > 0, short if < 0; exit 16:00; stop 1.5 x the 20-day mean |16:00 - 15:30| move. Costs, round trip: SPX500 1 point, NAS100 2 points. Data: OANDA mid M5 candles through the candle proxy; NYSE calendar stated in the pre-registration (half days and the day after one skipped).

The paper's data end in 2013: window A (2008-2015) overlaps its sample for 2008-2013 and is descriptive; window B (2016 → now) is wholly after it and decides.

## Per market and window

| market | window | days | trades | net R a trade | t | gross R | t gross | cost R | win | stops | hit rate | placebo 95th pct | beats seeds | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SPX500 | 2008-2015 | 1969 | 1936 | −0.261 | −13.10 | +0.035 | +1.77 | 0.295 | 33.7 % | 415 | 52.7 % | 51.2 % | 40 / 40 | not judged |
| SPX500 | 2016 → now | 2687 | 2672 | −0.159 | −9.09 | −0.012 | −0.70 | 0.147 | 38.3 % | 605 | 48.5 % | 51.2 % | 2 / 40 | no |
| NAS100 | 2008-2015 | 1969 | 1940 | −0.271 | −13.92 | +0.034 | +1.77 | 0.305 | 34.1 % | 414 | 52.1 % | 51.0 % | 40 / 40 | not judged |
| NAS100 | 2016 → now | 2684 | 2682 | −0.093 | −5.45 | +0.003 | +0.19 | 0.096 | 43.4 % | 605 | 50.4 % | 51.6 % | 21 / 40 | no |

"pass" = window B net R > 0 and t ≥ 2, hit rate above the placebo 95th percentile, and Holm p < 0.05 over the two markets.

| market | p (one-sided) | Holm p | net > 0 and t ≥ 2 | hit > placebo | Holm < 0.05 |
|---|---|---|---|---|---|
| SPX500 | 1.000 | 1.000 | no | no | no |
| NAS100 | 1.000 | 1.000 | no | no | no |

## The paper's regression (descriptive)

OLS of the last half-hour return (15:30-16:00) on the first (previous 16:00 to 10:00), both in %, on every eligible day with prices.

| market | window | n | slope | t (OLS) | t (White) | R² |
|---|---|---|---|---|---|---|
| SPX500 | 2008-2015 | 1969 | +0.0779 | +6.39 | +3.23 | 2.03 % |
| SPX500 | 2016 → now | 2687 | +0.0144 | +1.81 | +0.52 | 0.12 % |
| NAS100 | 2008-2015 | 1969 | +0.0497 | +4.43 | +2.27 | 0.99 % |
| NAS100 | 2016 → now | 2684 | +0.0231 | +3.14 | +1.05 | 0.37 % |

## Net R by year (descriptive)

| year | SPX500 n | SPX500 net R a trade | SPX500 total | NAS100 n | NAS100 net R a trade | NAS100 total |
|---|---|---|---|---|---|---|
| 2008 | 227 | +0.015 | +3.4 | 227 | −0.060 | −13.6 |
| 2009 | 248 | −0.270 | −67.0 | 244 | −0.384 | −93.7 |
| 2010 | 250 | −0.315 | −78.7 | 249 | −0.351 | −87.5 |
| 2011 | 249 | −0.306 | −76.3 | 248 | −0.309 | −76.5 |
| 2012 | 240 | −0.332 | −79.7 | 243 | −0.297 | −72.1 |
| 2013 | 237 | −0.196 | −46.5 | 241 | −0.293 | −70.6 |
| 2014 | 241 | −0.374 | −90.1 | 243 | −0.283 | −68.8 |
| 2015 | 244 | −0.286 | −69.8 | 245 | −0.172 | −42.3 |
| 2016 | 246 | −0.341 | −84.0 | 248 | −0.203 | −50.2 |
| 2017 | 240 | −0.443 | −106.4 | 247 | −0.275 | −67.8 |
| 2018 | 245 | −0.176 | −43.1 | 243 | −0.051 | −12.5 |
| 2019 | 245 | −0.170 | −41.6 | 246 | −0.112 | −27.5 |
| 2020 | 249 | −0.080 | −20.0 | 249 | +0.015 | +3.7 |
| 2021 | 247 | −0.198 | −48.9 | 250 | −0.159 | −39.8 |
| 2022 | 247 | −0.059 | −14.6 | 247 | −0.055 | −13.5 |
| 2023 | 246 | −0.091 | −22.4 | 246 | −0.123 | −30.2 |
| 2024 | 246 | −0.022 | −5.5 | 246 | −0.036 | −8.8 |
| 2025 | 244 | −0.043 | −10.5 | 244 | −0.009 | −2.2 |
| 2026 | 217 | −0.128 | −27.7 | 216 | −0.003 | −0.7 |

## Days left out

- SPX500: 14 eligible days without a price at one of the four times, 20 days of the 20-day warm-up, 28 days with a zero signal.
- NAS100: 17 eligible days without a price at one of the four times, 20 days of the 20-day warm-up, 11 days with a zero signal.

## Reading

No market met the pre-registered bar. The rule is not an edge on these feeds after costs; no proposal is written and nothing live changes. Never call it an edge.

Descriptive, decides nothing: in 2008-2015 (mostly the paper's own years) the sign still predicted (SPX500 hit rate 52.7 %, beating 40 of 40 seeds; slope White t +3.23), but a half-hour move is small against a CFD round trip, so the cost (0.295R a trade) dwarfed the gross +0.035R. After 2015 the sign no longer predicts on SPX500 (hit 48.5 %, White t +0.52) or NAS100 (hit 50.4 %, White t +1.05); gross R is about zero on both.

To repeat: `node --use-env-proxy research/edge/intraday-momentum/fetch.mjs <dir>`, then `node research/edge/intraday-momentum/run.mjs <dir>`. Test: `tests/intraday-momentum.test.mjs`.
