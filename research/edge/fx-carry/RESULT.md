# The FX carry trade on the G8 currencies, with a crash filter: result

**Verdict: FAIL** (neither test makes money with month-sum t ≥ 2 in 2016-26 AND makes money in 2006-15). T1 (carry, every month): +0.066R a month net in 2016-26 (n 130 months, 448 legs, t 0.34), +0.124R in 2006-15 (n 120, t 0.51). T2 (flat when S&P 500 volatility is above its 1-year median): −0.008R a month in 2016-26 (t -0.05), +0.040R in 2006-15 (t 0.22).

Pre-registration: [`PREREGISTRATION.md`](PREREGISTRATION.md) (revision 2, committed alone before any computation; revision 1, a FRED-based design that was never run because no rate host was reachable, is kept as [`PREREGISTRATION-r1.md`](PREREGISTRATION-r1.md), marked superseded). Paper research only; nothing live changed. **The policy rates are approximate and written from memory** (`rates.json`): a PASS would need them checked against their sources first; a FAIL does not hinge on them unless a ranking error is systematic.

## Results (R per month = the sum of up to four legs of 1R each, net of costs, flat months as 0)

| test | window | months (flat) | legs | net R / month | carry part | price part | cost part | month-sum t | Holm p | total R | worst drawdown R | months positive | net at 2x cost |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 2016-26 (decisive) | 130 (0) | 448 | +0.066 | +0.073 | +0.019 | −0.025 | 0.34 | 0.7338 | +8.63 | -21.74 | 52 % | −0.087 |
| T1 | 2006-15 (replication) | 120 (0) | 440 | +0.124 | +0.100 | +0.046 | −0.021 | 0.51 | – | +14.93 | -25.25 | 51 % | −0.007 |
| T2 | 2016-26 (decisive) | 130 (59) | 243 | −0.008 | +0.046 | −0.039 | −0.014 | -0.05 | 0.7338 | −0.98 | -21.54 | 25 % | −0.093 |
| T2 | 2006-15 (replication) | 120 (56) | 230 | +0.040 | +0.050 | +0.002 | −0.011 | 0.22 | – | +4.81 | -13.61 | 27 % | −0.030 |

## Pass conditions (pre-registered)

| test | 1: t ≥ 2, mean > 0 (2016-26) | 2: mean > 0 (2006-15) | 3: Holm p < 0.05 | 4: beats ≥ 38 of 40 placebos | 5: > 0 at 2x cost | pass |
|---|---|---|---|---|---|---|
| T1 | no | yes | no | no (34 of 40) | no | no |
| T2 | no | yes | no | no (23 of 40) | no | no |

## Placebo (40 seeds, random currencies each month, same mechanics), 2016-26 mean net R a month

| test | rule | placebo 5th | 50th | 95th | placebos beaten |
|---|---|---|---|---|---|
| T1 | +0.066 | −0.308 | −0.095 | +0.112 | 34 of 40 |
| T2 | −0.008 | −0.193 | −0.026 | +0.126 | 23 of 40 |

## By year (T1, net R, with its carry and price parts)

| year | months | legs | net R | carry | price |
|---|---|---|---|---|---|
| 2006 | 12 | 48 | +5.00 | +3.08 | +2.22 |
| 2007 | 12 | 48 | +5.28 | +3.15 | +2.43 |
| 2008 | 12 | 40 | −18.00 | +1.77 | −19.60 |
| 2009 | 12 | 36 | +11.24 | +0.54 | +10.83 |
| 2010 | 12 | 36 | +6.00 | +1.19 | +4.98 |
| 2011 | 12 | 40 | −5.53 | +0.48 | −5.81 |
| 2012 | 12 | 48 | +0.42 | +0.55 | +0.19 |
| 2013 | 12 | 48 | −3.53 | +0.37 | −3.60 |
| 2014 | 12 | 48 | +13.56 | +0.34 | +13.61 |
| 2015 | 12 | 48 | +0.48 | +0.45 | +0.27 |
| 2016 | 12 | 48 | −7.41 | +0.30 | −7.42 |
| 2017 | 12 | 48 | −10.21 | +0.29 | −10.14 |
| 2018 | 12 | 39 | +4.31 | +1.05 | +3.56 |
| 2019 | 12 | 36 | +7.17 | +1.46 | +6.07 |
| 2020 | 12 | 45 | −1.43 | −0.29 | −0.80 |
| 2021 | 12 | 48 | +8.32 | −1.15 | +9.86 |
| 2022 | 12 | 45 | −0.66 | +0.26 | −0.64 |
| 2023 | 12 | 36 | +0.24 | +1.81 | −1.34 |
| 2024 | 12 | 37 | +2.30 | +2.32 | +0.26 |
| 2025 | 12 | 36 | +1.60 | +1.79 | +0.05 |
| 2026 | 10 | 30 | +4.40 | +1.67 | +2.96 |

## What was picked (T1, months as long / short)

| currency | 2016-26 long | short | 2006-15 long | short |
|---|---|---|---|---|
| USD | 72 | 0 | 0 | 40 |
| EUR | 0 | 79 | 0 | 41 |
| GBP | 30 | 0 | 0 | 0 |
| JPY | 0 | 51 | 0 | 79 |
| AUD | 35 | 0 | 120 | 0 |
| NZD | 94 | 0 | 120 | 0 |
| CAD | 29 | 0 | 0 | 0 |
| CHF | 0 | 130 | 0 | 80 |

A USD pick is a flat leg (no position). T2 was flat by the filter in 59 of 130 decisive months and 56 of 120 replication months. Exits in 2016-26 (T1): stop 227, month 217, gap 4 (month = closed at the next rebalance, stop = inside a candle, gap = at a candle's open).

## Reading

- **Where the R comes from (T1, 2016-26)**: carry +0.073R a month, price +0.019R, costs −0.025R. In 2006-15: carry +0.100R, price +0.046R. The carry is small next to a 2 x ATR stop: a 4-point rate gap less the 1 % markup is about 0.25 % of price a month, while a leg's 1R (2 x ATR(20)) was a median 1.51 % of price in 2016-26 (2 % in 2006-15).
- **The crash filter**: T2 minus T1 in 2016-26 = −0.074R a month; in 2006-15 −0.084R.
- **Against chance**: the rule's 2016-26 mean beats 34 of 40 random-currency books for T1 and 23 of 40 for T2.
- Never call this an edge without its n and t above. Nothing is proposed on a FAIL; a new carry test would need fetched (not remembered) rates and its own pre-registration.

## Decisions the pre-registration made where the brief was silent

- Ties broken by the fixed list order USD, EUR, GBP, JPY, AUD, NZD, CAD, CHF; every leg closed and reopened monthly (full round trip); a month's R is the SUM of its legs; exit time of a stop inside a daily candle = midday (night count); the 1 % markup on every leg whichever side; half a spread of slippage on both market orders.
- The ranking uses the rates in force on the rebalance day; the carry uses the rates in force on each rollover's date.

To repeat: `node research/edge/fx-carry/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Tests: `tests/fx-carry.test.mjs`.
