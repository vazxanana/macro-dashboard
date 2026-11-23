# Fading lower-timeframe breaks, on data the three grids never read (result)

**Verdict: PASS. Fading an M5 box close-out (F1) holds before costs on both holdout sets: +0.057R a trade on A (n 29,000, month t 6.19), +0.056R on B (n 55,510, t 9.79); it loses after costs.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first, commit d2b6eb6). Research only:
nothing live changed, nothing was placed. A PASS here is a before-cost tilt, not an edge: F1 costs more than it makes.

## What was run

Four faded rules, fixed before any holdout run (exact cells in `PREREGISTRATION.md`, `run.mjs` `CELLS`, selection list in
`picks.json`): F1 the best grid6-box-in-box placebo cell, F2 the best grid6-dom-confirm placebo cell, F3 the best
grid6-mosha-market placebo cell (each the pooled placebo cell that passed both halves of 2010-2019 with the highest 2015-19
month t), F4 a plain rule written out in full (fade the first M5 structure break inside a standing H1 box, market at the next
5-minute open, stop past the break candle's extreme + 0.1 M5 ATR, 1R). OANDA mid 5-minute candles (edgekit cache): set A =
xau, eurusd, gbpusd, usdjpy, audusd 2005-2009; set B = nzdusd, usdcad, usdchf, eurjpy, xag 2010-2019 (costs ASSUMED, not
measured); set C = the five markets of A, 2020 to October 2026. Costs: combo-grid-2 `COSTS`. Data-quality exclusions dropped.

**Gate** (2010-2019, the grids' five markets, before costs, 2010-14 / 2015-19): F1 equals the grid's published placebo cell
exactly (n 30,878 / 29,572, +0.0453R / +0.0528R, month t 5.99 / 6.30). F3 equals the grid's own code (n 3,168 / 3,061,
+0.100R / +0.079R, t 4.30 / 4.01); that rerun also equals all 96 of the grid's published placebo baseline rows. F2 equals the
grid's own code rerun on this cache (n 3,821 / 3,870, +0.0949R / +0.075R, t 4.10 / 4.13); against the grid's PUBLISHED figures
2010-14 is identical and 2015-19 differs by 5 trades (n 3,865, +0.076R, t 4.15). No code changed between the two runs, so the
difference is in the candle cache the grid read on another machine; a check that late-2019 trades whose exits need January
2020 candles explain it was stopped at its time limit, so the cause is NOT traced. The same cell is the best in both lists, so
the pick does not depend on it.

**Cut test**: 72 checks (each rule, 3 cuts, 2 markets of each set): the signals known a day before a cut are the same when
the candles stop at the cut, 0 missing, 0 extra. Every trade has its stop on the losing side (the code stops otherwise).

## The bar (before costs, month-sum t, Holm over the 8 primary tests)

| Rule | Set | n (faded) | R a trade | month t | After costs (t) | n (un-faded) | Un-faded R (t) |
|---|---|---:|---:|---:|---:|---:|---:|
| F1 | A | 29,000 | +0.0573 | 6.19 | -0.0128 (-1.38) | 28,992 | -0.0523 (-5.66) |
| F1 | B | 55,510 | +0.0559 | 9.79 | -0.0509 (-8.33) | 55,499 | -0.0617 (-10.97) |
| F1 | C | 41,799 | +0.0488 | 6.38 | -0.0362 (-4.72) | 41,786 | -0.0533 (-6.90) |
| F2 | A | 3,589 | -0.0114 | -0.54 | -0.0938 (-4.38) | 3,602 | +0.0148 (0.67) |
| F2 | B | 6,944 | +0.0480 | 3.09 | -0.0682 (-4.37) | 7,012 | -0.0622 (-4.38) |
| F2 | C | 5,501 | +0.0339 | 1.65 | -0.0655 (-3.25) | 5,504 | -0.0004 (-0.02) |
| F3 | A | 3,016 | +0.0381 | 1.58 | +0.0025 (0.10) | 3,016 | +0.0012 (0.05) |
| F3 | B | 6,367 | +0.0638 | 4.19 | -0.0330 (-2.08) | 6,367 | -0.0244 (-1.61) |
| F3 | C | 4,272 | +0.0117 | 0.57 | -0.0270 (-1.31) | 4,272 | +0.0109 (0.55) |
| F4 | A | 3,754 | -0.1375 | -7.48 | -0.4081 (-18.11) | 7,016 | -0.0151 (-1.10) |
| F4 | B | 3,871 | -0.0512 | -3.41 | -0.3582 (-17.25) | 11,640 | -0.0698 (-7.94) |
| F4 | C | 3,311 | -0.1012 | -5.39 | -0.4044 (-16.84) | 9,369 | -0.0222 (-2.06) |

Holm-adjusted one-sided p of the primary tests: F1 A 2.2e-7, F1 B 2.4e-16 (both pass); F2 B 0.006 and F3 B 0.0002 pass
on set B only (A: t -0.54 and 1.58); F4 fails both. So F1 passes, F2 and F3 hold on B but not on A, F4 loses. By the
pre-registered rule the verdict is PASS (at least one rule passes on A and B). On set C, F1 repeats the bar (t 6.38); F2, F3
and F4 do not.

## F1 year by year (faded, before / after costs, R a trade)

- Set A: 2005 +0.073 / +0.012, 2006 +0.088 / +0.001, 2007 +0.046 / -0.043, 2008 +0.045 / -0.012, 2009 +0.043 / -0.016.
- Set B: every year 2010-2019 +0.017 to +0.071 before costs, -0.029 to -0.074 after.
- Set C: every year 2020-2026 +0.031 to +0.059 before costs, -0.020 to -0.055 after.

Positive before costs in all 22 years, negative after costs in 20 of them. The round trip averages 0.07R (A), 0.11R (B,
assumed costs) and 0.09R (C) a trade on F1's small M5 stops, larger than the tilt. Per market (`result.json`) the tilt is
there on every market of every set, strongest on eurusd and gbpusd (set A +0.105R and +0.092R, the only rows positive after
costs) and weakest on gold and audusd (set A), silver (set B) and usdjpy (set C).

## What it means

The placebo pattern of the three grids is one real, small effect, and only in one form: after an M5 box (swing low to swing
high, 2 candles a side) closes out, price tends to come back a little, so a market fade at the next 5-minute open with the
stop past the box and a 1R target wins about 53 % of the time. It held on markets and years the grids never read, outside
London and New York hours. Its real side loses by about as much (-0.05R), so it is a short bounce, not a direction call.
It is smaller than the cost of trading it on every set, so it is not a tradable rule as written; with costs it loses. The
other forms do not generalise: fading the dominant-zone M5 break (F2) and the Mosha CF (F3) held on set B but not on set A,
and the plain "fade the first M5 break inside an H1 box" (F4) loses before costs everywhere: fading breaks in general is not
the effect. Never call F1 an edge: n and t are above, and after costs it loses (A -0.013R, t -1.38; B -0.051R, t -8.33;
C -0.036R, t -4.72). Nothing changes on any desk.

## Disclosure

Before the pre-registration was written, a smoke test ran F1 and F4 once on usdjpy 2005-2009 (part of set A) and printed
their figures (F1 faded +0.037R, t 2.08; F4 faded -0.134R). The rules could not change from it (F1 follows the selection rule
on 2010-2019; F4 was written out in the task), and it is stated in the pre-registration too.

Files: `run.mjs` (rules and per-market runs), `report.mjs` (the bar), `pick.mjs` + `picks.json` (the selection), `result.json`
(every figure, per market, gate, cut test); test `tests/fade-breaks-holdout.test.mjs`. To repeat: `EDGE_DATA=<cache> node
--max-old-space-size=4500 run.mjs market <gate|A|B|C> <m> <dir>` for each set's markets, `run.mjs cut <set> <m> <dir>`, then
`node report.mjs <dir>`.
