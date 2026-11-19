# 52-week-high proximity rotation across equity indices: pre-registration

Written and committed **before** any return below was computed (13 Nov 2026). The rule, the costs, the windows, the
placebo and the pass bar are fixed here; nothing in them changes after the results are seen. Anything added later is
labelled a post-hoc diagnostic in `RESULT.md`. Paper research only: no live rule, size, filter, stop or council member
changes, whatever the result.

## Idea

George and Hwang (2004, Journal of Finance) found that a stock's nearness to its 52-week high predicts its next returns
better than its past return does (anchoring: traders under-react near the high). This study asks one question: does a
**cross-sectional** version, across eleven equity-index CFDs, beat simply holding all eleven? It is a rotation (which
indices to hold), not a timing rule (whether to hold equities): today's 12-month time-series momentum and 10-month SMA
timing studies (`tsmom-portfolio`, `gold-tsmom`, `sma10-timing`, all FAIL) asked the timing question and are not repeated.

## Data

OANDA mid daily candles from the council's candle cache, council-data `research/daily/<key>.json` (copied with `git show`,
no network), weekend stubs folded into Monday (`council/fills.mjs` `foldWeekend`). Universe, fixed:
`spx500 nas100 us30 us2000 de40 uk100 jp225 eu50 fr40 au200 hk33`. A key missing from the cache, or whose history starts
after 2006-12-31 (no 252-day score by 2008), is dropped before the run and named in `RESULT.md`; the rest run unchanged.
(Checked from `_index.json` only, before any price was read: all eleven are present from 2003-04.)

## Rule

- **Decision** at each month end `m`: the last daily candle of `m` (it must be within 5 calendar days of the month's last
  day, else the index is not eligible that month). Nothing after that candle is read.
- **Score** = close / max(close over the 252 trading days ending at and including that close); in (0, 1]. An index needs
  252 closes to have a score.
- **Pick**: the 3 highest scores among the eligible indices (ties: the lower key alphabetically). Fewer than 3 eligible:
  no position that month (does not occur after 2005).
- **Weights**: equal risk = inverse 60-day volatility (sample standard deviation of the last 60 daily close-to-close
  returns ending at the decision close), normalised to sum to 1 (gross 1x equity, long only).
- **Holding**: from the first open of month `m+1` to its last close; the weight change against what is held is traded at
  that open; the next month's decision is made at the close of `m+1`.
- **Catastrophe stop** on every position: first open of the holding month minus 3 x ATR(20) at the decision candle
  (Wilder true range, simple 20-day mean). A daily low at or under the stop exits at the stop; an open under it exits at
  the open. A stopped index is flat to the month end and re-enters at the next rebalance if picked again.
- **Benchmark**: all eligible indices, equal weight 1/N notional (gross 1x), the same holding, the same 3 x ATR(20) stop,
  the same costs and financing.

## Costs

- **Trading**: round trip as a fraction of price, half charged on each side of every weight change and on each stop exit:
  spx500, nas100, us30, de40 0.02 %; uk100, eu50, fr40 0.03 %; jp225, au200 0.04 %; us2000, hk33 0.05 %
  (spread plus slippage, typical CFD quotes).
- **Financing**, every rollover held (`council/fills.mjs` `nights`: Mon-Fri 22:00 UTC, Wednesday three), on the notional:
  (the index currency's cash rate for that calendar year + 2.5 % a year) / 365. Currency: USD for spx500, nas100, us30,
  us2000, jp225 (OANDA's JP225 is USD-quoted); EUR for de40, eu50, fr40; GBP uk100; AUD au200; HKD hk33. Cash rate a year
  (approximate policy-rate year averages, %, stated here and used as written):

| Year | USD | EUR | GBP | AUD | HKD |
|---|---|---|---|---|---|
| 2007 | 5.0 | 3.9 | 5.5 | 6.5 | 5.0 |
| 2008 | 2.0 | 3.9 | 4.7 | 6.7 | 2.0 |
| 2009 | 0.2 | 1.3 | 0.6 | 3.3 | 0.2 |
| 2010 | 0.2 | 1.0 | 0.5 | 4.4 | 0.2 |
| 2011 | 0.1 | 1.3 | 0.5 | 4.7 | 0.2 |
| 2012 | 0.1 | 0.9 | 0.5 | 3.7 | 0.2 |
| 2013 | 0.1 | 0.6 | 0.5 | 2.8 | 0.2 |
| 2014 | 0.1 | 0.2 | 0.5 | 2.5 | 0.2 |
| 2015 | 0.1 | 0.05 | 0.5 | 2.1 | 0.2 |
| 2016 | 0.4 | 0 | 0.4 | 1.6 | 0.4 |
| 2017 | 1.0 | 0 | 0.3 | 1.5 | 1.0 |
| 2018 | 1.8 | 0 | 0.6 | 1.5 | 1.8 |
| 2019 | 2.2 | 0 | 0.75 | 1.1 | 2.2 |
| 2020 | 0.4 | 0 | 0.2 | 0.3 | 0.5 |
| 2021 | 0.1 | 0 | 0.1 | 0.1 | 0.1 |
| 2022 | 1.7 | 0.3 | 1.5 | 1.3 | 1.8 |
| 2023 | 5.0 | 3.3 | 4.7 | 3.9 | 4.6 |
| 2024 | 5.1 | 3.9 | 5.1 | 4.35 | 5.0 |
| 2025 | 4.2 | 2.3 | 4.3 | 4.0 | 4.0 |
| 2026 | 3.7 | 2.0 | 3.8 | 3.6 | 3.6 |

  Negative policy rates are floored at 0 (a CFD long is never credited). Dividends are not credited: the OANDA mid is a
  price index (see "What this cannot show").
- Returns are summed on a constant equity of 1 (not compounded), daily rows summed to calendar months.

## Windows

Holding months 2008-01 to 2015-12 (replication) and **2016-01 to the last complete month of the cache (decisive)**.

## Pass bar (all must hold)

1. Decisive window: mean monthly excess return (rotation minus benchmark) > 0 with a Newey-West t (3 lags, Bartlett) >= 2.
2. Replication window 2008-15: mean monthly excess > 0 (same sign).
3. Decisive window: annualised Sharpe of the rotation (monthly mean / sd x sqrt 12) >= the benchmark's.
4. **Placebo**: 40 seeded runs (seeds 1-40) that pick 3 eligible indices at random each month (same weights, stop, costs,
   financing). The rotation's decisive mean excess must exceed the 95th percentile of the 40 placebo means.

Any one missed = **FAIL**. A PASS leads only to a proposal for a paper shadow book (`research/proposals/`); never a live
change without the owner.

## Reported, never deciding

Each window: n, mean, Sharpe, t, total, worst drawdown for the rotation and the benchmark; a second, descriptive benchmark
(all eligible indices at inverse 60-day volatility weights); costs x2; no financing; how often each index was picked; the
stop count.

## What this cannot show

- Dividends: a CFD long is credited the index dividend; a price index omits it. Dividend yields differ across these
  indices (UK and Hong Kong high, Nasdaq low), so the price-only excess is biased against high-yield picks; reported, not
  corrected.
- Currency: returns are in each index's own currency (no FX translation), as a CFD account in that currency would book them.
- Eleven indices, heavily correlated (four US, three euro-area), is a narrow cross-section; the paper used thousands of stocks.
