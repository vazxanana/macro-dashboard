# Nearness to the 52-week high on commodities and currencies: pre-registration (14 Nov 2026)

Written and pushed alone, before any position is simulated and before any figure of this study is seen.

## Why

The nearness-to-the-52-week-high ranking (George and Hwang, 2004: a stock's close divided by its 52-week high predicts its
next returns better than its past return) has been tested here only on equity indices, and failed both ways:
`high52-rotation` (branch, PR #853: top 3 of 11 indices, long only, decisive excess +0.046 % a month, Newey-West t 0.38) and
`index-52w-high` (PR #911: time-series, 0 of 3). It has never been tested on commodities or currencies. The past-return
ranking on these groups failed: `commodity-xs-momentum` (12-1, decisive −0.071R a month, t −1.30) and `fx-xs-momentum`
(seven dollar pairs, 63-day −0.244R a month, t −1.79). Here the 12-1 momentum ranking with the same construction is the
CONTROL, shown beside the nearness books, never a test.

## Data

council-data `research/daily/<key>.json` (OANDA mid daily candles, commit `e08b7aeb9`, read with `git show`, no network),
weekend stubs folded into Monday (`council/fills.mjs` `foldWeekend`), each market on its own calendar. Data to 2026-11-06;
November 2026 is incomplete and left out.

## The two fixed sets (named now, before any result)

- **Commodities, 12 markets**: `xau xag xpt xpd xcu bco wtico natgas corn wheat soybn sugar` = every metal, energy and
  agricultural key of the council's cache with data from 2008 or earlier, **except** `xaueur`, `xaugbp`, `xauxag`: those are
  gold quoted in euros, pounds and silver, not separate commodities; keeping them would count gold up to four times in one
  ranking. The 12 are the same set as `commodity-xs-momentum`, so the control is comparable.
- **Currencies, 35 pairs**: every forex key with data from 2008 or earlier: `audcad audchf audjpy audnzd audusd cadchf cadjpy
  chfjpy euraud eurcad eurchf eurgbp eurjpy eurnzd eurusd gbpaud gbpcad gbpchf gbpjpy gbpnzd gbpusd nzdcad nzdchf nzdjpy
  nzdusd usdcad usdchf usdjpy usdmxn usdnok usdpln usdsek usdsgd usdtry usdzar`. Left out: `usdcnh` (starts 2011) and
  `usdhkd` (a currency board held inside 7.75-7.85: its daily range is a few hundredths of a percent, so inverse-ATR sizing
  would put tens of times the notional of any other pair on it and the assumed costs and financing, not the price, would
  decide that leg). **Nearness is computed on the pair price as quoted** (EUR/USD, USD/JPY, …): it is direction-neutral in
  the sense that the base currency is whatever OANDA quotes first; no pair is inverted and no currency index is built.

## The signal (closes up to and including the signal day only)

- **Nearness** at a month's last close = close / the highest CLOSE of the last 252 trading days of that market (the signal
  day included), the definition of `high52-rotation` and `index-52w-high`. A market needs 252 candles to be ranked.
- **Momentum (control)** = close(last candle of month M−1) / close(last candle of month M−12) − 1, as
  `commodity-xs-momentum`.
- **Residual nearness** = within each group, each month, the residual of an OLS cross-sectional regression of nearness on
  12-1 momentum (with an intercept) over the markets that have both; ranked like nearness.

## The book

At each month's last close, within each group separately, rank the markets that have a signal (and an open next month). A
group is traded that month only with at least 8 of 12 commodities or 24 of 35 pairs ranked. Long the top third, short the
bottom third, a third = floor(ranked / 3) (4 of 12, 11 of 35). Each leg enters at the open of its market's first candle of
the next month. **Size by inverse ATR**: every leg risks 1R, 1R = the stop distance = 3 x ATR(20) on the signal day (Wilder's
true range, simple 20-day mean); every leg has this stop (a candle opening beyond it fills at its open). Out at the close of
the month's last candle. A leg's R = side x (exit − entry) / stop distance, less its costs in R. A group's month = the mean R
of its legs. **The combined book** = the equal-weighted mean of the two group books (one group's book alone when only one is
traded; by the minimums above both are traded from the first decisive month).

## Costs and financing (fixed now)

- Commodities (as `commodity-xs-momentum`): round trip gold $0.30, silver $0.03, the other ten 0.06 % of price; financing
  3 % a year (0.03 / 365 a night) on every leg, long and short.
- Currencies: round trip 0.015 % of price for the G10 majors and crosses (`trend-breadth` `COST.fx`), 0.10 % for `usdnok
  usdsek usdpln usdsgd` and 0.20 % for `usdmxn usdzar usdtry` (`trend-breadth`'s mid and wide classes); financing 0.004 % a
  night on every leg, long and short (`fx-xs-momentum`, `trend-breadth` `FIN_FX`). The flat financing ignores true carry
  (a long USD/TRY pays far more, a short earns): measured rate differentials are not reachable from the build sandbox. Said
  as a limitation; the "G10 only" line below shows the book without the seven exotics.
- Nights by `council/fills.mjs` `nights` (Monday-Friday 22:00 UTC, Wednesday three). Costs and financing are divided by the
  leg's stop distance.

## Windows

In sample: holding months from the first month both groups are traded to 2016-12. Out of sample: 2017-01 to 2026-10.

## Tests (four, Holm over all four)

| Id | Test | Book |
|---|---|---|
| **T1 (primary)** | Nearness, combined | mean of the commodity and currency nearness books |
| T2 | Nearness, commodities alone | |
| T3 | Nearness, currencies alone | |
| T4 | Residual nearness, combined | mean of the two residual books |

Statistic: plain t of the monthly net R series (calendar-month sums), one-sided p from the normal distribution, Holm over
T1-T4 on the OOS p.

**Pass bar** (judged on T1; T2-T4 are reported against the same bar): OOS net mean > 0 with t >= 2 and Holm-adjusted
p < 0.05 (the t >= 2 is the gate, Holm makes it stricter), the in-sample net mean of the same sign, and the OOS mean still
> 0 at 2x costs and financing. Anything else is FAIL.

**Placebo**: 40 seeds (mulberry32, seeds 1-40), each month within each group a random ordering of the ranked markets in
place of the ranking, same thirds, entries, stops and costs; the combined OOS net t of each seed. Reported as quantiles and
the count of seeds at or above T1's OOS t (not part of the bar).

## Reported, never deciding

The 12-1 momentum control (same construction) per group and combined, IS and OOS, gross and net; costs 0 / 1x / 2x; T1
without the exotics; per-year combined net R; per leg win rate, stopped share, mean cost and financing in R.

## What a result can and cannot say

A FAIL says the nearness ranking, on these OANDA price series with these costs, does not pay in this construction. It does
not judge a carry-inclusive currency book, futures term structure (commodity CFDs roll), or the stock-level anomaly. A PASS
would be a proposal to the owner only (absolute rule 3): no live rule, size, filter, council member or page changes here.
