# Pre-registration: buying gold after a cross-asset liquidation day (14 Nov 2026)

Written and pushed alone, before any number of this study was computed. Paper research only: a stand-alone gold rule, never a
gate, entry, exit or size of the live gold book, and it does not use the book's 2006-17 window or its positions (owner
decision 44). Nothing live changes.

## The idea

On some days gold falls together with US stocks and US Treasuries: a "sell everything" day (March 2020, autumn 2008, May 2013,
September 2022). The usual reading is forced selling: margin calls and redemptions make holders sell what can be sold, gold
included, rather than a change of view on gold. If so, gold's fall on those days is a price pressure that should be given back
over the following days or weeks.

Hypothesis: a gold buy placed at the open after a liquidation day earns more, per trade, than the same buy placed on any day
(the unconditional same-side baseline). The baseline removes gold's drift: a buy that only rides gold's rise does no better
than it.

Nearest tested topics, and why this is not a duplicate: `gold-haven-shock` (gold after an S&P 500 shock day, gold's own move
not read, bonds not read: FAIL), `gold-capitulation` (gold's largest 5-day move of the year, no cross-asset condition: FAIL),
`gold-haven-catchup` (gold's weekly gap to yen, franc and Treasuries), `gold-shock-revert` (gold's own large days),
`risk-cross`. None conditions on gold, stocks AND Treasuries falling on the same day.

## Data and markets (fixed before any result)

- council-data `research/daily/xau.json`, `spx500.json`, `usb10y.json` (OANDA mid daily candles, UTC days), read with
  `git show origin/council-data:…` (no network). Saturday and Sunday candles are folded into the next weekday with
  `council/fills.mjs` `foldWeekend` (the Sunday reopen stub becomes part of Monday). The three markets are joined by day.
- Gold is the only market traded. S&P 500 CFD (`spx500`) and the US 10-year Treasury note CFD price (`usb10y`) are read only
  for the signal.

## The rule

- Daily return of each market: close / previous close - 1. Its scale: the sample standard deviation of that market's 60
  returns BEFORE the day (the day itself is not in it). z = return / sd.
- **Liquidation day** D: a weekday on which all three markets have a candle and z(gold) <= -K, z(spx500) <= -K and
  z(usb10y) <= -K (gold, stocks and bond prices all fell).
- **Trade**: buy gold at the open of the first gold candle after D. Stop = entry - 2 x ATR(20), the ATR of the 20 gold candles
  before the entry candle (true range). Every trade has this stop. Exit at the close of the H-th candle counted from the entry
  candle (the entry candle is the first), or at the stop: a candle that opens through the stop exits at its open, else a low
  at or under the stop exits at the stop. No target, no break-even, no trail. One trade at a time: a signal while a trade is
  open is skipped.
- **Costs**: $0.60 a round trip in price, plus financing on the buy: `nights(entry, exit)` x `FIN.xau.long` (council/fills.mjs,
  the demo broker's measured rate of 11 Nov 2026, used for every year) x entry price. Entry stamp = the entry candle's day
  start; exit stamp = the exit candle's day end (21:59:59 UTC on a Friday). R = (exit - entry - costs) / (entry - stop).
  Twice the costs is also reported. The cost share = mean cost per trade / mean |gross R| per trade.
- **Baseline**: the same trade (same stop, hold, costs) placed after EVERY eligible weekday of the same window, liquidation
  days included, each its own trade (overlap allowed). Excess of a signal trade = its net R - the baseline's mean net R in
  that window.

## Tests (three, Holm over the three)

| Test | K | H (candles held) |
|---|---|---|
| T1 (primary) | 1.0 | 10 |
| T2 | 1.0 | 5 |
| T3 | 0.5 | 10 |

## Windows

Signal days: in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31. 2006 is warm-up only (gold's file
starts 20 Mar 2006).

## Statistics and pass bar

- t on calendar-month sums of the excess, months by the exit stamp, every calendar month of the window counted (a month with
  no trade is 0). One-sided p from the normal approximation, Holm over the three tests (out of sample).
- **Placebo**: 40 seeded draws (mulberry32, seeds 1-40) of the same number of random eligible weekdays as there are
  liquidation days in the out-of-sample window, run through the same one-at-a-time simulation; the real test's month t of the
  excess is ranked against them.
- A test **passes** only if all hold: out of sample excess month t >= 2 and Holm p <= 0.05; in sample excess > 0; out of
  sample net R a trade > 0; out of sample excess still > 0 at twice the costs; above at least 38 of the 40 placebos.
- **Verdict**: PASS if T1 passes; "lead only" if only T2 or T3 passes; FAIL otherwise. Even a pass is a lead to be replicated
  on other years or markets, never a live rule without the owner. Reported for every test: n, gross and net R a trade, excess,
  month t, the baseline, the stop distance (median), nights, cost share, in and out of sample.
- If the median stop distance in either window is under $10, it is said in the result; the rule is not changed.
