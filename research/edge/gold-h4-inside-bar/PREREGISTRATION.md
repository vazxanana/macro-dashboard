# Pre-registration: the H4 inside-bar breakout on spot gold (14 Nov 2026)

Written and pushed alone, before `run.mjs` exists and before any result was seen. Paper research only.

## Question

On spot gold H4, when a candle trades entirely inside the candle before it (an inside bar), does a stop order through the
mother candle's high or low catch a move that pays after costs, out of sample, and more than a same-side trade of the same
size and hold placed at a random time?

## Status of this rule

A **stand-alone rule**, tested on its own. It is never a gate, exit, entry or size of the live gold book (Gold trend + Gold
daily engulf); none of that book's 2006-17 positions is read (CLAUDE.md "Path to live", owner item 44). Whatever the verdict,
nothing live changes; a pass would only be a candidate for the owner, with a forward paper record first.

## Dedupe

- `gold-inside-day` (branch, 14 Nov): DAILY inside days, OCO stops at the inside day's own high / low, exit 21:00 UTC. FAIL.
- `gold-inside-week` (branch, 14 Nov): WEEKLY inside weeks. Not H4.
- `nr7-breakout`: narrowest range of 7 days, daily, not gold-only. `gold-h4-pinbar`: a rejection candle, no inside rule.
- `gold-vol-breakout*`: an open-plus-k-times-range bracket on daily candles; no inside condition.
No study in `research/edge/`, on a remote branch or in the scratchpad topic list tests an inside bar on gold H4, nor a bracket
at the MOTHER candle's extremes.

## Data

- OANDA mid H1 XAU/USD from March 2006 (fetched through the site's candle proxy; cache kept out of git), aggregated to H4.
- **H4 boundaries: fixed UTC 22 / 02 / 06 / 10 / 14 / 18**; an H1 candle on Sunday before 22:00 UTC joins the Sunday 22:00
  candle. ATR(14) = simple mean of the last 14 true ranges on H4, ending with the candle it is read on.
- Orders and trades are run on the **H1 candles** (finer than the signal), in time order.
- Windows by fill time: warm-up 2006; **in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31**.

## The signal (all read at the inside candle's close; nothing later)

Mother = H4 candle i−1, inside = H4 candle i:
1. high(i) < high(i−1) and low(i) > low(i−1) (strict);
2. mother range high(i−1) − low(i−1) ≥ 1 × ATR(14) read on candle i (so the bracket is not a tiny one eaten by costs).

## The trade

- At the inside candle's close two stop orders: buy stop at the mother's high, sell stop at the mother's low (one-cancels-other).
  They live for the next 24 H1 candles (about one trading day); unfilled = no trade.
- A fill on a gap fills at the H1 open (the worse price for the trader). **Stop = the other side of the mother candle on
  every trade** (a buy's stop is the mother's low, a sell's is its high); risk = |fill − stop|. A gap open already beyond
  the stop's side = no trade.
- If one H1 candle reaches both order levels, the trade is the side whose level is nearer that candle's open, and since that
  candle also reached the other level (the stop) it is a full loss.
- After the fill: the fill candle reaching the stop = a full loss (stop first); on later H1 candles stop first when one
  candle holds stop and target; a gapped stop fills at the open (worse), a gapped target at the open (better).
- T1 / T3 target: fill ± 2 × risk. T2: no target. Time exit: the close of the 24th H1 candle counted from the fill candle
  (the fill candle is the first).
- One position or bracket at a time per test: a new inside bar is read only once the previous bracket expired unfilled or its
  trade closed.

## Tests (Holm over these three)

- **T1 (primary):** both sides, target 2R.
- T2: both sides, no target, time exit only.
- T3: the buy stop only (the sell stop is not placed), target 2R.

## Costs

- $0.60 a round trip per trade ($0.30 spread + $0.15 slippage each side), as `gold-h4-pinbar` and `gold-inside-day`.
- Financing on buys only: `nights(fill, exit)` × `FIN.xau.long` (0.000148 of price a rollover, `council/fills.mjs`, the demo
  broker's XAUUSD swap of 11 Nov 2026) × fill / risk. Shorts are charged and credited nothing.
- R = (exit − fill) × side / risk; net = gross − cost − financing; the 2x-cost version doubles both.

## Statistics

- t on calendar-month sums of net R (every month of the window counted, empty months 0; a trade is booked in its exit month).
- One-sided p = 1 − Φ(OOS month t) per test, Holm over the three tests.
- **Baseline and placebo (keeps side, size and hold), 40 seeds** (seed 20261114 + s): for each real OOS trade, a random H1
  candle of the same calendar year is drawn; a trade of the SAME side is opened at its open with the same risk as a fraction
  of price (stop = open ∓ open × risk / fill), the same target multiple (none for T2), the same 24-H1-candle time exit and
  the same costs and financing. The seed's mean net R a trade is compared with the test's OOS mean net R. Because gold rose
  over 2017-26, this is the unconditional same-side baseline: a buy here must beat a random buy, not zero. The mean over the
  40 seeds is reported as the baseline.
- Buys and sells are reported apart (reported, not judged).

## Pass bar (per test; the verdict is T1's)

All of:
1. OOS net R a trade > 0 and OOS month t ≥ 2 with Holm-adjusted p < 0.05;
2. in-sample net R a trade > 0 (the same sign);
3. OOS net at 2x costs > 0;
4. OOS mean net beats at least 38 of the 40 placebo draws;
5. OOS n ≥ 30.

T2 or T3 passing alone is reported, never promoted to a verdict on T1's behalf. Whatever the result: not a filter, gate,
exit or size of any council system.
