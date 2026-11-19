# Pre-registration: the pre-holiday effect on US indices, out of sample (13 Nov 2026)

Written and pushed before any number of this study is computed. Research only: no rule, size, filter, stop or council member
changes. Not an ICT study (nothing under `ict/` is edited; `ict/calendar.mjs` is only read for its holiday dates).

## Why
The published pre-holiday effect: the trading day before a US market holiday earns several times an average day (Ariel 1990,
"High stock returns before holidays", Journal of Finance; Kim and Park 1994, "Holiday effects and stock returns", Journal of
Financial and Quantitative Analysis). The question is whether it survives after its publication, after costs and financing, on
the index CFDs the desk can reach. The same day's sister study `turn-of-month` (branch `turn-of-month`) failed 0 of 3; this
study reuses its calendar, close and cost conventions so the two read alike.

## Data, and which "day" is measured
- OANDA mid **H1** candles of `spx500` (SPX500_USD), `nas100` (NAS100_USD) and `us30` (US30_USD) through the site's keyless
  candle proxy (`/md/bars`), October 2007 to 12 November 2026, complete candles only (`fetch.mjs <dir>`, files kept out of git).
- **Not the daily candles**: council-data `research/daily/<key>.json` candles are UTC days that close at 00:00 UTC (19:00 or
  20:00 New York), so a "day" there runs from the previous evening's after-hours through this evening's after-hours and
  misplaces the holiday by several hours. This study measures **close to close at the New York cash close** instead: the close
  of a trading day = the close of the H1 candle that ends at 16:00 New York (13:00 on a half day), daylight saving read with
  the New York time zone (`Intl`): the candle starting 20:00 UTC in winter, 19:00 UTC in summer. A day without that candle
  has no close and a trade that needs it is skipped and counted (as in `turn-of-month`).
- The 2-year Treasury yield, weekly, from council-data `macro/cache.json` `score.fred.DGS2` (FRED), in `rates.json` beside
  this file (the same copy `turn-of-month` used), for the financing charge.

## The holiday calendar
- **NYSE full holidays** = weekdays the NYSE is closed by its published schedule, taken from `ict/calendar.mjs` `cmeYear` (read
  only), with the observed dates it computes: New Year's Day (Sunday -> Monday; a Saturday New Year is NOT observed on the
  Friday), Martin Luther King Day, Presidents' Day, Good Friday, Memorial Day, Juneteenth (from 2022; Saturday -> Friday,
  Sunday -> Monday), Independence Day (observed the same way), Labor Day, Thanksgiving Day, Christmas Day (observed the same
  way).
- **Not holidays for the rule**: unscheduled closures (29-30 October 2012 hurricane; 5 December 2018 and 9 January 2025 days of
  mourning). They are not trading days, but nobody knew them a day ahead, so no trade is taken before them.
- Half days (Independence Day eve, the day after Thanksgiving, Christmas Eve) are trading days that close at 13:00 New York.
- **The pre-holiday day** P = the last trading day before a holiday (for a Monday holiday the Friday; for Good Friday the
  Thursday; for Christmas often the Christmas Eve half day). If two holidays ever shared a P, P is traded once.

## The rule
- Buy at the close of the trading day before P; sell at the close of P. One session held, long only; trades never overlap.
- **Stop** 2 x ATR(20): ATR on the 20 completed New York days before the entry (each day = the H1 candles after the previous
  trading day's close up to its own close; true range against the previous close; simple mean), the `turn-of-month` code. The
  stop is checked on every H1 candle after the entry candle up to the exit candle: a candle that opens at or below it fills at
  its open, otherwise a low at or below it fills at the stop. Every trade has a stop.
- **1R** = entry - stop (2 x ATR). A trade's R = (exit - entry) / 1R, less costs and financing expressed in R.
- **Costs** (stated): a round trip as a share of the entry price, SPX500 0.04 %, US30 0.05 %, NAS100 0.05 %.
- **Financing** on the long notional: (the last weekly 2-year yield on or before the entry date + 2.5 %) / 365 per calendar
  night from the entry date to the exit date (New York dates): one night for most trades, three when the hold spans a weekend
  (a Friday entry and a Monday P). No broker rate history is known, so the one formula is used for every year.
- Results are reported in R (the judged unit) and in percent of the entry price.

## Windows
- 2008-2015 (trades whose P is in those years): the replication window, judged only on its sign (below).
- **2016 to now** (P from January 2016 whose exit is on file): the decisive window.

## Pooling
The three markets trade the same days and move together, so they are NOT pooled as three independent trades. **Pooled R of a
holiday** = the mean net R of the markets that have a trade for it (one observation per holiday). Pooled t = one-sample t on
those holiday observations.

## Tests (decisive window unless stated)
- **T1, net return**: pooled mean net R a trade > 0 with t >= 2.
- **T2, n**: at least 80 trades per market in the decisive window (else the study is underpowered and reads FAIL).
- **T3, replication**: pooled mean net R in 2008-2015 > 0 (same sign).
- **T4, against the ordinary day**: pooled daily close-to-close return (mean of the three markets' % returns that day, before
  costs) on pre-holiday days against ordinary days (trading days that are neither a pre-holiday day nor the first trading day
  after a holiday): mean higher, Welch t >= 2.
- **T5, placebo**: 40 seeds (fixed, 1 to 40). For each seed and each calendar year, draw as many ordinary days as the rule
  traded P days that year (uniform over that year's ordinary days, with replacement); each is traded exactly like the rule
  (entry at the previous trading day's close, exit at its close, the same stop, costs and financing) on all three markets and
  pooled the same way. The rule passes when its pooled mean net R is above the seed's in at least 38 of the 40 seeds.
- **Per-market claims** (reported, not part of the verdict): a market's own mean net R > 0 with t >= 2 and a Holm-adjusted
  one-sided p (normal approximation of its t) under 0.05 over the three markets.
- **Verdict PASS** when T1 to T5 all hold. A FAIL is a result.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict first), `tests/pre-holiday.test.mjs`. A proposal (a paper shadow, never a live
change) only if the verdict is PASS.
