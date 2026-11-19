# Pre-registration: weekly time-series momentum in crypto, out of sample (13 Nov 2026)

Written and committed before any result of this rule was computed. Paper research only: no live rule, size, filter, stop,
config or council member changes, whatever the result.

## Why

Liu and Tsyvinski (Review of Financial Studies 2021, "Risks and returns of cryptocurrency"; NBER working paper w24877, 2018)
report strong time-series momentum in Bitcoin and other coins at horizons of one to four weeks. Their sample ends in 2018 (as
recalled from the working paper; the published text could not be opened from this sandbox to confirm the exact end month).
So everything from 2019 on is out of sample for the paper, and the decisive window below (2022 on) is fully out of it.
This is NOT the council's crypto trend rule (55 / 100-day breakouts, `research/edge/crypto-trend-decay`): no breakout, no
channel, a fixed weekly clock and a one-week look-back.

## Data

Binance spot daily klines (UTC days) from the council-data cache `research/candles/crypto1d/<SYM>_1d.json.gz` (read with
`git show origin/council-data:…`, no network; the same cache as crypto-trend-decay). Starts: BTC and ETH 2017-08-17,
XRP 2018-05-04, SOL 2020-08-11; all end 2026-10-31. A coin enters the portfolio once it has 60 closed daily candles.

## The rule (fixed; nothing is tuned)

- **Clock:** every Monday 00:00 UTC (the open of Monday's daily candle). The week runs Monday open to the next Monday open.
- **Signal (per coin):** past one-week return = Sunday's close / the previous Sunday's close − 1, both closed before the Monday
  open. Variant **V1 long / flat**: long if > 0, else flat. Variant **V2 long / short**: long if > 0, short if < 0, flat if 0.
- **Size:** volatility target 40 % a year per coin: weight w = 0.40 / σ, capped at 2; σ = EWMA of squared daily log returns,
  span 30 days (λ = 1 − 2/31), seeded with the first 30 days' variance, through Sunday's close, annualised by √365. Equal
  weight across the coins available that week: each coin gets w / N of the book (N = coins available).
- **Stop (every position has one):** 3 × ATR(14) on daily candles through Sunday, from the Monday open: long stop = open − 3 ATR,
  short stop = open + 3 ATR. Checked on each daily candle of the week; when hit the position is out at the stop (at the candle's
  open if it opened beyond the stop) and stays flat until the next Monday. Otherwise out at the next Monday's open.
- **Costs:** the council's CFD crypto round trip `CFD_CRYPTO` (council/fills.mjs, 0.04 % of price) charged on the position's
  notional every week it is held: each weekly re-size is treated as a close and a re-open (conservative; a turnover-only
  charge is reported beside it, not tested).
- **Financing:** the demo broker's (Fusion Markets) crypto CFD swap in council-data `ctrader/symbols.json` of 13 Nov 2026,
  cTrader swap type 1 = percent a year: longs 15 % a year on BTC, ETH, SOL; shorts 7.5 % BTC, 10 % ETH, 15 % SOL. XRP is not
  offered there: 15 % a year both sides is assumed. Charged as rate / 365 per night held (7 nights a full week; a stopped
  position pays the nights up to its stop day). Today's rate is charged for every year (the past rates are not known).

## Benchmark

Buy and hold, equal weight across the coins available that week (re-weighted every Monday), unlevered, no costs and no
financing (a spot holder pays neither).

## Windows

- 2018-01-01 to 2021-12-31: reported (it overlaps the paper's sample in 2018); not part of the pass.
- **2022-01-03 to the data end (2026-10-31): decisive.**

## Measures

Weekly book return (sum of the coins' w / N × return, net of costs and financing). Sharpe = mean / sd of weekly returns × √52.
Month-sum t = t of the calendar-month sums (a week belongs to the month of its Monday). One-sided p from that t (normal).

## Pass (each variant, decisive window, all of)

1. Sharpe > the buy-and-hold Sharpe in the same window, and Sharpe > 0.5;
2. month-sum t ≥ 2;
3. Holm-adjusted one-sided p < 0.05 over the two variants (V1, V2);
4. placebo: the same book with random weekly signs per coin (V1: long or flat with probability ½; V2: long or short), 40 fixed
   seeds (1-40), same sizing, stops, costs and financing: the real decisive Sharpe beats at least 38 of the 40 (above the 95th
   percentile).

The study passes if either variant passes. Verdict words: **PASS** (one or both pass), **FAIL** (neither).

Also reported, never part of the pass: per coin, per year, gross of costs, turnover-only costs, 2018-21, maximum drawdown.
A pass would lead only to a proposal of a paper shadow (`research/proposals/2026-11-13-crypto-weekly.md`), owner's decision.
