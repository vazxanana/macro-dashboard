# Pre-registration: gold-vol-breakout-replicate (14 Nov 2026)

Paper research only. One replication test of a stand-alone intraday rule on spot gold. It is **not** a gate, exit, entry or
size of the live gold book (Gold trend + Gold daily engulf): owner decision 44 forbids further tests of that book on its
2006-17 window, and this study reads none of the book's records or positions. Nothing live changes; no proposal follows
from this study alone.

Written and pushed before any 2007-2015 result of the rule was computed.

## Why

`research/edge/gold-vol-breakout` (branch `gold-vol-breakout`, commit 72009ebe, PREREGISTRATION.md sha256
afe4ff2e…6fdb) tested the open ± k × previous-day-range breakout on OANDA gold M5, 2016-2026. It failed narrowly. Its T1
(k 0.5, both sides) made +0.072R a trade net 2021 → 12 Nov 2026 (n 1,121, month t 1.86, Holm p 0.094), +0.009R net
2016-20 (n 935, t 0.22). It was positive before costs in both windows (gross month t 2.87 and 3.21), beat all 40
placebos, and most of the 2021-26 gain came from 2025-26. The one honest next step is the same rule, unchanged, on
history that study never saw: **2007-01-01 to 2015-12-31**.

## The rule (T1, unchanged)

The original `run.mjs` is copied **verbatim** into this folder as `original.mjs` (sha256
afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f, equal to `git show 72009ebe:research/edge/gold-vol-breakout/run.mjs`).
This study's `run.mjs` imports its functions (`buildDays`, `daySkip`, `vbTrade`, `placeboTrade`, `rng`, `monthT`,
`summary`, `quantile`, `TESTS.T1`, `SEEDS`, `PLACEBO`) and changes none of them. Only the windows differ.

- O = open of the first M5 candle from 00:00 UTC (must start before 01:00, else no trade); a day needs 200 candles.
- prevRange = high − low of the previous UTC D1, weekend-folded with `council/fills.mjs` `foldWeekend`.
- Buy stop O + 0.5 × prevRange, sell stop O − 0.5 × prevRange, live on the 00:00-20:55 UTC candles; the first filled wins,
  the other is cancelled (a gap fills at the candle's open; both in one candle: the level nearer its open).
- Stop back at O. A fill candle that also reaches the stop counts as stopped at O. A later candle opening through the stop
  exits at its open.
- Exit at the close of the 20:55 candle (21:00 UTC).
- Costs: $0.60 a round trip per ounce, plus `FIN.xau.long` × `nights` on buys (no trade crosses the 22:00 UTC rollover, so 0).
  2x costs reported.

## Data

`xau-5m.json.gz`: OANDA mid XAU/USD M5, rows `[t, o, h, l, c]`, 2006-11-01 → 2026-11-13, through the keyless candle
proxy, kept out of git. Shape checked before this file was written (1,431,423 rows; 259-262 weekdays a year 2007-2015 with
about 270-276 candles a day). The day of the last candle is dropped as forming, exactly as the original. Two months of
2006 give the first prevRange and the 250-day median warm-up.

## Harness gate (before any 2007-15 figure is read)

1. `original.mjs` functions on the original's own cache (`xau-5m-vol.json.gz`, 2015-12 → 2026-11-13) must give T1's
   2016-20 and 2021 → 2026-11-12 `summary` **exactly** equal to `result.json` of commit 72009ebe (n, netR, grossR, t,
   grossT, net2R).
2. The same functions on this study's cache (`xau-5m.json.gz`), restricted to the same two windows, must agree with the
   original's T1 within: n ± 1 %, netR and grossR ± 0.010R, month t ± 0.15. Differences are reported.

If either fails, the study stops and reports the difference; no 2007-15 figure is computed.

## The test (one test, no Holm)

Window **2007-01-01 → 2015-12-31**. PASS only if **all** hold:

1. Net R a trade > 0.
2. t ≥ 2 on calendar-month sums of net R. One pre-registered test, so no multiple-test correction.
3. Both halves net positive: 2007-01-01 → 2011-12-31 and 2012-01-01 → 2015-12-31.
4. Net R a trade still > 0 at 2x costs.
5. Beats at least 38 of 40 placebo seeds (the real net R a trade above each seed's mean). Placebo exactly as the
   original: on every day T1 could trade in 2007-15, one market entry at the open of a random 5-minute candle
   01:00-18:00 UTC, side by a fair coin, stop 0.5 × prevRange away, out at 21:00 or the stop, the same costs;
   seeds 1-40, the original's `rng`.
6. n ≥ 30.

A PASS would make the rule a candidate for a forward paper record only, by the owner's decision; never a live change.
A FAIL ends this rule's line of tests on gold.

The brief's default windows (in sample to 2016, out of sample 2017-2026) are not used: the 2016-26 years were the
original study's data, so the only untouched gold history is before 2016.

## Reported, not judged

- 2007-15 gross R a trade and gross month t; results by year; buys vs sells.
- Pooled 2007-01-01 → 2026-11-12 on this study's cache: n, net and gross R a trade, month t.
- Dependence on high-range years (descriptive only): trades split by prevRange above vs at-or-below the median of the
  last 250 prevRange values (this day's included, all known before the open), net R a trade and month t of each, for
  2007-15 and for the pooled period; and the 2007-15 figure with its best year left out.
