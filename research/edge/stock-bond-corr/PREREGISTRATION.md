# Pre-registration: the stock-bond correlation regime as a timing filter for an index long (14 Nov 2026)

Written and committed alone, before any correlation, return or statistic of this study was computed. Paper research only: a
stand-alone long / flat allocation rule on monthly closes. It is not a gate, exit, entry or size of the live gold book (owner
decision 44 is untouched), and nothing live changes whatever the result.

## Hypothesis

When the rolling correlation of daily equity and Treasury returns turns positive, bonds stop hedging equities and equity
drawdowns deepen (2022 is the example; the inflation-regime literature, for example Brixton, Brooks, Hecht et al. 2023,
"A Changing Stock-Bond Correlation", cited from memory and not opened). Claim tested: an equity index long held only while
that correlation is negative has a better risk-adjusted return than always long, mainly through a smaller drawdown at a
similar return. The primary statistic is therefore a Sharpe ratio difference, with the drawdown ratio as the secondary.

Dedupe: no earlier study conditions an index long on the stock-bond correlation. Read: `regime`, `regime-switch`,
`macro-vol` (main), `vol-managed-index` (index exposure by own volatility, FAIL), `sma10-timing` (10-month average timing,
FAIL), `risk-cross` (yen crosses gated by the S&P trend, FAIL), `yield-fx-weekly` (2-year yield leading the dollar, FAIL),
`bond-lead-intraday` (10-year M15 move leading gold and USD/JPY, FAIL); the untested backlog has no such item.

## Data (fixed before any result)

- council-data `research/daily/<key>.json` (OANDA mid daily candles, UTC days), read with `git show origin/council-data:…`,
  no network. Markets, named now: **spx500 (primary, T1), nas100 (T2), us30 (T3)**; bond: **usb10y** (the 10-year Treasury
  note CFD, a PRICE: a positive price correlation means stocks and bond prices move together, i.e. the hedge is gone).
- Weekday closes only (Saturday / Sunday candles dropped). Each index is joined to usb10y on the dates both have a close;
  every return below is close to close over consecutive joined dates.
- Financing rate: FRED `DGS2` from council-data `macro/cache.json` (`score.fred.DGS2`), the value dated strictly before the
  day, floored at 0, plus a 2.5 % markup (the `vol-managed-index` assumption); 4 % before the cache's first value.

## Rule

- At each month end (the last joined date of a calendar month) compute the Pearson correlation of the last 60 joined daily
  returns of the index and of usb10y, ending on that date (data at or before the month-end close only).
- Correlation **below 0**: hold the index long from that close to the next month end's close. Otherwise flat (cash, 0 %).
- Benchmark: always long over the same months.
- A month's return is attributed to the calendar month in which it ends.

## Costs

- Index CFD spread: 0.04 % round trip, charged as 0.02 % of notional at each entry and at each exit of the rule (a switch);
  the benchmark pays one entry at the start of each window. Neither pays an exit at the window's end.
- Financing while long: calendar days held x (DGS2 + 2.5 %) / 365 (calendar days stand for the broker's nightly charge with
  the Wednesday triple). Flat months earn nothing.
- 2x costs: both the spread and the financing doubled.

## Windows

- In sample: every month with a full 60-day signal, through December 2016.
- Out of sample (decisive): January 2017 to October 2026 (118 months).

## Tests and statistics

- T1 spx500, T2 nas100, T3 us30. Statistic: monthly Sharpe ratio (mean / sd x sqrt 12, net) of the rule minus that of
  always long, in the out-of-sample window.
- t = the observed difference divided by the standard deviation of the difference over a paired circular block bootstrap of
  months (12-month blocks, 10,000 draws, seed 20261114). One-sided p from the normal; Holm over the three tests.
- **Pass (per test):** out-of-sample net t >= 2 and Holm-adjusted p < 0.05; the in-sample difference also positive; the
  out-of-sample difference still positive at 2x costs. **The study passes only if T1 passes.**
- Secondary (reported, not a pass condition): maximum drawdown of the monthly net equity curve, rule / always long; annual
  return; months invested; the number of switches and of separate in / out spells (correlation regimes are persistent, so
  few independent switches are expected and the bootstrap t may overstate the evidence; the number is reported beside it);
  gross results; a paired t on the monthly differences (rule minus long), labelled descriptive.
- Placebo: per market, 40 seeded random in / out masks over the out-of-sample months with the same number of invested months
  as the rule, costed the same way; report the placebo Sharpe differences and how many reach the real one.

## What would not change the verdict

No other lookback, threshold, bond (2-year, 30-year, Bund) or market is run for the verdict. Anything shown beyond the above
is labelled post hoc.
