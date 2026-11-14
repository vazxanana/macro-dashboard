# Pre-registration: index returns around the quarterly equity-futures roll (14 Nov 2026)

Written and pushed before any figure of this study was computed. Research only: no live rule, size, filter, stop, config or council
member changes, whatever the result.

## Question
Passive and index-arbitrage holders roll their equity-index futures from the front to the next quarterly contract in the week
before the quarterly expiry (the third Friday of March, June, September and December); most roll volume trades on the Thursday and
Friday eight days before expiry, the roll date of the CME convention. Practitioner notes report systematic index moves in that
window, and the literature on expiration days (Stoll and Whaley 1987) reports moves around the quarterly ("triple witching")
expiry itself. Does a long index CFD held over (W1) the roll window or (W2) the expiry week make money after costs, out of sample?

## Not already tested here (dedupe)
- `opex-week` (branch `opex-week`, FAIL 0 of 4): the week ending on EVERY monthly options expiry, SPX500 / NAS100, 2.5 x ATR stop.
  It names "the quarterly (triple witching) months alone" as untested. W2 here is that week restricted to the quarterly months
  (and with this study's own stop, markets and windows); W1 is not tested anywhere.
- `futures-roll` (main): the ICT desk's back-adjustment of CNBC futures candles, not a return study.
- `index-quarter-end` (FAIL): the last six trading days of the quarter, signed by the stock-bond flow; a different window.
- `turn-of-month` (FAIL): the four days around the month turn; a different window.
- The untested backlog (`untested-backlog`) lists no roll-window or quarterly-expiry study.

## Markets (fixed before any result)
- **spx500** (S&P 500 CFD, the primary market), **nas100** (Nasdaq 100), **us30** (Dow 30): the CME quarterly cycle.
- **de40** (DAX CFD): reported market for the Eurex roll (same third-Friday quarterly expiry).
- Data: OANDA mid daily candles from council-data `research/daily/<key>.json` (read with `git show`, no network; council-data
  commit `6279e8bd5`), weekend stubs folded into the next weekday with `council/fills.mjs` `foldWeekend`. A daily candle closes at
  00:00 UTC: that is this study's "close" (as `opex-week` and `turn-of-month`), not the cash index's own close.

## Calendar (one helper, `datesOf`, tested by hand-made cases)
- Quarterly expiry months: March, June, September, December. **F** = the third Friday of that month.
- Trading days: US markets use the NYSE calendar copied from `opex-week` (weekends, `ict/calendar.mjs` full closures, the NYSE
  early-close holidays it lists, and the extra closures 2007-01-02, 2012-10-29/30, 2018-12-05, 2025-01-09). de40 uses Eurex days:
  weekdays except 1 Jan, Good Friday, Easter Monday, 1 May, 24, 25, 26 and 31 Dec.
- **X** (expiry day) = F, or the last trading day before it when F is not one.
- **R** (roll day) = the Thursday 8 calendar days before F (F − 8), or the last trading day before it when it is not one.
- **W1, the roll window**: buy at the close of the 3rd trading day before R (R−3), sell at the close of the 1st trading day after
  R (R+1): four trading days held.
- **W2, the expiry window**: buy at the close of the Monday of expiry week (F − 4; the last trading day before it when it is not
  one), sell at the close of X.
- A window whose entry or exit date has no candle is skipped and counted (`noCandle`); nothing is filled in.

## Trade
Long only. Entry at the entry day's close; stop 2 x ATR(20) of the daily candles ending with the entry day (true range against
the previous close) below the entry; a candle opening through the stop fills at its open, one trading through it fills at the
stop; otherwise out at the exit day's close. R = price move / (2 x ATR(20)).

## Costs
- Spread: 0.04 % of the entry price a round trip (the index-CFD figure of the brief; `trend-breadth-h1` uses 0.03 %), in R.
- Financing per calendar night held, on the entry notional: FRED DGS2 (2-year Treasury yield, weekly, `rates.json` copied from
  `opex-week`, itself from council-data `macro/cache.json`) + 2.5 % a year, / 365, as `opex-week` and `turn-of-month`. de40 is
  charged the same rate (no euro rate on file: an approximation, stated).
- The 2x-cost check doubles both the spread and the financing.

## Samples
- In sample: expiries 2008-03 to 2016-12 (36 quarters). Out of sample: 2017-03 to 2026-09 (39 quarters; December 2026 has not
  happened). **This is thin: one trade a quarter, about 36 and 39 trades a test.** With a trade sd near 1R, t 2 out of sample
  needs about +0.32R a trade.

## Tests and statistics
Eight tests: {W1, W2} x {spx500, nas100, us30, de40}. **Primary: T1 = W1 on spx500, net.**
- t on calendar-month sums (one trade a quarter, so each month that holds a trade holds exactly that trade; months without a
  trade are not counted). One-sided p from t (normal approximation, as `opex-week`). Holm over all eight tests.
- Placebo: 40 seeds. Per seed and per out-of-sample quarter, one long trade of the same length (four trading days), same stop and
  costs, starting at a random trading day of the quarter's three calendar months (the expiry month and the two before) other than
  the rule's own entry day, with its exit inside the quarter. The rule's out-of-sample mean must beat at least 38 of the 40 seed
  means.
- Comparison (reported, not a pass condition): per quarter, the rule's net R minus the mean net R of EVERY other four-day long
  window of the same quarter (each other start day whose exit is in the quarter); mean and t of that excess over the quarters.

## Pass bar (the verdict is the primary test's)
T1 passes only if all hold: (1) out-of-sample net mean > 0 with month t >= 2 and Holm-adjusted p < 0.05; (2) in-sample net mean
> 0; (3) out-of-sample net mean > 0 at 2x costs; (4) placebo beaten in >= 38 of 40 seeds. The verdict is PASS if T1 passes, else
FAIL. A secondary test meeting the same four is reported as such and would need its own pre-registration on other data; it does
not change the verdict. Gross figures, by-year rows and stop counts are reported.

## What this does not test
The cash index or the futures at their own close (or the futures calendar spread itself), the roll window on the short side,
intraday timing, single stocks, monthly expiries (`opex-week`).
