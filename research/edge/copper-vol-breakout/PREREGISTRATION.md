# Pre-registration: gold's T1 breakout on copper (24 Nov 2026)

Written and pushed alone, before any copper candle is fetched for this study or any trade computed. The test runs once; nothing
below changes after a result is seen. Paper research only: nothing live changes. Not part of the ICT edge.

## Why
T1 (UTC open ± 0.5 × the previous folded day's range, stop at the open, out at 21:00 UTC) passed on gold and USD/JPY and failed
on silver, platinum / palladium, the energies, NAS100 / SPX500, the forex majors and the yen crosses. Copper was never tested
with it (no `research/edge/*breakout*` study names `xcu`; `copper-gold` and `copper-ny-range-share` asked other questions).
Question: does T1 hold on copper?

## Data
- **Copper (`xcu`, XCU/USD)**, OANDA mid M5 through the keyless candle proxy, from 2005-01-01 (or the first candle OANDA serves)
  to the fetch time; cache kept out of git. Days, weekend folding and skips: the pinned original's `buildDays` / `daySkip`
  (fewer than 200 M5 candles before 21:00 UTC, or no candle in 00:00-00:55 UTC, skips the day: copper's thin early years will
  lose days, and the count is reported); the last calendar day on file is dropped.
- Windows: **discovery = first day on file to 2015-12-31; confirmation = 2016-01-01 → now.**

## Rule and cost
- `vbTrade` of the pinned `research/edge/index-vol-breakout/original.mjs` (sha256 afa36e03…276f, checked at run time), k 0.5,
  both sides, imported unchanged.
- Cost: the demo broker's symbols file (council-data `ctrader/symbols.json`, read 24 Nov 2026) has **no copper symbol**, so the
  cost is **ASSUMED: 0.06 % of the entry price a round trip**, and **2x (0.12 %)** is reported and is part of the bar. (The
  repository's other copper figure, `trend-breadth`'s 0.10 % group cost, sits between the two and is reported, not judged.)
  No financing (out before the 22:00 UTC rollover).

## Test (one) and pass bar
**T1 on copper.** PASS only if ALL hold:
1. net R a trade > 0 in discovery AND in confirmation;
2. month-sum t of net R in confirmation ≥ 2 (one test: Holm over one test is the test itself);
3. net R a trade > 0 in confirmation at 2x cost;
4. confirmation's mean net R beats at least 38 of 40 placebo seed means (the original's placebo construction as in
   `fx-vol-breakout` / `energy-vol-breakout`: a random side and a random 5-minute start between 01:00 and 18:00 UTC each
   tradable day, stop the same distance as the rule's, out at 21:00; seeds 1-40);
5. confirmation n ≥ 200.

Descriptive only, never part of the verdict: early fills (fill candle starting before 06:00 UTC) against late fills, per window
(n, net R, month t); by-year net R; buys / sells; the 0.10 % cost line.

A PASS makes the breakout a candidate on copper for a forward paper record only; a FAIL adds copper to the markets where it does
not hold. Nothing live changes either way.
