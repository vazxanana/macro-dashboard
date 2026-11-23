# Opening prices as levels: cross, fade, failed cross (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`grid7-wide-fade` found a small before-cost tilt in fading the first structure break at market on ten markets in both
decades (M15, ATR stop, 2R: +0.054R / +0.042R a trade, month t 11.4 / 11.3), and nothing after costs. Opening prices (the New
York midnight open, the 08:30 New York price, the Daily, Weekly and Monthly opens) are levels many traders mark. This study asks
whether a close across such an open, or a failed attempt to cross it, picks trades that beat that plain fade rule at the same
times, before costs. Every cell is fixed below; one run, no variants.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`; `EDGE_DATA` on the
  machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10, pooled): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy.
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m and 1h (UTC buckets).
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.
- Costs (reported beside, never part of the bar): `combo-grid-2` `COSTS`, the demo account's round trip for gold, EUR/USD,
  GBP/USD, USD/JPY, AUD/USD; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The levels (five; the price = the OPEN of the 5-minute candle starting at the level time)

- **nymid**: 00:00 New York time (`edgekit` `nyOffsetH`), New York weekdays Monday-Friday.
- **ny0830**: 08:30 New York time, New York weekdays Monday-Friday.
- **dopen**: 00:00 UTC, UTC weekdays Monday-Friday.
  For these three a day whose 5-minute candle does not start exactly at the level time (a holiday, a data hole) has no level.
- **wopen**: the first 5-minute candle of each week, weeks starting Saturday 00:00 UTC (the Sunday reopen).
- **mopen**: the first 5-minute candle of each UTC calendar month.

A level is known from its time tL and lives until the next level of its kind is set (about a day, a week, a month). Only
candles of the event timeframe T that START at or after tL and END by the next level's time are read for it.

## The events (on T = M15 for every level; also T = H1 for wopen and mopen; closed candles only)

The side of a candle = sign(close - level). The first T candle after tL sets the side (no event: price started at the level).

- **with (a)**: a later T candle j closes on the other side of the level (side d) than the last nonzero side: a cross. Trade
  WITH it: side s = d. Stop 1 x ATR(14) of T at j from the fill.
- **fade (b)**: the same cross, traded AGAINST it: s = -d. Stop past candle j's extreme in direction d (its high for an up
  cross, low for a down cross) by 0.1 x ATR(14) of T at j.
- **failed (c)**: with the side r established, a T candle j0 trades through the level by at least 0.2 x ATR(14) of T at j0 (its
  high >= level + 0.2 ATR when r = -1; its low <= level - 0.2 ATR when r = +1), and a candle k in j0, j0+1, j0+2 closes back on
  side r (the first such k; j0 itself counts). Trade back: s = r. Stop past the extreme reached through the level over candles
  j0..k (highest high for r = -1, lowest low for r = +1) by 0.1 x ATR(14) of T at k. An attempt is used once: the next search
  starts after k, or after j0+2 when no candle closed back. The side keeps updating with every close as in (a).

Every event is known at the close of its event candle (j for a and b, k for c). An event candle must end by the level's end.

## The trade

Market entry at the open of the first 5-minute candle starting at or after the event candle's close. Every trade has a stop on
its losing side; a fill at or past the stop is no trade; a risk under the market's round-trip cost is no trade (same rule as
`grid7-wide-core`). Exits: **1R** or **2R**; stop first when one 5-minute candle holds stop and target; a gap through either
fills at the open. Time limit: M15 1 day, H1 2 days from the fill (out at the close of the 5-minute candle that reaches it).
Trades overlap freely.

## Context (part B only)

- **Session** by the fill's UTC hour: **london** 07:00-11:59, **ny** 12:00-16:59, **other** = the rest.
- **first / later**: the first event of its kind (a cross for a and b, a failed cross for c) since the level was set, or a later one.

## The cells (57, fixed here)

A. 7 level-timeframes (nymid m15, ny0830 m15, dopen m15, wopen m15, wopen h1, mopen m15, mopen h1) x 3 events (with, fade,
failed) x 2 exits (1R, 2R) = **42 cells**, all sessions.

B. Pooled over the five M15 level-timeframes (nymid, ny0830, dopen, wopen, mopen; one per level), exit 1R: 3 events x 5
contexts (london, ny, other, first, later) = **15 cells**.

Names: `<level> <tf> <event> <exit>` for part A (e.g. `nymid m15 fade 1R`), `m15all <event> 1R <context>` for part B.

## The control (the plain grid7-wide-fade rule at matched times)

The plain fade rule of `grid7-wide-fade` (imported, not edited: its `breaks`, `exits`; no context; the "ext" stop) on the same
market and the same T (M15 or H1) with the same exit (1R or 2R), with the same exclusion, wrong-side and risk-under-cost
filters. For each trade of a cell, its matched control trade = the plain-rule trade on that market and timeframe whose fill is
nearest in time, within 2 hours either side (earlier wins a tie); a cell trade with none has no control. The same control
trade may be matched to several cell trades. Control stats per window: n, mean R of the matched control trades.

## The bar (judged BEFORE costs)

A cell passes when ALL hold:
1. n >= 300 trades in each window;
2. mean R > 0 and month-sum t >= 2 in discovery;
3. mean R > 0 and month-sum t >= 2 in confirmation;
4. Holm-adjusted one-sided p < 0.05 over the 57 confirmation month-sum tests (p from the month-sum t, df = months - 1);
5. it beats its control: cell mean minus matched-control mean > 0 with Welch t >= 2 in BOTH windows (trade-level Welch t).

Verdict: **PASS** if one cell or more passes; **FAIL** otherwise. INCONCLUSIVE only if the data cannot be read (fewer than 8 of
the 10 markets load).

## Also reported (not part of the bar)

- **The side-flipped check**: every cell traded the other way (same fill, the stop at the same distance on the other side,
  targets at the same distances in R), its month t and whether it would pass bars 1-4.
- **After costs** beside every figure: R less (round-trip cost / risk) per trade, and the mean cost in R.
- **Per-market rows** for any passing cell.
- **Cut test**: on five dates in two markets, the events known by a date computed on candles cut there equal the full run's.

## What a result means

A pass is a before-cost tilt in both decades over the plain fade rule at the same times, nothing more: if the cost in R is
larger than the tilt it is not tradable and is said so. Not adopted, never called an edge, no live change; a forward record
would need the owner. One run, no variants on these years.
