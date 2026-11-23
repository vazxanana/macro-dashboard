# Today's best near-miss grid cells on data their grids never read (result)

**Verdict: FAIL. 0 of 4 cells pass; on 2005-09 plus the holdout markets 2010-19, before costs: S6 -0.011R (n 821, t -0.28), MC -0.011R (n 367, t -0.19), SD -0.031R (n 4399, t -1.19), CB -0.006R (n 9049, t -0.51).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first, commit 18f8ee8). Research only:
nothing live changed, nothing is proposed. Template: `research/edge/msnr-box-holdout` (FAIL).

## What was run

Each grid's best near-miss cell, exactly as its grid defined it (the grid's own signal and trade functions imported, its
per-signal step for that cell copied, nothing of any grid edited), on OANDA mid 5-minute candles of the edgekit cache, the
data-quality exclusions, `combo-grid-2` costs:

- **S6** `grid6-session-range`: previous New York afternoon range, sweep in New York traded back, Daily key level touched
  today, MSNR call with, H1 box out against, market entry, event-extreme stop, trail.
- **MC** `grid5-mosha-cycle`: H4 > H1, CF on the VR's timeframe and clear of the VR, market at the CF close, 2R.
- **SD** `grid5-sd-eg`: H4 zone > M15 EF in a pullback, market entry, zone stop, trail (the grid's best was EUR/USD alone;
  tested pooled).
- **CB** `grid5-cycle-box`: H1 > M15, stage move, a false break of a swing box traded back, market entry, ATR stop, 1R.

**Gate passed for all four**: the same code on 2010-2019 gives each grid's figures exactly: S6 n 253 / 265, +0.1571 / +0.2254R;
MC 162 / 131, +0.2189 / +0.1971R; SD (EUR/USD) 310 / 288, +0.3495 / +0.1781R; CB 3345 / 3234, +0.0594 / +0.0189R.

**Cut test**: each market of each set cut at 2 moments (120 cell-cuts, 44,180 trades compared). One difference: an SD trade
on EUR/JPY filled 25 Dec 2017 whose 5-day time exit falls in the New Year closure, so it had not ended by the 1 Jan 2018 cut;
not look-ahead, but the pre-registered 6-day margin did not cover a holiday closure. Everything else identical.

## The bar (before costs, the pre-registered judgement; after costs beside)

Primary: set A (xau eurusd gbpusd usdjpy audusd, 2005-09) and set B (nzdusd usdcad usdchf eurjpy xag, 2010-19, costs assumed)
together, month sums over 180 months; Holm over the four primary tests (every adjusted p = 1).

| Cell | A+B: n, R a trade (month t) | won | after costs | grid's placebo | A alone | B alone | C: 2020-Oct 2026 |
|---|---|---:|---|---|---|---|---|
| S6 | 821, -0.011 (-0.28) | 50 % | -0.080 (-2.08) | +0.022 (0.50) | -0.084 (-1.30) | +0.025 (0.54) | -0.066 (-1.26), n 372 |
| MC | 367, -0.011 (-0.19) | 41 % | -0.038 (-0.62) | +0.091 (1.34) | -0.008 (-0.07) | -0.013 (-0.19) | +0.067 (0.71), n 202 |
| SD | 4399, -0.031 (-1.19) | 48 % | -0.062 (-2.35) | -0.039 (-0.71) | -0.029 (-0.55) | -0.033 (-1.09) | -0.045 (-1.09), n 1909 |
| CB | 9049, -0.006 (-0.51) | 50 % | -0.118 (-10.03) | +0.003 (0.23) | +0.005 (0.21) | -0.011 (-0.90) | +0.018 (1.22), n 4528 |

No set alone clears the plain bar (n >= 50, mean > 0, month t >= 2) for any cell. The placebo is each grid's own: S6, MC and
CB flip the side of the same trades; SD's `flip` trades the zone the other way through the same steps, so it gives fewer trades
(642 on A+B).

**SD on EUR/USD alone** (reported, not the test): 2005-09 +0.169R (n 292, t 1.40); 2020-Oct 2026 +0.021R (n 383, t 0.21).

## By market (before costs, R a trade (month t))

| Cell | Set A | Set B | Set C |
|---|---|---|---|
| S6 | xau -0.209 (-1.21), eurusd -0.035, gbpusd -0.030, usdjpy -0.093, audusd -0.104 | nzdusd +0.017, usdcad +0.077 (0.80), usdchf +0.013, eurjpy -0.004, xag -0.007 | audusd +0.017, the rest -0.06 to -0.11 |
| MC | 17-31 trades a market, -0.247 to +0.205, no t over 0.9 | eurjpy +0.271 (1.45), xag -0.324 (-2.08) | eurusd +0.259 (1.46), audusd -0.144 |
| SD | eurusd +0.169 (1.40), usdjpy -0.159 (-1.88), audusd -0.150 | nzdusd -0.119 (-1.74), the rest -0.07 to +0.02 | usdjpy -0.185 (-2.08), the rest -0.06 to +0.02 |
| CB | -0.028 to +0.033, no t over 0.9 | usdcad -0.067 (-2.60), eurjpy +0.048 (1.69) | xau +0.084 (2.39), the rest -0.03 to +0.03 |

Four market rows of 60 clear |t| 2 (three of them negative; chance gives about three), a different market each time.

## What it says

Each of the four was the luckiest cell of a grid of thousands. On five years before the grids' window, on five markets the
grids never read, and on the years after, every one sits at zero before costs and loses after them; the side-flipped placebo
does as well or better. Do not test variants of these cells on these years. None of them is an edge; nothing changes on any
desk.

Files: `run.mjs`, `result.json`; test `tests/nearmiss-holdout.test.mjs`. To repeat: fill the cache
(`research/edge/_lib/fetch-cache.mjs <m> 5m <from> <to>`: the five markets 2004-2026, the holdout markets 2009-2019), then
`run.mjs market <gate|A|B|C> <m> <dir>` and `run.mjs cut <A|B|C> <m> <dir>` per market, then `run.mjs report <dir>` (about a
minute a market-set).
