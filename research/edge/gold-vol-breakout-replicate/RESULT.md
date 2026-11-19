# Gold: the intraday volatility breakout, replicated on 2007-2015

Paper research only. A stand-alone intraday rule, not a gate, exit, entry or size of the live gold book (owner decision 44 concerns that book; none of its records were read). Nothing live changed, no proposal. The test, window and pass bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). The rule is the `gold-vol-breakout` study's T1, its functions imported from `original.mjs`, a verbatim copy of that study's `run.mjs` (sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.

**Verdict: PASS: gold open ± 0.5 × prior range breakout on untouched 2007-15 +0.111R a trade net (n 1657, month t +3.19, gross +0.203R)**

## Harness gate

| Cache | Window | n | Net R | Gross R | Month t | Gross t | Net 2x | Original n / net / t | Pass |
|---|---|---|---|---|---|---|---|---|---|
| original cache (exact) | 2016-20 | 935 | +0.009 | +0.111 | +0.22 | +2.87 | −0.094 | 935 / +0.009 / +0.22 | yes |
| original cache (exact) | 2021-26 | 1121 | +0.072 | +0.121 | +1.86 | +3.21 | +0.023 | 1121 / +0.072 / +1.86 | yes |
| this study's cache (tolerance) | 2016-20 | 935 | +0.009 | +0.111 | +0.22 | +2.87 | −0.094 | 935 / +0.009 / +0.22 | yes |
| this study's cache (tolerance) | 2021-26 | 1121 | +0.072 | +0.121 | +1.86 | +3.21 | +0.023 | 1121 / +0.072 / +1.86 | yes |

## The test, 2007-2015

| Period | n | Win | Net R/trade | Gross R/trade | Net at 2x cost | Cost R/trade | Total R | t (months) | Gross t | Stops / time | Max DD R | Median stop $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2007-2015 | 1657 | 43.9 % | +0.111 | +0.203 | +0.018 | +0.092 | +183.68 | +3.19 | +5.96 | 552 / 1105 | −25.66 | 7.76 |
| 2007-2011 | 929 | 46.6 % | +0.120 | +0.217 | +0.023 | +0.097 | +111.22 | +2.83 | +5.33 | 291 / 638 | −17.88 | 7.87 |
| 2012-2015 | 728 | 40.4 % | +0.100 | +0.186 | +0.013 | +0.087 | +72.46 | +1.70 | +3.20 | 261 / 467 | −25.66 | 7.62 |
| pooled 2007 → 2026-11-12 | 3713 | 42.7 % | +0.073 | +0.155 | −0.009 | +0.082 | +272.23 | +3.35 | +7.24 | 1266 / 2447 | −42.89 | 8.57 |

## Decision (one test, no correction)

| net > 0 | month t ≥ 2 | 2007-11 > 0 | 2012-15 > 0 | 2x cost > 0 | placebos beaten (need 38 of 40) | n ≥ 30 | pass |
|---|---|---|---|---|---|---|---|
| yes | yes | yes | yes | yes | 40 | yes | **pass** |

## Placebo (2007-2015, 40 seeds)

The original study's placebo: every day T1 could trade, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin, stop 0.5 × the previous day's range away, out at 21:00 UTC or the stop, the same costs.

| Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max |
|---|---|---|---|
| +0.111 | −0.031 | −0.001 | −0.094 / +0.018 |

## By year (2007-2015 and the pooled record)

| Year | n | Net R/trade | Total R |
|---|---|---|---|
| 2007 | 183 | +0.208 | +38.05 |
| 2008 | 188 | +0.191 | +35.96 |
| 2009 | 190 | +0.021 | +4.08 |
| 2010 | 182 | +0.137 | +24.95 |
| 2011 | 186 | +0.044 | +8.17 |
| 2012 | 186 | +0.038 | +7.03 |
| 2013 | 181 | +0.258 | +46.76 |
| 2014 | 171 | +0.136 | +23.34 |
| 2015 | 190 | −0.025 | −4.66 |
| 2016 | 180 | +0.008 | +1.51 |
| 2017 | 187 | −0.006 | −1.15 |
| 2018 | 188 | −0.097 | −18.15 |
| 2019 | 191 | −0.040 | −7.62 |
| 2020 | 189 | +0.178 | +33.67 |
| 2021 | 179 | +0.021 | +3.72 |
| 2022 | 193 | +0.016 | +3.16 |
| 2023 | 186 | −0.095 | −17.76 |
| 2024 | 200 | +0.053 | +10.53 |
| 2025 | 193 | +0.181 | +34.90 |
| 2026 | 170 | +0.269 | +45.73 |

## Does it rest on high-range days? (descriptive, pre-registered)

Previous day's range above vs at or below the median of the last 250 previous-day ranges (this day's included, known before the open).

| Period | High range: n / net / gross / t | Low range: n / net / gross / t |
|---|---|---|
| 2007-2015 | 682 / −0.015 / +0.042 / −0.46 | 975 / +0.199 / +0.316 / +3.64 |
| pooled 2007 → 2026-11-12 | 1662 / +0.019 / +0.068 / +0.84 | 2051 / +0.117 / +0.226 / +3.24 |

2007-2015 without its best year (2013, +46.76R): n 1476, +0.093R a trade, month t +2.67.

## Sides and skipped days

- 2007-2015: buys n 790 +0.138R, sells n 867 +0.086R; financing +0.000R a trade; days without a trade: noopen 15, flatprev 1, nofill 661, thin 8.

## Reading

T1 passes every pre-registered check on the untouched 2007-2015 gold history. Paper research only: at most a candidate for a forward paper record, by the owner's decision; nothing live changes. 2007-15: +0.111R a trade net (n 1657, month t +3.19), gross +0.203R (t +5.96); 2007-11 +0.120R (n 929), 2012-15 +0.100R (n 728); at 2x costs +0.018R; 40 of 40 placebo seeds beaten (placebo median −0.031R). Costs take 0.092R a trade at a median stop of $7.76. Pooled 2007 → 2026-11-12: +0.073R net (n 3713, month t +3.35), gross +0.155R (t +7.24). High-range days (previous range above its 250-day median) 2007-15 −0.015R (n 682), low-range +0.199R (n 975); descriptive only. Cautions, said plainly: the cost is the original's fixed $0.60 a round trip, today's level; spreads of 2007-15 were not measured, and at 2x costs the rule keeps only +0.018R a trade (pooled 2007-26 −0.009R). The record is two good stretches with a flat one between: 2015-2024 together +3.25R on 1883 trades. The gain does not come from wide-range days; it comes from days after a narrower-than-usual range. A pass here is evidence for the rule's direction on gold, not proof of a tradeable edge at real costs. 

## Data and method

- OANDA mid XAU/USD M5 through the keyless candle proxy; 5206 weekdays built 2006-11-01 → 2026-11-12; D1 = complete UTC days folded with council/fills.mjs foldWeekend
- Rule: O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins (a gap fills at the open; both in one candle: the level nearer its open); stop back at O (worst case in the fill candle); out at the 20:55 candle close
- Costs: $0.60 a round trip per ounce, 2x reported; financing `FIN.xau.long` × `nights` on buys (no trade crosses the 22:00 UTC rollover: 0).
- To repeat: `node research/edge/gold-vol-breakout-replicate/run.mjs <dir>` with `<dir>/xau-5m.json.gz` (OANDA mid M5 XAU/USD 2006-11 on, from the candle proxy) and, for the harness gate, `<dir>/xau-5m-vol.json.gz` (the original study's cache); both out of git.
