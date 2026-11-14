# Result: an index long held only while the stock-bond correlation is negative (14 Nov 2026)

**Verdict: FAIL, 0 of 3: holding the index only while its 60-day correlation with the 10-year note is negative lowered the out-of-sample net Sharpe (S&P 500 −0.25, t −1.54) and did not cut the drawdown.**

Pre-registered in `PREREGISTRATION.md` (committed and pushed alone before any number was computed). Paper research only: a
stand-alone long / flat allocation on monthly closes, not a gate, size or exit of the gold book (owner decision 44 is
untouched). Nothing live changed and no proposal is written. The positions are portfolio weights from one month-end close to
the next, not trades with a stop; any live use would need a stopped execution and the owner's approval.

## The rule and the data

OANDA mid daily candles from council-data (`research/daily/`, weekday closes): spx500, nas100, us30, each joined by date with
usb10y (the 10-year Treasury note CFD price). At each month end, the Pearson correlation of the last 60 joined daily returns;
below 0 → long the index next month, else flat. Benchmark: always long. Costs: 0.02 % of notional at each entry and exit
(0.04 % round trip), and financing while long at FRED DGS2 + 2.5 % a year by calendar day (4 % before the cache's first
DGS2 value, 2006). In sample July 2003 to December 2016 (162 months); out of sample January 2017 to October 2026 (118 months).

## The tests (out of sample, net; t from a paired circular 12-month block bootstrap, 10,000 draws; Holm over three)

| Test | Sharpe, rule | Sharpe, always long | Difference | t | Holm p | In sample (diff, t) | Difference at 2x costs | Max DD, rule vs long | Months in / switches | Pass |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 spx500 | 0.29 | 0.55 | −0.254 | −1.54 | 1.00 | +0.045, 0.55 | −0.164 | −26.5 % vs −27.5 % | 79 / 15 | no |
| T2 nas100 | 0.47 | 0.76 | −0.293 | −1.53 | 1.00 | +0.062, 0.59 | −0.224 | −35.8 % vs −36.5 % | 71 / 18 | no |
| T3 us30 | 0.26 | 0.38 | −0.120 | −0.93 | 1.00 | +0.031, 0.54 | −0.023 | −25.4 % vs −25.4 % | 79 / 13 | no |

Annual return out of sample, rule vs always long: S&P 500 3.0 % vs 7.6 %, Nasdaq 100 6.1 % vs 13.8 %, Dow 2.6 % vs 4.8 %.
Max drawdown ratio (rule / long): 0.97, 0.98, 1.00 out of sample; 0.98, 1.00, 1.00 in sample. The claim was a lower drawdown
at a similar return: the drawdown did not fall and the return roughly halved.

**Gross (before spread and financing).** Out of sample the Sharpe difference is −0.345 (t −1.94), −0.365 (t −1.88), −0.218
(t −1.51); in sample −0.030 (t −0.40), +0.024 (t 0.23), −0.015 (t −0.28). So the small positive in-sample net difference is
only the financing the rule saves by being out about one month in five; the signal itself added nothing before costs in
either window. Descriptive paired t on the monthly return differences, out of sample: −1.68, −1.91, −0.93.

**Switches.** Correlation regimes are persistent: 13-18 switches out of sample (7-9 separate invested spells) and 20-22 in
sample. The bootstrap t rests on that handful of independent decisions. Flat months out of sample cluster in 2021, the second
half of 2022 through mid 2024, early 2025 and mid 2026: the rule was out for much of the 2023-24 rally, while the first half
of 2022 (the falling market that motivated the idea) was still read as negative correlation and was held.

## Placebo (40 seeded random in / out masks over the out-of-sample months, the rule's number of invested months, same costs)

| Market | Real difference | Placebo mean | Placebo range | Placebos at least as good as the real |
|---|---|---|---|---|
| spx500 | −0.254 | −0.112 | −0.657 to +0.302 | 33 of 40 |
| nas100 | −0.293 | −0.194 | −0.625 to +0.258 | 30 of 40 |
| us30 | −0.120 | −0.060 | −0.597 to +0.264 | 27 of 40 |

The real rule does worse than the typical random choice of the same number of months: the correlation regime carried no
timing information for these indices in 2017-26.

## What this does not test

Other lookbacks, thresholds, bonds (2-year, 30-year, Bund) or a volatility-scaled version: not run (fixed by the
pre-registration). Futures or cash index data instead of CFDs: not run. The literature's claim is about the correlation as a
regime for asset allocation over long horizons, not a monthly in / out switch; this study tests only the switch.

## To repeat

`node research/edge/stock-bond-corr/run.mjs` (reads council-data with `git show`, no network; writes `result.json`).
Tests: `tests/stock-bond-corr.test.mjs`.
