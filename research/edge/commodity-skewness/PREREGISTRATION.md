# Pre-registration: commodity cross-sectional skewness, 12 months, monthly rebalance (14 Nov 2026)

Written and pushed before any skewness, trade, return or statistic of this rule was computed. Paper research only: nothing here
changes a council rule, a trade, the mirror or any live file.

**Owner decision 44** forbids new gate, exit, entry or size tests on the gold book's 2006-17 window. This is not one: it is a
cross-sectional study of twelve commodity CFDs ranked against each other (gold is one of the twelve, as in
`commodity-xs-momentum`), with its own windows; no gold-book rule, position or figure is read or changed.

## Question

The published claim (Fernandez-Perez, Frijns, Fuertes & Miffre 2018, Journal of Banking & Finance, "The skewness of commodity
futures returns"): commodities whose daily returns were most NEGATIVELY skewed over the past 12 months outperform those that
were most POSITIVELY skewed over the next month (investors overpay for lottery-like, right-skewed assets). Does a long
negative-skew third / short positive-skew third book of twelve commodities make money on the council's own OANDA daily CFD
candles, as stop-protected trades, net of costs?

**Not already tested.** No study in this repository (main or any branch) ranks by return skewness. Related and not repeated:
`commodity-xs-momentum` (branch `commodity-xs-momentum`, commit 5a6f3ed12; FAIL, 12-1 return ranking), `tsmom`,
`fx-xs-momentum`. This study reuses that harness unchanged (universe, calendar, entries, stop, costs, financing, placebo,
statistics); only the ranking signal, the bucket size and the windows differ, as stated below. The harness lives on an unmerged
branch, so its functions are copied into this study's `run.mjs` (named as copied), not imported.

## Universe (fixed now)

`xau xag xpt xpd xcu bco wtico natgas corn wheat soybn sugar`: council-data `research/daily/<key>.json` (OANDA mid, complete
UTC daily candles), read with `git show origin/council-data:research/daily/<key>.json` (no network). All twelve have
`status: "ok"` in `_index.json` (checked before writing this; first candles: xcu, bco, wtico, natgas, corn, wheat, soybn, sugar
in 2003; xpt, xpd January 2005; xau, xag March 2006). Weekend stub candles folded into the next weekday by `council/fills.mjs`
`foldWeekend` (imported). Each market keeps its own calendar.

## Rule

1. **Month ends** as in `commodity-xs-momentum`: a market's month-end close for month M = the close of its last candle dated in M.
2. **Signal** (at the close of signal month S, candles up to and including that day only): the daily log returns
   ln(close_i / close_{i−1}) of every consecutive pair of the market's candles from its month-end candle of S−12 to its month-end
   candle of S (the past 12 calendar months). Skewness = Pearson's moment coefficient
   (1/N)Σ(r−μ)³ / ((1/N)Σ(r−μ)²)^{3/2}. A market is RANKED only if it has a candle in S and in S−12 and at least 200 such returns.
3. **Rank** from most negative to most positive skewness; ties by the list order above. With N ranked markets, k = floor(N / 3)
   per side: **long the k most negatively skewed, short the k most positively skewed** (k = 4 with all twelve, 3 with 10 or 11).
   A month with fewer than 10 ranked markets is not traded.
4. **Entry**: the open of each market's first candle dated in the holding month H = S + 1 (no candle in H: the leg is skipped
   and said).
5. **Size: equal risk.** 1R = 2 × ATR(20) of the 20 candles ending on the signal day (simple mean of the true range).
6. **Every leg has a stop** (absolute rule 1) at 1R from the entry; checked on every candle from the entry candle to the exit
   candle; a candle opening beyond the stop fills at its open, otherwise at the stop; a candle touching it is stopped. A stopped
   leg stays flat until the next rebalance.
7. **Exit**: at the close of the market's last candle in H. Every month all legs are closed and opened anew (no netting).
8. **R per month** = the sum of the legs' net R divided by the number of legs.

## Roll gaps

As `commodity-xs-momentum`: no adjustment (the candles are not back-adjusted; OANDA's cash adjustment at a roll is not
modelled). The skewness reads the returns as they are, so a roll jump enters the signal; this is said, not corrected.
Reported, never deciding: legs whose holding window holds an open-to-previous-close jump above 3 % and their net R, and the
monthly result without them.

## Costs (every leg, round trip, in R of that leg)

As `commodity-xs-momentum`: round trip gold $0.30, silver $0.03, every other market 0.06 % of the entry price; financing 3 % a
year on longs AND shorts, every market, per `council/fills.mjs` `nights(entryTime, exitTime)`. Reported at 0 / base / 2 × costs.

## Windows (fixed now, by rule)

Holding months run from the first month with at least 10 ranked markets to 2026-10 (November 2026 is incomplete and left out).
**In sample (IS)** = the first floor(n / 2) of those n months; **out of sample (OOS)** = the rest. From the data coverage above
the first tradable holding month is expected to be 2006-02 (xpt / xpd make 10 markets with 12 months of history at signal month
2006-01), giving 249 months: IS 2006-02 to 2016-05 (124), OOS 2016-06 to 2026-10 (125). If the data give another first month,
the rule (first half / rest) decides, and the report says so.

## The one judged test (one test, so no Holm)

PASS only when ALL hold:
1. OOS mean net R a month (base costs) has Newey-West t ≥ 2 (3 lags, Bartlett weights) on the calendar-month sums.
2. IS mean net R a month (base costs) > 0.
3. OOS mean net R a month at 2 × costs > 0.
4. **Placebo**: 40 seeded runs (seeds 1-40), a random ranking each month (shuffle of the ranked markets, same k per side, same
   entries, stops, costs), OOS window: the real OOS mean net R a month above the placebos' 95th percentile (beats at least 95 %).

Anything else is FAIL. A FAIL is not evidence that the opposite works.

## Reported only, never judged

- Named variants: (a) skewness over the past 6 months (S−6 to S, at least 100 returns); (b) the 12-month signal with 3 a side
  (the momentum study's bucket).
- Monthly statistics (n, mean gross / net R, NW t, plain t, Sharpe, positive months), worst drawdown, by year, per market
  (legs long / short, net R), stops and gap fills, the long legs against the short legs.

## What it would and would not mean

A PASS would be one cross-sectional effect on these twelve CFDs with these costs; never a council rule without the owner. A FAIL
says this version did not pay here; it says nothing about the gold book.

To repeat (after the code exists): `node research/edge/commodity-skewness/run.mjs` (reads council-data with `git show`, writes
`result.json`).
