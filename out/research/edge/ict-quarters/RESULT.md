# ICT A-setups by quarter of the week, month and year (quarterly theory, pre-registered)

**Verdict: FAIL. None of the three pre-registered tests passes. A-setups whose sweep fell in the "manipulation" quarter (Q2) did no better than the rest out of sample: week (Tuesday) +0.134R a trade net (n 152) against +0.134R (n 546), difference −0.001R, t −0.01; month (week 2) +0.191R (n 143) against +0.121R (n 538), difference +0.070R, t 0.49, but −0.172R in sample (t −1.70); year (April-June) +0.068R (n 182) against +0.160R (n 498), difference −0.092R, t −0.64.** Holm-adjusted p 1.00, 0.94 and 1.00. The A-rule stays as it is. No proposal is made, and no file of the ICT desk or its rule book changed.

The rule book's quarterly idea says the second part of each time cycle makes the false move that takes liquidity and the third makes the real one, so a reversal after a sweep made in Q2 should be the better trade. On the desk's own mechanical H1 model, five markets, 2020 to October 2026, the quarter of the week, the month or the year the sweep fell in does not separate better A-setups from worse ones. Each quarter taken alone (reported below, not judged) moves around from one half to the other with no quarter holding up in both.

## How it was run

- **Pre-registration first.** `PREREGISTRATION.md` was committed alone and pushed (4e53fcf6) after the candle download and
  the runner's `count` stage (signals per quarter, no trade simulated); the classifier and runner followed in the next
  commit; then the `full` stage ran once. One label was reworded after the run (the verdict sentence in `result.json`, so the
  Edge lab files the study as a fail, which its own rule makes it); the runner was run again on the same candles and every
  number came out identical. Plan sha256 `c2f50687…b2b5` is in `result.json`.
- **Definition.** The time of a signal is its sweep candle. Trading day = the New York day starting 18:00 New York (daylight
  time handled). Week: Monday Q1, Tuesday Q2, Wednesday Q3, Thursday Q4, Friday apart. Month: weeks by their Monday, the
  8th-14th Monday week is Q2; the partial first week and a week from the 29th are apart. Year: April-June is Q2.
  Favoured = Q2, rest = everything else.
- **Engine.** The research lab's `runMarket` (`api/_ictlab.js`): the desk's own `signals()`, `isASetup()`, `sizeOf()`
  (`ict/tracker.mjs`) and `simulate()` (`ict/replay.mjs`), imported and never edited. Live exit, live sizing, one open trade
  per market per stream. Every trade keeps the engine's own stop.
- **Data.** OANDA mid H1 through the site's keyless candle proxy: NAS100, SPX500, US30, US2000 (for NQ, ES, YM, RTY) and XAU
  (for GC), 2 Jun 2019 to 9 Nov 2026, cleaned as the lab does. No trade was left unresolved and none was dropped for a data
  hole. The unfiltered stream is the same as in `ict-equal-lows` (1,028 IS / 679 OOS trades, +0.084 / +0.137R).
- **Window.** Signals 1 Jan 2020 to 31 Oct 2026. In sample 2020-23, out of sample 2024 on.
- **Costs.** The lab's round trip: NQ 1.5, ES 0.5, YM 3, RTY 0.4 points, gold 0.5. All R below is net and sized as live.

## The three tests (all five markets pooled)

| test | stream | IS n | IS R a trade | IS t | OOS n | OOS win | OOS R a trade | OOS total | OOS max DD | OOS t | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| all | unfiltered | 1,028 | +0.084 | 1.73 | 679 | 40% | +0.137 | +93.0R | 17.8R | 2.28 | baseline |
| T1 week | **Tuesday (Q2)** | 247 | +0.110 | 1.19 | 152 | 45% | +0.134 | +20.3R | 10.6R | 1.31 | **FAIL** |
| | rest | 805 | +0.069 | 1.24 | 546 | 38% | +0.134 | +73.4R | 19.4R | 1.93 | |
| T2 month | **week 2 (Q2)** | 248 | −0.048 | −0.57 | 143 | 41% | +0.191 | +27.3R | 15.1R | 1.51 | **INCONCLUSIVE** |
| | rest | 784 | +0.125 | 2.15 | 538 | 39% | +0.121 | +65.1R | 15.6R | 1.78 | |
| T3 year | **April-June (Q2)** | 271 | −0.011 | −0.13 | 182 | 38% | +0.068 | +12.4R | 17.7R | 0.55 | **FAIL** |
| | rest | 757 | +0.118 | 2.02 | 498 | 40% | +0.160 | +79.8R | 15.4R | 2.36 | |

Q2 against the rest (Welch, one-sided for "Q2 is better", Holm over the three tests):

| test | IS difference | IS t | OOS difference | OOS t | p | Holm p |
|---|---|---|---|---|---|---|
| T1 week | +0.041R | 0.38 | −0.001R | −0.01 | 0.50 | 1.00 |
| T2 month | −0.172R | −1.70 | +0.070R | 0.49 | 0.31 | 0.94 |
| T3 year | −0.130R | −1.25 | −0.092R | −0.64 | 0.74 | 1.00 |

The bar, check by check:

| check | T1 | T2 | T3 |
|---|---|---|---|
| OOS difference t ≥ 2 | **no** | **no** | **no** |
| Holm p < 0.05 | **no** | **no** | **no** |
| IS difference > 0 | yes | **no** | **no** |
| Q2 R a trade > 0 in sample | yes | **no** | **no** |
| Q2 R a trade > 0 out of sample, n ≥ 30 | yes | yes | yes |
| OOS difference > 0 | **no** | yes | **no** |

T2 is "inconclusive" only in the pre-registered sense (its OOS difference is above zero); it fails four of the six checks,
lost in sample and has t 0.49 out of sample.

## Reported, not judged

Each quarter as its own one-open stream, net R a trade (n), IS | OOS:

| cycle | Q1 | Q2 | Q3 | Q4 | apart |
|---|---|---|---|---|---|
| week | +0.096 (199) \| +0.055 (125) | +0.110 (247) \| +0.134 (152) | −0.042 (205) \| +0.252 (169) | +0.190 (249) \| +0.019 (155) | Fri −0.050 (179) \| +0.147 (116) |
| month | +0.230 (208) \| +0.221 (164) | −0.048 (248) \| +0.191 (143) | −0.032 (255) \| +0.140 (163) | +0.179 (233) \| −0.063 (152) | partial +0.140 (67) \| +0.184 (43); 29th+ +0.159 (29) \| +0.161 (22) |
| year | +0.061 (236) \| +0.084 (164) | −0.011 (271) \| +0.068 (182) | −0.065 (271) \| +0.134 (197) | +0.371 (250) \| +0.284 (138) | — |

- Two cells are the best of their cycle in both halves, neither is Q2: the year's Q4 (October-December, +0.371R in sample,
  +0.284R out of sample, t 1.91) and the month's first week (+0.230R, +0.221R, t 1.56). Neither was a pre-registered test,
  they are two of fifteen cells picked after the fact, and the rule book does not predict either for a reversal; each is a
  hypothesis for a study with its own pre-registration on other data at most. In the week no quarter leads in both halves.
- By book, OOS Q2 against the rest: index book week +0.070 vs +0.123R (t −0.40), month +0.060 vs +0.132R (t −0.44), year
  +0.069 vs +0.133R (t −0.38). Gold: week +0.331 (n 37) vs +0.167R (t 0.55); month +0.779R (n 26) vs +0.092R (t 2.33) but
  under 30 trades and −0.070R in sample; year +0.067 (n 44) vs +0.239R (t −0.65). The gold month cell is the kind of thin,
  one-half result that the bar exists to stop.

## What follows

Nothing. Not a filter, not a grade point, not a size change, no proposal file. This tests the quarterly idea as a mechanical
calendar split of the desk's own H1 model (Q2 of the week, month and year); it does not test a reading of the cycles by eye,
the day's quarters (covered by `ict-sessions` and `ict-variants`) or the 90-minute session quarters. Still untested from the
rule book's list: NWOG / NDOG as the key level a sweep runs into, deferred delivery, a swing-built dealing range.

To repeat: `node --use-env-proxy research/edge/ict-quarters/run.mjs fetch <dir>` (candles outside git, the same files as
`ict-equal-lows`), then `node research/edge/ict-quarters/run.mjs full <dir>`. Test: `tests/desk-ict-quarters.test.mjs`.
