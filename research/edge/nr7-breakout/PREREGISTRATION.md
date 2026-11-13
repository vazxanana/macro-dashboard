# Pre-registration: the NR7 breakout on gold, two US indices and three currency pairs (13 Nov 2026)

Written and committed before any trade of this study was computed. Paper research: nothing here is read by the council, the
mirror or the page, and no live rule changes whatever the verdict. Not an ICT study, and not a study of the gold book.

**Item 44 (docs/owner-decisions.md).** No gate, exit, entry or size of the supported gold book (Gold trend, Gold daily engulf)
is tested here. This is a new stand-alone rule, tested on its own trades; its windows are 2008-2015 and 2016 to now, and it
reads nothing of the book's positions or its 2006-17 record.

## The question
The narrowest-range-of-seven-days breakout (Toby Crabel, 1990: after a day whose range is the narrowest of the last seven,
trade the break of that day's high or low the next day) is a published volatility-expansion effect. Does it make money after
costs on OANDA gold, Nasdaq 100, S&P 500, EUR/USD, GBP/USD and USD/JPY in the years since 2008?

## Data
- **Daily candles**: OANDA mid daily candles from council-data `research/daily/<key>.json` (`git show origin/council-data:…`,
  no network): `xau`, `nas100`, `spx500`, `eurusd`, `gbpusd`, `usdjpy`. UTC-aligned days.
- **Trading days**: the daily candles are folded with `council/fills.mjs` `foldWeekend` (imported, not copied): a Saturday or
  Sunday candle (the reopen stub) is merged into the next weekday's candle (its open, the high / low over both); a trailing
  weekend candle is dropped. Every rule below works on these folded UTC trading days.
- **Hourly candles**: OANDA mid H1 through the site's keyless candle proxy (`/md/bars?sym=<key>&tf=1h&from=&to=`, run with
  `node --use-env-proxy`), 2007-12-01 to the end of the daily data, kept outside git (`run.mjs fetch <dir>`). A trading day's
  hours are the H1 candles from the end of the previous trading day to the end of this one (so a Monday includes the Sunday
  reopen hours).
- **Financing benchmark**: FRED `DGS2`, weekly, from council-data `macro/cache.json` `score.fred.DGS2` (the last value dated on
  or before the entry day).

## The rule (fixed here; no parameter is chosen by the data)
- **NR7 day**: folded trading day i with range(i) = high - low > 0 and range(i) strictly smaller than the range of each of
  the six trading days before it (ties do not count). Needs six earlier trading days.
- **Orders for the next trading day E (= i + 1)**: a buy stop at high(i) and a sell stop at low(i), both valid for day E only.
  The first one traded wins; the other is cancelled. If neither is traded on day E, nothing happens.
- **One position per market**: the orders of an NR7 day are placed only when no position of that market is open at the start
  of day E (a trade still open through day E means the signal is skipped and counted as skipped).
- **Stop** (every trade has one, from the fill): the opposite side of the NR7 candle (a buy's stop = low(i), a sell's stop =
  high(i)). The stop is never moved.
- **Path inside a day, on H1 candles**: the hours of day E are walked in order. An entry fills at its level, or at the H1
  candle's open when that open is already beyond the level (a gap: the worse price). After the entry, the stop is checked
  from the NEXT H1 candle on, and also inside the entry candle itself (a candle that trades the entry and then the stop in
  one hour is booked as stopped: the worst case), filling at the stop or at a candle's open beyond it (gap).
- **Both levels in one H1 candle** of day E (the first candle that touches either level touches both): the order of the two
  cannot be known, so the trade is **counted as a loss**: -1R (the planned risk = the NR7 range) before costs, spread charged,
  no financing, side recorded as "both". The same applies when day E has no H1 candles on file and the daily candle touches
  both levels. When day E has no H1 candles and only one level is touched, the daily candle is used with the stop checked as
  touched first (worst case).
- **Exit A (time)**: at the close of the trading day after the entry day (day E + 1's folded daily close), unless the stop was
  hit first. Day E + 1's hours are walked on H1 for the stop the same way.
- **Exit B (2R target)**: the same, plus a target 2 x r0 from the fill on the trade's side; on an H1 candle that holds both the
  stop and the target, the stop is taken (worst case); a candle opening beyond the target fills at the target (no gain
  credited beyond it).
- **r0** = |fill - stop| (the risk at the fill; a gap entry makes it larger than the NR7 range). R = side x (exit - fill) / r0.
- A trade whose exit day is beyond the data is left out.

## Costs (charged on every trade, in R of its own r0)
- **Spread and slippage, a round trip**: gold $0.30; NAS100 3 index points; SPX500 1 index point (the
  `rsi2-pullback` table on that branch); EUR/USD and GBP/USD 0.0001 (1 pip); USD/JPY 0.01 (1 pip).
- **Financing**, per rollover counted by `council/fills.mjs` `nights(fill, exit)` (Monday-Friday 22:00 UTC, Wednesday three):
  - gold: longs `FIN.xau.long` (0.000148 of the entry price a night, imported); shorts 0 (as `fills.mjs`);
  - indices: longs (DGS2 + 2.5 %) / 365 x entry a night; shorts max(0, 2.5 % - DGS2) / 365 x entry a night (charged when it is
    a cost, never credited);
  - currencies: 0.00004 of the entry price a night on either side (the `trend-breadth-h1` assumption; not measured).
  The stop-out on the entry day or before 22:00 UTC pays no financing.
- Reported beside the verdict: the same at twice the spread, and before any cost.

## Windows (by entry day)
- **Decisive: 2016-01-01 to the end of the data.**
- Replication: 2008-01-01 to 2015-12-31.

## Statistics
- Pooled stream = every trade of the six markets. Its net R a trade (mean), n, and **t on calendar-month sums**: the sum of
  net R of the trades whose exit falls in each calendar month of the window (0 for a month with none), t = mean / (sd /
  sqrt(months)). One-sided p from the normal distribution.
- **Holm** over the two exit variants (A, B) on the decisive window's month-sum p at 5 % (the smaller p against 0.025, the
  other against 0.05).
- **Placebo** (decisive window, per exit variant): 40 seeds (1..40, mulberry32). For each seed and market, each real NR7 signal
  day that placed orders (the count includes signals that did not fill) is replaced by a trading day drawn at random from that
  market's trading days whose next day is in the window; the same bracket orders, stops, exits and costs are applied to that
  day's own high and low (one-position rule off; placebo trades may overlap). Statistic: the pooled mean net R a trade. The
  real mean must exceed the 95th percentile of the 40 seed means.

## Pass (per exit variant)
All of, on the pooled stream:
1. Decisive window: mean net R a trade > 0 and month-sum t >= 2.
2. Replication window: mean net R a trade > 0 (same sign).
3. Survives Holm over the two variants.
4. Beats the placebo's 95th percentile.

**Verdict**: PASS if at least one exit variant meets all four; FAIL otherwise. Per-market figures (n, net R, month t, both
windows) are reported, but **no market passes on its own**: a market that looks good alone is a hypothesis for a new
pre-registration, never evidence. A PASS leads to a paper-shadow proposal under `research/proposals/` only; never a live
change. A FAIL needs no proposal.

## Not changed after seeing results
The NR7 definition, the orders, stop, exits, the both-in-one-candle rule, the markets, costs, financing, windows, placebo and
pass bar are fixed by this file. Anything looked at afterwards is labelled as such and is not evidence.
