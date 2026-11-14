# Gold: the volatility breakout as a stop-and-reverse straddle

Paper research only. A stand-alone question about the `gold-vol-breakout` T1 rule (not a gate, exit, entry or size of the live gold book, none of whose records were read): on the days T1 is stopped back at the open, is the cancelled opposite stop order worth keeping until 21:00 UTC? Every window of the base rule had been read by three studies before this one; no reverse trade had been computed. Nothing live changed, no proposal. The plan was pushed first (`PREREGISTRATION.md`, sha256 in `result.json`); T1 comes from `original.mjs`, a verbatim copy of the original `run.mjs`. This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL: the reverse trade after a T1 stop-out made −0.181R a trade net 2017-26 (n 219, month t −2.29), 2007-16 −0.097R; failed t2, holm, isSame, cost2x, placebo**

## Harness gate

T1 on 2007-01-01 → 2015-12-31 against the replicate's published figure: n 1657 (1657), net +0.111 (+0.111), gross +0.203 (+0.203), 2x +0.018 (+0.018), month t +3.19 (+3.19), gross t +5.96 (+5.96): exact yes.

## Reverse trades (R1, R3)

| Test | Period | n | Win | Net R/trade | Gross R/trade | Net at 2x | Total R | Month t | Gross t | t at 2x | Stops / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R1 | 2007-2016 | 230 | 38.3 % | −0.097 | +0.044 | −0.239 | −22.33 | −1.01 | +0.48 | −2.28 | 94 / 136 | −33.46 | 5.8 |
| R1 | 2017 → 2026-10 | 219 | 35.6 % | −0.181 | −0.079 | −0.282 | −39.55 | −2.29 | −1.01 | −3.51 | 88 / 131 | −41.05 | 7.36 |
| R3 | 2007-2016 | 70 | 34.3 % | −0.135 | +0.075 | −0.345 | −9.47 | −0.62 | +0.36 | −1.40 | 39 / 31 | −20.97 | 5.22 |
| R3 | 2017 → 2026-10 | 79 | 27.8 % | −0.241 | −0.118 | −0.364 | −19.06 | −1.46 | −0.71 | −2.23 | 46 / 33 | −19.28 | 6.28 |

## The combined day against T1 alone (R2, per T1 day)

| Period | Series | Days | Net R a day | Gross R a day | Net at 2x | Total R | Month t | Gross t | Max DD R |
|---|---|---|---|---|---|---|---|---|---|
| 2007-2016 | T1 alone | 1837 | +0.101 | +0.193 | +0.008 | +185.19 | +3.14 | +6.13 | −25.66 |
| 2007-2016 | T1 + reverse | 1837 | +0.089 | +0.199 | −0.021 | +162.86 | +2.48 | +5.84 | −27.17 |
| 2007-2016 | difference | 1837 | −0.012 | +0.006 | −0.030 | −22.33 | −1.01 | +0.48 | −33.46 |
| 2017 → 2026-10 | T1 alone | 1869 | +0.044 | +0.116 | −0.027 | +83.05 | +1.49 | +4.01 | −39.18 |
| 2017 → 2026-10 | T1 + reverse | 1869 | +0.023 | +0.107 | −0.060 | +43.50 | +0.72 | +3.44 | −59.32 |
| 2017 → 2026-10 | difference | 1869 | −0.021 | −0.009 | −0.033 | −39.55 | −2.28 | −1.01 | −41.05 |

## Decision (out of sample, Holm over R1-R3; only R1 decides)

| Test | Month t | p | Holm p | t ≥ 2 | Holm < 0.05 | in sample > 0 (and out of sample > 0) | 2x cost > 0 | n ≥ 150 | placebos beaten (need 38 of 40) | pass |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 | −2.29 | 0.989 | 1 | no | no | no | no | yes | 6 | **fail** |
| R2 | −2.28 | 0.989 | 1 | no | no | no | no | yes | 6 | **fail** |
| R3 | −1.46 | 0.928 | 1 | no | no | no | no | no | 7 | **fail** |

## Placebo (out of sample, 40 seeds)

For every real reverse trade, a market entry at the open of the same fill candle, side by a fair coin, stop the same distance away, out at 21:00 UTC or the stop, the same costs. R2: the placebo trades added to the T1 days, per day.

| Test | Real net R | Placebo median | Placebo 95th percentile | Placebo min / max |
|---|---|---|---|---|
| R1 | −0.181 | −0.109 | −0.030 | −0.283 / +0.017 |
| R2 | −0.021 | −0.013 | −0.004 | −0.033 / +0.002 |
| R3 | −0.241 | −0.157 | +0.113 | −0.381 / +0.154 |

## How often the reverse order fills

| Period | T1 days | T1 stopped at O | Reverse filled | Fill rate |
|---|---|---|---|---|
| 2007-2016 | 1837 | 618 | 230 | 37.2 % |
| 2017 → 2026-10 | 1869 | 647 | 219 | 33.8 % |

## By UTC hour of the first stop-out (whole period)

| Hour | T1 stop-outs | Reverse fills | Net R a reverse trade |
|---|---|---|---|
| 00:00 | 6 | 4 | −2.455 |
| 01:00 | 16 | 11 | +0.994 |
| 02:00 | 8 | 5 | −0.700 |
| 03:00 | 8 | 4 | −0.367 |
| 04:00 | 10 | 6 | −0.951 |
| 05:00 | 19 | 9 | +0.082 |
| 06:00 | 22 | 13 | +0.413 |
| 07:00 | 44 | 24 | −0.228 |
| 08:00 | 30 | 15 | −0.504 |
| 09:00 | 39 | 15 | −0.398 |
| 10:00 | 36 | 17 | +0.190 |
| 11:00 | 52 | 26 | −0.358 |
| 12:00 | 162 | 77 | −0.025 |
| 13:00 | 238 | 92 | −0.186 |
| 14:00 | 189 | 66 | −0.187 |
| 15:00 | 129 | 29 | −0.189 |
| 16:00 | 62 | 10 | −0.156 |
| 17:00 | 65 | 8 | +0.425 |
| 18:00 | 75 | 12 | +0.077 |
| 19:00 | 43 | 5 | +0.375 |
| 20:00 | 12 | 1 | −1.172 |

## By year (R1, net R a trade, n)

| Year | Net R | n | Total R |
|---|---|---|---|
| 2007 | −0.366 | 17 | −6.23 |
| 2008 | −0.596 | 22 | −13.11 |
| 2009 | −0.091 | 21 | −1.91 |
| 2010 | +0.162 | 18 | +2.92 |
| 2011 | −0.229 | 23 | −5.26 |
| 2012 | −0.150 | 28 | −4.20 |
| 2013 | −0.022 | 21 | −0.47 |
| 2014 | +0.533 | 25 | +13.34 |
| 2015 | −0.400 | 29 | −11.61 |
| 2016 | +0.161 | 26 | +4.20 |
| 2017 | −0.430 | 21 | −9.04 |
| 2018 | −0.073 | 22 | −1.60 |
| 2019 | −0.040 | 23 | −0.92 |
| 2020 | −0.089 | 17 | −1.50 |
| 2021 | −0.444 | 25 | −11.09 |
| 2022 | +0.119 | 23 | +2.75 |
| 2023 | −0.286 | 34 | −9.72 |
| 2024 | −0.167 | 24 | −4.01 |
| 2025 | +0.055 | 18 | +0.99 |
| 2026 | −0.450 | 12 | −5.40 |

Sides, out of sample (R1): buys n 113 −0.129R, sells n 106 −0.236R.

## Reading

R1 does not pass (failed: t2, holm, isSame, cost2x, placebo). Reverse trade 2017 → 2026-10: −0.181R a trade net (n 219, month t −2.29; gross −0.079R, t −1.01; at 2x costs −0.282R); 2007-16 −0.097R net (n 230, t −1.01; gross +0.044R). The reverse order fills on 34 % of the out-of-sample stop-out days (219 of 647); its median stop is $7.36 (about 0.5 × the previous range from the open) and costs take 0.102R a trade. Before costs the reverse trade is negative out of sample (gross t −1.01) and positive in sample (gross t +0.48). Per T1 day, adding the reverse order moves net R a day from +0.044 to +0.023 out of sample (difference t −2.28; worst drawdown −39.18R → −59.32R) and from +0.101 to +0.089 in sample. R3 (first stop-out before 12:00 UTC): −0.241R out of sample (n 79, t −1.46), −0.135R in sample; failed: t2, holm, isSame, cost2x, n150, placebo. Placebo (same fill candle, coin side, same stop): the real R1 beats 6 of 40 seeds. Every window of the base rule was read before this study; only the reverse trade was new. Not an edge; the T1 rule stays as it was (the other order is cancelled), nothing live changes and no proposal is written.

## Data and method

- OANDA mid XAU/USD M5 through the keyless candle proxy; 5206 UTC weekdays built 2006-11-01 → 2026-11-12
- Rule: T1 unchanged (O = first M5 open from 00:00 UTC, stops at O ± 0.5 × previous folded D1 range, first fill wins, stop at O, out at 21:00 UTC). After a T1 stop-out at O, the opposite stop order at its own level is live from the candle after the stop-out candle to the 20:55 candle; stop at O (worst case in the fill candle); out at the 20:55 close
- Costs: $0.60 a round trip per ounce, 2x reported; financing `FIN.xau.long` × `nights` on buys (no trade crosses 22:00 UTC: 0).
- To repeat: `node research/edge/gold-vol-breakout-reverse/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD 2006-11 on, from the candle proxy; out of git).
