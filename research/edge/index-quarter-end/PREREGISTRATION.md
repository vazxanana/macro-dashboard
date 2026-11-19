# Pre-registration: quarter-end rebalancing flow on US500, by the quarter's stock-minus-bond return (14 Nov 2026)

Written and pushed before any trade or result of this study is computed. Research only: no rule, size, filter, stop, config or
council member changes; paper only. Not an ICT study (`ict/calendar.mjs` is only read for its holiday dates).

## Why, and how this differs from `rebalance-flow`
Pension and balanced funds hold fixed stock / bond weights and rebalance at calendar quarter-ends; window dressing adds to the
flow. After a quarter in which stocks beat bonds, rebalancers sell stocks into the quarter-end, and buy them after a quarter in
which bonds won (Harvey, Mazzoleni and Melone, "The Unintended Consequences of Rebalancing", 2025: strongest at quarter-ends).

`research/edge/rebalance-flow` (branch `rebalance-flow`, FAIL 0 of 4) already tested a close relative and is read first. Its
quarter-end variant (tests B and D) used the MONTH's stock-minus-bond return to the month's fifth-to-last trading day, traded only
when it ranked in the top or bottom third of the 36 prior months, with a 2.5 x ATR stop, over 2016-26 (n 30, -0.021R, t -0.22).
This study's rule is not that test: the signal is the whole QUARTER's stock-minus-bond return (the quantity rebalancers act on at
a quarter-end), its SIGN alone decides the side (every quarter trades), the stop is 1.5 x ATR(20), and the windows are the two
halves of every quarter on file. It is still a close relative of a failed test; that is said here, before any result, and it
makes a pass less likely, not more.

## Data (fixed now)
- Daily OANDA mid candles from the council's daily cache, council-data `research/daily/<key>.json` at commit `147124a93` (cache
  updated 7 Nov 2026, last candle 6 Nov 2026), read with `git show` (no network), copied outside git; `run.mjs` reads them from a
  directory given on the command line: `spx500` (SPX500_USD, traded and the signal's equity leg), `usb10y` (USB10Y_USD, the US
  10-year Treasury note CFD price, the signal's bond leg, price return), and, reported only, `nas100`, `us30`, `de40` (DE30_EUR).
- The 2-year Treasury yield, weekly (FRED DGS2 from council-data `macro/cache.json`), copied from `rebalance-flow/rates.json`
  into `rates.json` beside this file, for financing. It starts 6 Jan 2006: earlier dates use its first value (4.36 %), stated.
- A candle's close is OANDA's 00:00 UTC daily close (3-4 hours after the NYSE cash close). Weekend candles are folded into the
  next weekday candle (open of the first, high / low over all, close and date of the weekday), as in `rebalance-flow`.

## Calendar (copied from `rebalance-flow`)
NYSE trading days: weekdays that are not NYSE holidays (from `ict/calendar.mjs` `cmeYear`: its full closures and the early-close
days that are NYSE holidays) and not the special closures 2 Jan 2007, 29-30 Oct 2012, 5 Dec 2018, 9 Jan 2025. The same NYSE
calendar is used for DE40 (reported only; Xetra days differ, stated). Within a quarter, TD-1 = its last NYSE trading day,
TD-6 = the sixth-to-last; in the next quarter TD+3 = its third.

## The rule (primary: US500 = SPX500)
- For quarter q: **P** = TD-1 of the previous quarter, **E** = TD-6 of quarter q (entry), **X** = TD-1 of quarter q (exit), so the
  trade holds over the quarter's last 5 trading days.
- **Diff(q)** = (SPX500 close(E) / close(P) - 1) - (USB10Y close(E) / close(P) - 1). Diff > 0 (stocks beat bonds) -> SELL at the
  close of E; Diff < 0 -> BUY; Diff = 0 or a missing candle at P or E in either file -> no trade (counted).
- Exit at the close of X unless stopped. One trade a quarter; trades never overlap.
- **Stop (every trade has one)**: 1R = 1.5 x ATR(20), ATR = simple mean of the true range of the 20 folded candles ending with E
  (fewer than 21 folded candles before = no trade). Checked on every folded candle after E up to X: an open at or beyond the stop
  fills at the open (gap), else a low (buy) / high (sell) at or beyond it fills at the stop.

## Costs, in R
- Spread and slippage, a round trip: 0.0003 x entry price (the index cost of `trend-breadth` / `index-overnight`), costR =
  0.0003 x entry / risk. **2x cost** = 0.0006 x entry. Cost 0 = gross.
- Financing on one unit's notional, per calendar night from entry to exit, r = the last weekly DGS2 on or before the entry
  date: a buy pays (r + 2.5) % / 365 x entry a night; a sell receives (r - 2.5) % / 365 x entry (pays when r < 2.5). The same
  formula for DE40 (a euro rate is not on file; stated). "Cost 0" also drops financing; 2x doubles the spread only.
- netR = side x (exit - entry) / risk - costR + finR (finR signed: + received).

## Windows
Quarters with P and E and X on file: Q2 2003 to Q3 2026 (94 quarters). **In sample** = the first half of them in order (the first
47: Q2 2003 to Q4 2014), **out of sample** = the rest (Q1 2015 to Q3 2026). If a quarter cannot trade it still counts in the split
(the split is by quarter, fixed now).

## Statistics
- Event t = mean netR / (sd / sqrt n), sd with n - 1: trades are a quarter apart, so each is one event. About 4 events a year, so n
  is small (about 45 out of sample): the report states the mean net R a trade that t 2 would need at the observed sd
  (2 x sd / sqrt n).
- **Placebo**, 40 seeds (1 to 40, mulberry32), out-of-sample quarters only: per seed and quarter, an entry day drawn uniformly
  from the quarter's NYSE trading days whose 5-trading-day window ends no later than E (the window never overlaps the rule's);
  the side by the same rule (sign of SPX500 minus USB10Y from P to that entry day); the same 1.5 x ATR stop, exit at the close 5
  trading days later, costs and financing. Placebo means are computed at cost 0, base and 2x; the rank used for the bar is at base.

## Pass bar (primary, SPX500 only; all four needed)
1. out-of-sample t >= 2 on netR at base cost;
2. in-sample mean netR > 0 at base cost;
3. out-of-sample mean netR > 0 at 2x cost;
4. the rule's out-of-sample mean netR (base) above at least 38 of the 40 placebo means (>= 95 %).

**Verdict**: PASS if all four hold, else FAIL. A FAIL is a result. No Holm correction: one primary test.

## Reported only, never judged
- The same rule (signal still SPX500 vs USB10Y) on NAS100, US30 and DE40.
- The first 3 trading days of the next quarter: entry at the close of quarter q's TD-1, exit at the close of quarter q+1's TD+3,
  side by the sign of the full quarter's Diff (P to TD-1), the same direction as the quarter-end trade, same stop and costs; on
  all four markets.
- Per window: n, win rate, gross / net R, t, stops, by side, by year.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict first), `tests/index-quarter-end.test.mjs`. No proposal unless PASS; even then
only a paper-shadow proposal for the owner.
