# Overnight drift on US index CFDs: pre-registration

Written and committed on 14 Nov 2026, before any trade of this study was simulated and before any candle of the two
markets was read for this study. Paper research only: no live rule, size, filter, council member, page or mirror setting
is changed by this study, whatever it finds.

## Why

A well-known published finding on US equities ("overnight drift", "the night effect"): most of the index's long-run gain
came between the cash close and the next cash open, and little or none during the cash session. The question here is
narrow: **does holding a long US index CFD from the 16:00 New York cash close to the next 09:30 New York cash open make
money after the CFD's spread and overnight financing, with a stop on every trade?** A CFD long pays financing every night
it is held, so a gain that is real on the cash index can be eaten by the cost of carrying it.

What I already know, said plainly.
- The published result is on cash index or futures returns, mostly before 2016, without a stop and without CFD financing.
  Several later papers report the effect weakening or reversing in some years. I expect a small gross gain and doubt it
  survives financing; the test is run because the brief asks for it, not because I expect a pass.
- US indices rose strongly in 2016-26, so any long stream that holds the index for part of the day may look profitable.
  This is why a placebo (random windows of the day, below) and the opposite leg (T3, the cash session) are reported.
- Earlier index studies here (ICT, NQ open run, open-run breadth) traded the 09:30 open with other rules; none tested this
  hold. I have not computed any overnight or intraday return of these markets before writing this file.

## Data

- OANDA mid **M30** candles of `SPX500_USD` (US500) and `NAS100_USD` (NAS100), UTC, through the site's keyless candle proxy
  (`/md/bars?sym=spx500|nas100&tf=30m`), 1 January 2005 to 31 October 2026, fetched in windows of at most 4,999 candles,
  complete candles only, kept out of git (`node --use-env-proxy run.mjs fetch <dir>`). A probe of the first window
  (January 2005) was made only to see that M30 history starts there.
- **Why M30, not H1**: the brief asks for an exit at the 09:30 New York open and stop checks on H1 candles. OANDA H1
  candles are on the UTC hour, so 09:30 New York is never a candle boundary on H1. M30 candles have a boundary at 16:00
  and at 09:30 New York in both summer and winter time, and checking the stop on them is finer than on H1 (never coarser).
- **Daily candles for the ATR** are built from the same M30 file: a trading day is the CFD's own day, from 17:00 New York
  to 17:00 New York (its daily halt), named by the New York date it ends on; a day with no candle is no day. No Sunday
  stub exists on this definition (Sunday evening's candles belong to Monday's day).

## New York time

All session times are New York local time, converted to UTC with the US daylight-saving rules of each date (the platform's
own `America/New_York` zone: 2005-06 first Sunday of April to last Sunday of October, from 2007 second Sunday of March to
first Sunday of November). 16:00 New York is 21:00 UTC in winter and 20:00 UTC in summer; 09:30 is 14:30 or 13:30 UTC.

**Cash trading days**: Monday to Friday except NYSE full holidays, computed by rule: New Year's Day (observed; a Saturday
1 January gives no holiday), Martin Luther King Day, Presidents' Day, Good Friday, Memorial Day, Juneteenth (from 2022,
observed), Independence Day (observed), Labor Day, Thanksgiving, Christmas (observed); plus the special closures
2007-01-02, 2012-10-29, 2012-10-30, 2018-12-05, 2025-01-09. **Early closes** at 13:00 New York use **13:00 as that day's close**. Early-close
rule, fixed: the day after Thanksgiving; 24 December when it is a cash trading day; 3 July
when it is a cash trading day and 4 July is a cash-day weekday (Tuesday to Friday). This is a scheduled rule, not checked
date by date against the exchange's notices; a year it misses changes one trade.

## The rules (fixed; no parameter is tuned)

Constants: `ATR_N = 20` daily candles, `STOP_ATR = 1.0`, `COST = 0.0003` of the entry price a round trip,
`FIN_ADD = 2.5` % a year.

- **T1, US500 overnight.** On every cash trading day D: entry at the cash close of D (16:00, or 13:00 on an early close) =
  the **close of the M30 candle that ends at that time**. Exit at the **open of the M30 candle starting 09:30 New York on
  the next cash trading day** after D. Long only.
- **T2, NAS100 overnight.** The same on NAS100.
- **T3, US500 cash session (control).** On every cash trading day D: entry at the open of the M30 candle starting at
  09:30 New York, exit at the close of the M30 candle ending at D's cash close. Long only. Reported; **not a pass
  candidate**, and not in the Holm set or the pooled test.

For every trade:
1. **Stop** (every trade has one, on the losing side): `entry - 1.0 x ATR20`, where ATR20 is the simple mean of the true
   range of the 20 most recent daily candles (definition above) that **ended at or before the entry time**. `r0 = entry -
   stop`. No trade without 21 such days.
2. **Stop checks** on every M30 candle after the entry candle and before the exit candle: a candle that opens at or below
   the stop exits at its open (a gap through); otherwise a candle whose low is at or below the stop exits at the stop.
   The exit candle's open is the exit whatever it is (a gap through the stop at the open exits there too). The stop never
   moves; no target.
3. **Data holes**: no trade when the entry candle or the exit candle is missing; the count of dropped days is reported.
4. **R**: `R = (exit - entry) / r0` (gross).
5. **Costs**: spread and slippage `0.0003 x entry` a round trip, the index cost of `research/edge/trend-breadth` and
   `trend-breadth-h1` (`markets.mjs` `COST.index`), in R: `0.0003 x entry / r0`. **Financing** on a long CFD, per night
   held: `(US 2Y yield + 2.5 %) / 365 x entry`, in R divided by `r0`. A night is a CFD rollover at 17:00 New York on a
   weekday that falls strictly inside the hold; a Friday rollover counts **three** nights (the weekend), every other
   weekday rollover one. So a Monday-Thursday overnight hold pays 1 night, a Friday-to-Monday hold 3, a hold over a
   weekday holiday one more per extra rollover; a T3 hold (09:30 to 16:00) crosses no rollover and pays none. US 2Y =
   FRED DGS2, weekly, copied into `rates.json` from `research/edge/gold-carry/rates.json` (council-data macro cache): the
   last value dated on or before the entry date; before its first value (6 Jan 2006) the first value is used (2005 is
   charged about one point too much a year: under 0.004R a night at these stops). Net R = R - cost - financing.
   Also reported at twice the spread cost.

## Windows

- **Decisive: 1 Jan 2016 to 31 Oct 2026** (entry date). The verdict's t is read here.
- **Replication: 1 Jan 2005 to 31 Dec 2015** (the first 20 days of 2005 are ATR warm-up). The sign must agree.

## Statistics

- **t on calendar-month sums**: net R summed by the month of entry, every month of the window with at least one trade;
  `t = mean / (sd / sqrt(months))`. One-sided p by the normal approximation.
- **Holm** over T1 and T2 (decisive window, one-sided p).
- **Pooled test**: the monthly sums of T1 and T2 added month by month (one unit each), t as above, both windows.
- **Placebo, 40 seeds** per market: for seed s, the same number of trades as the real test in that window, each on a day
  drawn uniformly from the window's cash trading days and a start drawn uniformly from the 48 M30 boundaries of that UTC
  day, held **7.5 hours** (15 M30 candles), with the same entry (the close of the candle ending at the start), the same
  stop rule, stop checks, costs and financing (rollovers inside the window charged as above). A draw whose start or end
  candle is missing is drawn again. Reported: the real test's mean net R and month-sum t against the placebo's 5th, 50th
  and 95th percentiles, per market and window. Seeded (mulberry32, seed = s + 1).

## Pass rules (fixed)

T1 or T2 **passes** when all of these hold:
1. at least 300 trades in each window;
2. mean net R > 0 with month-sum **t >= 2.0 in the decisive window**;
3. mean net R > 0 in the replication window;
4. Holm-adjusted p < 0.05 (decisive);
5. mean net R in the decisive window above the placebo's 95th percentile of mean net R for that market;
6. mean net R > 0 in the decisive window at twice the spread cost.

## Verdict (fixed here)

- **PASS**: T1 or T2 passes, and the pooled test has t >= 2.0 in the decisive window with a positive mean in both windows.
- **FAIL**: neither T1 nor T2 meets conditions 2 and 3 together.
- **INCONCLUSIVE**: anything else.

T3 is read in words beside T1: does the overnight leg make more than the cash-session leg on the same market (difference
of mean net R, Welch t on the monthly sums)? Gross figures are reported to separate the drift itself from what the CFD's
costs take.

## Reported, not tested (never a verdict)

Per test and window: n, win rate, mean R gross, mean spread cost and financing in R, mean net R, month-sum t gross and net,
total, max drawdown in R (closed), by year, by weekday of entry, stop exits, median stop distance as % of price. Trades
held over a weekend apart from the rest.

## What I had to decide (the brief leaves it open)

- M30 candles instead of H1 (above).
- The CFD's 17:00-to-17:00 New York day for the ATR, and the trading-day calendar by rule.
- Early-close days enter at 13:00.
- The rollover count (weekday 17:00 New York rollovers, Friday triple), as the brief states it ("one night, Friday holds
  three"), modelled on `council/fills.mjs` `nights` (which triples Wednesday for spot FX and gold, not indices).
- The 2.5 % add-on and the spread figure as given by the brief / earlier index studies; neither was measured on the demo
  broker for these two CFDs.
- The placebo holds 7.5 hours as the brief says; it is a random-time-of-day control, not duration-matched to the
  overnight hold (17.5 hours on a weekday, 65.5 over a weekend). Said, not changed.

## What happens next

Nothing changes live on any outcome. On PASS the proposal to the owner would be a forward paper shadow, never a live rule
before a forward record exists. A bug found after the run is fixed, said in RESULT.md, and everything is re-run.
