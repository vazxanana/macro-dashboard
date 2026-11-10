# ml/: the Academy's offline training service

Paper research only. It reads one file, writes model files, and talks to nothing. The full account (dataset, validation,
results, limits, the manual promotion steps) is in `docs/academy/TRAINING.md`.

## Run it

```sh
# 1. the training table (needs the research candles in a folder OUTSIDE the repo; see docs/academy/TRAINING.md)
ACADEMY_CANDLES=/tmp/academy-candles node academy/gen/features.mjs      # writes ml/data/matrix.json.gz and academy/data/feat-*.json

# 2. train (Python 3.11)
python -m pip install -r ml/requirements.txt
python ml/train.py --edge all                 # every edge with enough data, plus the pooled model
python ml/train.py --edge gmp                 # one edge; the other entries of ml/models/index.json are kept
python ml/train.py --edge all --out /tmp/m    # write somewhere else
python ml/train.py --edge all --no-exam       # walk-forward only; the exam pool is not read

# 3. check that the page's scorer gives the same numbers as the training library
node ml/parity.mjs                            # or: node ml/parity.mjs --dir /tmp/m
```

`ml/data/matrix.json.gz` is committed (about 440 KB), so steps 2 and 3 run without the candles. A run is deterministic:
the same matrix and code give the same files. The GitHub workflow "Academy training (manual)" does all three steps on a
free runner when started by hand, and uploads the results. It commits nothing.

## Files

| Path | What |
|---|---|
| `train.py` | Walk-forward training, baselines, verdict, export. Settings are constants at the top of the file. |
| `parity.mjs` | Scores each exported model with `MXA.score` and compares with `<id>.pred.json`. Fails above 1e-6. |
| `requirements.txt` | Pinned versions. |
| `data/matrix.json.gz` | One row per candidate: label columns, then the 95 feature values. |
| `models/<scope>-<version>.json` | A model in the JSON tree format of `MXA.MODEL_SCHEMA`. Always `promoted: false`. |
| `models/<scope>-<version>.pred.json` | The training library's own predictions on 300 rows, for the parity check. |
| `models/index.json`, `models/report.md` | Rows, folds, metrics, baselines, verdicts, versions. |

## What is claimed

- The scorer estimates P(net R > 0) for a candidate from features known at the signal time.
- It was validated out of time: chronological walk-forward, expanding window, a one-day embargo, no shuffling.
- The exported JSON scores exactly as the training library does (parity under 1e-6; the unrounded sums agree exactly).

## What is not claimed

- **No model here is better than taking every setup.** All five (replica, gtl, gmp, nq-open, pooled) are rejected
  challengers: out-of-fold AUC 0.51 to 0.60 on 99 to 853 trades, and no kept-minus-skipped t reaches 2.
- Three edges (mosha-bo 29 rows, gtrend 19, geg 84) have too few trades to fit at all.
- Nothing is promoted. Promotion is a manual owner action through the API, and there is nothing worth promoting today.
- The exam-pool block is held-out data, not later data, and it was used to choose nothing.
- The settings were fixed before the results were read. Tuning them on these few trades would only fit noise.
