#!/usr/bin/env python3
"""MeridianX Academy: the offline training service (Layer C of docs/academy/ARCHITECTURE.md).

    python ml/train.py                            # every configuration and scope; writes ml/models
    python ml/train.py --out /tmp/m               # the same, written somewhere else
    python ml/train.py --config gbt --out /tmp/m  # one configuration (a partial run: never written into ml/models)

Input   ml/data/matrix.json.gz, written by academy/gen/features.mjs (one row of MXA.features per candidate plus labels).
Output  <out>/<id>.json        a tree scorer in the JSON format MXA.score reads (promoted: false, always)
        <out>/<id>.pred.json   this script's own predictions on a sample of rows, for ml/parity.mjs
        <out>/index.json       rows, date range, folds, metrics, baselines, the test family, verdicts, versions
        <out>/report.md        the same numbers as tables

THE EXAM POOL CANNOT BE READ HERE. load_matrix() drops every row whose pool is not 'train' before its labels or its
features are unpacked, and nothing else in this file opens a data file. There is no exam block and no flag that brings
one back. (Two earlier runs of the first trainer read exam-pool aggregates; that record is ml/archive/gbt-1.)

What is fitted: the configurations in CONFIGS, on the TRAIN pool, setups that are not flagged (clock-shifted week,
before 2020) and whose order filled. Validation is chronological walk-forward with an expanding window. A training row
enters a fold only when its label window had closed before the test block starts (the embargo: the edge's longest
signal-to-exit time, see label_windows). The keep-threshold of a block is chosen on earlier predictions whose trades had
closed by then. There is no shuffled K-fold anywhere in this file.

The settings were fixed in research/edge/academy-ml-review/PREREGISTRATION.md before any result was looked at and are not
tuned. Nothing here promotes a model: a scorer is a rejected challenger unless it passes every line of the acceptance
rule (acceptance()), and one that passes is only marked as having passed validation. Promotion is a manual owner action
through the API. Paper research only: this file places no orders and reads no network.
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
from scipy import stats as sps
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import roc_auc_score

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MATRIX = os.path.join(HERE, "data", "matrix.json.gz")

TRAINER = "wf-2"             # the validation protocol and report format; bump when anything below changes
SEED = 7
MIN_ROWS = 150               # fewer filled, unflagged train trades than this: no scorer for the edge
FIRST_TRAIN = 0.40           # share of the rows in the first training window
T_LINE = 2.0                 # the t a scorer must reach out of fold
P_LINE = float(sps.norm.sf(T_LINE))          # 0.02275: the one-sided tail of t = 2, the line for the Holm-corrected p
KEEP_GRID = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5]   # shares of trades a threshold may drop (never more than half)
PRED_ROWS = 300              # rows kept in a .pred.json for the parity check
MAIN = "gbt"                 # the key an entry's own scorer is stored under, whatever its kind (the page reads this key)

EDGES = ["replica", "mosha-bo", "gtrend", "gtl", "geg", "gmp", "nq-open"]

# The embargo. A label is the result of a position, and a position can stay open for as long as its rule allows:
# order life plus maximum hold, in hours, from academy/edges.mjs (None = the rule has no time limit). A pyramid add
# shares its first unit's deadline but may close after the first unit's recorded exit, so the recorded exit alone is not
# the end of the label. label_windows() takes the larger of this bound and the longest signal-to-exit time seen in the
# edge's usable train rows, plus a weekend.
RULE_WINDOW_H = {"replica": 48, "mosha-bo": 24 + 72, "gtrend": None, "gtl": 96, "geg": 480 + 240, "gmp": 8, "nq-open": 2}
WEEKEND_SEC = 72 * 3600

# C0: the reference scorer, settings unchanged since the first trainer (its fit id stays gbt-1, so its files keep their ids)
LGB_PARAMS = {
    "objective": "binary", "learning_rate": 0.03, "num_leaves": 4, "max_depth": 2, "lambda_l2": 10.0,
    "feature_fraction": 0.5, "bagging_fraction": 0.8, "bagging_freq": 1, "max_bin": 31, "min_data_in_bin": 5,
    "seed": SEED, "deterministic": True, "force_row_wise": True, "num_threads": 1, "verbosity": -1,
}
N_TREES = 120
MIN_LEAF_SHARE = 0.10        # min_data_in_leaf = max(20, 10 % of the training rows)
LOGIT_C = 0.05               # the 70-input logistic line's inverse penalty (strong)

# The short list (pre-registered): the decision policy's five side-relative factors and two state numbers.
SHORT = ["biasAlign", "ltfAlign", "momFor", "locFor", "confirm", "stopAtr", "atrPctile"]
MONOTONE_UP = ["biasAlign", "ltfAlign", "momFor", "locFor", "confirm"]   # the signs the decision policy itself states
MONO_PARAMS = {
    "objective": "binary", "learning_rate": 0.05, "num_leaves": 2, "max_depth": 1, "lambda_l2": 10.0,
    "feature_fraction": 1.0, "bagging_fraction": 1.0, "bagging_freq": 0, "max_bin": 31, "min_data_in_bin": 5,
    "seed": SEED, "deterministic": True, "force_row_wise": True, "num_threads": 1, "verbosity": -1,
}
MONO_TREES = 60
SHORT_C = 0.1                # C1 and C3: the logistic's inverse penalty
RIDGE_ALPHA = 100.0          # C4

# kind: trees | logistic | ridge. scopes: 'edges' = every edge with MIN_ROWS usable rows; 'pooled' = one scorer over all
# seven. pooledEdge: how a pooled scorer reads the edge ('code' = one ordinal input, 'onehot' = one intercept per edge).
CONFIGS = {
    "gbt": {"label": None, "what": "C0, the reference: gradient-boosted trees (depth 2, 120 trees) on 70 inputs", "kind": "trees", "fit": "gbt-1",
            "features": "all", "scopes": ["edges", "pooled"], "pooledEdge": "code", "params": LGB_PARAMS, "trees": N_TREES, "logitLine": True},
    "logit-short": {"label": "logit-short", "what": "C1: logistic regression, L2 (C 0.1), the 7 short-list inputs", "kind": "logistic", "fit": "logit-short-1",
                    "features": SHORT, "scopes": ["edges"], "C": SHORT_C},
    "mono-gbt": {"label": "mono-gbt", "what": "C2: boosted stumps (depth 1, 60 trees) on the short list, non-decreasing in the policy's five factors", "kind": "trees", "fit": "mono-gbt-1",
                 "features": SHORT, "scopes": ["edges", "pooled"], "pooledEdge": "code", "params": MONO_PARAMS, "trees": MONO_TREES, "monotoneUp": MONOTONE_UP},
    "pooled-logit": {"label": "pooled-logit", "what": "C3: one logistic regression (C 0.1) over all seven edges, the short list plus one intercept per edge", "kind": "logistic", "fit": "pooled-logit-1",
                     "features": SHORT, "scopes": ["pooled"], "pooledEdge": "onehot", "C": SHORT_C},
    "ridge-netR": {"label": "ridge-netR", "what": "C4: ridge regression of net R (alpha 100), the short list; its output is an expected R, never a probability", "kind": "ridge", "fit": "ridge-netR-1",
                   "features": SHORT, "scopes": ["edges", "pooled"], "pooledEdge": "onehot", "alpha": RIDGE_ALPHA},
}

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
    """The training table, TRAIN POOL ONLY. A row of any other pool is counted by its edge and skipped: its label
    columns and its feature values are never unpacked, and the raw table is released before this returns."""
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        m = json.load(fh)
    lab, keys = m["labelKeys"], m["featureKeys"]
    i_pool, i_edge, nl = lab.index("pool"), lab.index("edge"), len(lab)
    rows, dropped = [], {}
    for r in m["rows"]:
        if r[i_pool] != "train":
            dropped[r[i_edge]] = dropped.get(r[i_edge], 0) + 1
            continue
        d = dict(zip(lab, r[:nl]))
        d["f"] = dict(zip(keys, r[nl]))
        rows.append(d)
    m["rows"] = None
    m["notTrainDropped"] = dropped
    return m, rows


def feature_names(m, cfg, pooled):
    if cfg["features"] == "all":
        drop = set(DROP) | set(m["priceKeys"])       # raw price levels do not generalise across years
        names = [k for k in m["featureKeys"] if k not in drop]
    else:
        names = list(cfg["features"])
    if pooled:
        names += ["edge"] if cfg["pooledEdge"] == "code" else ["edge=" + e for e in EDGES]
    return names


def encode(row, names):
    """One row of raw feature values -> floats, NaN for missing. The JavaScript side does the same in MXA.score."""
    out = np.empty(len(names))
    for i, k in enumerate(names):
        if k.startswith("edge="):
            out[i] = 1.0 if row["edge"] == k[5:] else 0.0
            continue
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


def usable(row):
    if row["pool"] != "train":
        raise RuntimeError("a row outside the train pool reached the trainer: " + str(row.get("id")))
    return not row["clockShift"] and not row["pre2020"] and row["filled"] and row["f"].get("barsOk") is True


def label_windows(rows):
    """Seconds from a signal to the latest moment its label can still change, per edge (see RULE_WINDOW_H)."""
    out = {}
    for e in EDGES:
        seen = max((r["exitT"] - r["t"] for r in rows if r["edge"] == e), default=0)
        rule = RULE_WINDOW_H[e]
        out[e] = int(max(seen, rule * 3600 if rule else 0) + WEEKEND_SEC)
    return out


# ------------------------------------------------------------------------------------------------------------- metrics
def rnd(x, d=4):
    return None if x is None or not math.isfinite(x) else round(float(x), d)


def tstat(a):
    a = np.asarray(a, float)
    if len(a) < 2 or a.std(ddof=1) == 0:
        return None
    return float(a.mean() / (a.std(ddof=1) / math.sqrt(len(a))))


def welch_full(a, b):
    """Welch's t for mean(a) - mean(b), its degrees of freedom and the one-sided p of 'a is better'."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    if len(a) < 2 or len(b) < 2:
        return None
    va, vb = a.var(ddof=1) / len(a), b.var(ddof=1) / len(b)
    if va + vb == 0:
        return None
    t = float((a.mean() - b.mean()) / math.sqrt(va + vb))
    df = float((va + vb) ** 2 / ((va ** 2 / (len(a) - 1) if va > 0 else 0) + (vb ** 2 / (len(b) - 1) if vb > 0 else 0)))
    return {"t": t, "df": df, "p": float(sps.t.sf(t, df)), "diff": float(a.mean() - b.mean())}


def welch(a, b):
    w = welch_full(a, b)
    return None if w is None else w["t"]


def holm(ps):
    """Holm's step-down correction: the adjusted p of each test, in the order given."""
    m, order, out, run = len(ps), np.argsort(ps, kind="stable"), [0.0] * len(ps), 0.0
    for rank, i in enumerate(order):
        run = max(run, min(1.0, (m - rank) * ps[i]))
        out[i] = run
    return out


def summary(r):
    r = np.asarray(r, float)
    if len(r) == 0:
        return {"n": 0, "avg": None, "total": 0.0, "t": None}
    return {"n": int(len(r)), "avg": rnd(r.mean()), "total": rnd(r.sum(), 2), "t": rnd(tstat(r), 2)}


def max_dd(r):
    """The deepest fall of the running total of r (in the order given) below its earlier peak, as a positive number."""
    if len(r) == 0:
        return 0.0
    c = np.concatenate([[0.0], np.cumsum(np.asarray(r, float))])
    return float(np.max(np.maximum.accumulate(c) - c))


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


def reg_metrics(s, y, R, prior_r):
    """s = predicted net R. It is a ranking score and an expected R, never a probability: no Brier score."""
    return {"n": int(len(y)), "winRate": rnd(np.mean(y)), "auc": rnd(auc(s, y)), "brier": None, "brierPrior": None, "brierSkill": None,
            "logLoss": None, "logLossPrior": None, "mse": rnd(np.mean((s - R) ** 2)), "msePrior": rnd(np.mean((prior_r - R) ** 2)),
            "rankCorr": rnd(rank_corr(s, R))}


def calibration(p, y, R=None, bins=5):
    order = np.argsort(p, kind="stable")
    out = []
    for part in np.array_split(order, bins):
        if len(part):
            b = {"n": int(len(part)), "meanP": rnd(np.mean(p[part])), "winRate": rnd(np.mean(y[part]))}
            if R is not None:
                b = {"n": int(len(part)), "meanScore": rnd(np.mean(p[part])), "meanR": rnd(np.mean(R[part])), "winRate": rnd(np.mean(y[part]))}
            out.append(b)
    return out


def rank_corr(a, b):
    ra, rb = np.argsort(np.argsort(a, kind="stable")), np.argsort(np.argsort(b, kind="stable"))
    return None if np.std(ra) == 0 or np.std(rb) == 0 else float(np.corrcoef(ra, rb)[0, 1])


def pick_threshold(p_ref, r_ref):
    """The keep-threshold from EARLIER predictions only: drop the lowest q of them (q from KEEP_GRID) where that leaves
    the largest total net R; ties keep more trades. q = 0 keeps everything (-inf)."""
    best_q, best_thr = 0.0, -math.inf
    if len(p_ref) == 0:
        return best_q, best_thr
    best_total = float(np.sum(r_ref))
    for q in KEEP_GRID[1:]:
        thr = float(np.quantile(p_ref, q))
        total = float(np.sum(r_ref[p_ref >= thr]))
        if total > best_total + 1e-12:
            best_q, best_total, best_thr = q, total, thr
    return best_q, best_thr


def trading(p, r, thr, adj=None):
    """Kept (p >= thr) against skipped, in net R a trade. adj = net R with each edge's training mean taken out (pooled
    scorers only), so a pooled scorer gets no credit for simply preferring one edge."""
    keep = p >= thr
    z = r if adj is None else adj
    out = {"threshold": None if thr == -math.inf else rnd(thr, 6), "mechanical": summary(r), "kept": summary(r[keep]),
           "skipped": summary(r[~keep]), "keptMinusSkippedT": rnd(welch(z[keep], z[~keep]), 2)}
    if adj is not None:
        out["edgeAdjusted"] = {"kept": rnd(z[keep].mean()) if keep.any() else None, "skipped": rnd(z[~keep].mean()) if (~keep).any() else None}
    return out


# -------------------------------------------------------------------------------------------------------------- models
def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-z))


def fit_gbt(X, y, params, trees, names=None, mono=None):
    p = dict(params, min_data_in_leaf=max(20, int(MIN_LEAF_SHARE * len(y))))
    if mono:
        p["monotone_constraints"] = [1 if k in mono else 0 for k in names]
    return lgb.train(p, lgb.Dataset(X, label=y, free_raw_data=False), num_boost_round=trees)


class Scaler:
    """Median fill and standardising, from the training rows only. A column that is all-missing or constant is dropped."""

    def fit(self, X):
        with np.errstate(all="ignore"):
            med = np.nanmedian(X, axis=0)
        self.cols = np.where(np.isfinite(med))[0]
        Xc = X[:, self.cols]
        self.med = med[self.cols]
        Xc = np.where(np.isnan(Xc), self.med, Xc)
        self.mu, self.sd = Xc.mean(axis=0), Xc.std(axis=0)
        ok = self.sd > 0
        self.cols, self.med, self.mu, self.sd = self.cols[ok], self.med[ok], self.mu[ok], self.sd[ok]
        return self

    def z(self, X):
        Xc = X[:, self.cols]
        return (np.where(np.isnan(Xc), self.med, Xc) - self.mu) / self.sd


class Logit:
    """A regularised logistic regression: median fill, standardise (training statistics only), L2."""

    def __init__(self, C=LOGIT_C):
        self.C = C

    def fit(self, X, y):
        self.s = Scaler().fit(X)
        self.m = LogisticRegression(C=self.C, penalty="l2", solver="lbfgs", max_iter=5000)
        self.m.fit(self.s.z(X), y)
        return self

    def predict(self, X):
        return self.m.predict_proba(self.s.z(X))[:, 1]

    def coef(self, names):
        return {"inputs": [names[i] for i in self.s.cols], "median": [rnd(v, 6) for v in self.s.med], "mean": [rnd(v, 6) for v in self.s.mu], "sd": [rnd(v, 6) for v in self.s.sd],
                "weights": [rnd(v, 6) for v in self.m.coef_[0]], "intercept": rnd(float(self.m.intercept_[0]), 6)}


class RidgeR:
    """Ridge regression of net R on the standardised inputs."""

    def __init__(self, alpha):
        self.alpha = alpha

    def fit(self, X, R):
        self.s = Scaler().fit(X)
        self.m = Ridge(alpha=self.alpha).fit(self.s.z(X), R)
        return self

    def predict(self, X):
        return self.m.predict(self.s.z(X))

    def coef(self, names):
        return {"inputs": [names[i] for i in self.s.cols], "median": [rnd(v, 6) for v in self.s.med], "mean": [rnd(v, 6) for v in self.s.mu], "sd": [rnd(v, 6) for v in self.s.sd],
                "weights": [rnd(v, 6) for v in self.m.coef_], "intercept": rnd(float(self.m.intercept_), 6)}


class Fitted:
    """One fitted scorer of a configuration. score() is P(net R > 0) for trees and logistic, expected net R for ridge."""

    def __init__(self, cfg, names, seed=SEED):
        self.cfg, self.names, self.seed = cfg, names, seed

    def fit(self, X, y, R):
        k = self.cfg["kind"]
        if k == "trees":
            self.m = fit_gbt(X, y, dict(self.cfg["params"], seed=self.seed), self.cfg["trees"], self.names, self.cfg.get("monotoneUp"))
        elif k == "logistic":
            self.m = Logit(self.cfg["C"]).fit(X, y)
        else:
            self.m = RidgeR(self.cfg["alpha"]).fit(X, R)
        return self

    def raw(self, X):
        return self.m.predict(X, raw_score=True) if self.cfg["kind"] == "trees" else None

    def score(self, X):
        return sigmoid(self.m.predict(X, raw_score=True)) if self.cfg["kind"] == "trees" else self.m.predict(X)


def folds_of(t, end, k=None, first=FIRST_TRAIN):
    """Expanding-window folds over rows sorted by time: (train indices, test indices, test start, rows held back).
    end[i] = the latest moment row i's label can still change; a row trains a fold only when end[i] <= the fold's start."""
    n = len(t)
    k = k or (4 if n >= 300 else 3)
    first = int(round(first * n))
    cuts = [first + int(round(j * (n - first) / k)) for j in range(k + 1)]
    out = []
    for j in range(k):
        a, b = cuts[j], cuts[j + 1]
        start = t[a]
        train = np.array([i for i in range(a) if end[i] <= start], dtype=int)
        out.append((train, np.arange(a, b), int(start), a - len(train)))
    return out


def walk_forward(rows, names, cfg, pooled, windows, k=None, seed=SEED, embargo="window", threshold="closed"):
    """rows: usable train rows of the scope, sorted by time. Returns the out-of-fold scores and the per-fold tables.
    embargo and threshold exist for ml/review.py only, to measure what the first trainer's rules did: embargo "exit+1d"
    admits a training row one day after its first unit's exit, threshold "all" chooses on every earlier test trade."""
    if any(r["pool"] != "train" for r in rows):
        raise RuntimeError("a row outside the train pool reached the walk-forward")
    X = np.vstack([encode(r, names) for r in rows])
    y = np.array([r["win"] for r in rows], dtype=float)
    R = np.array([r["netR"] for r in rows], dtype=float)
    t = np.array([r["t"] for r in rows])
    edge = np.array([r["edge"] for r in rows])
    end = np.array([r["t"] + windows[r["edge"]] for r in rows]) if embargo == "window" else np.array([r["exitT"] + 86400 for r in rows])
    n, kind, lines = len(rows), cfg["kind"], [MAIN] + (["logit"] if cfg.get("logitLine") else [])
    oof = {key: np.full(n, np.nan) for key in (MAIN, "raw", "logit", "prior", "priorEdge", "priorR", "adj")}
    kept = {key: np.zeros(n, bool) for key in lines}
    in_test, fold_id, fold_rows = np.zeros(n, bool), np.zeros(n, int), []
    met = (lambda s, te: reg_metrics(s, y[te], R[te], oof["priorR"][te])) if kind == "ridge" else (lambda s, te: prob_metrics(s, y[te], oof["prior"][te]))
    for j, (tr, te, start, held) in enumerate(folds_of(t, end, k)):
        m = Fitted(cfg, names, seed).fit(X[tr], y[tr], R[tr])
        oof[MAIN][te] = m.score(X[te])
        if kind == "trees":
            oof["raw"][te] = m.raw(X[te])
        if "logit" in lines:
            oof["logit"][te] = Logit().fit(X[tr], y[tr]).predict(X[te])
        oof["prior"][te], oof["priorR"][te] = y[tr].mean(), R[tr].mean()
        # the win rate of the row's own edge in the training rows: the fair bar for a pooled scorer's probabilities
        rate = {e: y[tr][edge[tr] == e].mean() if (edge[tr] == e).any() else y[tr].mean() for e in set(edge[te])}
        oof["priorEdge"][te] = np.array([rate[e] for e in edge[te]])
        in_auc = auc(m.score(X[tr]), y[tr])
        # net R with the edge's own training mean taken out (used for a pooled scorer's verdict)
        means = {e: R[tr][edge[tr] == e].mean() if (edge[tr] == e).any() else R[tr].mean() for e in set(edge[te])}
        oof["adj"][te] = R[te] - np.array([means[e] for e in edge[te]])
        # the keep-threshold comes from predictions made BEFORE this block, on trades whose label window had closed by
        # its start: the earlier test blocks, or for the first block an inner split of its training window (fit on the
        # first 70 %, predict the last 30 %)
        if j == 0:
            cut = int(round(0.7 * len(tr)))
            inner_te = tr[cut:]
            inner_tr = np.array([i for i in tr[:cut] if end[i] <= t[inner_te[0]]], dtype=int)
            im = Fitted(cfg, names, seed).fit(X[inner_tr], y[inner_tr], R[inner_tr])
            ref = {MAIN: im.score(X[inner_te])}
            if "logit" in lines:
                ref["logit"] = Logit().fit(X[inner_tr], y[inner_tr]).predict(X[inner_te])
            ref_r, src, open_ref = R[inner_te], "an inner split of the first training window", 0
        else:
            done = (in_test & (end <= start)) if threshold == "closed" else in_test.copy()
            ref, ref_r, src = {key: oof[key][done] for key in lines}, R[done], "the earlier test blocks"
            open_ref = int((in_test & ~done).sum())
        fr = {"fold": j + 1, "trainRows": int(len(tr)), "purged": int(held), "testRows": int(len(te)), "testFrom": start, "testTo": int(t[te[-1]]),
              "thresholdFrom": src, "thresholdRows": int(len(ref_r)), "thresholdHeldBack": open_ref, "inFoldAuc": rnd(in_auc)}
        for key in lines:
            q, thr = pick_threshold(ref[key], ref_r)
            kept[key][te] = oof[key][te] >= thr
            base = met(oof[key][te], te) if key == MAIN else prob_metrics(oof[key][te], y[te], oof["prior"][te])
            fr[key] = dict(base, dropShare=q, trading=trading(oof[key][te], R[te], thr, oof["adj"][te] if pooled else None))
        fr["prior"] = {"p": rnd(y[tr].mean()), "brier": rnd(brier(oof["prior"][te], y[te])), "logLoss": rnd(logloss(oof["prior"][te], y[te]))}
        fold_rows.append(fr)
        in_test[te] = True
        fold_id[te] = j + 1
    return {"fold_id": fold_id, "X": X, "y": y, "R": R, "t": t, "end": end, "edge": edge, "oof": oof, "kept": kept, "in_test": in_test, "folds": fold_rows,
            "lines": lines, "kind": kind, "pooled": pooled, "ids": [r["id"] for r in rows]}


def overall(wf, key):
    te, pooled = wf["in_test"], wf["pooled"]
    s, y, R, keep = wf["oof"][key][te], wf["y"][te], wf["R"][te], wf["kept"][key][te]
    z = wf["oof"]["adj"][te] if pooled else R
    ridge = wf["kind"] == "ridge" and key == MAIN
    out = reg_metrics(s, y, R, wf["oof"]["priorR"][te]) if ridge else prob_metrics(s, y, wf["oof"]["prior"][te])
    out["calibration"] = calibration(s, y, R if ridge else None)
    if key == MAIN:
        fa = [f["inFoldAuc"] for f in wf["folds"] if f["inFoldAuc"] is not None]
        out["inFoldAuc"] = rnd(float(np.mean(fa))) if fa else None
    if pooled:   # the pooled AUC is helped by win rates that differ between edges; this one is measured inside each edge
        ed, parts = wf["edge"][te], []
        for e in sorted(set(ed.tolist())):
            a = auc(s[ed == e], y[ed == e]) if (ed == e).sum() >= 20 else None
            if a is not None:
                parts.append((int((ed == e).sum()), a))
        out["aucWithinEdge"] = rnd(sum(n * a for n, a in parts) / sum(n for n, _ in parts)) if parts else None
        if not ridge:   # and its Brier score is helped the same way: this is the prior rate of each row's own edge
            out["brierEdgePrior"] = rnd(brier(wf["oof"]["priorEdge"][te], y))
    w = welch_full(z[keep], z[~keep])
    out["trading"] = {"mechanical": summary(R), "kept": summary(R[keep]), "skipped": summary(R[~keep]), "keptMinusSkippedT": rnd(w["t"], 2) if w else None,
                      "keptMinusSkipped": rnd(w["diff"]) if w else None, "p": rnd(w["p"], 6) if w else None, "pHolm": None,
                      "keptMinusMechanical": rnd(R[keep].mean() - R.mean()) if keep.any() else None,
                      "maxDrawdown": {"kept": rnd(max_dd(R[keep]), 2), "mechanical": rnd(max_dd(R), 2)},
                      "tOn": "net R with each edge's training mean taken out" if pooled else "net R"}
    return out


def tests_of(wf, scorer):
    """Every kept-minus-skipped test this scorer adds to the run's family (see the acceptance rule)."""
    te, out = wf["in_test"], []
    for key in wf["lines"]:
        keep, R, ed = wf["kept"][key][te], wf["R"][te], wf["edge"][te]
        z = wf["oof"]["adj"][te] if wf["pooled"] else R
        parts = [("all, edge-adjusted" if wf["pooled"] else ed[0], z, np.ones(len(R), bool), True)]
        if wf["pooled"]:
            parts += [(e, R, ed == e, False) for e in EDGES if (ed == e).any()]
        for name, v, mask, verdict in parts:
            w = welch_full(v[mask & keep], v[mask & ~keep])
            if w is not None:
                out.append({"scorer": scorer, "line": "scorer" if key == MAIN else "logistic line", "key": key, "edge": name, "verdictTest": verdict,
                            "kept": int((mask & keep).sum()), "skipped": int((mask & ~keep).sum()), "diff": rnd(w["diff"]), "t": rnd(w["t"], 2), "df": rnd(w["df"], 1), "p": w["p"]})
    return out


def acceptance(wf, o, holm_p, m_tests):
    """The five lines of the pre-registered rule for the entry's own scorer. Returns (passes, lines, the verdict in words)."""
    tr, last = o["trading"], wf["folds"][-1][MAIN]["trading"]
    t, p = tr["keptMinusSkippedT"], tr["p"]
    ok1 = t is not None and t >= T_LINE and holm_p is not None and holm_p <= P_LINE
    ok2 = tr["keptMinusMechanical"] is not None and tr["keptMinusMechanical"] > 0
    ok3 = tr["kept"]["n"] > 0 and tr["maxDrawdown"]["kept"] <= tr["maxDrawdown"]["mechanical"]
    if wf["kind"] == "ridge":
        ok4, v4, w4 = o["mse"] <= o["msePrior"], {"mse": o["mse"], "msePrior": o["msePrior"]}, "mean squared error no worse than predicting the training mean (it carries no probability)"
    else:
        ok4, v4, w4 = o["brier"] <= o["brierPrior"], {"brier": o["brier"], "brierPrior": o["brierPrior"]}, "Brier score no worse than the prior rate's"
    ok5 = last["skipped"]["n"] > 0 and last["kept"]["n"] > 0 and last["kept"]["avg"] > last["mechanical"]["avg"]
    lines = [
        {"line": 1, "what": "kept minus skipped: t at least %s and the Holm-corrected one-sided p at most %.5f" % (T_LINE, P_LINE), "value": {"t": t, "p": p, "pHolm": rnd(holm_p, 6), "tests": m_tests}, "ok": bool(ok1)},
        {"line": 2, "what": "the kept trades average more than all trades", "value": {"keptMinusMechanical": tr["keptMinusMechanical"]}, "ok": bool(ok2)},
        {"line": 3, "what": "the kept trades' maximum drawdown is not deeper than taking every setup's", "value": tr["maxDrawdown"], "ok": bool(ok3)},
        {"line": 4, "what": w4, "value": v4, "ok": bool(ok4)},
        {"line": 5, "what": "the last test block agrees", "value": {"keptN": last["kept"]["n"], "skippedN": last["skipped"]["n"], "kept": last["kept"]["avg"], "mechanical": last["mechanical"]["avg"]}, "ok": bool(ok5)},
    ]
    if all(x["ok"] for x in lines):
        return True, lines, "passes every line of the acceptance rule out of fold (kept minus skipped t %s, Holm-corrected p %s over %d tests)" % (t, rnd(holm_p, 5), m_tests)
    why = []
    if not ok1:
        if tr["skipped"]["n"] == 0:
            why.append("out of fold its threshold kept every trade")
        elif t is None:
            why.append("out of fold it skipped only %d trade(s), too few for a t" % tr["skipped"]["n"])
        elif t < T_LINE:
            why.append("out of fold the kept trades do not beat the skipped ones (t %s, need %s)" % (t, T_LINE))
        else:
            why.append("its t of %s does not survive the correction for %d tests (Holm p %s, need %.5f)" % (t, m_tests, rnd(holm_p, 4), P_LINE))
    if not ok2 and tr["skipped"]["n"] > 0:
        why.append("the kept trades average no more than all trades")
    if not ok3 and tr["skipped"]["n"] > 0:
        why.append("the kept trades draw down deeper than taking every setup (%s R against %s R)" % (tr["maxDrawdown"]["kept"], tr["maxDrawdown"]["mechanical"]))
    if not ok4:
        why.append("its mean squared error is worse than predicting the training mean" if wf["kind"] == "ridge" else "its Brier score is worse than the prior rate's (%s against %s)" % (o["brier"], o["brierPrior"]))
    if not ok5:
        why.append("the last block does not confirm it")
    return False, lines, "no improvement over taking every setup: " + "; ".join(why)


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


def scope_rows(all_rows, scope):
    part = [r for r in all_rows if scope == "pooled" or r["edge"] == scope]
    rows = sorted([r for r in part if usable(r)], key=lambda r: (r["t"], r["id"]))
    return part, rows


def fit_id(scope, cfg_name, cfg, names, rows, matrix_version):
    """The id of a fit. For the reference scorer the recipe is the first trainer's, so its files keep their ids."""
    if cfg_name == "gbt":
        return "%s-%s" % (scope, sha(json.dumps([cfg["fit"], matrix_version, names, [r["id"] for r in rows], cfg["params"], cfg["trees"]], sort_keys=True))[:10])
    recipe = {k: v for k, v in cfg.items() if k not in ("label", "what", "scopes")}
    return "%s-%s-%s" % (scope, cfg_name, sha(json.dumps([recipe, matrix_version, names, [r["id"] for r in rows]], sort_keys=True))[:10])


def run_scope(scope, cfg_name, all_rows, m, windows, k=None, seed=SEED, **protocol):
    """One configuration on one scope: the walk-forward. Returns None when the scope has too few rows."""
    cfg, pooled = CONFIGS[cfg_name], scope == "pooled"
    part, rows = scope_rows(all_rows, scope)
    if len(rows) < MIN_ROWS:
        return None
    names = feature_names(m, cfg, pooled)
    wf = walk_forward(rows, names, cfg, pooled, windows, k, seed, **protocol)
    return {"scope": scope, "config": cfg_name, "cfg": cfg, "pooled": pooled, "part": part, "rows": rows, "names": names, "wf": wf,
            "id": fit_id(scope, cfg_name, cfg, names, rows, m["version"])}


def build_entry(run, m, family, out_dir):
    """The index entry of one walk-forward (and, for a tree scorer, its exported files)."""
    scope, cfg_name, cfg, pooled, rows, names, wf, mid = (run[k] for k in ("scope", "config", "cfg", "pooled", "rows", "names", "wf", "id"))
    te = wf["in_test"]
    main = overall(wf, MAIN)
    mine = [x for x in family if x["scorer"] == mid and x["key"] == MAIN and x["verdictTest"]]
    holm_p = mine[0]["pHolm"] if mine else None
    main["trading"]["pHolm"] = rnd(holm_p, 6)
    beats, lines, why = acceptance(wf, main, holm_p, len(family))
    oof = {MAIN: main, "prior": {"brier": rnd(brier(wf["oof"]["prior"][te], wf["y"][te])), "logLoss": rnd(logloss(wf["oof"]["prior"][te], wf["y"][te])), "auc": 0.5},
           "alwaysTake": summary(wf["R"][te])}
    if "logit" in wf["lines"]:
        oof["logit"] = overall(wf, "logit")
        lt = [x for x in family if x["scorer"] == mid and x["key"] == "logit" and x["verdictTest"]]
        oof["logit"]["trading"]["pHolm"] = rnd(lt[0]["pHolm"], 6) if lt else None
    trees = cfg["kind"] == "trees"
    platt, platt_check = platt_of(wf) if trees else (None, {"passed": False, "why": "not a tree scorer: no probability of it is exported or shown"})
    final = Fitted(cfg, names).fit(wf["X"], wf["y"], wf["R"])       # the stored fit: every usable train row, same settings
    q, thr = pick_threshold(wf["oof"][MAIN][te], wf["R"][te])       # the threshold a user of the scorer would start from
    label = scope if cfg["label"] is None else "%s · %s" % (scope, cfg["label"])
    status = "passed validation, not promoted: owner decision" if beats else "rejected challenger"
    entry = {
        "id": mid, "edge": None if pooled else scope, "scope": label, "scopeEdge": scope, "config": cfg_name, "kind": cfg["kind"], "what": cfg["what"],
        "status": status, "verdict": why, "beatsBaseline": beats, "promoted": False, "calibrated": platt is not None,
        "file": mid + ".json" if trees else None, "pred": mid + ".pred.json" if trees else None,
        "candidates": len(run["part"]), "trainRows": len(rows), "from": iso(rows[0]["t"]), "to": iso(rows[-1]["t"]), "rowIdsHash": sha(json.dumps(sorted(wf["ids"]), separators=(",", ":")))[:16],
        "winRate": rnd(wf["y"].mean()), "netRPerTrade": rnd(wf["R"].mean()), "featureNames": names,
        "validation": {"scheme": "chronological walk-forward, expanding window", "folds": len(wf["folds"]), "firstTrainShare": FIRST_TRAIN,
                       "embargo": "a training row enters a fold only when its signal time plus its edge's label window is not after the block's start",
                       "outOfFoldRows": int(te.sum()), "heldBackRows": int(sum(f["purged"] for f in wf["folds"]))},
        "folds": wf["folds"], "outOfFold": oof, "acceptance": lines,
        "calibration": dict({"method": "Platt scaling on out-of-fold raw scores, fitted on all folds but the last and checked on the last"} if trees else {"method": "none"}, **platt_check),
        "threshold": {"dropShare": q, "p": None if thr == -math.inf else rnd(thr, 6), "from": "all out-of-fold predictions"},
        "exam": None,
    }
    if not trees:
        entry["coefficients"] = final.m.coef(names)
        entry["hash"] = sha(json.dumps(entry["coefficients"], sort_keys=True))[:16]
        entry["register"] = None
        entry["notExported"] = "a linear scorer cannot be written in the page's tree format (MXA.MODEL_SCHEMA): there is no file the page could load"
        return entry
    model = export_model(final.m, mid, None if pooled else scope, names, platt, {
        "status": status, "verdict": why, "trainer": TRAINER, "config": cfg_name, "trainedRows": len(rows), "trainedFrom": entry["from"], "trainedTo": entry["to"],
        "matrixVersion": m["version"], "note": "Scores P(net R > 0). Not promoted. See ml/models/index.json for its validation."
        + (" Pooled model: add the edge id to the features before scoring (features.edge)." if pooled else "")})
    if cfg_name != "gbt":
        model["kind"] = "gradient-boosted stumps, binary, monotone"
    # this script's own predictions on a sample of the scope's train-pool rows (flagged and unfilled ones too: the check
    # is about arithmetic, and those rows carry more missing values)
    samp = sorted(run["part"], key=lambda r: r["id"])
    samp = samp[::max(1, len(samp) // PRED_ROWS)][:PRED_ROWS]
    raw, p = score_py(final.m, platt, np.vstack([encode(r, names) for r in samp]))
    pred = {"model": mid, "what": "predictions of the training library itself on these rows; ml/parity.mjs must reproduce them with MXA.score", "n": len(samp),
            "rows": [{"id": r["id"], "raw": float(a), "p": float(b)} for r, a, b in zip(samp, raw, p)]}
    for name, body in ((mid + ".json", model), (mid + ".pred.json", pred)):
        with open(os.path.join(out_dir, name), "w") as fh:
            json.dump(body, fh, separators=(",", ":"))
            fh.write("\n")
    entry["hash"] = sha(json.dumps(model, separators=(",", ":"), sort_keys=True))[:16]
    entry["register"] = register_body(entry, m["version"])
    return entry


def register_body(e, matrix_version):
    """The POST body that files this model in the Academy's registry (the owner sends it by hand; see TRAINING.md)."""
    o, tr = e["outOfFold"][MAIN], e["outOfFold"][MAIN]["trading"]
    metrics = {"oofN": o["n"], "oofAuc": o["auc"], "oofBrier": o["brier"], "oofBrierPrior": o["brierPrior"], "oofLogLoss": o["logLoss"],
               "mechanicalR": tr["mechanical"]["avg"], "keptN": tr["kept"]["n"], "keptR": tr["kept"]["avg"], "skippedN": tr["skipped"]["n"], "skippedR": tr["skipped"]["avg"],
               "keptMinusSkippedT": tr["keptMinusSkippedT"], "beatsBaseline": "yes" if e["beatsBaseline"] else "no", "calibrated": "yes" if e["calibrated"] else "no"}
    name = "academy-scorer-" + e["scopeEdge"] + ("" if e["config"] == "gbt" else "-" + e["config"])
    return {"action": "model.register", "model": {
        "name": name, "version": e["id"], "kind": "gbt-binary", "edge": e["edge"], "status": "challenger", "metrics": metrics,
        "datasetVersion": matrix_version, "trainedOn": {"pool": "train", "rows": e["trainRows"], "from": e["from"], "to": e["to"]},
        "artifact": "ml/models/" + e["file"], "hash": e["hash"],
        "notes": ("REJECTED CHALLENGER. " if not e["beatsBaseline"] else "PASSED VALIDATION, NOT PROMOTED. ") + e["verdict"] + ". Do not promote without the owner reading ml/models/report.md."}}


def run_all(all_rows, m, configs=None, k=None, seed=SEED, **protocol):
    """Every walk-forward of the run and its test family (Holm-corrected). No file is written here."""
    windows = label_windows([r for r in all_rows if usable(r)])
    runs, skipped = [], []
    for cfg_name in configs or list(CONFIGS):
        cfg = CONFIGS[cfg_name]
        scopes = ([e for e in EDGES] if "edges" in cfg["scopes"] else []) + (["pooled"] if "pooled" in cfg["scopes"] else [])
        for scope in scopes:
            run = run_scope(scope, cfg_name, all_rows, m, windows, k, seed, **protocol)
            if run is None:
                if not any(s["edge"] == scope for s in skipped):
                    part, rows = scope_rows(all_rows, scope)
                    skipped.append({"edge": scope, "status": "not enough data", "why": "%d filled train trades that are not flagged; %d are needed to fit" % (len(rows), MIN_ROWS),
                                    "candidates": len(part), "trainRows": len(rows), "from": iso(rows[0]["t"]) if rows else None, "to": iso(rows[-1]["t"]) if rows else None})
                continue
            runs.append(run)
    family = [x for run in runs for x in tests_of(run["wf"], run["id"])]
    for x, ph in zip(family, holm([x["p"] for x in family])):
        x["pHolm"] = ph
    return runs, skipped, family, windows


# -------------------------------------------------------------------------------------------------------------- report
def fmt(x, d=3):
    return "n/a" if x is None else ("%.*f" % (d, x))


def report_md(index):
    L = ["# Academy scorer: training report", "",
         "Generated by `python ml/train.py`. Data version %s (matrix %s). Trainer %s." % (index["data"]["dataVersion"], index["data"]["matrixVersion"], index["trainer"]), "",
         "Train pool only, setups that are not flagged, filled trades. The exam pool is not read: the loader drops its rows.",
         "Walk-forward, expanding window; a training row enters a fold only when its label window had closed (signal time plus the edge's longest signal-to-exit time).",
         "%d scorers, %d kept-minus-skipped tests in the family (Holm). No scorer is promoted here." % (len(index["models"]), index["family"]["tests"]), "",
         "Rule: " + index["verdictRule"], ""]
    L += ["## Verdicts", "", "| Scorer | Train rows | Period | Out-of-fold n | AUC (in fold) | Brier | Prior Brier | Kept n | Kept R | Skipped n | Skipped R | t | p | Holm p | Max DD kept / all | Status |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for e in index["models"]:
        o, tr = e["outOfFold"][MAIN], e["outOfFold"][MAIN]["trading"]
        L.append("| %s | %d | %s to %s | %d | %s (%s) | %s | %s | %d | %s | %d | %s | %s | %s | %s | %s / %s | %s |" % (
            e["scope"], e["trainRows"], e["from"], e["to"], o["n"], fmt(o["auc"]), fmt(o["inFoldAuc"]), fmt(o["brier"], 4), fmt(o["brierPrior"], 4),
            tr["kept"]["n"], fmt(tr["kept"]["avg"]), tr["skipped"]["n"], fmt(tr["skipped"]["avg"]), fmt(tr["keptMinusSkippedT"], 2), fmt(tr["p"], 4), fmt(tr["pHolm"], 4),
            fmt(tr["maxDrawdown"]["kept"], 1), fmt(tr["maxDrawdown"]["mechanical"], 1), e["status"]))
    for s in index["skipped"]:
        L.append("| %s | %d | %s to %s | | | | | | | | | | | | | not enough data |" % (s["edge"], s["trainRows"], s["from"], s["to"]))
    L += ["", "Embargo (label window) by edge, hours: " + ", ".join("%s %d" % (e, round(s / 3600)) for e, s in index["settings"]["embargoSec"].items()) + ".", ""]
    L += ["## The test family", "", "Every kept-minus-skipped Welch test of the run, smallest p first. One-sided p; Holm-corrected over all %d." % index["family"]["tests"], "",
          "| Scorer | Line | Edge | Kept n | Skipped n | Difference (R) | t | p | Holm p |", "|---|---|---|---|---|---|---|---|---|"]
    for x in sorted(index["tests"], key=lambda x: x["p"]):
        L.append("| %s | %s | %s | %d | %d | %s | %s | %s | %s |" % (x["scorer"], x["line"], x["edge"], x["kept"], x["skipped"], fmt(x["diff"]), fmt(x["t"], 2), fmt(x["p"], 4), fmt(x["pHolm"], 4)))
    L.append("")
    for e in index["models"]:
        L += ["## %s (%s)" % (e["scope"], e["id"]), "", e["what"] + ".", "", e["verdict"][0].upper() + e["verdict"][1:] + ".", "",
              "Train rows %d, win rate %s, net R a trade %s. Calibrated: %s. %s" % (e["trainRows"], fmt(e["winRate"]), fmt(e["netRPerTrade"]), "yes" if e["calibrated"] else "no",
                                                                                 "Exported: %s." % e["file"] if e["file"] else "Not exported: " + e["notExported"] + "."), "",
              "Acceptance: " + "; ".join("line %d %s" % (x["line"], "holds" if x["ok"] else "fails") for x in e["acceptance"]) + ".", "",
              "| Fold | Train | Held back | Test | Line | AUC | Brier | Prior Brier | Mechanical R | Kept n | Kept R | Skipped n | Skipped R | t |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
        keys = [(MAIN, "scorer")] + ([("logit", "logistic, 70 inputs")] if "logit" in e["outOfFold"] else [])
        for f in e["folds"]:
            for k, label in keys:
                x, tr = f[k], f[k]["trading"]
                L.append("| %d | %d | %d | %d | %s | %s | %s | %s | %s | %d | %s | %d | %s | %s |" % (f["fold"], f["trainRows"], f["purged"], f["testRows"], label, fmt(x["auc"]), fmt(x["brier"], 4), fmt(x["brierPrior"], 4),
                         fmt(tr["mechanical"]["avg"]), tr["kept"]["n"], fmt(tr["kept"]["avg"]), tr["skipped"]["n"], fmt(tr["skipped"]["avg"]), fmt(tr["keptMinusSkippedT"], 2)))
        for k, label in keys:
            x, tr = e["outOfFold"][k], e["outOfFold"][k]["trading"]
            L.append("| all | | | %d | %s | %s | %s | %s | %s | %d | %s | %d | %s | %s |" % (x["n"], label, fmt(x["auc"]), fmt(x["brier"], 4), fmt(x["brierPrior"], 4),
                     fmt(tr["mechanical"]["avg"]), tr["kept"]["n"], fmt(tr["kept"]["avg"]), tr["skipped"]["n"], fmt(tr["skipped"]["avg"]), fmt(tr["keptMinusSkippedT"], 2)))
        cal = e["outOfFold"][MAIN]["calibration"]
        if e["kind"] == "ridge":
            L += ["", "Out of fold, five equal bins by predicted R: " + "; ".join("predicted %s -> made %s R, won %s (n %d)" % (fmt(b["meanScore"]), fmt(b["meanR"]), fmt(b["winRate"]), b["n"]) for b in cal) + ".",
                  "Mean squared error %s against %s for the training mean; rank correlation with net R %s." % (fmt(e["outOfFold"][MAIN]["mse"]), fmt(e["outOfFold"][MAIN]["msePrior"]), fmt(e["outOfFold"][MAIN]["rankCorr"])), ""]
        else:
            L += ["", "Calibration out of fold (five equal bins by predicted probability): " + "; ".join("p %s -> won %s (n %d)" % (fmt(b["meanP"]), fmt(b["winRate"]), b["n"]) for b in cal) + ".", ""]
        if e["outOfFold"][MAIN].get("aucWithinEdge") is not None:
            L += ["The pooled AUC is helped by win rates that differ from edge to edge. Measured inside each edge it is %s.%s" % (
                fmt(e["outOfFold"][MAIN]["aucWithinEdge"]), " Against the prior rate of each trade's own edge the Brier bar is %s, not %s." % (
                    fmt(e["outOfFold"][MAIN]["brierEdgePrior"], 4), fmt(e["outOfFold"][MAIN]["brierPrior"], 4)) if e["outOfFold"][MAIN].get("brierEdgePrior") is not None else ""), ""]
    return "\n".join(L) + "\n"


VERDICT_RULE = ("A scorer passes only if, out of fold, all five lines hold: (1) the trades it keeps beat the trades it skips with a Welch t of at least %s and a one-sided p, "
                "Holm-corrected over every scorer x edge test of the run, of at most %.5f (the threshold is chosen on earlier, closed trades only; a pooled scorer is tested on net R "
                "with each edge's training mean removed); (2) the kept trades average more than all trades; (3) their maximum drawdown is not deeper than taking every setup's; "
                "(4) the Brier score is no worse than the prior rate's (for the net-R regression: mean squared error no worse than the training mean); (5) the last test block agrees. "
                "Otherwise: rejected challenger. A scorer that passes is marked 'passed validation, not promoted: owner decision'." % (T_LINE, P_LINE))


def main():
    ap = argparse.ArgumentParser(description="Train the Academy scorers (offline, walk-forward, train pool only).")
    ap.add_argument("--config", default="all", help="a configuration id (%s) or 'all'" % ", ".join(CONFIGS))
    ap.add_argument("--edge", default="all", help="kept for the workflow's command line: only 'all' is accepted")
    ap.add_argument("--out", default=os.path.join(HERE, "models"))
    ap.add_argument("--matrix", default=MATRIX)
    ap.add_argument("--no-exam", action="store_true", help="accepted and ignored: this trainer cannot read the exam pool")
    a = ap.parse_args()
    if not os.path.exists(a.matrix):
        sys.exit("No feature matrix at %s. Make it first: ACADEMY_CANDLES=<folder> node academy/gen/features.mjs" % a.matrix)
    if a.edge != "all":
        sys.exit("--edge is no longer a choice: the test family covers every scope of the run. Use --config, or run everything.")
    if a.config != "all" and a.config not in CONFIGS:
        sys.exit("unknown configuration: " + a.config)
    partial = a.config != "all"
    if partial and os.path.abspath(a.out) == os.path.join(HERE, "models"):
        sys.exit("A partial run has a smaller test family than the committed one. Write it somewhere else: --out <folder>.")
    m, rows = load_matrix(a.matrix)
    os.makedirs(a.out, exist_ok=True)
    for f in os.listdir(a.out):                           # a run replaces the folder's models
        if f.endswith(".json") or f == "report.md":
            os.remove(os.path.join(a.out, f))
    runs, skipped, family, windows = run_all(rows, m, None if not partial else [a.config])
    models = []
    for run in runs:
        e = build_entry(run, m, family, a.out)
        models.append(e)
        o = e["outOfFold"][MAIN]
        print("%-24s rows %4d  oof n %4d  auc %s  brier %s (prior %s)  kept-skipped t %s  holm p %s  -> %s" % (
            e["scope"], e["trainRows"], o["n"], fmt(o["auc"]), fmt(o["brier"], 4), fmt(o["brierPrior"], 4), fmt(o["trading"]["keptMinusSkippedT"], 2), fmt(o["trading"]["pHolm"], 4), e["status"]))
    for s in skipped:
        print("%-24s rows %4d  -> not enough data" % (s["edge"], s["trainRows"]))
    with open(os.path.abspath(__file__), "rb") as fh:
        code = sha(fh.read())[:12]
    tests = [{k: (rnd(v, 6) if k in ("p", "pHolm") else v) for k, v in x.items() if k != "key"} for x in family]
    index = {
        "generated": m["generated"], "trainer": TRAINER, "code": {"train.py": code},
        "libraries": {"lightgbm": lgb.__version__, "numpy": np.__version__, "scikit-learn": __import__("sklearn").__version__, "scipy": __import__("scipy").__version__},
        "data": {"matrixVersion": m["version"], "featVersions": m["featVersions"], "dataVersion": m["dataVersion"], "policy": m["policy"]},
        "target": "net R > 0 (binary); the ridge-netR configuration predicts net R itself", "rows": "train pool, not flagged (clock-shifted week, before 2020), filled trades, every needed timeframe present",
        "settings": {"minRows": MIN_ROWS, "firstTrainShare": FIRST_TRAIN, "embargoSec": windows, "ruleWindowH": RULE_WINDOW_H, "weekendSec": WEEKEND_SEC, "tLine": T_LINE, "pLine": rnd(P_LINE, 6), "keepGrid": KEEP_GRID,
                     "trees": N_TREES, "minLeafShare": MIN_LEAF_SHARE, "lightgbm": LGB_PARAMS, "logitC": LOGIT_C, "seed": SEED, "shortList": SHORT, "monotoneUp": MONOTONE_UP,
                     "configs": {k: {x: y for x, y in v.items() if x != "label"} for k, v in CONFIGS.items()}},
        "notInputs": dict(DROP, **{k: "raw price level" for k in m["priceKeys"]}),
        "preregistration": "research/edge/academy-ml-review/PREREGISTRATION.md",
        "verdictRule": VERDICT_RULE,
        "promotion": "manual, by the owner, through the API (model.register then model.promote). Nothing here promotes a model.",
        "examRead": False,
        "examPolicy": "This trainer cannot read the exam pool: the loader drops every row that is not in the train pool (%d rows) before unpacking it. The first trainer's two runs read exam-pool aggregates; that record is ml/archive/gbt-1 and is not repeated." % sum(m["notTrainDropped"].values()),
        "notTrainDropped": m["notTrainDropped"], "partial": partial,
        "family": {"tests": len(family), "correction": "Holm", "pLine": rnd(P_LINE, 6), "smallestP": rnd(min(x["p"] for x in family), 6) if family else None,
                   "smallestHolmP": rnd(min(x["pHolm"] for x in family), 6) if family else None},
        "tests": tests, "models": models, "skipped": skipped,
    }
    with open(os.path.join(a.out, "index.json"), "w") as fh:
        json.dump(index, fh, indent=1)
        fh.write("\n")
    with open(os.path.join(a.out, "report.md"), "w") as fh:
        fh.write(report_md(index))
    print("wrote %d scorer(s), %d edge(s) skipped, %d tests in the family -> %s" % (len(models), len(skipped), len(family), a.out))


if __name__ == "__main__":
    main()
