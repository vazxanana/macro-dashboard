# Gotobi: USD/JPY into the Tokyo fix on settlement days, and the fade after it (pre-registration)

Written and pushed on 14 Nov 2026 before any trade of this rule was computed. Nothing below may change after the first result;
anything found later is reported as found later, never folded into the verdict.

## The idea (a published effect, not one found here)

Japanese companies settle on "gotobi" days: the 5th, 10th, 15th, 20th, 25th and the last business day of the month. Importers
buy dollars for settlement into the 09:55 Tokyo fixing, so USD/JPY is said to rise from the Tokyo morning into the fix and give
some of it back afterwards. This study asks whether that held, after costs, on OANDA prices, as two mechanical trades with a stop.

## Calendar

- **Tokyo business day**: a weekday that is not a Tokyo Stock Exchange closed day. The calendar is copied (not imported) from
  the `turnaround-replicate` branch (`research/edge/turnaround-replicate/run.mjs`, `jpHolidays` / `tseHolidays`): 1, 2, 3 Jan
  and 31 Dec; Japan's national holidays (1 Jan, Coming of Age Day = second Monday of January, 11 Feb, the Emperor's Birthday
  23 Dec to 2018 and 23 Feb from 2020, the vernal and autumnal equinoxes by the standard formula, 29 Apr, 3, 4, 5 May, Marine
  Day = third Monday of July (23 Jul 2020, 22 Jul 2021), Mountain Day 11 Aug from 2016 (10 Aug 2020, 8 Aug 2021), Respect for
  the Aged Day = third Monday of September, Sports Day = second Monday of October (24 Jul 2020, 23 Jul 2021), 3 Nov, 23 Nov,
  and 1 May and 22 Oct 2019); a holiday on a Sunday moves to the next day that is not a holiday; a weekday between two
  holidays is a holiday. The banks' settlement calendar is the same set of days.
- **Gotobi day**: for every calendar month, each of the 5th, 10th, 15th, 20th and 25th, rolled back to the nearest earlier Tokyo
  business day when it is not one (a weekend or a holiday); plus the last Tokyo business day of the month. The union, each date
  once. The roll is literal: a 5 January whose earlier days are all closed rolls into December (it then coincides with
  December's last business day and counts once).

## Times (UTC; Japan has no daylight saving)

- **Long leg**: buy at 07:00 Tokyo = **22:00 UTC on the calendar day before the gotobi day**; sell at 09:55 Tokyo = **00:55 UTC
  on the gotobi day**.
- **Rollover**: when New York is on standard time, 22:00 UTC is 17:00 New York, the daily rollover, where OANDA's candles have a
  gap and the spread is widest. On those days (decided with `Intl` for America/New_York at that 22:00 UTC) the long entry is at
  **22:05 UTC**. On New York summer time the rollover is 21:00 UTC and the entry stays 22:00 UTC. No position is held across a
  rollover after its entry, so no financing is charged.
- **Fade leg**: sell at 09:55 Tokyo = **00:55 UTC** on the gotobi day; buy back at 15:00 Tokyo = **06:00 UTC**.
- **Price at a time X** = the open of the M5 candle that starts at X. A trade whose entry candle is missing is not taken. An exit
  whose candle is missing uses the close of the last candle before X if that candle started 15 minutes or less before X; else
  the day has no trade ("no data", counted).

## The trade

- **Stop**: D = 1.5 x the median, over the 20 Tokyo business days strictly before the trade's day (every business day, gotobi
  or not), of the absolute move of the SAME leg's window (exit price minus entry price, same times and rollover rule on that
  day). At least 15 of those 20 days must have both prices, else no trade. Long: stop = entry - D. Fade (a sell): stop =
  entry + D. Every trade has its stop.
- **Management**: M5 candles from the entry candle through the last candle that starts before the exit time. A long is stopped
  when a candle's low reaches the stop (a sell: its high): filled at the stop, or at that candle's open when the open is already
  past it (a gap). No target. Otherwise out at the exit price.
- **R** = side x (exit - entry) / D.
- **Costs** (prices are OANDA mid, so a round trip pays one spread): the measured raw-spread model of CLAUDE.md "Forex
  spreads": 0.3 pip spread a round trip plus a commission of USD 22.5 per million of USD notional a side, plus 0.5 pip of
  slippage a side. For a pair quoted in yen the commission a side is 22.5e-6 x the pair's price per unit (USD/JPY: notional in
  USD = units; EUR/JPY: notional = units x EUR/USD, and EUR/USD x USD/JPY = EUR/JPY). A pip is 0.01. Cost in price =
  0.003 + 2 x 0.005 + 2 x 22.5e-6 x entry; net R = R - cost / D. The same 0.3 pip spread is used for EUR/JPY (stated, not
  measured for that pair).

## Data

OANDA mid M5 candles of USD/JPY and EUR/JPY through the site's keyless candle proxy (`fetch.mjs`: a cache from November 2015
plus pages of 4,999 candles back to November 2009), kept outside git.

## Windows

- **Decisive**: 2016-01-01 to the last complete candle on file (November 2026).
- **Replication**: 2010-01-01 to 2015-12-31.

## Tests and the pass bar

Four tests: T1 long USD/JPY, T2 fade USD/JPY, T3 long EUR/JPY, T4 fade EUR/JPY. A test PASSES only if all of these hold:

1. Decisive window: net R a trade > 0.
2. Decisive window: t >= 2 on calendar-month sums of net R (months with at least one trade; t = mean / (sd / sqrt n)).
3. Replication window: net R a trade > 0 (same sign).
4. Holm over the four tests at a family-wise 0.05, on the one-sided p of the month-sum t of the decisive window (normal
   approximation).
5. Placebo: 40 seeds (1-40, a seeded mulberry32). Each draws, without replacement, as many days as the test has decisive-window
   trades from the decisive window's Tokyo business days that are NOT gotobi days and on which the same leg can be computed,
   runs the identical leg (times, stop, costs), and records its net R a trade. The test's net R a trade must be above the 95th
   percentile of the 40 = the 38th of the 40 sorted from lowest.

**Verdict**: PASS if at least one test passes all five; it names which. FAIL otherwise. Either way the report gives n, net R a
trade, gross R a trade and month-sum t for each test and window, the placebo distribution, the stop-out share and the share of
days lost to missing data. A PASS would be written up as a proposal for the owner, never as a live rule.
