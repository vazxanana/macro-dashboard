# Pre-registration: turnaround-tuesday-forward (20 Nov 2026)

Paper research only. **A forward record of one fixed rule on weeks no study has read.** Nothing is traded, alerted, mirrored or
copied, no council member reads its file, and it is not a live rule or a decision of the owner's. The rule is
`turnaround-tuesday`'s one passing cell, R2 on NAS100 (PASS, 13 Nov 2026, narrowly).

Written and pushed alone, before any forward week has been computed. The study's candles ended on 2026-11-12; the author has
not looked at NAS100 after that day through this rule.

## Why

The study's pass is thin (one cell of four, Holm p 0.039, n 81 on 2016 → Nov 2026, +0.098R a trade, t 2.33) and its own text
calls it a paper-shadow candidate, not a proven edge. The only new evidence possible is the Mondays after its last candle.

## The rule and its cost (frozen; nothing is chosen later)

- Imported unchanged from `research/edge/turnaround-tuesday/run.mjs` (sha256 pinned in `run.mjs` here; a mismatch stops the run):
  `tradingDays`, `weekPairs` (the first trading day of a week followed by a second one), `buildDays` (the close = the H1 candle
  ending 16:00 New York, 13:00 on half days), `dayChg`, `ruleOn` with R2's drop (−1 %), `trade` (buy that first day's close,
  sell the next trading day's close, stop 2 x ATR(20) checked on H1, a gap fills at the open), cost `MARKETS.nas100.cost`
  (0.0005 of price a round trip) and financing DGS2 + 2.5 % a year by calendar nights.
- DGS2 = the last value in the study's `rates.json` (4.86 %, week of 13 Nov 2026) for every forward trade: frozen, never
  refreshed (one night of financing is about 0.02 % of price either way).
- Weeks: those whose first trading day is after 2026-11-12 and whose exit day is closed in the candles. Data: OANDA mid NAS100
  H1 from 1 Sep 2026 (warm-up for the ATR) through the candle service. A signal whose trade cannot be built is listed as
  skipped with the reason.

## The expected range (fixed now)

From the study's own out-of-sample R2 NAS100 trades in its committed `result.json` (2016 → Nov 2026, n 81, R after costs):
**A, as measured** and **B, no edge** (less their mean); for N forward trades each world's total is drawn 20,000 times by
resampling single trades with replacement (seeded, 20261120). Reported every update: A's 5th / 50th / 95th, B's 95th.

## Readings and checkpoints

- **Too few** while N < 10; then **below the measured range** (under A's 5th), **ahead of a no-edge rule** (above B's 95th) or
  **undecided**.
- **N >= 20 (about two and a half years)**: **fails** below A's 5th, else **holds so far**.
- **N >= 40**: **confirmed** only above B's 95th with t (per trade) >= 2; **fails** below A's 5th; else **not shown either way**.
  The first crossing of each checkpoint stands.

## What this cannot measure

Fills (OANDA mid candles and a fixed cost); about eight trades a year, so nothing can be said for years; and one equity regime
(a bear market, when down Mondays cluster) can dominate it.

## Running

`node research/edge/turnaround-tuesday-forward/run.mjs fetch <dir>` then `… run <dir> [out.json]`; `vb-forward.yml` runs it with
the gold records and saves council-data `research/forward/turnaround-tuesday.json`. Test: `tests/turnaround-tuesday-forward.test.mjs`.
