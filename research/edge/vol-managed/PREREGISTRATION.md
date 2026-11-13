# Pre-registration: volatility-managed exposure on US indices (13 Nov 2026)

Written and committed before `run.mjs` exists and before any number of this study is computed.

## Why, and what this is not

The academic claim (Moreira and Muir 2017, "Volatility-Managed Portfolios"): holding a market with an exposure scaled by the
inverse of last month's realized variance raises its Sharpe ratio. A later replication across many factors and markets
(Cederburg, O'Doherty, Wang and Yan 2020) found the gain often does not survive out of sample once the scaling constant has to
be known in advance. This study asks the plain question on the US index CFDs the council can read: **would a month-by-month
volatility-managed long on the S&P 500, the Nasdaq 100 and the Dow 30 have beaten simply holding them, after costs, on data the
scaling never saw?**

This is a **stand-alone index allocation rule**. It is not a gate, exit, entry or size of the gold book (Gold trend + Gold daily
engulf): owner decision item 44 (no further tests on that book's 2006-17 window) is untouched. No gold data is read. Nothing
live changes whatever the verdict; a PASS would only allow a paper-shadow proposal for the owner.

## Data

- OANDA mid daily candles from council-data `research/daily/<key>.json` (`spx500`, `nas100`, `us30`; read with
  `git show origin/council-data:...`, no network). UTC daily alignment. Saturday / Sunday candles (the Sunday-evening reopen
  stub) are folded into the next weekday: its open becomes that weekday's open, high / low over both, the weekday's close; a
  trailing weekend candle is dropped. Returns are weekday close to weekday close.
- Price returns only: the CFD price series carries no dividends; the rule and the benchmark are treated alike.
- 2-year Treasury yield: FRED `DGS2` weekly values from council-data `macro/cache.json` (`score.fred.DGS2`). For a day, the
  latest weekly value dated at least 7 days before it. If the file or a date is missing, a stated constant of 3.0 % is used and
  the report says how many days used it.

## Rule

- Months are calendar months. A position is set at the close of the last weekday of a month and held through the next month.
- RV = sum of the squared daily returns of the 22 weekdays ending at that close (needs 22 returns; nothing later).
- **Variant V (variance, the paper's)**: weight w = min(c / RV, 2).
- **Variant S (volatility)**: weight w = min(c / sqrt(RV), 2).
- **c** per market and variant: solved (bisection) so that the mean CAPPED weight over the months whose position starts in the
  discovery window (positions for January 2008 to December 2015) equals 1. c is then frozen and used unchanged for 2016 on. No
  figure from 2016 on is used to choose anything.
- Long only. Within a month the weight is held constant on equity (daily return = w x the market's daily return).
- **Catastrophe stop** (every position has a stop): at the month's entry close, stop = entry close - 3 x ATR(20), ATR(20) =
  simple mean of the true ranges of the 20 weekday candles ending at that close (folded candles). The stop never moves within
  the month. If a day's low reaches it, the position exits at the stop, or at that day's open when the open is already below it
  (a gap); the position is then flat until the month's last close, where a new month's position and stop are set.
- **Benchmark**: weight 1 every month, with the same stop rule, the same costs and financing.

## Costs (both the rule and the benchmark)

- Spread: 0.03 % of price per round trip for these index CFDs (the round trip used by `trend-breadth` / `trend-breadth-h1`),
  charged as 0.015 % per unit of notional traded: |new weight - old weight| at each month end (from 0 after a stop), and the
  weight at a stop exit. The very first position pays its entry. Drift of the held notional within a month is not charged.
- Financing on the held notional: w x (DGS2 + 2.5 %) / 365 per calendar day from the previous close to this one, for every day
  the position was held at the previous close. No credit on a flat day.

## Windows

- Discovery / scaling: monthly positions January 2008 to December 2015 (c is fitted here).
- Decisive: January 2016 to the last complete month in the data (October 2026).

## Statistics

- Monthly net returns (compounded from the daily net returns). Sharpe = mean / sd x sqrt(12) of monthly net returns (financing
  is already charged on the notional, so no risk-free rate is subtracted, for the rule and the benchmark alike).
- Max drawdown on the compounded daily net equity, within the window.
- Paired month block bootstrap on the decisive window: blocks of 6 consecutive months (circular), the rule's and the benchmark's
  months drawn together, 2,000 draws, seeded (mulberry32, seed 20261113). P = share of draws in which the rule's Sharpe minus
  the benchmark's is above 0.

## Primary test and verdict

The judged series is the **equal-weight book**: each day the mean of the three markets' net daily returns (each market with its
own c, stop, costs), against the equal-weight benchmark built the same way. The three single markets are reported, not judged.

A variant PASSES when all hold on the book:
1. decisive Sharpe(rule) - Sharpe(benchmark) > 0;
2. paired bootstrap P >= 0.9, with Holm over the two variants on p = 1 - P (the smaller p must be <= 0.05, the larger <= 0.10;
   a variant whose P is under 0.9 fails regardless);
3. decisive max drawdown of the rule not deeper than the benchmark's;
4. discovery-window Sharpe difference also > 0 (same sign).

Verdict: **PASS** if at least one variant passes, else **FAIL**. Every figure is reported with n (months) and the Sharpe
difference's bootstrap P; no "edge" word without them.

## Not tested, said in advance

Other markets, other look-backs, other caps or stops, leverage beyond 2x, dividends, tax. Any of these needs its own
pre-registration. A PASS leads to at most a paper-shadow proposal; no live rule, size or council member changes.
