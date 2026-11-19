# The 10-month moving-average timing rule, out of sample: pre-registration

Written and committed **before** any return below was computed (13 Nov 2026). The rule, the data, the costs, the benchmark,
the windows and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. Whatever the outcome, no live rule, size, filter, stop, config, cost constant or mirror setting changes;
a pass would at most lead to a proposal for a paper shadow (`research/proposals/2026-11-13-sma10.md`), for the owner.

## What this is, and what it is not

- **A stand-alone, long / flat allocation rule on monthly closes**, judged mainly on drawdown. It is **not** a gate, size or
  exit of the gold book (Gold trend + Gold daily engulf): owner decision 44 ("no further gate, exit, entry or size is tested
  on this book's 2006-17 window") stands and is not touched. Nothing here is combined with the book or any council system.
- Not the 12-month time-series momentum rule tested earlier the same day (branches `gold-tsmom`, `tsmom-portfolio`, both
  FAIL): that one was long / short on a 12-month return; this one is long / flat on a 10-month average, and its claim is
  smaller drawdowns at a similar risk-adjusted return, not a higher return.
- Source: M. Faber (2007), "A Quantitative Approach to Tactical Asset Allocation", Journal of Wealth Management. Faber's
  sample ends in 2006 (monthly total-return indices), so **every window below is after the paper**: 2008-15 is a check,
  2016 to now is the decisive window.

## Data (seen before this file: only the first and last date of each file)

OANDA mid daily candles from council-data `research/daily/<key>.json` (the weekly daily-candle cache; `git show
origin/council-data:research/daily/<key>.json`, no network): `spx500` (SPX500_USD), `nas100` (NAS100_USD), `us30`
(US30_USD), all from March 2003, and `xau` (XAU_USD) from March 2006; every file ends 6 Nov 2026. The 2-year Treasury yield:
council-data `macro/cache.json` `score.fred.DGS2` (weekly, from January 2006), the value of the latest date on or before the
day. Saturday / Sunday candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` (the council's own
rule; a trailing weekend candle is dropped).

Limitation, said now: the index candles are **price** indices (no dividends), so both the rule and buy-and-hold miss the
dividend a long index CFD is credited; buy-and-hold, always long, misses more, which flatters the rule. A sensitivity run
credits a stated dividend yield while long (SPX500 1.8 %, NAS100 0.8 %, US30 2.0 % a year; rough long-run figures, not
measured) to both; the verdict is read on the primary run without it.

## The rule (per market)

- **Month end** = the last (folded) daily candle of a calendar month. Its close is the month-end close.
- **Signal** at each month end: long next month when the month-end close is above the simple average of the last 10
  month-end closes (this one included), else flat. A market needs 10 month-end closes before its first signal.
- **Execution**: the signal is acted on at the OPEN of the first candle of the next month (never at the close that made
  it: no look-ahead). A switch in (flat -> long) buys at that open; a switch out sells at that open; a market that stays
  long keeps its position (no trade).
- **Catastrophe stop (every position has a stop)**: at each month end, for a position held into the next month, the stop
  is `month-end close - 3 x ATR(20)` (ATR = mean true range of the 20 folded daily candles ending at the month-end candle);
  a position kept from the previous month takes the higher of its old stop and the new one (a stop is never loosened). A
  new position gets this stop at its entry. Each day the position is held: if the open is at or below the stop it exits
  at the open; else if the low reaches the stop it exits at the stop. A stopped market **stays flat until the next month
  end**, where the signal is read again (a long signal re-enters at the next open).
- Size: one unit of notional (1x, unlevered) per market; returns are on that notional, compounded daily.

## Costs (all charged in the primary run)

- **Spread per switch**: every entry and every exit (signal or stop) costs one full stated CFD spread, in price units:
  SPX500 0.5 point, NAS100 1.5 points, US30 3.0 points (typical published retail CFD spreads, stated, not measured here),
  gold $0.30 (the council's own gold charge). A full spread on each side (not half) also covers slippage.
- **Financing while long**: per rollover night held (Monday-Friday 22:00 UTC, a Wednesday counts three: `council/fills.mjs`
  `nights`), as a share of that day's close: gold `FIN.xau.long` (0.000148 a night, the demo broker's rate of 11 Nov 2026,
  charged for every year: today's rate, the highest of the sample); indices `(DGS2 + 2.5 %) / 365`, DGS2 floored at 0.
  A position held at a candle's close pays the nights between that candle's time and the next day's.

## Benchmark

Buy-and-hold of the same market with the **same financing** and one spread at the window's first open (and none at the
end). The benchmark is a reference return series, not a council trade (it has no stop; nothing is traded).

## Windows

- W1 check: 2008-01-01 to 2015-12-31. W2 decisive: 2016-01-01 to the last candle (6 Nov 2026).
- The rule's state at a window's first day comes from signals of the months before it (the history before 2008 is used
  only for the average and the ATR); returns are counted only inside the window. At the window start a market the rule
  holds is bought at that first open (one spread), as buy-and-hold is.

## The book

Equal-weight book of the four markets: each day the book return = the mean of the four markets' daily returns (rebalanced
daily to 25 % each; a market with no candle that day counts 0). The rule's book and the buy-and-hold book are built the same
way.

## Statistics

Per market and for the book, per window: CAGR, annualised volatility, Sharpe = mean / sd of daily returns x sqrt(252) (no
cash rate subtracted: the financing already charges the carry), worst drawdown of the compounded equity, return / drawdown
= CAGR / worst drawdown, time in the market, switches and stops.

Paired block bootstrap: the window's calendar months are drawn with replacement (monthly blocks, 2,000 draws, seeded PRNG
mulberry32 seed 20261113), the same months for both books; each draw concatenates those months' daily book returns and
computes return / drawdown for the rule and for buy-and-hold. P = share of draws where the rule's is higher.

## Pass bar (fixed now; on the equal-weight book)

PASS only when ALL hold:
1. W2: the rule's Sharpe >= buy-and-hold's Sharpe;
2. W2: the rule's worst drawdown <= two-thirds of buy-and-hold's worst drawdown;
3. W2: bootstrap P(rule's return / drawdown better) >= 0.9;
4. W1: conditions 1 and 2 also hold (the bootstrap is reported for W1, not required).

Otherwise FAIL. Per-market results are reported, not judged; a market that passes alone is not a finding. The dividend
sensitivity is reported, not judged. No parameter (10 months, 3 x ATR(20), the costs) is varied or tuned.

## Files

`run.mjs` (reads the cache dir, writes `result.json`), `RESULT.md` (verdict first), `tests/sma10-timing.test.mjs` (offline:
the month-end signal sees no later close, switch costs, the stop and its no-loosen rule, RESULT.md against result.json).
To repeat: `node research/edge/sma10-timing/run.mjs fetch <dir>` (git show from `origin/council-data`), then
`node research/edge/sma10-timing/run.mjs full <dir>`.
