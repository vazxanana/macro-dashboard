# ml/: the Academy's offline training service

Paper research only. It reads one file, writes model files, and talks to nothing. The full account (dataset, validation,
results, limits, the manual promotion steps, the review of 10 Nov 2026) is in `docs/academy/TRAINING.md`.

## Run it

```sh
# 1. the training table (needs the research candles in a folder OUTSIDE the repo; see docs/academy/TRAINING.md)
ACADEMY_CANDLES=/tmp/academy-candles node academy/gen/features.mjs      # writes ml/data/matrix.json.gz and academy/data/feat-*.json

# 2. train (Python 3.11)
python -m pip install -r ml/requirements.txt
python ml/train.py                              # every configuration and scope -> ml/models (about 10 s)
python ml/train.py --out /tmp/m                 # write somewhere else
python ml/train.py --config gbt --out /tmp/m    # one configuration: a partial run, never written into ml/models

# 3. check that the page's scorer gives the same numbers as the training library
node ml/parity.mjs                              # or: node ml/parity.mjs --dir /tmp/m

# 4. the audit (features, labels, leakage, power, overfitting, calibration, regimes)
python ml/review.py                             # -> research/edge/academy-ml-review/result.json and RESULT.md (about 4 minutes)
```

`ml/data/matrix.json.gz` is committed (about 440 KB), so steps 2 to 4 run without the candles. A run is deterministic:
the same matrix and code give the same files. The GitHub workflow "Academy training (manual)" does steps 1 to 3 on a
free runner when started by hand, and uploads the results. It commits nothing.

## Files

| Path | What |
|---|---|
| `train.py` | Walk-forward training of five pre-registered configurations, the acceptance rule, the Holm family, export. Settings are constants at the top of the file. Trainer `wf-2`. |
| `review.py` | The training review: audits the data and the trainer and writes `research/edge/academy-ml-review/`. It keeps no model. |
| `parity.mjs` | Scores each exported tree scorer with `MXA.score` and compares with `<id>.pred.json`. Fails above 1e-6. |
| `requirements.txt` | Pinned versions. |
| `data/matrix.json.gz` | One row per candidate: label columns, then the 95 feature values. The trainer keeps the train-pool rows and drops the rest unread. |
| `models/<id>.json` | A tree scorer in the JSON tree format of `MXA.MODEL_SCHEMA`. Always `promoted: false`. A linear scorer has no file. |
| `models/<id>.pred.json` | The training library's own predictions on up to 300 train-pool rows, for the parity check. |
| `models/index.json`, `models/report.md` | Rows, folds, metrics, baselines, the test family, verdicts, versions. |
| `archive/gbt-1/` | The first trainer's index and report (before the review), kept as a record. It holds the exam-pool numbers that trainer printed. |

## What is claimed

- Each scorer was validated out of time: chronological walk-forward, expanding window, an embargo as long as the edge's
  longest label window, thresholds chosen on closed trades only, no shuffling.
- The trainer cannot read the exam pool: its loader drops those rows, and a run on a matrix whose exam rows are noise
  gives the same bytes.
- The exported JSON scores exactly as the training library does (parity under 1e-6; the unrounded sums agree exactly).

## What is not claimed

- **No scorer here is better than taking every setup.** All 20 (the reference on five scopes and four challenger
  configurations) are rejected challengers: out-of-fold AUC 0.43 to 0.59 on 100 to 886 trades, the best
  kept-minus-skipped t is 0.95, and no test of a scorer survives the correction for 42 tests.
- Three edges (mosha-bo 28 rows, gtrend 18, geg 82) have too few trades to fit at all.
- Nothing is promoted. Promotion is a manual owner action through the API, and there is nothing worth promoting today.
- No number from these scorers is a probability to show: none beats the prior rate out of fold.
- The settings were fixed before the results were read (`research/edge/academy-ml-review/PREREGISTRATION.md`). Tuning
  them on these few trades would only fit noise.
