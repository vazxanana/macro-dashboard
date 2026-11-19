# Result: the year-end US dollar seasonal (14 Nov 2026)

**Verdict: FAIL**, 0 of 3 tests pass: neither a weaker dollar in the second half of December nor a stronger dollar in the first
ten trading days of January stands out from the rest of the year.

On the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed) the December claim has the claimed sign in
both windows (the short-USD basket did +27.6 bp better than the year's other half-months in 2010-25, +25.9 bp in 2005-09), but
it is about one standard error from zero (t 0.94, Holm p 0.54) and about one random window in four does at least as well
(placebo 23.4 %). The January claim is +9.4 bp in 2010-26 and negative in 2006-09. EUR/USD alone: +15.6 bp, t 0.63.

**Low power, said plainly.** Each year is one observation: 16 Decembers (17 Januaries) in the decisive window. With a yearly
spread of excess returns of about 1.0-1.3 % (98-125 bp), a true seasonal of 0.3 % a year would give an expected t near 1; it
would need to be about 0.7 % a year, every year, to clear the Holm bar. So this FAIL says the effect is not large
and regular; it does not prove there is none.

Data: council-data `research/daily/<pair>.json` (OANDA mid daily candles, UTC days, weekends folded into Monday with
`fills.mjs` `foldWeekend`), used from 1 January 2005 (the 2002-04 rows are placeholder prices, volume 1-2) to 6 November 2026.
Decisive: December 2010-2025 (16 years), January 2010-2026 (17). Replication: December 2005-2009 (5), January 2006-2009 (4).

Positions: entry at the window's first open, exit at its last close, stop 3 x ATR(20) per pair (13 of the 96 decisive
December positions were stopped). Costs (raw-spread model): 0.3 pip spread, 0.15 pip slippage a side, 22.5 USD per million a
side: about 1.1 bp a position. Financing: the demo broker's swap from council-data `ctrader/symbols.json` (pips a lot a night,
today's rate for every year) for EUR/USD, GBP/USD, AUD/USD and USD/CHF; NZD/USD and USD/JPY are not in that file, so the
policy-rate differential of the fx-carry study's `rates.json` (approximate, no broker markup). About -5.7 bp a December
position. Returns are in basis points of the entry price; the basket is the equal-weight mean of the six pairs.

## The three tests

| Test | Window | Years | Mean excess | sd | t | one-sided p | Excess > 0 | Claimed window mean | Comparison mean |
|---|---|---|---|---|---|---|---|---|---|
| T1 short USD, 15-31 Dec, vs other half-months | 2010 - 2025 | 16 | +27.57 bp | 117.23 | 0.94 | 0.1809 | 9 of 16 | +14.97 bp | -12.61 bp |
| T1 | 2005 - 2009 | 5 | +25.88 bp | 292.62 | 0.2 | 0.4264 | 3 of 5 | +14.94 bp | -10.94 bp |
| T2 long USD, first 10 days of Jan, vs other months | 2010 - 2026 | 17 | +9.35 bp | 125.3 | 0.31 | 0.3812 | 9 of 17 | +8.9 bp | -0.44 bp |
| T2 | 2006 - 2009 | 4 | -7.79 bp | 363.38 | -0.04 | 0.5158 | 2 of 4 | +4.6 bp | +12.4 bp |
| T3 long EUR/USD, 15-31 Dec, vs other half-months | 2010 - 2025 | 16 | +15.55 bp | 98.56 | 0.63 | 0.2687 | 11 of 16 | +4.39 bp | -11.16 bp |
| T3 | 2005 - 2009 | 5 | +46.44 bp | 318 | 0.33 | 0.3802 | 3 of 5 | +35.23 bp | -11.21 bp |

| Bar | T1 | T2 | T3 |
|---|---|---|---|
| Excess > 0 in both windows | met | not met (2006-09 -7.79 bp) | met |
| Decisive Holm-adjusted p < 0.05 | 0.5426, not met | 0.5426, not met | 0.5426, not met |
| Placebo share < 5 % (1,000 random windows, decisive) | 23.4 %, not met | 37.8 %, not met | 35 %, not met |
| 2x cost (decisive mean excess > 0) | met (+27.24 bp) | met (+9.38 bp) | met (+15.07 bp) |

Costs do not decide anything here: they are about 1 bp a position and most of the financing falls on the comparison windows
too (the excess moves by under 0.5 bp at 2x).

## Year by year (basis points; excess = claimed window minus the year's comparison mean)

| Year | T1 basket, 15-31 Dec | T1 comparison | T1 excess | T3 EUR/USD excess | T2 basket, Jan 10 days (long USD) | T2 comparison | T2 excess |
|---|---|---|---|---|---|---|---|
| 2005 | -191.02 | -56.05 | -134.98 | -54.21 | | | |
| 2006 | +19.89 | +1.81 | +18.08 | +4.61 | -255 | +42.15 | -297.15 |
| 2007 | +74.96 | +19.42 | +55.53 | +86.7 | +134.03 | -6.61 | +140.64 |
| 2008 | +398.7 | -87.85 | +486.56 | +536.73 | -187.15 | +124.64 | -311.79 |
| 2009 | -227.82 | +67.96 | -295.78 | -341.64 | +326.53 | -110.59 | +437.13 |
| 2010 | +191.62 | +17.85 | +173.76 | +25.45 | -171.51 | -69.96 | -101.55 |
| 2011 | +167.43 | -27.39 | +194.82 | +12.99 | +145.47 | +73.49 | +71.98 |
| 2012 | -82.31 | +13.2 | -95.5 | -1.94 | +28.9 | +35.6 | -6.7 |
| 2013 | -10.55 | -20.28 | +9.72 | +27.64 | +20.6 | +5.43 | +15.17 |
| 2014 | -134.07 | -43.96 | -90.11 | -208.5 | -47.54 | -6.87 | -40.66 |
| 2015 | -90.25 | -31.39 | -58.86 | -76.76 | +116.91 | -11.03 | +127.95 |
| 2016 | -125.4 | +2.59 | -127.99 | +6.56 | +195.82 | -26.05 | +221.87 |
| 2017 | +110.34 | +19.8 | +90.54 | +137.68 | -179.69 | +13.7 | -193.39 |
| 2018 | +69.03 | -15.83 | +84.85 | +146.56 | -149.67 | +30.05 | -179.72 |
| 2019 | +66.22 | -35.54 | +101.76 | +110.6 | -116.79 | +2.86 | -119.65 |
| 2020 | +116.44 | +14.51 | +101.93 | +21.33 | +120.1 | -68.89 | +188.99 |
| 2021 | +115.21 | -51.13 | +166.34 | +149.87 | +70.89 | -8.26 | +79.15 |
| 2022 | -44.82 | -17.93 | -26.89 | +57.43 | -20.61 | +70.05 | -90.67 |
| 2023 | +111.56 | -18.15 | +129.71 | +28.43 | -119.75 | -36.2 | -83.55 |
| 2024 | -208.73 | -35.4 | -173.33 | -118.06 | +136.85 | +34.19 | +102.66 |
| 2025 | -12.24 | +27.35 | -39.59 | -70.42 | +66.03 | -62.13 | +128.15 |
| 2026 | | | | | +55.36 | +16.47 | +38.89 |

T2 2026 is compared with February to October only (the November window was not complete on file).

## What it says
- **December leans the claimed way, with no regularity.** In 2017-2021 the short-USD basket beat the rest of the year five
  Decembers in a row, which is where the claim's reputation could come from; 2012, 2014-16 and 2024-25 went the other way.
  9 of 16 decisive years positive is a coin's count.
- **January has no sign.** The long-USD basket's first ten days of January beat the rest of the year 9 of 17 times, by +9 bp
  on average, and 2017-2019 were three straight losers.
- **EUR/USD alone** won 11 of 16 Decembers, but by little and with two large losers (2014, 2024): t 0.63.
- Nothing here is a filter, rule or size for any council system, and nothing live changed.

To repeat: `node research/edge/fx-december-usd/run.mjs fetch <dir>` (git show from council-data and the fx-carry branch, no
network), then `node research/edge/fx-december-usd/run.mjs full <dir>`. Tests: `tests/fx-december-usd.test.mjs`.
