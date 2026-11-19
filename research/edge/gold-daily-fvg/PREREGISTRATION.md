# Pre-registration: gold's daily three-candle gap, traded on its first retest (14 Nov 2026)

Written and pushed alone, before `run.mjs` exists and before any result is seen. Paper research only: a stand-alone daily rule
on gold, never a gate, exit, entry or size of the live gold book (Gold trend / Gold daily engulf), and none of that book's
2006-17 positions is read (owner item 44). Nothing live changes whatever the verdict. ICT stays a separate edge: this is not
the ICT desk's rule (that is an H1 inversion on index futures); it borrows only the shape of a three-candle gap.

## Question

When a 17:00 New York daily candle of gold leaves a gap between the high two days earlier and its own low (a bullish
three-candle gap: the middle day moved so fast that the two outer days do not overlap), does buying the FIRST return of price
into that gap make money, net of costs, over the following days? The mirror for sells. Both sides are tested together, and
each side is set against an unconditional same-side baseline.

Dedupe: no study in `research/edge/`, on the remote branches or in `research/proposals/2026-11-14-untested-backlog.md` tests a
daily gap of this shape on gold. The nearest are `gap-fill` (index opening gaps), `gold-gap-open` / `gold-weekend-gap` (the
open against the previous close), `gold-london-displacement`, `gold-comex-orb`, `ict-silver-bullet-gold` and `mmxm-pdhl-raid-gold`
(intraday gaps on M5 / M15 / H1), and `ict-variants` (an H1 index rule with a D1 / H4 gap feature).

## Data and market set

- One market: **spot gold, OANDA mid H1 XAU_USD** from March 2006 to 13 Nov 2026, read through the site's candle proxy
  (`https://meridianx.dev/md/bars`, `node --use-env-proxy run.mjs fetch <dir>`), cache kept out of git. No other market.
- Days: 17:00 New York trading days built from the H1 candles by `research/edge/gold-drd-long/run.mjs` `days()` (imported, not
  edited; weekend hours dropped, so no Sunday stub day).
- ATR14 = the mean of the true ranges of the 14 days ending at the signal day (inclusive).

## Rule

- **Bullish gap at the close of day i** (i at least the 15th day of data): low(i) > high(i−2) and the gap low(i) − high(i−2)
  is at least **0.25 x ATR14(i)**. Zone top = low(i), bottom = high(i−2). **Bearish**: high(i) < low(i−2), gap at least
  0.25 x ATR14(i), zone bottom = high(i), top = low(i−2).
- **Watch**: H1 candles of days i+1 to i+20. The first candle that trades into the zone (bull: low <= top; bear: high >=
  bottom) fills a resting limit at the zone's near edge (bull: buy at top; bear: sell at bottom), or at the candle's open when
  it opens beyond that edge. Untouched after day i+20 = no trade.
- **Stop** (every trade has one): bull = bottom − 0.5 x ATR14(i); bear = top + 0.5 x ATR14(i). A fill candle that opens at or
  beyond the stop is no trade. A trade whose risk (|entry − stop|) is under **$10** is not taken (kept so the median stop is
  $10 or more; the count skipped is reported).
- **Target** 2R. **Time exit** at the close of the last H1 candle of the 10th trading day after the fill day.
- **Management on H1**: on the fill candle only the stop is checked (the order inside the candle is unknown: a fill candle that
  also reaches the stop is a stop). On later candles: an open through the stop fills at the open; a touch of the stop is the
  stop; an open beyond the target fills at the open; a touch of the target is the target; a candle that holds both is a stop.
- **One position at a time** per tested stream (candidates by fill time; on a tie the larger gap in ATR first).

## Costs

$0.60 a round trip on every trade, plus on buys `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo
broker's XAUUSD swap.long of 11 Nov 2026, `council/fills.mjs`) x entry price, all in R of the trade's own risk. Sells are charged
no financing and credited none. Net at 2x costs = gross − 2 x (spread + financing). The cost share (cost R a trade / gross R
a trade) is reported per test.

## Windows and statistics

- In sample: entries 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31. Both reported for every test.
- t = mean / standard error of **calendar-month sums** of net R by exit month, over every month of the window (empty months
  count as 0). p two-sided (normal). **Holm over the three tests** below, on the out-of-sample p.
- **Tests**
  - **T1 (primary)**: both sides, one stream, the rule above.
  - **T2**: buys only, its own stream.
  - **T3**: sells only, its own stream.
- **Baselines (reported, not part of the bar)**: per side, a same-side market entry at the first H1 open of every trading day
  (one at a time), stop 1.0 x ATR14 of the previous day, 2R target, 10-day time exit, same costs. T2 and T3 are each read against
  their side's baseline (net R a trade, difference shown).
- **Placebo**: 40 seeded draws (seed 20261114). Each draw keeps T1's out-of-sample signals' number and buy / sell split, puts
  each on a random out-of-sample trading day (market entry at its first H1 open) with a shuffled side, the stop at the real
  trade's risk in ATR14 units, the same target, time exit and costs, one at a time. Reported: the draws' median and 95th
  percentile of the out-of-sample month t.

## Pass bar (all four)

1. T1 out-of-sample net month t >= 2 and Holm-adjusted p < 0.05;
2. T1 in-sample net R a trade > 0 (same sign);
3. T1 out-of-sample net R a trade > 0 at 2x costs;
4. T1 out-of-sample month t above the placebo's 95th percentile.

Anything else is FAIL. A PASS would only mean a candidate for its own forward paper record and owner decision; it changes nothing
live and is not proposed into the gold book. Also reported, not judged: years of T1, median stop, median hold, the share of
trades ending at stop / target / time, and the skipped-risk count.
