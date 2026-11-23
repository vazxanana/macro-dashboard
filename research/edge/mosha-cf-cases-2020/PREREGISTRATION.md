# Mosha sequence: the CF inside the VR, and the 50 % pullback before the CF (pre-registration, 23 Nov 2026)

Written and committed before any trade of this study was computed. Paper research only: nothing live reads it.

## Why

Readings of the Mosha sequence (BO, VR, CF, pullback, EG) disagree on two points. One reading says a CF whose zone sits
inside the VR box ("case 2") is likely to fail; another says it is valid; the owner's notes say their own tests found it did
better. Readings also disagree on whether the pullback must pass 50 % of the move before the CF. `research/edge/desk-rigor`
split both on 2020-2025 with the code of 21 Nov 2026 (no difference); the desk's sequence code has changed since (the CF one
timeframe under the VR, the CF only once price is back at the BO level, case 2 recorded as its own reading). This study asks
the two questions once more on the code as it stands, and whether the clean (case 1) sequence alone passes the common bar.

## The trades (fixed)

- Code: `assets/mosha-sop.js` `sopTrades` at this commit, with the page's own structure functions (`council/mosha-desk.mjs`
  `loadFns`, the six-candle structure the desk uses for the EG entry; the same structure for both cases, so the comparison is
  not confounded by the desk's later choice of a one-candle structure for case 2). Options: `{ from: 2020-01-01, market,
  nest: false, cfLimit: false }`, everything else the desk's default (VR box to the nearest swing, VR and CF as small-swing
  QMs, the CF read one timeframe under the VR, the CF only after price came back to the BO level, case 2 recorded as its own
  reading, internal-BO sequences, the turned-chart rule). No rule is changed.
- Kept: the EG entries of the main sequence only, ids `sop-[c2-][i-]<tf>-<time>` (major and internal BO, case 1 and case 2).
  Left out: the VR-retest records (`sop-vr-`, `sop-vc-`). Only trades closed at their stop or target (a trade still open on the
  last candle is not counted).
- Candles: the edgekit cache (OANDA mid). 5-minute candles from 2019-01-01 (warm-up; the eight extra markets start in 2019),
  resampled UTC to 15m / 30m / 1h / 4h; raw UTC daily candles from 2013. There are no one-minute candles, so an M5 VR's CF
  is read on M5 (the code's own fallback, written in each record's log).
- Markets outside the desk's own list get the desk's share-of-price stop buffer (0.30 at a price of 4,000) by adding them to
  the module's market list in the study's process (no file is changed).
- Cost: `COSTS[market]` of `research/edge/combo-grid-2/run.mjs` (round trip, price units) divided by the trade's risk (entry
  to stop), taken off each trade's R; also reported at twice that. Trades whose fill time falls in a bad interval of
  `research/edge/data-quality/quality.json` are dropped.
- Time of a trade = its fill (the EG candle's close). Discovery 2020-01-01 to 2023-12-31, confirmation 2024-01-01 to the
  last candle on file.
- "Pullback past 50 % before the CF" (computed by this study, not the record's own `deep`, which counts up to the entry):
  on 5-minute candles, after the candle that made the VR's extreme (the trade's target) and up to the close of the CF candle,
  a candle traded to the 50 % line the record carries (the middle of the BO leg's origin and the VR's extreme). A record
  without a 50 % line is left out of T2. The record's own `deep` is reported beside it, descriptive.

## Tests (primary pool: gold, EUR/USD, GBP/USD)

- **T1**: CF inside the VR (case 2) against CF clear of it (case 1). Statistic: mean net R of case 2 minus case 1, Welch t
  per trade, two-sided.
- **T2**: pullback past 50 % before the CF against not. Mean net R of "past 50 %" minus "not", Welch t, two-sided.
- **T3**: the clear-CF (case 1) sequence alone, against the common bar.

Bar for T1 and T2 (a difference, not an edge): discovery each side n >= 100 and |Welch t| >= 2; confirmation each side n >= 50,
the same sign as discovery, two-sided Welch p after Holm < 0.05; the month-paired difference (months where both sides traded)
of the same sign in confirmation; the same sign at twice the cost.

Bar for T3 (the brief's): discovery n >= 100, mean net R > 0, month-sum t >= 2; confirmation n >= 50, mean net R > 0, month-sum
t >= 2 and one-sided p after Holm < 0.05; mean net R > 0 at twice the cost in both windows.

Holm over T1-T3 (their confirmation p values). Month-sum t: calendar months, empty months inside the span counted as zero.

## Reported, not tested

- The same three on each of the other fifteen markets (usdjpy audusd nzdusd usdcad usdchf eurjpy xag gbpjpy eurgbp audjpy
  cadjpy euraud nas100 spx500 de40) and on the 18-market pool.
- Splits by timeframe pair, major against internal BO, before costs, the record's own `deep`.
- A cut test: gold run to 2020-07-01 and cut at 2020-06-01; every kept record filled by the cut must be the same (id, side,
  entry, stop, target, case) in both. A failure makes the study INVALID.

## Reading

T1 / T2 passing says which subset did better on these years, never that either is an edge. T3 passing makes the clean sequence
a candidate for a forward paper record, nothing more. Verdict: PASS if T3 passes; T1 / T2 results are reported with it.
INCONCLUSIVE if a side of T1 / T2 is under its n; FAIL otherwise. No variant is run after the result.
