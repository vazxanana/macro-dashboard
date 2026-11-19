# Pre-registration: does the quarter of the week, month or year an ICT A-setup's sweep falls in matter?

Written on 13 Nov 2026, **before any outcome of this split was computed**. What existed when this file was committed: the
classifier (`quarters.mjs`), the runner (`run.mjs`), the downloaded candles, and the output of the runner's `count` stage,
which counts signals per quarter and never simulates a trade (the table under "Sample size"). The `full` stage, the only one
that reads an outcome, runs after this file is pushed. The sha256 of this file is written into `result.json` (`planSha256`).

Paper research. ICT is its own edge, run by Fred: this study proposes at most. No file under `ict/`, no rule of the tracker,
the replay, the desk or the rule book changes, whatever the result. Every simulated trade keeps the engine's own stop.

## 1. Why this, and what is already known

`research/edge/ict-equal-lows` listed "quarter of the month / of the year" (rule book section 10, the quarterly-theory idea)
as not implemented and untested. The idea, in my words: time runs in cycles of four parts at every scale (year, month, week,
day); within a cycle the first part builds a range, the SECOND part makes the false move that takes liquidity (the
manipulation, the "Judas" move), the third makes the real move, the fourth continues or turns. The desk's A-setup is a
reversal after a sweep. If the idea holds, a sweep made in the second part of a cycle is the false move and the reversal
that follows is the real move, so A-setups whose sweep falls in Q2 should do better than the others.

Already tested and declared: `ict-sessions` (H3) tested New York weekdays of the signal's CLOSE as a filter (dropping Tuesday
and Thursday) and found nothing stable; it noted Tuesday was negative in 2008-17 and the best weekday of 2022-26. So the week
test below (Tuesday) is not blind to that remark; it is kept because it is the week cycle of the same idea and is defined on
the sweep candle's trading day, not the close's calendar day. The day cycle (Asia / London / New York AM / PM) is NOT tested
here: sessions were tested in `ict-sessions` and `ict-variants` V2. No outcome by month quarter or year quarter has been
computed by any study in this repository.

## 2. Definition (fixed; `quarters.mjs`)

- The **time of a signal** is its sweep candle's open time (`sweepT` from the tracker's `signals()`).
- **Trading day**: the New York day starting at 18:00 New York (the first quarter of the trading day opens then), New York
  daylight time by `council/histdata.mjs` `nyOffsetH`. A candle from 18:00 New York on belongs to the next calendar day.
- **Week**: Q1 Monday, **Q2 Tuesday**, Q3 Wednesday, Q4 Thursday; Friday is apart (in "the rest").
- **Month**: each week is counted by its Monday. Days before the month's first Monday are the partial first week (ignored as
  a quarter, in "the rest"); the week whose Monday is the 1st-7th is Q1, **8th-14th Q2**, 15th-21st Q3, 22nd-28th Q4; a week
  whose Monday is the 29th-31st is apart (in "the rest").
- **Year**: calendar quarters of the trading day's month: Q1 Jan-Mar, **Q2 Apr-Jun**, Q3 Jul-Sep, Q4 Oct-Dec.
- **Favoured** = Q2 of the cycle. **Rest** = every other A-setup (other quarters and the parts set apart).

## 3. Engine, data, costs (fixed, as `ict-equal-lows`)

- **Engine**: `api/_ictlab.js` `runMarket` with the desk's own `signals()`, `isASetup()`, `sizeOf()`, `P`
  (`ict/tracker.mjs`) and `simulate()` (`ict/replay.mjs`), imported, never edited. Live exit, live sizing, one open trade per
  market per stream.
- **Streams**, each its own one-open stream per market: **unfiltered** = every A-setup; **Q2** = A-setups whose sweep is in
  Q2 of the cycle; **rest** = the others.
- **Markets**: NQ, ES, YM, RTY (OANDA NAS100, SPX500, US30, US2000) under the index A-rule; GC (OANDA XAU) under the gold
  rule. All five pooled for every test.
- **Candles**: OANDA mid H1 through the keyless proxy, 2 Jun 2019 (warm-up) → 9 Nov 2026, cleaned as the lab does (17:00 New
  York hour dropped, D1 = `dailyNY`). OANDA times are UTC.
- **Window**: signal candle closes 2020-01-01 → 2026-10-31. **IS** 2020-23, **OOS** 2024-01-01 on.
- **Costs**: the lab's round trip (NQ 1.5, ES 0.5, YM 3, RTY 0.4 points, gold 0.5). Net R = size x (R − cost / risk).

## 4. Sample size (the `count` stage: A-setup signals, IS / OOS, no outcome)

| cycle | Q1 | Q2 | Q3 | Q4 | apart |
|---|---|---|---|---|---|
| week | 202 / 126 | 250 / 152 | 205 / 171 | 249 / 155 | Friday 180 / 116 |
| month | 218 / 174 | 259 / 152 | 265 / 169 | 244 / 159 | partial first week 71 / 44; week from the 29th 29 / 22 |
| year | 244 / 174 | 284 / 189 | 290 / 209 | 268 / 148 | — |

1,806 A-setup signals (1,086 IS, 720 OOS), the same as `ict-equal-lows`. Q2 holds 150-190 signals out of sample in each
cycle, before the one-open rule.

## 5. Tests (three, no fourth), statistic and bar

| test | split |
|---|---|
| **T1** | week: Tuesday vs the rest |
| **T2** | month: week 2 vs the rest |
| **T3** | year: April-June vs the rest |

Statistic: the difference in net R a trade, Q2 stream minus rest stream, one-sided Welch t (normal approximation) for "Q2 is
better"; Holm over the three tests on the out-of-sample p.

**PASS**, per test, only if all hold:
1. out of sample the Q2 stream beats the rest with Welch **t ≥ 2** and **Holm-adjusted p < 0.05**;
2. it **holds in sample**: the in-sample difference Q2 − rest is above zero;
3. the Q2 stream's net R a trade is above zero in sample and out of sample, with OOS n ≥ 30.

**FAIL** when the out-of-sample difference is not above zero or the Q2 stream's OOS R a trade is not above zero.
**INCONCLUSIVE** otherwise.

Reported, not judged (no verdict hangs on them): each quarter of each cycle as its own stream; the index book and gold
apart; years; gross figures.

## 6. What follows

- A PASS becomes a short proposal in `research/proposals/` for Fred and the owner (a forward tag or a paper shadow first),
  never a live change made here.
- Anything else: the result is reported as it is, no proposal file. Nothing is tuned after the run (no other favoured
  quarter, no "Q2 or Q3", no other day boundary). A bug found after the run is fixed, stated in RESULT.md, and everything is
  run again.

## Prior knowledge, declared

The index A-rule was fitted on 2023-26 data and the gold rule on 2019-26 gold, so the unfiltered baseline is not out of
sample; only the split is judged. The Tuesday remark of `ict-sessions` is declared above. No outcome by quarter of the month
or year was seen before this file.
