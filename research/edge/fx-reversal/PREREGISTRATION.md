# Cross-sectional 1-week reversal in G10 FX: pre-registration

Written and committed **before** any number below was computed (13 Nov 2026). The rule, the costs, the windows and the pass
bar are fixed here; nothing in them changes after the results are seen. Anything added later is labelled a post-hoc
diagnostic in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. A pass makes a candidate for a
paper shadow that the owner decides on (`research/proposals/`); it is never a live change.

## Why this study

Menkhoff, Sarno, Schmeling and Schrimpf (2012, Journal of Financial Economics, "Currency momentum strategies") and later
work report that cross-sectional currency returns trend over 1-12 months but tend to reverse at very short horizons (about a
week). The 13 Nov 2026 time-series momentum portfolio study (branch `tsmom-portfolio`) found the forex sleeve the worst
contributor at 12 months. This tests the opposite, short horizon, with nothing fitted: one rule, written down before the run.

## Data

- OANDA mid **daily** candles of `eurusd gbpusd usdjpy audusd usdcad usdchf nzdusd` from the council's cache, council-data
  `research/daily/<key>.json` (`node research/edge/fx-reversal/fetch.mjs <dir>` copies them with `git show`, no network;
  the files stay out of git). Checked before writing this (dates only, no returns): every candle starts at **00:00 UTC**
  (complete UTC days, Sunday stubs from the 22:00 UTC reopen included), May 2002 (NZD/USD September 2002) to the candle of
  Friday 6 Nov 2026.
- **The clock.** The task asks for Friday 17:00 New York; these candles close at 00:00 UTC, so the study uses the **close of
  the last Monday-Friday candle of each UTC week** (normally Friday's, closing Saturday 00:00 UTC, about two hours after the
  17:00 New York close) as the decision time. Said here and again in `RESULT.md`.
- **Each currency against the dollar.** For EUR, GBP, AUD, NZD the pair price is used as it is. For JPY, CAD, CHF (USD-base
  pairs) the price of the foreign currency in dollars is the inverse: open' = 1/open, close' = 1/close, **high' = 1/low,
  low' = 1/high**. All returns, ranks, volatilities, ATRs, stops and legs below are on these foreign-vs-USD series, so "buy
  JPY" is a sell of USD/JPY.

## The rule

- **Decision candle** of a week: the last Monday-Friday candle of that UTC week (Monday to Sunday) that all seven series
  have, at the same timestamp. A week without one is skipped (no position).
- **Ranking signal**: each currency's past return = close of this decision candle ÷ close of the previous week's decision
  candle − 1 (the past five trading days). Nothing after the decision candle's close is read.
- **Legs**: buy the **2 currencies with the lowest** past return and sell the **2 with the highest** (against USD). Ties
  are broken by the key order above (never by a later price).
- **Weights**: equal volatility. σᵢ = standard deviation of the last 60 daily log close-to-close returns of Monday-Friday
  candles up to and including the decision candle; wᵢ = (1/σᵢ) ÷ Σ over the four legs of (1/σⱼ), so the four absolute
  weights sum to 1 (Sharpe and t do not depend on the scale).
- **Entry**: the open of the first candle after the decision candle (normally the Sunday reopen stub).
- **Stop, every leg**: 3 × ATR(20) from the entry, ATR(20) = the mean true range of the last 20 Monday-Friday candles up to
  and including the decision candle. Every candle of the hold is checked in order (Sunday stubs included): a candle that
  opens past the stop exits at its open; otherwise a candle whose low (buy) or high (sell) reaches the stop exits at the
  stop. A stopped leg is flat until the next rebalance.
- **Exit**: the close of the next week's decision candle (one week). Every leg is closed and re-opened at each rebalance,
  even when the same currency keeps the same side, so every week pays a full round trip (conservative).

## Costs (net of all of them; nothing credited)

- **Trading**, the measured raw-spread model of `council/fills.mjs` (`costModel`, `tradeCost`) on
  `tests/fixtures/ctrader/symbols-raw-12nov.json` (the broker's quotes of 8-12 Nov rebuilt as `tests/forex-spread.test.mjs`
  does): EUR/USD, GBP/USD, AUD/USD, USD/CAD, USD/CHF have a median quoted spread of 0 and a commission of 0.0045 % of the
  price a round trip (`commissionRT`); a market entry and a non-target exit each pay half a spread of slippage, of the
  default 1-pip spread because the quoted one is 0 (`SLIP_SPREADS`): **1 pip + 0.0045 % of price per leg per week**.
  USD/JPY and NZD/USD are not in the fixture, so `costModel` gives them the default basis: the quoted spread is the default
  1 pip, plus 1 pip of slippage, plus the same forex commission (same broker, same commission type): **2 pips + 0.0045 %**.
  A pip is 0.01 on USD/JPY and 0.0001 elsewhere; charged as a fraction of the pair price, times the leg's weight.
- **Financing**: a stated, conservative **1 % a year of the leg's notional, against every leg** (long or short), for the
  calendar days the leg is held (entry to exit, weekends included) ÷ 365. No positive carry is ever credited.

## Statistics and windows

- Weekly return of the book = Σ over legs of wᵢ × (sideᵢ × (exit/entry − 1) − trading cost − financing), booked to the week
  of its entry.
- **Windows** (by entry date): **2008-01-01 to 2015-12-31** (check) and **2016-01-01 to the last complete week on file
  (exit by 6 Nov 2026)** (decisive).
- **Annualised Sharpe** = mean ÷ standard deviation of the weekly returns × √52.
- **Month-sum t**: weekly returns summed by the calendar month of their entry; t = mean ÷ (sd ÷ √n) over those months.
- **Placebo**: 40 seeds (1..40, mulberry32): each week a random permutation of the seven currencies replaces the ranking
  (first two bought, last two sold); everything else as the rule (weights, stops, costs). Its 95th percentile = linear
  interpolation of the 40 decisive-window Sharpes (position 0.95 × 39 in the sorted list).

## Pass bar (all four)

1. Decisive window: annualised Sharpe **> 0.4**.
2. Decisive window: month-sum t **≥ 2**.
3. 2008-2015: total net return **> 0** (positive).
4. Decisive Sharpe **above the placebo's 95th percentile**.

Otherwise **FAIL**. Reported regardless: n weeks, mean, sd, Sharpe, t, total, worst drawdown, share of legs stopped, the
cost and financing taken, the gross (before costs) figures, per-year totals. Gross figures and per-year splits are
descriptive and cannot change the verdict. No parameter (5 days, 2 legs, 60 days, 3 × ATR(20)) is varied in this study; a
variant would need its own pre-registration.
