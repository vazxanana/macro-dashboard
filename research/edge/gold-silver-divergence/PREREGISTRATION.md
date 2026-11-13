# Pre-registration: intraday gold / silver divergence on H1, fade and follow (13 Nov 2026)

Written and pushed before any trade of this rule is computed. Paper research only: whatever the result, nothing live changes;
a PASS would be a proposal to the owner under `research/proposals/`.

## What this is, and what it is not
A **new stand-alone intraday rule** on gold (XAU/USD), not a change to any council system. It tests the "SMT" idea (gold and
silver should confirm each other's new extremes; a new extreme one of them does not confirm is a divergence) as a plain
statistical rule, with no other ICT element. It is **not** the gold book (Gold trend + Gold daily engulf) and reads none of
its positions: item 44 (no further gate, exit, entry or size tested on the book's 2006-17 window) is not touched. The
replication window 2008-2019 overlaps those calendar years only because it is the earlier half of the H1 history; the trades
here are a different rule's. It is also not the MMXM study's test (silver SMT as a condition on a Day-3 gold setup): here the
divergence alone is the signal.

## Data
OANDA mid H1 candles, XAU_USD and XAG_USD, through the site's keyless candle proxy (`/md/bars`, 4999-candle windows, paced),
from the first candle served (March 2006) to the last complete candle on file. Kept outside git. UTC hours as served.
Only hours where BOTH markets have a candle are used (inner join on the candle's start time); every count of "candles" below
is on that joined series.

## The event (on candle i, known at its close)
- **Divergent high**: gold's close of candle i is above the maximum gold close of the prior 24 joined candles (i-24 … i-1),
  while silver's close of candle i is strictly below the maximum silver close of the same 24 candles.
- **Divergent low**: gold's close is below the minimum gold close of the prior 24, while silver's close is strictly above the
  minimum silver close of the same 24.
- Needs 24 prior joined candles; a weekend inside them is not removed (24 candles, not 24 clock hours).

## Trades
- Entry at the open of the next joined candle (i+1), gold price, **only if** that candle starts exactly one hour after candle i
  starts (a signal on the last candle before a weekend or a hole is dropped, never carried).
- **Rollover skip**: no entry when the entry candle starts at 21:00 or 22:00 UTC (the 21:00-23:00 rollover hours). The signal
  is dropped, not delayed.
- Risk: ATR(24) = simple mean of the true range of the 24 joined gold candles ending with candle i (i-23 … i). Stop 1 x ATR
  beyond the entry; target 1.5 x ATR (1.5R) on the other side. **Every trade has a stop.**
- **Fade variant**: sell after a divergent high, buy after a divergent low. **Follow variant**: buy after a divergent high, sell
  after a divergent low. Same stop, target and exit.
- Management from the entry candle on (the entry candle counts as candle 1): a candle that opens beyond the stop fills the
  stop at its open; a candle whose range holds both stop and target is a stop (stop first); a target fills at the target price
  (never better, even on a gap). Otherwise out at the close of the 12th candle.
- One open trade at a time per variant: a signal whose entry candle starts before the open trade's exit candle has closed is
  skipped.

## Costs (net R)
- $0.30 a round trip on every trade: cost R = 0.30 / ATR distance.
- Gold-long financing from `council/fills.mjs`: `nights(entry candle start, exit candle end)` x `FIN.xau.long` x entry / ATR
  distance (rollovers Monday-Friday 22:00 UTC, Wednesday three). Shorts pay nothing and are credited nothing.
- Net R = gross R - cost R - financing R.

## Windows
- **Decisive**: trades entered 2020-01-01 to the end of the data.
- **Replication**: trades entered 2008-01-01 to 2019-12-31. (2006-07 only provides the look-back.)
- A trade belongs to the window of its entry; the one-at-a-time stream is run once over the whole history.

## Pass bar (per variant; both variants are tested, Holm over the 2)
A variant PASSES only if all hold:
1. pooled net R a trade on the decisive window > 0;
2. t >= 2 on calendar-month sums of net R in the decisive window (every calendar month of the window counted, a month with no
   trade = 0; t = mean / (sd / sqrt(months)));
3. Holm over the two variants on that t (one-sided p from the normal approximation; smallest p <= 0.025, the other <= 0.05);
4. the same sign (net R a trade > 0) in the replication window;
5. beats the placebo: its decisive net R a trade is above the 95th percentile of 40 placebo runs (seeds 1 … 40).

**Placebo**: the "gold-only" events, i.e. the same gold new 24-candle high / low condition with NO silver condition, under the
same entry checks (next candle one hour later, rollover skip). For each seed, draw at random (seeded) from the gold-only
events of the whole history as many as the variant's divergent events (same history, before the one-at-a-time filter), and
run them with the same side rule (fade: sell after a new high; follow: buy after a new high), stops, exits, costs and the
one-at-a-time filter; record the decisive-window net R a trade. 95th percentile = linear interpolation at 0.95 x (40 - 1) on
the sorted 40 values.

**Verdict**: PASS if either variant passes; otherwise FAIL. Reported beside it, not tested: gross R, win rate, worst drawdown,
year by year, highs and lows apart, the trade-level t, and the placebo's median.

## What a result means
A PASS is evidence for one paper rule on gold, to be proposed to the owner and forward-tested on paper; never a live change.
A FAIL ends this reading of SMT as a stand-alone intraday rule on gold H1; another reading (other look-back, timeframe or
market pair) needs its own pre-registration.
