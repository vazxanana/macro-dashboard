# Drift in the 24 hours before US CPI and payrolls (gold and the dollar): result

**Verdict: FAIL** (0 of 10 cells pass). Pre-registered in PREREGISTRATION.md (committed and pushed before any candle was fetched). Paper research only; nothing live changed.

Events: council/event-base.json rows (built 2026-11-10T07:25:34.270Z): CPI 86 (2018-02-14 to 2026-10-14), NFP 51 (2022-01-07 to 2026-10-02). Data: OANDA mid M5 + H1 via /md/bars.

## Trades (entry 24 h before the release, stop 1 x ATR(14) H1, out 5 minutes before it), net R a trade

| Release | Cell | USD side | n | net R | t | p | Holm p | gross | cost R | 2x costs | first half | second half | placebo p95 | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CPI | Gold (XAU/USD), long | n/a | 86 | -0.404 | -1.82 | 0.964 | 1.000 | -0.297 | 0.107 | -0.511 | -0.129 (n 43) | -0.678 (n 43) | +0.465 | no |
| CPI | EUR/USD (long USD = short) | short | 86 | +0.092 | +0.30 | 0.767 | 1.000 | +0.363 | 0.271 | -0.178 | -0.042 (n 43) | +0.227 (n 43) | +0.485 | no |
| CPI | USD/JPY (long USD = long) | short | 86 | -0.358 | -1.34 | 0.185 | 1.000 | -0.143 | 0.215 | -0.573 | -0.295 (n 43) | -0.422 (n 43) | +0.276 | no |
| CPI | GBP/USD (long USD = short) | short | 86 | +0.122 | +0.47 | 0.641 | 1.000 | +0.320 | 0.198 | -0.076 | +0.109 (n 43) | +0.135 (n 43) | +0.347 | no |
| CPI | USD basket (3 legs) | short | 86 | -0.048 | -0.21 | 0.831 | 1.000 | +0.180 | 0.228 | -0.276 | -0.076 (n 43) | -0.020 (n 43) | +0.301 | no |
| NFP | Gold (XAU/USD), long | n/a | 51 | -0.609 | -3.43 | 0.999 | 1.000 | -0.535 | 0.074 | -0.683 | -0.595 (n 25) | -0.622 (n 26) | +0.542 | no |
| NFP | EUR/USD (long USD = short) | short | 51 | -0.143 | -0.35 | 0.728 | 1.000 | +0.106 | 0.249 | -0.393 | +0.379 (n 25) | -0.645 (n 26) | +0.532 | no |
| NFP | USD/JPY (long USD = long) | short | 51 | +0.033 | +0.10 | 0.918 | 1.000 | +0.173 | 0.140 | -0.108 | +0.120 (n 25) | -0.051 (n 26) | +0.359 | no |
| NFP | GBP/USD (long USD = short) | short | 51 | -0.389 | -1.43 | 0.159 | 1.000 | -0.198 | 0.190 | -0.579 | -0.274 (n 25) | -0.499 (n 26) | +0.480 | no |
| NFP | USD basket (3 legs) | short | 51 | -0.166 | -0.83 | 0.409 | 1.000 | +0.027 | 0.193 | -0.360 | +0.075 (n 25) | -0.398 (n 26) | +0.244 | no |

## Drift (percent move, 24 h before to 5 minutes before; gold signed long, pairs and basket long USD)

| Release | Cell | n | mean % | t | test | p | Holm p |
|---|---|---|---|---|---|---|---|
| CPI | Gold (XAU/USD), long | 86 | +0.0396 | +0.44 | one (long) | 0.329 | 1.000 |
| CPI | EUR/USD (long USD = short) | 86 | -0.0555 | -1.38 | two | 0.171 | 1.000 |
| CPI | USD/JPY (long USD = long) | 86 | +0.0389 | +0.94 | two | 0.352 | 1.000 |
| CPI | GBP/USD (long USD = short) | 86 | -0.0918 | -1.91 | two | 0.059 | 1.000 |
| CPI | USD basket (3 legs) | 86 | -0.0361 | -1.10 | two | 0.272 | 1.000 |
| NFP | Gold (XAU/USD), long | 51 | +0.0378 | +0.39 | one (long) | 0.348 | 1.000 |
| NFP | EUR/USD (long USD = short) | 51 | -0.0139 | -0.22 | two | 0.826 | 1.000 |
| NFP | USD/JPY (long USD = long) | 51 | -0.0306 | -0.45 | two | 0.655 | 1.000 |
| NFP | GBP/USD (long USD = short) | 51 | -0.0043 | -0.08 | two | 0.939 | 1.000 |
| NFP | USD basket (3 legs) | 51 | -0.0163 | -0.33 | two | 0.740 | 1.000 |

## Placebo

40 seeded runs per cell on Tuesday-Friday days between the type's first and last event, 08:30 New York, no CPI / NFP / FOMC within 48 h; same rule (USD side from each run's own first half).

| Release | Cell | placebo days | median | 95th pct | the cell |
|---|---|---|---|---|---|
| CPI | xau | 1154 | +0.035 | +0.465 | -0.404 |
| CPI | eurusd | 1154 | -0.163 | +0.485 | +0.092 |
| CPI | usdjpy | 1154 | -0.073 | +0.276 | -0.358 |
| CPI | gbpusd | 1154 | -0.119 | +0.347 | +0.122 |
| CPI | usd | 1154 | -0.080 | +0.301 | -0.048 |
| NFP | xau | 508 | +0.037 | +0.542 | -0.609 |
| NFP | eurusd | 508 | -0.158 | +0.532 | -0.143 |
| NFP | usdjpy | 508 | +0.010 | +0.359 | +0.033 |
| NFP | gbpusd | 508 | -0.122 | +0.480 | -0.389 |
| NFP | usd | 508 | -0.164 | +0.244 | -0.166 |

## Notes

- Costs: the frozen `cpi-follow` model (gold $0.30, forex 0.3 pip + 0.000045 x price + 2 pip a round trip) plus long-gold financing (`council/fills.mjs` `nights` x `FIN.xau.long`, today's rate every year), declared in the pre-registration. Forex swaps are not charged (the frozen model has none).
- Pairs and basket: the USD side is fixed from the first half's mean drift; their p is two-sided. Holm runs over all 20 p-values (10 drift, 10 trade).
- Stops: a 1 x ATR(14) H1 stop over a 24-hour hold is reached on most trades (gold CPI 72 of 86, NFP 43 of 51), so the trade version measures a tight-stop long, not the drift itself; the drift table is the direct reading and shows no consistent move (largest |t| 1.91).
- Post hoc, descriptive only (not a test, not a short-gold hypothesis): gold long (both releases) beats only CPI 1 of 40, NFP 1 of 40 placebo means. Its drift is not negative (CPI +0.0396 %, NFP +0.0378 %); the loss comes from stops reached inside the 24 hours. Any short-side or wider-stop reading would need its own pre-registration on other data.
- The two halves: CPI splits 2018-22 | 2022-26, payrolls 2022-24 | 2024-26 (event-base has payrolls from 2022 only).
- A cell is never called an edge here; every figure carries its n and t. Nothing under `council/`, `api/`, config or any live rule changed.
