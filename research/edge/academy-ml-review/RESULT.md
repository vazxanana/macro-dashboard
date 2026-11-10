# Academy scorer: training review (10 Nov 2026)

**Verdict: No scorer passes: all 20 (the reference and the four pre-registered challenger configurations) are rejected challengers; none is promoted. The best kept-minus-skipped t out of fold is 0.95 (nq-open · mono-gbt, n 206); the smallest Holm-corrected p of a scorer's own test is 1.0. Three edges are too small to support a trained scorer.**

Paper research on the Academy's offline scorers (`ml/`). Pre-registration: `PREREGISTRATION.md`, committed before any new training run.
Train pool only. Exam reads by this review: **0**. Nothing is promoted and nothing here changes the decision engine, a rule or a trade.

- 20 scorers were walked forward: the reference (C0) on 5 scopes and four pre-registered challenger configurations (C1 to C4) on 15. **0 pass, 20 are rejected, 0 promoted.**
- Best kept-minus-skipped t of a scorer's own test: **0.95** (nq-open · mono-gbt). 12 of 20 scorers have a negative t; 2 are at or below -2 (the kept trades did worse than the skipped ones).
- Smallest Holm-corrected p of a scorer's own test: 1.0000 over 42 tests (the line is 0.02275).
- Too small to support any trained scorer: mosha-bo (n 28), gtrend (n 18), geg (n 82).
- Two defects of the first trainer's validation were found and fixed, and one hazard removed (below). None of them hid a working scorer: the reference scorer is rejected before and after.

## The scorers (out of fold)

Kept and skipped are net R a trade. t = Welch, kept minus skipped (pooled scorers: on net R with each edge's training mean removed). p is one-sided; Holm over the 42 tests of the run.

| Scorer | Train n | Out-of-fold n | AUC out (in fold) | Brier | Prior Brier | Kept n | Kept R | Skipped n | Skipped R | t | p | Holm p | Max DD kept / all (R) | Lines failed | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| replica | 325 | 195 | 0.548 (0.941) | 0.1833 | 0.1838 | 176 | +0.054 | 19 | +2.248 | -1.79 | 0.955 | 1.000 | 21.6 / 21.6 | 1, 2, 5 | rejected challenger |
| gtl | 166 | 100 | 0.456 (0.880) | 0.2647 | 0.2560 | 55 | +0.147 | 45 | +0.430 | -1.03 | 0.847 | 1.000 | 10.4 / 10.4 | 1, 2, 4, 5 | rejected challenger |
| gmp | 513 | 308 | 0.478 (0.845) | 0.2578 | 0.2489 | 256 | +0.134 | 52 | +0.048 | 0.45 | 0.328 | 1.000 | 8.8 / 8.4 | 1, 3, 4, 5 | rejected challenger |
| nq-open | 344 | 206 | 0.586 (0.873) | 0.2545 | 0.2624 | 182 | +0.391 | 24 | +0.238 | 0.47 | 0.322 | 1.000 | 8.6 / 8.6 | 1, 5 | rejected challenger |
| pooled | 1476 | 886 | 0.587 (0.738) | 0.2370 | 0.2422 | 693 | +0.381 | 193 | +0.383 | -1.53 | 0.937 | 1.000 | 22.0 / 31.0 | 1, 2, 5 | rejected challenger |
| replica · logit-short | 325 | 195 | 0.558 (0.637) | 0.1834 | 0.1838 | 144 | +0.287 | 51 | +0.212 | 0.20 | 0.420 | 1.000 | 21.3 / 21.6 | 1, 5 | rejected challenger |
| gtl · logit-short | 166 | 100 | 0.500 (0.624) | 0.2583 | 0.2560 | 84 | +0.245 | 16 | +0.426 | -0.48 | 0.682 | 1.000 | 10.4 / 10.4 | 1, 2, 4, 5 | rejected challenger |
| gmp · logit-short | 513 | 308 | 0.426 (0.555) | 0.2569 | 0.2489 | 267 | +0.078 | 41 | +0.388 | -1.50 | 0.930 | 1.000 | 7.9 / 8.4 | 1, 2, 4, 5 | rejected challenger |
| nq-open · logit-short | 344 | 206 | 0.525 (0.605) | 0.2627 | 0.2624 | 179 | +0.396 | 27 | +0.221 | 0.58 | 0.281 | 1.000 | 8.6 / 8.6 | 1, 4, 5 | rejected challenger |
| replica · mono-gbt | 325 | 195 | 0.534 (0.635) | 0.1832 | 0.1838 | 161 | -0.058 | 34 | +1.809 | -2.35 | 0.988 | 1.000 | 30.8 / 21.6 | 1, 2, 3, 5 | rejected challenger |
| gtl · mono-gbt | 166 | 100 | 0.477 (0.660) | 0.2573 | 0.2560 | 88 | +0.177 | 12 | +0.988 | -2.05 | 0.970 | 1.000 | 10.4 / 10.4 | 1, 2, 4, 5 | rejected challenger |
| gmp · mono-gbt | 513 | 308 | 0.494 (0.606) | 0.2511 | 0.2489 | 242 | +0.127 | 66 | +0.091 | 0.22 | 0.415 | 1.000 | 7.8 / 8.4 | 1, 4, 5 | rejected challenger |
| nq-open · mono-gbt | 344 | 206 | 0.508 (0.642) | 0.2629 | 0.2624 | 178 | +0.416 | 28 | +0.098 | 0.95 | 0.173 | 1.000 | 8.6 / 8.6 | 1, 4, 5 | rejected challenger |
| pooled · mono-gbt | 1476 | 886 | 0.582 (0.621) | 0.2344 | 0.2422 | 815 | +0.396 | 71 | +0.212 | -0.79 | 0.785 | 1.000 | 22.0 / 31.0 | 1, 5 | rejected challenger |
| pooled · pooled-logit | 1476 | 886 | 0.590 (0.614) | 0.2381 | 0.2422 | 828 | +0.395 | 58 | +0.186 | -0.79 | 0.782 | 1.000 | 22.0 / 31.0 | 1, 5 | rejected challenger |
| replica · ridge-netR | 325 | 195 | 0.538 (0.591) | n/a | n/a | 164 | +0.174 | 31 | +0.760 | -0.96 | 0.828 | 1.000 | 21.6 / 21.6 | 1, 2, 4, 5 | rejected challenger |
| gtl · ridge-netR | 166 | 100 | 0.467 (0.575) | n/a | n/a | 62 | +0.300 | 38 | +0.233 | 0.26 | 0.399 | 1.000 | 10.4 / 10.4 | 1, 5 | rejected challenger |
| gmp · ridge-netR | 513 | 308 | 0.462 (0.551) | n/a | n/a | 273 | +0.090 | 35 | +0.345 | -1.18 | 0.877 | 1.000 | 7.8 / 8.4 | 1, 2, 4, 5 | rejected challenger |
| nq-open · ridge-netR | 344 | 206 | 0.508 (0.582) | n/a | n/a | 198 | +0.387 | 8 | +0.026 | 0.81 | 0.221 | 1.000 | 8.6 / 8.6 | 1, 4, 5 | rejected challenger |
| pooled · ridge-netR | 1476 | 886 | 0.476 (0.514) | n/a | n/a | 850 | +0.371 | 36 | +0.633 | -1.29 | 0.897 | 1.000 | 22.9 / 31.0 | 1, 2, 4, 5 | rejected challenger |

The ridge scorers (C4) predict net R: they have no probability and no Brier score. Their line 4 is mean squared error against predicting the training mean.
Not fitted in any configuration: mosha-bo, gtrend, geg. They are scored only inside the pooled scorers.

### What the short-list fits lean on (in sample: a description, not a test)

The short list is the decision policy's five side-relative factors (`biasAlign`, `ltfAlign`, `momFor`, `locFor`, `confirm`) and two state numbers (`stopAtr`, `atrPctile`). The stumps (C2) may only use a policy factor in the direction the policy states.

- Constrained stumps: **66 of their 300 splits are on a policy factor**, the other 234 on the two state numbers (and, for the pooled one, the edge id). replica · mono-gbt: `atrPctile` 44, `locFor` 13, `stopAtr` 3; gtl · mono-gbt: `atrPctile` 18, `confirm` 15, `stopAtr` 13, `momFor` 8, `biasAlign` 6; gmp · mono-gbt: `stopAtr` 48, `atrPctile` 12; nq-open · mono-gbt: `atrPctile` 33, `ltfAlign` 16, `stopAtr` 8, `confirm` 3; pooled · mono-gbt: `edge` 34, `stopAtr` 19, `ltfAlign` 5, `atrPctile` 2.
- Logistic fits (C1, C3): of the 25 policy-factor weights, 12 are positive (the policy's direction) and 13 negative. replica · logit-short: against the policy on `biasAlign`, `ltfAlign`, `momFor`, `confirm`; gtl · logit-short: against the policy on `ltfAlign`, `locFor`; gmp · logit-short: against the policy on `biasAlign`, `ltfAlign`, `locFor`; nq-open · logit-short: against the policy on `biasAlign`, `locFor`; pooled · pooled-logit: against the policy on `biasAlign`, `locFor`.
- Read with care: these are in-sample fits on a few hundred trades. What they do say is that the training data gives the policy's stated directions no clear support; that agrees with `academy/data/eval.json`, where the policy's TAKE and WAIT trades do not differ (+0.093 R a trade, t 0.82, n 1476).

## Power: what these samples can show

MDE = the smallest kept-minus-skipped difference (net R a trade) that reaches t = 2 with the edge's own SD: 2 x SD x sqrt(1/kept + 1/skipped). Events per input = trades of the smaller class divided by the number of inputs.

| Edge | Usable train n | Out-of-fold n | Win rate | Mean net R (t) | SD net R | MDE, even split | MDE, 80 / 20 split | Events per input, 7 inputs: all / first window | 70 inputs: all / first window | Can it support a scorer? |
|---|---|---|---|---|---|---|---|---|---|---|
| replica | 325 | 195 | 0.24 | +0.406 (2.34) | 3.13 | 0.90 R | 1.12 R | 11.1 / 4.4 | 1.1 / 0.4 | marginal: 7 inputs pass on all trades, not in the first window |
| mosha-bo | 28 | none (not fitted) | 0.43 | +0.815 (1.79) | 2.40 | 1.82 R | 2.27 R | 1.7 / 0.7 | 0.2 / 0.1 | no: under 10 events per input even with 7 inputs |
| gtrend | 18 | none (not fitted) | 0.50 | +1.885 (1.60) | 4.99 | 4.70 R | 5.88 R | 1.3 / 0.4 | 0.1 / 0.0 | no: under 10 events per input even with 7 inputs |
| gtl | 166 | 100 | 0.51 | +0.216 (2.13) | 1.30 | 0.52 R | 0.65 R | 11.6 / 4.6 | 1.2 / 0.5 | marginal: 7 inputs pass on all trades, not in the first window |
| geg | 82 | none (not fitted) | 0.45 | +0.469 (2.05) | 2.07 | 0.92 R | 1.14 R | 5.3 / 2.3 | 0.5 / 0.2 | no: under 10 events per input even with 7 inputs |
| gmp | 513 | 308 | 0.45 | +0.075 (1.35) | 1.26 | 0.29 R | 0.36 R | 33.1 / 13.0 | 3.3 / 1.3 | 7 inputs, yes; 70, no |
| nq-open | 344 | 206 | 0.43 | +0.204 (2.39) | 1.59 | 0.44 R | 0.55 R | 21.3 / 6.7 | 2.1 / 0.7 | marginal: 7 inputs pass on all trades, not in the first window |
| pooled | 1476 | 886 | 0.41 | +0.252 (4.74) | 2.04 | 0.27 R | 0.34 R | n/a | n/a | the pooled scorers' sample |

For an edge that is not fitted the MDE is computed on all of its trades, as if none were needed for fitting; its real figure is worse.
Read the MDE against the edge's own mean: a scorer on replica would have to separate kept from skipped by 0.90 R a trade to be seen, more than twice the edge's whole expectancy (+0.41 R). On gmp the bar is 0.29 R against an expectancy of +0.07 R.
**mosha-bo, gtrend, geg cannot support a trained scorer at all.** The four fitted edges can carry a handful of inputs at most; the 70-input reference has under 4 events per input on every edge and under 1.5 in its first training window.

## Audit

### 1. Features

- 71 inputs (70 features plus the edge id for pooled scorers). **Known at the decision time: 71 of 71.** Traced in assets/academy-core.js build(): every value is computed from snapshot.bars (closed bars only), snapshot.t and the candidate's side / entry / stop / target; outcomes are joined to the matrix afterwards as label columns.
- By source: 3 from the signal time t itself; 10 from the candidate's entry, stop and target (fixed by the rule at t) against bars that had closed at t; 9 from the candidate's side against bars that had closed at t; 48 from bars that had closed at t (MXR.snapshot keeps a bar only when bar.time + tfSec <= t); 1 from the id of the edge that fired (pooled scorers only).
- One caveat, not a bug: the entry of a market order is the price it is filled at. For gmp that is the open of the first M1 bar after t, one tick after the decision time; the features that use the entry (rr, stopAtr, targetAtr, entryOffset, geomOk, entryLoc, entryZone, locFor, oppLiq, oppLiqFrac) carry that tick. On gmp (n 513) the median gap is 0.008 ATR and 0.6 % of rows are above 0.1 ATR, none above 0.25. Too small to matter; no feature definition was changed.
- Missing values: 16 inputs have some; above 5 % of rows: `structM15`, `distEqHigh`, `distEqLow`, `sweepAge`, `sweepOf`, `sweepDepth`, `dispAge`, `dispSize`, `fvgSize` (a level, sweep, displacement or gap that does not exist at that moment, and the M15 structure of the edges that carry no M15 series).
- Constant or near-constant (one value on 95 % of rows or more): `geomOk`.
- Drift: **35 of 71 inputs** move by |SMD| of 0.25 or more between the first and the second half of some scope's train rows. Largest: `side` on replica (SMD +1.54, KS 0.55); `consec` on replica (SMD +1.07, KS 0.55); `atrPct` on replica (SMD +0.91, KS 0.53); `momentum` on replica (SMD +0.91, KS 0.36); `dispAge` on gtl (SMD +0.90, KS 0.39). The replica's `side` is the plainest case: the edge sold in one half and bought in the other, so anything fitted on the first half meets a different population.
- Redundancy (|Spearman| above 0.9): `stopAtr` / `targetAtr` (+1.00); `roc` / `momentum` (+0.94); `session` / `hourUtc` (+0.94); `entryLoc` / `entryZone` (+0.93); `htfScore` / `htfBias` (+0.93); `atrPctile` / `volState` (+0.91). Each pair carries one piece of information twice.

### 2. Labels

- Win = 1 when the position's net R (after the round-trip cost) is above 0, else 0; the ridge configuration fits net R itself.
- Net R is the whole position as the study books it: the first unit plus its pyramid add (replica, mosha-bo, gtrend), with the rule's size where the rule sizes.
- An order that never filled (missed, expired, cancelled) has no label and is in no training row, no metric and no average. A time exit is labelled like any other exit: by the sign of its net R.
- **After the exit:** the recorded exit time is the first unit's. An add leg is managed on its own and can close later, up to the first unit's deadline, so the label of a position with an add can depend on prices after the recorded exit. This is defect 1 below.
- Training on filled orders only conditions on something not known at the signal time for the two limit-order edges (mosha-bo, geg): the scorer then estimates P(win | the order fills).
- Trades of one edge that are open together share the same market move: a Welch t treats them as independent, so it overstates the evidence where openedWhileAnotherWasOpenShare is high.
- Win rates run from 0.24 (replica) to 0.51 (gtl). No class weights are used: the AUC and the kept-minus-skipped test do not depend on the balance, and probabilities are judged against the prior rate.

| Edge | Orders | Never filled | Usable trades | Wins / losses (win rate) | Net R: mean, SD, median | Time exits (won) | With an add | Opened while another was open | Longest hold (h) | Embargo (h) |
|---|---|---|---|---|---|---|---|---|---|---|
| replica | 325 | 0 | 325 | 78 / 247 (0.24) | +0.41, 3.13, -0.52 | 31 (81 %) | 135 (42 %) | 120 (37 %) | 91 | 163 |
| mosha-bo | 33 | 5 | 28 | 12 / 16 (0.43) | +0.81, 2.40, -0.74 | 8 (75 %) | 11 (39 %) | 8 (29 %) | 125 | 197 |
| gtrend | 18 | 0 | 18 | 9 / 9 (0.50) | +1.88, 4.99, -0.02 | 0 (n/a) | 11 (61 %) | 0 (0 %) | 1263 | 1335 |
| gtl | 166 | 0 | 166 | 85 / 81 (0.51) | +0.22, 1.30, +0.07 | 82 (72 %) | 0 (0 %) | 0 (0 %) | 154 | 226 |
| geg | 113 | 31 | 82 | 37 / 45 (0.45) | +0.47, 2.07, -1.00 | 20 (90 %) | 0 (0 %) | 22 (27 %) | 502 | 792 |
| gmp | 513 | 0 | 513 | 232 / 281 (0.45) | +0.07, 1.26, -0.27 | 203 (68 %) | 0 (0 %) | 0 (0 %) | 79 | 151 |
| nq-open | 344 | 0 | 344 | 149 / 195 (0.43) | +0.20, 1.59, -1.01 | 77 (84 %) | 0 (0 %) | 0 (0 %) | 1 | 74 |

4 trades are a gross win and a net loss: the cost decides the label in those, and only in those. Orders are counted in the train pool, not flagged; 'usable' also needs every timeframe present.

### 3. Leakage

**(a) Shuffled labels.** Win and net R shuffled together inside each edge, every scorer re-run walk-forward, 20 seeds: 400 walk-forward runs, mean AUC **0.500** (SD 0.055, range 0.357 to 0.636). Of 329 kept-minus-skipped tests, 1.5 % reach t >= 2 (chance: 2.3 %) and 4.9 % reach |t| >= 2 (chance: 4.6 %); mean t -0.34. The metric collapses to chance, as it must.
The SD is the useful number: on shuffled labels a single run's AUC ranges from 0.357 to 0.636. Every real AUC in the table above (0.426 to 0.590) lies inside that range.

**(b) A canary.** Scratch runs with one leaking column added: canaryNetR = the trade's net R plus unit normal noise; canaryHoldHours = hours from the signal to the exit. With the net-R canary the walk-forward AUC goes from 0.518 to **0.911** (lowest 0.854) and the kept-minus-skipped t to **11.4** on average (lowest 6.8): the pipeline sees a leak when there is one. The holding-time canary, a weaker leak, lifts the AUC to 0.600-0.809.

Single-feature AUC, in sample, whichever way the feature points (so 0.5 is the floor):

| Scope | n | Best real feature | Its AUC | Largest single-feature AUC on shuffled labels: median, 95th pct | Real features above that 95th pct | Net-R canary | Holding-time canary |
|---|---|---|---|---|---|---|---|
| replica | 325 | `distEqLow` | 0.655 | 0.600, 0.673 | none | 0.967 | 0.827 |
| gtl | 166 | `dispSize` | 0.707 | 0.633, 0.712 | none | 0.901 | 0.769 |
| gmp | 513 | `distSup` | 0.548 | 0.573, 0.628 | none | 0.886 | 0.770 |
| nq-open | 344 | `consec` | 0.593 | 0.587, 0.639 | none | 0.954 | 0.783 |
| pooled | 1476 | `distEqLow` | 0.559 | 0.542, 0.566 | none | 0.923 | 0.659 |

No real feature behaves like a canary. The net-R canary scores 0.886 to 0.967 and the holding-time canary 0.659 to 0.827; the best real feature is 0.707 (`dispSize` on gtl, where shuffled labels alone reach 0.712 at the 95th percentile). None is above what the best of 70 features reaches on shuffled labels.

**(c) Fold boundaries.** Counted at every test-block start, summed over blocks:

| Scope | Blocks | No embargo: label may still be open | First trainer's rule (first-unit exit + 1 day): add leg may still be open | New embargo: still open | Rows the new embargo holds back | Threshold chosen on trades possibly open (old) | (new) |
|---|---|---|---|---|---|---|---|
| replica | 4 | 6 | 5 | 0 | 20 | 5 | 0 |
| gtl | 3 | 0 | 0 | 0 | 1 | 0 | 0 |
| gmp | 4 | 0 | 0 | 0 | 4 | 0 | 0 |
| nq-open | 4 | 0 | 0 | 0 | 1 | 0 | 0 |
| pooled | 4 | 1 | 0 | 0 | 23 | 1 | 0 |

Totals: **7** without an embargo, **5** under the first trainer's rule, **0 with the embargo**; the keep-threshold was chosen on **6** trades that could still be open under the old rule and on **0** now.

**(d) Exam ids.** 733 candidates are outside the train pool; the loader dropped 733 rows. Ids in the 20 fitted matrices (1476 distinct): **0 exam ids**. The trainer was then run on a matrix in which every label and every feature of those 733 rows was overwritten with noise: all 22 output files are byte-identical (and identical to the committed `ml/models`).

### 4. Sample size and power

The table is above. In one line: the smallest difference these samples can see is 0.29 to 0.90 R a trade on the fitted edges, against edge expectancies of +0.07 to +0.41 R. A scorer would have to roughly double an edge to be detected.

### 5. Overfitting

- In-fold AUC minus out-of-fold AUC, mean by configuration: gbt +0.324; logit-short +0.103; mono-gbt +0.114; pooled-logit +0.024; ridge-netR +0.072. The 70-input reference fits its training rows at an AUC of 0.738 to 0.941 and scores 0.456 to 0.587 out of fold: it memorises. The short-list configurations overfit less and are no better out of fold.
- Seeds (the reference scorer (the only configuration that samples rows and columns), seeds [1, 7, 13, 29, 101]): replica t -1.89 to -1.41, AUC 0.548 to 0.578; gtl t -2.08 to 0.64, AUC 0.455 to 0.466; gmp t 0.28 to 0.52, AUC 0.474 to 0.503; nq-open t 0.47 to 1.63, AUC 0.578 to 0.592; pooled t -1.91 to -1.02, AUC 0.583 to 0.588. The verdict t of one scope moves by up to 2.72 with nothing changed but the seed.
- Fold count (every scorer with [3, 4, 5, 6] test blocks): the t changes sign for **6 of 20** scorers, and **0** reach t >= 2 with any fold count. A result that flips with the number of blocks is noise.

### 6. Calibration

Out of fold, the scorer's own probability against the prior rate (for a pooled scorer: the prior rate of each trade's own edge, since a pooled scorer otherwise gets credit for knowing that replica wins 24 % of the time and gtl 51 %). Brier minus prior below 0 is better; interval = bootstrap over trades.

| Scorer | n | Brier | Prior | Difference (95 % interval) | Expected calibration error | Predicted p, 10th to 90th pct | Win rate rises bin by bin? |
|---|---|---|---|---|---|---|---|
| replica | 195 | 0.1833 | 0.1838 | -0.0005 (-0.0081 to +0.0070) | 0.032 | 0.15 to 0.32 | no |
| gtl | 100 | 0.2647 | 0.2560 | +0.0087 (-0.0077 to +0.0258) | 0.102 | 0.41 to 0.62 | no |
| gmp | 308 | 0.2578 | 0.2489 | +0.0089 (-0.0002 to +0.0182) | 0.105 | 0.33 to 0.55 | no |
| nq-open | 206 | 0.2545 | 0.2624 | -0.0079 (-0.0207 to +0.0049) | 0.098 | 0.30 to 0.52 | no |
| pooled | 886 | 0.2370 | 0.2380 | -0.0010 (-0.0076 to +0.0051) | 0.024 | 0.28 to 0.52 | yes |
| replica · logit-short | 195 | 0.1834 | 0.1838 | -0.0004 (-0.0080 to +0.0074) | 0.019 | 0.16 to 0.32 | yes |
| gtl · logit-short | 100 | 0.2583 | 0.2560 | +0.0023 (-0.0145 to +0.0183) | 0.092 | 0.41 to 0.63 | no |
| gmp · logit-short | 308 | 0.2569 | 0.2489 | +0.0080 (+0.0029 to +0.0135) | 0.089 | 0.38 to 0.50 | no |
| nq-open · logit-short | 206 | 0.2627 | 0.2624 | +0.0003 (-0.0100 to +0.0102) | 0.119 | 0.31 to 0.50 | no |
| replica · mono-gbt | 195 | 0.1832 | 0.1838 | -0.0006 (-0.0046 to +0.0033) | 0.043 | 0.19 to 0.28 | no |
| gtl · mono-gbt | 100 | 0.2573 | 0.2560 | +0.0013 (-0.0122 to +0.0132) | 0.075 | 0.44 to 0.62 | no |
| gmp · mono-gbt | 308 | 0.2511 | 0.2489 | +0.0021 (-0.0020 to +0.0062) | 0.047 | 0.41 to 0.49 | no |
| nq-open · mono-gbt | 206 | 0.2629 | 0.2624 | +0.0005 (-0.0045 to +0.0057) | 0.110 | 0.33 to 0.45 | no |
| pooled · mono-gbt | 886 | 0.2344 | 0.2380 | -0.0037 (-0.0080 to +0.0006) | 0.032 | 0.26 to 0.46 | no |
| pooled · pooled-logit | 886 | 0.2381 | 0.2380 | +0.0001 (-0.0019 to +0.0021) | 0.068 | 0.18 to 0.51 | no |

Of 15 probability scorers: **0 better than the prior rate** (interval wholly below 0), 1 worse: gmp · logit-short, 14 cannot tell. The win rate rises with the predicted probability across all five bins for 2 of 15.
**No number from any of these scorers may be shown as a probability.** A Platt step passes its last-fold check for some tree scorers (`calibrated` in the index); that check is weak (one block) and a calibrated scorer that cannot rank trades is still of no use.
Line 4 of the acceptance rule compares a pooled scorer with the single prior rate, as pre-registered (the scorers table above). The table here uses the stricter per-edge bar; no verdict depends on which one is used.

### 7. Regimes

- By calendar year (a t only when both groups have at least 5 trades): 40 scorer-year cells have a test; the kept trades were ahead in 15 of them (38 %). Single years with t >= 2: none.
- By `regimeBase` and `volState`: 100 cells with a test; t >= 2 in 1 (nq-open · mono-gbt, volState high: t 2.11, kept 141, skipped 22), t <= -2 in 3. With that many cells, the count by chance alone would be about 2 each way.
- Leave one year out: 0 scorers reach t >= 2 overall and 0 reach it with some year removed. No scorer's result is carried by, or hidden by, a single year: there is no apparent skill to locate.

## Defects found and fixed in `ml/train.py`

1. **The embargo ended at the first unit's exit.** The label of a position with a pyramid add (replica 42 % of trades, mosha-bo, gtrend) can still change after the recorded exit, because the add leg is managed on its own up to the first unit's deadline. The old rule (`exit + 1 day <= block start`) admitted **5** training rows whose label could still be open. Fixed: a row trains a fold only when `signal time + the edge's label window <= block start`, the window being the longest signal-to-exit time of the edge plus a weekend. Violations now: **0**.
2. **The keep-threshold was chosen on trades that had not closed.** A block's threshold came from every earlier test trade, including **6** whose position could still be open when the block started (2 with the first unit itself still open). Fixed: only trades whose label window had closed. Now: **0**.
3. **The exam pool was read by default on every run.** `python ml/train.py` computed an exam block for each scorer unless `--no-exam` was passed, so every re-training showed exam numbers next to the settings that produced them. Nothing was chosen from them, but a held-out set that is printed on each run stops being held out. Fixed: the loader drops every row outside the train pool before unpacking it and the file has no exam code path. Proof: the scrambled-matrix run above (22 files, byte-identical). The first trainer's two exam reads are kept as a record in `ml/archive/gbt-1`.

No feature definition was changed and no look-ahead was found in a feature. Tests: `tests/academy-ml.test.mjs` (the review block).

### What the fixes did to the reference scorer

Same fitted trees in every row; only which rows train a fold and which trades choose a threshold differ. The rows under the first trainer's rules reproduce the archived numbers exactly.

| Scope | Rules | AUC | Kept n | Skipped n | Kept R | Skipped R | t |
|---|---|---|---|---|---|---|---|
| replica | the first trainer's rules | 0.547 | 185 | 10 | +0.139 | +2.652 | -1.33 |
| gtl | the first trainer's rules | 0.456 | 79 | 21 | +0.114 | +0.878 | -2.30 |
| gmp | the first trainer's rules | 0.489 | 258 | 50 | +0.123 | +0.098 | 0.13 |
| nq-open | the first trainer's rules | 0.579 | 178 | 28 | +0.423 | +0.054 | 1.31 |
| pooled | the first trainer's rules | 0.587 | 708 | 178 | +0.361 | +0.461 | -1.84 |
| replica | the embargo corrected, the threshold rule as before | 0.548 | 178 | 17 | +0.068 | +2.356 | -1.68 |
| gtl | the embargo corrected, the threshold rule as before | 0.456 | 55 | 45 | +0.147 | +0.430 | -1.03 |
| gmp | the embargo corrected, the threshold rule as before | 0.478 | 256 | 52 | +0.134 | +0.048 | 0.45 |
| nq-open | the embargo corrected, the threshold rule as before | 0.586 | 182 | 24 | +0.391 | +0.238 | 0.47 |
| pooled | the embargo corrected, the threshold rule as before | 0.587 | 691 | 195 | +0.378 | +0.394 | -1.60 |
| replica | the threshold rule corrected, the embargo as before | 0.547 | 185 | 10 | +0.139 | +2.652 | -1.33 |
| gtl | the threshold rule corrected, the embargo as before | 0.456 | 79 | 21 | +0.114 | +0.878 | -2.30 |
| gmp | the threshold rule corrected, the embargo as before | 0.489 | 258 | 50 | +0.123 | +0.098 | 0.13 |
| nq-open | the threshold rule corrected, the embargo as before | 0.579 | 178 | 28 | +0.423 | +0.054 | 1.31 |
| pooled | the threshold rule corrected, the embargo as before | 0.587 | 708 | 178 | +0.361 | +0.461 | -1.84 |
| replica | both corrected (this run) | 0.548 | 176 | 19 | +0.054 | +2.248 | -1.79 |
| gtl | both corrected (this run) | 0.456 | 55 | 45 | +0.147 | +0.430 | -1.03 |
| gmp | both corrected (this run) | 0.478 | 256 | 52 | +0.134 | +0.048 | 0.45 |
| nq-open | both corrected (this run) | 0.586 | 182 | 24 | +0.391 | +0.238 | 0.47 |
| pooled | both corrected (this run) | 0.587 | 693 | 193 | +0.381 | +0.383 | -1.53 |

By itself the threshold correction changes the kept and skipped counts of 0 of 5 scopes (under the old exit rule nearly every earlier test trade counts as closed). The label-window embargo is what moves the numbers: it holds back a few boundary rows, the first block's inner split changes, and the keep-threshold with it.

The t of gtl moves from -2.30 to -1.03 when a handful of boundary rows change hands. Neither figure was evidence: the old -2.30 on gtl ("a scorer that is wrong") was as fragile as a +2 would have been. This is the main practical finding of the review: **on these sample sizes the kept-minus-skipped t is not stable to details that should not matter** (boundary rows, the seed, the fold count).

## The test family

42 kept-minus-skipped tests (20 verdict tests, the reference's 70-input logistic lines, and each pooled scorer inside each edge). Tests with t >= 2:

| Scorer | Slice | Verdict test? | Kept n | Skipped n | Difference (R) | Welch t | Welch p | Holm p | Permutation p | The skipped trades' net R |
|---|---|---|---|---|---|---|---|---|---|---|
| pooled | mosha-bo | no | 11 | 2 | +2.09 | 2.27 | 0.02266 | 0.8836 | 0.1995 | -1.02, -0.34 |
| pooled | geg | no | 48 | 2 | +1.40 | 4.75 | 0.00001 | 0.0004 | 0.0076 | -1.02, -1.03 |
| pooled · mono-gbt | mosha-bo | no | 11 | 2 | +2.09 | 2.27 | 0.02266 | 0.8836 | 0.2026 | -1.02, -0.34 |
| pooled · mono-gbt | nq-open | no | 172 | 11 | +0.78 | 2.63 | 0.00952 | 0.3902 | 0.0560 | -0.38, -1.03, -1.03, +0.49, -1.02, -1.04, +0.05, +1.05, -1.01, +1.17, -1.03 |
| pooled · pooled-logit | nq-open | no | 174 | 9 | +0.91 | 2.37 | 0.01957 | 0.7830 | 0.0401 | -1.03, +1.69, -1.02, -1.01, -1.04, -1.03, -1.01, +1.17, -1.03 |

**One test clears the Holm line on Welch's t and it is an artefact.** It is the pooled reference scorer inside geg: it skipped 2 trades out of 50, both full stops (-1.02 and -1.03 R), so the skipped group has almost no variance and Welch's t is 4.75. Reshuffling which 2 trades are skipped gives p = 0.0076; times 42 tests that is nowhere near the line. It is not a scorer's own test (the pooled reference's verdict t is -1.53) and it changes no verdict. It is reported because the pre-registered family rule (both groups of at least 2) let it in: a future rule should ask for at least 5 a side or use the permutation p.

No verdict test has t >= 2.

## Exam pool

Exam reads by this review: **0**. `academy/data/exam-ledger.json` has no entry from it. The review and the trainer read the train pool only; the loader drops 733 rows of other pools unread.
The first trainer's runs (before this review) read exam-pool aggregates once per run; those numbers are in `ml/archive/gbt-1/index.json` and are not shown by the live index any more (`exam: null`, `examRead: false`).

## Deviations from the pre-registration, and additions

- Embargo: the pre-registration set the label window to the larger of the rule's bound and the longest observed signal-to-exit time. The run adds 72 hours (a weekend) to it, because a time exit that falls in the weekend is filled at the reopen. It is stricter, never looser.
- Family size: the pre-registration lists the tests that make the Holm family; it gave no count. The run has 42.
- Additions the pre-registration did not list, none of which a verdict depends on: a permutation p beside every family test with t >= 2; the per-edge prior rate as the Brier bar of the pooled scorers in the calibration table; a minimum of 5 trades a side for a t inside a year or a regime; the in-sample description of which short-list inputs the stored fits lean on; the reference scorer walked forward under the first trainer's rules, to measure what the two fixes changed.

## What a future scorer must show

1. Enough trades first. Under about 10 events per input in the first training window nothing should be fitted. At that line the fitted edges can carry today: replica 3 inputs, gtl 3 inputs, gmp 9 inputs, nq-open 4 inputs. mosha-bo, gtrend and geg can carry none.
2. A pre-registered configuration and feature list, the walk-forward of `ml/train.py` unchanged (label-window embargo, thresholds from closed trades), and all five lines of the acceptance rule.
3. The same sign and a t of at least 2 with 3, 4, 5 and 6 test blocks and, if it samples, across seeds. A t that needs one fold count is not a result.
4. Groups of at least 5 trades a side in every test that is counted, or a permutation p.
5. A probability only if the out-of-fold Brier interval sits below the prior rate of each trade's own edge.
6. Then, and only then, one ledgered read of the exam pool, decided by the owner. Promotion stays a manual owner step.

## Reproduce

```sh
python ml/train.py            # the scorers: ml/models/index.json, report.md and the tree files (about 10 s)
node ml/parity.mjs            # exported trees against MXA.score
python ml/review.py           # this audit: result.json and RESULT.md (about 5 minutes)
```

Matrix 70e66e9073af, data histdata@85ef4b8ceaac, trainer wf-2, train.py 79608f809dd1, review.py 9c89e1ceaf13. Libraries pinned in `ml/requirements.txt`. Deterministic: the same matrix and code give the same bytes.
