# Result: relative momentum between Ether and Bitcoin (14 Nov 2026)

**Verdict: FAIL, 0 of 2 tests pass.** Trading the 4-week trend of the ETH/BTC ratio for one more week as an equal-notional
two-leg spread (T1) made +0.014R a week after costs and financing in 2022-26 (251 weeks, weekly t 0.68), under its own
random-side placebo's 95th percentile (+0.033R). Holding, long only, whichever of BTC and ETH was stronger over 4 weeks (T2)
made +0.018R a week (251 weeks, t 0.35), no better than a coin picked at random each week (placebo mean +0.019R, p95 +0.048R)
and level with simply holding BTC the same way (difference −0.001 % a week, t −0.00). Both were positive in 2018-21 (T2 +0.114R,
t 2.11, carried by 2020), but neither clears t ≥ 2, Holm or the placebo on 2022 on. Not an edge; no proposal; nothing live
changed. Rules, windows and pass bar: `PREREGISTRATION.md` (committed before this run).

## Decisive window: entry Mondays 2022-01-03 to 2026-10-19 (251 weeks; Holm over two)

| Test | Weeks | Net R a week | Gross R a trade | Weekly t | p (one-sided) | Holm p | Win % | Legs stopped (gaps) | Cost R | Financing R | Worst DD R | Sharpe (R) | Placebo mean / p95 | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 ratio trend | 251 | +0.014 | +0.047 | +0.682 | 0.248 | 0.496 | 47.0 | 77 (0) | 0.006 | 0.027 | 4.892 | 0.31 | +0.005 / +0.033 | no |
| T2 rotation | 251 | +0.018 | +0.060 | +0.348 | 0.364 | 0.496 | 44.2 | 40 (0) | 0.006 | 0.035 | 10.382 | 0.16 | +0.019 / +0.048 | no |

Which checks failed: weekly t ≥ 2, Holm p ≤ 0.05 and the placebo in both. Passed: net R > 0 and the 2018-21 sign in both.
Financing (0.027-0.035R a week) took more than half of each test's gross R; costs a further 0.006R.

## Replication window: entry Mondays 2018-01-01 to 2021-12-27 (209 weeks)

| Test | Weeks | Net R a week | Weekly t | Sharpe (R) | Same sign as required (> 0) |
|---|---|---|---|---|---|
| T1 ratio trend | 209 | +0.021 | +0.920 | 0.46 | yes |
| T2 rotation | 209 | +0.114 | +2.108 | 1.05 | yes |

## Net R by year

| Test | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|
| T1 | +2.628 | +0.557 | +2.396 | −1.235 | +1.853 | +0.090 | −2.722 | +2.166 | +2.222 |
| T2 | −3.390 | +5.414 | +19.287 | +2.503 | −4.330 | +7.754 | +0.131 | +1.097 | −0.085 |

T2's 2018-21 figure is mostly 2020 (+19.3R of +23.8R).

## T2 against holding BTC (reported, not part of the pass)

Weekly net return of notional (one unit long), after costs and financing where a stop rule applies; Sharpe = weekly × √52.

| Window | Weeks in ETH | T2 % a week | T2 Sharpe | BTC, same weekly stop rule, % a week | its Sharpe | BTC buy and hold % a week | its Sharpe | T2 − BTC (same rule) % a week | t |
|---|---|---|---|---|---|---|---|---|---|
| 2022-26 | 98 of 251 | +0.030 | 0.03 | +0.031 | 0.03 | +0.439 | 0.47 | −0.001 | −0.00 |
| 2018-21 | 102 of 209 | +1.231 | 0.73 | +0.649 | 0.47 | +1.160 | 0.79 | +0.582 | +1.12 |

On 2022 on, rotating between the two coins was the same as always holding BTC with the same weekly stop, and both were far
behind plain buy and hold (whose weekly stop-outs and nine nights of 15 % swap a week the stop rule pays; buy and hold is shown
without cost or financing).

T1's Sharpe of the weekly return of notional (per unit on each leg) is −0.01 on 2022-26 and 0.32 on 2018-21: in R it is
positive because R divides by each week's combined stop distance, which gives calm weeks more weight.

## Costs and financing used

- CFD round trip 0.04 % of the entry price per leg (`CFD_CRYPTO`), plus half a spread (0.01 % of price) at entry and at exit.
- Swap, council-data `ctrader/symbols.json` (demo broker, percent a year, all charges): **BTCUSD long 15 %, short 7.5 %;
  ETHUSD long 15 %, short 10 %**; nights at 17:00 New York, Friday counted three times (9 nights a full week). Today's rates
  for every year.

## Data

Binance spot daily BTCUSDT and ETHUSDT, 2017-08-17 to 2026-10-31, 3,363 days each, no missing day. The last full week on file
ends Sunday 2026-10-25. No crypto stop was gapped through on a daily open (crypto trades through the UTC midnight).

## Notes

- The brief's "weekly close (Sunday 00:00)" was read as the close of the Sunday UTC candle (Monday 00:00 UTC), entering at the
  Monday open; fixed in the pre-registration before any result.
- Not tested (would need their own pre-registration): other lookbacks, a volatility-weighted spread, other pairs, no stop.
- To repeat: `git fetch origin council-data && node research/edge/eth-btc-ratio/run.mjs`.
