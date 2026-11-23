# Grid 6: the market cycle as context for a triggered M15 entry (result)

**Verdict: FAIL. 0 of 155,520 cells Holm-confirmed (151 raw vs 58.9 by chance); best pooled discovery cell +0.118R a trade in 2010-14 (n 2318, month t 5.53), +0.009R in 2015-19 (n 2344, t 0.36).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing was placed. OANDA mid 5-minute candles of the `edgekit` cache (xau, eurusd, gbpusd, usdjpy, audusd), warm-up
from 2009, fills 2010-01-01 to 2019-12-31. The context is `phase.mjs` `readPhase` at the last closed H1 candle; entries at
market only (no limit, so no touch-fill effect); management is `dom-trade-through`'s `manage`. 380,393 trigger rows across the
five markets (each traded once as signalled and once side-flipped).

## Stage levels after the collapse rule

36 of 45 levels kept (any, 12 single-timeframe stages, 12 H4 x H1 and 11 D1 x H4 pairs). Dropped (under 3% of the 2010-14 H1
closes, decided from the context alone): H4 pullback + H1 range, H4 range + H1 pullback / continuation / range, D1 move /
pullback / range + H4 range, D1 range + H4 pullback / continuation. 36 x 3 sides x 3 positions x 4 triggers x 4 sessions x 5
exits = 25,920 rules on each of five markets and pooled = 155,520 cells; 99,041 reach n >= 100 in discovery.

## The bar (before costs; after costs beside)

| | Discovery winners 2010-14 | Raw confirmations 2015-19 | By chance (x 0.0228) | Holm-confirmed |
|---|---|---|---|---|
| The rules, before costs | 2,582 | 151 | 58.9 | 0 |
| The rules, after costs | 272 | 2 | | 0 |
| Side-flipped placebo, before costs | 7,211 | 1,351 | 164.4 | 48 |

No rule passed. The best confirmation cells (pooled: an M15 engulf in London while H1 is in a continuation, trailed exit,
+0.067R in 2010-14, t 3.26, and +0.088R in 2015-19, t 4.19, n 4,267) fail Holm over 2,582 tests and are near zero after costs
(+0.010R, t 0.51). Agreeing with the H4 side did not help: of the 151 raw confirmations 48 trade with H4, 32 against it and 71
take no side condition; the cheap half of the H4 range 38, the dear half 28.

## Every trigger, all contexts together (pooled, trailed exit, R a trade)

| Trigger | 2010-14 before (t) | 2015-19 before (t) | 2015-19 after costs (t) | Flipped, 2015-19 before (t) |
|---|---|---|---|---|
| Structure break (bo) | -0.025 (-3.51) | -0.020 (-2.90) | -0.079 (-11.19) | +0.034 (5.20) |
| Box close-out (box) | -0.034 (-4.26) | -0.041 (-4.54) | -0.094 (-10.58) | +0.039 (5.93) |
| Engulf (eg) | -0.018 (-3.73) | -0.017 (-3.18) | -0.099 (-17.39) | +0.023 (5.00) |
| Sweep and close back (sweep) | +0.033 (4.55) | +0.009 (0.84) | -0.162 (-14.54) | +0.009 (1.05) |

The three breakout triggers lose before costs in both windows at market, and their flipped twins win: on 5-minute mid
candles a market entry after an M15 break tends to buy near the end of the move. The sweep (itself a reversal) earned in
2010-14 and not in 2015-19.

## The placebo, reported, not the verdict

48 flipped cells are Holm-confirmed before costs; 36 of them are in the `other` session (outside 07:00-17:00 UTC), mostly
fading an M15 box close-out or engulf with a 1R target or a trail. Only 1 of the 48 also clears the bar after costs: eurusd,
any stage, box close-out, other session, 1R, flipped: +0.053R a trade after costs in 2010-14 (n 2,736, t 2.85) and +0.032R
in 2015-19 (n 2,509, t 2.06). That is one cell picked out of a grid after the fact: a hypothesis for its own pre-registration
on other data (2005-09 and the holdout markets), never an edge; it pays a few hundredths of an R a trade against an assumed
cost.

## What it says

The cycle context (D1 / H4 / H1 stage, the H4 side, the H4 half) does not turn a market-entered M15 trigger into a positive
rule before costs on 2010-2019. As grid 5, `ltf-structure` and `direction-chain-gate` found, being with the higher timeframes
does not pick better trades in these readings. What the grid does show is that, at market on M15, the breakout triggers'
direction is the wrong one before costs, mostly in the quiet hours. Nothing live changed. Do not re-test variants of this grid
on 2010-2019. Test: `tests/grid6-phase-trigger.test.mjs` (the cut test, stops on the losing side, the context against
`readPhase`, the collapse rule, this file pinned to `result.json`).
