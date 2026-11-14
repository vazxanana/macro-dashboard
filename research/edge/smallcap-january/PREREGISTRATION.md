# Small caps at the turn of the year: pre-registration (14 Nov 2026)

Paper research only. Nothing here is read by the council, the mirror or any page; no live rule, size, filter, stop, config
or market list changes, whatever the result. This file is committed and pushed alone, before any price of the three index
CFDs is read (only the files' first and last dates and the shape of the DGS2 series were looked at, to fix the samples).

## The claim

The turn-of-the-year (January) effect in small caps: small US stocks have beaten large ones in the last days of December
and in January, a pattern linked to tax-loss selling in December and its reversal (Keim 1983, Reinganum 1983, Roll 1983).
Later work found it much weaker after it was published (for example Schwert 2003). It has been in print for over forty
years, so every year of data here comes long after publication: this is a test of whether a widely known calendar trade
still pays on today's instruments, not a discovery.

## Data

OANDA mid daily CFD candles (UTC days) of the council's cache, read from the `council-data` branch with `git show`, no
network: `research/daily/us2000.json` (Russell 2000 CFD), `spx500.json` (S&P 500 CFD), `nas100.json` (Nasdaq 100 CFD,
control only); first candle 24 March 2003, last 6 November 2026. Weekend buckets are folded into the next weekday
(`council/fills.mjs` `foldWeekend`). The close of a US trading day d is the close of the UTC candle dated d. Rates: FRED
`DGS2` from `council-data` `macro/cache.json` (`score.fred.DGS2`, weekly from 6 January 2006): the last value on or before the
entry day; before 6 January 2006 DGS2 is taken as a fixed 4 %.

## The US trading-day calendar

US trading days are Monday-Friday less the NYSE's full closures. The dates come from `council/datacheck.mjs` `usHolidays`
(the CME list the council already uses), adjusted to the NYSE and stated here:
- closed: every day it marks `closed` (New Year's Day, Good Friday, Christmas) and the federal holidays it marks `early`
  because CME trades a short session (Martin Luther King Jr. Day, Presidents' Day, Memorial Day, Juneteenth, Independence
  Day, Labor Day, Thanksgiving); Juneteenth only from 2022, when the NYSE first closed for it;
- open: the day after Thanksgiving and 24 December (NYSE half days, `early` there);
- New Year's Day on a Saturday closes nothing (NYSE rule; `usHolidays` moves it to Friday 31 December, which stays open);
- special NYSE closures in the data's span: 11 Jun 2004, 2 Jan 2007, 29-30 Oct 2012, 5 Dec 2018, 9 Jan 2025.
A US trading day with no candle in either CFD file is a data hole; a turn of the year whose window holds one is dropped and
named. CFD candles of days that are not US trading days (the CFDs trade on several US holidays) are still read for the stops.

## The two tests

The pair: long US2000 and short SPX500, entered at the close of the entry day, each leg sized to equal risk.
- **T1**: entry at the close of the 5th-to-last US trading day of December (four US trading days of December follow it),
  exit at the close of the 10th US trading day of January.
- **T2**: entry at the close of the last US trading day of December, exit at the close of the last US trading day of January.
- **Control C (not judged)**: the T1 window with NAS100 as the short leg instead of SPX500.

## Sizing, stops, R

- Each leg's 1R = 3 x ATR(20) of its own folded daily candles: the mean true range of the 20 candles up to and including
  the entry candle (all closed at the entry; no later candle is read).
- Leg R = the leg's move in its favour / its 1R. Pair R = long-leg R + short-leg R (each leg risks 1R).
- Per-leg protective stop at 3 x ATR(20) from its entry (long below, short above): hit when a later candle's low (long) or
  high (short) reaches it, filled at the stop, or at the candle's open when the open is already past it (a gap, never
  better). A stopped leg is closed at -1R (or the gap fill); the other leg stays on.
- Pair stop: at each daily close after entry (a date both files have), if pair R (closed legs as booked, open legs marked
  at the close) is -1R or less, every open leg is closed at that close. The leg stops are checked first within a candle,
  then the pair stop at its close. Every position therefore always has a stop (absolute rule 1).
- Otherwise both legs close at the exit day's close. One trade per test per turn of the year.

## Costs

- Spread: a CFD round trip of 0.04 % of the entry price per leg, in that leg's R.
- Financing charged on both legs, the short included (nothing is credited): (DGS2 + 2.5 %)
  a year / 365 per rollover night, nights counted with `council/fills.mjs` `nights` (Monday-Friday 22:00 UTC, Wednesday
  three), on the entry price, in that leg's R, from entry to that leg's exit.
- Reported at 0x, 1x (base) and 2x (both items multiplied). The verdict uses 1x.

## Samples

A turn of the year is named by the year its window ends in (January of year Y; the entry is in December of Y-1).
- **Decisive**: Y = 2016 to 2026 (11 turns).
- **Replication**: every earlier turn the data covers (Y = 2004 to 2015, 12 turns).

## Statistics and the pass bar

- Per test and sample: n, years won (net R > 0), mean gross R, mean net R at 0x / 1x / 2x, the per-year t, the number
  stopped (leg or pair).
- **Permutation p** (one-sided): for turn Y the null pool is the same pair trade, same rules and costs, started at the
  close of every other US trading day of calendar year Y-1 and held the same number of US trading days as that turn's real
  window; one start drawn uniformly per turn, the mean over the sample's turns, 200,000 draws, seed 20261114;
  p = (1 + draws at or above the real mean) / (1 + draws).
- **Rank**: start days are aligned by their place counted back from the last US trading day of December (offset 1 = that
  day; T1 is offset 5, T2 offset 1); the real mean ranked among the means of every offset that all of the sample's turns
  have (1 = best).
- **Placebo**: 40 seeds (seed 20261114 + s); per seed and turn a random start US trading day of calendar year Y-1, same
  length; the count of seed means at or above the real mean.
- **Holm** over the two decisive permutation p values (T1, T2).
- **A test passes** when its mean net R (1x) is above 0 in BOTH samples AND its Holm-corrected decisive p is under 0.05.
  The study passes when one test passes. The control is reported, never judged.
- One trade a year: the decisive sample is 11 trades a test. A pass would be a candidate for a paper shadow the owner
  decides on, never an edge on its own.

## Not done, on purpose

No other windows, legs, sizes, stops or filters are tried and judged; anything added after the first run is labelled
post-hoc. No market is added to any trading rule.
