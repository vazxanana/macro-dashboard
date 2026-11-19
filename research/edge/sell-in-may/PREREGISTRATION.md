# Pre-registration: the Halloween effect on equity index CFDs (13 Nov 2026)

Written and committed before `run.mjs` exists and before any return of this study is computed. The only thing looked at in
the data before writing this: that the nine files exist and their first and last dates (below).

## Why, and what this is not

The claim (Bouman and Jacobsen 2002, "The Halloween Indicator, 'Sell in May and Go Away'"; Jacobsen and Zhang, a later
long-history update over many markets): stock market returns from November to April are higher than from May to October, in
most countries. This study asks: **out of sample, after costs, on the index CFDs the council can read, is the November-April
half-year better than the May-October one, and would a long-only "winter" rule have beaten simply holding?**

A **stand-alone index allocation rule**: not a gate, exit, entry or size of the gold book (owner decision item 44 untouched);
no gold data is read. Nothing live changes whatever the verdict; a PASS only allows a paper-shadow proposal for the owner.

## Data

- OANDA mid daily candles from council-data `research/daily/<key>.json`, read with `git show origin/council-data:...` (no
  network), for nine markets: `spx500`, `nas100`, `us30`, `de40`, `uk100`, `jp225`, `eu50`, `fr40`, `au200`. All nine files
  exist (checked before writing this; none dropped): first candles March 2003 (`eu50` September 2003, `au200` March 2004),
  last candle 6 Nov 2026. If a file were missing at run time the run stops rather than drops it silently.
- UTC daily alignment. Saturday / Sunday candles are folded into the next weekday (open from the weekend candle, high / low
  over both, the weekday's close); a trailing weekend candle is dropped. Returns are weekday close to weekday close.
- Price returns only (CFD prices carry no dividends), the rule and the benchmark alike. Each market in its own quote
  currency; no currency conversion.
- 2-year Treasury yield: FRED `DGS2` weekly values in council-data `macro/cache.json` (`score.fred.DGS2`); for a day, the
  latest value dated at least 7 days before it; 3.0 % if none (the report counts such days).

## Seasons

- **Winter** of year y = from the close of the last trading day of October y-1 to the close of the last trading day of
  April y (so it carries every return of November y-1 to April y). **Summer** of year y = from the close of the last trading
  day of April y to the close of the last trading day of October y. "Last trading day of a month" = the last folded weekday
  candle dated in that month, known from the calendar.
- **Pair y** = (winter y, summer y). Discovery: pairs 2008 to 2015 (winter 2008 starts at the October 2007 close).
  **Decisive: pairs 2016 to 2026** (winter 2016 starts at the October 2015 close; summer 2026 ends at the October 2026 close,
  which is in the data). A pair whose summer is not complete in the data is not used.

## The rule and the benchmark

- **Rule**: long 1 unit of notional from the winter's start close to its end close, flat in summer. Entry at the October
  close, exit at the April close.
- **Catastrophe stop** (every position has a stop): at the entry close, stop = entry close - 3 x ATR(20) (simple mean of the
  true ranges of the 20 folded weekday candles ending at that close). Never moved. If a later day's low reaches it, the
  position exits at the stop, or at that day's open when the open is already through it. **A stopped market stays flat until
  the next winter's start.**
- **Benchmark**: always long 1 unit, the same stop rule: at every season boundary (each last October and last April close)
  its stop is set again to that close - 3 x ATR(20); after a stop it is flat until the next season boundary, where it buys
  again with a new stop. Same costs and financing.

## Costs (both)

- Spread, a round trip as a fraction of price, half paid on each entry and each exit (stop exits included): 0.03 % for
  `spx500`, `nas100`, `us30`, `de40`, `fr40`, `uk100`; 0.05 % for `jp225`, `eu50`, `au200`. The benchmark's season-boundary
  stop reset is not a trade and costs nothing.
- Financing on the held notional for every calendar day from the previous close while held: (max(rate, 0) + 2.5 %) / 365,
  rate = DGS2 for `spx500`, `nas100`, `us30`; for the others a stated local policy rate by calendar year (approximate yearly
  averages written from memory, not fetched: the build sandbox reaches no central bank site; they are stated so anyone can
  check or replace them):

| Year | EUR (ECB deposit) `de40` `eu50` `fr40` | GBP (Bank Rate) `uk100` | JPY (BoJ) `jp225` | AUD (RBA cash) `au200` |
|---|---|---|---|---|
| 2007 | 3.0 | 5.5 | 0.4 | 6.5 |
| 2008 | 3.0 | 4.7 | 0.4 | 6.7 |
| 2009 | 0.5 | 0.5 | 0.1 | 3.3 |
| 2010 | 0.25 | 0.5 | 0.1 | 4.4 |
| 2011 | 0.5 | 0.5 | 0.1 | 4.6 |
| 2012 | 0.1 | 0.5 | 0.1 | 3.9 |
| 2013 | 0.0 | 0.5 | 0.1 | 2.9 |
| 2014 | 0.0 | 0.5 | 0.1 | 2.5 |
| 2015 | -0.2 | 0.5 | 0.1 | 2.1 |
| 2016 | -0.35 | 0.4 | -0.1 | 1.6 |
| 2017 | -0.4 | 0.3 | -0.1 | 1.5 |
| 2018 | -0.4 | 0.6 | -0.1 | 1.5 |
| 2019 | -0.45 | 0.75 | -0.1 | 1.1 |
| 2020 | -0.5 | 0.2 | -0.1 | 0.3 |
| 2021 | -0.5 | 0.1 | -0.1 | 0.1 |
| 2022 | 0.25 | 1.5 | -0.1 | 1.5 |
| 2023 | 3.3 | 4.7 | -0.1 | 3.9 |
| 2024 | 3.7 | 5.1 | 0.1 | 4.35 |
| 2025 | 2.2 | 4.3 | 0.4 | 3.9 |
| 2026 | 2.0 | 3.9 | 0.6 | 3.6 |

## The one test (pooled), and what PASS means

- Half-year return of a market = the compounded daily return of an unstopped long over that half-year, **net of financing**
  (no spread: holding pays none). d(m, y) = winter return - summer return of pair y.
- Pooled per year: D(y) = the equal-weight mean of d(m, y) over the nine markets.
- **Condition 1**: over the 11 decisive pairs, mean D > 0 and the one-sample t (sd with n - 1) >= 2.
- **Condition 2**: the rule's equal-weight nine-market book (each day the mean of the nine markets' net daily returns; a day
  without a market's candle adds 0 for it) has a Sharpe ratio on monthly net returns (mean / sd x sqrt(12), no risk-free
  rate: financing is already charged; flat months count as 0) at least the benchmark book's, over January 2016 to the last
  complete month (October 2026).
- **PASS = both conditions.** Anything else is FAIL. Exactly one test; no Holm needed. A PASS allows a paper-shadow proposal
  only.

## Reported, not judged

- The same figures on the discovery window (pairs 2008-2015; book January 2008 to December 2015).
- Per market: decisive and discovery mean d, its t, how many pairs were positive; the rule's and the benchmark's Sharpe,
  return a year, maximum drawdown and number of stops. No per-market test, no market picked afterwards.
- The book's return a year and maximum drawdown (daily, compounded) for both.

## Not tested (stated now)

Other seasons, entry days (Halloween day itself, mid-month), other stops or no stop, short summers, other markets, dividends,
currency-hedged returns. Any of them needs its own pre-registration.
