# Pre-registration: crypto short-term reversal after a sharp three-day drop (13 Nov 2026)

Written and committed before any trade of this rule was computed on these candles. Paper research only: no live rule, size,
filter, stop, config or council member changes, whatever the result. A proposal is written only on PASS, and even then the
owner decides (absolute rule 3).

## Why

Short-term reversal is a published effect in crypto: coins that fell hard over a few days tend to bounce over the next few.
Today's crypto studies tested other things (one-week time-series momentum, hour of day, weekend / Monday, the 200-day average
as a regime switch) and failed. This asks one fixed question: after a three-day drop of more than two standard deviations,
does a long held three (or seven) days make money after the demo broker's costs and financing, with a stop on every trade, on
data from 2022 on, and did it in 2018-21 too?

## Data (what is on file; exchange APIs are refused from the build sandbox)

council-data `research/candles/crypto1d/<COIN>USDT_1d.json.gz`: Binance spot UTC daily candles `[time, open, high, low, close]`,
read with `git show origin/council-data:…` (no network), kept outside git:
- BTCUSDT and ETHUSDT from 2017-08-17, XRPUSDT from 2018-05-04, SOLUSDT from 2020-08-11 (its listing); all to 2026-10-31.
These four are the coins the council's crypto feed and the demo broker cover (the broker has BTC, ETH and SOL; XRP is in the
council's crypto feed). Missing days, if any, are counted and reported; a day is a candle, no day is invented.

## Windows (fixed now)

- **Decisive: trades whose entry day is 2022-01-01 to the data end (2026-10-31).**
- **Replication: trades whose entry day is 2018-01-01 to 2021-12-31** (SOL from the first day its indicators stand; XRP from
  its first candle plus warm-up).
- Indicators run continuously over all candles on file; a trade belongs to the window of its entry date (UTC).

## The rule (fixed; no parameter is chosen from data)

Index the daily candles of a coin by i; `c[i]`, `o[i]`, `h[i]`, `l[i]` its close, open, high, low.
- **Three-day return** `r3[i] = c[i] / c[i-3] - 1` (simple return).
- **Its trailing spread** `sd[i]` = the sample standard deviation (n − 1) of the 90 values `r3[i-90] … r3[i-1]` (the 90
  three-day returns BEFORE day i; today's is not in it). Needs i ≥ 93.
- **Signal at the close of day i**: `r3[i] < -2 × sd[i]`.
- **Filter variant (a separate test)**: also `c[i] > SMA200[i]`, the simple mean of the 200 closes `c[i-199] … c[i]`.
  Needs i ≥ 199. The unfiltered tests use the same rule without this line.
- **Entry**: buy at the open of day e = i + 1, entry price `o[e]`.
- **Stop (every trade has one)**: `stop = entry − 2.5 × ATR14[i]`, ATR14 = the simple mean of the true range of the 14 days
  `i-13 … i` (true range = max(h, previous close) − min(l, previous close)). The stop never moves. Initial risk `r0 = entry − stop`.
- **Exit**: the close of the third daily candle counting the entry day as the first (day e + 2) for the main exit; the close of
  the seventh (day e + 6) for the variant. If the data end comes first, the trade is not counted.
- **Stop check, each held day k from e to the exit day, before the exit at the close**: if k > e and `o[k] ≤ stop`, exit at
  `o[k]` (a gap through the stop fills at the open); else if `l[k] ≤ stop`, exit at `stop`. (On the entry day the open is the
  entry, above the stop.)
- **One trade at a time per coin**: a signal while that coin's trade is open is ignored; a signal on the exit day may enter on
  the next open.
- Long only.

## Costs and financing (all in price, taken off the result; R = (exit − entry) / r0, net R = (exit − entry − costs) / r0)

- **CFD round trip**: `CFD_CRYPTO` of `council/fills.mjs` = 0.04 % of the entry price, once a trade.
- **Slippage**: half a spread on each market order, the spread being `spreadOf`'s crypto figure 0.02 % of price: 0.01 % of the
  entry price at entry and 0.01 % of the exit price at exit (a stop exit is a market order too).
- **Financing**: the demo broker's crypto CFD long swap, council-data `ctrader/symbols.json` of 13 Nov 2026 (cTrader swap type
  1 = percent a year): BTCUSD, ETHUSD, SOLUSD long −15 %; XRPUSD is not listed at the broker, so the same 15 % is charged
  (stated assumption). `rollover3Days` 5 = Friday counts three nights. The broker's crypto day ends at 17:00 New York on all
  seven days. Charge = 15 % / 365 × nights × entry price, nights = the 17:00 New York instants inside the held period, a
  Friday's counting 3. Every held UTC day contains one such instant; the held period runs from the entry open to the exit,
  with an intraday stop taken as the end of its day (the costlier reading; the stop's time is not in a daily candle) and a
  stop at the open as the start of its day (no night that day). Today's rate for every year (past rates are not on file).

## Tests (four) and the pass

Tests: {exit day 3, exit day 7} × {no filter, SMA200 filter}. Per test the trades of the four coins are pooled.
- Net R a trade = mean net R; t on **calendar-month sums**: every calendar month of the window (months with no trade count 0;
  a trade's month = its entry month), t = mean / (sd / √months) of the monthly net R sums. One-sided p = 1 − Φ(t) (normal).
- **Holm** over the four decisive p values, family level 0.05.
- **Placebo**: 40 seeds (mulberry32, seeds 1 … 40). For each seed and test, per coin, draw without replacement as many entry
  signal days as the real test took trades on that coin in the decisive window, from the days that could have given a signal
  there (the indicators stand, the entry day is in the decisive window, the exit day is on file, and for the filter tests the
  close is above the 200-day average); each drawn day is simulated as a trade with the same entry, stop, exit and costs (no
  one-at-a-time rule). The placebo's figure is the pooled mean net R a trade. Its 95th percentile = linear interpolation of
  the 40 sorted values at 0.95 × 39.

A test passes when **all** hold:
1. decisive pooled net R a trade > 0;
2. decisive month-sum t ≥ 2;
3. Holm-adjusted p ≤ 0.05;
4. replication (2018-21) pooled net R a trade > 0 (same sign);
5. decisive pooled net R a trade > the placebo's 95th percentile.

**Verdict: PASS if at least one of the four passes; FAIL otherwise.** A pass of only a variant is reported as such.

## Reported, never part of the pass

Per coin n / net R / t for each window and test, gross R, win rate, stops hit, gaps through the stop, cost and financing in R,
worst drawdown of the pooled cumulative net R, and the share of R before costs.

## Not tested

Shorts after a rise, other thresholds, lookbacks or holds, other coins, a trailing stop, position sizing, intraday entry. Any of
these needs its own pre-registration.
