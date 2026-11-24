# Fading the first M15 break at the broker's bid / ask ticks (result)

**m15 none atr 2R all: INCONCLUSIVE, tick -0.1997R a trade (n 1605, month t -5.3375; after commission -0.2497R) against mid -0.1803R; tick - mid -0.0195R (month t -2.7773). m15 none ext swing all: INCONCLUSIVE, tick -0.6454R a trade (n 1519, month t -9.7715; after commission -0.8315R) against mid -0.5845R; tick - mid -0.0609R (month t -3.4362)**

Pre-registered in `PREREGISTRATION.md` (committed and pushed alone first). Paper research only: nothing live changed.

| Rule | n | tick R (month t) | after commission | mid R | mid after cost | tick - mid (month t) | Holm | Verdict |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| m15 none atr 2R all | 1605 | -0.1997 (-5.3375) | -0.2497 (-6.5073) | -0.1803 | -0.2628 | -0.0195 (-2.7773) | 1 | INCONCLUSIVE |
| m15 none ext swing all | 1519 | -0.6454 (-9.7715) | -0.8315 (-11.9054) | -0.5845 | -0.8669 | -0.0609 (-3.4362) | 1 | INCONCLUSIVE |

Per market, entry / exit unresolved and the exit mix are in `result.json`. These years were read by `grid7-wide-fade`:
this measures execution, not a new edge; a PASS is no reason to trade by itself.

## Read this before the numbers (24 Nov 2026)

The verdict is INCONCLUSIVE by the pre-registered rule: 28 % of the R-atr2 orders (621 of 2,226 with a resolved entry) and a
similar share of R-swing orders could not be resolved: the stop and target windows overlapped (429) or the query windows stopped
before the exit (184). **The resolved orders are not a fair sample.** On mid candles the whole sample makes +0.028R (gold) and
-0.029R (USD/JPY) a trade for R-atr2 and +0.068R / +0.002R for R-swing; the resolved part makes -0.18R and -0.58R. So the
unresolved orders are mostly winners (fast moves where the target came close to the stop's time window), and the tick means
above are far too low. The one paired figure that does not depend on which orders are kept: **ticks cost about 0.02R (R-atr2,
month t -2.8) and 0.06R (R-swing, t -3.4) a trade more than mid, before commission**: real fills take part of a tilt that was
about zero on these two markets to begin with. A second query pass for the unresolved orders (narrower windows around each
crossing) would settle the level; it is not run, because even a perfect fill leaves these two markets at about zero on mid.
