# The research candle clock (corrected 10 Nov 2026)

Short version: the HistData candle files were being read on the wrong clock in a few weeks of every year. A
pre-registered audit settled the right rule, every loader now uses it, the seven edges' source studies were re-run, and
the Academy's data was regenerated. No trading rule, parameter, filter or cost was changed. Results moved a little, in
both directions. Nothing that was not an edge became one.

## 1. The rule

The HistData M1 files label each bar with a local time. To get UTC:

| Labels | Clock | Add to the label |
|---|---|---|
| 2019 to now | UTC−5, and UTC−4 while **Europe** is on summer time (last Sunday of March to last Sunday of October) | 5 h, or 4 h in Europe's summer |
| 2018 | New York wall-clock time (UTC−4 from the 2nd Sunday of March to the 1st Sunday of November) | 5 h, or 4 h in the US summer |

The converter is `council/histdata.mjs` (`histToUtc`, `histStampUtc`). It is a pure helper with no imports. Nothing that
trades reads it. `tests/histdata-clock.test.mjs` fails if any loader in `research/`, `academy/`, `ict/`, `council/`,
`scripts/`, `api/` or `ml/` converts a HistData label by itself.

What was wrong before:

- The gold-systems, robustness and NQ open-run loaders (the Academy's sources) read every year as New York time. From
  2019 that is one hour **early** in the weeks when the US is on daylight time and Europe is not: the 2nd Sunday of March
  to the last Sunday of March, and the last Sunday of October to the 1st Sunday of November. About four weeks a year.
- Most ICT studies used the documented "EST, no daylight saving" (label + 5 h all year). That is one hour **late** for
  the whole of Europe's summer, about seven months a year. See `research/edge/histdata-clock/RESULT.md` for those.

## 2. The evidence

The audit is `research/edge/histdata-clock/` (pre-registration written first, then the run). Four candidate rules were
scored by the same checks on 11 symbols, 2018 to October 2026:

| Check | What it compares | Result for the rule above |
|---|---|---|
| A. Release minutes | The largest one-minute bar against the official time of 329 CPI, payrolls and FOMC releases | 2,191 of 2,195 clear readings agree |
| B. A second feed | Hourly returns against OANDA H1, every week of every year, trial offsets 3 to 6 hours | 4,755 of 4,755 decisive weeks agree; 327 of 327 inside the mismatch weeks |
| C. The weekly reopen | Sunday's first bar as New York time | 4,798 of 5,060 weekends at the usual minute |
| D. Raw-file artefacts | The label gap across each clock-change weekend; repeated hours | 350 of 385 change weekends as predicted; one repeated (identical) hour on the last Sunday of October in every year from 2019, none in 2018 |

New York time for every year (the old reading) agrees in 30 of the 327 mismatch weeks: the 30 are 2018. The documented
"EST" agrees in no summer week.

For the two symbols the Academy uses:

| Symbol | Weeks 2018-26 | Readable | Decisive | Agree with the converter | Release minutes agree / clear |
|---|---|---|---|---|---|
| XAUUSD (six gold edges) | 461 | 438 | 437 | 437 | 205 / 205 |
| NSXUSD (nq-open) | 461 | 438 | 436 | 436 | 124 / 126 |

The Academy's own cross-check (`academy/gen/clock-check.mjs` → `academy/data/clock-check.json`) was run again on the
corrected clock: gold H1 against OANDA in 27 weeks, 18 of them mismatch weeks. **The clocks agree in every week** (it
found the studies one hour early in 16 of those weeks before). The session check in `academy/quality.mjs` now finds no
shifted week in either market (it found more than 20 in each before).

A third confirmation came for free: on the corrected clock the HistData NQ open-run trades agree with the OANDA ones on
more days (both feeds signal on 675 days, same side on 671; before: 648 and 640).

## 3. What stayed uncertified, and the flag

The audit's pass criteria are strict and were not loosened after the run. For the Academy's symbols these years miss at
least one criterion:

| Symbol | Year | Why | What the second feed says |
|---|---|---|---|
| XAUUSD | 2023 | The files have a hole from 20 Feb to 30 Jul 2023: 23 weeks cannot be read, so the year has 29 decisive weeks (30 needed) and one mismatch week (3 needed) | 29 of 29 agree |
| NSXUSD | 2023 | The same hole | 29 of 29 agree |
| NSXUSD | 2018 | One CPI minute misread by a clause of the pre-registration (14 of 15 releases agree; 95 % needed) | 52 of 52 agree |
| NSXUSD | 2020 | The same clause (7 of 8) | 53 of 53 agree |
| NSXUSD | 2024 | Two clock-change weekends disturbed (Easter Sunday, a late first bar) | 52 of 52 agree |

No check in any of these years points to a different rule. The converter uses the one rule for every year.

**The flag.** `rule.clockShift` is kept, with a new meaning: *the week of this setup could not be verified against the
second feed*. A setup is flagged when its Monday-to-Friday week (Sunday evening counts into the week it opens) is not a
decisive, agreeing week for its symbol in the audit (`result.json`, `B.read`). That is 24 weeks for gold and 25 for
NAS100: the 23 unreadable weeks of 2023 and one or two thin weeks (2 May 2022 for gold; 31 Mar and 11 Aug 2025 for
NAS100). Flagged setups stay out of replay lists, tests, training, evaluation and research, exactly as before. Their
times are converted with the same rule; they are not known to be wrong, they are not proven right.

Flagged setups: **187 before → 101 after** (replica 18, mosha-bo 4, gtrend 3, gtl 16, geg 10, gmp 34, nq-open 16).
The old flag marked setups whose time was known to be wrong. The new one marks setups whose week nobody could check.

The working pool uses every verified week, including verified weeks of the years in the table above. The "certified
years only" column below leaves those years out entirely, for anyone who wants the strictest reading.

## 4. Before → after, the seven edges

Net R a trade after costs. "Study" is every filled trade of the edge's source study, 2018 on: the numbers the generator
must reproduce exactly, and does. "Usable" is since 2020, not flagged, filled. Each cell: n, net R a trade, total R, t.

| Edge | Study (before) | Study (after) | Usable (before) | Usable (after) | Certified years only (after) | Usable train / exam (before) | (after) |
|---|---|---|---|---|---|---|---|
| replica | 391, +0.479, +187.5, 2.71 | 394, +0.462, +182.0, 2.66 | 353, +0.550, +194.2, 2.90 | 375, +0.524, +196.3, 2.90 | 371, +0.535, +198.5, 2.93 | 303 / 50 | 325 / 50 |
| mosha-bo | 64, +0.531, +34.0, 1.91 | 64, +0.531, +34.0, 1.91 | 39, +0.739, +28.8, 1.97 | 45, +0.491, +22.1, 1.53 | 43, +0.546, +23.5, 1.64 | 34 / 11 | 33 / 18 |
| gtrend | 41, +1.609, +66.0, 2.56 | 41, +1.609, +66.0, 2.56 | 31, +1.482, +45.9, 1.91 | 31, +1.556, +48.2, 2.02 | 29, +1.724, +50.0, 2.12 | 19 / 12 | 18 / 13 |
| gtl | 314, +0.141, +44.2, 2.03 | 315, +0.159, +50.1, 2.24 | 226, +0.169, +38.3, 2.06 | 226, +0.179, +40.4, 2.11 | 208, +0.198, +41.2, 2.22 | 165 / 61 | 166 / 60 |
| geg | 174, +0.294, +51.1, 2.12 | 175, +0.304, +53.2, 2.21 | 129, +0.336, +43.4, 2.05 | 130, +0.380, +49.3, 2.30 | 119, +0.417, +49.6, 2.39 | 115 / 59 | 113 / 64 |
| gmp | 1,003, +0.041, +41.1, 1.01 | 1,004, +0.043, +43.2, 1.06 | 705, +0.094, +66.3, 1.92 | 726, +0.099, +72.2, 2.07 | 669, +0.092, +61.8, 1.83 | 494 / 211 | 513 / 213 |
| nq-open | 721, +0.126, +90.7, 2.26 | 724, +0.115, +83.0, 2.06 | 524, +0.135, +70.6, 2.01 | 545, +0.139, +75.8, 2.12 | 326, +0.167, +54.3, 1.94 | 327 / 197 | 344 / 201 |
| all | | | | | | 1,457 / 601 | 1,512 / 619 |

Read it plainly:

- The study totals moved by a few trades and a few hundredths of an R. Replica and nq-open are a little lower, gtl, geg
  and gmp a little higher, mosha-bo and gtrend unchanged.
- The usable pool grew by 73 setups (55 train, 18 exam), because fewer setups are flagged.
- mosha-bo's usable average fell from +0.739 to +0.491 (n 39 → 45). The study's own trades did not change; six trades
  that used to be flagged are back in, and they were poor ones. With 45 trades this edge cannot be judged either way.
- A t of 2 on one edge out of seven is not proof of an edge. These are the same systems with the same doubts as before.

Counts in the "usable train / exam" columns include orders that never filled; the statistics do not.

By year (filled trades: n, total net R), from `node academy/gen/clock-compare.mjs`:

| Edge | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|
| replica before | 0 | 1, -1.7 | 69, +37.5 | 5, +2.6 | 62, +20.7 | 22, -14.8 | 72, +79.1 | 89, +59.3 | 71, +4.8 |
| replica after | 0 | 1, -1.7 | 69, +37.5 | 5, +2.5 | 61, +21.0 | 22, -14.8 | 72, +79.1 | 91, +56.1 | 73, +2.3 |
| mosha-bo before | 12, -6.9 | 3, +12.2 | 11, +9.9 | 3, +2.4 | 11, -0.3 | 6, +5.3 | 5, +11.2 | 9, +0.4 | 4, +0.0 |
| mosha-bo after | 12, -6.9 | 3, +12.2 | 11, +9.9 | 3, +2.4 | 11, -0.3 | 6, +5.3 | 5, +11.2 | 9, +0.4 | 4, +0.0 |
| gtrend before | 3, +5.3 | 4, +12.7 | 6, +3.7 | 3, +1.3 | 5, +6.7 | 5, -2.1 | 5, +8.6 | 7, +23.1 | 3, +6.6 |
| gtrend after | 3, +5.3 | 4, +12.7 | 6, +3.7 | 3, +1.4 | 5, +6.6 | 5, -2.1 | 5, +8.6 | 7, +23.1 | 3, +6.6 |
| gtl before | 30, +4.3 | 42, +1.8 | 36, +2.7 | 37, +3.2 | 31, -5.8 | 34, +3.3 | 36, +12.8 | 36, +25.9 | 32, -3.9 |
| gtl after | 30, +4.3 | 43, +1.2 | 35, +2.9 | 38, +2.1 | 31, -5.9 | 33, +3.4 | 36, +18.6 | 36, +28.2 | 33, -4.7 |
| geg before | 16, -2.4 | 22, +5.3 | 23, +11.5 | 16, +12.4 | 17, -4.1 | 16, -1.4 | 24, +11.7 | 28, +21.7 | 12, -3.7 |
| geg after | 16, -2.4 | 21, +6.4 | 23, +11.5 | 16, +12.3 | 17, -4.1 | 19, -0.4 | 24, +11.7 | 28, +20.9 | 11, -2.7 |
| gmp before | 131, -9.4 | 112, -19.8 | 132, -2.9 | 125, +8.9 | 133, -4.2 | 87, +12.0 | 126, +22.2 | 91, +30.6 | 66, +3.6 |
| gmp after | 131, -9.4 | 113, -20.8 | 132, -1.9 | 126, +7.9 | 132, -3.2 | 87, +12.0 | 126, +21.1 | 90, +30.5 | 67, +6.9 |
| nq-open before | 95, +10.1 | 69, +3.4 | 93, -7.1 | 84, -1.6 | 94, +3.9 | 67, +1.9 | 76, +21.9 | 70, +19.6 | 73, +38.5 |
| nq-open after | 95, +10.1 | 68, +0.0 | 96, -6.1 | 86, -4.4 | 98, +3.0 | 63, +2.5 | 75, +23.2 | 72, +23.2 | 71, +31.5 |

2018 is identical for every edge, as it should be: the 2018 files were on New York time, which the old loaders assumed.

## 5. Before → after, the Academy's own measurements

Decision policy against taking every setup (train pool, not flagged, no lessons):

| Edge | Every setup: n, R, t (before) | (after) | TAKE minus WAIT, Welch t (before) | (after) |
|---|---|---|---|---|
| replica | 303, +0.428, 2.34 | 325, +0.406, 2.34 | −1.21 | −1.53 |
| mosha-bo | 29, +0.971, 2.08 | 28, +0.815, 1.79 | 0.27 | 1.01 |
| gtrend | 19, +1.730, 1.54 | 18, +1.885, 1.60 | n/a | n/a |
| gtl | 165, +0.232, 2.28 | 166, +0.216, 2.13 | 1.20 | 1.33 |
| geg | 84, +0.405, 1.81 | 82, +0.469, 2.05 | 0.41 | −0.03 |
| gmp | 494, +0.062, 1.09 | 513, +0.075, 1.35 | −0.80 | −1.17 |
| nq-open | 327, +0.185, 2.10 | 344, +0.204, 2.39 | 1.79 | 1.84 |
| all | 1,421, +0.249, 4.57 | 1,476, +0.252, 4.74 | 1.17 | 0.82 |

The verdict is the same for every edge and for the book: no measurable difference. The policy does not yet add value.

Research engine (pre-registered, unchanged): 130 conditions tested (121 before); 5 passed discovery against about 6.2
expected by chance (7 against 5.8 before); **0 validated, 0 out-of-sample** (before: 0 validated, 1 out-of-sample only).
The one out-of-sample condition of the old run (gtl, lower-timeframe structure neutral, t 2.10 twice) does not pass
discovery on the corrected clock, so no draft lesson is offered now.

Trained scorers (pre-registered, unchanged), out of fold:

| Scope | AUC (before) | (after) | Kept minus skipped, t (before) | (after) | Verdict |
|---|---|---|---|---|---|
| replica | 0.561 | 0.547 | none (1 skipped) | −1.33 | rejected challenger |
| gtl | 0.516 | 0.456 | 0.29 | −2.30 | rejected challenger |
| gmp | 0.511 | 0.489 | −0.12 | 0.13 | rejected challenger |
| nq-open | 0.563 | 0.579 | 1.29 | 1.31 | rejected challenger |
| pooled | 0.602 (0.545 within edge) | 0.587 (0.534 within edge) | −0.99 | −1.84 | rejected challenger |

No scorer beats taking every setup, before or after. Nothing is promoted. mosha-bo, gtrend and geg have too few trades
to fit. `node ml/parity.mjs` passes (largest difference 5e-7).

## 6. What did not change

- No rule, parameter, filter or cost of any edge. The only code change in the source studies is the line that turns a
  label into UTC, and what follows from it mechanically (which bucket a bar falls in, which bar is the 09:30 one).
- The pre-registrations inside `academy/gen/research.mjs` and `ml/train.py`.
- The pool split (`poolOf`, whole months). A setup that moved by an hour stays in its month's pool.
- The candle files. They are byte-identical to the ones used before (47 files compared).
- The page audit's fixture window (26 Apr to 17 May 2024): its 13 gmp setups, outcomes and features are identical before
  and after, so no audit expectation changed.

Edge versions changed, because `council/histdata.mjs` is now part of every edge's `ruleSource`: a change to the clock
rule changes the version and forces a regeneration.

## 7. Where the old state is

- `academy/archive/pre-clock/data/`: every file of `academy/data/` as generated on the old clock.
- `academy/archive/pre-clock/ml-models/`: `index.json` and `report.md` of the old training run.
- Git commit `81f35f51`: the whole repository before this work, every study file included.

The archive is outside `academy/data/`, so it is not shipped with the API. Two tests read the old research file to keep
exercising the draft-lesson code, since the corrected run offers no draft.

## 8. How to reproduce

```sh
git fetch origin council-data
mkdir -p /tmp/cd && git archive origin/council-data research ict | tar -x -C /tmp/cd      # outside the repo

# the audit (180 calls to the candle proxy, cached)
node --use-env-proxy research/edge/histdata-clock/fetch.mjs /tmp/clock-oanda
node research/edge/histdata-clock/run.mjs /tmp/cd/research/candles /tmp/clock-oanda

# the source studies
export GOLD_DIR=/tmp/cd/research/candles/xau-histdata GOLD_CACHE=/tmp/gs/xau_m1.bin OUT_DIR=/tmp/gs
node research/edge/gold-systems/daily.mjs && node research/edge/gold-systems/mosha.mjs && node research/edge/gold-systems/replica.mjs
node research/edge/gold-systems/summarize.mjs > research/edge/gold-systems/result.json   # after copying the three outputs in
ROB_DATA=/tmp/cd node research/edge/robustness/systems.mjs                               # writes out/gmp.json and the rest
node research/edge/nq-open-oos/run.mjs <OANDA cache> /tmp/cd/research/candles/nsxusd-histdata /tmp/cd/research/replay-2w.json

# the Academy
export ACADEMY_CANDLES=/tmp/cd
node academy/gen/run.mjs --versions            # pin them in academy/edges.mjs if a rule file changed
node academy/gen/run.mjs && node --use-env-proxy academy/gen/clock-check.mjs && node academy/gen/run.mjs
node academy/gen/calendar.mjs && node academy/gen/features.mjs && node academy/gen/evaluate.mjs && node academy/gen/research.mjs
python3 ml/train.py --edge all && node ml/parity.mjs
node academy/gen/clock-compare.mjs             # the tables of section 4
```

Delete any `*-m1.bin` and `xau_m1.bin` cache made before 10 Nov 2026 first: they hold the old times.
