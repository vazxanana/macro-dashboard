**Verdict:** FAIL: on the equal-weight book (SPX500, NAS100, US30, gold), in the decisive window 2016 to 6 Nov 2026 the 10-month average rule cut the worst drawdown from 26.65 % to 14.93 % but earned 3.00 % a year against 8.50 % for buy-and-hold: Sharpe 0.40 against 0.63, and bootstrap P(better return / drawdown) 0.138, far under the 0.9 bar. It held in 2008-15 (Sharpe 0.28 against 0.21, drawdown 12.56 % against 41.81 %), but that is the check window, not the decisive one.

# The 10-month moving-average timing rule, out of sample (13 Nov 2026)

Pre-registered in `PREREGISTRATION.md` (committed alone before any return was computed). Paper research only: a stand-alone
long / flat allocation rule on monthly closes, **not** a gate, size or exit of the gold book (Gold trend + Gold daily engulf;
owner decision 44 is untouched). No live rule, size, filter, stop, config, cost constant or mirror setting changed, and no
proposal is written (the rule failed).

**The rule** (Faber 2007, "A Quantitative Approach to Tactical Asset Allocation", Journal of Wealth Management; its sample
ends in 2006, so both windows here are after the paper): at each month end, hold the market long next month when its
month-end close is above the average of its last 10 month-end closes, else flat; acted on at the next month's first open.
Every position has a catastrophe stop at month-end close − 3 × ATR(20) daily, raised (never lowered) at each month end; a
stopped market stays flat until the next month end. Costs: one stated CFD spread on every entry and exit (SPX500 0.5,
NAS100 1.5, US30 3.0 points, gold $0.30) and financing every night held (gold `FIN.xau.long`, indices DGS2 + 2.5 % a year).
Buy-and-hold pays the same financing. Data: OANDA mid daily candles from council-data `research/daily/`, weekends folded.

## The equal-weight book

| window | | CAGR | volatility | Sharpe | worst drawdown | return / drawdown |
|---|---|---|---|---|---|---|
| 2016 to now (decisive, 131 months) | rule | 3.00 % | 8.08 % | 0.40 | 14.93 % | 0.20 |
| | buy-and-hold | 8.50 % | 14.34 % | 0.63 | 26.65 % | 0.32 |
| 2008-15 (check, 96 months) | rule | 1.96 % | 7.86 % | 0.28 | 12.56 % | 0.16 |
| | buy-and-hold | 2.28 % | 17.18 % | 0.21 | 41.81 % | 0.05 |

Paired monthly-block bootstrap (2,000 draws, seed 20261113), P(rule's return / drawdown better): **0.138** in 2016 to now
(difference 5th / 50th / 95th percentile −0.47 / −0.14 / +0.09), 0.6245 in 2008-15.

## The pass bar, check by check

| check (fixed in the pre-registration) | result |
|---|---|
| 2016 to now: rule Sharpe ≥ buy-and-hold | **no** (0.40 against 0.63) |
| 2016 to now: rule drawdown ≤ two-thirds of buy-and-hold | yes (14.93 % against 17.77 %) |
| 2016 to now: bootstrap P ≥ 0.9 | **no** (0.138) |
| 2008-15: Sharpe ≥ buy-and-hold | yes (0.28 against 0.21) |
| 2008-15: drawdown ≤ two-thirds | yes (12.56 % against 41.81 %) |

## Per market (reported, not judged)

| window | market | rule CAGR | rule Sharpe | rule worst DD | B&H CAGR | B&H Sharpe | B&H worst DD | in the market | positions | stopped |
|---|---|---|---|---|---|---|---|---|---|---|
| 2016 to now | SPX500 | 1.73 % | 0.22 | 28.23 % | 7.09 % | 0.47 | 33.58 % | 67 % | 34 | 34 |
| 2016 to now | NAS100 | 5.58 % | 0.45 | 24.54 % | 11.96 % | 0.61 | 39.06 % | 63 % | 36 | 36 |
| 2016 to now | US30 | 1.39 % | 0.19 | 17.32 % | 5.11 % | 0.38 | 36.05 % | 66 % | 34 | 32 |
| 2016 to now | Gold (XAU) | 1.83 % | 0.20 | 43.91 % | 7.19 % | 0.50 | 32.51 % | 61 % | 31 | 29 |
| 2008-15 | SPX500 | 2.29 % | 0.28 | 17.11 % | 0.97 % | 0.15 | 56.33 % | 55 % | 25 | 24 |
| 2008-15 | NAS100 | 0.71 % | 0.12 | 23.45 % | 6.90 % | 0.39 | 52.56 % | 57 % | 29 | 26 |
| 2008-15 | US30 | 2.05 % | 0.28 | 14.12 % | 0.25 % | 0.11 | 53.23 % | 54 % | 23 | 21 |
| 2008-15 | Gold (XAU) | 1.72 % | 0.19 | 32.96 % | −2.38 % | −0.02 | 56.36 % | 48 % | 19 | 17 |

In 2016 to now the rule beat buy-and-hold's Sharpe on no market, and on gold its worst drawdown was deeper than buy-and-hold's.

## Dividend sensitivity (reported, not judged)

The index candles carry no dividends, which flatters the rule (buy-and-hold is long more often). Crediting a stated yield
while long (SPX500 1.8 %, NAS100 0.8 %, US30 2.0 % a year) to both: 2016 to now rule Sharpe 0.49 against 0.70, drawdown
14.47 % against 26.58 %, bootstrap P 0.1565; 2008-15 rule 0.36 against 0.28. The verdict does not change.

## What it means

- Post hoc reading, not tested: almost every position ended at the catastrophe stop (2016 to now: 131 of 135 positions
  across the four markets), not at a signal exit. The monthly stop raise makes the 3 × ATR(20) stop a trailing stop on
  daily candles, so the rule sits flat for the rest of the month after ordinary pullbacks in a rising market. That is the
  cost of the stop absolute rule 1 requires; a version without a stop cannot be traded here, and a looser stop chosen after
  this result would prove nothing (it would need its own pre-registration on other data).
- What survives: lower volatility and shallower drawdowns on the book in both windows. What does not: the paper's claim of
  a similar or better risk-adjusted return, after 2015, with costs, financing and a stop on every position.
- Not an edge, not a proposal, no paper shadow. No parameter was varied.

## To repeat

`node research/edge/sma10-timing/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/sma10-timing/run.mjs full <dir>` (writes `result.json`). Tests: `tests/sma10-timing.test.mjs`.
