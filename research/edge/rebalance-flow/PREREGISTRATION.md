# Pre-registration: the month-end rebalancing flow on US indices (13 Nov 2026)

Written and pushed before any trade or result of this study is computed. Research only: no rule, size, filter, stop, config or
council member changes; paper only. Not an ICT study (nothing under `ict/` is edited; `ict/calendar.mjs` is only read for its
holiday dates). Not the month-end USD fix-flow study (that one trades currencies against the London 4 pm fix); this one trades
US equity indices on the balanced-fund rebalancing story.

## Why
A published effect: balanced funds and pension plans hold fixed equity / bond weights and rebalance around month-end and
quarter-end. When stocks have beaten bonds over the month, rebalancers must sell stocks in its last days; when bonds have beaten
stocks, they must buy. Harvey, Mazzoleni and Melone ("The Unintended Consequences of Rebalancing", 2025) report that the month's
equity-minus-bond return predicts the next days' equity return with the opposite sign, strongest at quarter-ends. The question
here: does a fixed rule built on that story make money after costs and financing on the index CFDs the desk can reach, out of
sample and with every trade on a stop?

## Data (fixed now)
- Daily OANDA mid candles from the council's own daily cache, council-data `research/daily/spx500.json` (SPX500_USD),
  `nas100.json` (NAS100_USD) and `usb10y.json` (USB10Y_USD, the US 10-year Treasury note CFD price), read with
  `git show origin/council-data:...` at council-data `48fdf4f89` (cache updated 7 Nov 2026, last candle 6 Nov 2026). No
  network. `usb10y` is present, so `usb05y` is not used. The files are copied outside git and `run.mjs` reads them from a
  directory given on the command line.
- The 2-year Treasury yield, weekly, from council-data `macro/cache.json` `score.fred.DGS2` (FRED, same commit), copied once
  into `rates.json` beside this file, for financing.
- Candle `t` is the UTC midnight that starts the day; a candle's close is OANDA's 00:00 UTC close, three to four hours after the
  NYSE cash close. That close is this study's "close" of a day (stated: no cash-close candle exists in the daily cache).
- **Weekend folding**: a Saturday or Sunday candle (OANDA's Sunday reopen stub) is folded into the next weekday candle: open =
  the first weekend candle's open, high / low over all of them, close and date = the weekday's. A weekend candle with no later
  weekday candle is dropped.

## Trading-day calendar (fixed now, copied from the turn-of-month study's code, not imported)
- **NYSE trading day** = a weekday that is not an NYSE holiday. Holidays from `ict/calendar.mjs` `cmeYear` (read only): its
  full-closure days (New Year's Day, Good Friday, Christmas) and its early-close days that are NYSE holidays (Martin Luther King
  Day, Presidents' Day, Memorial Day, Juneteenth from 2022, Independence Day, Labor Day, Thanksgiving Day), plus the special
  closures: 2 January 2007 (national day of mourning), 29 and 30 October 2012 (hurricane), 5 December 2018 and 9 January 2025
  (national days of mourning). Half days are trading days.
- Within each calendar month the trading days are counted from the end: TD-1 = the last, TD-5 = the fifth-to-last.
- A weekday candle on an NYSE holiday stays a candle (the CFD trades): it counts in the ATR and in the stop checks, never in the
  calendar.

## The signal
- For each month m: **S** = its TD-5, **P** = the previous month's TD-1 (the previous month-end).
- **Diff(m)** = (SPX500 close(S) / SPX500 close(P) - 1) - (USB10Y close(S) / USB10Y close(P) - 1). The equity leg is SPX500 for
  both traded markets (the same signal trades SPX500 and NAS100). A missing candle for S or P in either file = no Diff that month.
- **Threshold, prior months only**: the Diffs of the 36 calendar months m-36 ... m-1, all of which must exist (else no trade,
  counted as `noHistory`). Diff(m) is in the **top third** when at least 24 of those 36 values are strictly below it, in the
  **bottom third** when at least 24 are strictly above it, otherwise in the middle.
- **Rule**: top third (stocks beat bonds) -> SELL at the close of S; bottom third -> BUY at the close of S; middle -> no trade.
  Exit at the close of the month's TD-1. One trade a month at most; trades never overlap.

## The stop (every trade has one)
- ATR(20) = the simple mean of the true range (high - low, or the distance to the previous folded candle's close if larger) of
  the 20 folded candles ending with the entry candle S (all closed at the entry). Fewer than 21 folded candles before = no trade.
- Stop = entry - 2.5 x ATR for a buy, entry + 2.5 x ATR for a sell. 1R = 2.5 x ATR.
- Checked on every folded candle after S up to and including the TD-1 candle: a candle that opens at or beyond the stop fills at
  its open (gap fill, can be worse than -1R); otherwise a low (buy) / high (sell) at or beyond the stop fills at the stop. The
  exit date is that candle's date. Otherwise the exit is the TD-1 close.

## Costs, in R
- Spread, a round trip, from the index studies on main: SPX500 1 index point, NAS100 3 index points; costR = points / risk.
- **Financing** on the notional (one unit, entry price), per calendar night from the entry date to the exit date, with r = the
  last weekly 2-year yield on or before the entry date (percent):
  - a buy PAYS (r + 2.5) % / 365 x entry per night;
  - a sell RECEIVES (r - 2.5) % / 365 x entry per night (a payment when r is under 2.5 %).
  finR = that cash / risk. No broker rate history is known; this one formula is used for every year.
- netR = side x (exit - entry) / risk - costR - (buy: finR paid) + (sell: finR received, signed).

## Windows (by the month of S)
- **Decisive**: January 2016 to October 2026 (the last month whose TD-1 is on file).
- **Replication**: January 2008 to December 2015.

## Tests
Four tests: **A** SPX500 every month, **B** SPX500 quarter-end months only (March, June, September, December), **C** NAS100 every
month, **D** NAS100 quarter-end only. The quarter-end variant uses the same signal and the same 36-month (all months) threshold;
it only keeps the trades whose month is a quarter-end.
A test passes when all five hold:
1. decisive mean netR > 0;
2. decisive one-sample t (mean / (sd / sqrt n), sd with n - 1) >= 2 (the trades are months apart, so trade-level t is used);
3. replication mean netR > 0 (the same sign);
4. Holm at 5 % over the four tests on the one-sided p of the decisive t (normal approximation): adjusted p < 0.05;
5. **placebo**: 40 seeds (1 to 40, mulberry32); for each seed every decisive-window trade of the test is re-run on the same
   entry date with a side drawn at random (buy or sell, one half each), with the same stop, exit, costs and financing; the rule's
   mean netR must beat the seed's mean in at least 38 of the 40 seeds (above their 95th percentile).

**Verdict**: PASS if at least one test passes all five (naming which); otherwise FAIL. A FAIL is a result. Reported beside the
verdict, not judged: n, mean gross and net R, t, win rate, stops, by side, by year.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict first), `tests/rebalance-flow.test.mjs`. A proposal under `research/proposals/`
(a paper shadow, never a live change) only if the verdict is PASS.
