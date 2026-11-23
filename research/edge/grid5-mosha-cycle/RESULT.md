# Grid 5: the Mosha storyline BO, VR, CF with the market cycle, a barrier and the CF's place (result)

**Verdict: FAIL. 0 of 58,320 cells confirmed (27 discovery winners against about 93 expected by chance; the placebo had 453), and the best cell, pooled H4>H1 CF clear of the VR at market with 2R, made +0.197R a trade before costs in 2015-19 (n 131, month t 1.93, Holm p 1).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). OANDA mid 5-minute candles of
xau, eurusd, gbpusd, usdjpy, audusd, 2009 (warm-up) to 2019; discovery 2010-2014, confirmation 2015-2019; the page's own
structure engine (`msAnalyze`, `msZones`, read through `council/mosha-desk.mjs` `loadFns`, never edited). Limits fill only when
price trades through them by half the round-trip cost. Research only: nothing live changed, nothing was placed.

## What was run

8,505 storylines (BO of the timeframe above, VR = the first BO Structure against it, CF = the next BO Structure with it) and
25,633 trades: xau 4,357, eurusd 5,286, gbpusd 4,866, usdjpy 4,827, audusd 6,297; 32 dropped on the data-quality list; no
trade without its stop on the losing side. Cells: 3 chains x 2 CF timeframes x 3 cycle stages x 3 barrier x 3 back to the BO
level x 3 CF place against the VR x 4 entry / stop x 5 exits = 9,720, per market and pooled (58,320).

Cut test: 30 random cuts a market (2011-2012), 26,026 storylines known by a cut compared with the ones computed on candles cut
there (side, CF time, levels, stage, barrier, back, CF place): 0 mismatches.

## The bar (before costs, month t over 60 fixed months)

| | Cells with n >= 100 in 2010-14 | Discovery winners | Expected by chance (2.3 %) | Confirmed 2015-19 (Holm) | Confirmation t >= 2 without Holm |
|---|---:|---:|---:|---:|---:|
| Storyline | 4,030 | 27 | 92.7 | 0 | 0 |
| Placebo (the other side, same fill, levels mirrored) | 4,030 | 453 | 92.7 | 0 | 45 |

Fewer storyline cells passed discovery than chance gives, and none held in 2015-19. The side-flipped placebo did better than
the storyline: on H1>M15 the storyline loses before costs.

The five confirmation-period leaders (all pooled; none passes):

| Cell | 2010-14 | 2015-19 | 2015-19 after costs |
|---|---|---|---|
| H4>H1, CF on H1, CF clear of the VR, market at the CF close, 2R | +0.219R (n 162, t 2.60) | +0.197R (n 131, t 1.93) | +0.181R (t 1.78) |
| the same, trail | +0.183R (n 162, t 2.16) | +0.150R (n 131, t 1.86) | +0.134R |
| the same, back to the BO level, 2R | +0.202R (n 144, t 2.31) | +0.156R (n 114, t 1.54) | +0.141R |
| H4>H1, CF on H1, H4 in pullback, limit at the CF line, trail | +0.245R (n 130, t 2.23) | +0.227R (n 95, t 1.37) | +0.207R |
| H4>H1, CF on H1, H4 in pullback, market at the CF close, trail | +0.230R (n 153, t 2.42) | +0.171R (n 125, t 1.34) | +0.154R |

## The plain storyline (every filter "any"), pooled, before costs

| Chain, CF timeframe, entry, exit | 2010-14 | 2015-19 | 2015-19 after costs | Placebo 2015-19 |
|---|---|---|---|---|
| H1>M15, CF on M5, market at the CF close, 2R | -0.092R (n 1,681, t -2.94) | -0.090R (n 1,525, t -2.52) | -0.141R | +0.044R (t 1.33), -0.008R after costs |
| H1>M15, CF on M15, EG after the pullback, stop past the pullback, trail | -0.132R (n 818, t -3.79) | -0.105R (n 777, t -2.42) | -0.197R | +0.094R (t 2.01), +0.002R after costs |
| H4>H1, CF on H1, market at the CF close, 2R | +0.100R (n 387, t 1.59) | +0.064R (n 336, t 1.00) | +0.048R | +0.048R (t 0.66) |
| H4>H1, CF on H1, limit at the CF line, 2R | +0.060R (n 321, t 0.90) | +0.124R (n 277, t 1.61) | +0.106R | -0.002R (t -0.03) |
| D1>H4 (any entry) | n 55-108, every month t between -0.7 and +0.4 | n 43-81, t -2.0 to +1.5 | | |

Every H1>M15 entry of the plain storyline loses before costs in both halves (month t -1.0 to -3.8); trading against it is
positive before costs and about zero after them. H4>H1 with the CF on H1 is positive in both halves but under t 2 in each,
and the conditions did not lift it over the bar after the correction for the cells tried. D1>H4 has too few storylines.

## What it means

The storyline written as these rules, with the method's conditions (the H4 / H1 / D1 stage, a fresh zone under the
pullback, the return to the BO level, the CF clear of or inside the VR), is not an edge on 2010-2019 before costs; on H1>M15
it loses. The one family worth a note, H4>H1 with the CF on its own timeframe, is a hypothesis at most: positive in both
halves, under the bar in each, and it would need its own pre-registration on other data (the holdout years or markets).
Never quote any cell here as an edge. Nothing live changed.

Figures: `result.json` (`real`, `placebo`, `best`, `topConfirmation`, `baseline`, `perMarket`, `cutTest`). To repeat:
`EDGE_DATA=<cache> node research/edge/grid5-mosha-cycle/run.mjs market <m> <dir>` for the five markets, then `report <dir>`
(about a minute in all), and `cut <m> 30` for the cut test.
