# ICT A-setups: did the sweep run into an open NWOG / NDOG? (pre-registered)

**Verdict: FAIL. A-setups whose sweep ran into an open NWOG / NDOG made +0.029R a trade net out of sample (n 50, month t 0.20), no better than the rest (−0.109R a trade, t −0.63).**

None of the three pre-registered tests passes (Holm p 1.00 for each). In sample the same split looked good (+0.427R a trade,
n 61, month t 1.57, against +0.067R for the rest); out of sample it is gone, and 25 of 40 random taggings of the same share did
at least as well. The A-rule stays as it is. No proposal is made, and no file of the ICT desk changed.

## How it was run

- **Pre-registration first.** `PREREGISTRATION.md` was committed and pushed alone (891d936c), with the sha256 of the detector
  `gap.mjs` and the runner `run.mjs`, which followed unchanged in the next commit. Before that only the candle download and the
  runner's `count` stage (gaps and signals, no trade simulated) had run. The `full` stage ran once; nothing was changed after it.
  Plan sha256 `e17fd3d1…48c4` is in `result.json`.
- **Why this concept.** `ict-equal-lows` listed it as one of the two concepts of the ICT skill still untested. `ict-concepts`
  traded the gap fill as its own entry (no iFVG); this study keeps the desk's entry and only asks what the sweep ran into.
- **Definition.** CME breaks from `ict/calendar.mjs`: NWOG = the last H1 close before a break containing a Saturday to the first
  H1 open after it; NDOG = the same for every other break (17:00 New York close to the 18:00 reopen). A signal is WITH-gap when
  its sweep candle's extreme ran into (or through) one of the 5 most recent NWOGs or 5 most recent NDOGs formed before it and not
  fully filled before it. About one A-setup in seventeen qualifies (1,758 NWOGs and 6,944 NDOGs over the five markets).
- **Engine.** The research lab's `runMarket` (`api/_ictlab.js`): the desk's own `signals()`, `isASetup()`, `sizeOf()`
  (`ict/tracker.mjs`) and `simulate()` (`ict/replay.mjs`), imported and never edited. Live exit, live sizing, one open trade per
  market per stream. Every trade keeps the engine's own stop.
- **Data.** OANDA mid H1 through the site's keyless proxy: NAS100, SPX500, US30, US2000 (for NQ, ES, YM, RTY) and XAU (GC),
  2 Jun 2019 to 9 Nov 2026, about 43,900 candles a market. No trade unresolved, none dropped for a data hole. The unfiltered
  baseline equals `ict-equal-lows`' on the same candles (+0.137R, n 679 out of sample).
- **Window.** Signals 1 Jan 2020 to 31 Oct 2026; in sample 2020-23, out of sample 2024 on.
- **Costs.** The lab's round trip (NQ 1.5, ES 0.5, YM 3, RTY 0.4 points, gold 0.5); all R below is net and sized as live.
  Financing (reported only) at `council/fills.mjs` `FIN.xau.long` a night on every market and side.
- **Limitation.** OANDA cash CFDs stand in for the futures: their opening gaps are CFD gaps, not CME futures gaps.
  As pre-registered, the fill rule reads every kept candle after the reopen, including a CFD print in CME-shut hours (a
  holiday afternoon); the gap edges themselves are taken on CME hours only.

## The three tests

| test | what | value | t | p | Holm p | pass |
|---|---|---|---|---|---|---|
| **T1 (primary)** | WITH-gap, all five markets, OOS net R a trade | +0.029R (n 50) | 0.20 (month sums) | 0.42 | 1.00 | **no** |
| T2 | WITH minus WITHOUT, all five markets, OOS | −0.109R | −0.63 (Welch) | 0.74 | 1.00 | **no** |
| T3 | WITH-gap, index book, OOS net R a trade | +0.040R (n 44) | 0.24 (month sums) | 0.40 | 1.00 | **no** |

T1 and T3 meet the sample-size line (n ≥ 30), are positive in sample and still positive at 2x costs (+0.014R and +0.026R),
but their month t is 0.20 and 0.24 against the bar of 2. T2's difference is positive in sample and negative out of sample.

## The streams (net R, sized as live)

| stream | window | n | win | R a trade net | total | max DD | trade t | month t | gross R a trade | gross month t | 2x costs | with financing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| all: unfiltered | IS | 1,028 | 38% | +0.084 | +86.5 | 33.3 | 1.73 | 1.34 | +0.111 | 1.76 | +0.057 | +0.062 |
| | OOS | 679 | 40% | +0.137 | +93.0 | 17.8 | 2.28 | 2.16 | +0.155 | 2.45 | +0.119 | +0.112 |
| all: **WITH gap** | IS | 61 | 48% | +0.427 | +26.1 | 4.8 | 1.97 | 1.57 | +0.454 | 1.67 | +0.401 | +0.398 |
| | OOS | 50 | 40% | +0.029 | +1.4 | 4.3 | 0.18 | 0.20 | +0.044 | 0.30 | +0.014 | +0.012 |
| all: WITHOUT gap | IS | 973 | 37% | +0.067 | +65.1 | 34.2 | 1.34 | 1.04 | +0.094 | 1.45 | +0.040 | +0.045 |
| | OOS | 633 | 39% | +0.138 | +87.5 | 19.0 | 2.19 | 2.07 | +0.157 | 2.35 | +0.120 | +0.113 |
| index: unfiltered | IS | 805 | 36% | +0.058 | +46.6 | 26.5 | 1.08 | 0.82 | +0.078 | 1.11 | +0.038 | +0.041 |
| | OOS | 506 | 38% | +0.117 | +59.3 | 26.9 | 1.70 | 1.43 | +0.133 | 1.63 | +0.101 | +0.095 |
| index: **WITH gap** | IS | 50 | 48% | +0.519 | +26.0 | 4.8 | 2.11 | 1.64 | +0.541 | 1.70 | +0.498 | +0.496 |
| | OOS | 44 | 39% | +0.040 | +1.8 | 4.4 | 0.23 | 0.24 | +0.054 | 0.33 | +0.026 | +0.026 |
| index: WITHOUT gap | IS | 760 | 35% | +0.035 | +26.4 | 33.5 | 0.63 | 0.48 | +0.055 | 0.77 | +0.014 | +0.018 |
| | OOS | 466 | 38% | +0.115 | +53.4 | 28.1 | 1.56 | 1.33 | +0.131 | 1.52 | +0.098 | +0.092 |

WITH minus WITHOUT: all five markets IS +0.361R (t 1.62), OOS −0.109R (t −0.63); index book IS +0.485R (t 1.92), OOS −0.075R
(t −0.39).

## By year (total net R, trades)

| stream | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| unfiltered | +37.5 (229) | +14.6 (260) | +36.1 (272) | −1.7 (267) | +25.1 (234) | +43.2 (237) | +24.7 (208) |
| WITH gap | +9.2 (17) | +2.1 (13) | +2.3 (17) | +12.5 (14) | −0.5 (15) | +3.2 (21) | −1.2 (14) |
| WITHOUT gap | +26.8 (214) | +13.2 (248) | +37.8 (256) | −12.6 (255) | +23.9 (221) | +40.0 (216) | +23.6 (196) |

The WITH-gap stream was positive every year of the in-sample window and then flat: −0.5R, +3.2R and −1.2R in 2024-26.

## Placebo

40 seeded random taggings (seed 20261114 + draw), each A-setup tagged WITH at its market's own share (NQ 8.1%, ES 7.8%, YM
5.5%, RTY 5.8%, GC 4.0%), run as T1. Out of sample, **25 of 40 draws reached the real month t (0.20) and the real R a trade**;
1 of 40 reached t 2. The real split is in the middle of what chance gives.

## By market (net R a trade, trades): unfiltered | WITH | WITHOUT

| market | IS | OOS |
|---|---|---|
| NQ | +0.151 (207) \| +0.918 (15) \| +0.123 (194) | +0.225 (121) \| +0.014 (13) \| +0.234 (109) |
| ES | 0.000 (197) \| +0.223 (14) \| −0.026 (185) | +0.181 (134) \| +0.120 (13) \| +0.170 (123) |
| YM | +0.156 (206) \| +0.869 (10) \| +0.119 (196) | +0.028 (120) \| +0.270 (9) \| +0.008 (111) |
| RTY | −0.085 (195) \| +0.034 (11) \| −0.088 (185) | +0.035 (131) \| −0.267 (9) \| +0.050 (123) |
| GC | +0.179 (223) \| +0.010 (11) \| +0.182 (213) | +0.195 (173) \| −0.052 (6) \| +0.204 (167) |

Every cell of the WITH stream has 6 to 15 trades: no market can be read alone.

## Reported, not judged

- **Inside the unfiltered stream's own trades** (the same trades, tagged): WITH gap +0.402R in sample (59, t 1.88), +0.085R out
  of sample (47, t 0.51); without +0.065R (969) and +0.141R (632, t 2.23). NWOG only: +0.335R (24) and +0.142R (20, t 0.48).
  NDOG only: +0.448R (35) and +0.070R (28, t 0.37). Neither kind holds up on its own.
- **Before costs** out of sample the WITH stream made +0.044R a trade (month t 0.30); costs are not what sinks it.

## What to conclude, and what not to

- **Do not add "the sweep ran into an open NWOG / NDOG" as a filter, a grade point or a size-up** on this mechanical H1 model.
  The in-sample lead (+0.36R a trade over the rest, t 1.62) did not repeat out of sample, and a random tag of the same size does
  as well as often as not.
- **It does not say gaps are bad levels.** With 50 trades out of sample the interval is wide; the WITH stream is simply not
  distinguishable from the rest of the A-setups.
- **It is a CFD test.** OANDA's weekend and daily opening gaps are not the CME futures' gaps (no roll, different reopen prints).
  A futures version would need the replay's own candle archive, which does not exist yet (see the ICT replay notes).
- **The baseline is not new evidence for the A-rule** (fitted on part of these years, as the rule book says, §19).
- With this study both of the "still untested" items `ict-equal-lows` named for the sweep's key level are done except the
  quarter of the month / year.

## Files

`PREREGISTRATION.md`, `gap.mjs` (the detector; pure but for `ict/calendar.mjs`), `run.mjs` (stages `fetch`, `count`, `full`;
candles cached outside git), `result.json`. Test: `tests/desk-ict-nwog.test.mjs` (not named `tests/ict-*`, like the equal-lows test: it checks research files and the Edge lab reader). To repeat:
`node --use-env-proxy research/edge/ict-nwog/run.mjs fetch <dir> && node research/edge/ict-nwog/run.mjs full <dir>`.
