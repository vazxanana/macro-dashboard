# Pre-registration: the turn-of-the-month effect on US indices, out of sample (13 Nov 2026)

Written and pushed before any number of this study is computed. Research only: no rule, size, filter, stop or council member
changes. Not an ICT study (nothing under `ict/` is edited; `ict/calendar.mjs` is only read for its holiday dates).

## Why
The published turn-of-the-month effect: US equity returns concentrate in the last trading day of a month and the first three
of the next (Ariel 1987, Journal of Financial Economics; Lakonishok and Smidt 1988, Review of Financial Studies; McConnell and
Xu 2008, "Equity returns at the turn of the month", Financial Analysts Journal). It is one of the best known calendar effects,
which is the reason to ask whether it survived its publication, after costs, on the CFDs the desk can reach.
`research/edge/seasonality` tested clock and calendar windows on gold only (0 of 10 passed); this is US indices. The
pre-FOMC drift is tested elsewhere and is not part of this study.

## Data
- OANDA mid H1 candles of `spx500` (SPX500_USD, the primary market), `us30` (US30_USD, second) and `nas100` (NAS100_USD,
  third) through the site's keyless candle proxy (`/md/bars`), October 2007 to 12 November 2026, complete candles only.
  `fetch.mjs <dir>` writes them; the files are kept out of git.
- The 2-year Treasury yield, weekly, from council-data `macro/cache.json` `score.fred.DGS2` (FRED), copied once into
  `rates.json` beside this file, for the financing charge.

## Trading days and the close
- **New York trading day** = a weekday that is not an NYSE holiday. Holidays are taken from `ict/calendar.mjs` `cmeYear` (read
  only): its full-closure days (New Year's Day, Good Friday, Christmas) and its early-close days that are NYSE holidays (Martin
  Luther King Day, Presidents' Day, Memorial Day, Juneteenth from 2022, Independence Day, Labor Day, Thanksgiving Day), plus
  the special closures stated here: 29 and 30 October 2012 (hurricane), 5 December 2018 and 9 January 2025 (national days of
  mourning). The half days (Independence Day eve, the day after Thanksgiving, Christmas Eve) are trading days that close at
  13:00 New York.
- **The close** of a trading day (the cash-close proxy) = the close of the OANDA H1 candle that ends at 16:00 New York (13:00
  on a half day), daylight saving read with the New York time zone (`Intl`), so the candle is 20:00 UTC in winter and 19:00
  UTC in summer. A trading day without that candle has no close; a trade that needs it is skipped and counted.
- Trading days are numbered within each calendar month: TD+1 is the month's first, TD-1 its last, TD-2 the one before.

## The rule
- Buy at the close of TD-2 of every month. Sell at the close of TD+3 of the next month. The position holds four trading-day
  returns: TD-1, TD+1, TD+2, TD+3. Long only, one position at a time (the windows never overlap).
- **Stop**: entry minus 2 x ATR(20), ATR on the 20 completed New York days before the entry (each day = the H1 candles after
  the previous trading day's close up to its own close; true range against the previous close; simple mean). The stop is
  checked on every H1 candle after the entry candle up to the exit candle: a candle that opens at or below it fills at its
  open, otherwise a low at or below it fills at the stop. Every trade has a stop.
- **Costs** (stated, conservative against OANDA's quoted index CFD spreads), a round trip as a share of the entry price:
  SPX500 0.04 %, US30 0.05 %, NAS100 0.05 %.
- **Financing** on the long notional: (the last weekly 2-year yield on or before the entry date + 2.5 %) / 365 for every
  calendar night from the entry date to the exit date (New York dates), as a share of the entry price. No broker rate history
  is known, so this one formula is used for every year.
- Trade result = (exit - entry) / entry - cost - financing, in percent of the entry price.

## Windows
- 2008-2015 (trades entered in those years): reported, not judged (mostly the years the effect was being published on).
- **2016 to now** (trades entered from January 2016 whose exit is on file): the decisive window.

## Tests (each on the 2016-now window, each market)
- **T1, net return**: mean trade result > 0 with a one-sample t >= 2 (the trades do not overlap).
- **T2, placebo**: 40 seeds (fixed, 1 to 40). For each seed and each calendar year, draw as many trades as the rule took that
  year, each entered at the close of a trading day drawn uniformly from that year's trading days (with replacement) and held
  four trading days, with the same stop, costs and financing. The rule passes when its mean trade result is above the seed's
  mean in at least 38 of the 40 seeds.
- **T3, turn days against the rest**: daily close-to-close returns (before costs) on trading days TD-1, TD+1, TD+2, TD+3
  against all other trading days: mean higher, Welch t >= 2.
- **Holm**: the one-sided p of T1's t (normal approximation) over the three markets, Holm at 5 %.
- A market passes when T1, T2 and T3 hold and its Holm-adjusted p is under 0.05. **Verdict PASS** when SPX500 passes; US30
  and NAS100 are reported as the second and third market. A FAIL is a result.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict first), `tests/turn-of-month.test.mjs`. A proposal (as a paper shadow, never a
live change) only if the verdict is PASS.
