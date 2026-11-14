# Pre-registration: relative momentum between Ether and Bitcoin (14 Nov 2026)

Written and committed before any trade of these rules was computed on these candles. Paper research only: no live rule, size,
filter, stop, config or council member changes, whatever the result. A proposal is written only on PASS, and even then the
owner decides (absolute rule 3). Every trade has a stop.

## Why

Earlier crypto studies each failed on their own question: one-week time-series momentum per coin, hour of day, the weekend,
the 200-day average, a three-day reversal, NAS100 spillover. None asked about RELATIVE strength between the two largest coins.
This asks two fixed questions: (T1) does the 4-week trend of the ETH/BTC price ratio carry on for one more week, traded as a
two-leg spread with a stop on each leg; (T2) does holding, long only, whichever of BTC and ETH was stronger over 4 weeks make
money week by week, after the demo broker's costs and financing, on 2022 on, and did it in 2018-21 too?

## Data (what is on file; exchange APIs are refused from the build sandbox)

council-data `research/candles/crypto1d/BTCUSDT_1d.json.gz` and `ETHUSDT_1d.json.gz`: Binance spot UTC daily candles
`[time, open, high, low, close]`, read with `git show origin/council-data:…` (no network). Both run 2017-08-17 to 2026-10-31,
3,363 days each, no missing day (checked before this file was written; the run counts again and reports it). A day is a
candle; no day is invented. The ratio is computed from the two coins' own closes (no ETHBTC market file is used).

## Weeks (fixed now)

- **Weekly close** = the end of the Sunday UTC daily candle, i.e. Monday 00:00 UTC (the brief's "Sunday 00:00" read as the
  close of Sunday, the standard UTC week). Signal day `i` = a Sunday candle; trade week = the seven candles Monday `i+1` …
  Sunday `i+7`. Entry at the open of Monday `i+1`; time exit at the close of Sunday `i+7` (the next weekly close); the next
  trade enters at the following Monday's open.
- A week is traded only when both coins have all candles `i-28 … i+7` (by timestamp; none is missing on file) and every
  indicator stands; otherwise it is a week with no trade (counted as 0 in the weekly sums, reported).
- **Decisive: weeks whose entry Monday is 2022-01-01 to the last week whose Sunday is on file (Sunday 2026-10-25).**
- **Replication: weeks whose entry Monday is 2018-01-01 to 2021-12-31.**

## Indicators (each reads candles up to and including the signal day i; nothing after)

- `ret4(coin)[i] = c[i] / c[i-28] - 1` (four weeks of daily closes).
- Ratio `q[i] = cETH[i] / cBTC[i]`; `ratio4[i] = q[i] / q[i-28] - 1`.
- `ATR14[i]` = simple mean of the true range of days `i-13 … i` (true range = max(h, previous close) − min(l, previous close)),
  per coin.

## T1, ratio trend (two legs, equal notional)

- `ratio4[i] > 0`: **long ETH and short BTC**; `ratio4[i] < 0`: **short ETH and long BTC**; exactly 0: no trade.
- Each leg has notional N (the same number of dollars), entry = that coin's open of Monday `i+1`.
- **Each leg has its own stop** at 2.5 × ATR14[i] of that coin from its entry: long leg `entry − 2.5·ATR`, short leg
  `entry + 2.5·ATR`. The stops never move. A stopped leg is closed; the other leg runs on to its own stop or the weekly close.
- Leg risk as a fraction of notional `f = 2.5·ATR14[i] / entry`. **1R = fETH + fBTC** (the combined two-leg risk: both
  stops hit costs 1R before costs).
- Leg result as a fraction of notional: long `exit/entry − 1`, short `1 − exit/entry`. Trade R = (ETH leg + BTC leg) / 1R;
  net R = (ETH leg + BTC leg − both legs' costs and financing, as fractions of notional) / 1R.

## T2, long-only rotation

- Hold **the coin with the higher `ret4[i]`** (ties: BTC), long only, for the week; one position, notional N.
- Stop 2.5 × ATR14[i] of the held coin under its entry; 1R = that distance (`f` of the held coin). R = (exit − entry)/r0,
  net R = (exit − entry − costs − financing) / r0.
- **BTC holding (comparison, not a test)**: the same weekly trade always in BTC (same entry, stop, exit, costs), and plain
  buy-and-hold BTC (weekly close-to-close return, no stop, no cost). Reported: weekly net return of notional, Sharpe, and the
  paired difference T2 − BTC weekly (same stop rule) with its t.

## Stops and fills (daily candles; both tests, each leg)

For each held day k from Monday e to Sunday x, before the time exit at the close of x:
- long: if k > e and `o[k] ≤ stop`, exit at `o[k]` (gap through the stop fills at the open); else if `l[k] ≤ stop`, exit at `stop`.
- short: if k > e and `o[k] ≥ stop`, exit at `o[k]`; else if `h[k] ≥ stop`, exit at `stop`.
- On the entry day the open is the entry, inside the stop.

## Costs and financing (per leg, as a fraction of notional, taken off the result)

- **CFD round trip** `CFD_CRYPTO` of `council/fills.mjs` = 0.04 % of the entry price, once per leg.
- **Slippage**: half a spread on each market order, the spread being `spreadOf`'s crypto figure 0.02 % of price: 0.01 % at
  entry and 0.01 % of the exit price at exit (stop and time exits are market orders).
- **Swap**: council-data `ctrader/symbols.json` (demo broker, cTrader swap type 1 = percent a year, read 14 Nov 2026):
  **BTCUSD long −15 %, short −7.5 %; ETHUSD long −15 %, short −10 %** (all charges; matches what the NAS100 spillover study
  read). `rollover3Days` 5 = Friday counts three nights. The broker's crypto day ends at 17:00 New York. Charge = rate / 365 ×
  nights × entry notional; nights = the 17:00 New York instants inside the held period (the crypto-reversal study's
  `nightsOf`, copied: every held UTC day holds one, a Friday's counts three); an intraday stop is taken as the end of its day
  (the costlier reading), a stop at the open as the start of its day (no night that day). A full week = 9 nights. Today's
  rates for every year (past rates are not on file).

## Tests (two) and the pass

Per test: weekly net R (one trade a week, a week with no trade = 0) over the window's weeks.
- **t on weekly sums** = mean / (sd / √weeks); one-sided p = 1 − Φ(t) (normal).
- **Holm** over the two decisive p values, family level 0.05.
- **Placebo**, 40 seeds (mulberry32, seeds 1 … 40), on the decisive weeks that the real test traded: T1 = a random side each
  week (long ETH / short BTC or the reverse, probability ½), T2 = a random coin each week (BTC or ETH, ½); same entry, stops,
  exit, costs. Statistic = mean net R a week. Its 95th percentile = linear interpolation of the 40 sorted values at 0.95 × 39.

A test passes when **all** hold:
1. decisive mean net R a week > 0;
2. decisive weekly t ≥ 2;
3. Holm-adjusted p ≤ 0.05;
4. replication (2018-21) mean net R a week > 0 (same sign);
5. decisive mean net R a week > the placebo's 95th percentile.

**Verdict: PASS if at least one of the two passes; FAIL otherwise.**

## Reported, never part of the pass

Per window and test: weeks, trades, mean gross and net R, total net R, t, win rate, legs stopped, gaps through a stop, cost and
financing in R, worst drawdown of the cumulative net R, Sharpe of the weekly net R and of the weekly net return of notional
(× √52; T1's return per unit of notional on each leg). T2 against BTC (above). Per year net R.

## Not tested

Other lookbacks (1, 2, 8, 12 weeks), other rebalancing days, a volatility-weighted (rather than equal-notional) spread, other
coin pairs, no-stop versions, trailing stops, sizing. Each needs its own pre-registration.
