# Pre-registration: buy US indices after a realised-volatility spike (13 Nov 2026)

Written and committed before any number of this study was computed. Paper research: nothing here is read by the council,
the mirror or the page, and no live rule changes whatever the verdict. Not an ICT study.

## The question
Equity indices are often said to rebound after fear peaks: the usual form is "buy when the VIX spikes". The VIX is not
reachable from the build sandbox, so the stand-in is the index's own realised volatility. When the last week's realised
volatility is more than twice its usual level and price is below its 20-day average (a sell-off, not a melt-up), does a
long held for a week make money after costs on the index CFDs the council can read?

## Data
- OANDA mid daily candles, council-data `research/daily/<key>.json` (the council's weekly cache, read with `git show
  origin/council-data:…`, no network): `spx500` (SPX500_USD), `nas100` (NAS100_USD), `us30` (US30_USD). UTC-aligned daily
  candles; Saturday and Sunday candles are dropped before anything is computed. The close is OANDA's daily candle close
  (00:00 UTC), not the exchange's official close.
- Financing benchmark: FRED `DGS2` (council-data `macro/cache.json` `score.fred.DGS2`), the last value dated on or before the
  entry day.

## The rule (as written, no parameter chosen here)
- r(k) = ln(close(k) / close(k-1)). RV5(i) = sample standard deviation (n-1) of r(i-4) … r(i) x sqrt(252).
- MED120(i) = median of RV5(i-120) … RV5(i-1) (the 120 values BEFORE day i; today's value is not in its own baseline).
- SMA20(i) = mean of close(i-19) … close(i).
- Signal on the close of day i: RV5(i) > 2 x MED120(i) AND close(i) < SMA20(i). Everything reads candles up to i only.
- **Fill at the NEXT day's open** (day e = i+1). Never at the signal close.
- Stop: entry - 3 x ATR(20), ATR = simple mean of the 20 Wilder true ranges ending at the signal day i. Every trade has it
  from the fill. A day whose low reaches the stop exits at the stop, or at that day's open if it opened below it (gap). The
  entry day itself is checked.
- Time exit: hold H trading days counting the entry day; exit at the CLOSE of day e + H - 1 if the stop was not hit first.
  **Primary H = 5; the pre-stated variant H = 10.** These are the only two tests.
- One position per market: a signal while in a trade is ignored. A trade that exits at the close of day j leaves the market
  flat at that close, so a signal on day j itself may enter at j+1's open.
- A trade still open on the last candle is closed at that candle's close (`end`) and counted.

## Costs (long only)
- Spread, points a round trip (the same stated figures as the rsi2-pullback study): SPX500 1.0, NAS100 3.0, US30 4.0.
- Financing per calendar night held (Friday to Monday = 3; entry and exit on the same day = 0):
  (DGS2 + 2.5 %) / 365 x entry price.
- R = (exit - entry - spread - financing) / (3 x ATR20). % net = the same in percent of the entry.

## Windows
- A: entries 2008-01-01 to 2015-12-31 (replication).
- B: entries 2016-01-01 to the last candle on file (**decisive**).
- A trade belongs to the window of its entry day. Indicators warm up on whatever history precedes a window.

## Test and pass bar
Each hold H is tested on the POOLED trades of the three markets (one stream per market as above, trades put together).
- t = mean / (sd / sqrt(n)) of the pooled net R a trade in window B; one-sided p from the normal; Holm over the 2 holds.
- **A hold PASSES** when, in window B: pooled n >= 40, pooled mean net R a trade > 0, t >= 2, Holm-adjusted p < 0.05; AND in
  window A the pooled mean net R a trade is also > 0 (same sign).
- **Verdict PASS** if at least one hold passes; otherwise FAIL.
- Reported, not part of the bar: per market rows, t on calendar-month sums of net R, stops, win rate, worst run of R,
  by year.

## Random-entry comparison (reported beside the verdict)
For each hold and each of 40 seeds: per market, the same number of trades as the rule took in window B, on random entry days
drawn uniformly from window B's trading days (signal day i drawn, fill at i+1's open; no volatility or SMA condition),
with the same hold, the same 3 x ATR(20) stop and the same costs. The pooled mean net R of each seed is recorded; the
report gives the 40 seeds' mean and 95th percentile and where the rule stands against them. If a hold passes the bar but
sits under the random 95th percentile, RESULT.md says so plainly.

## What a result means
- PASS: a written proposal for a paper shadow only (owner decision); no live change, no mirror copy.
- FAIL: written up as such; no proposal; the rule is not tuned (no other vol multiple, median length, SMA or hold) on these
  data.
- Not tested: the VIX itself, the cash indices' official closes, shorts, other markets.
