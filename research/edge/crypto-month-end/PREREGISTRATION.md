# Pre-registration: the turn of the month in Bitcoin (and Ether) (14 Nov 2026)

Written and committed before any figure of this study is computed. Paper research only: no live rule, size, filter, stop,
config or council member changes, whatever the result.

## Why

The turn-of-the-month effect is published for equities (Ariel 1987; Lakonishok and Smidt 1988; McConnell and Xu 2008): returns
concentrate around the month boundary, explained by month-start inflows (salaries, pension and fund contributions) and
month-end rebalancing. `research/edge/turn-of-month` tested it on US index CFDs (FAIL, 0 of 3). No study in this repository has
tested it on crypto: the crypto calendar studies so far are the weekend / Monday split (`crypto-weekend`, FAIL), weekend
reversals (`crypto-weekend-reversal`, FAIL), hour of day (`crypto-hour`, FAIL), the options expiry (`crypto-expiry`, FAIL) and
the market cycle (`crypto-cycle`, FAIL); none of them reads the month boundary (checked on every branch before writing this).
Crypto trades every calendar day, so the window is counted in calendar days.

## Data

- council-data `research/candles/crypto1d/BTCUSDT_1d.json.gz` (primary) and `ETHUSDT_1d.json.gz` (reported only): Binance spot
  UTC daily candles `[openTime, open, high, low, close]`, **2017-08-17 to 2026-10-31** (the day starting 31 Oct 2026), read
  with `git show origin/council-data:…`, no network. A day's "close" is its candle's close (= 00:00 UTC of the next day).
- Daily candles only: the stop is checked on the daily high / low (below). No intraday crypto candles exist before 2022.

## The rule (primary: BTC)

- For every calendar month M: **buy at the close of the 3rd-to-last calendar day of M** (the last day of M is the 1st-to-last;
  in a 31-day month the 29th, i.e. 00:00 UTC of the 30th), **sell at the close of the 2nd calendar day of month M+1** (00:00
  UTC of the 3rd). The position holds four daily returns: the last two days of M and the first two of M+1. (The brief that
  asked for this study spoke of a "5-day" window and "5-night" hold; the rule as written holds four days, and the placebo and
  mirror windows use that same length, so every comparison is like for like.) Long only; one event a month; events never
  overlap.
- **Stop (absolute rule 1, every trade has one):** entry - 2 x ATR(20), ATR = the simple mean true range of the 20 completed
  daily candles up to and including the entry day (true range against the previous close). An event without 21 days of
  history before it is not taken. The stop is checked on each held daily candle in order: a candle that opens at or below the
  stop exits at its open; otherwise a low at or below the stop exits at the stop. No target.
- **1R** = the stop distance (2 x ATR). Gross R = (exit - entry) / (2 ATR).
- **Costs:** `CFD_CRYPTO` (council/fills.mjs: 0.04 % of the entry price a round trip), in R = 0.0004 x entry / (2 ATR).
- **Financing:** the demo broker's crypto CFD swap as the crypto studies charge it (council-data `ctrader/symbols.json` of
  13 Nov 2026, swap type 1 = % a year): BTCUSD long 15 %, ETHUSD long 15 %; nights = the 17:00 New York instants in
  (entry, exit], a Friday's counts three (`rollover3Days` 5; the same function as `research/edge/crypto-weekend`). A four-day
  hold pays 4 nights, or 6 when a Friday 17:00 New York falls inside it (5 or so on average). Financing R = nights x rate /
  365 x entry / (2 ATR). Today's rate for every year (no rate history is known).
- **Net R** = gross R - cost R - financing R.
- An event counts when its exit candle is on file (so the last event is the one exiting before 31 Oct 2026).

## Windows

Events are ordered by entry date. **In sample** = the first floor(N/2) events, **out of sample** = the rest (N = all events
with a stop and an exit on file). The split date is printed in the result.

## Statistics

- Per window: n, mean net R an event, event t = mean / (sd / sqrt n). With one event a month, the calendar-month-sum t (net R
  summed by the entry's calendar month) is the same series; it is reported anyway. **n is small (about 50 a window).**
- **Cost levels**: 0 (no spread, no financing = gross), base (above), 2x (spread and financing both doubled).
- **Placebo**, 40 fixed seeds (1-40): for each seed and each event month M of the window, one entry is drawn uniformly at the
  close of a day d of M such that the four held days d+1 .. d+4 lie inside M and do not touch the turn window (d from 2 to
  lastDay(M) - 6; so day 3 to day lastDay-2 can be held), with the same stop, costs and financing and the same 21-day history
  requirement. Each seed gives a mean net R. The rule's rank = how many seeds' OOS mean it beats.

## Pass bar (BTC only, judged once)

**PASS** when all four hold:
1. out-of-sample event t >= 2 net of base costs;
2. in-sample mean net R (base costs) > 0;
3. out-of-sample mean net R at 2x costs > 0;
4. the out-of-sample mean beats at least 38 of the 40 placebo seeds (95 %).

Otherwise **FAIL**. One test, so no multiple-test correction for the verdict.

## Reported, never part of the pass

- ETH, the same rule, windows and figures.
- The mirror window: buy at the close of the 13th, sell at the close of the 17th (four mid-month days, 14th-17th), BTC and ETH.
- Per year, stops hit, gross / cost / financing split, the percent price return of the window without stop (descriptive).

Whatever the result, nothing live changes: a pass would only be a candidate for its own forward paper record and an owner
decision.
