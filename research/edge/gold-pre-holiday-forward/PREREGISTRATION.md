# Pre-registration: gold-pre-holiday-forward (20 Nov 2026)

Paper research only. **A forward record of one fixed rule on holidays no study has read.** Nothing is traded, alerted, mirrored
or copied, no council member reads its file, and it is not a live rule or a decision of the owner's. The rule is
`gold-pre-holiday`'s T1 (PASS, 14 Nov 2026): a stand-alone calendar rule on spot gold, not a gate, exit, entry or size of the
live gold book (owner decision 44).

Written and pushed alone, before any forward event has happened: the study read holidays up to 31 Oct 2026
(`OOS_END`), and the next NYSE holiday is Thanksgiving, 26 Nov 2026.

## Why

`gold-pre-holiday` T1 passed its bar out of sample 2017-26 (+0.133R a trade, n 92, t 2.35), but the study itself says why that
is not proof: a weak in-sample decade (+0.034R, t 0.52), most of the out-of-sample figure from 2017-21 (2022-26 alone t 0.78),
and about nine events a year. The only new evidence possible is holidays after the study's last one. This study writes them down
as they come, against a range fixed now.

## The rule and its cost (frozen; nothing is chosen later)

- Imported unchanged from `research/edge/gold-pre-holiday/run.mjs`: `holidays` (NYSE full holidays from `ict/calendar.mjs`),
  `buildDays` (17:00 New York days), `eventDays` (the last trading day before the holiday) and `trade` (long at that day's
  first H1 open, out at its last H1 close, stop 1.0 x ATR(14) of the days before, checked on H1, a gap fills at the open; cost
  $0.60 an ounce a round trip plus `nights` x `FIN.xau.long` financing). The study's run.mjs is checked against its sha256
  (written in `run.mjs` here); a mismatch stops the run.
- Events: every holiday dated after 2026-10-31 whose event day is complete in the candles; an event whose trade cannot be built
  (missing day, no ATR) is listed as skipped with the reason, never guessed.
- Data: OANDA mid XAU/USD H1 from 1 Sep 2026 (warm-up for the ATR) through the candle service.

## The expected range (fixed now)

Two worlds, both from the study's own out-of-sample T1 trades in its committed `result.json` (2017 to Oct 2026, n 92):
**A, as measured** (+0.133R a trade) and **B, no edge** (the same trades less their mean). For a forward record of N events,
each world's total R is drawn 20,000 times by resampling single events with replacement (seeded, 20261120; events are about
six weeks apart, so no blocks). Reported at every update: A's 5th, 50th and 95th percentiles and B's 95th.

## Readings and checkpoints

- **Too few** while N < 10; then **below the measured range** (total under A's 5th), **ahead of a no-edge rule** (above B's
  95th) or **undecided**.
- **N >= 20 (about two years)**: **fails** if below A's 5th percentile, else **holds so far**.
- **N >= 40 (about four and a half years)**: **confirmed** only above B's 95th percentile with t (per event) >= 2; **fails**
  below A's 5th; otherwise **not shown either way**. The first crossing of each checkpoint stands.

## What this cannot measure

Fills: OANDA mid candles and a fixed $0.60, not the broker's own quotes. Nine events a year is slow by nature: the record
cannot say anything for about two years, and a single holiday regime (for example a run of sharp pre-holiday sell-offs) can
dominate it.

## Running

`node research/edge/gold-pre-holiday-forward/run.mjs <candleDir> [out.json]` reads `xau-1h.json.gz` and writes `result.json`
and `RESULT.md` here; `.github/workflows/vb-forward.yml` runs it with the gold breakout's record and saves the file to council-data
`research/forward/gold-pre-holiday.json`. Test: `tests/gold-pre-holiday-forward.test.mjs`.
