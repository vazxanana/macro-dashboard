# Grid 5: fresh supply / demand zones with a lower-timeframe trigger (result)

**Verdict: FAIL. 0 of 48 discovery winners confirmed (48 of 5,051 cells passed 2010-14 before costs, fewer than the 115 expected by chance; none reached month t 2 in 2015-19); the best 2015-19 cell, EUR/USD H4 zone > M15 EF in a pullback, market entry, zone stop, trail: n 288, +0.178R a trade, month t 1.72.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first, ae0be5a). OANDA mid 5-minute
candles, xau, eurusd, gbpusd, usdjpy, audusd, fills 2010-2019 (2009 warm-up only; nothing of 2020 on read). 1,440 rules x
(five markets + pooled) = 8,640 cells; 1,493,423 simulated trades (real side and placebo together). Only broker-like fills: a
market entry at the trigger candle's close, or a limit that price trades THROUGH by half the round trip. Research only:
nothing live changed.

## The two stages (judged before costs, month-sum t over 60 months each)

| | Cells tested (n >= 100 in 2010-14) | Discovery winners (mean > 0, t >= 2) | Chance (2.3 %) | Checked (n >= 50 in 2015-19) | Raw t >= 2 in 2015-19 | Chance | Confirmed (Holm) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Real | 5,051 | 48 | 115 | 48 | 0 | 1.1 | 0 |
| Side-flipped placebo | 2,775 | 21 | 63 | 21 | 0 | 0.5 | 0 |

Discovery found fewer winners than chance would give, and none of them held in 2015-2019. The real side and the placebo look
alike: neither shows a family that survives.

## The best cells

| Scope, rule | 2010-14 n, R a trade, t | 2015-19 n, R a trade, t | 2015-19 after costs |
|---|---|---|---|
| eurusd 4h>15m, any touch, EF, pullback, market, zone stop, trail (best 2015-19 t) | 310, +0.350, 2.99 | 288, +0.178, 1.72 | +0.163 (t 1.58) |
| usdjpy 1h>5m, first touch, EG1, pullback, market, zone stop, 2R (best 2010-14 t) | 329, +0.259, 3.39 | 320, -0.157, -2.14 | -0.202 |
| gbpusd 4h>15m, first touch, EG1, any stage, limit, trigger stop, 1R | 266, +0.157, 2.49 | 285, -0.192, -3.08 | -0.269 |

Seven pooled cells passed discovery (n 186 to 2,099, t 2.02 to 2.37); in 2015-19 they made -0.163R to +0.089R a trade, best
month t 1.21 (H4 > M15, any touch, EF, continuation, market, trigger stop, 3R: n 615, +0.089R). No per-market winner passed
discovery on the same rule in a second market.

## By factor (pooled cells with n >= 100 and n >= 50, mean of the cells' R a trade, before costs)

| Factor | Level | 2010-14 | 2015-19 | 2015-19 after costs |
|---|---|---:|---:|---:|
| Chain | D1 > H1 | -0.004 | -0.079 | -0.112 |
| | H4 > M15 | -0.002 | -0.006 | -0.067 |
| | H1 > M5 | -0.028 | -0.088 | -0.190 |
| Visit | first touch | -0.012 | -0.089 | -0.159 |
| | any touch | -0.013 | -0.038 | -0.107 |
| Trigger | EG within 1 | -0.019 | -0.069 | -0.147 |
| | EG within 3 | -0.014 | -0.065 | -0.137 |
| | EF | -0.017 | -0.061 | -0.142 |
| | structure break | +0.001 | -0.034 | -0.077 |
| Stage | pullback | -0.003 | -0.087 | -0.158 |
| | continuation | -0.015 | -0.020 | -0.092 |
| | any | -0.019 | -0.056 | -0.122 |
| Entry | market | -0.004 | -0.040 | -0.101 |
| | trade-through limit | -0.021 | -0.077 | -0.154 |
| Stop | zone | -0.009 | -0.050 | -0.077 |
| | trigger | -0.017 | -0.066 | -0.178 |
| Exit | 1R / 2R / 3R | -0.012 / -0.020 / -0.012 | -0.049 / -0.061 / -0.068 | -0.117 / -0.129 / -0.136 |
| | trail / opposite zone | -0.005 / -0.014 | -0.044 / -0.069 | -0.112 / -0.143 |

Every level is about zero or below before costs and negative after them. The "fresh" first touch is no better than any
touch; a pullback stage on the key timeframe is no better than any stage; the trade-through limit is worse than the market
entry, as `dom-trade-through` found for touch-filled limits. Of 1,169 pooled cells, 474 were positive in 2010-14, 251 of those
with enough trades positive in 2015-19, 128 after costs: about what noise around a slightly negative mean gives.

## What it means

The order block at the origin of a break leg, confirmed by an engulf, a failed engulf or a structure break on the timeframe
below, does not pick better trades on these markets in 2010-2019 before costs, in any of 1,440 combinations. Do not re-test
variants of it on these years. The Charts page's zones and the gold terminal's locked S/D zones stay as display; nothing here
changes them. Never quote a cell of this grid as an edge.

## To repeat

    export EDGE_DATA=<cache>; node --use-env-proxy research/edge/_lib/fetch-cache.mjs <m> 5m 2009 2019   # each market
    node --max-old-space-size=6000 research/edge/grid5-sd-eg/run.mjs market <m> <dir>                   # each market, ~10 s
    node research/edge/grid5-sd-eg/run.mjs report <dir>                                                  # -> result.json

Test: `tests/grid5-sd-eg.test.mjs` (the order block on hand-made candles, a cut test on seeded candles, the stage reader,
this file against result.json).
