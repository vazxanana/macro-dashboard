# Pre-registration: WHEN does the ICT A-setup edge live? (session, opening hours, weekday, post-halt)

Written on 7 Nov 2026, **before any session, hour or weekday cell of the 2018-26 or live-replay trades was computed**.
Only the trade history was rebuilt (the unchanged `research/edge/ict-oos-2008/run.mjs` over the OANDA candle cache, 18,784
rows over 2007-06 .. 2026-10) and the structure of the three trade files was inspected (column names, counts, date ranges).
Nothing below changes after the first computation. The test runs once and the result is reported whatever it is.

## Why

The ICT desk's A-setup rule (`ict/tracker.mjs`, H1 iFVG reversal) is regime-bound: +0.093R a trade on 2018-26 but −0.013R on
2008-17 (`research/edge/ict-oos-2008`, #526). The question here is not whether the rule works, but *when in the week and the
day* its trades are taken: does the edge live in one part of the clock, so that the rest is cost without return? The rule
itself is **not** changed. This is a filter study on top of the unchanged A-setup stream, and anything that passes becomes at most
a paper shadow variant (the `VARIANTS` / `shadowByVariant` pattern of `nofri`), never a live change.

## Prior knowledge, declared

- `research/edge/ict-filters` (HistData 2018-26, IS 2018-23 / OOS 2024-26): "NY PM is negative" did not survive out of sample;
  London was the best A session in-sample and the worst out-of-sample; "no Fridays" passed weakly and runs as the `nofri`
  shadow variant. Its session labels were the tracker's (`feat.session`: Asia 18-03, London 03-08, NY AM 08-12, NY PM 12-16,
  Close 16-17 ET), not the ones defined below.
- `research/edge/ict-oos-2008/RESULT.md` reports one descriptive session cell: the tracker's "NY AM" (08-12 ET) made −0.131R a
  trade on 2008-17 (n 777) and +0.085R on 2018-26 (n 604). That cell was seen before this document was written. The sessions
  below are defined differently (cash-open hours), the selection rule is mechanical, and the bar is on untouched partitions
  (first two hours, weekday, post-halt) as well as sessions. The contamination is disclosed, not removed.
- Nothing about the 2018-26 or replay trades by hour, by weekday or post-halt has been looked at.

## Data (fixed now)

Three trade files, all produced by the desk's own code (`signals()`, `isASetup()`, `sizeOf()`, `isAPlus()` from `ict/tracker.mjs`,
`simulate()` from `ict/replay.mjs`, replay busy rule), none of them changed for this study:

| set | source | period | markets | R used |
|---|---|---|---|---|
| **OANDA** (selection + primary confirmation) | `research/edge/ict-oos-2008/run.mjs` over the OANDA 5m cache (`fetch.mjs` of that study) | 2008-01-01 .. 2026-10-31 | GC (XAU_USD), NQ (NAS100_USD), ES (SPX500_USD), YM (US30_USD) | net R = size × (Rraw − costR), that study's costs (GC 0.50; NQ/ES 0.02% + 0.25; YM 0.02% + 1 per round trip) |
| **HistData** (vendor cross-check) | `research/edge/ict-universe/universe.mjs` output, cells `gc` under the gold rule, `nas100` and `spx` under the index rule, A-setups only | 2018-01-01 .. 2026-10-30 | GC, NAS100 (= NQ), SPX (= ES) | net R = size × (Rraw − costR), that study's costs |
| **Live replay** | council-data `ict/replay.json` as fetched on 7 Nov 2026 (`at` 2026-11-07T21:16Z): `trades` with `aset: true` and `closed` | 2025-08-01 .. 2026-11-07 | NQ, ES, YM, RTY, GC (CNBC futures, cash fill before CNBC's history) | the desk's own `R` (sized, no cost deduction: that is the paper stat the owner sees) |

Rows: A-setups only (`aset = 1` under the desk's rule set for the market). The time of every trade is the **close of its signal
H1 candle** (`close` / `signalAt`, Unix seconds). Everything below is derived from that timestamp with the tracker's own
New York clock (`Intl.DateTimeFormat`, `America/New_York`, DST-aware), so no stored label is needed.

## Windows

- **Selection window:** OANDA, signal close in 2008-01-01 00:00 UTC .. 2017-12-31 23:59 UTC (by UTC time of the close).
- **Confirmation window:** OANDA, 2018-01-01 .. 2026-10-31, in two halves by the year of the signal close: **2018-2021** and
  **2022-2026** (the same split `ict-oos-2008/analyse.mjs` uses for its reference window).
- **Cross-check:** HistData 2018-2026, same two halves.
- **Live replay:** the whole file (15 months; too short to halve).

## The four hypotheses (fixed; no fifth)

Let *h* be the New York hour (0-23) of the signal candle's close and *wd* its New York weekday. H1 candles close on the UTC hour,
so *h* is an integer. No H1 candle closes at h = 18 (the 17:00-18:00 ET halt hour is dropped by the feed).

| # | hypothesis | partition of the A-setups |
|---|---|---|
| H1 | **Session of entry.** The edge lives in one session. | **Asia** h ∈ {19..23, 0, 1, 2} (candles 18:00-03:00 ET); **London** h ∈ {3..9} (02:00-09:00 ET, London open through the New York pre-market); **NY AM** h ∈ {10, 11, 12} (the three candles closing inside the 09:30-12:00 cash morning: 09:00-10:00, 10:00-11:00, 11:00-12:00); **NY PM** h ∈ {13..17} (12:00-17:00 ET, afternoon and close). |
| H2 | **Opening hours.** The first two hours of regular trading differ from the rest. | **first2** h ∈ {10, 11} (the two H1 closes inside 09:30-11:30 ET) vs **rest** (every other hour). |
| H3 | **Day of week.** Some weekdays carry the edge (the desk already runs `nofri`). | wd ∈ {Sun, Mon, Tue, Wed, Thu, Fri} of the New York calendar day of the close (the same clock as `nyFriday()`; Sunday = the 18:00 ET Sunday reopen, Saturday cannot occur). |
| H4 | **Post-halt.** Signals right after the 17:00 halt are thin-market noise. | **posthalt** h ∈ {19, 20} (the first two H1 candles after the 18:00 ET reopen) vs **rest**. |

## Selection rule (2008-17 OANDA only, mechanical)

For each hypothesis, with every cell's mean net R (costs x1) on 2008-17:
- **Dropped set D** = the union of the cells with mean net R **< 0 and n ≥ 100** on 2008-17. **Kept set K** = all other cells.
- The hypothesis produces a candidate filter ("take A-setups only in K") only if D and K are both non-empty and the dropped
  set's mean net R on 2008-17 is below the full stream's (so the kept set beats the full stream in the selection window).
  Otherwise the hypothesis has **no candidate** and cannot pass.
- Nothing else is chosen on 2008-17. No cell boundary moves. No second pass.

## The bar (judged once, on data the selection never saw)

A candidate filter **PASSES** only if **all** of these hold, net R at costs x1 unless stated:

1. **OANDA 2018-2021 and 2022-2026, each half separately:** mean net R of K > mean net R of the full A-stream (K ∪ D), **and**
   mean net R of D ≤ 0 with n(D) ≥ 30.
2. **HistData 2018-2021 and 2022-2026, each half separately:** the same two conditions (K beats the full stream; D mean ≤ 0 with
   n(D) ≥ 30).
3. **Live replay (Aug 2025 - Nov 2026, the desk's R):** mean R of K > mean R of the full closed A-stream, **and** mean R of D ≤ 0
   with n(D) ≥ 30. If n(D) < 30 on the replay, the replay cannot judge the filter and the filter does **not** pass (reported as
   "replay too small").

Anything short of that is a **FAIL** for that hypothesis, including "passes OANDA but not HistData" and "passes 2018-26 but not
the replay". Four hypotheses are tested; at most four candidates; every one is reported.

## Reported, not part of the verdict

- Every cell of every partition in all four windows (2008-17, 2018-21, 2022-26 OANDA; HistData halves; replay): n, win rate,
  mean net R, total R, t (mean / (sd / √n)), at costs x1 and x2 (OANDA, HistData) and gross.
- Per market for the kept and dropped sets in the confirmation window.
- Welch t between K and D in each confirmation half.
- The trade-count share each candidate keeps (a filter that keeps 20% of the trades is a different desk).

## If a candidate passes

- It is added to `ict/tracker.mjs` as a paper shadow variant following `nofri` exactly: a `SHADOW.<name>` entry, a rule function
  `isX(g, mk) = aRecorded(g, mk) && <time condition on g.close>`, `VARIANTS.push`, and a branch in `variantRule()`; it tags
  `vr` through `variantTags()` like `nofri`. `ict/replay.mjs` picks it up through `VARIANTS` without change. The desk comparison
  card and the Coach's `VARIANT` labels get its label.
- The live A-setup stream must stay **byte-identical**: chained tracker runs old vs new on the same stubbed feed and clock
  (`research/edge/ict-markets/proof/chain.mjs` / `stub.mjs`, as #504/#505), `trades.json`, `snapshot.json`, `bars.json` and
  `shadow.json` without the new variant with 0 diffs; `replay-cmp.mjs` for the replay with the new variant's fields removed.
- Paper only. No live rule, sizing, exit, cost or market changes. The owner decides anything live.

## If nothing passes

- The study reports the null result with every cell, and no code outside `research/edge/ict-sessions/` changes.

## What will not happen

- No hypothesis, cell boundary, threshold, half split, cost or bar changes after the first computation.
- No fifth hypothesis, no combination of filters, no per-market selection.
- No live code changes other than a paper shadow variant for a filter that passes the bar above.
