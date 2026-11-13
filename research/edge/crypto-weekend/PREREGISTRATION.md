# Pre-registration: the weekend vs weekday split in Bitcoin and Ether (13 Nov 2026)

Written and committed before any weekend or Monday figure of these candles was computed. Paper research only: no live rule,
size, filter, stop, config or council member changes, whatever the result.

## Why

Published work (Caporale and Plastun 2019, "The day of the week effect in the cryptocurrency market"; later papers on crypto
weekend and Monday effects) reports day-of-week anomalies in Bitcoin and other coins. This asks the simplest pre-stated pair:
does holding over the weekend pay, and does selling Monday pay, on a later stretch of data, after the demo broker's costs and
financing, with a stop on every trade. It is not the council's crypto trend rule, the engine setups, the weekly momentum study
(`research/edge/crypto-weekly-mom`, FAIL) or the hour-of-day study (`research/edge/crypto-hour`, FAIL) of the same day.

## Data (what is on file; exchange APIs are refused from the build sandbox)

- **Intraday**: council-data `research/candles/crypto5m/BTCUSDT_5m.json.gz` and `ETHUSDT_5m.json.gz`, Binance spot 5-minute
  candles `[time, open, high, low, close]`, **2022-01-01 00:00 UTC to 2026-10-31 23:55 UTC**, read with
  `git show origin/council-data:…`, no network. No hourly or finer crypto candles before 2022 exist in the repository or
  council-data.
- **Daily**: council-data `research/candles/crypto1d/BTCUSDT_1d.json.gz` and `ETHUSDT_1d.json.gz`, Binance spot UTC days from
  **2017-08-17**. A daily candle cannot place a Friday 21:00 entry, a Sunday 23:00 exit or a stop inside the hold, so it is used
  only for a descriptive context check (below), never for the pass.

Windows, fixed now:
- **Discovery (the rule run exactly as below): 2022-01-01 to 2023-12-31** (the longest intraday history before 2024).
- **Decisive: 2024-01-01 to the data end (2026-10-31).**
- **Context, descriptive only: 2017-08-17 to 2021-12-31 on daily candles.**

H1 candles are built from the 5-minute candles (UTC hours; an hour counts only when all twelve 5-minute candles are on file).
A trade belongs to the window of its entry.

## The rules (fixed; no parameter is chosen from data)

- **Rule W (long the weekend)**: buy at the open of the Friday 21:00 UTC 5-minute candle; out at Sunday 23:00 UTC (the close
  of the Sunday 22:55 candle) unless stopped first. Hold 50 hours.
- **Rule M (short Monday)**: sell at the open of the Monday 00:00 UTC candle; out at the close of the Monday 23:55 UTC candle
  (Tuesday 00:00) unless stopped first. Hold 24 hours.
- **Stop (every trade has one):** 2 x ATR(24) on H1: the simple mean of the true range of the 24 complete H1 candles that
  closed before the entry (true range uses the previous H1 close; the 25 hours before entry must all be complete, else no
  trade that week). Long stop = entry - 2 ATR, short stop = entry + 2 ATR. Checked on the 5-minute candles of the hold in
  order: a candle that reaches the stop exits at the stop, or at its open when it opened beyond the stop.
- **Data holes:** a trade is taken only when its entry candle and its last (exit) candle are on file and at least 95 % of the
  hold's 5-minute candles are; otherwise no trade that week (counted and reported).
- **R** = side x (exit - entry) / (2 ATR), net of costs and financing. 1R = the stop distance.
- **Costs:** `CFD_CRYPTO` (council/fills.mjs, 0.04 % of the entry price a round trip) on every trade.
- **Financing:** the demo broker's crypto CFD swap (council-data `ctrader/symbols.json` of 13 Nov 2026, cTrader swap type 1 =
  percent a year): BTCUSD long 15 %, short 7.5 %; ETHUSD long 15 %, short 10 %; `rollover3Days` 5 = Friday counts three. The
  broker's crypto day ends at 17:00 New York every day of the week (its schedule shows the 16:59-17:02 break on all seven days).
  A trade pays rate / 365 x entry price x nights, nights = the 17:00 New York instants in (entry time, exit time], each 1,
  a Friday's 3 (the same function as `research/edge/crypto-hour`). So rule W pays Saturday + Sunday (2 nights) while New York
  is on summer time (Friday 17:00 New York = 21:00 UTC, the entry instant, not inside the hold) and Friday x3 + Saturday +
  Sunday (5 nights) in winter (22:00 UTC); rule M pays Monday's one night. Whether the broker also charges Saturday and Sunday
  when Friday counts three is not stated by the file; this charges both (the costlier reading). Today's rates for every year.

## Tests and the pass

Four tests: {W, M} x {BTC, ETH}, decisive window. For each: n trades, net R a trade, trade t = mean / (sd / sqrt n) of the
trades' net R (one trade a week, so trades do not overlap), and the month-sum t (reported). One-sided p from the trade t
(normal); Holm over the four. A test passes when **all** hold:
1. n >= 100 in the decisive window;
2. net R a trade > 0 in the decisive window;
3. trade t >= 2 and Holm-adjusted p < 0.05;
4. net R a trade > 0 in the discovery window too (same sign).

**Verdict: PASS if at least one of the four passes; FAIL otherwise.**

## Placebo (reported; a passing test is also expected to beat at least 36 of 40 seeds, said beside the verdict)

40 fixed seeds (1-40). Per seed and per rule, one start is drawn (uniform) and used every week of the decisive window with the
same side, hold, stop, costs and financing:
- for W (long, 50 h): a start day Monday-Wednesday and a start hour 0-23 UTC (so the hold ends before Saturday);
- for M (short, 24 h): a start day Tuesday-Friday and a start hour 0-23 UTC.

Reported per coin: each seed's net R a trade, and how many seeds the real rule beats.

## Reported, never part of the pass

- Gross R (before costs and financing), cost R, financing R, stops hit, per year, dropped weeks.
- Financing sensitivity: net R with a Friday counted as one night.
- Context 2017-08-17 to 2021-12-31 (daily candles, no stop, no cost): mean % return of Saturday + Sunday (Saturday open to
  Sunday close) and of Monday (open to close), with t, per coin; and the same on 2022-23 and 2024-26 for comparison.

A PASS would lead only to a proposal of a paper shadow (owner's decision). A FAIL changes nothing.
