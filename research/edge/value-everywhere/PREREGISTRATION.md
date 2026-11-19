# Pre-registration: price-based "value" across index and commodity CFDs, monthly rebalance (14 Nov 2026)

Written and pushed alone, before any trade, return or statistic of this rule was computed. Paper research only: nothing here
changes a council rule, a trade, the mirror or any live file; the gold book is not touched (owner decision 44: a cross-market
study, not a gate, exit, entry or size on the gold book).

## Question

Asness, Moskowitz & Pedersen 2013 ("Value and momentum everywhere", Journal of Finance): for futures-like assets, value =
the negative of the five-year return, i.e. the log of the average price between 4.5 and 5.5 years ago minus the log price
now. Cheap assets (those that fell most over five years) earn more than expensive ones over the next month. Does a
long-cheapest-third / short-dearest-third book, run inside each asset group, make money on the council's own OANDA daily CFD
candles, as stop-protected trades, net of costs? And does the paper's point hold here: value and 12-1 momentum diversify each
other, so a 50/50 combination does better than either?

## What is not repeated

- `fx-value` (branch `fx-value`, PR #968, FAIL): the same five-year value signal on the seven dollar pairs. **FX is not tested
  again here.**
- `index-long-reversal` (branch `index-long-reversal`, PR #941, FAIL): cross-sectional long-term reversal on 17 index CFDs, but
  on the 36-month return skipping one month, three long and three short, held 12 months in overlapping cohorts. It does not
  rank on the five-year value score of the paper and does not hold one month, and it does not cover commodities, so indices
  STAY in this study. The overlap is said plainly: the index book here is a close relative of #941 and its result is not
  evidence independent of it.
- `commodity-xs-momentum` and `index-xs-momentum` (both FAIL) tested 12-1 momentum alone per group. Momentum appears here only
  as the second half of the value + momentum combination (and is reported alone, not judged).

## Universe (fixed now: every market of the two groups with OANDA daily data from 2008 or earlier)

- **Indices (14)**: `au200 ch20 de40 eu50 fr40 hk33 jp225 nas100 nl25 sg30 spx500 uk100 us2000 us30`. Left out because their
  data start after 2008: `cn50` (2011), `in50` (2011), `es35` (2016).
- **Commodities (12)**: metals `xau xag xpt xpd xcu`; energies `bco wtico natgas`; agriculturals `corn wheat soybn sugar`.
  Left out: the gold crosses `xaueur xaugbp xauxag` (the same metal in another currency); bonds (not in the brief's groups).

Data: council-data `research/daily/<key>.json` (OANDA mid, complete UTC daily candles), read with `git show
origin/council-data:research/daily/<key>.json` (no network, nothing cached in git). Weekend stubs folded into the next weekday
by `council/fills.mjs` `foldWeekend` (imported). Each market keeps its own calendar. Indices are price indices in their own
currency; no dividends, no currency conversion; every leg is measured in its own R, so legs are comparable.

## Rule

1. **Month ends.** A market's month-end close for month M = the close of its last candle dated in M.
2. **Value score at signal month S** = mean over k = 54..66 of ln(month-end close of S−k) − ln(month-end close of S) (the 13
   month-end closes from 5.5 to 4.5 years before; the average of log prices). A market is SCORED at S only if it has a candle
   in month S and in every month S−54 … S−66. The first possible signal is about 5.5 years after a market's first candle:
   about 2008-09 for most indices, energies and agriculturals, 2009-09 for au200 / sg30, 2010-07 for xpt / xpd, 2011-09 for
   xau / xag, 2013-07 for nl25.
3. **12-1 momentum at S** (for the combination only) = close(S−1) / close(S−12) − 1; needs candles in S, S−1, S−12.
4. **Book per group and month.** With n scored markets in a group at S and n ≥ 9, k = floor(n / 3): long the k with the
   HIGHEST value score (cheapest), short the k with the lowest (dearest). Ties broken by the fixed market order above. Fewer
   than 9 scored: that group has no book that month.
5. **Leg.** Entry at the open of the market's first candle of the holding month H = S+1; 1R = stop distance = 3 × ATR(20)
   (mean true range of the 20 candles up to and including the signal month's last candle). The stop is placed at entry: a
   candle that trades through it closes the leg at the stop, a candle that opens beyond it at its open. Otherwise out at the
   close of the market's last candle of H. Every leg risks 1R, so the position size is inverse ATR.
6. **Group book R a month** = mean of its legs' net R. **Primary book** = the equal-weighted mean of the index book and the
   commodity book, counted only in months where BOTH group books exist (so it starts when the commodity book starts, about
   2010).
7. **Value + momentum (secondary)**: in each group the momentum book is built the same way (long the top third by 12-1 return,
   short the bottom third, n ≥ 9); the group's combined book = 0.5 × value book + 0.5 × momentum book (months where both
   exist); the combination across groups = mean of the two groups' combined books, months where both exist.

## Costs (assumed, as earlier studies)

- Round trip: index CFDs 0.04 % of price (the index studies' assumption); gold $0.30 and silver $0.03 (as
  `commodity-xs-momentum`), the other commodities 0.06 % of price (as `commodity-xs-momentum`).
- Financing: a flat 3 % a year of the entry price on every leg, long and short, per rollover night counted by
  `council/fills.mjs` `nights` (Wednesday three) (the `commodity-xs-momentum` assumption: a CFD broker charges both sides
  roughly benchmark ± a markup, which nets to a cost on both).
- 2x costs = both doubled.

## Windows

- In sample: first book month to 2016-12 (short: about 6 years for the primary, since the commodity book starts about 2010;
  said so, reported anyway).
- Out of sample: 2017-01 to 2026-10 (November 2026 incomplete, left out).

## Tests (four, Holm over all four on the OOS net month t)

| Test | Book | Role |
|---|---|---|
| T1 (primary) | value, indices + commodities equal-weighted | the verdict |
| T2 | value, indices alone | secondary |
| T3 | value, commodities alone | secondary |
| T4 | value + 12-1 momentum 50/50, both groups | secondary |

Statistic: plain t of the calendar-month net R series (mean / sd × √n); two-sided normal p; Holm over the four.
Newey-West t (3 lags) and Sharpe reported beside it. Momentum alone per group reported, not tested.

## Pass bar (all must hold for T1; a secondary "passes" on the same bar)

1. OOS net mean > 0 and OOS net month t ≥ 2, Holm-adjusted p ≤ 0.05.
2. In-sample net mean > 0 (same sign).
3. OOS net mean > 0 at 2x costs.
4. OOS net mean above the 95th percentile of a placebo: 40 seeded draws (mulberry32, seeds 1-40) where each group's scored
   markets are put in a random order each month, same thirds, stops, exits and costs, the same two-group combination (for
   T4 the value half is randomised, the momentum half kept).

## Reported, not judged

Gross / net / 2x per window, per year, per market (long / short counts and R), leg stops and gap fills, the cost split
(spread vs financing), the correlation of the value and momentum month series (the diversification claim), momentum alone.

## Limitations stated now

Price "value" on a CFD that is a spot price with no roll is not the paper's futures excess return: index CFDs are price
indices (no dividends), commodity CFDs carry the roll inside the financing assumption. The commodity book has a short history
(first signal about 2010 for ten markets). The index book overlaps `index-long-reversal`.
