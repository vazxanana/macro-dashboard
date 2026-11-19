# Pre-registration: the MAX (lottery) effect across currencies, monthly rebalance (14 Nov 2026)

Written and pushed before any trade, return or statistic of this rule was computed. Paper research only: nothing here changes
a council rule, a trade, the mirror or any live file.

## Question

The MAX effect was published for stocks (Bali, Cakici and Whitelaw, 2011: stocks with the largest single daily return in the
past month earn less the next month) and has been tested for currencies. Does it make money on the council's own daily
candles, as stop-protected trades, net of costs: each month, sell the 2 of the 7 major currencies against USD with the
HIGHEST largest-daily-return over the previous calendar month and buy the 2 with the LOWEST, hold one month?

Not repeated elsewhere: no study in `research/edge/` ranks currencies by their largest single daily return (checked on `main`
and the `fx-*` branches on 14 Nov 2026). `fx-xs-momentum` (13 Nov) ranked them by 63 / 21-day return; `fx-value` (running the
same day) by 5-year return. This study changes only the ranking.

## Harness (reused exactly from `research/edge/fx-xs-momentum`, branch `fx-xs-momentum`, commit 58bd018)

That study is not on `main`, so its functions are copied into this study's `run.mjs` unchanged (series, inversion, calendar,
ATR, leg simulation with stop and gap fill, costs, financing, statistics, percentile, seeded placebo). Only the ranking, the
windows and the pass bar differ.

## Data

- council-data `research/daily/<key>.json` for `eurusd gbpusd audusd nzdusd usdcad usdchf usdjpy` (OANDA mid, complete UTC
  daily candles), read with `git show origin/council-data:…` (no network). Weekend stubs are folded into the next weekday by
  `council/fills.mjs` `foldWeekend` (imported).
- **Each currency is expressed as the foreign currency against USD**: EUR, GBP, AUD, NZD as quoted; CAD, CHF, JPY inverted
  candle by candle (open 1/o, high 1/l, low 1/h, close 1/c).
- **Calendar**: the trading days on which all seven series have a candle (after the fold). A month's last trading day is the
  last day of that calendar month in this calendar.

## Rule

1. On the last trading day `d` of each month, for each of the 7 currencies: **MAX = the largest daily close-to-close return
   `close(i) / close(i − 1) − 1` over the trading days `i` of the calendar month that ends on `d`** (the first day's return is
   from the previous month's last close). Closes up to and including `d` only. A month with fewer than 10 such days, or a
   currency with a missing value, gives no signal (that month is skipped).
2. Rank from highest MAX to lowest; a tie is broken by the order of the list above.
3. **Sell the top 2 (highest MAX) against USD and buy the bottom 2 (lowest MAX) against USD at the open of the next trading
   day.** Buying CAD, CHF or JPY against USD = selling USDCAD / USDCHF / USDJPY; selling them = buying the pair.
4. **Size: equal risk per leg.** 1R = 3 × ATR(20) of the expressed series, the 20 trading days ending on `d`.
5. **Every leg has a protective stop** at 1R from the entry, checked on every daily candle from the entry day to the exit day;
   a candle that opens beyond the stop fills at its open (gap fill), otherwise at the stop. A stopped leg stays flat to the
   month's end.
6. **Exit**: a leg not stopped is closed at the close of the last trading day of the month it was opened in. Each month's four
   legs are closed and opened anew (both sides' costs paid again).
7. One month = one book of four legs, 1R each. **Book net R for the month = the sum of the four legs' net R.**

No variant: one rule, one test.

## Costs (every leg, round trip, in R of that leg), as fx-xs-momentum

- **Base**: spread 0.3 pip, slippage 0.5 pip a side, commission 22.5 USD per million a side:
  `cost = 1.3 pip / price + 0.000045` of price; in R = cost × entry / stop distance. Pip 0.0001, 0.01 for USD/JPY.
- **Financing: a flat 0.004 % of price a night against every leg, long or short**, nights by `council/fills.mjs` `nights`
  (Mon-Fri 22:00 UTC rollovers, Wednesday three).
- **Cost 0** = gross (no cost, no financing); **2x** = both the trading cost and the financing doubled.
- **Limitation, stated now:** the true rate differential (carry) is not reachable from this sandbox; the flat charge ignores
  it, so this test measures the price part of the effect only.

## Windows

- **In sample: positions entered January 2005 to December 2014.**
- **Out of sample (decisive): positions entered January 2015 to the last complete month on file.** A month whose exit day is
  after the last candle on file is left out.

## Statistics and the pass bar

Per window: months n, book net R a month (mean), total, month t = mean / sd × √n (sd of the monthly sums, n − 1), Sharpe ×
√12, worst drawdown of the cumulative monthly sums; legs n, win rate, stopped share, net R a leg.

**PASS only when ALL of these hold**:
1. out of sample, base cost: book net R a month > 0 **and** month t ≥ 2;
2. in sample, base cost: book net R a month > 0;
3. out of sample at 2x cost: book net R a month > 0;
4. **placebo**: the out-of-sample month t (base cost) is above the 95th percentile of 40 placebo runs (each month 2 random
   longs and 2 random shorts, 4 distinct currencies of the 7; seeds 1 to 40, the same seeded generator as fx-xs-momentum;
   same months, entries, stops, exits and costs). Linear interpolation between ordered values. The rank of the study's t among
   the 40 placebo t is reported.

Otherwise **FAIL**. A PASS is evidence for a proposal to the owner, never a live change.

**Reported, never part of the verdict:** cost 0 and 2x in both windows; calendar years; how often each currency was bought /
sold out of sample; the placebo distribution (5th, 50th, 95th percentile).

## Repeat

`node research/edge/fx-max-effect/run.mjs` (reads council-data through `git show`, writes `result.json`). Tests:
`tests/fx-max-effect.test.mjs`.
