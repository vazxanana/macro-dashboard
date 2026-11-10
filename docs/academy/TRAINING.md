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

Since the policy investigation of 10 Nov 2026 each edge block and `overall` also carry `drawdown`: the maximum drawdown
in R of the mechanical set, the take-set and the wait-set (closed trades in exit order, equity from zero, the largest
fall from a running peak; the research baselines use the same definition and give the same mechanical numbers).

| Edge | Every setup: trades, max drawdown | Policy takes: trades, max drawdown |
|---|---|---|
| replica | 325, 26.63 R | 169, 17.13 R |
| mosha-bo | 28, 4.57 R | 15, 3.11 R |
| gtrend | 18, 5.26 R | 18, 5.26 R |
| gtl | 166, 13.48 R | 59, 5.47 R |
| geg | 82, 7.33 R | 54, 7.64 R |
| gmp | 513, 16.06 R | 120, 11.88 R |
| nq-open | 344, 16.29 R | 87, 4.94 R |
| all seven, one sequence | 1,476, 32.45 R | 522, 24.07 R |

A take-set holds about a third of the trades, and a subset usually falls less in R, so a smaller figure here is not
evidence of selection (on geg it is larger). `academy/data/eval-trades.json` lists the policy's action on every usable
train setup (`id`, `t`, `action`; no outcome field, no exam setup), so these figures can be recomputed from the outcome
files without this script. The investigation itself (why the policy does not beat taking every setup, five
pre-registered candidates, none accepted) is `research/edge/academy-policy/RESULT.md`; see `RESEARCH.md`, section 7.

## 4. The offline scorer (`ml/`)

```sh
python -m pip install -r ml/requirements.txt      # lightgbm, numpy, scikit-learn, scipy (pinned)
python ml/train.py --edge all                     # or --edge gmp, or --edge pooled; --out <folder>; --no-exam
node ml/parity.mjs                                # exported models against MXA.score
```

- **Target:** net R > 0 (a win after costs). A regression view of net R is reported as a secondary line only.
- **Rows:** train pool, not flagged (a week whose clock could not be verified, before 2020), filled trades, every needed timeframe present.
- **Inputs:** 70 of the 95 feature keys (71 for the pooled model, which adds the edge id). Left out: the 15 raw price levels (they do not carry across years), three data
  flags and free text, the three calendar keys and `regime` (the calendar starts in 2022, so their missing values would
  mark the era), and the three dollar-index keys (always null). The list and reasons are in `index.json` `notInputs`.
- **Model:** small gradient-boosted trees (depth 2, 4 leaves at most, 120 trees, learning rate 0.03, L2 10, a leaf holds
  at least 20 rows or 10 % of the training rows). The settings were fixed before any result was read. They are not tuned.
- **Too little data:** an edge with fewer than 150 usable rows is not fitted. That is mosha-bo (29), gtrend (19), geg (84).
- **Pooled model:** one model over all edges with the edge id as an input.

### Validation

Chronological walk-forward with an expanding window. The first 40 % of the rows (by time) is the first training window.
The rest is cut into 4 test blocks (3 for an edge under 300 rows). Each block is predicted by a model trained only on
earlier rows. A training row is dropped when its trade had not closed one day before the block starts (the embargo), so
no trade sits on both sides of a boundary. There is no shuffled K-fold anywhere.

Baselines in every table: take every setup (the mechanical edge), the prior win rate as a constant probability, and a
strongly penalised logistic regression.

The trading view asks: of the test trades, are the ones the model would keep better than the ones it would skip? The
keep-threshold may drop at most half of the trades. It is chosen on earlier predictions only: the earlier test blocks,
or for the first block an inner split of its training window.

**Verdict rule.** A model beats taking every setup only if, out of fold, kept minus skipped has a Welch t of at least 2,
the kept trades average more than all trades, and the last fold shows the same. Otherwise it is exported as a
**rejected challenger**. For the pooled model the t is taken on net R with each edge's training mean removed, so it
gets no credit for simply preferring one edge.

**Calibration.** `calibrated: true` only when Platt scaling, fitted on the out-of-fold scores of every fold but the
last, gives on the last fold a Brier score no worse than the prior rate and a mean probability within 0.05 of the win
rate. Then the model carries a `platt` block. The nq-open model passes; replica, gtl, gmp and the pooled model do
not. The last fold of a single edge is small (33 to 77 trades), so this is a weak check, and a calibrated model that
cannot rank trades is still of no use.

### Results (out of fold)

| Scope | Train rows | Out-of-fold n | AUC | Brier (prior-rate Brier) | Kept: n, R | Skipped: n, R | t | Verdict |
|---|---|---|---|---|---|---|---|---|
| replica | 325 | 195 | 0.547 | 0.1847 (0.1842) | 185, +0.139 | 10, +2.652 | -1.33 | rejected challenger |
| gtl | 166 | 100 | 0.456 | 0.2647 (0.2560) | 79, +0.114 | 21, +0.878 | -2.30 | rejected challenger |
| gmp | 513 | 308 | 0.489 | 0.2571 (0.2489) | 258, +0.123 | 50, +0.098 | 0.13 | rejected challenger |
| nq-open | 344 | 206 | 0.579 | 0.2553 (0.2625) | 178, +0.423 | 28, +0.054 | 1.31 | rejected challenger |
| pooled | 1,476 | 886 | 0.587 | 0.2367 (0.2422) | 708, +0.361 | 178, +0.461 | -1.84 | rejected challenger |
| mosha-bo, gtrend, geg | 28, 18, 82 | | | | | | | not enough data |

No model improves on taking every setup. The pooled AUC of 0.587 is mostly the edges having different win rates
(replica wins 24 % of the time, gtl 51 %); measured inside each edge it is 0.534. An AUC of 0.46 to 0.58 on 100 to 308
trades is what noise looks like. On gtl the trades the scorer kept did worse than the ones it skipped (t -2.30): a
scorer that is wrong, not merely useless. The logistic baseline is no better. The regression view agrees: out-of-fold
error is about that of predicting the training mean. These are the numbers on the corrected research clock; the
old-clock report is `academy/archive/pre-clock/ml-models/report.md` (same verdicts: every model rejected).

The exam pool was first read only after the walk-forward results above had been read and the settings were final, and
it chose nothing. A run computes it once, after that run's verdicts are fixed; later runs repeat the same numbers. It is
in a separate `exam` block per model: replica n 50, AUC 0.570; gtl n 60, 0.512; gmp n 213, 0.557; nq-open n 201, 0.562;
pooled n 602, 0.544. Each final threshold keeps every trade, so the exam trading line equals taking every setup. Exam
months lie between training months: it is held-out data, not later data.

### How to read `ml/models/index.json` and `report.md`

- `models[]`: one entry per fitted scope. `status` (`rejected challenger` or `challenger`), `verdict` in words,
  `trainRows`, `from` / `to`, `featureNames`, `validation`, `folds[]` (per fold: rows, purged rows, and for `gbt` and
  `logit`: n, AUC, Brier against `brierPrior`, log loss, and `trading` with mechanical / kept / skipped and the t),
  `outOfFold` (all test blocks together, with `calibration` by bin), `regressionView`, `calibration` (the Platt check),
  `threshold`, `exam`, `hash`, and `register` (the registry body, see below).
- `skipped[]`: edges with too few rows, with the count.
- `data`: the matrix version, each edge's feature version, the candle commit. `code`: the hash of `train.py`.
- `report.md` holds the same numbers as tables.

### The exported model and the parity check

A model file follows `MXA.MODEL_SCHEMA`: `version`, `promoted: false`, `calibrated`, `featureNames`, `encoders`,
`baseScore: 0`, `link: 'logit'`, an optional `platt`, and `trees`. A row goes left when `x <= t`. Every node states
`defaultLeft`, the side a missing value takes. String features go through `encoders`; a value without a code counts as
missing. `ml/parity.mjs` scores a sample of 300 rows per model with `MXA.score` and compares with the training
library's own predictions (`<id>.pred.json`). The difference must be under 1e-6. It is 5e-7 at most, which is
`MXA.score` rounding to six decimals: the unrounded tree sums agree exactly.

## 5. Promotion is manual

Nothing in `ml/`, the workflow or the tests promotes a model. Every exported file says `promoted: false`, and
`MXA.decide` ignores a model unless it is both promoted and calibrated. Today there is nothing to promote: all five
models are rejected challengers. If the owner ever wants one on file, the steps are (owner session, same origin, one
request at a time):

```
POST /api/academy
{ "action": "model.register", "model": { ... } }     the "register" object of that model in ml/models/index.json, as it is
```

For example, for nq-open the body is:

```json
{ "action": "model.register", "model": { "name": "academy-scorer-nq-open", "version": "nq-open-31e519e5dd",
  "kind": "gbt-binary", "edge": "nq-open", "status": "challenger", "metrics": { "...": "the numbers above" },
  "datasetVersion": "9035174e215f", "trainedOn": { "pool": "train", "rows": 327, "from": "2020-01-08", "to": "2026-09-28" },
  "artifact": "ml/models/nq-open-31e519e5dd.json", "hash": "...", "notes": "REJECTED CHALLENGER. ..." } }
```

The reply carries the registry id (`model.id`). Promotion is a second, explicit request:

```json
{ "action": "model.promote", "id": "<the id from the reply>", "confirm": true, "reason": "why, in the owner's words" }
```

and `{ "action": "model.rollback", "confirm": true, "reason": "..." }` undoes the last promotion. The registry is a
record only. The page does not load a model file yet; that wiring, and setting `promoted: true` in the file the page
loads, are separate steps the owner has to ask for.

The GitHub workflow `academy-train.yml` runs only when started by hand. It rebuilds the features, runs the policy check,
trains, runs parity and the tests, and uploads the results as an artifact. It commits and pushes nothing.

## 6. Limits

- **Two candle feeds.** Features, candidates and outcomes come from HistData M1 candles. The page replays candles from
  the live candle proxy. Prices differ by a small feed basis, the daily bar on the proxy may not match bar for bar, and
  the proxy has gaps of its own. A feature computed live can differ from the stored one for the same moment.
- **The research clock.** Corrected on 10 Nov 2026 (`docs/academy/DATA-CLOCK.md`): the loaders convert the HistData
  labels with `council/histdata.mjs`. 101 candidates still carry `rule.clockShift`: their week could not be verified
  against a second feed (most are in the hole of the 2023 files). They have a feature row, but they are out of the
  policy check, the training rows and the exam block. So are the candidates before 2020.
- **Small samples.** 1,476 usable train trades over seven edges; three edges are too small to fit and two more
  (mosha-bo, gtrend) too small to judge the policy on. A t under 2 here means "cannot tell", not "no effect".
- **Many comparisons.** Seven edges and five models were looked at. One t near 2 among them would not be evidence.
- **The exam pool is interleaved in time** with the train pool (whole months), so it is not an out-of-time test. The
  walk-forward is. For the pooled model 314 of 586 exam setups fired while some training trade was open.
- **Calendar from 2022 only**, three release types. Before 2022 the event gate of the policy cannot fire.
- **No dollar index.** The policy's dollar factor is never used in these numbers.
- **The pooled model reads the edge id**, which `MXA.features` does not carry. To score it, the caller must add
  `edge` to the features object. `MXA.decide` does not do that today.
- **gmp** comes from the robustness study's port of the rule (see `MERIDIANX_BUILD_PROGRESS.md`), not the live system.
