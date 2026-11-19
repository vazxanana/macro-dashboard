# Pre-registration: gold after a large intraday reversal in silver (14 Nov 2026)

Written and pushed alone, before any gold return, trade or result of this study was computed. Only the number of silver events
per window was counted (below), to check the sample is large enough. Paper research only: a **stand-alone rule on gold**, not a
gate, entry, exit or size of the live gold book (Gold trend + Gold daily engulf); it reads none of that book's positions and does
not use its 2006-17 window as a book test (docs/owner-decisions.md item 44). Nothing live changes; a PASS would be a proposal to
the owner, never a rule change.

## Hypothesis and why
Silver is the thinner, more speculative precious metal. A day on which silver runs far above its previous close and then closes
BELOW it (or falls far below and closes above it) is a failed thrust: the buyers (sellers) who chased the move were absorbed.
If that failure says something about the whole metals complex, gold should move the way silver closed over the next days:
**sell gold after a bearish silver reversal, buy gold after a bullish one**, and do better than gold does on an ordinary day of
the same side. Precedent: the key-reversal pattern of technical practice applied across markets (intermarket confirmation,
Murphy, Intermarket Analysis, 2004); not opened from this sandbox, no figure of it is relied on.

**Separating the signal from gold's drift.** Gold rose over most of 2007-26, so every trade is measured against the
unconditional same-side baseline: the same trade (side, stop, hold, costs) entered after EVERY common day of the same window.

Dedupe (checked 14 Nov against `research/edge`, every remote branch, the shared topic list and
`research/proposals/2026-11-14-untested-backlog.md`): not tested before. Closest: `gold-key-reversal` (GOLD's own key / outside
reversal day, FAIL), `gold-silver-divergence` (H1 24-hour extreme not confirmed by silver, FAIL), `gold-silver-lead-intraday`
(M5 lead), `gold-metals-confirm` (silver / platinum / palladium confirming a gold breakout, FAIL), `gold-silver-ratio`,
`gold-drd-silver` (the playbook long traded ON silver), `metals-rsi2`, `post-holiday-metals`, `silver-vol-breakout`. None trades
gold on a reversal day of silver.

## Data (named before any result)
council-data `research/daily/<key>.json` (OANDA mid, UTC days) at commit `b7d716ad7` of `origin/council-data`: `xau` and `xag`
only. Weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend`. A common day = a UTC day with both
a gold and a silver candle. Trades are on XAU/USD only. The market set is these two keys and nothing else.

## Event (on common day d, known at d's close; only d and earlier candles are read)
- Silver ATR(20) = simple mean of silver's true range over the 20 silver candles before d (d-20 … d-1). Needs 21 earlier candles.
- **Bearish silver reversal**: silver's high on d minus silver's previous close >= 0.5 x ATR(20), AND silver's close on d is
  below its previous close. Signal side = -1 (sell gold).
- **Bullish silver reversal**: silver's previous close minus silver's low on d >= 0.5 x ATR(20), AND silver's close on d is
  above its previous close. Signal side = +1 (buy gold).
- (A day that meets both is impossible: the close cannot be both below and above the previous close.)
- Counts made before this file (signal days, not trades; nothing about gold read): 2007-16 120 bearish + 172 bullish = 292;
  2017-26 121 bearish + 157 bullish = 278. Both windows have at least 100 events.

## Trade
- **Entry**: the open of the first gold candle after day d, on the signal side. One position at a time per stream (a signal
  while that stream's position is open is ignored).
- **Stop**: 2 x gold ATR(20) of the 20 gold candles before the entry candle = 1R. A candle opening through the stop exits at its
  open; otherwise a touch exits at the stop (stop checked first). Every trade has a stop.
- **Exit**: the close of the 5th gold candle of the trade (entry candle = 1), unless stopped first. No target.
- **Costs**: $0.60 a round trip, plus `nights(entry, exit)` x `FIN.xau.long` x entry price on buys (council/fills.mjs; the demo
  broker's XAUUSD swap.long of 11 Nov 2026; sells are charged and credited nothing). Net R = (gross move - costs) / 1R.
- **Baseline** (per side, per window, per cost multiple): the same trade entered at the open of the gold candle after EVERY common
  day of the window, overlapping, not one at a time; its mean net R. A trade's **excess** = its net R minus the baseline of its
  side and window (at the same cost multiple).

## Windows
In sample: signal days 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31. Earlier candles only warm up the ATRs.
A trade belongs to the window of its signal day; month sums use its exit month (months with no trade count as 0).

## Tests (three, Holm over all three; one-sided normal p from the month-sum t)
- **T1 (primary, decides the verdict)**: all silver reversals, both sides, one stream: OOS mean of the calendar-month sums of
  **excess** net R, t on those month sums.
- **T2**: silver reversals on days where gold did NOT itself close beyond its previous close in the reversal's direction (gold
  closed at or above its previous close on a bearish silver day, at or below on a bullish one), both sides, its own stream:
  OOS month-sum t of excess net R. (Silver showing what gold has not.)
- **T3**: the T1 stream's raw net R (no baseline): OOS month-sum t.

## Pass bar (T1)
OOS month-sum t >= 2 with Holm-adjusted p < 0.05; in-sample mean excess > 0; OOS mean excess > 0 with costs and financing doubled
(baseline recomputed at 2x); OOS t above at least 38 of the 40 placebo draws; median stop $10 or more. Anything less is FAIL. T2
and T3 are reported with their Holm p; a pass of T2 or T3 alone is a lead, never a pass of the study.

## Placebo (seeded, 40 draws, seeds 1-40, a fixed linear congruential generator)
For each draw: from all OOS common days, draw at random without replacement as many days as the T1 stream has OOS signal days of
each side, give them that side, run them through the same one-at-a-time simulation and baseline, and record the T1 t.

## Also reported (not tests)
n, mean gross / net / excess R, win rate, worst drawdown (net R), median stop in dollars, longs and shorts apart, by year, the
baselines, the cost share, and the follow direction (trading WITH silver's thrust) as a mirror figure, never a test.
