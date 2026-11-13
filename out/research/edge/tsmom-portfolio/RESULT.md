# Diversified time-series momentum portfolio: result

**Verdict: FAIL** (pre-registered bar: 2008-17 Sharpe > 0.4 missed, t >= 2 missed; 2018-26 total > 0 missed).

2008-01 to 2017-12 (120 months): Sharpe -0.26, t -0.82, -3.43 % a year at 13.24 % volatility, worst drawdown -64.03 % (monthly) / -68.47 % (daily), 45 % of months positive.
2018-01 to 2026-10 (106 months, after both publications): Sharpe -0.26, t -0.78, total -28.04 %, -3.17 % a year at 12.17 % volatility, worst drawdown -53.18 % (monthly) / -55.3 % (daily).

Net of the pre-registered trading costs, gold-long financing (`council/fills.mjs` `FIN`) and an assumed 2.5 % a year broker markup on every other position. Returns are summed on a constant equity of 1 (not compounded). Paper research: no live rule, size, filter, stop or council member changed.

## Setup

Rule: 12-month sign, 40 % annual volatility a market (60-day centre-of-mass EWMA, cap 10x), equal weight over N, gross cap 3x, monthly rebalance at the next open, 3 x ATR(20) catastrophe stop. 20 markets, none dropped (every history starts before 2008: latest xau 2006-03-20). Data: council-data `research/daily/<key>.json`, OANDA mid daily candles to 2026-11-06, weekend stubs folded into Monday. Mean gross notional 2.83x equity (2008-17) and 2.94x (2018-26). Catastrophe stops hit: 1747 over 294 holding months x 20 markets.

**What out of sample means.** The 2008-17 window overlaps the samples of the two published papers (to 2009 and to 2016); it is out of this repository's sample only (nothing fitted). 2018 onward is after both publications.

## Portfolio and asset classes

### 2008-01 to 2017-12

| Stream | Months | Mean % a month | Sharpe | t | Total % | Worst drawdown % |
|---|---|---|---|---|---|---|
| **Portfolio** | 120 | -0.2856 | -0.26 | -0.82 | -34.27 | -64.03 |
| Metals (contribution) | 120 | +0.044 | +0.17 | +0.55 | +5.28 | -7.76 |
| Equity indices (contribution) | 120 | +0.0631 | +0.12 | +0.39 | +7.58 | -19.11 |
| Energies (contribution) | 120 | +0.0422 | +0.14 | +0.46 | +5.07 | -9.42 |
| Bonds (contribution) | 120 | -0.2136 | -0.68 | -2.16 | -25.64 | -29.81 |
| Forex majors (contribution) | 120 | -0.2212 | -0.43 | -1.36 | -26.55 | -34.62 |

### 2018-01 to 2026-10

| Stream | Months | Mean % a month | Sharpe | t | Total % | Worst drawdown % |
|---|---|---|---|---|---|---|
| **Portfolio** | 106 | -0.2646 | -0.26 | -0.78 | -28.04 | -53.18 |
| Metals (contribution) | 106 | +0.0692 | +0.3 | +0.88 | +7.33 | -10.93 |
| Equity indices (contribution) | 106 | -0.0554 | -0.11 | -0.34 | -5.87 | -25.77 |
| Energies (contribution) | 106 | -0.0083 | -0.03 | -0.08 | -0.88 | -10.27 |
| Bonds (contribution) | 106 | -0.0315 | -0.1 | -0.29 | -3.34 | -12.27 |
| Forex majors (contribution) | 106 | -0.2386 | -0.54 | -1.6 | -25.29 | -30.35 |

A class row is the sum of its markets' returns inside the portfolio (same weights), so the class rows add up to the portfolio; descriptive.

## Sensitivities (never deciding)

| Variant | Window | Sharpe | t | % a year | Total % | Worst drawdown % |
|---|---|---|---|---|---|---|
| As pre-registered | 2008-17 | -0.26 | -0.82 | -3.43 | -34.27 | -64.03 |
| As pre-registered | 2018-26 | -0.26 | -0.78 | -3.17 | -28.04 | -53.18 |
| Costs x2 (trading and financing) | 2008-17 | -0.77 | -2.43 | -10.1 | -100.99 | -121.17 |
| Costs x2 (trading and financing) | 2018-26 | -0.83 | -2.46 | -9.99 | -88.21 | -103.78 |
| No financing at all | 2008-17 | +0.19 | +0.59 | +2.51 | +25.09 | -37.87 |
| No financing at all | 2018-26 | +0.24 | +0.72 | +2.97 | +26.27 | -29.25 |

### Post-hoc diagnostics (added after the result was seen; never deciding)

| Variant | Window | Sharpe | t | % a year | Total % | Worst drawdown % |
|---|---|---|---|---|---|---|
| No trading costs, no financing | 2008-17 | +0.24 | +0.77 | +3.25 | +32.45 | -36.47 |
| No trading costs, no financing | 2018-26 | +0.3 | +0.88 | +3.64 | +32.12 | -28.63 |
| No catastrophe stop, no costs, no financing | 2008-17 | +0.33 | +1.05 | +4.85 | +48.48 | -32.51 |
| No catastrophe stop, no costs, no financing | 2018-26 | +0.36 | +1.06 | +4.88 | +43.13 | -30.7 |
| No catastrophe stop, trading costs, no financing | 2008-17 | +0.31 | +0.99 | +4.56 | +45.58 | -33.02 |
| No catastrophe stop, trading costs, no financing | 2018-26 | +0.34 | +1 | +4.61 | +40.75 | -30.9 |
| No catastrophe stop, all costs | 2008-17 | -0.18 | -0.55 | -2.55 | -25.54 | -53.91 |
| No catastrophe stop, all costs | 2018-26 | -0.21 | -0.62 | -2.84 | -25.08 | -49 |

Financing took 5.94 % a year in 2008-17 and 6.14 % in 2018-26 (almost all of it the assumed markup on about 2.83x gross notional); trading costs 0.74 % and 0.67 % a year.

## Crisis months (descriptive)

| Month | Portfolio % | Metals | Equity indices | Energies | Bonds | Forex majors |
|---|---|---|---|---|---|---|
| **2008 crash (Sep-Dec 2008)** | +18.91 | -2.63 | +9.98 | -0.5 | +6.11 | +5.96 |
| 2008-09 | +0.71 | -1.59 | +4.86 | -1.45 | +0.06 | -1.17 |
| 2008-10 | +10.29 | -0.26 | +4.78 | -1.86 | -0.2 | +7.83 |
| 2008-11 | +5.79 | -0.81 | +0.84 | +1.59 | +3.92 | +0.26 |
| 2008-12 | +2.12 | +0.03 | -0.5 | +1.22 | +2.33 | -0.96 |
| **2020 Covid (Feb-Apr 2020)** | -0.1 | -1.03 | -3.97 | +5.85 | +1.08 | -2.02 |
| 2020-02 | -0.6 | -0.44 | -2.22 | +1.18 | +1.09 | -0.21 |
| 2020-03 | +3.73 | -0.79 | -0.29 | +5.41 | -0.08 | -0.51 |
| 2020-04 | -3.23 | +0.2 | -1.46 | -0.74 | +0.07 | -1.3 |
| **2022 (whole year)** | +2.85 | -2.5 | -11.46 | +0.16 | +9.32 | +7.36 |
| 2022-01 | +2.41 | +0.43 | -1.86 | +1.79 | +1.44 | +0.61 |
| 2022-02 | -4.29 | -0.85 | -2.98 | +0.56 | +0.18 | -1.2 |
| 2022-03 | +2.17 | -0.37 | -0.82 | +1.37 | +0.05 | +1.94 |
| 2022-04 | +3.85 | -0.95 | -1.45 | +0.73 | +1.95 | +3.58 |
| 2022-05 | -2.21 | -0.08 | -0.99 | +1.23 | -0.3 | -2.07 |
| 2022-06 | +6.43 | +0.68 | +2.68 | -1.15 | +0.85 | +3.37 |
| 2022-07 | -6.06 | -0.69 | -2.55 | -0.07 | -2.14 | -0.61 |
| 2022-08 | +9.25 | +1.38 | +1.25 | -0.64 | +3.46 | +3.8 |
| 2022-09 | +6.63 | -0.23 | +0.98 | -1.63 | +3.96 | +3.55 |
| 2022-10 | -5.11 | -0.43 | -3.58 | -0.14 | -0.61 | -0.35 |
| 2022-11 | -9.95 | -1.27 | -2.95 | -0.63 | -1.38 | -3.71 |
| 2022-12 | -0.27 | -0.12 | +0.81 | -1.26 | +1.86 | -1.55 |

## Reading

- Largest contributor 2008-17: Equity indices (7.58 %); smallest: Forex majors (-26.55 %). 2018-26: Metals (7.33 %) and Forex majors (-25.29 %).
- At the bar's t of 2, 120 months need a Sharpe of about 0.63; the 2008-17 Sharpe is -0.26.
- The bar is missed before any cost too (post-hoc): with no stop, no trading cost and no financing the rule makes Sharpe 0.33 (t 1.05) in 2008-17 and 0.36 (t 1.06) in 2018-26. The pre-registered catastrophe stop costs about 1.6 % a year in 2008-17 (hit 1747 times; a stopped market stays flat to the month end), and financing at the assumed markup about 5.94 % a year: on CFDs at about 2.83x gross notional, a 2.5 % markup alone takes more than the rule earned gross.
- The pre-registered bar was not met: no proposal is written and nothing changes. Any variant (other look-backs, a volatility target on the portfolio, more markets, a carry adjustment) would be a new study with its own pre-registration, judged on data it was not chosen on.

## What this is not

- Not the futures-based return of the papers: the OANDA mid is a spot price, so the carry a futures position embeds (interest differentials, dividends, commodity roll) is not in these returns, and the cash rate a CFD broker charges or credits is not modelled beyond the assumed 2.5 % markup (PREREGISTRATION.md "Financing").
- 20 markets, not the papers' 58 (or 67): the published diversification is larger. Commodities other than metals and energies are absent.
- Not an edge in the council: no forward record exists. Never call it one without n, t and a forward record.

To repeat: `node research/edge/tsmom-portfolio/run.mjs fetch <dir>`, then `node research/edge/tsmom-portfolio/run.mjs full <dir>`. Tests: `tests/tsmom-portfolio.test.mjs`.
