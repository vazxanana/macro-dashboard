# Grid 6: a Weekly key level, the H4 box and the Daily MSNR call (result)

**Verdict: FAIL. 0 of 880 cells confirmed before costs after Holm (placebo 0); the best discovery cell made +0.066R a trade in 2015-19, n 143, month t 0.73; the grid sits at chance.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first, commit b255a1e). Research only:
nothing live changed, nothing is proposed.

## What was run

OANDA mid 5-minute candles 2009-2019 (2009 warm-up; fills 2010-2019) and UTC daily candles 2007-2019 (for the Weekly
candles only: weeks start Monday 00:00 UTC, Saturday and Sunday join the next week, a week is known only at its fixed
Saturday 00:00 end) for xau, eurusd, gbpusd, usdjpy, audusd; the data-quality exclusions applied (38 fills dropped); costs of
combo-grid-2. Factors: the Daily MSNR call with Weekly key levels (`council/eg-methods.mjs` `direction()`, imported) with /
against / any; the Weekly key level touched (V / A turn, engulf zone, EF, DOM, fresh supply / demand); the H4 box (close out
with the side, or a false break back in); the trigger (the box event, an H4 engulf, an H1 engulf, an H1 structure break);
entry (market at the next 5-minute open, or a limit at the box edge that fills only when price trades through it by half the
round trip) x stop (box, or past the Weekly level + 0.1 Weekly ATR); exit 1R, 2R, 3R, trail, the next opposite Weekly key
level; out after 5 days. 11,378 signals, 40,708 trades and 40,667 side-flipped placebo trades (one per entry / stop, five exits
each). Every trade has its stop on the losing side.

Cut test: each market cut at five moments (2011-2019); the signals before every cut are the same as in the full run (0
missing, 0 extra in all 25 cuts). The unit test also changes every candle after a cut on a seeded market.

The call was never 0 after the warm-up, so `any` = `with` + `against`.

## The bar (before costs, the pre-registered judgement; after costs beside)

| | Real, before costs | Placebo, before costs | Real, after costs | Placebo, after costs |
|---|---:|---:|---:|---:|
| Cells with n >= 100 in 2010-14 | 880 | 865 | 880 | 865 |
| Discovery winners (mean > 0, month t >= 2) | 24 | 56 | 17 | 45 |
| Expected by chance (2.3 %) | about 20 | about 20 | about 20 | about 20 |
| Confirmed in 2015-19 without Holm (n >= 100) | 0 | 0 | 0 | 0 |
| Expected by chance (2.3 % of the winners) | about 0.5 | about 1.3 | about 0.4 | about 1.0 |
| Confirmed after Holm | **0** | **0** | **0** | **0** |

Of the 2,400 cells per scope only 880 reached 100 trades in 2010-14 (a Weekly level is touched rarely): most are the pooled
`any` cells. The real grid found about the number of discovery winners chance gives (24 against 20); the side-flipped placebo
found more (56), and none of either held in 2015-19.

## The best discovery cells (pooled, before costs)

| Cell | 2010-14 | 2015-19 |
|---|---|---|
| any call, V / A turn, H4 false break, H1 engulf, market / box stop, 1R | +0.294R, n 125, t 3.04 | +0.066R, n 143, t 0.73 |
| any call, V / A turn, H4 false break, H4 engulf, market / box stop, 1R | +0.324R, n 126, t 2.90 | -0.076R, n 150, t -0.87 |
| any call, V / A turn, H4 false break, box event, limit / key stop, trail | +0.451R, n 124, t 2.79 | +0.069R, n 143, t 0.48 |

## Factor levels, pooled (exit 2R, every cell once, real trades)

| Level | 2010-14 | 2015-19 before costs | 2015-19 after costs |
|---|---|---|---|
| Call with the trade | +0.047R (n 10,896) | -0.091R (n 9,647) | -0.105R |
| Call against the trade | -0.011R (n 10,368) | +0.046R (n 9,797) | +0.030R |
| V / A turn | +0.137R | +0.030R | +0.012R |
| H4 false break | +0.119R | -0.017R | -0.039R |
| Box close-out | -0.042R | -0.026R | -0.035R |

The Daily call's sign flips between the halves (with it was better in 2010-14, worse in 2015-19), and the only level that
stayed above zero in both halves (the Weekly V / A turn, +0.03R before costs in 2015-19) is about zero after costs. Nothing
here is an edge; no cell, factor or variant is to be re-tested on these years.
