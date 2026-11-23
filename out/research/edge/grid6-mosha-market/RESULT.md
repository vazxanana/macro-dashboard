# Grid 6: the Mosha storyline BO, VR, CF with market and trade-through entries only (result)

**Verdict: PASS. One fragile cell of 69,120 (gold M30>M5, market at the CF close, 1R, London, with the Daily MSNR call) made +0.225R a trade before costs in 2015-19 (n 290, month t 4.25, Holm p 0.027), +0.064R after costs (t 1.27).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md` and its amendment, each committed and pushed alone before the run).
OANDA mid 5-minute candles of xau, eurusd, gbpusd, usdjpy, audusd, 2009 (warm-up) to 2019; discovery 2010-2014,
confirmation 2015-2019. Breaks from edgekit `structure(bars, 3)` (any) and `qms(bars, 3)` (QM), the Daily MSNR call from
`council/eg-methods.mjs` `direction()`, the trade manager of grid 5 (all imported, never edited). Market entries fill at the
next 5-minute open; limits only when traded through by half the round-trip cost. Research only: nothing live changed,
nothing was placed.

## What was run

47,686 storylines and 188,060 trades: xau 36,646, eurusd 37,351, gbpusd 37,110, usdjpy 38,798, audusd 38,155; 184 dropped
on the data-quality list; 28,890 entries not built because the stop would not be on the losing side, 47 limits that opened
past their stop (not built). Cells: 4 ladders x 2 break types x 4 CF places x 3 entries x 2 stops x 5 exits x 4 sessions x
3 MSNR = 11,520, per market and pooled (69,120).

Cut test: 30 random cuts a market (2011-2012), 132,309 storylines known by a cut compared with the ones computed on candles
cut there (side, CF time, levels, place, MSNR call): 0 mismatches.

## The bar (before costs, month t over 60 fixed months)

| | Cells with n >= 100 in 2010-14 | Discovery winners | Expected by chance (2.3 %) | Confirmed 2015-19 (Holm) | Confirmation t >= 2 without Holm |
|---|---:|---:|---:|---:|---:|
| Storyline | 16,045 | 354 | 369.0 | 1 | 23 |
| Placebo (the other side, same fill, levels mirrored) | 16,045 | 1,155 | 369.0 | 0 | 159 |

By the pre-registered rule this is a PASS (one cell confirmed, the placebo none). Read it with the rest of the table: the
grid found FEWER discovery winners than chance gives, the placebo found three times as many, and one cell of 69,120 passing
Holm on a nested, correlated grid is the size of result chance can make.

The passing cell and its neighbours (gold, M30>M5, any break, any CF place, market at the CF close, stop past the CF zone):

| Exit, session, MSNR | 2010-14 | 2015-19 | 2015-19 after costs | Holm p |
|---|---|---|---|---|
| 1R, London, with (passes) | +0.114R (n 302, t 2.16), +0.005R after costs | +0.225R (n 290, t 4.25) | +0.064R (t 1.27) | 0.027 |
| trail, London, with | +0.150R (n 302, t 2.11) | +0.301R (n 290, t 3.32) | +0.140R (t 1.57) | 0.54 |
| 2R, any session, with | +0.088R (n 1,403, t 2.03) | +0.129R (n 1,358, t 3.11) | -0.027R (t -0.66) | 1 |

Year by year, the passing cell's R before / after costs: 2010 +11.0 / +3.4, 2011 +7.0 / +1.3, 2012 +4.4 / -1.5, 2013 +8.0 /
+2.7, 2014 +4.0 / -4.5, 2015 +23.0 / +13.9, 2016 +17.0 / +9.0, 2017 +20.0 / +10.3, 2018 +3.0 / -7.1, 2019 +2.2 / -7.6.
Positive before costs in all ten years; after costs four years lose, and 2015-17 carry the confirmation. The same cell with
the MSNR call against, or in New York, or in any session, is flat to negative after costs.

## The plain storyline (place, session and MSNR = any), pooled, 2R

| Ladder, break, entry, stop | 2010-14 | 2015-19 | 2015-19 after costs |
|---|---|---|---|
| D1>H4, any, MKT, cfz | -0.001R (n 296, t -0.02) | +0.008R (n 282, t 0.12) | -0.001R |
| H4>H1, any, MKT, cfz | +0.075R (n 1,133, t 1.57) | -0.003R (n 1,136, t -0.07) | -0.024R |
| H1>M15, any, MKT, cfz | -0.010R (n 4,747, t -0.48) | -0.047R (n 4,570, t -2.34) | -0.096R |
| M30>M5, any, MKT, cfz | -0.002R (n 13,472, t -0.15) | +0.002R (n 12,821, t 0.12) | -0.083R |
| M30>M5, any, LIM, vr | -0.137R (n 7,790, t -8.38) | -0.121R (n 7,485, t -5.38) | -0.630R |

The storyline itself sits at zero before costs on every ladder; the stop past the VR leg is tighter and loses to costs badly;
the QM breaks are too rare on D1>H4 and H4>H1 (n 12-129) to judge.

## What it means

The storyline with clean entries is not an edge: pooled and per ladder it is about zero before costs and negative after.
One narrow slice passes the pre-registered bar (gold, M30>M5, a market entry after the CF, 1R, London fills, trading with the
Daily MSNR call), positive in every year before costs, but its after-cost result is +0.064R a trade with t 1.27, the grid as a
whole found fewer winners than chance, and the slice was picked from 69,120 cells. It is a hypothesis for a forward or holdout
record of its own (another market set or 2005-2009, pre-registered), never an edge. Nothing live changed.

Figures: `result.json` (`real`, `placebo`, `confirmed`, `passingCellByYear`, `topConfirmation`, `baseline`, `perMarket`,
`cutTest`). To repeat: `EDGE_DATA=<cache> node research/edge/grid6-mosha-market/run.mjs market <m> <dir>` for the five markets
(about 80 s each), then `report <dir>`, and `cut <m> 30` for the cut test.
