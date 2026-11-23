# Grid 6: smart-money combinations with market and trade-through entries (result)

**Verdict: FAIL. 0 of 100,800 cells confirmed after Holm; the best, an H4 gap with an M5 ChoCh in London at market with a trailing stop, made +0.042R a trade before costs in 2015-19 (n 6,605, month t 3.37, Holm p 0.55).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Pooled and per market: xau,
eurusd, gbpusd, usdjpy, audusd; OANDA mid 5-minute candles from the `edgekit` cache; fills 2010-2019 (discovery 2010-2014,
confirmation 2015-2019); grid 2's costs and data-quality exclusions; fills by `dom-trade-through` (`findFill` with a
trade-through of half the round trip, never a touch) and its `manage` (grid 3's exits). Judged before costs; after costs
beside. Research only: nothing live changed, nothing was placed. Every trade has a stop on its losing side (the run throws
otherwise).

## The bar (16,800 cells a scope x 6 scopes)

| | Cells with n >= 100 (2010-14) | Discovery winners | Reached confirmation (n >= 100) | Raw confirmations | Expected by chance | Confirmed after Holm |
|---|---:|---:|---:|---:|---:|---:|
| Real, before costs | 58,391 | 856 | 829 | 31 | 18.9 | **0** |
| Real, after costs | 58,391 | 205 | 193 | 3 | 4.4 | 0 |
| Side-flipped placebo, before costs | 53,763 | 2,129 | 2,066 | 323 | 47.1 | 19 |
| Side-flipped placebo, after costs | 53,763 | 366 | 355 | 6 | 8.1 | 0 |

Fewer real cells won discovery (856, 1.5 % of the cells with 100 trades) than a one-sided t of 2 gives by chance (2.3 %);
31 raw confirmations against about 19 expected is within what overlapping cells give, and none survives Holm (the cells
share trades heavily, so these counts are rough). After costs nothing is left.

The best real cells by confirmation month t (before costs; none passes Holm):

| Scope | POI | Liquidity | Confirmation | P / D | Session | Entry | Stop | Exit | 2010-14 | 2015-19 | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|---:|
| pool | fvg4 | none | m5choch | any | lon | mkt | swing | trail | +0.040R (n 6,522, t 2.69) | +0.042R (n 6,605, t 3.37) | 0.55 |
| pool | fvg4 | none | m5ifvg | any | lon | mkt | swing | trail | +0.034R (n 33,270, t 2.83) | +0.035R (n 33,107, t 3.16) | 1 |
| pool | fvg4 | none | m5choch | any | lon | mkt | swing | 3R | +0.039R (n 6,522, t 2.07) | +0.061R (n 6,605, t 3.01) | 1 |
| audusd | fvg4 | eq | m15disp | any | other | mkt | sweep | 1R | +0.199R (n 159, t 2.32) | +0.189R (n 198, t 2.90) | 1 |
| pool | fvg4 | none | m5ifvg | with | lon | mkt | swing | 3R | +0.070R (n 15,211, t 2.14) | +0.067R (n 15,784, t 2.83) | 1 |

These are small: an M5 swing stop is a few pips, so the London H4-gap cells lose after costs.

## Standard combinations (pooled; before costs, after costs, side-flipped placebo)

| Combination | 2010-14 before | 2015-19 before | 2015-19 after | 2015-19 placebo |
|---|---|---|---|---|
| H4 order block, previous-day sweep, M15 ChoCh, discount, limit at the gap 50 %, sweep stop, 2R | -0.088R (n 128, t -0.81) | -0.052R (n 133, t -0.41) | -0.109R | +0.064R (n 130) |
| H4 gap, Asia sweep, M5 ChoCh, discount, London, market, sweep stop, 2R | -0.071R (n 703, t -1.35) | -0.007R (n 777, t -0.13) | -0.068R | +0.021R (n 777) |
| Daily engulf zone, equal lows / highs swept, M15 inverse gap, market, swing stop, trail | +0.028R (n 8,960, t 1.28) | -0.015R (n 8,957, t -0.77) | -0.069R (t -3.40) | +0.042R (n 8,959) |
| Daily order block, M15 displacement, market, swing stop, previous-day target | +0.003R (n 1,688, t 0.05) | -0.068R (n 1,286, t -1.08) | -0.117R | -0.019R (n 1,419) |

## Each piece, over all cells (pooled, premium / discount and session "any"; R a trade weighted by cell trades)

| Piece | Value | Before costs | After costs | Placebo |
|---|---|---:|---:|---:|
| POI | ob4 / ob1d / fvg4 / fvg1d / eg1d | -0.034 / -0.043 / -0.009 / -0.015 / -0.021 | -0.112 / -0.119 / -0.089 / -0.093 / -0.101 | see result.json |
| Liquidity | none / pd / asia / eq | -0.021 / -0.011 / -0.029 / -0.008 | -0.115 / -0.077 / -0.093 / -0.075 | |
| Confirmation | m15choch / m15ifvg / m15disp | -0.015 / -0.001 / +0.013 | -0.063 / -0.056 / -0.031 | +0.020 / +0.005 / -0.004 |
| | m5choch / m5ifvg / m5disp | -0.026 / -0.023 / -0.026 | -0.105 / -0.114 / -0.102 | +0.008 / +0.003 / +0.011 |
| Entry | mkt / lim50 | -0.015 / -0.034 | -0.087 / -0.143 | +0.016 / -0.043 |
| Stop | swing / sweep | -0.022 / -0.009 | -0.112 / -0.058 | |
| Exit | 1R / 2R / 3R / opp / trail | -0.015 / -0.015 / -0.014 / -0.037 / -0.016 | -0.093 / -0.093 / -0.092 / -0.121 / -0.094 | -0.004 / +0.008 / +0.008 / -0.006 / +0.014 |

No piece is positive before costs on the whole except the M15 displacement (+0.013R), and nothing is positive after costs.
The trade-through limit at the gap's 50 % is worse than the market entry (-0.034R against -0.015R), as `dom-trade-through`
leads one to expect once a touch no longer counts as a fill.

## The side-flipped placebo

Taking the opposite side at the same moment did slightly better than the signals themselves: about +0.016R a trade on the
market entries against -0.015R, and 19 placebo cells pass the bar before costs (most in GBP/USD or the pool, Daily engulf or
Daily gap zones, M5 displacement or M15 ChoCh, outside London and New York, market, swing stop, 1R or trail; the best
GBP/USD fvg1d m5disp other mkt swing 1R, +0.133R, n 2,939, month t 6.56). After costs none passes. Read plainly: in these
years a smart-money confirmation on M5 / M15 inside an H4 or Daily point of interest tended to mark a short-term extreme
that partly reversed, the opposite of what the method expects. This is an observation from a placebo, chosen after looking,
on the same years: a hypothesis for its own pre-registered test on other data, never an edge.

**Deviation, stated:** the pre-registration said the placebo is made "for every real trade". On the first run that made the
placebo only when the real limit FILLED, and a buy limit below the close fills only after price has fallen to it, which a
flipped sell with a tight stop profits from (placebo +0.54R a trade on the limit cells): a selection on later prices. The
placebo is now decided at the order: for the market entry a market trade of the other side at the next open with the same
stop distance; for the limit entry a trade-through limit of the other side mirrored around the signal close (2 x close -
limit), with the same stop distance and life, taken whether or not the real limit fills. The real cells, and so the
verdict, are the same in both runs (856 discovery winners, 31 raw, 0 after Holm).

## Checks

- **Cut test** (candles cut at 2015-01-01, trades of 2014 whose order life and time limit end inside the cut candles):
  identical on all five markets (xau 36,527, eurusd 36,157, gbpusd 39,245, usdjpy 35,340, audusd 40,780 trades, 0
  differences). A first version of the test compared one gold trade whose 24-hour limit ran over gold's early New Year's Eve
  close (its exit candle is on 2 January, after the cut): the test window now ends at the last candle on file, not the cut.
- Trades per market (real, all orders that filled): xau 328,508, eurusd 360,547, gbpusd 390,657, usdjpy 362,774, audusd
  400,968. A trade counts in every cell whose pieces it meets, so cells share trades.
- Not one at a time (as the earlier grids); the month-sum t absorbs clustering within a month.

## Details of the reading (fixed in code before the run)

- Equal lows / highs: a candidate H1 swing must not have been traded through by more than the tolerance before the second
  swing is confirmed (a slight undercut still counts as "equal"); the pair's level is the lower low (higher high).
- Displacement: the body is compared with the ATR(14) of the candles before the signal candle.
- Session and premium / discount are read at the close of the signal candle; the H4 range is the latest confirmed swing high
  and low (3 a side).

## What it means

No combination of these smart-money pieces, with honest fills, picks trades that make money before costs on 2010-2019 in
both halves after accounting for the number of cells tried, and nothing survives costs. Do not re-test variants of these
pieces on these years. To repeat: `node --use-env-proxy research/edge/_lib/fetch-cache.mjs <m> 5m 2009 2019` for the five
markets, then `run.mjs market <m> <dir>`, `run.mjs cut <m> <dir>`, `run.mjs report <dir>` (about 20 seconds a market).
Test: `tests/grid6-smc-market.test.mjs`.
