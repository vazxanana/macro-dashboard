# Pre-registration: vb-early-forward (23 Nov 2026)

Paper research only. **A forward split of two forward records by fill hour, on days no study has read.** It is not a live
rule, not a paper or demo stream and not a filter on anything: nothing is traded, alerted, mirrored or copied, and no council
member reads its file. Written and pushed alone, before any trade of its window has been computed: its first day,
2026-11-24, has not happened yet.

## Why

`holdout-vb-early` (23 Nov 2026, FAIL) tested the volatility breakout taken only when it fills before 06:00 UTC on an
untouched holdout. Early fills beat late fills of the same rule on both of its sets (Set A, 2005-09 on the five main markets:
+0.239R against +0.010R a trade, Welch t 4.12; Set B, markets never in a breakout study, 2010 on: +0.012R against −0.046R,
Welch t 2.06), but the rule missed its bar (Holm, 2x costs), and the split was first seen on in-sample trades. It is the one
open idea of that round. Past candles have been read under it; the one source of new evidence left is time. This study splits
the trades the two frozen forward records already take, gold T1 (`gold-vol-breakout-forward`) and USD/JPY T1
(`usdjpy-vol-breakout-forward`), by fill hour, with the expected range fixed now. It is never judged on past data: the
discovery trades below set the range and nothing else; the holdout's own figures are not added in.

## The trades (frozen; nothing is chosen later)

- **Gold**: `research/edge/gold-vol-breakout-forward/run.mjs` `forwardTrades` (T1, k 0.5, both sides; its sha256 checks of
  `original.mjs` and `costs.mjs`; its cost, route C1 frozen from `gold-vol-breakout-hourcost/result.json`), imported unchanged.
- **USD/JPY**: `research/edge/usdjpy-vol-breakout-early/run.mjs` `trades('usdjpy', days)` (T1 through the pinned
  `index-vol-breakout/original.mjs`, the sha256 check `usdjpy-vol-breakout-forward` makes; cost `0.000045 × entry + 0.005` a
  round trip), imported unchanged.
- **Days**: complete UTC weekdays from **2026-11-24** on, for both markets (earlier forward days of the two records are left
  out of this split). Candles and day building exactly as each forward study reads them (OANDA mid M5; the last calendar day on
  file is left out).
- **Early / late**: a trade is **early** when its fill candle starts before 06:00 UTC of the trade's UTC day (`fillMin` < 360,
  the minute of the fill candle's start after 00:00 UTC, as `original.mjs` returns it and `holdout-vb-early` used it), **late**
  otherwise. T1's first fill wins and the other order is cancelled, so an early trade here is exactly the trade the
  early-only rule would take that day. No trade is dropped, re-sized or re-timed.
- **R**: each trade's net R after its market's frozen forward cost (`net`). The two markets are pooled; each market is also
  reported alone.

## The measured quantity

**D = mean net R of the early trades − mean net R of the late trades**, pooled over both markets, with its Welch t. Also
reported at every update, never judged before the checkpoints: n, mean net and gross R, total and month-sum t of each side,
the same per market, early fills by hour (00-03, 03-06 UTC), and by trade side.

## The expected range (fixed now)

Built from the discovery trades of the two forward studies, rebuilt once by this study's `baseline` step and stored in its
`baseline.json` with each trade's day, fill minute and net R: gold T1 on 2021-01-01 → 2026-11-12 under C1 (gated against
`gold-vol-breakout-forward/baseline.json`: n 1,121, +0.105R) and USD/JPY T1 on 2016-01-01 → 2026-11-19 under its cost (gated
against `usdjpy-vol-breakout-forward/baseline.json`: n 2,079, +0.063R). A gate mismatch stops the run. Two worlds:

- **A, as measured**: those trades as they are (early and late with their measured means).
- **B, no difference**: the same trades with every early trade's net R shifted by the measured D, so early and late have
  the same mean.

For a forward record with n_e early and n_l late trades, each world's D is drawn 20,000 times (seed 20261120): whole calendar
months of the pooled discovery trades (both markets together) are resampled with replacement and joined in draw order until
both sides have enough trades, then each side is cut at its forward count and D is the difference of the two means.
Reported at every update: A's 5th, 50th and 95th percentiles and B's 95th percentile of D at (n_e, n_l).

## Readings (every update)

- **Too few** while either side has fewer than **40** trades.
- **Below the measured range** when the forward D is under A's 5th percentile.
- **Ahead of no difference** when the forward D is above B's 95th percentile (and not below A's 5th).
- **Undecided** otherwise.

## Checkpoints and what they mean

- **Both sides ≥ 120 trades**: if D is below A's 5th percentile, the split **fails** (early fills did not keep their lead on
  new days). Otherwise it **holds so far**.
- **Both sides ≥ 240 trades**: **confirmed** only if D is above B's 95th percentile, the Welch t of D is 2 or more and the
  early side's mean net R is above 0; **fails** if D is below A's 5th percentile; otherwise **not shown either way**.

The early side fills the slower: from the past trades roughly 150 early trades a year over both markets, so 40 takes about
three to four months, 120 under a year and 240 nearer two years. The first crossing of a checkpoint is the reading that
counts; later updates are reported but never replace it. A "confirmed" reading would make the early-only rule a candidate for
its own forward pre-registration, never a live rule (that is the owner's decision). No rule, window, cost, threshold or line
above changes after this file is pushed; a different split (another hour, another market) needs its own pre-registration.

## What this cannot measure

Execution: OANDA mid candles and pre-set costs, not fills. Asian-hour spreads are measured for gold only
(`gold-vol-breakout-hourcost`); USD/JPY keeps its flat allowance. The two markets' trades are not independent on days both
trade. One or two forward years are one regime.

## Running

`node research/edge/vb-early-forward/run.mjs baseline <gold candle dir> <usdjpy candle dir>` (once, writes `baseline.json`),
then `node research/edge/vb-early-forward/run.mjs run <gold candle dir> <usdjpy candle dir> [out.json]` writes `result.json`
and `RESULT.md` here. `.github/workflows/vb-forward.yml` runs it after the two forward records on their own candles and saves
the result to council-data `research/forward/vb-early.json`. Test: `tests/vb-early-forward.test.mjs`.
