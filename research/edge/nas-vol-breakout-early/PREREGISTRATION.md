# Pre-registration: nas-vol-breakout-early (20 Nov 2026)

Paper research only. Nothing live changes; ICT and the live gold book are not involved (owner decision 44 is untouched: no book
trade, gate, exit or size is read). Written and pushed alone, before any candle of the test window is fetched for this study and
before any trade of it is computed.

## Why

`index-vol-breakout-hourcost` charged gold's daily volatility breakout T1 (unchanged) on NAS100 the demo broker's measured hourly
spreads: 2016 → 2026-11 +0.043R a trade net (n 2,040, month t 2.01, Holm 0.044), failing only the placebo (35 of 40 random-entry
seeds beaten, 38 needed). The years before 2016 were never read by any study of this rule on an index. The honest next step is the
same rule, the same cost, on those untouched years.

## Data (fixed)

- OANDA mid NAS100 (`NAS100_USD`) M5 candles through the site's candle proxy (`/md/bars?sym=nas100&tf=5m`), 2009-12-01 → 2016-01-08,
  complete candles only (the cache stays out of git).
- Quality seen before writing this (a 5-day sample per year; no trade computed): flat candles (high = low) about 9 % of M5 in 2008-10,
  2 % in 2012, under 1 % from 2014. So the test window starts in 2010 and 2012-15 is reported beside it.

## Rule and harness (unchanged, imported)

- Days, T1 and the placebo: `research/edge/index-vol-breakout/original.mjs` (`buildDays`, `daySkip`, `vbTrade`, `placeboTrade`,
  sha256 afa36e03…) and `run.mjs` (`T1`, `SEEDS` 40, `PLACEBO`), as the 2016-26 study ran them; the day filter is that study's
  `tradeDays` with this window instead of 2016 → end.
- Cost: route C1 of `index-vol-breakout-hourcost` (its `hourCost`, `medRange`, `charge`): half the entry hour's and half the
  20:00 UTC hour's measured relative spread, the commission, plus 0.05 × the median M5 range at the fill; the NAS100 hour profile and
  commission frozen from that study's `result.json` (`profile.nas100`). Today's relative spread is charged for every year (stated).

## Test and pass bar (one test)

Window: trading days 2010-01-01 → 2015-12-31; halves 2010-2012 and 2013-2015.
PASS only if all hold:
1. net R a trade > 0 over the window, and > 0 in each half;
2. t of calendar-month sums of net R >= 2 over the window;
3. net R a trade at twice the cost > 0;
4. the real net R a trade beats at least 38 of the 40 placebo seeds (same construction and seeds as the original);
5. n >= 30 in each half.
Otherwise FAIL. 2012-2015 is reported, not tested.

## Limits said in advance

- OANDA's early index CFD candles are thinner (flat candles, small tick counts): a breakout level crossed on a thin print is
  filled at that print. A fail here may partly reflect the data, a pass is still one more in-sample-era test of a rule found on
  gold, not proof.
- Whatever the result, nothing live changes (absolute rule 3); a pass becomes a note beside the 14 Nov proposal, a fail is written
  up as such.
