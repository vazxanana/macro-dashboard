# Grid 5: the cycle stage of the timeframe above and a swing-box event below (result)

**Verdict: FAIL. 0 of 12,960 cells Holm-confirmed (3 raw vs 2.3 by chance); best pooled cell +0.059R in 2010-14 (n 3,345, month t 3.18), +0.019R in 2015-19 (n 3,234, t 1.00).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing was placed. OANDA mid 5-minute candles of the `edgekit` cache (xau, eurusd, gbpusd, usdjpy, audusd), fills
2010-01-01 to 2019-12-31, every year of 5-minute candles complete. Stage and side come from `phase.mjs` `readPhase` at the
trigger candle's close; limits fill only on a trade-through by half the round trip (`dom-trade-through` F2); management is
that study's `manage`. 2,160 rules on each market and pooled; 7,930 cells reached n >= 100 in discovery.

## The bar (before costs; after costs beside)

| | Discovery winners 2010-14 | Raw confirmations 2015-19 | Expected by chance | Holm-confirmed |
|---|---:|---:|---:|---:|
| The grid | 99 | 3 | 2.3 | 0 |
| Side-flipped placebo | 1,133 | 186 | 25.8 | 2 |
| The grid, after costs | 27 | 0 | | 0 |

No cell passes. The three raw confirmations are about what chance gives:

| Scope | Rule | 2010-14 before (after) | 2015-19 before (after) |
|---|---|---|---|
| GBP/USD | H4 > H1, continuation, one up, break, market, box stop, trail | +0.122R, n 289, t 2.01 (+0.111) | +0.118R, n 260, t 2.00 (+0.106, t 1.79) |
| Pooled | H1 > M15, any stage, false break, market, box stop, 3R | +0.040R, n 10,449, t 2.20 (-0.061) | +0.037R, n 10,075, t 2.15 (-0.085) |
| Pooled | H1 > M15, move, false break, market, box stop, 1R | +0.053R, n 3,321, t 2.87 (-0.036) | +0.040R, n 3,197, t 2.25 (-0.069) |

Where the 99 discovery winners sat: chains 4h>1h 49, 1h>15m 49, 1d>4h 1; stage any 20, move 15, pullback 12, continuation
52; side none 73, one 23, two 3; entry market 86, limit 13. Agreement with the timeframes above did not pick better trades:
"two up" gave 3 discovery winners of 4,320 cells, against 73 for "none". The trade-through limit at the broken edge rarely
helped (13 of 99).

## The side-flipped placebo

Reversing the direction of the same triggers (market entry, the same stop distance on the other side) did far better than
the rules themselves: 1,133 discovery winners and 186 raw confirmations, 181 of them on the H1 > M15 chain and 168 on box
breaks. The two Holm-confirmed placebo cells are both "fade an M15 swing-box break at market, stop the box's distance, trail
1R from +1R", every stage and side:

| Placebo cell (pooled) | 2010-14 before (after) | 2015-19 before (after) |
|---|---|---|
| H1 > M15, any, break, market entry, box stop, trail | +0.040R, n 26,855, t 5.91 (+0.008, t 1.14) | +0.036R, n 25,955, t 5.57 (-0.005, t -0.78) |
| H1 > M15, any, break, limit cell's distance, box stop, trail | +0.046R, n 26,844, t 6.52 (+0.006) | +0.034R, n 25,951, t 5.30 (-0.017, t -2.47) |

So on 15-minute candles a close out of a swing box tends to come back a little, not run: a short-term mean reversion of about
0.04R a trade before costs, which the costs take entirely (after costs about zero in 2010-14 and negative in 2015-19). This was
not a pre-registered test; it is reported, and it is not an edge.

## Reading

- The market cycle stage of the timeframe above (move / pullback / continuation, as `phase.mjs` reads it) and the side
  agreement of one or two timeframes above did not make swing-box breaks, false breaks or retests on the timeframe below pay,
  before or after costs, on 2010-2019 for these five markets.
- Box breaks on M15 are, if anything, faded by the following candles; the trend-following reading of a box break loses that
  small amount plus the costs.
- Nothing here is an edge. No variant of this grid should be re-tested on these years.

## Checks

`tests/grid5-cycle-box.test.mjs` (offline): a cut test on seeded candles (trades built on candles cut at a moment equal the
full run's trades that end before it), every trade's stop on the losing side, a limit does not fill on a mere touch, the phase
reading on tails equals `readPhase` on the whole series, and this file pinned to `result.json`.

To repeat: fill the cache (`research/edge/_lib/fetch-cache.mjs <m> 5m 2009 2019`), then
`node --max-old-space-size=6000 research/edge/grid5-cycle-box/run.mjs market <m> <dir>` for the five markets and
`node research/edge/grid5-cycle-box/run.mjs report <dir>`.
