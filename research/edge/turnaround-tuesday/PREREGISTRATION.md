# Pre-registration: "Turnaround Tuesday" on US indices, out of sample (13 Nov 2026)

Written and pushed before any number of this study is computed. Research only: no rule, size, filter, stop or council member
changes. Not an ICT study (nothing under `ict/` is edited; `ict/calendar.mjs` is only read for its holiday dates and New York
clock).

## Why
A widely cited calendar pattern: when US stocks close down on Monday, Tuesday tends to rebound ("Turnaround Tuesday"; the
weekend / Monday effect literature, e.g. French 1980, "Stock returns and the weekend effect", Journal of Financial Economics,
and the trader lore built on it). The question is whether buying the Monday close after a down Monday and selling Tuesday's
close makes money after costs and financing on the index CFDs the desk can reach, out of sample. The same day's sister studies
(`turn-of-month`, `overnight-drift`, `pre-holiday`; branches of those names) failed; their NYSE calendar, New York close and
cost conventions are copied here (not imported: they are not on `main`) so the studies read alike.

## Data, and which "day" is measured
- OANDA mid **H1** candles of `spx500` (SPX500_USD) and `nas100` (NAS100_USD) through the site's keyless candle proxy
  (`/md/bars`), October 2007 to 12 November 2026, complete candles only (`fetch.mjs <dir>`, the same files `pre-holiday`
  fetched; kept out of git).
- **Close to close at the New York cash close**: the close of a trading day = the close of the H1 candle that ends at 16:00
  New York (13:00 on a half day), daylight saving read with the New York time zone (`Intl`): the candle starting 20:00 UTC in
  winter, 19:00 UTC in summer. A day without that candle has no close; a trade that needs it is skipped and counted.
- The 2-year Treasury yield, weekly, FRED `DGS2` from council-data `macro/cache.json` (`rates.json` beside this file, the copy
  `pre-holiday` used), for the financing charge.

## The calendar
- Trading days = weekdays that are not NYSE full holidays (`ict/calendar.mjs` `cmeYear`, observed dates, as `pre-holiday`:
  New Year, MLK, Presidents', Good Friday, Memorial, Juneteenth from 2022, Independence, Labor, Thanksgiving, Christmas) and
  not the unscheduled closures 29-30 Oct 2012, 5 Dec 2018, 9 Jan 2025. Half days (4 July eve, day after Thanksgiving,
  Christmas Eve) are trading days closing 13:00 New York.
- **"Monday" (M)** = the first trading day of each calendar week (Monday to Friday, New York dates). On a normal week it is the
  Monday; **on a week whose Monday is a holiday (or closed) it is the Tuesday**, and so on. **"Tuesday" (T)** = the next trading
  day after M (on a normal week the Tuesday; on a holiday-Monday week the Wednesday). The previous close = the close of the
  last trading day before M (normally the Friday; after a Friday holiday the Thursday).
- A week with only one trading day has no T and is skipped.

## The rules (two, both stated now)
- **R1 (base)**: if close(M) < close(previous trading day), buy at close(M), sell at close(T). One session held, long only.
- **R2 (variant)**: the same, only when close(M) / close(previous trading day) - 1 < -1 %.
- **Stop** 2 x ATR(20): ATR on the 20 completed New York days before the entry day (each day = the H1 candles after the
  previous trading day's close up to its own close; true range against the previous close; simple mean), the `pre-holiday`
  code. The stop is checked on every H1 candle after the entry candle up to the exit candle: a candle that opens at or below it
  fills at its open, otherwise a low at or below it fills at the stop. Every trade has a stop.
- **1R** = entry - stop. A trade's R = (exit - entry) / 1R, less costs and financing expressed in R.
- **Costs** (stated): a round trip as a share of the entry price, SPX500 0.04 %, NAS100 0.05 %.
- **Financing** on the long notional: (the last weekly 2-year yield on or before the entry date + 2.5 %) / 365 per calendar
  night from the entry date to the exit date (New York dates): one night on a normal week, more when T is after a holiday.

## Windows
- 2008-2015 (by entry date): the replication window, judged on its sign.
- **2016 to now** (entry from January 2016, exit on file): the decisive window.

## Tests: 2 markets x 2 rules = 4 cells, each judged alone
For a cell (market, rule), on the decisive window unless stated:
- **C1, net return**: mean net R a trade > 0, trade t >= 2, and its one-sided p (normal approximation of t) Holm-adjusted over
  the 4 cells under 0.05.
- **C2, n**: R1 at least 100 trades; R2 at least 30 trades (else the cell fails as underpowered).
- **C3, replication**: mean net R a trade in 2008-2015 > 0.
- **C4, against all Tuesdays**: the % return before costs of the rule's T days (close(M) to close(T)) against the same return
  on every T day of the window (all weeks, whatever Monday did): mean higher, Welch t >= 2. (The rule's days are a subset of
  all T days; the comparison is reported as stated.)
- **C5, placebo of random down days**: 40 seeds (1 to 40). For each seed and each calendar year, draw as many down days (any
  trading day D with close(D) < close(previous trading day) that is not an M of the rule on that market, and that has a next
  trading day; uniform with replacement; for R2 the day must also be down more than 1 %) as the cell traded that year; each is
  traded exactly like the rule (buy close(D), sell the next trading day's close, the same stop, costs and financing). The cell
  passes when its mean net R is above the seed's in at least 38 of the 40 seeds.
- **A cell PASSES** when C1 to C5 all hold. **Verdict PASS** when at least one cell passes; otherwise FAIL. A FAIL is a result.
- Also reported (not judged): gross R, net % a trade, win rate, stops, by year, and the plain M-to-T return of all weeks.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict first), `tests/turnaround-tuesday.test.mjs`. A proposal (a paper shadow, never a
live change) only if the verdict is PASS.
