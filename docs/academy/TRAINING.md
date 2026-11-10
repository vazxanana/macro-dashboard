# Academy training: the dataset, the policy check and the offline scorer

Read with `ARCHITECTURE.md` (the contract) and `MODULES.md` (what was built). This file covers Layer C: the feature
dataset, the measurement of the decision policy, and the Python training service in `ml/`. Paper research only. Nothing
here places an order, calls a paid service or needs a key. All numbers below come from the run of 10 Nov 2026 on the
research candles (council-data commit `60cea4527cb1`); they are in `academy/data/eval.json` and `ml/models/index.json`.

## 1. What the dataset is

One row per candidate of the seven edges: 2,783 rows (corrected research clock, `docs/academy/DATA-CLOCK.md`).

| File | What it holds |
|---|---|
| `academy/data/feat-<edge>.json` | `{ version, generated, policy, n, missing, meta, features: { <candidateId>: MXA.lite(features) } }`. Six keys a row: `regime`, `session`, `biasAlign`, `volState`, `side`, `htfBias`. The API's `history` route reads it for "similar past cases". |
| `ml/data/matrix.json.gz` | Every candidate with all 95 `MXA.features` keys, plus the label columns `id, edge, t, pool, clockShift, pre2020, filled, reason, R, netR, win, exitT`. The training table. |

Both come from `academy/gen/features.mjs`:

```sh
git fetch origin council-data
mkdir -p /tmp/academy-candles     # outside the repo: candles are never committed
git archive origin/council-data research/candles/xau-histdata research/candles/nsxusd-histdata | tar -x -C /tmp/academy-candles
ACADEMY_CANDLES=/tmp/academy-candles node academy/gen/features.mjs      # a few seconds
```

The run is deterministic. The same candidate files, candles and code give the same bytes. `generated` is the date in
`academy/data/meta.json`, not the clock. `version` is a hash over the recipe, the core and replay versions, the feature
key list, the calendar, the edge's rule version, the candle commit and the candidate file. The test recomputes it, so a
changed candidate file or a bumped `MXA.VERSION` fails the suite until the features are made again.

### The snapshot recipe

The page must build its snapshots the same way, or its features will not match the stored past cases.

- **Series:** the edge's `contextTfs` from `academy/edges.mjs`. No `1m` series: `nq-open` candidates carry `tf: '1m'`
  and the core then measures them on 5m bars. `gmp` is measured on 5m bars too.
- **Bars:** built from M1 in plain UTC buckets, as `MXR.aggregate` does. The Sunday evening is its own daily bar.
- **History:** 300 bars a timeframe.
- **Dollar index:** not passed. The research folder has no dollar-index candles and the live candle proxy has none
  either. `dxyTrend`, `dxyStrength` and `dxyConflict` are null in every row.
- **Calendar:** CPI, payrolls and FOMC, read from `council/events.mjs` (a plain data file; it is read, never changed).
  Its dates begin in January 2022. Before that no calendar is passed, so `eventNear` is null ("unknown"), not false.
  From 2022 on a candidate near one of these releases has `regime: 'event'`.

Rows with a missing or short timeframe: 10 of 2,783 (gtl 3, geg 2, nq-open 5). All are in early 2018, before the
candles hold enough history, and all are flagged `pre2020` anyway.

## 2. No look-ahead

- A row is computed from one `MXR.snapshot` at `t` = the candidate's signal time. The snapshot keeps a bar only when
  `bar.time + tfSec <= t`. `MXR.guard` and `MXA.assertNoFuture` throw on anything later.
- A candidate carrying an outcome field is refused by the snapshot builder.
- Outcomes are read only after the features exist. They are joined to the matrix as label columns and are never an input.
- A release that is still to come is passed as `{ t, title, impact }` only, and only when it is due within 72 hours. Its
  date is public long before. Its result is never passed.
- The test `tests/academy-ml.test.mjs` proves it on synthetic candles for all seven edges: replacing every bar from `t`
  onwards with wild prices leaves the row identical, and changing a bar that closed before `t` changes it.

## 3. Does the decision policy add anything? (`academy/data/eval.json`)

`academy/gen/evaluate.mjs` walks each edge's train-pool setups that are not flagged, in time order. Each gets
`MXA.decide(snapshot, { history, edgeDef: { version, cost }, lessons: [] })`. `history` holds the earlier train cases
whose trade had finished before the signal, the same rows the API's `history` route returns. Exam-pool results are never
read. An order that never filled is counted apart and is in no average.

Net R a trade, filled trades, train pool, policy `policy-1.0`, no lessons, no model:

| Edge | Take every setup: n, R, t | Policy TAKE: n, R | Policy WAIT: n, R | TAKE minus WAIT, Welch t | Verdict |
|---|---|---|---|---|---|
| replica | 325, +0.406, 2.34 | 169, +0.148 | 156, +0.685 | -0.537, t -1.53 | no measurable difference |
| mosha-bo | 28, +0.815, 1.79 | 15, +1.227 | 13, +0.339 | +0.889, t 1.01 | no measurable difference |
| gtrend | 18, +1.885, 1.60 | 18, +1.885 | 0 | none | no measurable difference (it took all 18) |
| gtl | 166, +0.216, 2.13 | 59, +0.400 | 107, +0.114 | +0.286, t 1.33 | no measurable difference |
| geg | 82, +0.469, 2.05 | 54, +0.463 | 28, +0.481 | -0.018, t -0.03 | no measurable difference |
| gmp | 513, +0.075, 1.35 | 120, -0.041 | 393, +0.110 | -0.151, t -1.17 | no measurable difference |
| nq-open | 344, +0.204, 2.39 | 87, +0.481 | 257, +0.111 | +0.370, t 1.84 | no measurable difference |
| all seven | 1,476, +0.252, 4.74 | 522, +0.312 | 954, +0.219 | +0.093, t 0.82 | no measurable difference |

Plainly: on this data the policy as built does not separate good setups from bad ones. It takes about a third of the
setups (36 %). The trades it skips made money too (+0.219 R a trade, 954 trades), so following it would have earned less
in total than taking every setup. On replica and gmp the skipped trades did better than the taken ones, though not by a
margin that means anything (|t| under 2). nq-open is the nearest to a real difference (t 1.84, both halves of the period
the same sign), which is one result out of seven and not a finding by itself. gtrend (18 trades) and mosha-bo (28)
are too small to show anything. These numbers are from the corrected research clock; the table of the old-clock run
(1,421 trades, t 1.17 overall) is in `docs/academy/DATA-CLOCK.md`.

Each edge block in `eval.json` also has: the same split into the first 70 % and last 30 % of the period by time
(`split`), how many orders never filled (`unfilled`), the gates and the strongest contradicting factor behind the waits
(`waits`), and the taken trades by stated confidence (`takeByConfidence`). Most waits are evidence waits, not gates
(705 of 966). The most frequent top reason is a resting level in the way of the target (`oppLiq`, 342), then the
higher-timeframe bias (185). The policy was measured, not tuned: nothing in the core was changed.

## 4. The offline scorer (`ml/`)

```sh
python -m pip install -r ml/requirements.txt      # lightgbm, numpy, scikit-learn, scipy (pinned)
python ml/train.py                                # every configuration and scope -> ml/models (about 10 s)
node ml/parity.mjs                                # exported tree scorers against MXA.score
python ml/review.py                               # the audit of section 7 -> research/edge/academy-ml-review (about 4 minutes)
```

Trainer `wf-2` since the review of 10 Nov 2026 (section 7). The first trainer (`gbt-1`) and its report are kept in
`ml/archive/gbt-1/`.

- **Target:** net R > 0 (a win after costs). One configuration (`ridge-netR`) fits net R itself.
- **Rows:** train pool, not flagged (a week whose clock could not be verified, before 2020), filled trades, every needed timeframe present.
- **The exam pool cannot be read.** `load_matrix()` drops every row that is not in the train pool before its labels or
  features are unpacked (733 rows), and the file has no exam code path. `--no-exam` is accepted and ignored.
- **Too little data:** an edge with fewer than 150 usable rows is not fitted in any configuration. That is mosha-bo
  (28), gtrend (18) and geg (82). They are scored only inside the pooled scorers.

Five configurations, fixed in `research/edge/academy-ml-review/PREREGISTRATION.md` before any of them was run. None is tuned.

| Id | What | Inputs | Scopes | Exported |
|---|---|---|---|---|
| `gbt` (C0, the reference) | Gradient-boosted trees: depth 2, 4 leaves, 120 trees, learning rate 0.03, L2 10, leaf at least max(20, 10 % of the rows). Unchanged since the first trainer, with its 70-input logistic line as a baseline. | 70 of the 95 feature keys (71 pooled, with the edge id) | replica, gtl, gmp, nq-open, pooled | yes |
| `logit-short` (C1) | Logistic regression, L2 with C = 0.1, median fill and standardising from the training window only. | the short list (7) | the four edges | no |
| `mono-gbt` (C2) | Boosted stumps (depth 1, 60 trees), non-decreasing in the five policy factors. | the short list (+ the edge id pooled) | the four edges, pooled | yes |
| `pooled-logit` (C3) | One logistic regression over all seven edges, one intercept per edge. | the short list + 7 edge intercepts | pooled | no |
| `ridge-netR` (C4) | Ridge regression of net R (alpha 100). An expected R, never a probability. | the short list (+ edge intercepts pooled) | the four edges, pooled | no |

The short list: `biasAlign`, `ltfAlign`, `momFor`, `locFor`, `confirm` (the decision policy's five side-relative
factors) and `stopAtr`, `atrPctile`. Left out of the 70: the 15 raw price levels (they do not carry across years), three
data flags and free text, the three calendar keys and `regime` (the calendar starts in 2022, so their missing values
would mark the era), and the three dollar-index keys (always null). The list and reasons are in `index.json` `notInputs`.

### Validation

Chronological walk-forward with an expanding window. The first 40 % of the rows (by time) is the first training window.
The rest is cut into 4 test blocks (3 for a scope under 300 rows). Each block is predicted by a scorer trained only on
earlier rows. There is no shuffled K-fold anywhere.

**Embargo.** A label is the result of a position, and a position can stay open for as long as its rule allows. A
training row enters a fold only when `signal time + its edge's label window <= the block's start`. The label window is
the larger of the rule's own bound (order life plus maximum hold) and the longest signal-to-exit time seen in the edge's
usable train rows, plus a weekend: replica 163 h, mosha-bo 197, gtrend 1,335, gtl 226, geg 792, gmp 151, nq-open 74.
The first trainer used `first-unit exit + 1 day`; a pyramid add can close later than that (section 7, defect 1).

The trading view asks: of the test trades, are the ones the scorer would keep better than the ones it would skip? The
keep-threshold may drop at most half of the trades. It is chosen on earlier predictions only, and only on trades whose
label window had closed before the block starts: the earlier test blocks, or for the first block an inner split of its
training window.

**Acceptance rule (all five lines, out of fold).** (1) Kept minus skipped net R: Welch t of at least 2, and its
one-sided p, Holm-corrected over every scorer x edge test of the run, at most 0.02275. For a pooled scorer the test is
on net R with each edge's training mean removed, so it gets no credit for simply preferring one edge. (2) The kept
trades average more than all trades. (3) Their maximum drawdown is not deeper than taking every setup's. (4) The Brier
score is no worse than the prior rate's (for `ridge-netR`: mean squared error no worse than the training mean).
(5) The last test block agrees. Otherwise the scorer is stored as a **rejected challenger** with the lines it failed. A
scorer that passes is stored as **passed validation, not promoted: owner decision**. Nothing is ever promoted here.

**Calibration.** `calibrated: true` only for a tree scorer whose Platt scaling, fitted on the out-of-fold scores of
every fold but the last, gives on the last fold a Brier score no worse than the prior rate and a mean probability within
0.05 of the win rate. That is one small block: a weak check. The review's stricter reading (section 7) is that no number
from any of these scorers may be shown as a probability.

### Results (out of fold, trainer `wf-2`)

| Scorer | Train rows | Out-of-fold n | AUC | Brier (prior-rate Brier) | Kept: n, R | Skipped: n, R | t | Holm p | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| replica | 325 | 195 | 0.548 | 0.1833 (0.1838) | 176, +0.054 | 19, +2.248 | -1.79 | 1.00 | rejected challenger |
| gtl | 166 | 100 | 0.456 | 0.2647 (0.2560) | 55, +0.147 | 45, +0.430 | -1.03 | 1.00 | rejected challenger |
| gmp | 513 | 308 | 0.478 | 0.2578 (0.2489) | 256, +0.134 | 52, +0.048 | 0.45 | 1.00 | rejected challenger |
| nq-open | 344 | 206 | 0.586 | 0.2545 (0.2624) | 182, +0.391 | 24, +0.238 | 0.47 | 1.00 | rejected challenger |
| pooled | 1,476 | 886 | 0.587 | 0.2370 (0.2422) | 693, +0.381 | 193, +0.383 | -1.53 | 1.00 | rejected challenger |
| replica · logit-short | 325 | 195 | 0.558 | 0.1834 (0.1838) | 144, +0.287 | 51, +0.212 | 0.20 | 1.00 | rejected challenger |
| gtl · logit-short | 166 | 100 | 0.500 | 0.2583 (0.2560) | 84, +0.245 | 16, +0.426 | -0.48 | 1.00 | rejected challenger |
| gmp · logit-short | 513 | 308 | 0.426 | 0.2569 (0.2489) | 267, +0.078 | 41, +0.388 | -1.50 | 1.00 | rejected challenger |
| nq-open · logit-short | 344 | 206 | 0.525 | 0.2627 (0.2624) | 179, +0.396 | 27, +0.221 | 0.58 | 1.00 | rejected challenger |
| replica · mono-gbt | 325 | 195 | 0.534 | 0.1832 (0.1838) | 161, -0.058 | 34, +1.809 | -2.35 | 1.00 | rejected challenger |
| gtl · mono-gbt | 166 | 100 | 0.477 | 0.2573 (0.2560) | 88, +0.177 | 12, +0.988 | -2.05 | 1.00 | rejected challenger |
| gmp · mono-gbt | 513 | 308 | 0.494 | 0.2511 (0.2489) | 242, +0.127 | 66, +0.091 | 0.22 | 1.00 | rejected challenger |
| nq-open · mono-gbt | 344 | 206 | 0.508 | 0.2629 (0.2624) | 178, +0.416 | 28, +0.098 | 0.95 | 1.00 | rejected challenger |
| pooled · mono-gbt | 1,476 | 886 | 0.582 | 0.2344 (0.2422) | 815, +0.396 | 71, +0.212 | -0.79 | 1.00 | rejected challenger |
| pooled · pooled-logit | 1,476 | 886 | 0.590 | 0.2381 (0.2422) | 828, +0.395 | 58, +0.186 | -0.79 | 1.00 | rejected challenger |
| replica · ridge-netR | 325 | 195 | 0.538 | no probability | 164, +0.174 | 31, +0.760 | -0.96 | 1.00 | rejected challenger |
| gtl · ridge-netR | 166 | 100 | 0.467 | no probability | 62, +0.300 | 38, +0.233 | 0.26 | 1.00 | rejected challenger |
| gmp · ridge-netR | 513 | 308 | 0.462 | no probability | 273, +0.090 | 35, +0.345 | -1.18 | 1.00 | rejected challenger |
| nq-open · ridge-netR | 344 | 206 | 0.508 | no probability | 198, +0.387 | 8, +0.026 | 0.81 | 1.00 | rejected challenger |
| pooled · ridge-netR | 1,476 | 886 | 0.476 | no probability | 850, +0.371 | 36, +0.633 | -1.29 | 1.00 | rejected challenger |
| mosha-bo, gtrend, geg | 28, 18, 82 | | | | | | | | not enough data |

No scorer improves on taking every setup: 20 of 20 are rejected, 12 have a negative t, and the best t is 0.95
(nq-open · mono-gbt, n 206). The pooled AUC of 0.58 to 0.59 is mostly the edges having different win rates (replica
wins 24 % of the time, gtl 51 %); measured inside each edge it is 0.48 to 0.53, and against the prior rate of each
trade's own edge the pooled Brier bar is 0.2380, not 0.2422. An AUC of 0.43 to 0.59 on 100 to 886 trades is what noise
looks like: on shuffled labels the same pipeline gives 0.36 to 0.64 (section 7).

The numbers of the first trainer (`gbt-1`: replica t -1.33, gtl -2.30, gmp 0.13, nq-open 1.31, pooled -1.84) are in
`ml/archive/gbt-1/report.md`. They differ from the first five rows above only through the corrected embargo: the fitted
trees are the same. The old-clock report is `academy/archive/pre-clock/ml-models/report.md`. Every model was rejected in
all three.

**The exam pool.** The first trainer computed an exam block for each model on every run (after that run's verdicts were
fixed; it chose nothing). Those numbers are in `ml/archive/gbt-1/index.json`. The live index has `exam: null` and
`examRead: false`: a held-out set that is printed on each re-training stops being held out. A future exam read is a
separate, ledgered step the owner decides (`academy/data/exam-ledger.json`).

### How to read `ml/models/index.json` and `report.md`

- `models[]`: one entry per scorer. `scope` is the label the page shows (`gtl`, `gtl · mono-gbt`), `scopeEdge` the
  edge or `pooled`, `config` and `kind` what it is. `status` (`rejected challenger` or `passed validation, not promoted:
  owner decision`), `verdict` in words, `acceptance[]` (the five lines, each with its value and `ok`), `trainRows`,
  `rowIdsHash`, `from` / `to`, `featureNames`, `validation`, `folds[]` (per fold: rows, rows held back by the embargo,
  the threshold's rows, in-fold AUC, and under `gbt`: n, AUC, Brier against `brierPrior`, and `trading` with
  mechanical / kept / skipped and the t), `outOfFold` (all test blocks together: `trading` adds `p`, `pHolm`,
  `maxDrawdown`), `calibration`, `threshold`, `hash`, and `register` (the registry body, tree scorers only).
- **The key `gbt` holds the entry's own scorer whatever its kind.** The name is historical: the page reads that key.
  `logit` exists only on the reference entries (their 70-input logistic line).
- A linear scorer (`logit-short`, `pooled-logit`, `ridge-netR`) has `file: null` and `coefficients` instead: it cannot
  be written in the page's tree format, so there is nothing the page could load.
- `tests[]` and `family`: every kept-minus-skipped test of the run with its p and Holm-corrected p.
- `skipped[]`: edges with too few rows, with the count.
- `data`: the matrix version, each edge's feature version, the candle commit. `code`: the hash of `train.py` (the test
  fails when `ml/models` was not written by the committed trainer).
- `report.md` holds the same numbers as tables.

### The exported model and the parity check

A tree scorer's file follows `MXA.MODEL_SCHEMA`: `version`, `promoted: false`, `calibrated`, `featureNames`,
`encoders`, `baseScore: 0`, `link: 'logit'`, an optional `platt`, and `trees`. A row goes left when `x <= t`. Every node
states `defaultLeft`, the side a missing value takes. String features go through `encoders`; a value without a code
counts as missing. `ml/parity.mjs` scores a sample of up to 300 train-pool rows per scorer with `MXA.score` and compares
with the training library's own predictions (`<id>.pred.json`). The difference must be under 1e-6. It is 5e-7 at most,
which is `MXA.score` rounding to six decimals: the unrounded tree sums agree exactly. Ten scorers are exported (the
five reference scorers and the five `mono-gbt`); the ten linear ones have no file.

## 5. Promotion is manual

Nothing in `ml/`, the workflow or the tests promotes a model. Every exported file says `promoted: false`, and
`MXA.decide` ignores a model unless it is both promoted and calibrated. Today there is nothing to promote: all 20
scorers are rejected challengers. A scorer that passed the acceptance rule would be marked `passed validation, not
promoted: owner decision` and still wait for the steps below. If the owner ever wants one on file (tree scorers only: a
linear scorer has no file), the steps are (owner session, same origin, one request at a time):

```
POST /api/academy
{ "action": "model.register", "model": { ... } }     the "register" object of that model in ml/models/index.json, as it is
```

For example, for nq-open the body is:

```json
{ "action": "model.register", "model": { "name": "academy-scorer-nq-open", "version": "nq-open-140c8f7626",
  "kind": "gbt-binary", "edge": "nq-open", "status": "challenger", "metrics": { "...": "the numbers above" },
  "datasetVersion": "70e66e9073af", "trainedOn": { "pool": "train", "rows": 344, "from": "2020-01-08", "to": "2026-09-28" },
  "artifact": "ml/models/nq-open-140c8f7626.json", "hash": "...", "notes": "REJECTED CHALLENGER. ..." } }
```

The reply carries the registry id (`model.id`). Promotion is a second, explicit request:

```json
{ "action": "model.promote", "id": "<the id from the reply>", "confirm": true, "reason": "why, in the owner's words" }
```

and `{ "action": "model.rollback", "confirm": true, "reason": "..." }` undoes the last promotion. The registry is a
record only. The page does not load a model file yet; that wiring, and setting `promoted: true` in the file the page
loads, are separate steps the owner has to ask for.

The GitHub workflow `academy-train.yml` runs only when started by hand. It rebuilds the features, runs the policy check,
trains, runs parity and the tests, and uploads the results as an artifact. It commits and pushes nothing. Its `edge`
input must stay `all`: the trainer no longer fits one edge alone, because the Holm family covers every scope of a run
(`--config <id> --out <folder>` gives a partial run somewhere else).

## 6. Limits

- **Two candle feeds.** Features, candidates and outcomes come from HistData M1 candles. The page replays candles from
  the live candle proxy. Prices differ by a small feed basis, the daily bar on the proxy may not match bar for bar, and
  the proxy has gaps of its own. A feature computed live can differ from the stored one for the same moment.
- **The research clock.** Corrected on 10 Nov 2026 (`docs/academy/DATA-CLOCK.md`): the loaders convert the HistData
  labels with `council/histdata.mjs`. 101 candidates still carry `rule.clockShift`: their week could not be verified
  against a second feed (most are in the hole of the 2023 files). They have a feature row, but they are out of the
  policy check and the training rows. So are the candidates before 2020.
- **Small samples.** 1,476 usable train trades over seven edges; three edges are too small to fit and two more
  (mosha-bo, gtrend) too small to judge the policy on. A t under 2 here means "cannot tell", not "no effect".
- **Many comparisons.** Seven edges, 20 scorers and 42 kept-minus-skipped tests. The acceptance rule corrects for them
  (Holm); one t near 2 among them would not be evidence.
- **Unstable t.** On these samples the kept-minus-skipped t of one scorer moves by more than 2 with the seed, and
  changes sign with the number of test blocks for 6 of 20 scorers (section 7). A single figure is not a finding.
- **Dependent trades.** 37 % of replica trades, 29 % of mosha-bo and 27 % of geg opened while another trade of the same
  edge was open. Welch's t treats them as independent, so it overstates the evidence there.
- **The exam pool is interleaved in time** with the train pool (whole months), so it is not an out-of-time test. The
  walk-forward is. The trainer no longer reads it at all.
- **Calendar from 2022 only**, three release types. Before 2022 the event gate of the policy cannot fire.
- **No dollar index.** The policy's dollar factor is never used in these numbers.
- **The pooled tree scorers read the edge id**, which `MXA.features` does not carry. To score one, the caller must add
  `edge` to the features object. `MXA.decide` does not do that today.
- **gmp** comes from the robustness study's port of the rule (see `MERIDIANX_BUILD_PROGRESS.md`), not the live system.

## 7. Review of 10 Nov 2026 (`research/edge/academy-ml-review/`)

The owner asked for a review of the training: features, labels, sample size, class imbalance, regimes, leakage,
overfitting and calibration; walk-forward only; rejected challengers kept; no automatic promotion; no optimising against
held-out data; negative results reported as they are. `PREREGISTRATION.md` was committed before any new training run.
`python ml/review.py` writes `RESULT.md` and `result.json` there (every number below is in them). Train pool only:
**exam reads by the review: 0.**

**Verdict: no scorer passes.** 20 scorers (the reference on 5 scopes, four pre-registered low-capacity configurations
on 15): 0 pass, 20 rejected, 0 promoted. Best kept-minus-skipped t 0.95 (nq-open · mono-gbt, n 206); 12 of 20 have a
negative t, 2 are at or below -2. The smallest Holm-corrected p of a scorer's own test is 1.00 over 42 tests.

### What was checked

1. **Features.** 71 inputs (70 plus the edge id), **all known at the decision time**: traced in `MXA.features`, every
   value comes from bars closed at t, the clock, or the candidate's own side, entry, stop and target. One caveat: a
   market order's entry is its fill price (for gmp the next M1 open); the gap is 0.008 ATR at the median and above 0.1
   ATR in 0.6 % of rows. Nine inputs are missing on more than 5 % of rows, one is near-constant (`geomOk`), six pairs
   are redundant (|Spearman| above 0.9, e.g. `stopAtr` / `targetAtr` at 1.00), and **35 of 71 drift** by |SMD| >= 0.25
   between the first and the second half of a scope's train rows (replica `side`: 1.54).
2. **Labels.** Win = net R of the whole position above 0. An unfilled order has no label and is in no row. A time exit
   is labelled by its sign (68 to 90 % of time exits are wins). Win rates run from 0.24 (replica) to 0.51 (gtl); no
   class weights are used. The label of a position with a pyramid add (replica 42 % of trades) can change after the
   recorded exit: defect 1. Four trades are a gross win and a net loss.
3. **Leakage.** (a) Shuffled labels, 20 seeds, 400 walk-forward runs: mean AUC 0.500 (SD 0.055, range 0.36 to 0.64);
   1.5 % of 329 tests reach t >= 2 (chance 2.3 %). (b) A planted column (net R plus noise) lifts the AUC from 0.52 to
   0.91 and the t to 11.4 on average: the pipeline sees a leak. No real feature scores above what the best of 70 reaches
   on shuffled labels. (c) Training rows whose label could still be open at a block's start: 7 with no embargo, 5 under
   the first trainer's rule, **0 with the embargo**; thresholds chosen on possibly open trades: 6 before, **0 now**.
   (d) Exam ids in the 20 fitted matrices: **0**; a run on a matrix whose 733 other-pool rows are noise gives 22
   byte-identical files.
4. **Sample size and power.** The smallest kept-minus-skipped difference that reaches t = 2 out of fold:

   | Edge | Usable train n | Out-of-fold n | SD of net R | Mean net R | MDE, even split | MDE, 80 / 20 | Events per input, 7 inputs (all / first window) |
   |---|---|---|---|---|---|---|---|
   | replica | 325 | 195 | 3.13 | +0.41 | 0.90 R | 1.12 R | 11.1 / 4.4 |
   | mosha-bo | 28 | none | 2.40 | +0.81 | 1.82 R | 2.27 R | 1.7 / 0.7 |
   | gtrend | 18 | none | 4.99 | +1.88 | 4.70 R | 5.88 R | 1.3 / 0.4 |
   | gtl | 166 | 100 | 1.30 | +0.22 | 0.52 R | 0.65 R | 11.6 / 4.6 |
   | geg | 82 | none | 2.07 | +0.47 | 0.92 R | 1.14 R | 5.3 / 2.3 |
   | gmp | 513 | 308 | 1.26 | +0.07 | 0.29 R | 0.36 R | 33.1 / 13.0 |
   | nq-open | 344 | 206 | 1.59 | +0.20 | 0.44 R | 0.55 R | 21.3 / 6.7 |
   | pooled | 1,476 | 886 | 2.04 | +0.25 | 0.27 R | 0.34 R | |

   A scorer would have to separate trades by about twice an edge's whole expectancy to be seen. **mosha-bo, gtrend and
   geg cannot support a trained scorer at all** (under 10 events per input even with 7 inputs; for those three the MDE
   is on all their trades, as if none were needed for fitting). With 70 inputs every edge is under 4 events per input.
5. **Overfitting.** The 70-input reference fits its training rows at AUC 0.74 to 0.94 and scores 0.46 to 0.59 out of
   fold (mean gap 0.32; the short-list configurations 0.02 to 0.11, and no better out of fold). Across five seeds the
   reference's t on gtl runs from -2.08 to 0.64. With 3, 4, 5 and 6 test blocks the t changes sign for 6 of 20 scorers
   and none reaches 2.
6. **Calibration.** Of 15 probability scorers, 0 beat the prior rate out of fold (bootstrap interval of the Brier
   difference wholly below 0; pooled scorers against the prior rate of each trade's own edge), 1 is worse, 14 cannot
   tell. **No number from these scorers may be shown as a probability.**
7. **Regimes.** 40 scorer-year cells with a test (both groups of at least 5): the kept trades were ahead in 15. No
   single year has t >= 2, and no scorer reaches t >= 2 with any one year left out. Of 100 regime and volatility cells,
   1 has t >= 2 and 3 have t <= -2; chance alone gives about 2 each way. There is no apparent skill to locate.

### What was found and fixed in `ml/train.py`

1. **The embargo ended at the first unit's exit.** An add leg can close later, up to the first unit's deadline; the
   old rule admitted 5 training rows whose label could still be open. Now: `signal time + the edge's label window`.
2. **The keep-threshold was chosen on trades that had not closed** (6 of them). Now: closed trades only.
3. **The exam pool was read by default on every run.** Now the loader drops those rows and there is no exam code path.

None of this hid a working scorer: the reference is rejected before and after. What the fixes did show is how fragile
the old figures were: with the same fitted trees, the reference's t on gtl moves from -2.30 to -1.03 and on nq-open from
1.31 to 0.47 when a handful of boundary rows change hands. The earlier reading of gtl ("a scorer that is wrong, not
merely useless") was noise too.

One of the 42 family tests clears the Holm line on Welch's t and is an artefact: the pooled reference inside geg skipped
2 of 50 trades, both full stops, so the skipped group has almost no variance (t 4.75). Reshuffling which 2 trades are
skipped gives p = 0.0076. It is not a scorer's own test and changes no verdict.

### What a future scorer must show

1. Enough trades first: about 10 events per input in the first training window. Today that allows 3 inputs on replica
   and gtl, 4 on nq-open, 9 on gmp, and nothing on mosha-bo, gtrend or geg.
2. A pre-registered configuration and feature list, the walk-forward of `ml/train.py` unchanged, and all five lines of
   the acceptance rule.
3. The same sign and a t of at least 2 with 3, 4, 5 and 6 test blocks and, if it samples, across seeds.
4. At least 5 trades a side in every test that counts, or a permutation p.
5. A probability only if the out-of-fold Brier interval sits below the prior rate of each trade's own edge.
6. Then one ledgered read of the exam pool, decided by the owner. Promotion stays a manual owner step.

Tests: `tests/academy-ml.test.mjs` recomputes every fold from the candidate and outcome files (the embargo and the
threshold rule hold on the committed data), re-applies the acceptance rule and the Holm correction to the stored
numbers, checks the trainer's source for an exam code path, and compares `ml/models` and `result.json` with the hashes
of the committed `train.py` and `review.py`.
