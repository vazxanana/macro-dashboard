# Pre-registration: the month-end index-extension effect in US Treasuries (14 Nov 2026)

Written and pushed before any number of this study is computed. Research only: no rule, size, filter, stop, config or council
member changes. Not an ICT study, not mixed with any council system.

## Why
The claim (practitioner and academic literature on month-end Treasury returns): bond index funds and benchmarked managers
rebalance at month-end to match the index's longer duration after newly issued bonds enter it ("index extension"), so the
demand for long-dated Treasuries rises over the last few trading days of the month and long yields tend to fall (prices
rise). Sources, cited from memory and NOT opened from the build sandbox (publisher and SSRN hosts are not reachable): Hartley
and Schwarz, "Predictable End-of-Month Treasury Returns" (working paper, about 2019), which reports positive Treasury returns
concentrated in the last days of the month and links them to index rebalancing; dealer research notes on the Bloomberg US
Treasury index's monthly duration extension (published monthly by several banks, not read here). Nothing in this study relies
on a figure from those sources; it only tests the direction of the claim on the CFDs the desk can reach.

Related, and not overlapping: `research/edge/turn-of-month` (13 Nov 2026, branch `turn-of-month`) tested the equity
turn-of-the-month window on US index CFDs (FAIL, 0 of 3); `research/edge/rebalance-flow` (branch `rebalance-flow`) tested the
month-end stock/bond rebalancing flow traded on equity index CFDs (FAIL, 0 of 4). Both traded EQUITY indices. This study
trades BOND CFDs, long only, on the index-extension story.

## Data
- OANDA mid daily CFD candles from council-data `research/daily/<key>.json` (complete UTC daily candles; read with
  `git show origin/council-data:research/daily/<key>.json`, no network; `run.mjs fetch <dir>` writes them outside git).
- Judged: `usb10y` (USB10Y_USD, the 10-year note) for T1, `usb30y` (USB30Y_USD, the 30-year bond) for T2.
- Cross-checks, reported and NOT judged: `usb05y`, `usb02y`, `de10yb` (Bund), `uk10yb` (Gilt). All six are in
  `research/daily/_index.json` with status ok (first candles March to June 2003, last 6 Nov 2026).
- The close of a day = the close of the OANDA daily candle of that UTC date (00:00 UTC of the next day, 19:00 / 20:00 New York,
  after the cash Treasury session). Stated limit: the published effect is measured on cash or futures closes in New York.

## Trading days
- **US trading day** = a weekday that is not a US bond-market full holiday. Holidays: the dates of `council/datacheck.mjs`
  `usHolidays(y)` (read only, imported) taken in their own calendar year, EXCEPT its two half days (the day after Thanksgiving,
  24 December), which are trading days, and Juneteenth before 2022 (not a holiday then); PLUS Columbus Day (2nd Monday of
  October) and Veterans Day (11 November, observed) (bond-market holidays), PLUS the NYSE special closures 11 June 2004,
  2 January 2007, 29 and 30 October 2012, 5 December 2018, 9 January 2025. New Year's Day on a Saturday is not observed on the
  Friday before (that Friday is a trading day).
- For `de10yb` and `uk10yb` (cross-checks): a trading day = a weekday with a candle in the file (no local holiday calendar).
- Trading days are numbered from the end of each calendar month: TD-1 is the month's last trading day, TD-4 the fourth to last.
- A trading day's bar folds in every candle after the previous trading day (weekend and holiday candles): open = the first
  folded candle's open, high / low over all, close = the trading day's own candle's close. A trading day with no candle of its
  own has no close; a trade that needs it is skipped and counted.

## The rule
- **T1**: buy `usb10y` at the close of TD-4 of every month; sell at the close of TD-1 of the same month (three trading-day
  returns: TD-3, TD-2, TD-1). Long only; one trade a month; trades never overlap.
- **T2**: the same on `usb30y`.
- **Stop (absolute rule 1)**: entry minus 2 x ATR(20), ATR = simple mean of the true range of the 20 trading-day bars ending
  with the entry day (all complete at the entry close). Checked on every daily candle after the entry candle up to the exit
  candle (folded candles included): a candle opening at or below the stop fills at its open, else a low at or below it fills
  at the stop. Every trade has a stop.
- **R** = (exit - entry) / (entry - stop). Gross R before costs.
- **Costs**, a round trip as a share of the entry price (no measured spread exists for these CFDs; fixed here):
  usb02y 0.02 %, usb05y 0.03 %, usb10y 0.03 %, usb30y 0.05 %, de10yb 0.03 %, uk10yb 0.04 %.
- **Financing**: charged 3 % a year of the entry price on the long, per calendar night from the entry date to the exit date
  (conservative: a bond CFD long may earn or pay; it is always charged here).
- Net R = gross R - (cost + financing) x entry / (entry - stop). Reported at 0 x, 1 x (base) and 2 x costs and financing.

## Contract rolls
Bond CFDs track futures that roll quarterly; the US note and bond futures roll before first notice day, the last business day
of February, May, August and November, i.e. inside this window. Treatment fixed now:
- The main result uses the candles as they are (no adjustment).
- **Gap check**: any candle whose open differs from the previous candle's close by more than 1 x ATR(20) is listed (date,
  market, size in ATR) in result.json.
- **Robustness row (reported, not judged)**: the same tests with every trade removed that (a) was entered in February, May,
  August or November (US markets), or (b) has a listed gap candle inside its window (all markets).

## Windows
- **Decisive**: trades entered January 2016 to the last complete month on file (October 2026), about 130 trades.
- **Replication**: trades entered from the first month with 20 bars of history (2003) to December 2015.

## Tests (T1, T2)
A test passes when ALL hold:
1. mean net R a trade > 0 in the decisive window AND in the replication window;
2. decisive one-sample t on per-trade net R >= 2;
3. Holm at 5 % over T1 and T2 of the one-sided p of the decisive t (normal approximation): adjusted p < 0.05;
4. **random-day placebo**: 40 seeds (1 to 40). For each seed and each calendar year of the decisive window, draw as many
   trades as the rule took that year, each entered at the close of a US trading day drawn uniformly (with replacement) from
   that year's trading days, held three trading days, same stop, costs and financing. The rule's decisive mean net R must be
   above the 95th percentile of the 40 seed means.

**Day-of-month profile (reported, not a gate)**: the same three-trading-day hold entered at TD-k for k = 1 to 18 (k = 1 to 3
exit in the next month), every month of the decisive window: mean net R, n and t for each k, and the rank of the real
window (k = 4) among the 18.

Also reported, not judged: per-year net R, the replication window's t, stops hit, the cross-check markets, the roll
robustness row, cost sensitivity.

**Verdict PASS** when T1 or T2 passes (the count is stated). A FAIL is a result. Only this rule is run: no other entry day,
hold, stop, cost or market is tried and reported as a finding.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict first), `tests/bond-month-end.test.mjs`. A proposal (paper shadow only, never a
live change) only if the verdict is PASS.
