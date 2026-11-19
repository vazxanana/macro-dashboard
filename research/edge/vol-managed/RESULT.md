# Result: volatility-managed exposure on US index CFDs (13 Nov 2026)

**Verdict: FAIL** on the pre-registered bar (PREREGISTRATION.md, committed before any number was computed). Equal-weight book of S&P 500, Nasdaq 100 and Dow 30, decisive window 2016-01 to 2026-10 (130 months): variant V (c / variance) Sharpe +0.40 against +0.51 for holding (difference -0.11, bootstrap P 0.285); variant S (c / volatility) +0.46 (difference -0.05, P 0.348). Not an edge; nothing live changes and no proposal is written.

A stand-alone index allocation rule: not a test of the gold book (owner decision item 44 untouched). Net of a 0.03 % round-trip spread per unit traded and of financing at DGS2 + 2.5 % a year on the held notional; price returns only (no dividends), for the rule and the benchmark alike. Every position carries a 3 x ATR(20) daily catastrophe stop.

## The book (judged)

| Series | Window | Months | Sharpe | Return a year | Max drawdown |
|---|---|---|---|---|---|
| Benchmark (weight 1) | 2008-15 (scaling) | 96 | +0.21 | +2.0 % | -44.4 % |
| Benchmark (weight 1) | 2016-01 to 2026-10 | 130 | +0.51 | +6.7 % | -31.9 % |
| V: c / variance | 2008-15 (scaling) | 96 | +0.13 | +0.9 % | -21.4 % |
| V: c / variance | 2016-01 to 2026-10 | 130 | +0.40 | +4.3 % | -19.6 % |
| S: c / volatility | 2008-15 (scaling) | 96 | +0.24 | +2.2 % | -22.6 % |
| S: c / volatility | 2016-01 to 2026-10 | 130 | +0.46 | +5.3 % | -24.5 % |

| Check (book) | V | S |
|---|---|---|
| 1. decisive Sharpe difference > 0 | -0.11 **not met** | -0.05 **not met** |
| 2. paired 6-month block bootstrap P >= 0.9 (2,000 draws) | 0.285 **not met** | 0.348 **not met** |
| 2b. Holm over the two variants | **not met** | **not met** |
| 3. decisive max drawdown not deeper | -19.6 % vs -31.9 % met | -24.5 % vs -31.9 % met |
| 4. 2008-15 Sharpe difference > 0 | -0.07 **not met** | +0.03 met |
| **Variant passes** | no (fails: dSharpePos, bootP09, holm, discSameSign) | no (fails: dSharpePos, bootP09, holm) |

## The three markets (reported, not judged)

| Market | Series | c | Mean weight 2016+ | Months at the 2x cap | Stops 2016+ | Sharpe 2008-15 | Sharpe 2016+ | Return a year 2016+ | Max drawdown 2016+ |
|---|---|---|---|---|---|---|---|---|---|
| S&P 500 | Benchmark (weight 1) | 1 | 1.00 | +0 % | 37 | +0.03 | +0.54 | +6.7 % | -29.1 % |
| S&P 500 | V: c / variance | 0.001566 | 1.21 | +28 % | 37 | +0.01 | +0.31 | +3.3 % | -18.9 % |
| S&P 500 | S: c / volatility | 0.04091 | 1.18 | +12 % | 37 | +0.09 | +0.39 | +4.4 % | -23.1 % |
| Nasdaq 100 | Benchmark (weight 1) | 1 | 1.00 | +0 % | 42 | +0.37 | +0.48 | +7.8 % | -43.9 % |
| Nasdaq 100 | V: c / variance | 0.002068 | 0.95 | +15 % | 42 | +0.24 | +0.50 | +6.6 % | -21.2 % |
| Nasdaq 100 | S: c / volatility | 0.04643 | 0.98 | +4 % | 42 | +0.37 | +0.53 | +7.4 % | -30.7 % |
| Dow 30 | Benchmark (weight 1) | 1 | 1.00 | +0 % | 39 | +0.17 | +0.43 | +5.1 % | -27.1 % |
| Dow 30 | V: c / variance | 0.001327 | 1.14 | +22 % | 39 | +0.10 | +0.25 | +2.4 % | -36.8 % |
| Dow 30 | S: c / volatility | 0.03740 | 1.11 | +6 % | 39 | +0.18 | +0.33 | +3.5 % | -27.6 % |

## Notes

- c is fitted on positions for January 2008 to December 2015 only (mean capped weight 1 there) and frozen; the mean weight after 2015 is whatever c gives.
- Data: OANDA mid daily candles, council-data `research/daily/` (weekend stubs folded into Monday), last bar 2026-11-06. DGS2 from council-data `macro/cache.json` (weekly, at least 7 days old); days from 2008 on the 3.0 % fallback: 0.
- Sharpe on monthly net returns without a risk-free rate (financing is already charged on the notional). The bootstrap resamples the rule and the benchmark months together.
- Not tested (pre-stated): other markets, look-backs, caps or stops, dividends. Any of them needs its own pre-registration.
- To repeat: `node research/edge/vol-managed/run.mjs fetch <dir>` then `node research/edge/vol-managed/run.mjs full <dir>`.
