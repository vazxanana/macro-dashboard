# Zone use count: does an engulf zone react less with each touch? (result, 23 Nov 2026)

**Verdict: FAIL. No difference between touch numbers holds (0 of 4; largest T2-EG -0.0068R a trade, t -1.60, Holm p 0.44) and no touch group passes the bar (EG first touch -0.060R a trade after costs, n 219,541, month t -15.18).**

Pre-registration: `PREREGISTRATION.md` (committed alone first). Code: `run.mjs` (imports the combo grid's `buildZones` and
`multi`, combo-grid-2's `COSTS` and `exclusions`; none edited). 18 markets pooled, H4 and H1 engulf (EG) and failed engulf
(EF) zones, every touch traded the same way (limit at the near edge, stop past the far side by half the cost, 2R, 5 / 2 days),
fills from 2020-01-01 to 23 Nov 2026: 1,220,067 trades. Discovery 2020-2023, confirmation 2024 on. Research only: no rule,
desk or council file changed.

## The question: does the reaction weaken with use?

Welch t on per-trade R after costs, two-sided, Holm over the four. A positive difference = the earlier touch did better.

| Test | Earlier | Later | Difference (R a trade) | t | Holm p | Discovery diff (t) | Confirmation diff (t) | Before costs |
|---|---|---|---|---|---|---|---|---|
| T1-EG touch 1 vs 2-3 | -0.0599 (n 219,541) | -0.0547 (n 242,633) | -0.0052 | -1.25 | 0.637 | -0.0061 (-1.10) | -0.0040 (-0.62) | -0.0019 (t -0.45) |
| T2-EG touch 2-3 vs 4+ | -0.0547 | -0.0479 (n 203,333) | -0.0068 | -1.60 | 0.438 | -0.0168 (-2.98) | +0.0070 (1.07) | 0.0000 (t 0.01) |
| T1-EF touch 1 vs 2-3 | -0.0541 (n 178,381) | -0.0540 (n 196,571) | -0.0001 | -0.03 | 1 | +0.0022 (0.37) | -0.0034 (-0.47) | +0.0032 (t 0.68) |
| T2-EF touch 2-3 vs 4+ | -0.0540 | -0.0547 (n 179,608) | +0.0008 | 0.17 | 1 | -0.0037 (-0.61) | +0.0069 (0.97) | +0.0071 (t 1.53) |

None holds. The first touch was not better than the second and third, and the second and third were not better than the
fourth and later, for EG or EF. Every difference is under 0.01R a trade on 180,000-240,000 trades a group; the signs change
between discovery and confirmation on three of the four. By market (descriptive): touch 1 beat touches 2-3 in 7 of 18 markets
for EG and 9 of 18 for EF; touches 2-3 beat 4+ in 8 of 18 for both. On this mechanical reading a zone's reaction does not
get weaker with use, and it does not get stronger either: the touch number carries no information about the trade.

## Each touch number (descriptive)

R a trade, after and before costs; month-sum t of the whole window after costs.

| Touch | EG n | EG after | EG before | EG month t | EF n | EF after | EF before | EF month t |
|---|---|---|---|---|---|---|---|---|
| 1 | 219,541 | -0.0599 | +0.0178 | -15.18 | 178,381 | -0.0541 | +0.0253 | -10.12 |
| 2 | 144,992 | -0.0548 | +0.0206 | -11.96 | 117,172 | -0.0536 | +0.0233 | -9.61 |
| 3 | 97,641 | -0.0546 | +0.0184 | -9.28 | 79,399 | -0.0545 | +0.0204 | -8.43 |
| 4 | 65,791 | -0.0525 | +0.0184 | -7.76 | 54,335 | -0.0486 | +0.0244 | -6.11 |
| 5 | 44,486 | -0.0496 | +0.0194 | -6.55 | 37,469 | -0.0498 | +0.0216 | -5.88 |
| 6+ | 93,056 | -0.0438 | +0.0207 | -4.67 | 87,804 | -0.0606 | +0.0064 | -6.61 |

Before costs every touch number sits at +0.01 to +0.03R a trade (win rate 35 %, at a 2R target 33 % breaks even); the cost
takes about 0.07-0.08R. The slightly smaller loss of later EG touches is a cost effect (zones that survive many touches are
a little wider, so the cost is a smaller share of the risk): before costs the difference is nil.

## The bar for a rule (six groups)

| Group | Discovery n, R, month t | Confirmation n, R, month t | At 2x cost | Pass |
|---|---|---|---|---|
| EG touch 1 | 127,855, -0.0650, -12.45 | 91,686, -0.0530, -8.99 | -0.1304 | no |
| EG touches 2-3 | 140,995, -0.0589, -9.70 | 101,638, -0.0489, -6.73 | -0.1229 | no |
| EG touches 4+ | 118,156, -0.0421, -5.26 | 85,177, -0.0559, -5.02 | -0.1232 | no |
| EF touch 1 | 103,831, -0.0554, -7.38 | 74,550, -0.0523, -7.00 | -0.1311 | no |
| EF touches 2-3 | 114,288, -0.0576, -7.89 | 82,283, -0.0489, -6.39 | -0.1246 | no |
| EF touches 4+ | 103,236, -0.0539, -6.31 | 76,372, -0.0558, -4.91 | -0.1256 | no |

0 of 6. Every group loses after costs in both halves. By zone timeframe (descriptive, after costs): H4 EG touch 1 -0.0353R
(n 45,893), H4 EF touch 1 -0.0159R (n 36,660, month t -1.45); the H1 groups lose more (-0.05 to -0.07R). Not a rule.

## Checks

- **Cut test**: on EUR/USD and gold, every trade closed before 1 Jul 2023 is identical when the candles from that date are
  removed (36,228 and 36,087 trades, 0 differences). The test file runs the same check on synthetic candles.
- **Fill engine (found while running it, worth knowing for the combo grids)**: the imported `multi` cancels a limit order when
  the 5-minute candle that reaches the limit also closes past the stop (its cancel check runs before its fill check on the same
  candle). A real resting limit is filled there and stopped. The pre-registered engine was kept; a sensitivity run that fills
  such candles (`sim2R`) lowers every group by about 0.01-0.02R a trade (EG touch 1 -0.0726R, n 222,618) and leaves the
  answer the same: no difference holds (largest T2-EG -0.0089R, t -2.18, Holm p 0.12, signs differ between the halves). The
  combo grids' limit entries carry the same optimistic bias.
- 2 to 206 trades a market whose fill risk was under one round-trip cost were dropped (the combo grid's rule); silver had
  6,582 touches of zones too thin to trade (risk under twice its 0.03 cost); 0 to 779 trades a market fell in the data-quality
  exclusions and were dropped.

## Limits, said plainly

- Touches are counted on the timeframe one step below the zone (H1 for H4 zones, 15 minutes for H1 zones); a touch ends at a
  closed candle wholly outside. Price hovering at an edge makes many short touches (an H1 zone lives at most 5 days and still
  reaches 6+ touches often), so "touch 6" is not what a person counting by eye would call the sixth use. A person who counts
  only clear departures and returns would number fewer touches; that reading was not tested.
- Later touches exist only for zones that survived the earlier ones; the selection is part of the question.
- Touches of one zone and correlated markets are not independent: the per-trade t overstates the evidence. Even so no
  difference reached |t| 2 on the whole window.
- It judges one mechanical zone and one plain trade; it does not judge a person's choice of zones or entries.
