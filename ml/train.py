#!/usr/bin/env python3
"""MeridianX Academy: the offline training service (Layer C of docs/academy/ARCHITECTURE.md).

    python ml/train.py --edge all                 # every edge with enough data, plus the pooled model
    python ml/train.py --edge gmp --out /tmp/m    # one edge, written somewhere else
    python ml/train.py --edge all --no-exam       # walk-forward only; the exam pool is not read

Input   ml/data/matrix.json.gz, written by academy/gen/features.mjs (one row of MXA.features per candidate plus labels).
Output  <out>/<edge>-<version>.json        the model in the JSON tree format MXA.score reads (promoted: false, always)
        <out>/<edge>-<version>.pred.json   this script's own predictions on a sample of rows, for ml/parity.mjs
        <out>/index.json                   rows, date range, folds, metrics, baselines, verdict, versions
        <out>/report.md                    the same numbers as tables

What is fitted: a small gradient-boosted-trees classifier for "net R > 0" on the TRAIN pool, setups that are not flagged
(clock-shifted week, before 2020) and whose order filled. Validation is chronological walk-forward with an expanding
window. A training row is dropped when its trade was still open one day before the test block starts (the embargo), so no
trade sits on both sides of a boundary. There is no shuffled K-fold anywhere in this file.

The settings below were fixed before any result was looked at and are not tuned. Nothing here promotes a model: a model
is a rejected challenger unless it beats "take every setup" out of fold with t >= 2 and in the last fold too, and even
then promotion is a manual owner action through the API. Paper research only: this file places no orders and reads no
network.
"""
import argparse
import datetime
import gzip
import hashlib
import json
import math
import os
import sys

import numpy as np
import lightgbm as lgb
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MATRIX = os.path.join(HERE, "data", "matrix.json.gz")

TRAINER = "gbt-1"            # bump when anything below changes
SEED = 7
MIN_ROWS = 150               # fewer filled, unflagged train trades than this: no model for the edge
FIRST_TRAIN = 0.40           # share of the rows in the first training window
EMBARGO_SEC = 86400          # a training trade must have closed this long before the test block starts
T_LINE = 2.0                 # the t a model must reach out of fold to be called better than taking every setup
KEEP_GRID = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5]   # shares of trades a threshold may drop (never more than half)
PRED_ROWS = 300              # rows kept in a .pred.json for the parity check
LGB_PARAMS = {
    "objective": "binary", "learning_rate": 0.03, "num_leaves": 4, "max_depth": 2, "lambda_l2": 10.0,
    "feature_fraction": 0.5, "bagging_fraction": 0.8, "bagging_freq": 1, "max_bin": 31, "min_data_in_bin": 5,
    "seed": SEED, "deterministic": True, "force_row_wise": True, "num_threads": 1, "verbosity": -1,
}
N_TREES = 120
MIN_LEAF_SHARE = 0.10        # min_data_in_leaf = max(20, 10 % of the training rows)
LOGIT_C = 0.05               # the logistic baseline's inverse penalty (strong)

EDGES = ["replica", "mosha-bo", "gtrend", "gtl", "geg", "gmp", "nq-open"]

# String features become numbers through these maps (exported with the model as `encoders`; MXA.score applies the same
# map and treats a value that is not listed as missing). The order is the natural one where there is one.
_TREND = {"down": -1, "mixed": 0, "up": 1}
_BIAS = {"down": -1, "neutral": 0, "up": 1}
_REGIME = {"low-vol": 0, "ranging": 1, "trending": 2, "breakout": 3, "reversal": 4, "high-vol": 5}
_FOR = {"against": -1, "none": 0, "with": 1}
ENCODERS = {
    "sigTf": {"5m": 0, "15m": 1, "1h": 2, "4h": 3, "1d": 4},
    "structD1": _TREND, "structH4": _TREND, "structH1": _TREND, "structM15": _TREND,
    "maPosD1": {"below": -1, "between": 0, "above": 1}, "maPosH4": {"below": -1, "between": 0, "above": 1},
    "htfBias": _BIAS, "ltfBias": _BIAS,
    "sweep": {"low": -1, "none": 0, "high": 1},
    "sweepOf": {"swing": 0, "session": 1, "pdl": 2, "pdh": 3, "pwl": 4, "pwh": 5},
    "displacement": {"down": -1, "none": 0, "up": 1},
    "fvg": {"bear": -1, "none": 0, "bull": 1},
    "momentum": {"down": -1, "flat": 0, "up": 1},
    "volState": {"low": -1, "normal": 0, "high": 1},
    "session": {"asia": 0, "london": 1, "overlap": 2, "newyork": 3, "late": 4},
    "dow": {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6},
    "entryZone": {"discount": -1, "equilibrium": 0, "premium": 1},
    "regimeBase": _REGIME, "regimeHtf": _REGIME,
    "regimeTrend": {"down": -1, "flat": 0, "up": 1},
    "side": {"sell": -1, "buy": 1},
    "biasAlign": {"against": -1, "neutral": 0, "with": 1}, "ltfAlign": {"against": -1, "neutral": 0, "with": 1},
    "sweepFor": _FOR, "dispFor": _FOR,
    "momFor": {"against": -1, "flat": 0, "with": 1},
    "locFor": {"poor": -1, "mid": 0, "good": 1},
    "confirm": {"against": -1, "weak": 0, "strong": 1},
    "edge": {e: i for i, e in enumerate(EDGES)},
}
# Feature keys that are NOT model inputs, and why.
DROP = {
    "barsOk": "data flag, not market information", "missingTf": "data flag", "eventTitle": "free text",
    "eventNear": "null before 2022 (no calendar): its missingness would mark the era",
    "eventMins": "null before 2022", "eventInH": "null before 2022",
    "regime": "equals regimeBase except for the event override, which exists only from 2022",
    "dxyTrend": "no dollar-index candles: always null", "dxyStrength": "always null", "dxyConflict": "always null",
}


# ---------------------------------------------------------------------------------------------------------------- data
def sha(s):
    return hashlib.sha256(s if isinstance(s, bytes) else s.encode()).hexdigest()


def load_matrix(path):
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        m = json.load(fh)
    lab, keys = m["labelKeys"], m["featureKeys"]
    rows = []
    for r in m["rows"]:
        d = dict(zip(lab, r[: len(lab)]))
        d["f"] = dict(zip(keys, r[len(lab)]))
        rows.append(d)
    return m, rows


def feature_names(m, pooled):
    drop = set(DROP) | set(m["priceKeys"])           # raw price levels do not generalise across years
    names = [k for k in m["featureKeys"] if k not in drop]
    return names + (["edge"] if pooled else [])


def encode(row, names):
    """One row of raw feature values -> floats, NaN for missing. The JavaScript side does the same in MXA.score."""
    out = np.empty(len(names))
    for i, k in enumerate(names):
        v = row["edge"] if k == "edge" else row["f"].get(k)
        if v is None:
            out[i] = np.nan
        elif isinstance(v, bool):
            out[i] = 1.0 if v else 0.0
        elif isinstance(v, (int, float)):
            out[i] = float(v) if math.isfinite(v) else np.nan
        else:
            enc = ENCODERS.get(k)
            if enc is None:
                raise ValueError("string feature without an encoder: %s = %r" % (k, v))
            out[i] = float(enc[v]) if v in enc else np.nan
    return out


def usable(row, pool):
    return (row["pool"] == pool and not row["clockShift"] and not row["pre2020"] and row["filled"]
            and row["f"].get("barsOk") is True)


# ------------------------------------------------------------------------------------------------------------- metrics
def rnd(x, d=4):
    return None if x is None or not math.isfinite(x) else round(float(x), d)


def tstat(a):
    a = np.asarray(a, float)
    if len(a) < 2 or a.std(ddof=1) == 0:
        return None
    return float(a.mean() / (a.std(ddof=1) / math.sqrt(len(a))))


def welch(a, b):
    a, b = np.asarray(a, float), np.asarray(b, float)
    if len(a) < 2 or len(b) < 2:
        return None
    se = math.sqrt(a.var(ddof=1) / len(a) + b.var(ddof=1) / len(b))
    return None if se == 0 else float((a.mean() - b.mean()) / se)


def summary(r):
    r = np.asarray(r, float)
    if len(r) == 0:
        return {"n": 0, "avg": None, "total": 0.0, "t": None}
    return {"n": int(len(r)), "avg": rnd(r.mean()), "total": rnd(r.sum(), 2), "t": rnd(tstat(r), 2)}


def brier(p, y):
    return float(np.mean((np.asarray(p) - np.asarray(y)) ** 2))


def logloss(p, y):
    p = np.clip(np.asarray(p, float), 1e-6, 1 - 1e-6)
    y = np.asarray(y, float)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def auc(p, y):
    y = np.asarray(y)
    if len(set(y.tolist())) < 2 or np.allclose(p, p[0]):
        return None
    return float(roc_auc_score(y, p))


def prob_metrics(p, y, prior):
    """p = predicted P(net R > 0); prior = the constant baseline's probability for the same rows."""
    return {"n": int(len(y)), "winRate": rnd(np.mean(y)), "auc": rnd(auc(p, y)), "brier": rnd(brier(p, y)),
            "brierPrior": rnd(brier(prior, y)), "brierSkill": rnd(1 - brier(p, y) / brier(prior, y)) if brier(prior, y) > 0 else None,
            "logLoss": rnd(logloss(p, y)), "logLossPrior": rnd(logloss(prior, y))}


def calibration(p, y, bins=5):
    order = np.argsort(p, kind="stable")
    out = []
    for part in np.array_split(order, bins):
        if len(part):
            out.append({"n": int(len(part)), "meanP": rnd(np.mean(p[part])), "winRate": rnd(np.mean(y[part]))})
    return out


def pick_threshold(p_ref, r_ref):
    """The keep-threshold from EARLIER predictions only: drop the lowest q of them (q from KEEP_GRID) where that leaves
    the largest total net R; ties keep more trades. q = 0 keeps everything (-inf)."""
    best_q, best_total, best_thr = 0.0, float(np.sum(r_ref)), -math.inf
    for q in KEEP_GRID[1:]:
        thr = float(np.quantile(p_ref, q))
        total = float(np.sum(r_ref[p_ref >= thr]))
        if total > best_total + 1e-12:
            best_q, best_total, best_thr = q, total, thr
    return best_q, best_thr


def trading(p, r, thr, adj=None):
    """Kept (p >= thr) against skipped, in net R a trade. adj = net R with each edge's training mean taken out (pooled
    model only), so a pooled model gets no credit for simply preferring one edge."""
    keep = p >= thr
    z = r if adj is None else adj
    out = {"threshold": None if thr == -math.inf else rnd(thr, 6), "mechanical": summary(r), "kept": summary(r[keep]),
           "skipped": summary(r[~keep]), "keptMinusSkippedT": rnd(welch(z[keep], z[~keep]), 2)}
    if adj is not None:
        out["edgeAdjusted"] = {"kept": rnd(z[keep].mean()) if keep.any() else None, "skipped": rnd(z[~keep].mean()) if (~keep).any() else None}
    return out


# -------------------------------------------------------------------------------------------------------------- models
def fit_gbt(X, y, objective="binary"):
    params = dict(LGB_PARAMS, objective=objective, min_data_in_leaf=max(20, int(MIN_LEAF_SHARE * len(y))))
    return lgb.train(params, lgb.Dataset(X, label=y, free_raw_data=False), num_boost_round=N_TREES)


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-z))


class Logit:
    """The regularised logistic baseline: median fill, standardise (training statistics only), L2 with a strong penalty."""

    def fit(self, X, y):
        with np.errstate(all="ignore"):
            med = np.nanmedian(X, axis=0)
        self.cols = np.where(np.isfinite(med))[0]
        Xc = X[:, self.cols]
        self.med = med[self.cols]
        Xc = np.where(np.isnan(Xc), self.med, Xc)
        self.mu, self.sd = Xc.mean(axis=0), Xc.std(axis=0)
        ok = self.sd > 0
        self.cols, self.med, self.mu, self.sd = self.cols[ok], self.med[ok], self.mu[ok], self.sd[ok]
        self.m = LogisticRegression(C=LOGIT_C, penalty="l2", solver="lbfgs", max_iter=5000)
        self.m.fit(self._z(X), y)
        return self

    def _z(self, X):
        Xc = X[:, self.cols]
        return (np.where(np.isnan(Xc), self.med, Xc) - self.mu) / self.sd

    def predict(self, X):
        return self.m.predict_proba(self._z(X))[:, 1]


def folds_of(t, exit_t):
    """Expanding-window folds over rows sorted by time: (train indices, test indices, test start)."""
    n = len(t)
    k = 4 if n >= 300 else 3
    first = int(round(FIRST_TRAIN * n))
    cuts = [first + int(round(j * (n - first) / k)) for j in range(k + 1)]
    out = []
    for j in range(k):
        a, b = cuts[j], cuts[j + 1]
        start = t[a]
        train = np.array([i for i in range(a) if exit_t[i] + EMBARGO_SEC <= start], dtype=int)
        out.append((train, np.arange(a, b), int(start), a - len(train)))
    return out


def walk_forward(rows, names, pooled):
    X = np.vstack([encode(r, names) for r in rows])
    y = np.array([r["win"] for r in rows], dtype=float)
    R = np.array([r["netR"] for r in rows], dtype=float)
    t = np.array([r["t"] for r in rows])
    ex = np.array([r["exitT"] for r in rows])
    edge = np.array([r["edge"] for r in rows])
    n = len(rows)
    oof = {k: np.full(n, np.nan) for k in ("gbt", "raw", "logit", "prior", "reg", "regPrior", "adj")}
    kept = {"gbt": np.zeros(n, bool), "logit": np.zeros(n, bool)}
    in_test = np.zeros(n, bool)
    fold_id = np.zeros(n, int)
    fold_rows = []
    for j, (tr, te, start, purged) in enumerate(folds_of(t, ex)):
        m = fit_gbt(X[tr], y[tr])
        raw = m.predict(X[te], raw_score=True)
        oof["raw"][te], oof["gbt"][te] = raw, sigmoid(raw)
        oof["logit"][te] = Logit().fit(X[tr], y[tr]).predict(X[te])
        oof["prior"][te] = y[tr].mean()
        oof["reg"][te] = fit_gbt(X[tr], R[tr], "regression").predict(X[te])
        oof["regPrior"][te] = R[tr].mean()
        # net R with the edge's own training mean taken out (used for the pooled model's verdict)
        means = {e: R[tr][edge[tr] == e].mean() if (edge[tr] == e).any() else R[tr].mean() for e in set(edge[te])}
        oof["adj"][te] = R[te] - np.array([means[e] for e in edge[te]])
        # the keep-threshold comes from predictions made BEFORE this block: the earlier test blocks, or for the first
        # block an inner split of its training window (fit on the first 70 %, predict the last 30 %)
        thr = {}
        if j == 0:
            cut = int(round(0.7 * len(tr)))
            inner_te = tr[cut:]
            inner_tr = np.array([i for i in tr[:cut] if ex[i] + EMBARGO_SEC <= t[inner_te[0]]], dtype=int)
            ref = {"gbt": sigmoid(fit_gbt(X[inner_tr], y[inner_tr]).predict(X[inner_te], raw_score=True)),
                   "logit": Logit().fit(X[inner_tr], y[inner_tr]).predict(X[inner_te])}
            ref_r = R[inner_te]
            src = "an inner split of the first training window"
        else:
            ref, ref_r, src = {k: oof[k][in_test] for k in ("gbt", "logit")}, R[in_test], "the earlier test blocks"
        fr = {"fold": j + 1, "trainRows": int(len(tr)), "purged": int(purged), "testRows": int(len(te)), "testFrom": start, "testTo": int(t[te[-1]]),
              "thresholdFrom": src}
        for k in ("gbt", "logit"):
            q, thr[k] = pick_threshold(ref[k], ref_r)
            kept[k][te] = oof[k][te] >= thr[k]
            fr[k] = dict(prob_metrics(oof[k][te], y[te], oof["prior"][te]), dropShare=q, trading=trading(oof[k][te], R[te], thr[k], oof["adj"][te] if pooled else None))
        fr["prior"] = {"p": rnd(y[tr].mean()), "brier": rnd(brier(oof["prior"][te], y[te])), "logLoss": rnd(logloss(oof["prior"][te], y[te]))}
        fold_rows.append(fr)
        in_test[te] = True
        fold_id[te] = j + 1
    return {"fold_id": fold_id, "X": X, "y": y, "R": R, "t": t, "ex": ex, "edge": edge, "oof": oof, "kept": kept, "in_test": in_test, "folds": fold_rows}


def overall(wf, key, pooled):
    te = wf["in_test"]
    p, y, R, keep = wf["oof"][key][te], wf["y"][te], wf["R"][te], wf["kept"][key][te]
    z = wf["oof"]["adj"][te] if pooled else R
    out = prob_metrics(p, y, wf["oof"]["prior"][te])
    out["calibration"] = calibration(p, y)
    if pooled:   # the pooled AUC is helped by win rates that differ between edges; this one is measured inside each edge
        ed, parts = wf["edge"][te], []
        for e in sorted(set(ed.tolist())):
            a = auc(p[ed == e], y[ed == e]) if (ed == e).sum() >= 20 else None
            if a is not None:
                parts.append((int((ed == e).sum()), a))
        out["aucWithinEdge"] = rnd(sum(n * a for n, a in parts) / sum(n for n, _ in parts)) if parts else None
    out["trading"] = {"mechanical": summary(R), "kept": summary(R[keep]), "skipped": summary(R[~keep]), "keptMinusSkippedT": rnd(welch(z[keep], z[~keep]), 2),
                      "keptMinusMechanical": rnd(R[keep].mean() - R.mean()) if keep.any() else None, "tOn": "net R with each edge's training mean taken out" if pooled else "net R"}
    return out


def verdict_of(wf, key, pooled):
    """Better than taking every setup only if: out of fold the kept trades beat the skipped ones with t >= T_LINE, the
    kept trades average more than all trades, and the last fold shows the same (kept above all trades, some skipped)."""
    o = overall(wf, key, pooled)["trading"]
    last = wf["folds"][-1][key]["trading"]
    t = o["keptMinusSkippedT"]
    oof_ok = t is not None and t >= T_LINE and o["keptMinusMechanical"] is not None and o["keptMinusMechanical"] > 0
    last_ok = last["skipped"]["n"] > 0 and last["kept"]["n"] > 0 and last["kept"]["avg"] > last["mechanical"]["avg"]
    if oof_ok and last_ok:
        return True, "beats taking every setup out of fold (kept minus skipped t %s) and in the last fold" % t
    why = []
    if not oof_ok:
        if o["skipped"]["n"] == 0:
            why.append("out of fold its threshold kept every trade")
        elif t is None:
            why.append("out of fold it skipped only %d trade(s), too few for a t" % o["skipped"]["n"])
        else:
            why.append("out of fold the kept trades do not beat the skipped ones (t %s, need %s)" % (t, T_LINE))
    if not last_ok:
        why.append("the last fold does not confirm it")
    return False, "no improvement over taking every setup: " + "; ".join(why)


def platt_of(wf):
    """Platt scaling fitted on the out-of-fold raw scores of every fold but the last, checked on the last fold. It is
    accepted only if, on that last fold, the calibrated Brier score is no worse than the prior-rate one and the mean
    probability is within 0.05 of the win rate. Returns ([a, b] refitted on all folds, the check) or (None, the check)."""
    te = np.where(wf["in_test"])[0]
    is_last = wf["fold_id"][te] == len(wf["folds"])
    raw, y, prior = wf["oof"]["raw"][te], wf["y"][te], wf["oof"]["prior"][te]
    fit = lambda r, yy: LogisticRegression(C=1e6, solver="lbfgs", max_iter=5000).fit(r.reshape(-1, 1), yy)
    if len(set(y[~is_last].tolist())) < 2:
        return None, {"passed": False, "why": "one class only before the last fold"}
    m = fit(raw[~is_last], y[~is_last])
    p = m.predict_proba(raw[is_last].reshape(-1, 1))[:, 1]
    chk = {"n": int(is_last.sum()), "brier": rnd(brier(p, y[is_last])), "brierPrior": rnd(brier(prior[is_last], y[is_last])),
           "meanP": rnd(p.mean()), "winRate": rnd(y[is_last].mean()), "slope": rnd(float(m.coef_[0][0]))}
    chk["passed"] = bool(chk["brier"] <= chk["brierPrior"] and abs(chk["meanP"] - chk["winRate"]) <= 0.05)
    if not chk["passed"]:
        return None, chk
    full = fit(raw, y)
    return [float(full.coef_[0][0]), float(full.intercept_[0])], chk


# -------------------------------------------------------------------------------------------------------------- export
def tree_json(node):
    """A LightGBM dump_model node -> the MXA.MODEL_SCHEMA node. MXA.score sends a row LEFT when x <= t and sends a
    missing value left unless defaultLeft is false. LightGBM does the same when the node's missing_type is NaN; when it
    is None LightGBM reads a missing value as 0, so the default side is where 0 falls."""
    if "split_feature" not in node:
        return {"v": node["leaf_value"]}
    if node["decision_type"] != "<=":
        raise ValueError("only numeric splits can be exported, got " + node["decision_type"])
    thr, mt = node["threshold"], node["missing_type"]
    if mt == "NaN":
        left = bool(node["default_left"])
    elif mt == "None":
        left = 0.0 <= thr
    else:
        raise ValueError("missing_type %s cannot be exported" % mt)
    return {"f": node["split_feature"], "t": thr, "defaultLeft": left, "left": tree_json(node["left_child"]), "right": tree_json(node["right_child"])}


def export_model(booster, mid, edge, names, platt, extra):
    dump = booster.dump_model()
    model = {"version": mid, "edge": edge, "kind": "gradient-boosted trees, binary", "target": "net R > 0", "promoted": False,
             "calibrated": platt is not None, "featureNames": names, "encoders": {k: ENCODERS[k] for k in names if k in ENCODERS},
             "baseScore": 0, "link": "logit"}
    if platt is not None:
        model["platt"] = platt
    model.update(extra)
    model["trees"] = [tree_json(t["tree_structure"]) for t in dump["tree_info"]]
    return model


def score_py(booster, platt, X):
    raw = booster.predict(X, raw_score=True)
    p = sigmoid(platt[0] * raw + platt[1]) if platt is not None else sigmoid(raw)
    return raw, p


# --------------------------------------------------------------------------------------------------------------- train
def iso(t):
    return datetime.datetime.fromtimestamp(int(t), datetime.timezone.utc).strftime("%Y-%m-%d")


def train_one(name, all_rows, m, versions, out_dir, exam):
    pooled = name == "pooled"
    scope = [r for r in all_rows if pooled or r["edge"] == name]
    rows = sorted([r for r in scope if usable(r, "train")], key=lambda r: (r["t"], r["id"]))
    counts = {"candidates": len(scope), "trainRows": len(rows), "from": iso(rows[0]["t"]) if rows else None, "to": iso(rows[-1]["t"]) if rows else None}
    if len(rows) < MIN_ROWS:
        return {"edge": name, "status": "not enough data", "why": "%d filled train trades that are not flagged; %d are needed to fit" % (len(rows), MIN_ROWS), **counts}, None
    names = feature_names(m, pooled)
    wf = walk_forward(rows, names, pooled)
    beats, why = verdict_of(wf, "gbt", pooled)
    platt, platt_check = platt_of(wf)
    te = wf["in_test"]
    # the exported model: every usable train row, same settings
    final = fit_gbt(wf["X"], wf["y"])
    q, thr = pick_threshold(wf["oof"]["gbt"][te], wf["R"][te])   # the threshold a user of the model would start from
    mid = "%s-%s" % (name, sha(json.dumps([TRAINER, versions["matrix"], names, [r["id"] for r in rows], LGB_PARAMS, N_TREES], sort_keys=True))[:10])
    reg_te = wf["oof"]["reg"][te]
    entry = {
        "id": mid, "edge": None if pooled else name, "scope": name, "status": "challenger" if beats else "rejected challenger", "verdict": why, "beatsBaseline": beats,
        "promoted": False, "calibrated": platt is not None, "file": mid + ".json", "pred": mid + ".pred.json", **counts,
        "winRate": rnd(wf["y"].mean()), "netRPerTrade": rnd(wf["R"].mean()), "featureNames": names,
        "validation": {"scheme": "chronological walk-forward, expanding window", "folds": len(wf["folds"]), "firstTrainShare": FIRST_TRAIN, "embargoSec": EMBARGO_SEC,
                       "outOfFoldRows": int(te.sum())},
        "folds": wf["folds"],
        "outOfFold": {"gbt": overall(wf, "gbt", pooled), "logit": overall(wf, "logit", pooled),
                      "prior": {"brier": rnd(brier(wf["oof"]["prior"][te], wf["y"][te])), "logLoss": rnd(logloss(wf["oof"]["prior"][te], wf["y"][te])), "auc": 0.5},
                      "alwaysTake": summary(wf["R"][te])},
        "regressionView": {"what": "secondary: the same trees fitted to net R itself, out of fold", "n": int(te.sum()),
                           "rmse": rnd(math.sqrt(np.mean((reg_te - wf["R"][te]) ** 2))), "rmseTrainMean": rnd(math.sqrt(np.mean((wf["oof"]["regPrior"][te] - wf["R"][te]) ** 2))),
                           "rankCorr": rnd(rank_corr(reg_te, wf["R"][te]))},
        "calibration": {"method": "Platt scaling on out-of-fold raw scores, fitted on all folds but the last and checked on the last", **platt_check},
        "threshold": {"dropShare": q, "p": None if thr == -math.inf else rnd(thr, 6), "from": "all out-of-fold predictions"},
    }
    # the exam pool: read once, after everything above is fixed; nothing is chosen from it
    if exam:
        ex_rows = sorted([r for r in scope if usable(r, "exam")], key=lambda r: (r["t"], r["id"]))
        entry["exam"] = exam_block(ex_rows, rows, names, final, platt, thr, wf, pooled)
    else:
        entry["exam"] = None
    model = export_model(final, mid, None if pooled else name, names, platt, {
        "status": entry["status"], "verdict": why, "trainer": TRAINER, "trainedRows": len(rows), "trainedFrom": counts["from"], "trainedTo": counts["to"],
        "matrixVersion": versions["matrix"], "note": "Scores P(net R > 0). Not promoted. See ml/models/index.json for its validation."
        + (" Pooled model: add the edge id to the features before scoring (features.edge)." if pooled else "")})
    # this script's own predictions on a sample of every row of the scope (flagged and unfilled ones too: the check is
    # about arithmetic, and those rows carry more missing values)
    samp = sorted(scope, key=lambda r: r["id"])
    step = max(1, len(samp) // PRED_ROWS)
    samp = samp[::step][:PRED_ROWS]
    raw, p = score_py(final, platt, np.vstack([encode(r, names) for r in samp]))
    pred = {"model": mid, "what": "predictions of the training library itself on these rows; ml/parity.mjs must reproduce them with MXA.score", "n": len(samp),
            "rows": [{"id": r["id"], "raw": float(a), "p": float(b)} for r, a, b in zip(samp, raw, p)]}
    with open(os.path.join(out_dir, mid + ".json"), "w") as fh:
        json.dump(model, fh, separators=(",", ":"))
        fh.write("\n")
    with open(os.path.join(out_dir, mid + ".pred.json"), "w") as fh:
        json.dump(pred, fh, separators=(",", ":"))
        fh.write("\n")
    entry["hash"] = sha(json.dumps(model, separators=(",", ":"), sort_keys=True))[:16]
    entry["register"] = register_body(entry, versions)
    return entry, model


def register_body(e, versions):
    """The POST body that files this model in the Academy's registry (the owner sends it by hand; see TRAINING.md)."""
    o, tr = e["outOfFold"]["gbt"], e["outOfFold"]["gbt"]["trading"]
    metrics = {"oofN": o["n"], "oofAuc": o["auc"], "oofBrier": o["brier"], "oofBrierPrior": o["brierPrior"], "oofLogLoss": o["logLoss"],
               "mechanicalR": tr["mechanical"]["avg"], "keptN": tr["kept"]["n"], "keptR": tr["kept"]["avg"], "skippedN": tr["skipped"]["n"], "skippedR": tr["skipped"]["avg"],
               "keptMinusSkippedT": tr["keptMinusSkippedT"], "beatsBaseline": "yes" if e["beatsBaseline"] else "no", "calibrated": "yes" if e["calibrated"] else "no"}
    x = e.get("exam")
    if x and "gbt" in x:
        metrics.update({"examN": x["gbt"]["n"], "examAuc": x["gbt"]["auc"], "examBrier": x["gbt"]["brier"], "examBrierPrior": x["gbt"]["brierPrior"]})
    return {"action": "model.register", "model": {
        "name": "academy-scorer-" + e["scope"], "version": e["id"], "kind": "gbt-binary", "edge": e["edge"], "status": "challenger", "metrics": metrics,
        "datasetVersion": versions["matrix"], "trainedOn": {"pool": "train", "rows": e["trainRows"], "from": e["from"], "to": e["to"]},
        "artifact": "ml/models/" + e["file"], "hash": e["hash"],
        "notes": ("REJECTED CHALLENGER. " if not e["beatsBaseline"] else "") + e["verdict"] + ". Do not promote without the owner reading ml/models/report.md."}}


def rank_corr(a, b):
    ra, rb = np.argsort(np.argsort(a, kind="stable")), np.argsort(np.argsort(b, kind="stable"))
    return None if np.std(ra) == 0 or np.std(rb) == 0 else float(np.corrcoef(ra, rb)[0, 1])


def exam_block(ex_rows, train_rows, names, final, platt, thr, wf, pooled):
    if len(ex_rows) < 10:
        return {"n": len(ex_rows), "note": "too few exam rows to report"}
    X = np.vstack([encode(r, names) for r in ex_rows])
    y = np.array([r["win"] for r in ex_rows], dtype=float)
    R = np.array([r["netR"] for r in ex_rows], dtype=float)
    _, p = score_py(final, platt, X)
    prior = np.full(len(y), wf["y"].mean())
    adj = None
    if pooled:
        means = {e: wf["R"][wf["edge"] == e].mean() for e in set(wf["edge"])}
        adj = R - np.array([means.get(r["edge"], wf["R"].mean()) for r in ex_rows])
    lg = Logit().fit(wf["X"], wf["y"]).predict(X)
    q, lthr = pick_threshold(wf["oof"]["logit"][wf["in_test"]], wf["R"][wf["in_test"]])
    spans = sorted((r["t"], r["exitT"]) for r in train_rows)
    inside = sum(1 for r in ex_rows if any(a <= r["t"] <= b for a, b in spans))
    return {"what": "the exam pool (whole calendar months held out when the candidates were made), read once after the walk-forward verdict was fixed. It is used to choose nothing.",
            "from": iso(ex_rows[0]["t"]), "to": iso(ex_rows[-1]["t"]),
            "gbt": dict(prob_metrics(p, y, prior), trading=trading(p, R, thr, adj)),
            "logit": dict(prob_metrics(lg, y, prior), trading=trading(lg, R, lthr, adj)),
            "alwaysTake": summary(R),
            "limit": "exam months lie between training months, so this is held-out data but not later data; %d of the %d exam setups fired while a training trade was open" % (inside, len(ex_rows))}


# -------------------------------------------------------------------------------------------------------------- report
def fmt(x, d=3):
    return "n/a" if x is None else ("%.*f" % (d, x))


def report_md(index):
    L = ["# Academy scorer: training report", "",
         "Generated by `python ml/train.py`. Data version %s (matrix %s). Trainer %s." % (index["data"]["dataVersion"], index["data"]["matrixVersion"], index["trainer"]), "",
         "Target: P(net R > 0). Train pool only, setups that are not flagged, filled trades. Walk-forward, expanding window, %d-second embargo." % EMBARGO_SEC,
         "A model is better than taking every setup only with an out-of-fold t of at least %s and the same in the last fold. No model is promoted here." % T_LINE, ""]
    L += ["## Verdicts", "", "| Scope | Train rows | Period | Status | Out-of-fold n | AUC | Brier | Prior Brier | Kept n | Kept R | Skipped n | Skipped R | t |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for e in index["models"]:
        o, tr = e["outOfFold"]["gbt"], e["outOfFold"]["gbt"]["trading"]
        L.append("| %s | %d | %s to %s | %s | %d | %s | %s | %s | %d | %s | %d | %s | %s |" % (e["scope"], e["trainRows"], e["from"], e["to"], e["status"], o["n"], fmt(o["auc"]), fmt(o["brier"], 4), fmt(o["brierPrior"], 4),
                 tr["kept"]["n"], fmt(tr["kept"]["avg"]), tr["skipped"]["n"], fmt(tr["skipped"]["avg"]), fmt(tr["keptMinusSkippedT"], 2)))
    for s in index["skipped"]:
        L.append("| %s | %d | %s to %s | not enough data | | | | | | | | | |" % (s["edge"], s["trainRows"], s["from"], s["to"]))
    L.append("")
    for e in index["models"]:
        L += ["## %s (%s)" % (e["scope"], e["id"]), "", e["verdict"][0].upper() + e["verdict"][1:] + ".", "",
              "Train rows %d, win rate %s, net R a trade %s. Calibrated: %s." % (e["trainRows"], fmt(e["winRate"]), fmt(e["netRPerTrade"]), "yes" if e["calibrated"] else "no"), "",
              "| Fold | Train | Test | Model | AUC | Brier | Prior Brier | Log loss | Mechanical R | Kept n | Kept R | Skipped n | Skipped R | t |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
        for f in e["folds"]:
            for k, label in (("gbt", "trees"), ("logit", "logistic")):
                x, tr = f[k], f[k]["trading"]
                L.append("| %d | %d | %d | %s | %s | %s | %s | %s | %s | %d | %s | %d | %s | %s |" % (f["fold"], f["trainRows"], f["testRows"], label, fmt(x["auc"]), fmt(x["brier"], 4), fmt(x["brierPrior"], 4), fmt(x["logLoss"], 4),
                         fmt(tr["mechanical"]["avg"]), tr["kept"]["n"], fmt(tr["kept"]["avg"]), tr["skipped"]["n"], fmt(tr["skipped"]["avg"]), fmt(tr["keptMinusSkippedT"], 2)))
        for k, label in (("gbt", "trees"), ("logit", "logistic")):
            x, tr = e["outOfFold"][k], e["outOfFold"][k]["trading"]
            L.append("| all | | %d | %s | %s | %s | %s | %s | %s | %d | %s | %d | %s | %s |" % (x["n"], label, fmt(x["auc"]), fmt(x["brier"], 4), fmt(x["brierPrior"], 4), fmt(x["logLoss"], 4),
                     fmt(tr["mechanical"]["avg"]), tr["kept"]["n"], fmt(tr["kept"]["avg"]), tr["skipped"]["n"], fmt(tr["skipped"]["avg"]), fmt(tr["keptMinusSkippedT"], 2)))
        L += ["", "Calibration out of fold (five equal bins by predicted probability): " + "; ".join("p %s -> won %s (n %d)" % (fmt(b["meanP"]), fmt(b["winRate"]), b["n"]) for b in e["outOfFold"]["gbt"]["calibration"]) + ".", ""]
        if e["outOfFold"]["gbt"].get("aucWithinEdge") is not None:
            L += ["The pooled AUC is helped by win rates that differ from edge to edge. Measured inside each edge it is %s." % fmt(e["outOfFold"]["gbt"]["aucWithinEdge"]), ""]
        rv = e["regressionView"]
        L += ["Regression view (secondary): out-of-fold RMSE %s against %s for the training mean; rank correlation with net R %s (n %d)." % (fmt(rv["rmse"]), fmt(rv["rmseTrainMean"]), fmt(rv["rankCorr"]), rv["n"]), ""]
        x = e.get("exam")
        if x and "gbt" in x:
            g, tr = x["gbt"], x["gbt"]["trading"]
            L += ["### Exam pool (separate; read once; chooses nothing)", "",
                  "%s to %s, n %d. AUC %s, Brier %s against %s for the prior rate. Take every setup: %s R a trade (t %s). Kept n %d at %s R, skipped n %d at %s R, t %s. %s." % (
                      x["from"], x["to"], g["n"], fmt(g["auc"]), fmt(g["brier"], 4), fmt(g["brierPrior"], 4), fmt(x["alwaysTake"]["avg"]), fmt(x["alwaysTake"]["t"], 2),
                      tr["kept"]["n"], fmt(tr["kept"]["avg"]), tr["skipped"]["n"], fmt(tr["skipped"]["avg"]), fmt(tr["keptMinusSkippedT"], 2), x["limit"][0].upper() + x["limit"][1:]), ""]
        elif x:
            L += ["### Exam pool", "", "n %d: %s." % (x["n"], x["note"]), ""]
    return "\n".join(L) + "\n"


def main():
    ap = argparse.ArgumentParser(description="Train the Academy scorer (offline, walk-forward).")
    ap.add_argument("--edge", default="all", help="an edge id, 'pooled' or 'all'")
    ap.add_argument("--out", default=os.path.join(HERE, "models"))
    ap.add_argument("--matrix", default=MATRIX)
    ap.add_argument("--no-exam", action="store_true", help="do not read the exam pool")
    a = ap.parse_args()
    if not os.path.exists(a.matrix):
        sys.exit("No feature matrix at %s. Make it first: ACADEMY_CANDLES=<folder> node academy/gen/features.mjs" % a.matrix)
    m, rows = load_matrix(a.matrix)
    scopes = EDGES + ["pooled"] if a.edge == "all" else [a.edge]
    if any(s not in EDGES + ["pooled"] for s in scopes):
        sys.exit("unknown edge: " + a.edge)
    os.makedirs(a.out, exist_ok=True)
    versions = {"matrix": m["version"]}
    models, skipped = [], []
    index_path = os.path.join(a.out, "index.json")
    if a.edge == "all":                                   # a full run replaces the folder's models
        for f in os.listdir(a.out):
            if f.endswith(".json") or f == "report.md":
                os.remove(os.path.join(a.out, f))
    elif os.path.exists(index_path):                      # one edge: keep the other entries of the same data version
        with open(index_path) as fh:
            old = json.load(fh)
        if old["data"]["matrixVersion"] != m["version"] or old["trainer"] != TRAINER or old["examRead"] != (not a.no_exam):
            sys.exit("The models in %s were made from other data or settings. Run --edge all." % a.out)
        for e in old["models"]:
            if e["scope"] == a.edge:
                for f in (e["file"], e["pred"]):
                    if os.path.exists(os.path.join(a.out, f)):
                        os.remove(os.path.join(a.out, f))
        models = [e for e in old["models"] if e["scope"] != a.edge]
        skipped = [e for e in old["skipped"] if e["edge"] != a.edge]
    for s in scopes:
        entry, model = train_one(s, rows, m, versions, a.out, not a.no_exam)
        (models if model else skipped).append(entry)
        if model:
            o = entry["outOfFold"]["gbt"]
            print("%-9s rows %4d  oof n %4d  auc %s  brier %s (prior %s)  kept-skipped t %s  -> %s" % (s, entry["trainRows"], o["n"], fmt(o["auc"]), fmt(o["brier"], 4), fmt(o["brierPrior"], 4), fmt(o["trading"]["keptMinusSkippedT"], 2), entry["status"]))
        else:
            print("%-9s rows %4d  -> not enough data" % (s, entry["trainRows"]))
    order = {s: i for i, s in enumerate(EDGES + ["pooled"])}
    models.sort(key=lambda e: order[e["scope"]])
    skipped.sort(key=lambda e: order[e["edge"]])
    with open(os.path.abspath(__file__), "rb") as fh:
        code = sha(fh.read())[:12]
    index = {
        "generated": m["generated"], "trainer": TRAINER, "code": {"train.py": code},
        "libraries": {"lightgbm": lgb.__version__, "numpy": np.__version__, "scikit-learn": __import__("sklearn").__version__},
        "data": {"matrixVersion": m["version"], "featVersions": m["featVersions"], "dataVersion": m["dataVersion"], "policy": m["policy"]},
        "target": "net R > 0 (binary)", "rows": "train pool, not flagged (clock-shifted week, before 2020), filled trades, every needed timeframe present",
        "settings": {"minRows": MIN_ROWS, "firstTrainShare": FIRST_TRAIN, "embargoSec": EMBARGO_SEC, "tLine": T_LINE, "keepGrid": KEEP_GRID, "trees": N_TREES, "minLeafShare": MIN_LEAF_SHARE,
                     "lightgbm": LGB_PARAMS, "logitC": LOGIT_C, "seed": SEED},
        "notInputs": dict(DROP, **{k: "raw price level" for k in m["priceKeys"]}),
        "verdictRule": "A model beats taking every setup only if, out of fold, the trades it keeps beat the trades it skips with a Welch t of at least %s (threshold chosen on earlier predictions only), the kept trades average more than all trades, and the last fold shows the same. Otherwise: rejected challenger." % T_LINE,
        "promotion": "manual, by the owner, through the API (model.register then model.promote). Nothing here promotes a model.",
        "examRead": not a.no_exam, "models": models, "skipped": skipped,
    }
    with open(os.path.join(a.out, "index.json"), "w") as fh:
        json.dump(index, fh, indent=1)
        fh.write("\n")
    with open(os.path.join(a.out, "report.md"), "w") as fh:
        fh.write(report_md(index))
    print("wrote %d model(s), %d skipped -> %s" % (len(models), len(skipped), a.out))


if __name__ == "__main__":
    main()
