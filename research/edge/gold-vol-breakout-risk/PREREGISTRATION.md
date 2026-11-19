# Pre-registration: gold-vol-breakout-risk (14 Nov 2026)

Paper research only. A **descriptive risk profile** of one stand-alone intraday rule on spot gold: what the owner should expect
if the rule were run on paper or on a demo account. There is no hypothesis test, no pass or fail, no new signal and no change
to the rule. The rule is **not** a gate, exit, entry or size of the live gold book (Gold trend + Gold daily engulf); owner
decision 44 keeps that book's 2006-17 window closed, and this study reads none of the book's records or positions. Nothing
live changes and no proposal is written: any paper or forward step is the owner's decision.

Written and pushed before any figure below was computed. The only numbers computed so far are the ones the replicate study
already published (they are the harness gate).

## The rule (T1 of `gold-vol-breakout`, unchanged)

- At the first M5 candle from 00:00 UTC (it must start before 01:00, and the day needs 200 candles), O = its open.
- prevRange = high − low of the previous UTC D1, weekend-folded with `council/fills.mjs` `foldWeekend`.
- Buy stop O + 0.5 × prevRange, sell stop O − 0.5 × prevRange, live on the 00:00-20:55 UTC candles; the first filled wins.
- Stop back at O (worst case inside the fill candle); exit at the close of the 20:55 candle. One trade a day at most.
- Costs: $0.60 a round trip per ounce (the original's fixed figure, today's level, not measured for older years), plus
  `FIN.xau.long` × `nights` on buys (no trade crosses the 22:00 UTC rollover, so 0). 2x costs reported beside.

The code is not re-implemented. Two files are copied **verbatim** from branch `gold-vol-breakout-replicate` (commit 3360a2cfd):
`original.mjs` (the original study's `run.mjs`, sha256 afa36e03…276f) and `replicate.mjs` (the replicate study's `run.mjs`, sha256
02002e80…449e). This study's `run.mjs` imports `daysOf`, `tradesIn`, `placeboIn` from `replicate.mjs` and `summary`, `monthT`,
`quantile` from `original.mjs` and changes none of them.

## Data

`xau-5m.json.gz`: OANDA mid XAU/USD M5, rows `[t, o, h, l, c]`, 2006-11-01 → 2026-11-13, the replicate study's own cache (out of
git). The forming last day is dropped (`daysOf`), so the record ends 2026-11-12.

## Harness gate (must hold before anything else is read)

On this cache, `tradesIn` must reproduce the replicate study's published figures **exactly** (n, net R, gross R, month t, gross t,
net at 2x): 2007-2015 n 1657, +0.111, +0.203, t 3.19, gross t 5.96, 2x +0.018; pooled 2007-01-01 → 2026-11-12 n 3713, +0.073,
+0.155, t 3.35, gross t 7.24, 2x −0.009. If either differs, the study stops and reports why.

## The record studied

- **Window W: 2007-01-01 → 2026-10-31**, whole calendar months only (238 months), so the bootstrap draws complete months. The
  1-12 Nov 2026 trades are shown in one line, outside every figure.
- **Daily R series**: one value per built weekday in W (every weekday `daysOf` builds, skipped days included): the trade's net R
  on a trading day, 0 on a day without a trade. 1R = the distance from entry to O.
- Windows for description (no test): **in sample 2007-2016**, **out of sample 2017 → 2026-10** (n, net R, gross R, month t,
  gross t, 2x net; and 2007-15 / 2016-26 halves are not added: the two windows above only).

## What is computed (all fixed now)

1. **Record at $0.60** (and the same at 2x costs): total R, R a year (total / (weekdays / 261)), trades a year, equity curve
   (month ends, in `result.json`), worst closed drawdown (on the daily series, from the running high, the record starting at 0),
   its start, low and recovery dates, longest time under water (weekdays and years from a running high to the first day above
   it, or to the end of W if never regained), worst month, worst calendar year (2007-2025; 2026 to October shown, flagged
   partial), longest losing streak (consecutive trades with net R < 0), share of months with a positive sum.
2. **Risk table** at 0.1 / 0.25 / 0.5 / 1 % of the account a trade, simple (not compounded), as the path-to-live proposal:
   % a year = R a year × risk; worst drawdown % = the record's worst closed drawdown × risk; **1-in-20 ten-year drawdown** = the
   95th percentile of the worst closed drawdown over 120 months drawn by month-block bootstrap (20,000 draws, seed 45) × risk;
   years under water as measured.
3. **Forward bands.** Month-block bootstrap of the daily series of W: each path draws whole calendar months with replacement
   (`mulberry32`, 20,000 draws, seed 44, the same draws for the three worlds' structure), cumulative R and worst closed drawdown
   kept at **12, 24 and 36 months** (p5 / p50 / p95 of the total, share of paths below 0, p50 / p95 of the drawdown). Worlds,
   by what is taken off **every trade's** net R: **as measured** (nothing), **no edge** (1 × the mean net R a trade of W),
   **losing** (2 × that mean). Quantiles by sorted index `floor(p × draws)` (the path-to-live `quant`).
   **Pre-committed stop lines**, fixed from the as-measured world only: **S1** the worst closed drawdown over 36 months above its
   95th percentile (at any time), **S2 / S3 / S4** the total under its 5th percentile at 12 / 24 / 36 months. For each line and
   each world: the share of paths that cross it (false-alarm rate in the as-measured world, detection power in the other two),
   and the share stopped by any line within 36 months.
4. **Trades needed for t ≥ 2** on a forward record: (2 × sd / mean)² of the per-trade net R of W, in trades and in years at W's
   trades a year; and the same on calendar-month sums, (2 × sd_m / mean_m)² months. Both at $0.60 and at 2x costs (when the 2x
   mean is not positive: "never").
5. **Overlap with gold (descriptive, no test).** Gold's daily return = this cache's UTC-day close over the previous built
   weekday's close − 1 (the weekend folded as `foldWeekend` does: the last close before Monday). Pearson correlation of T1's daily
   net R with (a) gold's same-day return on every weekday of W, (b) the same on trading days only, (c) T1's monthly R sum with
   long-gold buy-and-hold's monthly return (last close of the month over the previous month's), and T1's mean net R a trade on
   days gold closed up vs down, buys vs sells. The live book's records are **not** read (owner decision 44).
6. **Placebo** (context, 40 seeds): the replicate study's own placebo (`placeboIn`: a market entry at a random 5-minute mark
   01:00-18:00 UTC, fair-coin side, the same stop distance, exit and costs) on the days T1 could trade in W. Reported: the real
   mean net R against the 40 placebo means (median, 95th percentile, seeds beaten), and each placebo record's worst closed
   drawdown (daily series built as in 1) against the real one, so the stop lines can be read against a no-edge record that carries
   the same costs and the same day-to-day noise.

No p-value is computed, so there is no Holm correction; the month t figures are descriptions of the record, not tests.

## Verdict wording

No pass or fail. The bold "Verdict" line of RESULT.md says "Descriptive risk profile, no test" with the headline figures, and
RESULT.md closes with one paragraph on what a 12-month paper record could and could not show.

## Scope

Touches only `research/edge/gold-vol-breakout-risk/`, `tests/gold-vol-breakout-risk.test.mjs` and the rebuilt `out/`.
