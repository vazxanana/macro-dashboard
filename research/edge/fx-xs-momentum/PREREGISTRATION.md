# Pre-registration: forex cross-sectional momentum, monthly rebalance (13 Nov 2026)

Written and pushed before any trade, return or statistic of this rule was computed. Paper research only: nothing here changes
a council rule, a trade, the mirror or any live file.

## Question

Does the published currency momentum effect (rank currencies against the dollar by their past return, buy the strongest, sell
the weakest, rebalance monthly) make money on the council's own daily candles, as stop-protected trades, net of costs?

What is NOT repeated here: the one-week reversal across G10 (an earlier study) and time-series momentum on 20 markets (an
earlier study, each market against its own past). This study ranks the currencies against EACH OTHER (cross-sectional) over
3 months, with a 1-month variant.

## Data

- council-data `research/daily/<key>.json` for `eurusd gbpusd audusd nzdusd usdcad usdchf usdjpy` (OANDA mid, complete UTC
  daily candles), read with `git show origin/council-data:…` (no network). Weekend stubs (Saturday / Sunday candles) are folded
  into the next weekday by `council/fills.mjs` `foldWeekend` (imported, not copied).
- **Each currency is expressed as the foreign currency against USD.** EUR, GBP, AUD, NZD: the pair as quoted. CAD, CHF, JPY:
  the USD-base pair inverted, candle by candle: open 1/o, high 1/l, low 1/h, close 1/c.
- **Calendar**: the trading days on which all seven series have a candle (after the fold). A month's last trading day is the
  last day of that calendar month in this calendar.

## Rule (primary: 63-day lookback)

1. On the last trading day `d` of each month, for each of the 7 currencies: return = close(d) / close(63 calendar-rows before
   d) − 1, closes only up to and including `d`. Rank from highest to lowest; a tie is broken by the order of the list above.
2. **Buy the top 2 against USD and sell the bottom 2 against USD at the open of the next trading day** (the first trading day
   of the next month). Buying CAD, CHF or JPY against USD = selling USDCAD / USDCHF / USDJPY; selling them = buying the pair.
3. **Size: equal risk per leg.** 1R = 3 × ATR(20), ATR(20) = the simple mean of the true range (high − low, or the gap from the
   previous close when larger) of the 20 trading days ending on `d`, on the expressed series.
4. **Every leg has a protective stop** at 3 × ATR(20) from the entry (= 1R): below the entry for a buy, above for a sell.
   Checked on every daily candle from the entry day itself to the exit day. **A candle that opens beyond the stop fills at its
   open (gap fill)**, otherwise at the stop. A stopped leg stays flat until the month's end.
5. **Exit**: a leg not stopped is closed at the close of the last trading day of the month it was opened in (the next signal
   day). Every month's four legs are closed and opened anew (no netting of a currency that stays in the same bucket; it pays
   both sides' costs again).
6. One month = one book of four legs, each worth 1R of risk. **Book net R for the month = the sum of the four legs' net R.**

**Variant (pre-registered, tested with the primary): the 21-day lookback**, everything else identical.

## Costs (every leg, round trip, in R of that leg)

- Spread 0.3 pip (paid once a round trip on mid prices), slippage 0.5 pip a side (1.0 pip a round trip), commission 22.5 USD
  per million USD of notional a side (45 a round trip = 0.0045 % of notional). The raw-spread model measured on the demo account
  (CLAUDE.md, "Forex spreads", 12 Nov 2026). Pip = 0.0001, or 0.01 for USD/JPY. As a fraction of the pair's entry price:
  `cost = 1.3 pip / price + 0.000045`; in R = cost × entry (expressed) / stop distance (expressed). A fraction of price is the
  same in the quoted and the inverted series.
- **Financing: a flat 0.004 % of price a night, charged against every leg, long or short** (the assumption the
  `trend-breadth-h1` study used for currencies). Nights = `council/fills.mjs` `nights(entryTime, exitTime)` (Mon-Fri 22:00 UTC
  rollovers, Wednesday three). Entry time = the entry day's candle start; exit time = the end of the exit day for a month-end
  close, the candle start for a gap fill, the candle start + 12 h for a stop inside a candle.
- **Limitation, stated now:** the true rate differential is not reachable from this sandbox (FRED is refused). Carry is a real
  part of published currency momentum returns (high-rate currencies tend to rank high and earn the differential). A flat
  charge on both sides ignores it, so this test measures the price momentum alone, with a cost where the published figures
  carry a credit or a debit.

## Windows

- **Decisive: positions entered from January 2016** (signal at the end of December 2015) to the last complete month on file.
- **Replication: positions entered January 2008 to December 2015.**
- A month whose exit day is after the last candle on file is left out (not complete).

## Statistics and the pass bar

Per lookback and window: months n, book net R a month (mean), total, month t = mean / sd × √n (sd of the monthly sums,
n − 1), annualised Sharpe = mean / sd × √12, worst drawdown of the cumulative monthly sums.

A lookback **passes** only when ALL of these hold:
1. decisive window: book net R a month > 0 **and** month t ≥ 2;
2. replication window: book net R a month > 0 (same sign);
3. **Holm over the 2 lookbacks** at 0.05 on the one-sided p of the decisive month t (normal approximation; the direction,
   positive, is fixed here);
4. **placebo**: the decisive month t is above the 95th percentile of 40 placebo runs. A placebo run picks, each month, 2 random
   longs and 2 random shorts (4 distinct currencies of the 7; seeds 1 to 40, a fixed seeded generator), with the same entries,
   stops, exits and costs. The percentile is the linear interpolation between ordered values.

**Verdict**: PASS when the primary (63-day) lookback passes; "PASS (21-day variant only)" when only the variant passes; FAIL
otherwise. A PASS is evidence for a proposal to the owner, never a live change.

**Reported, never part of the verdict:** the same before costs and without financing; each window's legs (n, win rate,
stopped share, R a leg); calendar years; how often each currency was bought / sold; the placebo distribution (median, 5th
and 95th percentile); the data's flat-candle share.

## Repeat

`node research/edge/fx-xs-momentum/run.mjs` (reads council-data through `git show`, writes `result.json`). Tests:
`tests/fx-xs-momentum.test.mjs`.
