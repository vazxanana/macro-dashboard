# Energy seasonal windows: crude "driving season" and natural gas "winter build" / "spring weakness"

Pre-registration, written and pushed on 14 Nov 2026 before any trade of this study was computed. Research only: nothing
live reads it, no rule, size, filter, stop or config changes, paper only.

## Question

Published commodity seasonals say crude oil rises from mid-February into the US driving season, natural gas rises in
September-October as storage fills before winter, and natural gas weakens in February-March as winter demand fades. Do
these calendar windows, traded as fixed rules on the broker-style CFD price with a protective stop, make money net of
costs on years they were not fitted on?

Not repeated here: the WTI weekly inventory report study (#858), and the Gold trend rule on WTI and Brent
(`research/edge/trend-breadth-h1`). This study has no signal other than the calendar.

## Data

council-data daily candles, read with `git show origin/council-data:research/daily/<key>.json`, no network:
`wtico` (OANDA `WTICO_USD`), `bco` (`BCO_USD`), `natgas` (`NATGAS_USD`): OANDA mid, complete UTC days, `[t, o, h, l, c, v]`.
Files as of the cache's 7 Nov 2026 refresh (last candle 6 Nov 2026). Weekend stubs are folded into the next weekday with
`council/fills.mjs` `foldWeekend` (imported, not copied). The candle time is 00:00 UTC of the day.

The price series is used as it is. OANDA's commodity CFDs follow a futures contract; any step at a contract switch is in
the candles and in the result, and no roll credit or charge is applied. This is an assumption, stated, not checked
(the broker's roll handling for these CFDs is not in the repository).

## Trading days

A **trading day** is a weekday candle of the folded series whose volume is at least 25 % of the median volume of the 20
weekday candles before it. This drops thin holiday stubs (Christmas, New Year, Presidents' Day in some years) as entry or
exit days. Market closures with no candle (Good Friday) are simply not trading days. Thin candles still count as prices
for the stop check.

## The four tests

For each calendar year Y (entry date in Y):

| test | market | side | entry: open of | exit: close of |
|---|---|---|---|---|
| T1 crude driving season | `wtico` | long | first trading day on or after 15 Feb | last trading day on or before 30 Apr |
| T2 the same on Brent | `bco` | long | first trading day on or after 15 Feb | last trading day on or before 30 Apr |
| T3 natural gas winter build | `natgas` | long | first trading day on or after 1 Sep | last trading day on or before 31 Oct |
| T4 natural gas spring weakness | `natgas` | short | first trading day on or after 1 Feb | last trading day on or before 31 Mar |

A year counts only when the file holds a candle dated after the window's nominal end (so its last trading day is known)
and at least 21 trading days before the entry day (for the ATR). One trade per test per year at most.

## Stop (every trade has one)

ATR(20) = the simple mean of the true range over the 20 trading days before the entry day (true range of a day = max of
high − low, |high − previous trading day's close|, |low − previous trading day's close|). **Stop = entry − 3 × ATR(20)
for a long, entry + 3 × ATR(20) for a short**, fixed for the life of the trade (never moved). 1R = 3 × ATR(20).

From the entry day to the exit day, every candle of the folded series (thin ones included) in order:
- if the candle OPENS beyond the stop (a gap), the trade exits at that open;
- else if its low (long) / high (short) reaches the stop, the trade exits at the stop;
- on the entry day the open is the entry, so only the intraday check applies.
If never stopped, the trade exits at the close of the exit day. A stopped trade stays flat for the rest of that year's
window (no re-entry).

## Costs

- **Spread, round trip, in price units** (charged once per trade, ÷ 1R): WTI 0.03, Brent 0.03, natural gas 0.005. The
  demo broker's `ctrader/symbols.json` (council-data) lists no energy symbol (its markets are gold, five forex pairs,
  four index CFDs and crypto), so these are assumptions, not broker figures.
- **Financing per night** (`council/fills.mjs` `nights`: Monday-Friday 22:00 UTC rollovers strictly inside the hold,
  Wednesday counts three; the entry stamp is the entry candle's time 00:00 UTC, the exit stamp is the exit candle's time +
  21 h, before that day's rollover, for a close and for a stop alike): annual rate ÷ 365 × entry price × nights ÷ 1R.
  Long: FRED `DGS2` (2-year Treasury, from council-data `macro/cache.json` `score.fred.DGS2`, the latest weekly value
  dated on or before the entry day) + 2.5 % a year. Short: max(0, 2.5 % − DGS2). This is the index CFDs' cash-rate
  convention. Commodity CFDs are often priced off the futures curve instead, with the carry in the price and little or
  no cash financing; under that convention the right figure is the "before financing" column. Both are reported; **the
  verdict is read with financing**.
- Net R = gross R − spread ÷ 1R − financing ÷ 1R. Gross R = (exit − entry) ÷ 1R for a long, (entry − exit) ÷ 1R for a short.

## Windows

- **Decisive: entry years 2016 → 2026** (11 years; the 2026 natural gas autumn window is complete because the file
  reaches 6 Nov 2026, past 31 Oct; a window that is not complete is dropped and said).
- **Replication: entry years 2008 → 2015** (8 years, all held by OANDA's files, which start in 2003).

## Statistic and pass bar

Per test, the sample is one net R per year. t = mean ÷ sd × √n over those years; one-sided p from Student's t with n − 1
degrees of freedom; Holm-corrected over the four tests.

**A test PASSES only if all hold:**
1. decisive mean net R a trade > 0 and its Holm-corrected one-sided p < 0.05;
2. at least 7 of the 11 decisive years positive (net);
3. replication mean net R a trade > 0 (the same sign);
4. the decisive mean net R beats the 95th percentile of the placebo (below), strictly.

**Overall verdict:** PASS if at least one test passes (named, with n and t); otherwise FAIL.

**Placebo** (40 seeds per test): a window of the same calendar length starting on a random date of the year, same market,
same side, same stop, costs and financing, same years. Nominal length L (non-leap reference): T1 15 Feb → 30 Apr =
74 days, T3 1 Sep → 31 Oct = 60 days, T4 1 Feb → 31 Mar = 58 days. Seed k = 1..40 for test j = 1..4 draws, with
mulberry32(1000 × j + k), one day offset u in 0..364 from 1 Jan; in each year Y the window is entry = first trading day on
or after 1 Jan Y + u days, exit = last trading day on or before that date + L days (it may run into Y + 1). Its statistic
is the mean net R a trade over the decisive years that are complete. The 95th percentile of 40 values is the 38th
smallest (index 37 of the sorted list).

**Said in advance:** with about 11 trades a test, only a very large effect can pass; a FAIL here does not show the
seasonals are absent, only that this sample cannot tell them from noise.

## Reported, never part of the verdict

Gross and before-financing columns, each year's trade (entry, exit, stop, how it ended), win rate, worst year, the
replication t, the placebo distribution (median, 95th percentile, the test's rank).

## What a result may be used for

A FAIL: no seasonal energy stream is proposed. A PASS: a proposal under `research/proposals/` for a paper shadow only,
for the owner; nothing live changes from this study.
