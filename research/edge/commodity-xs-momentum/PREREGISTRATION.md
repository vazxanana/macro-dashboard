# Pre-registration: commodity cross-sectional momentum, 12-1 months, monthly rebalance (14 Nov 2026)

Written and pushed before any trade, return or statistic of this rule was computed. Paper research only: nothing here changes a
council rule, a trade, the mirror or any live file, and the gold book is not touched (owner decision 44: this is a cross-market
study, not a gate, exit, entry or size on the gold book).

## Question

The published claim (Miffre & Rallis 2007, Journal of Banking & Finance, "Momentum strategies in commodity futures markets";
Asness, Moskowitz & Pedersen 2013, "Value and momentum everywhere"): the commodities that rose most over the past 12 months,
skipping the most recent month, keep outperforming those that rose least over the next month. Does a long-top-3 / short-bottom-3
book of twelve commodities make money on the council's own OANDA daily CFD candles, as stop-protected trades, net of costs?

**Related, and what is not repeated.** `tsmom` (time-series momentum, branch `tsmom`): each market against ITS OWN past, the
sign of its 12-1 return; FAIL (commodities −0.801R a month on 2016-26, t −1.86). `fx-xs-momentum` (branch `fx-xs-momentum`):
cross-sectional momentum among the seven dollar pairs; FAIL. This study ranks commodities AGAINST EACH OTHER (cross-sectional),
which has not been tested on commodities in this repository. A cross-sectional book is long and short in equal number, so a
common rise or fall of all commodities largely cancels; mainly the spread between winners and losers is measured.

## Universe (fixed now)

`xau xag xpt xpd xcu bco wtico natgas corn wheat soybn sugar`: council-data `research/daily/<key>.json` (OANDA mid, complete
UTC daily candles), read with `git show origin/council-data:research/daily/<key>.json` (no network). Saturday / Sunday stub
candles are folded into the next weekday by `council/fills.mjs` `foldWeekend` (imported, not copied). Each market keeps its own
calendar (no common calendar is needed: every leg is simulated on its own candles).

## Rule

1. **Month ends.** For each market, its month-end close for calendar month M = the close of its last candle dated in M. A market
   is RANKED at signal month M only if it has a candle in each of M, M−1 and M−12 (so 13 months of history; "12 months ago" is
   the month-end of M−12).
2. **Signal** (at the close of month M, closes up to and including that day only): 12-1 return = close(M−1) / close(M−12) − 1.
   Rank from highest to lowest; ties broken by the order of the list above. **Long the top 3, short the bottom 3.** A month
   with fewer than 10 ranked markets ("all but two") is not traded.
3. **Entry**: the open of each market's first candle dated in month M+1 (the holding month). A market with no candle in M+1 is
   skipped for that month (the leg is left out and said).
4. **Size: equal risk.** 1R = 2 × ATR(20), ATR(20) = the simple mean of the true range (high − low, or the gap from the previous
   close when larger) of the 20 candles ending on the signal day (the market's month-end of M).
5. **Every leg has a stop** (absolute rule 1) at 1R from the entry: below for a long, above for a short. Checked on every daily
   candle from the entry candle itself to the exit candle; a candle that OPENS beyond the stop fills at its open (gap fill, never
   a better price than the candle allows), otherwise at the stop. When one candle touches the stop, the stop is taken (no
   intra-candle path is assumed in the leg's favour). A stopped leg stays flat until the next rebalance.
6. **Exit**: a leg not stopped is closed at the close of the market's last candle in the holding month. Every month all legs
   are closed and opened anew (no netting; a market that stays in the same bucket pays its costs again).
7. **R per month** = the sum of the legs' net R divided by the number of legs (6 whenever every leg has an entry).

## Roll gaps

OANDA's commodity CFDs follow a front contract and roll it; the daily candles are NOT back-adjusted, so a roll can show as a
jump between one candle's close and the next one's open (OANDA books a separate cash adjustment at a roll, which these candles
do not show and this test does not model). Treatment, fixed now: **no adjustment**. The signal reads the candles as they are;
a leg held across a jump takes it in full, and a stop jumped over fills at the open of the jumping candle (worse than the stop),
never better. Reported (never deciding): the number of legs whose holding window holds an open-to-previous-close jump larger
than 3 %, and their summed net R; the result without those legs is shown as a descriptive line.

## Costs (every leg, round trip, in R of that leg)

- **Round trip**: gold $0.30 an ounce, silver $0.03 an ounce, every other market 0.06 % of the entry price. In R = cost /
  stop distance. No measured spreads exist for most of these CFDs; these are assumptions.
- **Financing**: 3 % a year, charged on BOTH longs and shorts (conservative: a short would often be credited), every market,
  gold included (the demo broker's measured gold-long rate `FIN` is about 5.4 % a year; this single rule is used instead and
  said). Per night = 0.03 / 365 × entry price, nights = `council/fills.mjs` `nights(entryTime, exitTime)` (Mon-Fri 22:00 UTC
  rollovers, Wednesday three). Entry time = the entry candle's start; exit time = the end of the exit candle for a month-end
  close, its start for a gap fill, its start + 12 h for a stop inside a candle.
- Reported at **0 / base / 2 × costs** (2 × = both the round trip and financing doubled). Only base decides.

## Windows

- **Decisive**: holding months 2016-01 to 2026-10 (November 2026 is incomplete on file and left out).
- **Replication**: from the first holding month with at least 10 ranked markets, to 2015-12.

## The one judged test (no Holm: one test)

PASS only when ALL hold:
1. Mean net R a month > 0 in the decisive window AND in the replication window.
2. Decisive t ≥ 2 on monthly net R, Newey-West standard error with 3 lags (Bartlett weights), over the full decisive window.
3. **Placebo**: 40 seeded runs (seeds 1-40) with a RANDOM ranking each month (a shuffle of the ranked markets; top 3 long, bottom
   3 short; same entries, stops, costs), decisive window: the real decisive mean net R a month above the placebos' 95th
   percentile.

Anything else is FAIL. A FAIL is not evidence that the opposite works.

## Reported only, never judged

- Named variants **6-1** (close(M−1) / close(M−6)) and **3-1** (close(M−1) / close(M−3)); with these a market needs a candle in
  M, M−1 and M−6 (M−3).
- Monthly statistics (n, mean gross / net R, t, Sharpe, positive months), worst drawdown of the cumulative monthly R, by year,
  per market (legs long / short, net R contributed), stops hit, gap fills.

## What it would and would not mean

A PASS would be one cross-sectional effect on these twelve CFDs, measured with these costs; never a council rule without the
owner. A FAIL says this twelve-market, top-3 / bottom-3 version did not pay here; it says nothing about the gold book.

To repeat (after the code exists): `node research/edge/commodity-xs-momentum/run.mjs` (reads council-data with `git show`,
writes `result.json`).
