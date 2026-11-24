# Big-candle fade on H4 candles, judged after costs (pre-registration, 24 Nov 2026)

Written and committed alone before any number of this study is computed. Research only: nothing live changes.

## Why

`big-candle-fade` (23 Nov 2026) found its best cell, M15 k1.5 nobreak half, at +0.193R a trade before costs in 2015-26
(n 54,443, month t 17.68) and -0.246R after costs: costs took about 0.44R a trade, because an M15 candle's stop is small.
The question here: on bigger candles, where the round trip is a smaller share of the stop, does the same fade survive costs?

**H1 is already answered** by that study's own grid (its H1 cells, same rule, same costs), and is NOT re-run here. After costs,
discovery / confirmation: H1 k1.5 nobreak half -0.043R / -0.190R (n 15,349 / 18,425; before costs +0.189R / +0.070R),
H1 k2 nobreak half -0.107R / -0.189R (n 6,603 / 7,256). Every one of its 18 H1 cells is negative after costs in 2015-26.
This study adds the one timeframe the grid did not hold: **H4**.

## Rule (big-candle-fade's own, on H4)

- H4 candles = UTC 4-hour buckets of the OANDA mid 5-minute candles (`combo-grid-3` `frames`, the same `K.resample` the other
  H4 studies use). A candle is known only at its close.
- Signal: a closed H4 candle whose body |c - o| is over k x ATR(14) of the 14 candles before it (`dom-trade-through` `atr14`
  at j - 1), k = 1.5 and 2.0. Split by whether it is also a structure break the same way (`grid7-wide-fade` `breaks`, 3 candles
  a side, as `big-candle-fade` does): "break" / "nobreak".
- Trade: FADE it: market entry against the candle at the open of the first 5-minute candle at or after its close; stop past
  its extreme + 0.1 x ATR; exits 1R, 2R, and "half" = back to the candle's 50 % (only when that is 1R or more away), via
  `grid7-wide-fade` `exits` (stop first in one candle, gaps at the open); time limit 8 days (`fade-htf`'s H4 cap; the parent
  used 1 day on M15 and 2 days on H1, the same scaling). A risk under the round-trip cost is no trade; a stop not on the losing
  side throws. The data-quality audit's bad intervals are dropped (`combo-grid-2` `exclusions`).
- Markets: the parent's ten (xau xag eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy), pooled.
- Costs: `combo-grid-2` `COSTS` (the parent's): the demo figures for gold and the four majors; **ASSUMED, not measured** for
  xag, nzdusd, usdcad, usdchf, eurjpy.
- Windows (the parent's, so H4 is comparable with its M15 and H1 cells): discovery = fills 2005-01-01 to 2014-12-31,
  confirmation = 2015-01-01 to 2026-10-31.

## The tests (2), judged AFTER costs

- T1: H4 k1.5 nobreak half fade.
- T2: H4 k2.0 nobreak half fade.

A test passes only with all of: n >= 200 in each window; mean R after costs > 0 in discovery AND in confirmation; month-sum t
(after costs) >= 2 in confirmation; Holm-adjusted one-sided p (over the 2 tests, from the confirmation month t) < 0.05.
Verdict: PASS if at least one test passes, else FAIL.

## Controls and reported (not judged)

- Mirror: the same signal traded WITH the candle (same fill, same stop distance on the other side, same targets in R).
- Plain fade: every H4 structure break faded with the same stop and exits (the parent's plain-fade comparison).
- The other ten H4 cells (k 1.5 / 2, break / nobreak, 1R / 2R / half), before and after costs, per market for T1 and T2, and
  the mean cost in R. Never quoted as findings.
- A cut test: signals known by five dates equal those computed on candles cut there (no look-ahead), on two markets.

One run, no variants. Nothing is adopted from it whatever it shows; a forward record or any live change needs the owner.
