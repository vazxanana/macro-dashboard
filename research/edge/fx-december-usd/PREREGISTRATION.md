# Pre-registration: the year-end US dollar seasonal (14 Nov 2026)

Written and pushed before any number of this study is computed. Paper only: nothing live changes, whatever the verdict. No
council rule, filter, size, stop or trade reads this study.

## Why
A claim repeated in FX strategy notes: the US dollar tends to **weaken in the second half of December** (year-end dollar
funding pressure unwinds, repatriation and balance-sheet flows settle before the year end), and the reverse claim that it tends
to **strengthen in the first days of January**. No study in this repository tests either. This one tests both, on the six USD
majors, as positions with stops and costs.

## Data
- council-data `research/daily/<key>.json` for `eurusd gbpusd audusd nzdusd usdjpy usdchf` (OANDA mid daily candles, UTC
  days; `git show origin/council-data:research/daily/<key>.json`, copied outside git by `run.mjs fetch <dir>`; each file's
  sha256 is recorded in result.json). No network at run time.
- **Used from 1 January 2005.** The rows of 2002-2004 carry a volume of 1-2 a day (placeholder prices, not traded candles), so
  they are not used, not even for the ATR.
- Saturday / Sunday candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` (imported). A "trading
  day" of a pair is one of its folded weekday candles; its date is the UTC date of the candle time. Each pair uses its own days.

## The basket
"Short USD" = long EUR/USD, GBP/USD, AUD/USD, NZD/USD and short USD/JPY, USD/CHF, equal weight. "Long USD" = the six opposite
sides. A window's basket return = the mean of the six pairs' position returns in that window (a pair whose position cannot be
built, e.g. too few candles before it, is left out of that window's mean; it is never filled in).

## One position (every window, claimed or not, is built the same way)
- Entry at the open of the window's first trading day; exit at the close of its last trading day.
- **Stop: 3 x ATR(20)** from the entry, ATR = mean true range of the 20 folded candles before the entry candle (none before
  1 Jan 2005). A day whose low (long) / high (short) reaches the stop ends that pair's position at the stop, or at the day's
  open when the day opens through it (`fills.mjs` `stopFill`, imported). No position without 20 candles before it.
- Return, as a fraction of the entry price: side x (exit - entry) / entry, minus costs, minus financing.
- **Costs (the raw-spread model, CLAUDE.md "Forex spreads")**: 0.3 pip spread a round trip, half a spread (0.15 pip) of slippage
  at the entry and at the exit, and a commission of 22.5 USD per million a side (2 x 22.5e-6 of the notional, which is 2 x
  22.5e-6 of the entry price in the pair's quote currency for every pair). Pip = 0.0001, USD/JPY 0.01.
- **Financing**: nights = `fills.mjs` `nights(entry time, exit time)` (Monday-Friday 22:00 UTC, Wednesday three; imported),
  entry time = the first candle's time, exit time = the last (or stopping) candle's time + 21 h on a Friday, + 23 h otherwise.
  Per night:
  - EUR/USD, GBP/USD, AUD/USD, USD/CHF: the demo broker's swap in council-data `ctrader/symbols.json` (type 0 = pips per lot a
    night; `swap.long` for a long, `swap.short` for a short), charged as swap x pip / entry a night (negative swap = paid).
    Today's swap is applied to every year (the broker's past swaps are not on file), as `FIN.xau` is for gold.
  - NZD/USD and USD/JPY are not in that file: the policy-rate differential from the fx-carry study's `rates.json` (branch
    `fx-carry`, `monthEnd`, the rates in force at the end of the month before the entry), (base rate - quote rate) / 100 / 365 a
    night for a long, the negative for a short. No broker markup is added there; the file is approximate (its own note).
  result.json records which source each pair used.

## Windows of a year
- **Claimed window T1 / T3**: from the first trading day on or after 15 December to the last trading day of December.
  N = its number of trading days (per pair and year).
- **Comparison for T1 / T3**: every other half-month of the same calendar year (1st and 15th of each month, January to
  December), each a hold of the same N trading days starting at the first trading day on or after that date, built as above.
  A comparison window that would share a trading day with the claimed window is left out (in practice the 1 December one
  in most years), and one that is not complete in the data is left out.
- **Claimed window T2**: the first 10 trading days of January (long USD).
  **Comparison for T2**: the first 10 trading days of each other month of the same calendar year (February to December),
  long USD, complete windows only.
- A year counts for a test only when its claimed window is complete for at least one pair.

## The yearly observation
excess(y) = basket return of the claimed window in year y minus the mean basket return of that year's comparison windows. Each
year is ONE observation.

## Tests (three, one-sided in the claimed direction, Holm over the three in the decisive window)
- **T1**: short USD basket, second half of December, excess > 0.
- **T2**: long USD basket, first 10 trading days of January, excess > 0.
- **T3**: T1 on EUR/USD alone (long EUR/USD).

Statistic: mean excess over the window's years, one-sample t on the yearly excesses (df = years - 1), one-sided p from Student
t. Reported beside it: the sign count (years with excess > 0), the claimed window's own mean return, and the year-by-year table.

## Windows of years
- **Decisive: 2010 to now** (T1 / T3 December 2010 to December 2025: 16 years; T2 January 2010 to January 2026: 17 years).
- **Replication: everything the data covers before 2010**: T1 / T3 December 2005 to 2009 (5 years; December 2005 is the first
  with 20 candles before it after 1 Jan 2005); T2 January 2006 to 2009 (4 years; January 2005 has no 20 candles before it).

## Placebo (each test, decisive window)
1,000 random windows, seeded (mulberry32, seed 20261114): a random start date (month uniform 1-12, day uniform 1-28; for T1 /
T3 a December start is drawn on days 1-15 only), the same window each year: N trading days (T1 / T3: that year's claimed N per
pair; T2: 10) from the first trading day on or after that date, same side, same position rules. A random window's statistic =
mean over the decisive years of (its basket return - that year's comparison mean used by the claimed test). Placebo share = the
share of random windows whose statistic is at least the claimed window's (ties count against).

## Cost check
Each test is computed again at 2x costs and 2x financing. A test passes only if its decisive mean excess stays > 0 at 2x.

## Pass bar (per test)
1. Mean excess > 0 in the decisive AND the replication window.
2. Decisive Holm-adjusted p < 0.05.
3. Placebo share < 5 %.
4. The 2x cost check above.

**Verdict:** PASS if every test passes; PARTIAL if at least one but not all (named); FAIL if none.

## Power, said before the run
The decisive window has about 16 yearly observations. A seasonal of a fraction of a percent against yearly noise of about the
same size cannot reach a one-sided t of about 2.2 (Holm) unless it is large and very regular: a FAIL here is weak evidence
against the claim, not proof that it is absent. Whatever the verdict, nothing in the council changes.
