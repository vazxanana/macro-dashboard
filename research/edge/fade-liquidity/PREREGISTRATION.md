# Fades inside an H1 dominant zone, and liquidity sweeps as a filter (pre-registered 25 Nov 2026)

Written and committed alone, before any trade of this study was split. Paper research only: nothing live reads it.

## Why

The owner asked: test the Big-candle fade (M15) when its entry sits inside an H1 dominant (DOM) zone, and check whether
liquidity can improve the other fades. `bigfade-cost-ratio` showed the fade's before-cost R lives in tight stops, so a filter
has to beat that, not just pick winners in sample.

## Trades (imported, not edited)

- **Big-candle fade (M15)**: `bigfade-target-65` `trade()` on `big-candle-fade` `signals()` (tf 0, no break), the desk's 50 %
  target; gate = that study's published n and means (47,354 / +0.307R and 54,443 / +0.193R before costs).
- **Break fade (M15)**: `grid7-wide-fade` cell `m15 none atr 2R all` (stop 1 ATR from the fill, 2R, 1-day cap), built from its
  `signals()` and `exits()`; gate = its result.json cell count.
- Ten markets, OANDA mid 5m from the edgekit cache, shared costs (`combo-grid-2` COSTS), entries 2005-2014 (discovery) and
  2015 to Oct 2026 (confirmation), excluded periods as those studies. Net R = R - cost / risk.

## Tags (each known at the signal candle's CLOSE, from closed candles only)

1. `dom`: the fill price lies inside a standing H1 DOM zone (`combo-grid-3` `buildZones('dom')` on H1: formed at or before the
   signal close, not yet closed through). Reported by the zone's side against the trade (`domWith` / `domAgainst`); the test is
   `dom` (either side).
2. `pdl`: the signal candle's extreme went beyond the previous closed New York day's high (buy-side signal) or low (sell-side).
3. `hi24`: the extreme went beyond the highest high / lowest low of the previous 96 M15 candles.
4. `asia`: only for signals closing 07:00-17:00 UTC: the extreme went beyond that UTC day's 00:00-07:00 range high / low.

## Tests (per desk, 8 in all): trades with the tag against all other trades of that desk, in confirmation

PASS of one test needs ALL of: tagged n >= 300 in both windows; mean net R > 0 in both windows; month-sum t >= 2 in 2015-26;
tagged beats untagged in 2015-26 with Welch t >= 2; net R still > 0 at twice the costs; and a one-sided p from the month t
passing Holm over the 8 tests at 0.05. Reported beside, not judged: each tag's tagged / untagged counts and R before and after
costs, `domWith` / `domAgainst`, and by market.

**Verdict**: PASS if any test passes; INCONCLUSIVE if every tag has under 300 tagged trades in a window; FAIL otherwise.
A cut test (signals and tags of the entries before a date unchanged when later candles are removed) must pass first.
One run. No other tag, window or threshold is tried on these years after it.
