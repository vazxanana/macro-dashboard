# Gold in the three days before US CPI and payrolls, and the fade after the print: result

**Verdict: FAIL: 0 of 3 tests pass; best T2 +0.088R a trade net (n 47, month t 2.07, Holm p 0.067, 37 of 40 placebos).**

Pre-registered in PREREGISTRATION.md (pushed before any candle was read). Paper research only; a stand-alone event rule, not a gate, exit, entry or size of the live gold book (item 44 untouched: no 2006-17 data is used). Nothing live changed. Not an edge; every figure carries its n and t.

Data: OANDA mid H1 gold through /md/bars (52931 candles, 2017-12-01 to 2026-11-13). Events: CPI 74 kept of 91 listed (2018-02-14 to 2026-10-14), NFP 47 of 58 (2022-01-07 to 2026-11-06). **Small sample, no untouched out-of-sample**; the last 24 hours of the T1 / T2 window were already read by `pre-release-drift`.

## The three tests (net R a trade; t on calendar-month sums, one-sided; Holm over 3)

| Test | n | months | gross R | net R | t | Holm p | 2x costs | first half | second half | placebo beats | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 pre-CPI long, 3 days | 74 | 74 | +0.043 | +0.024 | 0.93 | 0.353 | +0.005 | +0.058 (n 37) | -0.010 (n 37) | 28 of 40 (p95 0.054) | no |
| T2 pre-NFP long, 3 days | 47 | 47 | +0.109 | +0.088 | 2.07 | 0.067 | +0.068 | +0.043 (n 23) | +0.132 (n 24) | 37 of 40 (p95 0.097) | no |
| T3 fade the pre-move, 09:00-16:00 | 121 | 84 | -0.001 | -0.027 | -0.53 | 0.702 | -0.053 | +0.000 (n 60) | -0.054 (n 61) | 27 of 40 (p95 0.001) | no |

Checks (t ≥ 2 and Holm p < 0.05 / both halves > 0 / 2x costs > 0 / 38+ of 40 placebo): T1 tHolm no, halves no, costs2 yes, placebo no; T2 tHolm no, halves yes, costs2 yes, placebo no; T3 tHolm no, halves no, costs2 no, placebo no.

Halves: T1 2018-02-14..2022-11-10 | 2022-12-13..2026-10-14; T2 2022-01-07..2024-07-05 | 2024-09-06..2026-11-06; T3 2018-02-14..2023-09-01 | 2023-09-13..2026-11-06. Stops reached: T1 0 of 74, T2 0 of 47, T3 9 of 121. Median risk a unit: T1 $99.98, T2 $108.62, T3 $24.1.

## Reported, never judged

- Raw three-day drift (E 17:00 New York, three weekdays before, to 08:00 on the day): CPI +0.1796 % (n 74, t 1.21); NFP +0.6152 % (n 47, t 2.89).
- T1 by stretch: 2018-21 0.041 R (n 26, t 0.96); 2022-26 0.015 R (n 48, t 0.46).
- T3 by release: CPI -0.042 R (n 74, t -0.66); NFP -0.003 R (n 47, t -0.04). After an up pre-move (sell): -0.037 R (n 74, t -0.59); after a down one (buy): -0.011 R (n 47, t -0.13). Correlation of the pre-move with the 09:00-16:00 move: 0.189.
- By year (net R a trade, n): T1 2018 0.093 (7), 2019 0.118 (9), 2020 -0.101 (2), 2021 -0.055 (8), 2022 0.088 (12), 2023 -0.001 (9), 2024 0.028 (10), 2025 0.01 (10), 2026 -0.102 (7); T2 2022 0.023 (10), 2023 0.011 (8), 2024 0.055 (9), 2025 0.065 (10), 2026 0.269 (10); T3 2018 -0.019 (7), 2019 0.026 (9), 2020 -0.115 (2), 2021 0.051 (8), 2022 0.019 (22), 2023 0.109 (17), 2024 -0.113 (19), 2025 -0.049 (20), 2026 -0.158 (17).

## Placebo

40 seeded draws (mulberry32, seed 20261114 + draw): each event moved to a random weekday of its own month with no release of the repository's lists on it or in its window, same times, rules and costs. T1 median -0.007, 95th 0.054; T2 median 0.023, 95th 0.097; T3 median -0.043, 95th 0.001.

## Dates dropped

- event-base `dropped` (CPI 2018-21 failing its spike check, never events here): 2018-01-12, 2018-04-11, 2018-06-12, 2018-07-12, 2019-12-11, 2020-02-13, 2020-03-11, 2020-04-10, 2020-05-12, 2020-06-10, 2020-07-14, 2020-08-12, 2020-10-13, 2020-11-12, 2021-01-13.
- By this study: CPI 2018-03-13 (another release in the window: NFP? 2018-03-09); CPI 2019-03-12 (another release in the window: NFP? 2019-03-08); CPI 2019-08-13 (another release in the window: NFP? 2019-08-09); CPI 2020-01-14 (another release in the window: NFP? 2020-01-10); CPI 2021-04-13 (another release in the window: NFP? 2021-04-09); CPI 2021-07-13 (another release in the window: NFP? 2021-07-09); CPI 2021-09-14 (another release in the window: NFP? 2021-09-10); CPI 2023-03-14 (another release in the window: NFP 2023-03-10); CPI 2023-04-12 (missing candles); CPI 2023-12-12 (another release in the window: NFP 2023-12-08); CPI 2024-03-12 (another release in the window: NFP 2024-03-08); CPI 2024-06-12 (another release in the window: FOMC 2024-06-12); CPI 2025-12-18 (another release in the window: NFP 2025-12-16); CPI 2026-01-13 (another release in the window: NFP 2026-01-09); CPI 2026-02-13 (another release in the window: NFP 2026-02-11); CPI 2026-05-12 (another release in the window: NFP 2026-05-08); CPI 2026-11-10 (another release in the window: NFP 2026-11-06); NFP 2022-05-06 (another release in the window: FOMC 2022-05-04); NFP 2022-11-04 (another release in the window: FOMC 2022-11-02); NFP 2023-02-03 (another release in the window: FOMC 2023-02-01); NFP 2023-04-07 (missing candles); NFP 2023-05-05 (another release in the window: FOMC 2023-05-03); NFP 2023-11-03 (another release in the window: FOMC 2023-11-01); NFP 2024-02-02 (another release in the window: FOMC 2024-01-31); NFP 2024-05-03 (another release in the window: FOMC 2024-05-01); NFP 2024-08-02 (another release in the window: FOMC 2024-07-31); NFP 2025-08-01 (another release in the window: FOMC 2025-07-30); NFP 2026-04-03 (missing candles).

## Post hoc (written after the results; descriptive, not a test)

- T2 is the near miss: +0.088R a trade, month t 2.07, but Holm p 0.067 and 37 of 40 placebo draws (the same three-day hold on ordinary days of the same months has median +0.023R, 95th percentile +0.097R): part of it is gold's rise over 2022-26, and what is left over the placebo is not told apart from chance on 47 trades. 2026 alone gives +0.269R a trade (n 10). A further look needs other data (payrolls before 2022, or another market) and its own pre-registration; nothing here is an edge.
- The stop (2 x ATR20 x √hours, about 16 hourly ATRs over three days) was never reached on T1 / T2, so their R is the three-day move divided by a wide stop: small figures per trade by construction.
- T3: the pre-move and the move after the print are positively correlated (0.189), the opposite of an unwind; fading it lost a little.

## Notes

- Costs: $0.30 spread + $0.15 slippage on each of two market orders ($0.60 a round trip); gold longs pay financing `nights` x `FIN.xau.long` (0.000148, 2026-11-11) x entry, today's rate every year. Stop 2 x ATR20(H1) x √(hours held), never moved.
- Payroll dates before 2022 are not in the repository, so T2 is 2022 on only and 2018-21 placebo days avoid the first and second Friday of each month.
- To repeat: `node --use-env-proxy research/edge/gold-pre-cpi/fetch.mjs <dir>`, then `node research/edge/gold-pre-cpi/run.mjs <dir>`.
