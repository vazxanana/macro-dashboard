# Result: the bond month-end rule at Treasury futures cost (14 Nov 2026)

**Verdict: FAILS AT FUTURES COST, 0 of 2 tests.** The same frozen trades of `bond-month-end` (#939), re-costed as CBOT
Treasury futures (one tick of bid / ask, fees and commission, no financing line), make +0.088R a trade on the 10-year note
(ZN cost; 2016 to October 2026, n 130, t 1.91) and +0.047R on the 30-year bond (ZB cost; n 130, t 0.99). Both are positive in
both windows and both beat the re-costed random-day placebo, but neither reaches t 2 and the Holm-adjusted p is 0.056 (T1) and
0.161 (T2). The futures route cuts the cost of a trade from about 0.07R to about 0.02R, and the 10-year note's month-end
window comes close to the bar without clearing it. **This is a cost scenario: the council's demo accounts trade CFDs, so
nothing here is tradable on the current account, and nothing live changed. No proposal is written.**

Pre-registration: `PREREGISTRATION.md` (pushed alone, commit `74a5f10`, before any futures number). Code: `frozen.mjs` (#939's
`run.mjs`, byte for byte) and `run.mjs`. Every figure: `result.json`.

## The gate (passed)

- `frozen.mjs` sha256 `624ac805a9b361949906bf5e0c94e576433d2d019e2e3470f9b57f5d8f630144` = `origin/bond-month-end`'s
  `research/edge/bond-month-end/run.mjs`.
- On the council-data candles #939 read (commit `f6288251`, last candle 6 Nov 2026) the frozen `runMarket` reproduces #939's
  published `markets.usb10y` and `markets.usb30y` objects field for field (every row, the cost table, the placebo means, the
  profile, the gaps, every trade), and the frozen `verdictOf` its `tests` block (G1). This study's placebo loop, run with the
  frozen CFD net, reproduces #939's 40 placebo means on both markets (G2). The published rows reproduced: T1 n 130, gross
  +0.107R (t 2.31), CFD net +0.036R (t 0.77); T2 n 130, gross +0.061R (t 1.28), CFD net +0.015R (t 0.32).

## The cost (fixed in the pre-registration)

| Item | ZN (T1, 10-year) | ZB (T2, 30-year; UB the same) | Source |
|---|---|---|---|
| Tick | 1/2 of 1/32 point = 0.015625 pt ($15.625) | 1/32 point = 0.03125 pt ($31.25) | CME Group contract specifications and "Basics of US Treasury futures", seen as web search summaries 14 Nov 2026; pages not opened (cmegroup.com refused by the sandbox proxy) |
| Bid / ask | one tick a round trip (mid-price candles) | same | assumption, not measured |
| Exchange + clearing + NFA | $1.00 a side | same (assumed equal) | a retail broker's ZN fee listing, search summary 14 Nov 2026, page not opened; ZB from memory, not opened |
| Commission | $0.85 a side | same | from memory, not opened |
| Round trip | 0.0193 pt | 0.0350 pt | ($1,000 a point) |
| Financing | 0 | 0 | a future's carry is in its price |
| Rolls | none (enter the most traded contract) | none | a row with one extra round trip in roll months is reported |

Cost in R = round-trip points / the trade's own CFD stop distance (2 x ATR(20)), one CFD point taken as one futures point
(the stated weakness: the OANDA bond CFDs are quoted in points of par near the front contracts' levels but are not proven to
move point for point with them).

| Cost a trade, 2016-26 (R) | ZN / USB10Y | ZB / USB30Y |
|---|---|---|
| Median stop distance (pt) | 1.076 | 2.531 |
| Futures round trip | 0.018 | 0.014 |
| #939 CFD spread | 0.034 | 0.028 |
| #939 CFD financing (3 % a year) | 0.036 | 0.018 |

## The re-costed tests (R a trade; t = one-sample t of the trades, one a month)

| Test | Contract | 2016-26 n | gross R | futures net R | t | win % | CFD net (#939) | 2003-15 n | futures net R | t | Placebo 95th pct | Beaten | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | ZN | 130 | +0.107 | +0.088 | 1.91 | 58.5 | +0.036 | 153 | +0.052 | 1.15 | +0.019 | 40 / 40 | 0.056 | no |
| T2 | ZB | 130 | +0.061 | +0.047 | 0.99 | 59.2 | +0.015 | 153 | +0.079 | 1.83 | +0.018 | 39 / 40 | 0.161 | no |

Pass needed all of: net R > 0 in 2016-26 AND in 2003-15 (both met), 2016-26 t >= 2 (not met: 1.91 and 0.99), Holm-adjusted
one-sided p < 0.05 over T1-T2 (not met: 0.056 and 0.161), and the rule's 2016-26 mean above the 95th percentile of 40
random-day placebo means at the same futures cost (met for both; placebo medians -0.035R and -0.044R: any three-day long in a
falling decade loses, the month-end window does not).

## Sensitivity (reported, not judged)

| Contract | Window | 0 x cost | 1 x (base) | 2 x | 1 x + a roll round trip in Feb / May / Aug / Nov |
|---|---|---|---|---|---|
| ZN | 2016-26 | +0.107, t 2.31 | +0.088, t 1.91 | +0.070, t 1.52 | +0.082, t 1.78 |
| ZN | 2003-15 | +0.067, t 1.49 | +0.052, t 1.15 | +0.036, t 0.81 | +0.047, t 1.03 |
| ZB | 2016-26 | +0.061, t 1.28 | +0.047, t 0.99 | +0.033, t 0.69 | +0.042, t 0.89 |
| ZB | 2003-15 | +0.095, t 2.19 | +0.079, t 1.83 | +0.063, t 1.47 | +0.074, t 1.71 |

Even with no cost at all only one row in each market reaches t 2, and the two markets disagree on which window (the 10-year in
2016-26, the bond in 2003-15), as #939 found. The 2 x column also stands for a CFD-to-futures mapping off by a factor of two.

By year (futures net R total, rule trades): ZN 2016 +2.81, 2017 -1.43, 2018 +2.54, 2019 +2.15, 2020 +3.38, 2021 -0.60,
2022 +1.21, 2023 +0.13, 2024 +1.49, 2025 +0.80, 2026 (to October) -0.98; ZB 2016 +1.55, 2017 -0.82, 2018 +3.03,
2019 +2.60, 2020 +1.05, 2021 -0.61, 2022 +0.65, 2023 -1.21, 2024 +1.82, 2025 +0.64, 2026 (to October) -2.62. Earlier years
are in `result.json`.

## What it means for the owner, in plain words

- Not tradable on what the desk has: the demo accounts trade CFDs, and on CFDs the rule failed in #939. Paper and demo only
  (absolute rule 2) stands; nothing here changes a rule, a cost or an account.
- Futures would cost about a quarter of the CFD's spread and financing, and the 10-year month-end window would then sit just
  under the bar (t 1.91 against 2; Holm p 0.056 against 0.05). Close is not a pass: by the pre-registered bar the effect is
  not proven even at futures cost, so it is not a reason on its own to open a futures route.
- What the three days are worth if real: about +0.09R a trade, twelve trades a year, about 1R a year on the 10-year note,
  with losing years (2017, 2021, 2026 so far). Small.
- Weak points of this scenario: the tick, fee and commission figures were not opened from their pages (search summaries and
  memory, dated above); one CFD point is taken as one futures point; mid-price candles at 00:00 UTC, not the New York close.

To repeat: `node research/edge/bond-month-end-futures/run.mjs fetch <dir>` (git show, no network), then
`node research/edge/bond-month-end-futures/run.mjs full <dir>`. Tests: `tests/bond-month-end-futures.test.mjs`.
