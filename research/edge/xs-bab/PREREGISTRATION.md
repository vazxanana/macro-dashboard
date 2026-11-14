# Pre-registration: betting against beta within asset classes (14 Nov 2026)

Written and pushed alone, before any beta, position or return of this study was computed. Paper research only: no live rule,
size, filter, council member, page or mirror setting changes, whatever the result. Owner decision 44 (no further tests on the
gold book's 2006-17 window) is not touched: this is a cross-market, long / short study.

## Claim

Frazzini and Pedersen (2014), "Betting Against Beta" (Journal of Financial Economics 111): within an asset class, markets with
a low beta to their class earn higher risk-adjusted returns than markets with a high beta, so a book that is long the low-beta
markets levered up to a beta of 1 and short the high-beta markets levered down to a beta of 1 (the BAB factor) earns a positive
return with a beta of about zero. They report it within equity indices, commodities, currencies, bonds and more.

## Dedupe

- `index-low-vol` (branch `index-low-vol`, FAIL, 0 of 2): the three least volatile of 17 national index CFDs against the three
  most volatile, monthly, 2016-now T1 -0.094R a month (NW t -2.69). It ranks by total volatility, not beta, and covers indices
  only, so it does not cover this hypothesis. Because it already tested the low-risk anomaly on indices, the **indices are a
  reported group here, not part of the primary test**.
- `commodity-xs-momentum`, `fx-xs-momentum`, `index-xs-momentum`, `crypto-xs-momentum` (branches): cross-sectional MOMENTUM,
  another signal. Their market sets and cost assumptions are reused below.
- `research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`): no beta / BAB entry. No study under
  `research/edge/` ranks markets by beta.

## Markets (fixed now, before any result)

OANDA mid daily candles from council-data `research/daily/<key>.json` (weekend stubs folded into Monday with
`council/fills.mjs` `foldWeekend`), each market on its own calendar:

- **Commodities (12)**: `xau xag xpt xpd xcu bco wtico natgas corn wheat soybn sugar` (metals, energy, agriculturals: every
  commodity the cache holds; the `commodity-xs-momentum` set).
- **FX (7)**: the seven G10 currencies against the US dollar, `eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf`. Each market
  is the CURRENCY against the dollar: `usdjpy`, `usdcad`, `usdchf` are inverted (price 1 / p, high 1 / low, low 1 / high,
  open and close 1 / p) before anything is computed, so the group average is the foreign-currency basket against the dollar.
- **Indices (17, reported group)**: `au200 ch20 cn50 de40 es35 eu50 fr40 hk33 in50 jp225 nas100 nl25 sg30 spx500 uk100 us2000
  us30` (the `index-low-vol` set), each in its own currency, price CFDs without dividends.

## Rule

At each calendar month end m, separately within each group:

1. **Daily returns.** A market's return on a day = its close / its previous candle's close - 1 (simple). The group's
   equal-weighted average on a day = the mean of the returns of the group's markets that have a candle that day and a
   previous candle no more than 7 days earlier, kept only when 3 or more markets have one. The average includes the market
   itself (as the paper's market portfolio does).
2. **Beta.** For each market with a candle in the last 7 days of month m: the OLS slope of its daily return on the group
   average over the last 250 days (at or before its month-m close) on which both exist. A market with fewer than 250 such days
   has no beta that month. **Shrunk beta** = 0.6 x beta + 0.4 x 1.
3. **Halves.** With 6 or more markets with a beta, sort by shrunk beta ascending (ties by key). n = their count; Low = the
   first floor(n / 2), High = the last floor(n / 2) (the middle market sits out when n is odd).
4. **Equal ex-ante beta (the BAB construction).** beta_L = mean shrunk beta of Low, beta_H = mean shrunk beta of High. Each Low
   market is held LONG with notional weight 1 / (n_L x beta_L) of the book, each High market SHORT with 1 / (n_H x beta_H); so
   each leg has an ex-ante beta of 1 and the book about 0. A group whose beta_L or beta_H is under 0.1 forms no book that month.
5. **Cap.** A market's inverse-ATR size = (1 / n_leg) x (median ATR%(20) of the group's markets with a beta) / ATR%(20) of
   the market, with ATR%(20) = ATR(20) / close at the month-m candle. A weight above 3 x its inverse-ATR size is cut to that
   cap. The rest is not rescaled (a capped leg then carries a beta under 1; the count of capped positions is reported).
6. **Trade.** Enter at the open of the market's first candle after month m; stop 3 x ATR(20) (at the month-m candle) from the
   entry, a candle opening beyond the stop fills at its open; otherwise out at the close of the market's last candle of month
   m + 1. Rebalanced monthly: every position is closed and the new book entered (each month pays a full round trip).
7. **Return.** A position's result in % of the book = weight x direction x (exit / entry - 1) x 100 less its costs; the
   group's BAB return for book month m + 1 = the sum over its positions.

## Costs (base)

- Round trip, as a fraction of price: indices 0.04 % (the `index-low-vol` / brief CFD figure); commodities: gold $0.30, silver
  $0.03, the rest 0.06 % (`commodity-xs-momentum`); FX 2 pips (1 pip spread of `council/fills.mjs` `spreadOf` plus half a spread
  of slippage at entry and at exit, `SLIP_SPREADS`), a pip being 0.01 for the yen pair and 0.0001 otherwise, converted to the
  inverted price where the market is inverted. Half is charged at entry and half at exit, on the position's notional.
- Financing, a night (`council/fills.mjs` `nights`, Wednesday three) on the position's notional at the night's close, longs
  AND shorts alike (no credit): indices (DGS2 + 2.5 %) / 365 (DGS2 from council-data `macro/cache.json`, 4 % before its first
  value; as `index-low-vol`); commodities 3 % a year / 365 (as `commodity-xs-momentum`); FX 0.004 % a night (as
  `fx-xs-momentum`). These are assumed CFD rates, stated, not measured per market; the levered low-beta leg pays more of them,
  which is part of the claim's real cost.
- Every result is shown at 0x (gross), 1x (base, decides) and 2x costs.

## Tests and windows

- **P (primary)**: the equal-weighted mean of the commodity BAB and the FX BAB return, per book month, for months where both
  groups formed a book.
- **C**: the commodity BAB alone. **F**: the FX BAB alone. **I**: the index BAB alone (reported group, judged with the same
  checks but it cannot make the verdict).
- Reported only, not judged: the three-group equal-weighted mean, and a "paper beta" variant (beta = correlation x sigma_i /
  sigma_group with sigma from 250 daily log returns and the correlation from overlapping 3-day log returns over the last 1,250
  days, 750 at least, then shrunk the same way).
- In sample: book months up to 2016-12, from the first month the test forms. Out of sample: 2017-01 to 2026-10 (November 2026
  is incomplete and left out).
- Statistic: the plain t of the monthly net series (calendar-month sums), one-sided p = 1 - Phi(t); Newey-West t (3 lags)
  reported beside it. Holm at 5 % over the four tests P, C, F, I.
- **Placebo**: 40 seeded draws (mulberry32, seeds 20261114 + d): each month, within each group, the markets with a beta are put
  in random order before being split into halves; beta_L, beta_H, weights, caps, stops and costs as above. The placebo's OOS
  net mean per test, 5th / 50th / 95th percentile.

## Pass bar (for each test; the verdict is P's)

All of: OOS net mean > 0; OOS net t >= 2 and passing Holm over the four tests; in-sample net mean > 0 (same sign); OOS net
mean at 2x costs > 0; OOS net mean above the placebo's 95th percentile. **PASS** only if P passes. A group passing alone
while P fails is reported, not a pass. Never called an edge without n and t; a pass would only lead to a written proposal for
a paper shadow, never a live rule.

## Known limits, stated before the run

- Daily betas of markets that close at different hours (Asian against US indices; commodities on different exchanges) are
  biased toward zero by non-synchronous trading; the paper used 3-day returns for the correlation for that reason. The
  primary rule is the brief's 250-day daily beta; the paper-beta variant is reported beside it.
- Price CFDs, no dividends on indices, no carry on FX beyond the flat financing above, no roll yield on commodity CFDs beyond
  what the CFD price carries. Stops at 3 x ATR(20): the paper held without stops.

To run (after this file is pushed): `node research/edge/xs-bab/run.mjs fetch <dir>` (git show from origin/council-data, no
network; candles kept out of git), then `node research/edge/xs-bab/run.mjs full <dir>`.
