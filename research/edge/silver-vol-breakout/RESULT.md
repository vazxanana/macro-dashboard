# Silver: gold-vol-breakout's T1 rule, unchanged (UTC open ± 0.5 × the previous day's range)

Paper research only. A robustness check of `gold-vol-breakout` (branch `gold-vol-breakout`) on a market the rule was not found on; not a rule for any live book and never a gate, exit, entry or size of the live gold book (owner decision 44). Nothing live changed, no proposal. The rule, costs, windows, placebo and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: FAIL (isPos, oosPos, t2, cost2x): gold's T1 breakout on silver 2016 → now −0.084R a trade net (n 2015, month t −3.04; gross +0.086R, t +3.37)**

## Results

| Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | 2x-cost t | Stops / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2016-2020 | 925 | 34.7 % | −0.135 | +0.113 | −0.383 | +0.248 | −124.73 | −2.99 | +2.68 | −7.54 | 346 / 579 | −149.79 | 0.131 |
| 2021 → 2026-11-12 | 1090 | 41.4 % | −0.041 | +0.063 | −0.144 | +0.103 | −44.52 | −1.23 | +2.05 | −3.92 | 379 / 711 | −104.00 | 0.31 |
| 2016 → 2026-11-12 (pooled) | 2015 | 38.3 % | −0.084 | +0.086 | −0.254 | +0.170 | −169.24 | −3.04 | +3.37 | −7.86 | 725 / 1290 | −227.58 | 0.219 |

## Decision (one test, no Holm)

| p (one-sided, pooled) | 2016-20 > 0 | 2021 → now > 0 | pooled t ≥ 2 | pooled 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 each | pass |
|---|---|---|---|---|---|---|---|
| 0.999 | no | no | no | no | 40 | yes | **fail** |

## Placebo (2016 → now, 40 seeds)

Every day the rule could trade, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin, stop 0.5 × the previous day's range away, out at 21:00 UTC or the stop, the same costs.

| Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |
|---|---|---|---|
| −0.084 | −0.135 | −0.108 | −0.169 / −0.091 |

## Sides and skipped days

- 2016-2020: buys n 450 −0.086R, sells n 475 −0.181R; financing +0.000R a trade.
- 2021 → 2026-11-12: buys n 525 +0.003R, sells n 565 −0.081R; financing +0.000R a trade.
- Days without a trade, whole period: noprev 1, flatprev 1, thin 9, noopen 19, nofill 776.

## By year (net R a trade, gross R a trade, n)

| Year | Net | Gross | n |
|---|---|---|---|
| 2016 | −0.103 | +0.098 | 183 |
| 2017 | −0.219 | +0.046 | 190 |
| 2018 | −0.183 | +0.125 | 193 |
| 2019 | −0.217 | +0.104 | 182 |
| 2020 | +0.059 | +0.198 | 177 |
| 2021 | −0.108 | +0.017 | 189 |
| 2022 | −0.076 | +0.047 | 188 |
| 2023 | −0.246 | −0.103 | 184 |
| 2024 | +0.033 | +0.146 | 180 |
| 2025 | +0.072 | +0.155 | 188 |
| 2026 | +0.098 | +0.122 | 161 |

## Reading

The rule does not pass the pre-registered bar on silver (failed: isPos, oosPos, t2, cost2x). 2016-20 −0.135R a trade net (n 925, month t −2.99; gross +0.113R, t +2.68); 2021 → now −0.041R net (n 1090, t −1.23; gross +0.063R, t +2.05). Pooled −0.084R net (n 2015, t −3.04), −0.254R at 2x costs; costs take 0.170R a trade at a median stop of $0.219. 40 of 40 placebo seeds beaten (placebo median −0.135R). By year: 2016 −0.103R, 2017 −0.219R, 2018 −0.183R, 2019 −0.217R, 2020 +0.059R, 2021 −0.108R, 2022 −0.076R, 2023 −0.246R, 2024 +0.033R, 2025 +0.072R, 2026 +0.098R (4 of 11 positive). Before costs the effect gold showed does repeat on silver (gross month t +2.68 in 2016-20 and +2.05 after, the real stream above every placebo seed), but the cost, 0.248R and 0.103R a trade in the two windows, is larger than the gross gain in both: silver's daily range is small against its spread. Not an edge on silver; nothing live changes and no proposal is written.

## Data and method

- OANDA mid XAG/USD M5 through the keyless candle proxy; 2821 weekdays built 2016-01-01 → 2026-11-12; D1 = complete UTC days folded with council/fills.mjs foldWeekend
- Rule: O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop back at O (worst case in the fill candle); out at the 20:55 candle close
- Costs: $0.03 a round trip per ounce of silver (spread and slippage; the repository's silver figure: `api/_ictlab.js` `COST.xag`, `gold-drd-silver`), 2x reported; financing assumed at gold's `FIN.xau.long` × `nights` on buys (no silver rate measured; no trade crosses the 22:00 UTC rollover: 0).
- Code: `buildDays`, `daySkip`, `vbTrade`, `placeboTrade` and the statistics are copied from `gold-vol-breakout/run.mjs` with their logic unchanged (that study is not on main).
- To repeat: `node research/edge/silver-vol-breakout/run.mjs <dir>` with `<dir>/xag-5m.json.gz` (OANDA mid M5 XAG/USD from the candle proxy, kept out of the repository).
