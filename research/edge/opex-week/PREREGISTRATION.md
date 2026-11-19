# Pre-registration: the monthly options-expiry week on US indices (14 Nov 2026)

Written and pushed before any trade or result of this study is computed. Research only: no rule, size, filter, stop, config or
council member changes; paper only. Not an ICT study (nothing under `ict/` is edited; `ict/calendar.mjs` is only read for its
holiday dates). Not the turn-of-the-month study (`research/edge/turn-of-month`, branch `turn-of-month`, FAIL 0 of 3) and not the
month-end rebalancing study (`research/edge/rebalance-flow`, FAIL 0 of 4): this one trades the week that ends on the monthly
options expiration and the week after it.

## Why
A published calendar effect: US index returns are reported to be stronger in the week that ends on the third Friday of the month
(monthly options expiration, "OpEx week") and weaker in the week after it (Stivers and Sun, "Returns and option activity over the
option-expiration week for S&P 100 stocks", 2013; practitioner write-ups of "the week after OpEx" on the S&P 500 and Nasdaq 100).
The question here: does a fixed rule built on it make money after costs and financing on the index CFDs the desk can reach, out of
sample and with every trade on a stop?

## Data (fixed now)
- Daily OANDA mid candles from the council's own daily cache, council-data `research/daily/spx500.json` (SPX500_USD) and
  `nas100.json` (NAS100_USD), read with `git show origin/council-data:...` at council-data `b10aea762` (cache updated 7 Nov 2026,
  last candle 6 Nov 2026, first 24 Mar 2003). No network. The files are copied outside git and `run.mjs` reads them from a
  directory given on the command line.
- The 2-year Treasury yield, weekly, from council-data `macro/cache.json` `score.fred.DGS2` (FRED, same commit, 2006-01-06 to
  2026-11-13), copied once into `rates.json` beside this file, for financing (as the earlier index studies did).
- Candle `t` is the UTC midnight that starts the day; a candle's close is OANDA's 00:00 UTC close, three to four hours after the
  NYSE cash close of that date (and after the 17:00 New York futures close). That close is this study's "close" of a day
  (stated: the daily cache holds no candle that closes at the NYSE close; the rebalance-flow study used the same convention).
- **Weekend folding** with `council/fills.mjs` `foldWeekend` (imported, unchanged): a Saturday or Sunday candle (OANDA's Sunday
  reopen stub) is folded into the next weekday candle (open = the first weekend candle's open, high / low over all of them,
  close and time = the weekday's); a weekend candle with no later weekday candle is dropped.

## Trading-day calendar (fixed now, copied from the turn-of-month study's code, not imported)
- **NYSE trading day** = a weekday that is not an NYSE holiday. Holidays from `ict/calendar.mjs` `cmeYear` (read only): its
  full-closure days (New Year's Day, Good Friday, Christmas) and its early-close days that are NYSE holidays (Martin Luther King
  Day, Presidents' Day, Memorial Day, Juneteenth from 2022, Independence Day, Labor Day, Thanksgiving Day), plus the special
  closures 2 January 2007, 29 and 30 October 2012, 5 December 2018 and 9 January 2025. Half days are trading days.
- A weekday candle on an NYSE holiday stays a candle (the CFD trades): it counts in the ATR and in the stop checks, never in the
  calendar.

## The dates
- **Third Friday F(m)** = the third Friday of calendar month m.
- **Expiry day X(m)** = F(m) if F(m) is an NYSE trading day; otherwise the last NYSE trading day before it (the Thursday when the
  Friday is Good Friday or Juneteenth).
- **Expiry week** = Monday to Friday of the calendar week of F(m).
- **T1 / T3 entry E1(m)** = the last NYSE trading day before the Monday of the expiry week (normally the Friday one week before
  F(m); the Thursday when that Friday is a holiday). **Exit** = the close of X(m).
- **T2 / T4 entry** = the close of X(m). **Exit Y(m)** = the last NYSE trading day on or before F(m) + 7 calendar days (the next
  Friday, or the day before it when it is a holiday).
- A missing folded candle on an entry or exit date = no trade that month, counted (`noCandle`).

## Tests (four)
- **T1** SPX500 long over the expiry week. **T2** SPX500 short over the week after. **T3** NAS100 long over the expiry week.
  **T4** NAS100 short over the week after. The four are judged separately; T1 / T3 and T2 / T4 never block each other.

## The stop (every trade has one)
- ATR(20) = the simple mean of the true range (high - low, or the distance to the previous folded candle's close if larger) of
  the 20 folded candles ending with the entry candle (all closed at the entry). Fewer than 21 folded candles = no trade.
- Stop = entry - 2.5 x ATR for a buy, entry + 2.5 x ATR for a sell. 1R = 2.5 x ATR.
- Checked on every folded candle after the entry candle up to and including the exit candle: a candle that opens at or beyond
  the stop fills at its open (gap fill, can be worse than -1R); otherwise a low (buy) / high (sell) at or beyond the stop fills
  at the stop. The exit date is that candle's date. Otherwise the exit is the exit-date close.

## Costs, in R
- Spread, a round trip: SPX500 1 index point, NAS100 3 index points (as in the other index studies); costR = points / risk.
- **Financing** on the notional (one unit, entry price), per calendar night from the entry date to the exit date, with r = the
  last weekly 2-year yield on or before the entry date (percent): a long PAYS (r + 2.5) % / 365 x entry a night; a short PAYS
  max(0, 2.5 - r) % / 365 x entry a night (a short is never credited). finR = that cash / risk. No broker rate history is known;
  this one formula is used for every year.
- netR = side x (exit - entry) / risk - costR - finR.

## Windows (by the month of the expiry)
- **Decisive**: January 2016 to October 2026 (the last month whose T2 exit is on file).
- **Replication**: January 2008 to December 2015.

## Pass bar (per test, all five)
1. decisive mean netR > 0;
2. decisive one-sample t (mean / (sd / sqrt n), sd with n - 1) >= 2 (trades are a month apart, so trade-level t is used);
3. replication mean netR > 0 (the same sign);
4. Holm at 5 % over the four tests on the one-sided p of the decisive t (normal approximation): adjusted p < 0.05;
5. **placebo**: 40 seeds (1 to 40, mulberry32). For each seed and each decisive-window trade of the test, one placebo trade on
   the SAME side in the same calendar month as the rule trade's entry: entry at the close of a "week-end day" drawn uniformly
   from that month's week-end days other than the rule trade's own entry day, exit at the next week-end day's close, same stop,
   costs and financing. A week-end day = the last NYSE trading day of a Monday-to-Friday calendar week. A drawn week with a
   missing candle or ATR is redrawn (at most 50 tries). The rule's mean netR must beat the seed's mean in at least 38 of the 40
   seeds (above their 95th percentile).

**Verdict**: PASS if at least one test passes all five (naming which); otherwise FAIL. A FAIL is a result. Reported beside the
verdict, not judged: n, mean gross and net R, t, win rate, stops, cost and financing per trade, by year.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict first), `tests/opex-week.test.mjs`. A proposal under `research/proposals/` (a paper
shadow, never a live change) only if the verdict is PASS.
