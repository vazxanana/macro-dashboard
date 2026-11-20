# Pre-registration: gold's T1 breakout on oil and gas (20 Nov 2026)

Written and pushed alone, before any candle of these markets is fetched for this study or any trade computed. The test runs once;
nothing below changes after a result is seen. Paper research only: nothing live changes. Not part of the ICT edge.

## Why
T1 (UTC open ± 0.5 × the previous folded day's range, stop at the open, out at 21:00 UTC) passed on gold (and at the broker's
ticks), on USD/JPY (two windows and the broker's ticks), and failed on silver, platinum / palladium, NAS100 / SPX500, six forex
majors pooled and the yen crosses pooled. Energies were never tested with it (no `research/edge/*breakout*` pre-registration
names wtico, bco or natgas). Question: does the rule hold on the energy CFDs?

## Data
- Markets, fixed now: **WTI crude (`wtico`), Brent crude (`bco`), natural gas (`natgas`)**, OANDA mid M5 through the keyless
  candle proxy, 2015-12-01 to the fetch time (cache out of git). Days, folding and skips: the pinned original's `buildDays` /
  `daySkip` (fewer than 200 M5 candles before 21:00 UTC, or no candle in 00:00-00:55, skips the day; the energy CFDs' daily halt
  sits at 21:00-23:00 UTC, after the rule's exit); the last calendar day on file is dropped.
- Windows: **2016-2020** and **2021 → now**.

## Rule and cost
- `vbTrade` of the pinned `index-vol-breakout/original.mjs` (sha256 afa36e03…276f), k 0.5, both sides.
- Cost: **0.1 % of the entry price a round trip** (`research/edge/trend-breadth` `COST.mid`, the repository's energy figure);
  2x reported. No financing (out before the rollover). The demo broker's energy spreads are not measured: the 2x line is the check.

## Tests and pass bar
- **Primary: the pool** of the three markets, 2016 → now. PASS only if ALL hold: net R a trade > 0 in 2016-2020 AND in 2021 →
  now; month-sum t of net R (2016 → now) ≥ 2; net R > 0 at 2x cost; the pool's mean net R beats at least 38 of 40 placebo seed
  means (the original's placebo construction, seeds 1-40, mean over the three markets' placebo trades).
- Per market: the same four checks, Holm over the three (one-sided p of the month t): descriptive, never a pass of the question
  on their own.
A pool PASS makes the breakout a candidate on energies (a forward record only); a FAIL adds them to the markets where it does not
hold. Nothing live changes either way.
