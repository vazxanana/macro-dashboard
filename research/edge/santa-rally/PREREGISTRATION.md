# The "Santa Claus rally" on index CFDs: pre-registration

Written and committed **before** any code was run on the candles or any number below was computed (14 Nov 2026). The rule,
the data, the statistics and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config, council member or mirror setting changes, whatever the
outcome. It does not touch the gold book (owner decision 44) or the ICT edge (a separate edge, never mixed in).

## The claim

The Stock Trader's Almanac (Hirsch) says US stocks tend to rise over the last 5 trading days of December plus the first 2
trading days of January: a 7-trading-day window once a year. This study asks whether going long over that window beats the
same trade over any other 7-trading-day window of the same year, after costs, out of the sample the claim was popularised on.

## How it differs from the related seasonal studies (other branches, read only, nothing imported)

- `sell-in-may` (Halloween effect): a half-year hold (November-April against May-October), one pair a year.
- `turn-of-month`: a short window every month (twelve a year), judged against the other days of the month.
- `pre-holiday`: the single trading day before each market holiday, on H1 candles.
- This study: ONE fixed 7-day window a year straddling the year end, each year one observation, judged as the excess over
  the mean of every other 7-trading-day window starting in the same calendar year (same rule, same stop, same costs), with
  a placebo of random 7-day windows. It also covers Christmas and New Year closures in each index's own calendar.

## Data

OANDA mid daily candles (UTC days) from council-data `research/daily/<key>.json`, read with `git show origin/council-data:…`
(snapshot `61a60d2fd`, candles through 6 Nov 2026), no network: `spx500` (SPX500_USD), `nas100` (NAS100_USD), `de40`
(DE30_EUR), `uk100` (UK100_GBP), all from March 2003. Price returns only (no dividends), each index in its own currency.
FRED `DGS2` (weekly, January 2006 on) from council-data `macro/cache.json` `score.fred.DGS2`; for dates before its first
value a fixed 4 % is used (stated in the result).

## Trading calendars

- **US indices (T1, T2)**: the NYSE calendar, written in code (OANDA's US CFDs print candles on exchange holidays and on
  Sunday evenings, so candle presence is not the calendar): weekdays except New Year's Day (Monday when on a Sunday; no
  Friday holiday when on a Saturday), Martin Luther King Day, Presidents' Day, Good Friday, Memorial Day, Juneteenth (from
  2022), Independence Day, Labor Day, Thanksgiving and Christmas (Saturday holidays observed on the Friday, Sunday ones on
  the Monday), and the special closures 11 Jun 2004, 2 Jan 2007, 29-30 Oct 2012, 5 Dec 2018, 9 Jan 2025. A trading day
  must also have a candle.
- **DE40, UK100 (T3)**: each index's own calendar read from its candles: a Monday-Friday candle whose volume is at least
  5 % of the median volume of the previous 20 accepted trading days (drops the stub candles OANDA prints on a few closed
  days such as 26 December; the first 20 weekday candles are accepted as they are).

## The trade (every window, the claimed one and every comparison window alike)

- A window = 7 consecutive trading days of the index's calendar. The Santa window of year Y = the last 5 trading days of
  December Y and the first 2 trading days of January Y+1; it belongs to year Y.
- Long at the OPEN of the window's first trading day's candle, out at the CLOSE of its last trading day's candle.
- **Stop** (every position has one): entry minus 3 x ATR(20), ATR = the mean true range of the 20 trading-day candles
  before the entry day (true range against the previous trading day's close). Checked on every candle from the entry
  candle to the exit candle, including non-trading candles in between (Sunday stubs, holiday candles, which do trade on the
  CFD): an open at or under the stop fills at the open, else a low at or under the stop fills at the stop.
- Net return (in % of the entry price) = exit / entry - 1 - 0.04 % round trip - financing; financing = (DGS2 + 2.5 %) x
  nights / 365, nights = calendar days from the entry day to the exit day, plus one (one rollover per calendar day held).
  DGS2 = the latest weekly value dated on or before the entry day. The same US rate is used for DE40 and UK100 (as asked;
  stated in the result). The 2x-cost run doubles both the round trip and the financing.

## Yearly excess

For index i and year Y: excess(i, Y) = net(Santa window of Y) - mean net of the windows starting on every OTHER trading day
of calendar year Y (each a full 7 trading days, with 20 trading days before it for the ATR; windows starting late in
December run into January). Years are used only when the Santa window and its January days are on file.

- **T1**: SPX500, yearly excess.
- **T2**: NAS100, yearly excess.
- **T3**: DE40 and UK100 pooled: the year's observation = the mean of the two indices' yearly excesses (each on its own
  calendar); a year with one index only uses that one.

## Windows

- **Decisive**: Santa years 2010 to 2025 (16 years; the 2026 window has not happened).
- **Replication**: every Santa year before 2010 the data allow (2003 to 2009).

## Statistics

- Each year one observation; the year-by-year table of Santa net, baseline mean, excess and sign, per test.
- t = mean / (sd / sqrt n) on the decisive yearly excesses, one-sided p from Student's t with n - 1 degrees of freedom
  (the claim is a rise). Holm over the 3 decisive p-values.
- **Placebo** (per test, decisive years): 1,000 draws, seeded generator (mulberry32, seed 20261214); each draw picks a start
  position k uniformly from 0 to 239 (the k-th trading day of each year, counted from the year's first trading day, so it is
  never the Santa start), takes that window in every decisive year, computes its yearly excess against the same baseline
  rule (all other start days of that year) and its mean. Placebo share = draws whose mean is at least the Santa window's mean.
  For T3 the position is taken in each index's own calendar.
- Every figure also at 2x costs (reported, not judged).

## Pass bar (per test, all three)

1. Mean yearly excess > 0 in the decisive window AND in the replication window.
2. Decisive Holm-adjusted one-sided p < 0.05.
3. Placebo share < 5 %.

**Verdict**: PASS for each test meeting all three; the study's verdict is PASS if any test passes (naming it), else FAIL.
With 16 decisive years the power is low: a real effect of the size usually quoted could easily fail this bar, and the result
will say so. A PASS would still be a seasonal tendency on index CFDs, not a council rule; nothing live changes.

## Files

`run.mjs` (pure functions + a main that reads the candle files given as arguments and writes `result.json`), `RESULT.md`
with a Verdict line, `result.json`, `tests/santa-rally.test.mjs` (node:test, offline, hand-made candles).
