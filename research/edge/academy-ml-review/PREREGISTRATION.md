# Academy scorer: training review (pre-registration)

Written 10 Nov 2026, before any new training run of this review. Committed on its own. Paper research only: nothing
here places an order, calls a paid service, a language model or the network, and nothing here promotes a scorer.

## Why

The owner asked for a review of the Academy's offline training (`ml/`): features, labels, sample size, class
imbalance, regimes, leakage, overfitting and calibration; chronological walk-forward only; rejected challengers are
kept; no automatic promotion; no optimising against held-out data; no claim of improvement without statistical
evidence; negative and inconclusive results reported as they are.

State before the review (`ml/models/index.json`, trainer `gbt-1`, matrix `70e66e9073af`): five scorers (replica,
gtl, gmp, nq-open, pooled), all rejected challengers, none promoted. Three edges have too few trades to fit
(mosha-bo 28, gtrend 18, geg 82 usable train trades).

## What may be read

- `ml/data/matrix.json.gz`, **train-pool rows only**. The loader of the review drops every row whose pool is not
  `train` before anything else looks at it.
- `academy/data/cand-<edge>.json` and `out-<edge>.json` for the label audit (reason, fill time, the add flag), for
  train-pool ids only: the reader keeps the outcomes of train ids and discards the rest unread.
- **The exam pool is never read**: no exam outcome and no exam feature enters a training matrix, a threshold, a
  metric or a table of this review. The review makes **zero exam reads**; `academy/data/exam-ledger.json` gets no
  entry from it. The two trainer runs made before this review read exam-pool aggregates (one line a model); they
  are history, are not repeated, and are not used here.
- Flagged setups (`rule.clockShift`, `rule.pre2020`) stay out, as before. So do orders that never filled.

## A. Audit checks (each reported with a number)

1. **Features.** For each of the 70 inputs (71 with the edge id): whether it is known at the decision time, traced
   in `assets/academy-core.js` `build()` and `academy/gen/features.mjs`; missing rate; constant or near-constant (one
   value on at least 95 % of the rows); drift between the first and the second half of the train rows in time
   (standardised mean difference and the two-sample Kolmogorov-Smirnov statistic); redundancy (pairs with
   |Spearman correlation| above 0.9).
2. **Labels.** What the label is; how unfilled orders and time exits are labelled; whether the label needs anything
   after the recorded exit (the pyramid add); label balance per edge.
3. **Leakage.**
   (a) Label permutation: the labels (win and net R together) are shuffled inside each edge, 20 seeds; the
   walk-forward AUC must average 0.50 and the kept-minus-skipped t must fall outside +-2 about as often as chance.
   (b) A canary: a column that leaks the outcome (net R plus noise) and one that leaks the holding time are added in
   a scratch run; the pipeline's metric must jump. Then a single-feature AUC table for every real feature, against
   the largest single-feature AUC that shuffled labels produce, to show no real feature behaves like the canary.
   (c) Fold boundaries: the number of training rows whose label window is still open when the test block starts,
   counted with no embargo, with the old one-day rule and with the embargo below; the same count for the trades the
   keep-threshold is chosen on.
   (d) Exam ids: the ids of every fitted matrix against the exam ids of the candidate files; the count must be 0.
   The training run is repeated on a matrix whose exam rows are scrambled; the outputs must be byte-identical.
4. **Sample size and power.** Per edge: n, the SD of net R, the smallest kept-minus-skipped difference that reaches
   t = 2 out of fold (for an even split and for an 80 / 20 split), events per input (the smaller class against the
   number of inputs) in the first training window and in the whole sample. Edges under 10 events per input for
   every configuration are named as unable to support a trained scorer.
5. **Overfitting.** In-fold against out-of-fold AUC per scorer; five seeds (1, 7, 13, 29, 101) for the scorers that
   use random sampling; 3, 4, 5 and 6 test blocks.
6. **Calibration.** Reliability table (five equal bins) out of fold, Brier score against the prior-rate Brier score
   with a bootstrap interval of the difference, expected calibration error. No number may be shown as a
   probability unless it is calibrated out of fold.
7. **Regimes.** The out-of-fold kept-minus-skipped result by calendar year, by `regimeBase` and by `volState`, and
   the same t with each year left out in turn.

## B. Walk-forward design (all scorers, old and new)

- Rows: train pool, not flagged, filled, every needed timeframe present; sorted by signal time.
- Expanding window. The first 40 % of the rows is the first training window; the rest is cut into 4 test blocks
  (3 when the scope has fewer than 300 rows). No shuffling, no K-fold.
- **Embargo.** Each edge has a label window E = the longest time from the signal to the end of its label: the
  larger of the rule's own bound (order life plus maximum hold, from `academy/edges.mjs`) and the longest signal-to-
  exit time observed in that edge's usable train rows. A training row enters a fold only when
  `t + E <= start of the test block`. E is at least as long as the longest trade's holding time, so no label of a
  fold's training rows is still open when the block's first feature row is computed. (The old rule was
  `exit + 1 day <= start`, with the exit of the first unit only; a pyramid add may close later than that.)
- The keep-threshold of a block is chosen on predictions made before the block and only on trades whose label
  window had closed before the block starts. It may drop at most half of the trades (grid 0, 10, ..., 50 %).
- Seed 7. No hyper-parameter search. Every setting below is fixed here and is not changed after a result is seen.

## C. Configurations (at most four challengers, each a low-capacity change)

The short feature list is fixed here, before any fit: the decision policy's own five side-relative factors and two
state numbers. `biasAlign`, `ltfAlign`, `momFor`, `locFor`, `confirm`, `stopAtr`, `atrPctile`.

| Id | What | Scopes |
|---|---|---|
| C0 `gbt` (reference, not new) | The existing scorer, unchanged settings (depth 2, 4 leaves, 120 trees, 70 inputs) and its 70-input logistic line, re-validated under design B. | replica, gtl, gmp, nq-open, pooled |
| C1 `logit-short` | Logistic regression, L2 with C = 0.1, the 7 short-list inputs, median fill and standardising from the training window only. | replica, gtl, gmp, nq-open |
| C2 `mono-gbt` | Gradient-boosted stumps (depth 1, 60 trees, learning rate 0.05, L2 10, leaf at least max(20, 10 % of the rows), no row or column sampling) on the short list, constrained to be non-decreasing in `biasAlign`, `ltfAlign`, `momFor`, `locFor`, `confirm` (the signs the decision policy itself states). | the four edges; pooled with the edge id as an eighth, unconstrained input |
| C3 `pooled-logit` | One logistic regression (C = 0.1) over all seven edges: the short list plus one intercept per edge. | pooled |
| C4 `ridge-netR` | Ridge regression of net R itself (alpha = 100 on standardised inputs), the short list; the pooled one adds an intercept per edge. Its output is an expected R, never a probability. | the four edges; pooled |

Edges under 150 usable train rows (mosha-bo, gtrend, geg) get no scorer of their own in any configuration. They are
scored only inside the pooled scorers and reported there with their n.

## D. Acceptance rule (all of it, out of fold)

A scorer passes only if every line holds:

1. Kept minus skipped net R: Welch t at least 2, and its one-sided p, **Holm-corrected over every scorer x edge test
   of the run**, at most 0.02275 (the one-sided tail of t = 2). The family: one test per single-edge scorer; for a
   pooled scorer one test per edge on that edge's trades plus one overall test on net R with each edge's training
   mean removed; the logistic line of each reference scorer counts too. A test exists when both groups have at
   least 2 trades. For a pooled scorer the verdict uses its overall test.
2. The kept trades average more net R than all trades of the same blocks (the mechanical edge).
3. The maximum drawdown of the kept trades (cumulative net R in time order) is not deeper than that of taking every
   setup.
4. Calibration: the Brier score is no worse than the prior-rate Brier score. For C4 the analogue is a mean squared
   error no worse than predicting the training mean; C4 carries no probability.
5. The last test block agrees: it skipped at least one trade and its kept trades average more than all of its trades.

Otherwise the scorer is stored as a **rejected challenger** with the lines it failed. A scorer that passes is stored
as **passed validation, not promoted: owner decision**. `promoted` is false in every file; nothing in this review
registers or promotes a model.

## E. Reporting

- Every scorer of every configuration is reported with its out-of-fold n, kept and skipped n and net R, the t, the
  raw and Holm-corrected p, Brier against the prior rate, drawdowns and verdict. None is dropped.
- The word "improvement" or "skill" is used only for a scorer that passes D. A t under 2 on these samples is written
  as "cannot tell".
- No configuration is added, removed or re-tuned after results are seen. A deviation from this file, if any, is
  listed under "Deviations" in `RESULT.md` with its reason.
- Outputs: `RESULT.md` and `result.json` in this folder; `ml/models/index.json`, `ml/models/report.md` and the
  model files; `docs/academy/TRAINING.md` section "Review of 10 Nov 2026".
