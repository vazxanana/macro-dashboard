# The grid-5 rule on data the grid never read (result)

**Verdict: FAIL. At the 1R exit before costs the rule made +0.018R a trade on the five markets in 2005-09 (n 261, month t 0.29) and -0.016R on the holdout markets in 2010-19 (n 595, t -0.36); 2020 on +0.009R (n 422, t 0.18).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first, commit 63d5cb9). Research only:
nothing live changed, nothing is proposed.

## What was run

The one rule `research/edge/grid5-msnr-box` confirmed out of 11,625 cells (Daily engulf zone touched, an H1 box of 2 a side
closes out with the zone's side, an H1 structure break of that side within 6 candles, trigger close 12-17 UTC, market entry
at the next 5-minute open, stop past the box's other side), unchanged: the grid's `signals` and `trade` imported, its
per-signal step for this cell copied, nothing of the grid edited. OANDA mid 5-minute candles of the edgekit cache, the
data-quality exclusions, `combo-grid-2` costs.

**Gate passed**: the same code on 2010-2019 gives the grid's figures exactly: 2010-14 n 297, +0.1406R; 2015-19 n 317,
+0.2330R (pooled 2010-19 +0.188R, n 614, month t 4.55). **Cut test**: each market of each set cut at 4 moments; the cell's
signals before every cut are the same as in the full run (60 cuts, 0 missing, 0 extra).

## The bar (before costs, the pre-registered judgement; after costs beside)

| Set | n | 1R exit, R a trade (month t) | won | after costs | trail exit (t) | trail after costs | placebo 1R |
|---|---:|---|---:|---|---|---|---|
| A: xau eurusd gbpusd usdjpy audusd, 2005-09 | 261 | +0.018 (0.29) | 49 % | +0.003 (0.05) | +0.054 (0.76) | +0.038 | -0.019 (-0.30) |
| B: nzdusd usdcad usdchf eurjpy xag, 2010-19 (costs assumed) | 595 | -0.016 (-0.36) | 50 % | -0.054 (-1.20) | -0.004 (-0.09) | -0.042 | +0.011 (0.25) |
| C: the five markets, 2020 to Oct 2026 | 422 | +0.009 (0.18) | 50 % | -0.006 (-0.11) | -0.027 (-0.49) | -0.043 | -0.006 (-0.12) |
| Grid window, 2010-19 (in sample) | 614 | +0.188 (4.55) | 61 % | +0.170 (4.14) | +0.222 (4.41) | +0.204 | -0.190 (-4.59) |

Holm over the two primary tests (A, B): adjusted one-sided p 0.77 for both. Neither set passes; set C does not repeat it.
On the grid's own years the rule won 61 % of 1R trades and its side-flipped placebo lost as much; on every set of new data
it wins about half and the placebo sits at zero, as a rule with no direction in it would.

## By market (1R / trail, before costs)

| Set | Market: n, 1R mean (t), trail mean (t) |
|---|---|
| A | xau 43, +0.044 (0.31), +0.204 (1.01); eurusd 54, -0.080 (-0.65), -0.034; gbpusd 56, +0.256 (2.07), +0.343 (2.21); usdjpy 52, +0.012 (0.11), -0.043; audusd 56, -0.139 (-0.97), -0.176 |
| B | nzdusd 122, -0.076 (-0.80); usdcad 136, +0.057 (0.68); usdchf 121, -0.025 (-0.28); eurjpy 94, +0.033 (0.33); xag 122, -0.068 (-0.70) |
| C | xau 84, -0.061 (-0.69); eurusd 70, -0.049; gbpusd 86, -0.050; usdjpy 88, -0.088; audusd 94, +0.261 (2.23) |

One market a set clears t 2 (gbpusd in A, audusd in C): about what fifteen market rows give by chance, and a different
market each time. With / against the MSNR call: no difference on any set (A -0.002 / +0.051, B -0.034 / +0.007, C +0.003 /
+0.016 at 1R).

## What it says

The grid's one confirmed cell does not hold on five years before the grid's window, on five markets the grid never read, or
on the years after it. It was the lucky cell of 11,625, as the grid's own counts (237 discovery winners against about 265
expected by chance) already hinted. Do not test variants of this cell on these years. Not an edge; nothing changes on any
desk. Set A's 2004 warm-up holds only the last days of 2004 (OANDA's history starts there) and gold starts in March 2006.

Files: `run.mjs`, `result.json`; test `tests/msnr-box-holdout.test.mjs`. To repeat: fetch the cache
(`research/edge/_lib/fetch-cache.mjs <m> 5m <year>`), then `run.mjs market <gate|A|B|C> <m> <dir>`, `run.mjs cut …`,
`run.mjs report <dir>`.
