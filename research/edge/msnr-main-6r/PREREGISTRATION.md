# The earlier scalp method in its 12-16 UTC window at 1R to 6R, on 2010-2019: pre-registration (23 Nov 2026)

Written and pushed alone, before any trade of this study was simulated. Paper research only: nothing live changes.

## Why

On the MSNR desk's closed 2026 paper records the only reading whose result rose steadily with the target was the earlier scalp
method in its 12-16 UTC window (kind `msnr-main`, n 551, before costs): about +23R at a 1R target rising to about +102R at 6R.
That was found by looking at one year after the fact (and the desk's target was then moved to 6R on it). This study asks the
same question on ten years the 2026 look never read.

What is not new: `research/edge/msnr-entry` (11 Nov 2026) already read gold 2007-2019 with the study's own entry, at a 1.5R
target and a 12-hour time limit (FAIL). New here: the DESK's reading (`council/edge-desks.mjs` `msnrTrades`: entries with the
call only, the two-candle engulf check `eg2` on the 15- and 5-minute pairs, the buffer and smallest stop scaled from the entry
price, full-precision stop and result `msnrSim`), the four other markets, targets 1R to 6R, the desk's 5-day limit, and the
window split.

## Data

OANDA mid 5-minute candles (`research/edge/_lib/edgekit.mjs` cache, `fetch-cache.mjs`), 2009-01-01 to 2020-01-01, for xau,
eurusd, gbpusd, usdjpy, audusd. 2009 is warm-up only (the direction call and the one-position rule run through it; no 2009 entry
is counted). Hourly candles for the call are the 5-minute candles grouped into UTC hours (`edgekit.resample`). Test entries:
2010-01-01 to 2019-12-31 by entry time; discovery half 2010-2014, confirmation half 2015-2019. A trade still open on the last
candle of 2019 is left out. A trade whose life (entry to exit) touches an interval of `research/edge/data-quality/quality.json`
(read through `combo-grid-2/run.mjs` `exclusions`) is left out.

## The reading

`msnrTrades(B, { from: 2010-01-01, market })` imported from `council/edge-desks.mjs` and NEVER edited. For target k (1..6) the
exported `MSNR.rrMain` and `MSNR.rrOther` are both set to k for the run and put back after it (`MSNR.hold` stays the desk's 5
days). So each target is its own stream with its own one-position-at-a-time rule per market. "12-16 UTC" = kind `msnr-main`
(the trigger candle's UTC hour 12 to 15), "other hours" = kind `msnr-other`. The desk's own mix (6R / 3R) is run once and
reported, not tested.

Placebo (side flipped): the same reading with `against: true` (the entries opposite to the call), at 6R.

## Measures

R a trade before costs = the desk's `R`. After costs = R - COSTS[m] / r0, with `COSTS` from `combo-grid-2/run.mjs` (round trip
in price units). **The tests are judged BEFORE costs**; after costs is reported beside each figure. Month-sum t = t of the
calendar-month sums of R by entry month (months inside a half with no trade count as 0), within a half.

## Tests (three, Holm over them)

- **T1**: 6R, 12-16 UTC, pooled over the five markets. Pass in a half: mean R > 0 and month-sum t >= 2.
- **T2**: 6R minus 1R, paired by trade, 12-16 UTC, pooled. Each 6R-stream trade is re-simulated alone at 1R from the same entry,
  stop and time limit (a copy of `msnrSim`, gated: re-simulated at 6R it must equal the desk's R on every trade). Measure = the
  per-trade difference R6 - R1. Pass in a half: mean difference > 0 and month-sum t >= 2.
- **T3** (control): 6R, other hours, pooled. Same bar as T1.

Each test's p = the larger of its two halves' one-sided month-sum p. Holm over the three at 0.05.

**Verdict**: PASS when T1 and T2 pass in both halves after Holm AND T1's mean R is above the placebo's in both halves;
FAIL otherwise (INCONCLUSIVE only if T1 has fewer than 100 trades in either half). T3 passing too would say the 12-16 UTC
window adds nothing; it is reported either way.

## Checks

- A cut test: the reading on gold 2009-2014 cut at 2013-06-30 gives the same trades (entered and closed by the cut) as on the
  uncut file.
- Every trade has a stop on its losing side (asserted).
- Reported per market and per target (1R-6R), both windows, before and after costs, and by half.

Never called an edge without n and t; a pass would still be in-sample years for the owner's desk choice only in the sense that
these years were never read with this reading.
