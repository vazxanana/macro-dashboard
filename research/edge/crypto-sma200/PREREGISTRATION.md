# Pre-registration: Bitcoin / Ether long only above the 200-day average (13 Nov 2026)

Written and committed before any figure of this rule was computed on these candles. Paper research only: no live rule, size,
filter, stop, config or council member changes, whatever the result. A proposal is written only on PASS, and even then the
owner decides (absolute rule 3).

## Why

The slow trend filter (price above its 200-day moving average) is the most quoted way to sit out crypto bear markets. Today's
crypto weekly momentum (`research/edge/crypto-weekly-mom`), hour-of-day (`research/edge/crypto-hour`) and weekend
(`research/edge/crypto-weekend`) studies failed. This asks one fixed question: does being long only above the 200-day average
give a better risk-adjusted return than holding, with a smaller drawdown, after the demo broker's costs and financing, on data
after the rule became popular? It is not the council's crypto trend rule nor its decay monitor.

## Data (what is on file; exchange APIs are refused from the build sandbox)

council-data `research/candles/crypto1d/BTCUSDT_1d.json.gz` and `ETHUSDT_1d.json.gz`: Binance spot UTC daily candles
`[time, open, high, low, close]`, 2017-08-17 to 2026-10-31, 3,363 days each, no missing day (checked by counting only). Read
with `git show origin/council-data:…`, no network.

## Windows (fixed now)

- **Discovery: from the first day a 200-day average stands behind the position (2018-03-05; the signal of the 200th close,
  2018-03-04) to 2021-12-31.**
- **Decisive: 2022-01-01 to the data end (2026-10-31).**
- A day belongs to the window of its UTC date. Indicators and the position run continuously across the windows (a position
  open on 2021-12-31 is still open on 2022-01-01; its entry cost stays in discovery). The SMA100 variant uses the same days.

## The rule (fixed; no parameter is chosen from data)

- **Signal at each daily close d** (UTC 24:00): `close[d] > SMA_N(close)[d]`, the simple mean of the N closes d-N+1 … d.
  N = 200 (main), N = 100 (the one pre-stated variant).
- **Position for day d+1**: long 1x notional (no leverage) from the open of d+1 while the signal of d is true and the rule is
  armed; flat otherwise. A switch to flat sells at the open of d+1. No short side.
- **Catastrophe stop (every position has one)**: on entry at the open of day e, stop = open[e] - 3 x ATR20 of the signal day,
  ATR20 = the simple mean of the true range of the 20 days ending at the signal day (true range uses the previous close). The
  stop never moves. Each long day: if the open is at or below the stop, exit at the open; else if the low reaches it, exit at
  the stop.
- **After a stop**: flat and disarmed; the rule is re-armed by the first daily close at or below the average, and a new
  position needs a close above the average after that (a new cross).
- **Daily return (fraction of position value)**: a held day close[d]/close[d-1] - 1 (on the entry day the entry price replaces
  close[d-1]); a stop day exit/close[d-1] - 1 (or exit/entry on the entry day); a day sold at the open open[d]/close[d-1] - 1.
  Flat days return 0 (no interest on cash: the costlier reading for the rule).

## Costs and financing

- **Costs**: `CFD_CRYPTO` (council/fills.mjs, 0.04 % of price) charged in FULL on every switch (each entry and each exit),
  twice the round-trip convention used elsewhere in the repository: the conservative reading of "per switch". Taken off the
  day's return.
- **Financing**: the demo broker's crypto CFD long swap, council-data `ctrader/symbols.json` of 13 Nov 2026 (cTrader swap type
  1 = percent a year): BTCUSD long -15 %, ETHUSD long -15 %; `rollover3Days` 5 = Friday counts three. The broker's crypto day
  ends at 17:00 New York on all seven days (the convention of `research/edge/crypto-weekend`). A position held through a
  day's 17:00 New York instant pays 15 % / 365 x nights of the day's return base, nights = 1, a Friday 3 (Saturday and Sunday
  are charged as well: the costlier reading). A day sold at the open, or stopped that day, pays nothing that day (the stop
  instant inside the day is not known from a daily candle; reported, at most one night a stop). Today's rate for every year
  (past rates are not on file).
- **Benchmark (buy and hold)**: long every day of the window from the window's first open, the same swap every day, one
  `CFD_CRYPTO` at the start and one at the end, no stop.

## Tests and the pass

Four tests: {BTC, ETH} x {SMA200, SMA100}. Per test, on daily net returns:
- Sharpe = mean / sd x sqrt(365).
- **Paired monthly block bootstrap** on the decisive window: draw calendar months with replacement (as many as the window
  has), the same months for the rule and the benchmark, concatenate their days, compute both Sharpes; 2,000 draws, seeded
  (mulberry32, seed 20261113, a fresh generator with that seed for each test). P = share of draws in which the rule's Sharpe
  exceeds the benchmark's; p = 1 - P (floored at 1/2000).
- Max drawdown = the deepest fall of compounded equity from its running high, within the window.

A test passes when **all** hold:
1. decisive Sharpe (rule) > decisive Sharpe (benchmark);
2. P >= 0.9, and Holm-adjusted p <= 0.10 over the four tests;
3. decisive max drawdown (rule) <= 2/3 of the benchmark's;
4. discovery Sharpe (rule) > discovery Sharpe (benchmark) (same sign of the difference).

**Verdict: PASS if at least one of the four passes; FAIL otherwise.** A pass of only the SMA100 variant is reported as such.

## Reported, never part of the pass

Annual return (CAGR), time in market, switches, stops hit, cost and financing totals, per-year returns, the benchmark's
figures, and a financing sensitivity with a Friday counted as one night.

## Not tested

Leverage, shorts below the average, other coins, other lengths, a trailing stop, cash yield. Any of these needs its own
pre-registration.
