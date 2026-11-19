# Pre-registration: mean reversion of the gold / silver ratio, out of sample (13 Nov 2026)

Written and committed alone, before any ratio, z-score or trade is computed.

## Why
The gold / silver price ratio is often described as mean-reverting. Pairs trading in general was documented by Gatev, Goetzmann
and Rouwenhorst (2006, "Pairs trading: performance of a relative-value arbitrage rule"); the claim for gold / silver in particular
is mostly practitioners' and rarely tested out of sample or net of costs. This study tests the simple textbook version once, with
every number fixed here.

**Scope.** A stand-alone relative-value rule on two metals. It is not a change to any gold book system (Gold trend, Gold daily
engulf, or anything else of the council), so the 12 Nov 2026 rule of docs/owner-decisions.md item 44 (no further gate, exit,
entry or size tested on the gold book's 2006-17 window) does not apply: nothing here gates, exits, sizes or enters a book
system. It is research only: no live rule, size, filter, stop, config or council member changes, whatever the verdict.

## Data
OANDA mid daily candles from council-data `research/daily/xau.json` (XAU_USD) and `research/daily/xag.json` (XAG_USD), read with
`git show origin/council-data:...` (no network). The cache's daily candles are **UTC-aligned (00:00 UTC to 00:00 UTC)**, not
17:00 New York days: the task asked for the 17:00 New York close, and the cache does not hold it. The UTC close (00:00 UTC) is
used as the daily close; this deviation is stated here before any result. Candles dated Saturday or Sunday (UTC) are dropped;
only days present in both files are used (inner join on the candle time).

## Signal (all at a day's close, using that close and earlier ones only)
- `L_t = ln(close_xau_t / close_xag_t)`.
- `z_t = (L_t - mean) / sd`, mean and sample standard deviation of `L` over the **250 days before t** (`t-250 .. t-1`; today's
  value is not in its own window). No z before 250 earlier days exist.
- Entry: flat and armed, `z_t >= 2` → **sell gold / buy silver** (ratio short); `z_t <= -2` → **buy gold / sell silver**
  (ratio long). The trade is entered at the **next day's open** (both legs), never at the signal close.
- Re-arm: after any exit a new entry needs a close with `|z| < 2` first (so each entry is a fresh crossing; a stopped or timed-out
  trade cannot re-enter the next day on the same stretch). At the start the rule is armed. One position at a time.

## Sizing
Equal-volatility legs: `sigma` = sample standard deviation of the 60 daily log returns of each metal ending at the signal close.
Weights of a unit of gross notional: `w_gold = sigma_xag / (sigma_xau + sigma_xag)`, `w_silver = sigma_xau / (sigma_xau +
sigma_xag)` (each leg carries the same dollar volatility; gross notional 1). Fixed at entry, never rebalanced. The two legs are
opposite (one long, one short), so the book is market-neutral in volatility terms rather than exactly equal in dollars.

## Exits (checked at each close after entry; executed at the next day's open)
1. **Stop** (every position has one, fixed at entry and never moved): the log-ratio level `L_stop = mean_e + 3.5 x sd_e` for a
   ratio short (`mean_e - 3.5 x sd_e` for a ratio long), with `mean_e`, `sd_e` the window statistics of the signal day. A close
   at or beyond it exits.
2. **Target**: `z` (on its rolling window) crosses 0: `z <= 0` for a ratio short, `z >= 0` for a ratio long.
3. **Time**: the close of the 60th trading day after entry.
Stop is checked first, then target, then time. A trade still open at the data's end is dropped (not counted).

## Return of a trade, net
Gross: `w_gold x side_gold x (P_gold_exit / P_gold_entry - 1) + w_silver x side_silver x (P_silver_exit / P_silver_entry - 1)`, in
% of gross notional (side +1 long, -1 short; entry and exit prices = the opens).
Costs, in the same units:
- Spreads, round trip: **gold $0.35 an ounce** (`w_gold x 0.35 / P_gold_entry`), **silver $0.03 an ounce** (`w_silver x 0.03 /
  P_silver_entry`).
- Financing, long legs only, by `council/fills.mjs` `nights(entry, exit)` (Monday-Friday 22:00 UTC rollovers, Wednesday three):
  gold long `nights x FIN.xau.long` (0.000148 of price a rollover, the demo broker's rate) `x w_gold`. **Silver long: assumed at the
  same rate, 0.000148 a rollover** (about 5.4 % a year; the demo's symbol file carries no XAGUSD swap). Short legs: nothing charged
  and nothing credited.

## Windows
By entry date. **Confirmation: 2006 to end-2017** (in practice from the first z, about March 2007). **2018 to now: reported apart.**

## Pass (all three)
1. 2006-17: mean net return a trade > 0 with **t >= 2**, where t is the **stricter (smaller) of** the per-trade t (mean / (sd /
   sqrt n)) and the t of calendar-month sums (months with at least one entry; month of entry).
2. 2018 to now: mean net return a trade > 0.
3. **Placebo**: 40 seeds (fixed, 1..40). For each seed, every real 2006-17 trade is replaced by a trade with the same side and the
   same holding length in trading days, entered at the open of a day drawn uniformly from the 2006-17 days on which such a trade
   fits, costs the same way (no stop or target: the real exit length is kept). The real 2006-17 mean net must beat **at least 38 of
   the 40** placebo means (the 95th percentile).

Verdict PASS only if all three hold; otherwise FAIL. Reported, not tested: trades per window, win rate, how each exit was reached,
worst drawdown of the summed returns, year by year, gross against net, the side split.

## Files
`run.mjs` (the rule, reads the two files, writes `result.json`), `RESULT.md` (verdict first), `tests/gold-silver-ratio.test.mjs`
(offline: the z-score has no look-ahead, entry / exit / stop on a hand-made series, RESULT.md agrees with result.json). A proposal
(paper shadow for the owner) only if it passes.
