# Pre-registration: the 52-week-high anchor on equity indices (14 Nov 2026)

Written and pushed alone, before any signal, trade or R of this study is computed. Paper only: nothing live changes whatever the
result, gold is not touched (docs/owner-decisions.md item 44) and a PASS would only be a proposal to the owner.

## Why
George and Hwang (2004) found that stocks trading near their 52-week high go on to beat those far from it (an anchoring story:
traders under-react to good news near a salient high). Li and Yu (2012) found the same anchor in the aggregate US market: nearness
to the index's own 52-week high predicted higher future index returns, and the distance to the historical high predicted lower.
None of the council's studies has asked this of the equity indices the site already caches. The question: **does an index that
closes at, or within 1 % of, its trailing 252-day closing high beat its own average over the next 20 trading days?**

## Data
- OANDA mid daily candles from the council's daily cache, council-data `research/daily/<key>.json`, read with
  `git show origin/council-data:research/daily/<key>.json` (no network; the commit is recorded in result.json).
- Markets: **spx500** (SPX500_USD, primary); **nas100, us30, de40, uk100, jp225** (replication).
- OANDA prints a short Sunday candle (and a few Saturday ones). Saturday and Sunday candles are folded into the next weekday
  with `council/fills.mjs` `foldWeekend` (imported, unchanged): the weekday keeps its close, takes the first weekend open and
  the high / low over all. A trailing weekend candle with no weekday after it is left out. "Day" below means a folded candle.

## Rule
- **Signal (T1, T2)**: at the close of day i (i >= 252), `close[i] >= 0.99 x max(close[i-252 .. i-1])`. The high is taken from
  the 252 closes BEFORE that close, so a close at a new high is a signal too.
- **Entry**: long at the open of day i+1.
- **Stop**: entry minus 2 x ATR20, where ATR20 = the simple mean of the 20 true ranges ending at day i (true range with the
  previous close). Every trade has this stop. On each held day, if the low reaches the stop the trade exits at the stop, or at
  the open when the open is already through it (a gap).
- **Exit**: at the close of the 20th day held, counting the entry day as day 1 (days i+1 .. i+20). A trade whose 20th day is
  not in the data yet is left out (open).
- **One position at a time per index**: after a trade exits on day x, the next trade may come from a signal on day x or later.
- **T3, the opposite claim**: short when `close[i] < 0.80 x max(close[i-252 .. i-1])` (more than 20 % below the 252-day closing
  high); entry at the next open, stop entry plus 2 x ATR20, same exits, one at a time.
- R: gross R = (exit - entry) / (2 x ATR20) for a long, the negative for a short.

## Costs (net R)
- Round trip 0.04 % of notional: `0.0004 x entry / (2 x ATR20)`.
- Financing a long: `(r + 2.5 %) / 365` per calendar day between the entry day and the exit day, x entry / (2 x ATR20), where
  r = the US 2-year yield (FRED DGS2, weekly, from council-data `macro/cache.json` `score.fred.DGS2`, the latest value dated on
  or before the entry day). DGS2 there starts in January 2006: **before it, a fixed 4 % is used** (said in the result). The US
  rate is used for every index, the DAX, FTSE and Nikkei included (their own rates are not available offline): said, not
  measured.
- Financing a short: `max(0, 2.5 % - r) / 365` a calendar day (a short is never credited).
- 2x cost: both parts doubled; reported for every test, not part of the pass bar.

## Comparison: the index's own drift
The same trade (same entry, stop, exit, costs, one at a time) taken on every day that is NOT a signal of that test (from day 252
on). Its mean net R a trade, `mu_base`, is the index's own average for that trade in that window. The tested quantity is
**D = mean net R of the signal trades - mu_base** (for T3: the short on signal days against the short on every non-signal day).

## Windows (by entry day)
- **Decisive**: entries from 1 January 2016 to the end of the data.
- **Replication**: entries from the start of the data (after the first 252 days) to 31 December 2015.

## Tests (three; Holm over the three decisive p values)
- **T1**: spx500, signal net R minus non-signal net R.
- **T2**: the same, pooled over nas100, us30, de40, uk100, jp225 (each index against its own `mu_base`).
- **T3**: the short more than 20 % below the 252-day high, spx500 and the five replication indices pooled, against the short on
  every non-signal day.

## Statistics
- t on calendar-month sums: for each calendar month m of the window (months with no signal trade count as 0),
  `x_m = sum over signal trades ENTERED in m of (net R - mu_base)` (pooled tests: summed over the indices, each with its own
  `mu_base`); t = mean(x) / (sd(x) / sqrt(M)), M = the number of months. One-sided p from the normal distribution (D > 0).
- Holm over T1, T2, T3 on the decisive p values.
- **Placebo**: 40 seeds (1 to 40, a fixed generator). For each seed and each test, as many days as the test has signal days in
  the decisive window are drawn at random (without replacement) from all days of that window with 252 days of history, per index;
  the same one-at-a-time stream is run on them and its D and t computed against the real `mu_base`. Reported: the placebo
  median D and t, and how many of the 40 seeds reach the real t. Not part of the pass bar.
- Reported too: n, gross R and net R a trade, total, win rate, for signal and baseline streams, per test and window; per index.

## Pass bar (each test)
A test PASSES only if all three hold:
1. D > 0 in the decisive window AND in the replication window;
2. Holm-adjusted decisive p < 0.05;
3. n >= 30 signal trades in the decisive window.

**Verdict: PASS if T1 passes** (the question is about the S&P 500). T2 (does it carry to other indices) and T3 (the opposite
claim) are judged with the same bar and reported beside it. A PASS is never called an edge without its n and t, and is a
proposal only.

## Not tested
Other distances (2 %, 5 %), other horizons, a short at the high, sizing, combining with any council system. Any of these needs
its own pre-registration.
