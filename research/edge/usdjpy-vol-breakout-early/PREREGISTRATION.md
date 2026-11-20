# Pre-registration: gold's T1 breakout on USD/JPY, 2005-2015 (20 Nov 2026)

Written and pushed alone, before any USD/JPY candle before 2016 is fetched or any trade of this window is computed. The test runs
once; nothing below is changed after a result is seen. Paper research only: nothing live changes. Not part of the ICT edge.

## Why
`fx-vol-breakout` (20 Nov 2026) ran T1 on six forex majors 2016-26: the pool FAILED (−0.022R a trade net, n 12,664, month t
−1.59), but USD/JPY alone passed every check (+0.063R net, n 2,079, month t 2.50, Holm p 0.043, 40 of 40 placebos). Its
pre-registration says a single market passing is a hypothesis for its own test on data not used there. This is that test:
the same rule, the same cost, on USD/JPY years that study never read.

## Data
- OANDA mid M5 `usdjpy` through the keyless candle proxy (`MD_BASE=https://aureumdesk.co.uk/md/`), 2004-12-01 00:00 UTC to
  2016-01-08 00:00 UTC, cache kept out of git. The window judged: **2005-01-04 to 2015-12-31** (UTC weekdays). If OANDA serves
  no M5 candles for part of it, the window starts at the first complete month with candles; that start is reported, and fewer
  than 1,000 trades in the window = "too few to judge" (no verdict either way).

## Rule and cost (both unchanged from fx-vol-breakout)
- T1 through `research/edge/fx-vol-breakout/run.mjs` `trades` (which imports the pinned `index-vol-breakout/original.mjs`,
  sha256 afa36e03…276f): buy / sell stop at the UTC open ± 0.5 × the previous folded day's range, stop at the open, out at
  21:00 UTC. Cost `costPx('usdjpy', entry)` = 0.000045 × entry + 0.005 a round trip; 2x reported.

## Pass bar (one test, no Holm)
PASS only when ALL hold on 2005-2015:
1. net R a trade > 0 in 2005-2010 AND in 2011-2015;
2. month-sum t of net R ≥ 2;
3. net R a trade > 0 at 2x cost;
4. the mean net R beats at least 38 of 40 placebo seed means (`fx-vol-breakout` `placeboTrades`, seeds 1-40).

A PASS makes USD/JPY T1 a candidate for a forward paper record (its own pre-registration), never a live rule without the owner.
A FAIL ends the USD/JPY lead: the 2016-26 pass was one of six markets clearing a bar. Nothing live changes either way.
