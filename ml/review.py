#!/usr/bin/env python3
"""MeridianX Academy: the training review of 10 Nov 2026 (research/edge/academy-ml-review/PREREGISTRATION.md).

    python ml/review.py            # writes research/edge/academy-ml-review/result.json and RESULT.md (about 5 minutes)
    python ml/review.py --quick    # fewer permutations: a smoke run, written to --out only
    python ml/review.py --out DIR  # write somewhere else

It audits the training set and the training code, with a number for every check: features, labels, leakage, sample
size and power, overfitting, calibration and regimes. It trains nothing that is kept: the scorers and their verdicts
are written by ml/train.py, and this file re-runs the same walk-forward in memory for the checks.

THE EXAM POOL IS NOT READ. Rows come from train.load_matrix (train pool only). The candidate and outcome files are
opened for the label audit: of a candidate outside the train pool only its id is kept (to prove no such id reached a
fit), and of the outcome file only the entries of train ids are kept; the rest is discarded unread. The scrambled-matrix
check overwrites the rows of other pools with noise without looking at them. Paper research only; no network.
"""
import argparse
import datetime
import gzip
import io
import json
import math
import os
import sys
import tempfile

import numpy as np
from scipy import stats as sps

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import train as T  # noqa: E402

ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "research", "edge", "academy-ml-review")
DATA = os.path.join(ROOT, "academy", "data")
MODELS = os.path.join(HERE, "models")
ARCHIVE = os.path.join(HERE, "archive", "gbt-1", "index.json")
MAIN = T.MAIN
SEEDS = [1, 7, 13, 29, 101]
FOLD_COUNTS = [3, 4, 5, 6]
MIN_GROUP = 5                                        # a t inside a year or a regime is given only when both groups have this many trades
ADD_DEADLINE_H = {"replica": 48, "mosha-bo": 72}     # an add leg shares its first unit's deadline (from the entry / the fill)

r4 = T.rnd


def r2(x):
    return T.rnd(x, 2)


# ------------------------------------------------------------------------------------------------------------------ data
def side_data(train_ids):
    """Per edge: the ids of candidates outside the train pool (ids only), and the outcome entries of train ids."""
    other, outs = set(), {}
    for e in T.EDGES:
        with open(os.path.join(DATA, "cand-%s.json" % e)) as fh:
            for c in json.load(fh):
                if c["pool"] != "train":
                    other.add(c["id"])
        with open(os.path.join(DATA, "out-%s.json" % e)) as fh:
            raw = json.load(fh)
        for i in list(raw):
            if i in train_ids:
                outs[i] = raw[i]
        del raw
    return other, outs


def col(rows, name):
    return np.array([T.encode(r, [name])[0] for r in rows])


def auc_free(x, y):
    """AUC of one column against the win flag on its non-missing rows, whichever way it points (0.5 to 1)."""
    ok = ~np.isnan(x)
    if ok.sum() < 20 or len(set(y[ok].tolist())) < 2 or np.nanstd(x[ok]) == 0:
        return None
    a = T.auc(x[ok], y[ok])
    return None if a is None else max(a, 1 - a)


# ------------------------------------------------------------------------------------------------------- 1. the features
CLOCK = ["session", "dow", "hourUtc"]
GEOMETRY = ["rr", "stopAtr", "targetAtr", "entryOffset", "geomOk", "entryLoc", "entryZone", "locFor", "oppLiq", "oppLiqFrac"]
SIDE_REL = ["side", "biasAlign", "ltfAlign", "sweepFor", "dispFor", "momFor", "confirm", "trigCloseLoc", "trigBodyAtr"]
SOURCES = {
    "clock": "the signal time t itself",
    "geometry": "the candidate's entry, stop and target (fixed by the rule at t) against bars that had closed at t",
    "side": "the candidate's side against bars that had closed at t",
    "bars": "bars that had closed at t (MXR.snapshot keeps a bar only when bar.time + tfSec <= t)",
    "edge": "the id of the edge that fired (pooled scorers only)",
}


def source_of(name):
    return "edge" if name == "edge" else "clock" if name in CLOCK else "geometry" if name in GEOMETRY else "side" if name in SIDE_REL else "bars"


def audit_features(m, use, scopes):
    names = T.feature_names(m, T.CONFIGS["gbt"], True)
    X = {k: col(use, k) for k in names}
    edge = np.array([r["edge"] for r in use])
    t = np.array([r["t"] for r in use])
    order = np.argsort(t, kind="stable")
    rows = []
    for k in names:
        x = X[k]
        miss = float(np.isnan(x).mean())
        miss_edge = max(float(np.isnan(x[edge == e]).mean()) for e in T.EDGES)
        vals, counts = np.unique(x[~np.isnan(x)], return_counts=True)
        top = float(counts.max() / len(x)) if len(counts) else 1.0
        drift, worst = [], None
        for name, mask in scopes.items():
            idx = order[mask[order]]
            a, b = x[idx[: len(idx) // 2]], x[idx[len(idx) // 2:]]
            a, b = a[~np.isnan(a)], b[~np.isnan(b)]
            if len(a) < 20 or len(b) < 20:
                continue
            sd = math.sqrt((a.var(ddof=1) + b.var(ddof=1)) / 2)
            smd = float((b.mean() - a.mean()) / sd) if sd > 0 else 0.0
            ks = sps.ks_2samp(a, b, method="asymp")
            drift.append({"scope": name, "smd": r4(smd, 3), "ks": r4(float(ks.statistic), 3), "ksP": r4(float(ks.pvalue), 4)})
            if worst is None or abs(smd) > abs(worst["smd"]):
                worst = drift[-1]
        rows.append({"feature": k, "source": source_of(k), "knownAtDecision": True, "missing": r4(miss), "missingWorstEdge": r4(miss_edge), "values": int(len(vals)),
                     "topValueShare": r4(top), "nearConstant": bool(top >= 0.95), "driftWorst": worst, "drift": drift})
    # redundancy: Spearman on the pooled usable rows, pairwise complete
    pairs = []
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            ok = ~np.isnan(X[a]) & ~np.isnan(X[b])
            if ok.sum() < 100 or np.std(X[a][ok]) == 0 or np.std(X[b][ok]) == 0:
                continue
            rho = float(sps.spearmanr(X[a][ok], X[b][ok]).statistic)
            if abs(rho) > 0.9:
                pairs.append({"a": a, "b": b, "rho": r4(rho, 3), "n": int(ok.sum())})
    pairs.sort(key=lambda p: -abs(p["rho"]))
    gm = np.array([r["f"].get("entryOffset") for r in use if r["edge"] == "gmp"], dtype=float)
    gm = np.abs(gm[~np.isnan(gm)])
    drifted = [x for x in rows if x["driftWorst"] and abs(x["driftWorst"]["smd"]) >= 0.25]
    return {
        "inputs": len(names), "sources": SOURCES, "bySource": {s: sum(1 for x in rows if x["source"] == s) for s in SOURCES},
        "knownAtDecision": sum(1 for x in rows if x["knownAtDecision"]), "notKnownAtDecision": 0,
        "how": "traced in assets/academy-core.js build(): every value is computed from snapshot.bars (closed bars only), snapshot.t and the candidate's side / entry / stop / target; outcomes are joined to the matrix afterwards as label columns",
        "marketEntryNote": {"what": "the entry of a market order is the price it is filled at. For gmp that is the open of the first M1 bar after t, one tick after the decision time; the features that use the entry (%s) carry that tick" % ", ".join(GEOMETRY),
                            "gmpRows": int(len(gm)), "medianAbsEntryOffsetAtr": r4(float(np.median(gm)), 3), "shareAbove0_1Atr": r4(float((gm > 0.1).mean())), "shareAbove0_25Atr": r4(float((gm > 0.25).mean()))},
        "missingAny": sum(1 for x in rows if x["missing"] > 0), "missingOver5pct": [x["feature"] for x in rows if x["missing"] > 0.05],
        "nearConstant": [x["feature"] for x in rows if x["nearConstant"]],
        "drifted": sorted([{"feature": x["feature"], **x["driftWorst"]} for x in drifted], key=lambda d: -abs(d["smd"])),
        "driftLine": "|standardised mean difference| of at least 0.25 between the first and the second half (by time) of a scope's usable train rows",
        "redundantPairs": pairs, "table": rows,
    }


# --------------------------------------------------------------------------------------------------------- 2. the labels
def audit_labels(rows, use, outs, windows):
    per = {}
    for e in T.EDGES:
        mine = [r for r in rows if r["edge"] == e and not r["clockShift"] and not r["pre2020"]]
        u = [r for r in use if r["edge"] == e]
        R = np.array([r["netR"] for r in u], dtype=float)
        gross = np.array([r["R"] for r in u], dtype=float)
        reasons, unfilled = {}, {}
        for r in mine:
            (reasons if r["filled"] else unfilled)[r["reason"]] = (reasons if r["filled"] else unfilled).get(r["reason"], 0) + 1
        time_rows = [r for r in u if r["reason"] == "time"]
        adds = sum(1 for r in u if outs.get(r["id"], {}).get("add"))
        hold = [(r["exitT"] - r["t"]) / 3600 for r in u]
        by_t, latest, overlap = sorted(u, key=lambda r: r["t"]), -1, 0
        for r in by_t:                                    # opened while an earlier trade of the same edge was still open
            overlap += r["t"] < latest
            latest = max(latest, r["exitT"])
        per[e] = {
            "orders": len(mine), "unfilled": unfilled, "unfilledN": sum(unfilled.values()), "filled": sum(reasons.values()), "usable": len(u), "exitReasons": reasons,
            "winRate": r4(float((R > 0).mean())) if len(u) else None, "wins": int((R > 0).sum()), "losses": int((R <= 0).sum()),
            "netR": {"mean": r4(float(R.mean())), "sd": r4(float(R.std(ddof=1))), "median": r4(float(np.median(R))), "min": r4(float(R.min())), "max": r4(float(R.max()))} if len(u) > 1 else None,
            "grossWinNetLoss": int(((gross > 0) & (R <= 0)).sum()),
            "timeExits": {"n": len(time_rows), "winRate": r4(float(np.mean([r["win"] for r in time_rows]))) if time_rows else None},
            "withAdd": adds, "withAddShare": r4(adds / len(u)) if u else None,
            "holdHours": {"median": r2(float(np.median(hold))), "max": r2(float(max(hold)))} if hold else None,
            "openedWhileAnotherWasOpen": int(overlap), "openedWhileAnotherWasOpenShare": r4(overlap / len(u)) if u else None,
            "ruleWindowHours": T.RULE_WINDOW_H[e], "embargoHours": r2(windows[e] / 3600),
        }
    return {
        "label": "win = 1 when the position's net R (after the round-trip cost) is above 0, else 0; the ridge configuration fits net R itself",
        "position": "net R is the whole position as the study books it: the first unit plus its pyramid add (replica, mosha-bo, gtrend), with the rule's size where the rule sizes",
        "unfilled": "an order that never filled (missed, expired, cancelled) has no label and is in no training row, no metric and no average",
        "timeExits": "a time exit is labelled like any other exit: by the sign of its net R",
        "afterTheExit": "the recorded exit time is the first unit's. An add leg is managed on its own and can close later, up to the first unit's deadline, so the label of a position with an add can depend on prices after the recorded exit",
        "independence": "trades of one edge that are open together share the same market move: a Welch t treats them as independent, so it overstates the evidence where openedWhileAnotherWasOpenShare is high",
        "classBalance": "win rates run from 0.24 (replica) to 0.51 (gtl). No class weights are used: the AUC and the kept-minus-skipped test do not depend on the balance, and probabilities are judged against the prior rate",
        "selection": "training on filled orders only conditions on something not known at the signal time for the two limit-order edges (mosha-bo, geg): the scorer then estimates P(win | the order fills)",
        "perEdge": per,
    }


# ------------------------------------------------------------------------------------------------------------ 3. leakage
def label_of(run):
    lab = T.CONFIGS[run["config"]]["label"]
    return run["scope"] if lab is None else "%s · %s" % (run["scope"], lab)


def stat_of(run):
    o = T.overall(run["wf"], MAIN)
    return {"auc": o["auc"], "t": o["trading"]["keptMinusSkippedT"], "skipped": o["trading"]["skipped"]["n"]}


def permute(rows, seed):
    """The labels (win and net R together) shuffled inside each edge among the usable rows. Features and times stay."""
    rng = np.random.default_rng(seed)
    out = [dict(r) for r in rows]
    for e in T.EDGES:
        idx = [i for i, r in enumerate(out) if r["edge"] == e and T.usable(r)]
        src = rng.permutation(idx)
        lab = [(rows[j]["win"], rows[j]["netR"]) for j in src]
        for i, (w, nr) in zip(idx, lab):
            out[i]["win"], out[i]["netR"] = w, nr
    return out


def leak_permutation(rows, m, real, n_seeds):
    by = {run["id"]: {"scope": label_of(run), "config": run["config"], "auc": [], "t": []} for run in real}
    for s in range(n_seeds):
        runs, _, _, _ = T.run_all(permute(rows, 1000 + s), m)
        for run in runs:
            st = stat_of(run)
            if st["auc"] is not None:
                by[run["id"]]["auc"].append(st["auc"])
            if st["t"] is not None:
                by[run["id"]]["t"].append(st["t"])
    aucs = [a for v in by.values() for a in v["auc"]]
    ts = [t for v in by.values() for t in v["t"]]
    per = [{"scorer": k, "scope": v["scope"], "config": v["config"], "meanAuc": r4(float(np.mean(v["auc"])), 3) if v["auc"] else None, "sdAuc": r4(float(np.std(v["auc"], ddof=1)), 3) if len(v["auc"]) > 1 else None,
            "minAuc": r4(min(v["auc"]), 3) if v["auc"] else None, "maxAuc": r4(max(v["auc"]), 3) if v["auc"] else None,
            "tests": len(v["t"]), "meanT": r2(float(np.mean(v["t"]))) if v["t"] else None, "tAtLeast2": sum(1 for t in v["t"] if t >= 2), "tAtMostMinus2": sum(1 for t in v["t"] if t <= -2)} for k, v in by.items()]
    return {"seeds": n_seeds, "what": "win and net R shuffled together inside each edge, every scorer re-run walk-forward",
            "runs": len(aucs), "meanAuc": r4(float(np.mean(aucs)), 4), "sdAuc": r4(float(np.std(aucs, ddof=1)), 4), "aucRange": [r4(min(aucs), 3), r4(max(aucs), 3)],
            "tests": len(ts), "meanT": r2(float(np.mean(ts))), "shareTAtLeast2": r4(float(np.mean([t >= 2 for t in ts]))), "shareAbsTAtLeast2": r4(float(np.mean([abs(t) >= 2 for t in ts]))),
            "expectedByChance": {"shareTAtLeast2": 0.0228, "shareAbsTAtLeast2": 0.0455}, "perScorer": per}


def leak_canary(rows, m, windows, real):
    """Two columns that are only known after the trade: net R plus noise, and the holding time. The metric must jump."""
    rng = np.random.default_rng(4242)
    noisy = {}
    for r in rows:
        if T.usable(r):
            noisy[r["id"]] = (r["netR"] + float(rng.normal(0, 1.0)), (r["exitT"] - r["t"]) / 3600.0)
    out = []
    for canary in ("canaryNetR", "canaryHoldHours"):
        rows2 = []
        for r in rows:
            d = dict(r)
            d["f"] = dict(r["f"])
            if r["id"] in noisy:
                d["f"][canary] = noisy[r["id"]][0 if canary == "canaryNetR" else 1]
            rows2.append(d)
        m2 = dict(m, featureKeys=m["featureKeys"] + [canary])
        short = dict(T.CONFIGS["logit-short"], features=T.SHORT + [canary])
        for scope in ["replica", "gtl", "gmp", "nq-open", "pooled"]:
            part, use = T.scope_rows(rows2, scope)
            for label, cfg, base_cfg in (("gbt", T.CONFIGS["gbt"], "gbt"), ("logit-short", short, "logit-short")):
                if scope == "pooled" and label == "logit-short":
                    continue
                names = T.feature_names(m2, cfg, scope == "pooled")
                st = stat_of({"wf": T.walk_forward(use, names, cfg, scope == "pooled", windows)})
                clean = [stat_of(x) for x in real if x["scope"] == scope and x["config"] == base_cfg][0]
                out.append({"canary": canary, "scope": scope, "config": label, "cleanAuc": clean["auc"], "canaryAuc": st["auc"], "cleanT": clean["t"], "canaryT": st["t"]})
    nr = [x for x in out if x["canary"] == "canaryNetR"]
    return {"what": "scratch runs with one leaking column added: canaryNetR = the trade's net R plus unit normal noise; canaryHoldHours = hours from the signal to the exit",
            "runs": out, "netR": {"meanCleanAuc": r4(float(np.mean([x["cleanAuc"] for x in nr])), 3), "meanCanaryAuc": r4(float(np.mean([x["canaryAuc"] for x in nr])), 3),
                                  "minCanaryAuc": r4(min(x["canaryAuc"] for x in nr), 3), "meanCanaryT": r2(float(np.mean([x["canaryT"] for x in nr if x["canaryT"] is not None]))),
                                  "minCanaryT": r2(min(x["canaryT"] for x in nr if x["canaryT"] is not None))},
            "noisy": noisy}


def leak_single(m, use, scopes, noisy, n_perm):
    """Single-feature AUC of every real feature, against what shuffled labels give and against the canaries."""
    names = T.feature_names(m, T.CONFIGS["gbt"], False)
    out = {}
    for sname, mask in scopes.items():
        rows = [r for r, k in zip(use, mask) if k]
        y = np.array([r["win"] for r in rows], dtype=float)
        cols = {k: col(rows, k) for k in names}
        real = sorted([{"feature": k, "auc": r4(a, 3)} for k in names for a in [auc_free(cols[k], y)] if a is not None], key=lambda d: -d["auc"])
        # shuffled labels: the largest single-feature AUC among all features, per shuffle
        ranks = {}
        for k in names:
            ok = ~np.isnan(cols[k])
            if ok.sum() >= 20 and np.std(cols[k][ok]) > 0:
                ranks[k] = (ok, sps.rankdata(cols[k][ok]))
        rng, mx = np.random.default_rng(77), []
        for _ in range(n_perm):
            yp, best = rng.permutation(y), 0.5
            for k, (ok, rk) in ranks.items():
                yy = yp[ok]
                n1 = yy.sum()
                n0 = len(yy) - n1
                if n1 == 0 or n0 == 0:
                    continue
                a = (rk[yy == 1].sum() - n1 * (n1 + 1) / 2) / (n1 * n0)
                best = max(best, a, 1 - a)
            mx.append(best)
        cn = np.array([noisy[r["id"]][0] for r in rows])
        ch = np.array([noisy[r["id"]][1] for r in rows])
        null95 = float(np.quantile(mx, 0.95))
        out[sname] = {"n": len(rows), "features": len(real), "top": real[:5], "maxAuc": real[0]["auc"], "maxFeature": real[0]["feature"],
                      "shuffledMaxAuc": {"median": r4(float(np.median(mx)), 3), "p95": r4(null95, 3), "max": r4(float(max(mx)), 3), "shuffles": n_perm},
                      "aboveShuffledP95": [x["feature"] for x in real if x["auc"] > null95],
                      "canaryNetRAuc": r4(auc_free(cn, y), 3), "canaryHoldHoursAuc": r4(auc_free(ch, y), 3)}
    return out


def leak_boundaries(m, rows, windows, outs):
    """Training rows whose label could still change when a test block starts, under three rules."""
    res = []
    for scope in ["replica", "gtl", "gmp", "nq-open", "pooled"]:
        _, use = T.scope_rows(rows, scope)
        t = np.array([r["t"] for r in use])
        ex = np.array([r["exitT"] for r in use])
        end = np.array([r["t"] + windows[r["edge"]] for r in use])
        # the latest moment an add leg can close: its first unit's deadline, plus a weekend
        dead = np.array([(outs[r["id"]].get("fillT", r["t"]) + ADD_DEADLINE_H[r["edge"]] * 3600 + T.WEEKEND_SEC) if outs[r["id"]].get("add") and r["edge"] in ADD_DEADLINE_H else r["exitT"] for r in use])
        dead = np.maximum(dead, ex)
        row = {"scope": scope, "rows": len(use), "blocks": 0,
               "noEmbargo": {"firstUnitOpen": 0, "labelMayBeOpen": 0}, "oldRule": {"firstUnitOpen": 0, "addMayBeOpen": 0, "admitted": 0},
               "newRule": {"firstUnitOpen": 0, "addMayBeOpen": 0, "admitted": 0, "heldBack": 0},
               "thresholdOld": {"rows": 0, "tradeOpenAtStart": 0, "firstUnitOpenAtStart": 0}, "thresholdNew": {"rows": 0, "tradeOpenAtStart": 0, "firstUnitOpenAtStart": 0, "heldBack": 0}}
        folds = T.folds_of(t, end)
        seen = np.zeros(len(use), bool)
        for j, (tr, te, start, held) in enumerate(folds):
            a = te[0]
            before = np.arange(a)
            row["blocks"] += 1
            row["noEmbargo"]["firstUnitOpen"] += int((ex[before] > start).sum())
            row["noEmbargo"]["labelMayBeOpen"] += int((dead[before] > start).sum())
            old = before[ex[before] + 86400 <= start]
            row["oldRule"]["admitted"] += int(len(old))
            row["oldRule"]["firstUnitOpen"] += int((ex[old] > start).sum())
            row["oldRule"]["addMayBeOpen"] += int((dead[old] > start).sum())
            row["newRule"]["admitted"] += int(len(tr))
            row["newRule"]["heldBack"] += int(held)
            row["newRule"]["firstUnitOpen"] += int((ex[tr] > start).sum())
            row["newRule"]["addMayBeOpen"] += int((dead[tr] > start).sum())
            if j > 0:
                ref_old = np.where(seen)[0]
                ref_new = np.where(seen & (end <= start))[0]
                row["thresholdOld"]["rows"] += int(len(ref_old))
                row["thresholdOld"]["tradeOpenAtStart"] += int((dead[ref_old] > start).sum())
                row["thresholdOld"]["firstUnitOpenAtStart"] += int((ex[ref_old] > start).sum())
                row["thresholdNew"]["firstUnitOpenAtStart"] += int((ex[ref_new] > start).sum())
                row["thresholdNew"]["rows"] += int(len(ref_new))
                row["thresholdNew"]["tradeOpenAtStart"] += int((dead[ref_new] > start).sum())
                row["thresholdNew"]["heldBack"] += int(len(ref_old) - len(ref_new))
            seen[te] = True
        res.append(row)
    tot = lambda a, b: sum(x[a][b] for x in res)
    return {"what": "counted at every test-block start of the design, summed over the blocks of a scope. firstUnitOpen = the recorded exit is after the block's start. addMayBeOpen / labelMayBeOpen = the position's last possible close (an add leg's deadline plus a weekend) is after it. oldRule = the first trainer's rule (first-unit exit plus one day). newRule = signal time plus the edge's label window",
            "perScope": res,
            "violationsWithoutEmbargo": tot("noEmbargo", "labelMayBeOpen"), "violationsOldRule": tot("oldRule", "firstUnitOpen") + tot("oldRule", "addMayBeOpen"),
            "violationsWithEmbargo": tot("newRule", "firstUnitOpen") + tot("newRule", "addMayBeOpen"),
            "thresholdViolationsOld": tot("thresholdOld", "tradeOpenAtStart"), "thresholdViolationsNew": tot("thresholdNew", "tradeOpenAtStart")}


def run_trainer(matrix, out_dir):
    """python ml/train.py --matrix <matrix> --out <out_dir>, run in this process (its printed lines are dropped)."""
    argv, stdout = sys.argv, sys.stdout
    sys.argv, sys.stdout = ["train.py", "--matrix", matrix, "--out", out_dir], io.StringIO()
    try:
        T.main()
    finally:
        sys.argv, sys.stdout = argv, stdout


def leak_exam(m, real, other_ids, quick):
    fitted = set()
    hits = 0
    for run in real:
        ids = set(run["wf"]["ids"])
        fitted |= ids
        hits += len(ids & other_ids)
    res = {"notTrainCandidates": len(other_ids), "droppedByTheLoader": int(sum(m["notTrainDropped"].values())), "fits": len(real), "distinctFittedIds": len(fitted), "examIdsInAnyFit": hits}
    # the same training run on a matrix whose not-train rows are overwritten with noise: every output byte must match
    with gzip.open(T.MATRIX, "rt", encoding="utf-8") as fh:
        raw = json.load(fh)
    lab = raw["labelKeys"]
    ip, nl = lab.index("pool"), len(lab)
    rng = np.random.default_rng(99)
    changed = 0
    for r in raw["rows"]:
        if r[ip] == "train":
            continue
        changed += 1
        for k in ("filled", "reason", "R", "netR", "win", "exitT"):
            r[lab.index(k)] = {"filled": True, "reason": "target", "R": 9.0, "netR": float(rng.normal(5, 3)), "win": int(rng.integers(0, 2)), "exitT": int(r[lab.index("t")] + 60)}[k]
        r[nl] = [float(rng.normal(0, 100)) for _ in r[nl]]
    with tempfile.TemporaryDirectory() as tmp:
        scr = os.path.join(tmp, "scrambled.json.gz")
        with gzip.open(scr, "wt", encoding="utf-8") as fh:
            json.dump(raw, fh)
        del raw
        outs = {}
        for name, mat in (("real", T.MATRIX), ("scrambled", scr)):
            d = os.path.join(tmp, name)
            run_trainer(mat, d)
            outs[name] = {f: T.sha(open(os.path.join(d, f), "rb").read()) for f in sorted(os.listdir(d))}
        same = outs["real"] == outs["scrambled"]
        committed = None
        if os.path.exists(os.path.join(MODELS, "index.json")):
            cm = {f: T.sha(open(os.path.join(MODELS, f), "rb").read()) for f in sorted(os.listdir(MODELS)) if os.path.isfile(os.path.join(MODELS, f))}
            committed = cm == outs["real"]
    res["scramble"] = {"rowsOverwritten": changed, "what": "every label column and every feature value of every row outside the train pool replaced with noise, then python ml/train.py run on both matrices",
                       "files": len(outs["real"]), "identical": bool(same), "matchesCommittedModels": committed}
    return res


# ------------------------------------------------------------------------------------------------- 4. sample size, power
def audit_power(use, real):
    per, cannot = {}, []
    for e in T.EDGES:
        u = sorted([r for r in use if r["edge"] == e], key=lambda r: r["t"])
        R = np.array([r["netR"] for r in u], dtype=float)
        n, sd = len(u), float(R.std(ddof=1))
        first = u[: int(round(T.FIRST_TRAIN * n))]
        w_all, w_first = int((R > 0).sum()), int(sum(r["win"] for r in first))
        minority, minority_first = min(w_all, n - w_all), min(w_first, len(first) - w_first)
        fitted = n >= T.MIN_ROWS
        oof = n - int(round(T.FIRST_TRAIN * n))
        mde = lambda nk, ns: T.T_LINE * sd * math.sqrt(1 / nk + 1 / ns) if nk > 0 and ns > 0 else None
        per[e] = {"n": n, "fitted": fitted, "outOfFoldN": oof if fitted else None, "winRate": r4(w_all / n), "meanNetR": r4(float(R.mean())), "sdNetR": r4(sd),
                  "tOfTheEdgeItself": r2(T.tstat(R)),
                  "mdeEvenSplit": r4(mde(oof / 2, oof / 2), 3) if fitted else r4(mde(n / 2, n / 2), 3), "mde80_20": r4(mde(0.8 * oof, 0.2 * oof), 3) if fitted else r4(mde(0.8 * n, 0.2 * n), 3),
                  "mdeOn": "its out-of-fold trades" if fitted else "all of its usable trades, as if none were needed for fitting (it has no out-of-fold sample)",
                  "mdeEvenSplitInSd": r4(T.T_LINE * math.sqrt(4 / (oof if fitted else n)), 3),
                  "minorityAll": minority, "minorityFirstWindow": minority_first,
                  "eventsPerInput": {"70inputs": {"all": r2(minority / 70), "firstWindow": r2(minority_first / 70)}, "7inputs": {"all": r2(minority / 7), "firstWindow": r2(minority_first / 7)}}}
        if minority / 7 < 10:
            cannot.append(e)
    n = len(use)
    Rp = np.array([r["netR"] for r in use], dtype=float)
    oof = n - int(round(T.FIRST_TRAIN * n))
    per["pooled"] = {"n": n, "fitted": True, "outOfFoldN": oof, "winRate": r4(float((Rp > 0).mean())), "meanNetR": r4(float(Rp.mean())), "sdNetR": r4(float(Rp.std(ddof=1))), "tOfTheEdgeItself": r2(T.tstat(Rp)),
                     "mdeEvenSplit": r4(T.T_LINE * float(Rp.std(ddof=1)) * math.sqrt(4 / oof), 3), "mde80_20": r4(T.T_LINE * float(Rp.std(ddof=1)) * math.sqrt(1 / (0.8 * oof) + 1 / (0.2 * oof)), 3),
                     "mdeOn": "its out-of-fold trades", "mdeEvenSplitInSd": r4(T.T_LINE * math.sqrt(4 / oof), 3)}
    return {"what": "mde = the smallest kept-minus-skipped difference in net R a trade that gives a Welch t of 2 when both groups have the edge's own SD: 2 x SD x sqrt(1/kept + 1/skipped). eventsPerInput = trades of the smaller class divided by the number of inputs",
            "line": "an edge with fewer than 10 events per input even for the 7-input configurations, on all of its trades, cannot support a trained scorer",
            "cannotSupportAScorer": cannot,
            "noteOnTheFitted": "for the four fitted edges the first training window holds 2 to 15 events per input with 7 inputs and under 2 with 70: the 70-input reference is fitted far beyond what the data supports",
            "perEdge": per}


# --------------------------------------------------------------------------------------------------------- 5. overfitting
def audit_overfit(rows, m, real, quick):
    gap = []
    for run in real:
        o = T.overall(run["wf"], MAIN)
        gap.append({"scorer": run["id"], "scope": label_of(run), "config": run["config"], "inFoldAuc": o["inFoldAuc"], "outOfFoldAuc": o["auc"],
                    "gap": r4(o["inFoldAuc"] - o["auc"], 3) if o["inFoldAuc"] is not None and o["auc"] is not None else None})
    seeds = {}
    for s in SEEDS:
        runs, _, _, _ = T.run_all(rows, m, ["gbt"], seed=s)
        for run in runs:
            st = stat_of(run)
            seeds.setdefault(run["scope"], []).append({"seed": s, "auc": st["auc"], "t": st["t"], "skipped": st["skipped"]})
    seed_rows = [{"scope": k, "aucRange": [min(x["auc"] for x in v), max(x["auc"] for x in v)], "tRange": [min(x["t"] for x in v if x["t"] is not None), max(x["t"] for x in v if x["t"] is not None)], "runs": v} for k, v in seeds.items()]
    folds = {}
    for k in FOLD_COUNTS:
        runs, _, _, _ = T.run_all(rows, m, k=k)
        for run in runs:
            st = stat_of(run)
            folds.setdefault(run["id"], {"scope": label_of(run), "config": run["config"], "runs": []})["runs"].append({"blocks": k, "auc": st["auc"], "t": st["t"], "skipped": st["skipped"]})
    fold_rows = []
    for i, v in folds.items():
        ts = [x["t"] for x in v["runs"] if x["t"] is not None]
        fold_rows.append({"scorer": i, "scope": v["scope"], "config": v["config"], "tRange": [min(ts), max(ts)] if ts else None, "aucRange": [min(x["auc"] for x in v["runs"]), max(x["auc"] for x in v["runs"])],
                          "anyTAtLeast2": any(t >= 2 for t in ts), "signChanges": bool(ts and min(ts) < 0 < max(ts)), "runs": v["runs"]})
    gaps = [g["gap"] for g in gap if g["gap"] is not None]
    return {"inFoldVsOutOfFold": gap, "meanGap": r4(float(np.mean(gaps)), 3), "maxGap": r4(max(gaps), 3), "meanGapByConfig": {c: r4(float(np.mean([g["gap"] for g in gap if g["config"] == c and g["gap"] is not None])), 3) for c in T.CONFIGS},
            "seeds": {"what": "the reference scorer (the only configuration that samples rows and columns), seeds %s" % SEEDS, "perScope": seed_rows},
            "foldCounts": {"what": "every scorer with %s test blocks" % FOLD_COUNTS, "perScorer": fold_rows, "scorersWithTAtLeast2InAnyRun": sum(1 for x in fold_rows if x["anyTAtLeast2"]),
                           "scorersWhoseTChangesSign": sum(1 for x in fold_rows if x["signChanges"]), "scorers": len(fold_rows)}}


# --------------------------------------------------------------------------------------------------------- 6. calibration
def audit_calibration(real):
    rng, out = np.random.default_rng(31), []
    for run in real:
        wf = run["wf"]
        if wf["kind"] == "ridge":
            out.append({"scorer": run["id"], "scope": label_of(run), "config": run["config"], "probability": False, "note": "an expected R, not a probability: no Brier score; it may never be shown as a probability"})
            continue
        te = wf["in_test"]
        p, y, prior = wf["oof"][MAIN][te], wf["y"][te], wf["oof"]["prior"][te]
        if wf["pooled"]:                                  # a pooled scorer is held to the prior rate of each trade's own edge
            prior = wf["oof"]["priorEdge"][te]
        d = (p - y) ** 2 - (prior - y) ** 2
        boot = [float(d[rng.integers(0, len(d), len(d))].mean()) for _ in range(2000)]
        bins = T.calibration(p, y)
        ece = sum(b["n"] * abs(b["meanP"] - b["winRate"]) for b in bins) / len(y)
        mono = all(bins[i + 1]["winRate"] >= bins[i]["winRate"] for i in range(len(bins) - 1))
        out.append({"scorer": run["id"], "scope": label_of(run), "config": run["config"], "probability": True, "n": int(len(y)), "brier": r4(T.brier(p, y)), "brierPrior": r4(T.brier(prior, y)), "priorIs": "each trade's own edge's training win rate" if wf["pooled"] else "the training win rate",
                    "brierMinusPrior": r4(float(d.mean())), "ci95": [r4(float(np.quantile(boot, 0.025))), r4(float(np.quantile(boot, 0.975)))],
                    "betterThanPrior": bool(np.quantile(boot, 0.975) < 0), "worseThanPrior": bool(np.quantile(boot, 0.025) > 0),
                    "ece": r4(ece), "meanP": r4(float(p.mean())), "winRate": r4(float(y.mean())), "spreadOfP": [r4(float(np.quantile(p, 0.1)), 3), r4(float(np.quantile(p, 0.9)), 3)],
                    "binsRiseWithP": bool(mono), "bins": bins})
    pr = [x for x in out if x["probability"]]
    return {"what": "out of fold, the scorer's own probability (before any Platt step). brierMinusPrior below 0 is better than the prior rate; the interval is a bootstrap over trades (2,000 resamples)",
            "rule": "no number may be shown as a probability unless it is calibrated out of fold; a scorer whose Brier interval does not sit below 0 has shown no probability skill",
            "scorers": len(out), "probabilityScorers": len(pr), "betterThanPrior": sum(1 for x in pr if x["betterThanPrior"]), "worseThanPrior": sum(1 for x in pr if x["worseThanPrior"]),
            "cannotTell": sum(1 for x in pr if not x["betterThanPrior"] and not x["worseThanPrior"]), "binsRiseWithP": sum(1 for x in pr if x["binsRiseWithP"]), "perScorer": out}


# ------------------------------------------------------------------------------------------------------------- 7. regimes
def audit_regimes(real):
    out = []
    for run in real:
        wf = run["wf"]
        te = np.where(wf["in_test"])[0]
        keep, R = wf["kept"][MAIN][te], wf["R"][te]
        z = wf["oof"]["adj"][te] if wf["pooled"] else R
        rows = [run["rows"][i] for i in te]
        year = np.array([datetime.datetime.fromtimestamp(r["t"], datetime.timezone.utc).year for r in rows])

        def split(labels):
            res = []
            for v in sorted(set(labels.tolist()), key=str):
                mk = labels == v
                w = T.welch_full(z[mk & keep], z[mk & ~keep]) if min((mk & keep).sum(), (mk & ~keep).sum()) >= MIN_GROUP else None
                res.append({"value": v if not isinstance(v, np.integer) else int(v), "n": int(mk.sum()), "keptN": int((mk & keep).sum()), "kept": r4(float(R[mk & keep].mean()), 3) if (mk & keep).any() else None,
                            "skippedN": int((mk & ~keep).sum()), "skipped": r4(float(R[mk & ~keep].mean()), 3) if (mk & ~keep).any() else None, "t": r2(w["t"]) if w else None})
            return res
        by_year = split(year)
        loyo = []
        for yv in sorted(set(year.tolist())):
            mk = year != yv
            w = T.welch_full(z[mk & keep], z[mk & ~keep]) if min((mk & keep).sum(), (mk & ~keep).sum()) >= MIN_GROUP else None
            loyo.append({"without": int(yv), "t": r2(w["t"]) if w else None})
        lt = [x["t"] for x in loyo if x["t"] is not None]
        allw = T.welch_full(z[keep], z[~keep])
        yt = [x for x in by_year if x["t"] is not None]
        out.append({"scorer": run["id"], "scope": label_of(run), "config": run["config"], "t": r2(allw["t"]) if allw else None,
                    "byYear": by_year, "yearsWithATest": len(yt), "yearsKeptBetter": sum(1 for x in yt if x["t"] > 0), "bestYear": max(yt, key=lambda x: x["t"]) if yt else None,
                    "leaveOneYearOut": loyo, "leaveOneYearOutRange": [min(lt), max(lt)] if lt else None,
                    "byRegime": split(np.array([str(r["f"].get("regimeBase")) for r in rows])), "byVolState": split(np.array([str(r["f"].get("volState")) for r in rows]))})
    cells = [(x["scope"], kind, c) for x in out for kind in ("byRegime", "byVolState") for c in x[kind] if c["t"] is not None]
    return {"what": "out of fold, kept against skipped inside each calendar year, each regimeBase label and each volState; and the overall t with one year left out at a time. Pooled scorers on edge-adjusted net R. A t is given only when both groups have at least %d trades" % MIN_GROUP,
            "regimeCellsWithATest": len(cells), "regimeCellsWithTAtLeast2": [{"scorer": s, "split": k, "value": c["value"], "t": c["t"], "keptN": c["keptN"], "skippedN": c["skippedN"]} for s, k, c in cells if c["t"] >= 2],
            "regimeCellsWithTAtMostMinus2": sum(1 for s, k, c in cells if c["t"] <= -2),
            "yearCellsWithATest": sum(x["yearsWithATest"] for x in out), "yearCellsKeptBetter": sum(x["yearsKeptBetter"] for x in out),
            "scorersWithOverallTAtLeast2": sum(1 for x in out if x["t"] is not None and x["t"] >= 2),
            "scorersWithALeaveOneYearOutTAtLeast2": sum(1 for x in out if x["leaveOneYearOutRange"] and x["leaveOneYearOutRange"][1] >= 2),
            "singleYearsWithTAtLeast2": [{"scorer": x["scope"], "year": y["value"], "t": y["t"], "keptN": y["keptN"], "skippedN": y["skippedN"]} for x in out for y in x["byYear"] if y["t"] is not None and y["t"] >= 2],
            "perScorer": out}


# ---------------------------------------------------------------------------------------------- the protocol, old and new
def protocol_effect(rows, m, real):
    """The reference scorer under the first trainer's two rules and under the corrected ones."""
    old = {}
    if os.path.exists(ARCHIVE):
        with open(ARCHIVE) as fh:
            for e in json.load(fh)["models"]:
                tr = e["outOfFold"]["gbt"]["trading"]
                old[e["scope"]] = {"auc": e["outOfFold"]["gbt"]["auc"], "t": tr["keptMinusSkippedT"], "keptN": tr["kept"]["n"], "skippedN": tr["skipped"]["n"]}
    out = []
    combos = [("exit+1d", "all", "the first trainer's rules"), ("window", "all", "the embargo corrected, the threshold rule as before"), ("exit+1d", "closed", "the threshold rule corrected, the embargo as before"), ("window", "closed", "both corrected (this run)")]
    for emb, ref, label in combos:
        runs, _, _, _ = T.run_all(rows, m, ["gbt"], embargo=emb, threshold=ref)
        for run in runs:
            o = T.overall(run["wf"], MAIN)
            out.append({"scope": run["scope"], "embargo": emb, "threshold": ref, "label": label, "auc": o["auc"], "t": o["trading"]["keptMinusSkippedT"], "keptN": o["trading"]["kept"]["n"], "skippedN": o["trading"]["skipped"]["n"],
                        "kept": o["trading"]["kept"]["avg"], "skipped": o["trading"]["skipped"]["avg"]})
    repro = all(any(x["scope"] == s and x["embargo"] == "exit+1d" and x["threshold"] == "all" and x["t"] == v["t"] and x["auc"] == v["auc"] for x in out) for s, v in old.items()) if old else None
    spans = []
    for s in sorted(set(x["scope"] for x in out), key=lambda s: (T.EDGES + ["pooled"]).index(s)):
        ts = [x["t"] for x in out if x["scope"] == s and x["t"] is not None]
        spans.append({"scope": s, "tArchived": old.get(s, {}).get("t"), "tNow": [x["t"] for x in out if x["scope"] == s and x["embargo"] == "window" and x["threshold"] == "closed"][0], "tRange": [min(ts), max(ts)]})
    return {"what": "the reference scorer (C0) walked forward four ways. The fitted trees are the same in all four: only which rows train a fold and which trades choose a threshold change",
            "archived": old, "reproducesTheArchivedNumbers": repro, "runs": out, "perScope": spans}


def policy_signs():
    """What the stored short-list fits lean on (every usable train row, so in sample: a description, not a test)."""
    with open(os.path.join(MODELS, "index.json")) as fh:
        idx = json.load(fh)
    if idx["code"]["train.py"] != T.sha(open(os.path.join(HERE, "train.py"), "rb").read())[:12]:
        sys.exit("ml/models was written by another ml/train.py: run python ml/train.py first")
    stumps, logistic = [], []
    for e in idx["models"]:
        if e["config"] == "mono-gbt":
            with open(os.path.join(MODELS, e["file"])) as fh:
                model = json.load(fh)
            counts = {}
            for t in model["trees"]:
                if "v" not in t:
                    k = model["featureNames"][t["f"]]
                    counts[k] = counts.get(k, 0) + 1
            stumps.append({"scorer": e["scope"], "trees": len(model["trees"]), "splits": counts, "policyFactorsUsed": [k for k in T.MONOTONE_UP if k in counts],
                           "splitsOnPolicyFactors": sum(v for k, v in counts.items() if k in T.MONOTONE_UP), "splitsOnOtherInputs": sum(v for k, v in counts.items() if k not in T.MONOTONE_UP)})
        elif e["kind"] == "logistic":
            w = dict(zip(e["coefficients"]["inputs"], e["coefficients"]["weights"]))
            logistic.append({"scorer": e["scope"], "weights": {k: w.get(k) for k in T.SHORT}, "policyFactorsPositive": [k for k in T.MONOTONE_UP if (w.get(k) or 0) > 0],
                             "policyFactorsNegative": [k for k in T.MONOTONE_UP if (w.get(k) or 0) < 0]})
    pos, neg = sum(len(x["policyFactorsPositive"]) for x in logistic), sum(len(x["policyFactorsNegative"]) for x in logistic)
    with open(os.path.join(DATA, "eval.json")) as fh:      # the policy check (train pool only): TAKE against WAIT, all seven edges
        ev = json.load(fh)["overall"]
    return {"what": "the stored fits of the short-list configurations, on every usable train row: which inputs the constrained stumps split on, and the sign of each policy factor's weight in the logistic fits. In sample: a description, not a test",
            "policyCheck": {"file": "academy/data/eval.json", "n": ev["mechanical"]["n"], "takeMinusWait": ev["diff"]["takeMinusWait"], "t": ev["diff"]["t"]},
            "stumps": stumps, "logistic": logistic, "logisticPolicyWeights": {"positive": pos, "negative": neg, "of": pos + neg},
            "stumpSplits": {"onPolicyFactors": sum(x["splitsOnPolicyFactors"] for x in stumps), "onOtherInputs": sum(x["splitsOnOtherInputs"] for x in stumps)}}


def family_checks(real, family):
    """A permutation p for every family test with a t of at least 2: the kept / skipped labels reshuffled inside the test's own rows."""
    rng, out = np.random.default_rng(555), []
    by = {run["id"]: run for run in real}
    for x in family:
        if x["t"] is None or x["t"] < 2:
            continue
        wf = by[x["scorer"]]["wf"]
        te = wf["in_test"]
        keep, R, ed = wf["kept"][x["key"]][te], wf["R"][te], wf["edge"][te]
        if x["verdictTest"]:
            v, mask = (wf["oof"]["adj"][te] if wf["pooled"] else R), np.ones(len(R), bool)
        else:
            v, mask = R, ed == x["edge"]
        v, k = v[mask], keep[mask]
        obs, nk = v[k].mean() - v[~k].mean(), int(k.sum())
        hits, n = 0, 20000
        for _ in range(n):
            idx = rng.permutation(len(v))
            hits += (v[idx[:nk]].mean() - v[idx[nk:]].mean()) >= obs - 1e-12
        out.append({"scorer": label_of(by[x["scorer"]]), "id": x["scorer"], "line": x["line"], "edge": x["edge"], "verdictTest": x["verdictTest"], "kept": x["kept"], "skipped": x["skipped"], "diff": x["diff"], "t": x["t"],
                    "welchP": r4(x["p"], 6), "holmP": r4(x["pHolm"], 6), "permutationP": r4((hits + 1) / (n + 1), 4), "skippedNetR": [r4(float(a), 3) for a in v[~k]] if (~k).sum() <= 12 else None})
    return out


# ------------------------------------------------------------------------------------------------------------ RESULT.md
def f3(x, d=3):
    return "n/a" if x is None else "%.*f" % (d, x)


def sg(x, d=3):
    return "n/a" if x is None else "%+.*f" % (d, x)


def result_md(r):
    A, S, P = r["audit"], r["summary"], r["protocol"]
    F, L, K = A["features"], A["labels"], A["leakage"]
    perm, can, single, bnd, exam = K["permutation"], K["canary"], K["singleFeature"], K["foldBoundaries"], K["exam"]
    pw, ov, cal, reg = A["power"], A["overfitting"], A["calibration"], A["regimes"]
    sc = r["scorers"]
    ref = [s for s in sc if s["config"] == "gbt"]
    neg2 = [s for s in sc if s["t"] is not None and s["t"] <= -2]
    o = []
    o += ["# Academy scorer: training review (10 Nov 2026)", "",
          "**Verdict: %s**" % r["verdict"], "",
          "Paper research on the Academy's offline scorers (`ml/`). Pre-registration: `PREREGISTRATION.md`, committed before any new training run.",
          "Train pool only. Exam reads by this review: **%d**. Nothing is promoted and nothing here changes the decision engine, a rule or a trade." % r["examReads"], "",
          "- %d scorers were walked forward: the reference (C0) on 5 scopes and four pre-registered challenger configurations (C1 to C4) on %d. **%d pass, %d are rejected, %d promoted.**" % (S["scorers"], S["scorers"] - len(ref), S["passed"], S["rejected"], S["promoted"]),
          "- Best kept-minus-skipped t of a scorer's own test: **%s** (%s). %d of %d scorers have a negative t; %d are at or below -2 (the kept trades did worse than the skipped ones)." % (f3(S["bestVerdictT"], 2), S["bestVerdictScorer"], S["scorersWithNegativeT"], S["scorers"], S["scorersWithTAtMostMinus2"]),
          "- Smallest Holm-corrected p of a scorer's own test: %s over %d tests (the line is %s)." % (f3(S["smallestVerdictHolmP"], 4), S["familyTests"], f3(r["design"]["pLine"], 5)),
          "- Too small to support any trained scorer: %s." % ", ".join("%s (n %d)" % (e, pw["perEdge"][e]["n"]) for e in pw["cannotSupportAScorer"]),
          "- Two defects of the first trainer's validation were found and fixed, and one hazard removed (below). None of them hid a working scorer: the reference scorer is rejected before and after.", ""]

    o += ["## The scorers (out of fold)", "",
          "Kept and skipped are net R a trade. t = Welch, kept minus skipped (pooled scorers: on net R with each edge's training mean removed). p is one-sided; Holm over the %d tests of the run." % S["familyTests"], "",
          "| Scorer | Train n | Out-of-fold n | AUC out (in fold) | Brier | Prior Brier | Kept n | Kept R | Skipped n | Skipped R | t | p | Holm p | Max DD kept / all (R) | Lines failed | Verdict |",
          "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for s in sc:
        o.append("| %s | %d | %d | %s (%s) | %s | %s | %d | %s | %d | %s | %s | %s | %s | %s / %s | %s | %s |" % (
            s["scope"], s["trainRows"], s["outOfFoldN"], f3(s["auc"]), f3(s["inFoldAuc"]), f3(s["brier"], 4), f3(s["brierPrior"], 4), s["kept"]["n"], sg(s["kept"]["avg"]), s["skipped"]["n"], sg(s["skipped"]["avg"]),
            f3(s["t"], 2), f3(s["p"], 3), f3(s["pHolm"], 3), f3(s["maxDrawdown"]["kept"], 1), f3(s["maxDrawdown"]["mechanical"], 1), ", ".join(str(x) for x in s["linesFailed"]) or "none", "passed validation, not promoted" if s["passes"] else "rejected challenger"))
    o += ["", "The ridge scorers (C4) predict net R: they have no probability and no Brier score. Their line 4 is mean squared error against predicting the training mean.",
          "Not fitted in any configuration: %s. They are scored only inside the pooled scorers." % ", ".join(S["notFitted"]), ""]

    PS = r["policyFactors"]
    o += ["### What the short-list fits lean on (in sample: a description, not a test)", "",
          "The short list is the decision policy's five side-relative factors (`%s`) and two state numbers (`stopAtr`, `atrPctile`). The stumps (C2) may only use a policy factor in the direction the policy states." % "`, `".join(r["design"]["monotoneUp"]), "",
          "- Constrained stumps: **%d of their %d splits are on a policy factor**, the other %d on the two state numbers (and, for the pooled one, the edge id). %s." % (
              PS["stumpSplits"]["onPolicyFactors"], PS["stumpSplits"]["onPolicyFactors"] + PS["stumpSplits"]["onOtherInputs"], PS["stumpSplits"]["onOtherInputs"],
              "; ".join("%s: %s" % (x["scorer"], ", ".join("`%s` %d" % (k, v) for k, v in sorted(x["splits"].items(), key=lambda kv: -kv[1]))) for x in PS["stumps"])),
          "- Logistic fits (C1, C3): of the %d policy-factor weights, %d are positive (the policy's direction) and %d negative. %s." % (
              PS["logisticPolicyWeights"]["of"], PS["logisticPolicyWeights"]["positive"], PS["logisticPolicyWeights"]["negative"],
              "; ".join("%s: against the policy on %s" % (x["scorer"], ", ".join("`%s`" % k for k in x["policyFactorsNegative"]) or "none") for x in PS["logistic"])),
          "- Read with care: these are in-sample fits on a few hundred trades. What they do say is that the training data gives the policy's stated directions no clear support; that agrees with `academy/data/eval.json`, where the policy's TAKE and WAIT trades do not differ (%s R a trade, t %s, n %d)." % (sg(PS["policyCheck"]["takeMinusWait"]), f3(PS["policyCheck"]["t"], 2), PS["policyCheck"]["n"]), ""]

    o += ["## Power: what these samples can show", "",
          "MDE = the smallest kept-minus-skipped difference (net R a trade) that reaches t = 2 with the edge's own SD: 2 x SD x sqrt(1/kept + 1/skipped). Events per input = trades of the smaller class divided by the number of inputs.", "",
          "| Edge | Usable train n | Out-of-fold n | Win rate | Mean net R (t) | SD net R | MDE, even split | MDE, 80 / 20 split | Events per input, 7 inputs: all / first window | 70 inputs: all / first window | Can it support a scorer? |",
          "|---|---|---|---|---|---|---|---|---|---|---|"]
    for e in list(pw["perEdge"]):
        v = pw["perEdge"][e]
        ep = v.get("eventsPerInput")
        o.append("| %s | %d | %s | %s | %s (%s) | %s | %s R | %s R | %s | %s | %s |" % (
            e, v["n"], v["outOfFoldN"] if v["outOfFoldN"] is not None else "none (not fitted)", f3(v["winRate"], 2), sg(v["meanNetR"]), f3(v["tOfTheEdgeItself"], 2), f3(v["sdNetR"], 2), f3(v["mdeEvenSplit"], 2), f3(v["mde80_20"], 2),
            "%s / %s" % (f3(ep["7inputs"]["all"], 1), f3(ep["7inputs"]["firstWindow"], 1)) if ep else "n/a", "%s / %s" % (f3(ep["70inputs"]["all"], 1), f3(ep["70inputs"]["firstWindow"], 1)) if ep else "n/a",
            "no: under 10 events per input even with 7 inputs" if e in pw["cannotSupportAScorer"] else "the pooled scorers' sample" if e == "pooled"
            else "7 inputs, yes; 70, no" if ep["7inputs"]["firstWindow"] >= 10 else "marginal: 7 inputs pass on all trades, not in the first window"))
    o += ["", "For an edge that is not fitted the MDE is computed on all of its trades, as if none were needed for fitting; its real figure is worse.",
          "Read the MDE against the edge's own mean: a scorer on replica would have to separate kept from skipped by %s R a trade to be seen, more than twice the edge's whole expectancy (%s R). On gmp the bar is %s R against an expectancy of %s R." % (
              f3(pw["perEdge"]["replica"]["mdeEvenSplit"], 2), sg(pw["perEdge"]["replica"]["meanNetR"], 2), f3(pw["perEdge"]["gmp"]["mdeEvenSplit"], 2), sg(pw["perEdge"]["gmp"]["meanNetR"], 2)),
          "**%s cannot support a trained scorer at all.** The four fitted edges can carry a handful of inputs at most; the 70-input reference has under 4 events per input on every edge and under 1.5 in its first training window." % ", ".join(pw["cannotSupportAScorer"]), ""]

    o += ["## Audit", "", "### 1. Features", "",
          "- %d inputs (70 features plus the edge id for pooled scorers). **Known at the decision time: %d of %d.** %s." % (F["inputs"], F["knownAtDecision"], F["inputs"], F["how"][0].upper() + F["how"][1:]),
          "- By source: %s." % "; ".join("%d from %s" % (F["bySource"][k], v) for k, v in F["sources"].items()),
          "- One caveat, not a bug: %s. On gmp (n %d) the median gap is %s ATR and %s of rows are above 0.1 ATR, none above 0.25. Too small to matter; no feature definition was changed." % (
              F["marketEntryNote"]["what"], F["marketEntryNote"]["gmpRows"], f3(F["marketEntryNote"]["medianAbsEntryOffsetAtr"]), "%.1f %%" % (100 * F["marketEntryNote"]["shareAbove0_1Atr"])),
          "- Missing values: %d inputs have some; above 5 %% of rows: %s (a level, sweep, displacement or gap that does not exist at that moment, and the M15 structure of the edges that carry no M15 series)." % (F["missingAny"], ", ".join("`%s`" % x for x in F["missingOver5pct"])),
          "- Constant or near-constant (one value on 95 %% of rows or more): %s." % (", ".join("`%s`" % x for x in F["nearConstant"]) or "none"),
          "- Drift: **%d of %d inputs** move by |SMD| of 0.25 or more between the first and the second half of some scope's train rows. Largest: %s. The replica's `side` is the plainest case: the edge sold in one half and bought in the other, so anything fitted on the first half meets a different population." % (
              len(F["drifted"]), F["inputs"], "; ".join("`%s` on %s (SMD %s, KS %s)" % (d["feature"], d["scope"], sg(d["smd"], 2), f3(d["ks"], 2)) for d in F["drifted"][:5])),
          "- Redundancy (|Spearman| above 0.9): %s. Each pair carries one piece of information twice." % "; ".join("`%s` / `%s` (%s)" % (p["a"], p["b"], sg(p["rho"], 2)) for p in F["redundantPairs"]), ""]

    o += ["### 2. Labels", "",
          "- " + L["label"][0].upper() + L["label"][1:] + ".", "- " + L["position"][0].upper() + L["position"][1:] + ".",
          "- " + L["unfilled"][0].upper() + L["unfilled"][1:] + ". " + L["timeExits"][0].upper() + L["timeExits"][1:] + ".",
          "- **After the exit:** " + L["afterTheExit"] + ". This is defect 1 below.",
          "- " + L["selection"][0].upper() + L["selection"][1:] + ".", "- " + L["independence"][0].upper() + L["independence"][1:] + ".", "- " + L["classBalance"][0].upper() + L["classBalance"][1:] + ".", "",
          "| Edge | Orders | Never filled | Usable trades | Wins / losses (win rate) | Net R: mean, SD, median | Time exits (won) | With an add | Opened while another was open | Longest hold (h) | Embargo (h) |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    for e, v in L["perEdge"].items():
        o.append("| %s | %d | %d | %d | %d / %d (%s) | %s, %s, %s | %d (%s) | %d (%s) | %d (%s) | %s | %s |" % (
            e, v["orders"], v["unfilledN"], v["usable"], v["wins"], v["losses"], f3(v["winRate"], 2), sg(v["netR"]["mean"], 2), f3(v["netR"]["sd"], 2), sg(v["netR"]["median"], 2),
            v["timeExits"]["n"], "n/a" if v["timeExits"]["winRate"] is None else "%.0f %%" % (100 * v["timeExits"]["winRate"]), v["withAdd"], "%.0f %%" % (100 * v["withAddShare"]),
            v["openedWhileAnotherWasOpen"], "%.0f %%" % (100 * v["openedWhileAnotherWasOpenShare"]), f3(v["holdHours"]["max"], 0), f3(v["embargoHours"], 0)))
    gw = sum(v["grossWinNetLoss"] for v in L["perEdge"].values())
    o += ["", "%d trades are a gross win and a net loss: the cost decides the label in those, and only in those. Orders are counted in the train pool, not flagged; 'usable' also needs every timeframe present." % gw, ""]

    o += ["### 3. Leakage", "",
          "**(a) Shuffled labels.** %s, %d seeds: %d walk-forward runs, mean AUC **%s** (SD %s, range %s to %s). Of %d kept-minus-skipped tests, %s reach t >= 2 (chance: 2.3 %%) and %s reach |t| >= 2 (chance: 4.6 %%); mean t %s. The metric collapses to chance, as it must." % (
              perm["what"][0].upper() + perm["what"][1:], perm["seeds"], perm["runs"], f3(perm["meanAuc"]), f3(perm["sdAuc"]), f3(perm["aucRange"][0]), f3(perm["aucRange"][1]), perm["tests"],
              "%.1f %%" % (100 * perm["shareTAtLeast2"]), "%.1f %%" % (100 * perm["shareAbsTAtLeast2"]), f3(perm["meanT"], 2)),
          "The SD is the useful number: on shuffled labels a single run's AUC ranges from %s to %s. Every real AUC in the table above (%s to %s) lies inside that range." % (
              f3(perm["aucRange"][0]), f3(perm["aucRange"][1]), f3(min(s["auc"] for s in sc)), f3(max(s["auc"] for s in sc))), "",
          "**(b) A canary.** %s. With the net-R canary the walk-forward AUC goes from %s to **%s** (lowest %s) and the kept-minus-skipped t to **%s** on average (lowest %s): the pipeline sees a leak when there is one. The holding-time canary, a weaker leak, lifts the AUC to %s-%s." % (
              can["what"][0].upper() + can["what"][1:], f3(can["netR"]["meanCleanAuc"]), f3(can["netR"]["meanCanaryAuc"]), f3(can["netR"]["minCanaryAuc"]), f3(can["netR"]["meanCanaryT"], 1), f3(can["netR"]["minCanaryT"], 1),
              f3(min(x["canaryAuc"] for x in can["runs"] if x["canary"] == "canaryHoldHours")), f3(max(x["canaryAuc"] for x in can["runs"] if x["canary"] == "canaryHoldHours"))), "",
          "Single-feature AUC, in sample, whichever way the feature points (so 0.5 is the floor):", "",
          "| Scope | n | Best real feature | Its AUC | Largest single-feature AUC on shuffled labels: median, 95th pct | Real features above that 95th pct | Net-R canary | Holding-time canary |", "|---|---|---|---|---|---|---|---|"]
    for k, v in single.items():
        o.append("| %s | %d | `%s` | %s | %s, %s | %s | %s | %s |" % (k, v["n"], v["maxFeature"], f3(v["maxAuc"]), f3(v["shuffledMaxAuc"]["median"]), f3(v["shuffledMaxAuc"]["p95"]),
                                                                  ", ".join("`%s`" % x for x in v["aboveShuffledP95"]) or "none", f3(v["canaryNetRAuc"]), f3(v["canaryHoldHoursAuc"])))
    above = sum(len(v["aboveShuffledP95"]) for v in single.values())
    top = max(single.items(), key=lambda kv: kv[1]["maxAuc"])
    o += ["", "No real feature behaves like a canary. The net-R canary scores %s to %s and the holding-time canary %s to %s; the best real feature is %s (`%s` on %s, where shuffled labels alone reach %s at the 95th percentile). %s" % (
        f3(min(v["canaryNetRAuc"] for v in single.values())), f3(max(v["canaryNetRAuc"] for v in single.values())), f3(min(v["canaryHoldHoursAuc"] for v in single.values())), f3(max(v["canaryHoldHoursAuc"] for v in single.values())),
        f3(top[1]["maxAuc"]), top[1]["maxFeature"], top[0], f3(top[1]["shuffledMaxAuc"]["p95"]),
        ("%d feature-scope pair(s) sit just above the shuffled 95th percentile of the best of 70. With five scopes looked at that is about what chance gives, and the reference scorer, which reads all of them, does not rank trades out of fold." % above) if above else "None is above what the best of 70 features reaches on shuffled labels."), "",
          "**(c) Fold boundaries.** Counted at every test-block start, summed over blocks:", "",
          "| Scope | Blocks | No embargo: label may still be open | First trainer's rule (first-unit exit + 1 day): add leg may still be open | New embargo: still open | Rows the new embargo holds back | Threshold chosen on trades possibly open (old) | (new) |", "|---|---|---|---|---|---|---|---|"]
    for x in bnd["perScope"]:
        o.append("| %s | %d | %d | %d | %d | %d | %d | %d |" % (x["scope"], x["blocks"], x["noEmbargo"]["labelMayBeOpen"], x["oldRule"]["firstUnitOpen"] + x["oldRule"]["addMayBeOpen"],
                                                           x["newRule"]["firstUnitOpen"] + x["newRule"]["addMayBeOpen"], x["newRule"]["heldBack"], x["thresholdOld"]["tradeOpenAtStart"], x["thresholdNew"]["tradeOpenAtStart"]))
    o += ["", "Totals: **%d** without an embargo, **%d** under the first trainer's rule, **%d with the embargo**; the keep-threshold was chosen on **%d** trades that could still be open under the old rule and on **%d** now." % (
        bnd["violationsWithoutEmbargo"], bnd["violationsOldRule"], bnd["violationsWithEmbargo"], bnd["thresholdViolationsOld"], bnd["thresholdViolationsNew"]), "",
          "**(d) Exam ids.** %d candidates are outside the train pool; the loader dropped %d rows. Ids in the %d fitted matrices (%d distinct): **%d exam ids**. The trainer was then run on a matrix in which every label and every feature of those %d rows was overwritten with noise: all %d output files are byte-identical (%s)." % (
              exam["notTrainCandidates"], exam["droppedByTheLoader"], exam["fits"], exam["distinctFittedIds"], exam["examIdsInAnyFit"], exam["scramble"]["rowsOverwritten"], exam["scramble"]["files"],
              "and identical to the committed `ml/models`" if exam["scramble"]["matchesCommittedModels"] else "identical: %s" % exam["scramble"]["identical"]), ""]

    o += ["### 4. Sample size and power", "", "The table is above. In one line: the smallest difference these samples can see is %s to %s R a trade on the fitted edges, against edge expectancies of %s to %s R. A scorer would have to roughly double an edge to be detected." % (
        f3(min(pw["perEdge"][e]["mdeEvenSplit"] for e in ("replica", "gtl", "gmp", "nq-open")), 2), f3(max(pw["perEdge"][e]["mdeEvenSplit"] for e in ("replica", "gtl", "gmp", "nq-open")), 2),
        sg(min(pw["perEdge"][e]["meanNetR"] for e in ("replica", "gtl", "gmp", "nq-open")), 2), sg(max(pw["perEdge"][e]["meanNetR"] for e in ("replica", "gtl", "gmp", "nq-open")), 2)), ""]

    gc = ov["meanGapByConfig"]
    o += ["### 5. Overfitting", "",
          "- In-fold AUC minus out-of-fold AUC, mean by configuration: %s. The 70-input reference fits its training rows at an AUC of %s to %s and scores %s to %s out of fold: it memorises. The short-list configurations overfit less and are no better out of fold." % (
              "; ".join("%s %s" % (k, sg(v)) for k, v in gc.items()), f3(min(s["inFoldAuc"] for s in ref)), f3(max(s["inFoldAuc"] for s in ref)), f3(min(s["auc"] for s in ref)), f3(max(s["auc"] for s in ref))),
          "- Seeds (%s): %s. The verdict t of one scope moves by up to %s with nothing changed but the seed." % (
              ov["seeds"]["what"], "; ".join("%s t %s to %s, AUC %s to %s" % (x["scope"], f3(x["tRange"][0], 2), f3(x["tRange"][1], 2), f3(x["aucRange"][0]), f3(x["aucRange"][1])) for x in ov["seeds"]["perScope"]),
              f3(max(x["tRange"][1] - x["tRange"][0] for x in ov["seeds"]["perScope"]), 2)),
          "- Fold count (%s): the t changes sign for **%d of %d** scorers, and **%d** reach t >= 2 with any fold count. A result that flips with the number of blocks is noise." % (
              ov["foldCounts"]["what"], ov["foldCounts"]["scorersWhoseTChangesSign"], ov["foldCounts"]["scorers"], ov["foldCounts"]["scorersWithTAtLeast2InAnyRun"]), ""]

    pr = [x for x in cal["perScorer"] if x["probability"]]
    better = [x for x in pr if x["betterThanPrior"]]
    worse = [x for x in pr if x["worseThanPrior"]]
    o += ["### 6. Calibration", "",
          "Out of fold, the scorer's own probability against the prior rate (for a pooled scorer: the prior rate of each trade's own edge, since a pooled scorer otherwise gets credit for knowing that replica wins 24 % of the time and gtl 51 %). Brier minus prior below 0 is better; interval = bootstrap over trades.", "",
          "| Scorer | n | Brier | Prior | Difference (95 % interval) | Expected calibration error | Predicted p, 10th to 90th pct | Win rate rises bin by bin? |", "|---|---|---|---|---|---|---|---|"]
    for x in pr:
        o.append("| %s | %d | %s | %s | %s (%s to %s) | %s | %s to %s | %s |" % (x["scope"], x["n"], f3(x["brier"], 4), f3(x["brierPrior"], 4), sg(x["brierMinusPrior"], 4), sg(x["ci95"][0], 4), sg(x["ci95"][1], 4),
                                                                              f3(x["ece"]), f3(x["spreadOfP"][0], 2), f3(x["spreadOfP"][1], 2), "yes" if x["binsRiseWithP"] else "no"))
    o += ["", "Of %d probability scorers: **%d better than the prior rate** (interval wholly below 0)%s, %d worse%s, %d cannot tell. The win rate rises with the predicted probability across all five bins for %d of %d." % (
        len(pr), len(better), (": " + ", ".join(x["scope"] for x in better)) if better else "", len(worse), (": " + ", ".join(x["scope"] for x in worse)) if worse else "", cal["cannotTell"], cal["binsRiseWithP"], len(pr)),
          "**No number from any of these scorers may be shown as a probability.** %s" % (
              "The one scorer whose Brier score beats its bar still cannot rank trades (its kept-minus-skipped t is %s): a small Brier gain without ranking is of no use to a decision." % f3([s["t"] for s in sc if s["scope"] == better[0]["scope"]][0], 2) if len(better) == 1 else
              "A Platt step passes its last-fold check for some tree scorers (`calibrated` in the index); that check is weak (one block) and a calibrated scorer that cannot rank trades is still of no use."),
          "Line 4 of the acceptance rule compares a pooled scorer with the single prior rate, as pre-registered (the scorers table above). The table here uses the stricter per-edge bar; no verdict depends on which one is used.", ""]

    yr = reg["singleYearsWithTAtLeast2"]
    o += ["### 7. Regimes", "",
          "- By calendar year (a t only when both groups have at least 5 trades): %d scorer-year cells have a test; the kept trades were ahead in %d of them (%s). Single years with t >= 2: %s." % (
              reg["yearCellsWithATest"], reg["yearCellsKeptBetter"], "%.0f %%" % (100 * reg["yearCellsKeptBetter"] / max(1, reg["yearCellsWithATest"])),
              "; ".join("%s %s (t %s, kept %d, skipped %d)" % (x["scorer"], x["year"], f3(x["t"], 2), x["keptN"], x["skippedN"]) for x in yr) or "none"),
          "- By `regimeBase` and `volState`: %d cells with a test; t >= 2 in %d%s, t <= -2 in %d. With that many cells, %s by chance alone would be about %.0f each way." % (
              reg["regimeCellsWithATest"], len(reg["regimeCellsWithTAtLeast2"]), (" (" + "; ".join("%s, %s %s: t %s, kept %d, skipped %d" % (x["scorer"], {"byRegime": "regimeBase", "byVolState": "volState"}[x["split"]], x["value"], f3(x["t"], 2), x["keptN"], x["skippedN"]) for x in reg["regimeCellsWithTAtLeast2"]) + ")") if reg["regimeCellsWithTAtLeast2"] else "",
              reg["regimeCellsWithTAtMostMinus2"], "the count", 0.0228 * reg["regimeCellsWithATest"]),
          "- Leave one year out: %d scorers reach t >= 2 overall and %d reach it with some year removed. No scorer's result is carried by, or hidden by, a single year: there is no apparent skill to locate." % (
              reg["scorersWithOverallTAtLeast2"], reg["scorersWithALeaveOneYearOutTAtLeast2"]), ""]

    o += ["## Defects found and fixed in `ml/train.py`", "",
          "1. **The embargo ended at the first unit's exit.** The label of a position with a pyramid add (replica %d %% of trades, mosha-bo, gtrend) can still change after the recorded exit, because the add leg is managed on its own up to the first unit's deadline. The old rule (`exit + 1 day <= block start`) admitted **%d** training rows whose label could still be open. Fixed: a row trains a fold only when `signal time + the edge's label window <= block start`, the window being the longest signal-to-exit time of the edge plus a weekend. Violations now: **%d**." % (
              round(100 * L["perEdge"]["replica"]["withAddShare"]), bnd["violationsOldRule"], bnd["violationsWithEmbargo"]),
          "2. **The keep-threshold was chosen on trades that had not closed.** A block's threshold came from every earlier test trade, including **%d** whose position could still be open when the block started (%d with the first unit itself still open). Fixed: only trades whose label window had closed. Now: **%d**." % (
              bnd["thresholdViolationsOld"], sum(x["thresholdOld"]["firstUnitOpenAtStart"] for x in bnd["perScope"]), bnd["thresholdViolationsNew"]),
          "3. **The exam pool was read by default on every run.** `python ml/train.py` computed an exam block for each scorer unless `--no-exam` was passed, so every re-training showed exam numbers next to the settings that produced them. Nothing was chosen from them, but a held-out set that is printed on each run stops being held out. Fixed: the loader drops every row outside the train pool before unpacking it and the file has no exam code path. Proof: the scrambled-matrix run above (%d files, byte-identical). The first trainer's two exam reads are kept as a record in `ml/archive/gbt-1`." % exam["scramble"]["files"], "",
          "No feature definition was changed and no look-ahead was found in a feature. Tests: `tests/academy-ml.test.mjs` (the review block).", "",
          "### What the fixes did to the reference scorer", "",
          "Same fitted trees in every row; only which rows train a fold and which trades choose a threshold differ. %s" % (
              "The rows under the first trainer's rules reproduce the archived numbers exactly." if P["reproducesTheArchivedNumbers"] else "The archived numbers are not reproduced exactly by the rows under the first trainer's rules."), "",
          "| Scope | Rules | AUC | Kept n | Skipped n | Kept R | Skipped R | t |", "|---|---|---|---|---|---|---|---|"]
    for x in P["runs"]:
        o.append("| %s | %s | %s | %d | %d | %s | %s | %s |" % (x["scope"], x["label"], f3(x["auc"]), x["keptN"], x["skippedN"], sg(x["kept"]), sg(x["skipped"]), f3(x["t"], 2)))
    key = lambda x: (x["scope"], x["keptN"], x["skippedN"], x["t"])
    first = sorted(key(x) for x in P["runs"] if x["embargo"] == "exit+1d" and x["threshold"] == "all")
    thr_only = sorted(key(x) for x in P["runs"] if x["embargo"] == "exit+1d" and x["threshold"] == "closed")
    moved = sum(1 for a, b in zip(first, thr_only) if a != b)
    o += ["", "By itself the threshold correction changes the kept and skipped counts of %d of %d scopes (under the old exit rule nearly every earlier test trade counts as closed). The label-window embargo is what moves the numbers: it holds back a few boundary rows, the first block's inner split changes, and the keep-threshold with it." % (moved, len(first))]
    big = max(P["perScope"], key=lambda x: x["tRange"][1] - x["tRange"][0])
    o += ["", "The t of %s moves from %s to %s when a handful of boundary rows change hands. Neither figure was evidence: the old -2.30 on gtl (\"a scorer that is wrong\") was as fragile as a +2 would have been. This is the main practical finding of the review: **on these sample sizes the kept-minus-skipped t is not stable to details that should not matter** (boundary rows, the seed, the fold count)." % (
        big["scope"], f3(big["tArchived"], 2), f3(big["tNow"], 2)), ""]

    fam = r["family"]["testsWithTAtLeast2"]
    o += ["## The test family", "", "%d kept-minus-skipped tests (20 verdict tests, the reference's 70-input logistic lines, and each pooled scorer inside each edge). Tests with t >= 2:" % S["familyTests"], "",
          "| Scorer | Slice | Verdict test? | Kept n | Skipped n | Difference (R) | Welch t | Welch p | Holm p | Permutation p | The skipped trades' net R |", "|---|---|---|---|---|---|---|---|---|---|---|"]
    for x in fam:
        o.append("| %s | %s | %s | %d | %d | %s | %s | %s | %s | %s | %s |" % (x["scorer"], x["edge"], "yes" if x["verdictTest"] else "no", x["kept"], x["skipped"], sg(x["diff"], 2), f3(x["t"], 2), f3(x["welchP"], 5), f3(x["holmP"], 4), f3(x["permutationP"], 4),
                                                                       ", ".join(sg(v, 2) for v in x["skippedNetR"]) if x["skippedNetR"] else "(more than 12)"))
    under = [x for x in fam if x["holmP"] is not None and x["holmP"] <= r["design"]["pLine"]]
    if under:
        u = under[0]
        o += ["", "**One test clears the Holm line on Welch's t and it is an artefact.** It is the pooled reference scorer inside %s: it skipped %d trades out of %d, both full stops (%s R), so the skipped group has almost no variance and Welch's t is %s. Reshuffling which %d trades are skipped gives p = %s; times %d tests that is nowhere near the line. It is not a scorer's own test (the pooled reference's verdict t is %s) and it changes no verdict. It is reported because the pre-registered family rule (both groups of at least 2) let it in: a future rule should ask for at least 5 a side or use the permutation p." % (
            u["edge"], u["skipped"], u["kept"] + u["skipped"], " and ".join(sg(v, 2) for v in u["skippedNetR"]), f3(u["t"], 2), u["skipped"], f3(u["permutationP"], 4), S["familyTests"], f3([s["t"] for s in sc if s["id"] == u["id"]][0], 2))]
    o += ["", "No verdict test has t >= 2.", ""]

    o += ["## Exam pool", "", "Exam reads by this review: **0**. `academy/data/exam-ledger.json` has no entry from it. %s." % (r["examReadsNote"][0].upper() + r["examReadsNote"][1:]),
          "The first trainer's runs (before this review) read exam-pool aggregates once per run; those numbers are in `ml/archive/gbt-1/index.json` and are not shown by the live index any more (`exam: null`, `examRead: false`).", ""]

    o += ["## Deviations from the pre-registration, and additions", ""] + ["- " + d for d in r["deviations"]] + [""]

    o += ["## What a future scorer must show", "",
          "1. Enough trades first. Under about 10 events per input in the first training window nothing should be fitted. At that line the fitted edges can carry today: %s. mosha-bo, gtrend and geg can carry none." % ", ".join(
              "%s %d inputs" % (e, pw["perEdge"][e]["minorityFirstWindow"] // 10) for e in ("replica", "gtl", "gmp", "nq-open")),
          "2. A pre-registered configuration and feature list, the walk-forward of `ml/train.py` unchanged (label-window embargo, thresholds from closed trades), and all five lines of the acceptance rule.",
          "3. The same sign and a t of at least 2 with 3, 4, 5 and 6 test blocks and, if it samples, across seeds. A t that needs one fold count is not a result.",
          "4. Groups of at least 5 trades a side in every test that is counted, or a permutation p.",
          "5. A probability only if the out-of-fold Brier interval sits below the prior rate of each trade's own edge.",
          "6. Then, and only then, one ledgered read of the exam pool, decided by the owner. Promotion stays a manual owner step.", "",
          "## Reproduce", "", "```sh", "python ml/train.py            # the scorers: ml/models/index.json, report.md and the tree files (about 10 s)", "node ml/parity.mjs            # exported trees against MXA.score",
          "python ml/review.py           # this audit: result.json and RESULT.md (about 5 minutes)", "```", "",
          "Matrix %s, data %s, trainer %s, train.py %s, review.py %s. Libraries pinned in `ml/requirements.txt`. Deterministic: the same matrix and code give the same bytes." % (
              r["data"]["matrixVersion"], r["data"]["dataVersion"], r["code"]["trainer"], r["code"]["train.py"], r["code"]["review.py"]), ""]
    return "\n".join(o)


# ----------------------------------------------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description="The Academy training review (audit only; train pool only).")
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--quick", action="store_true")
    a = ap.parse_args()
    if a.quick and os.path.abspath(a.out) == OUT:
        sys.exit("--quick is a smoke run: write it somewhere else with --out")
    m, rows = T.load_matrix(T.MATRIX)
    use = [r for r in rows if T.usable(r)]
    windows = T.label_windows(use)
    other_ids, outs = side_data({r["id"] for r in rows})
    real, skipped, family, _ = T.run_all(rows, m)
    edge = np.array([r["edge"] for r in use])
    scopes = {e: edge == e for e in ["replica", "gtl", "gmp", "nq-open"]}
    scopes["pooled"] = np.ones(len(use), bool)
    say = lambda s: print(s, file=sys.stderr, flush=True)
    say("features"); feats = audit_features(m, use, scopes)
    say("labels"); labels = audit_labels(rows, use, outs, windows)
    say("permutation"); perm = leak_permutation(rows, m, real, 3 if a.quick else 20)
    say("canary"); canary = leak_canary(rows, m, windows, real)
    noisy = canary.pop("noisy")
    say("single"); single = leak_single(m, use, scopes, noisy, 20 if a.quick else 200)
    say("boundaries"); bounds = leak_boundaries(m, rows, windows, outs)
    say("exam"); exam = leak_exam(m, real, other_ids, a.quick)
    say("power"); power = audit_power(use, real)
    say("overfit"); over = audit_overfit(rows, m, real, a.quick)
    say("calibration"); cal = audit_calibration(real)
    say("regimes"); reg = audit_regimes(real)
    say("protocol"); proto = protocol_effect(rows, m, real)
    fam = family_checks(real, family)
    signs = policy_signs()
    scorers = []
    for run in real:
        o = T.overall(run["wf"], MAIN)
        mine = [x for x in family if x["scorer"] == run["id"] and x["key"] == MAIN and x["verdictTest"]]
        hp = mine[0]["pHolm"] if mine else None
        ok, lines, why = T.acceptance(run["wf"], o, hp, len(family))
        tr = o["trading"]
        scorers.append({"id": run["id"], "scope": label_of(run), "scopeEdge": run["scope"], "config": run["config"], "kind": run["cfg"]["kind"], "trainRows": len(run["rows"]), "outOfFoldN": o["n"], "auc": o["auc"], "inFoldAuc": o["inFoldAuc"],
                        "brier": o["brier"], "brierPrior": o["brierPrior"], "mse": o.get("mse"), "msePrior": o.get("msePrior"),
                        "mechanical": tr["mechanical"], "kept": tr["kept"], "skipped": tr["skipped"], "keptMinusSkipped": tr["keptMinusSkipped"], "t": tr["keptMinusSkippedT"], "p": tr["p"], "pHolm": r4(hp, 6),
                        "maxDrawdown": tr["maxDrawdown"], "linesFailed": [x["line"] for x in lines if not x["ok"]], "passes": ok, "verdict": why})
    passed = [s for s in scorers if s["passes"]]
    vt = [x for x in family if x["verdictTest"] and x["key"] == MAIN]
    best = max((s for s in scorers if s["t"] is not None), key=lambda s: s["t"])
    result = {
        "built": m["generated"], "title": "Academy scorer: training review", "system": "MeridianX Academy offline scorers (ml/), seven edges, train pool only",
        "prereg": "research/edge/academy-ml-review/PREREGISTRATION.md",
        "verdict": "No scorer passes: all %d (the reference and the four pre-registered challenger configurations) are rejected challengers; none is promoted. The best kept-minus-skipped t out of fold is %s (%s, n %d); the smallest Holm-corrected p of a scorer's own test is %s. Three edges are too small to support a trained scorer." % (
            len(scorers), best["t"], best["scope"], best["outOfFoldN"], r4(min(x["pHolm"] for x in vt), 3)),
        "variantsTried": len(scorers), "examReads": 0,
        "examReadsNote": "the review and the trainer read the train pool only; the loader drops %d rows of other pools unread" % sum(m["notTrainDropped"].values()),
        "data": {"matrixVersion": m["version"], "dataVersion": m["dataVersion"], "featVersions": m["featVersions"], "trainPoolRows": len(rows), "usableTrainRows": len(use),
                 "usableByEdge": {e: int((edge == e).sum()) for e in T.EDGES}, "notTrainDropped": m["notTrainDropped"]},
        "code": {"train.py": T.sha(open(os.path.join(HERE, "train.py"), "rb").read())[:12], "review.py": T.sha(open(os.path.abspath(__file__), "rb").read())[:12], "trainer": T.TRAINER},
        "design": {"embargoSec": windows, "firstTrainShare": T.FIRST_TRAIN, "minRows": T.MIN_ROWS, "tLine": T.T_LINE, "pLine": r4(T.P_LINE, 6), "seed": T.SEED,
                   "configs": {k: v["what"] for k, v in T.CONFIGS.items()}, "shortList": T.SHORT, "monotoneUp": T.MONOTONE_UP},
        "summary": {"scorers": len(scorers), "passed": len(passed), "rejected": len(scorers) - len(passed), "promoted": 0, "notFitted": [s["edge"] for s in skipped],
                    "familyTests": len(family), "verdictTests": len(vt), "smallestVerdictHolmP": r4(min(x["pHolm"] for x in vt), 6), "bestVerdictT": best["t"], "bestVerdictScorer": best["scope"], "bestVerdictN": best["outOfFoldN"],
                    "scorersWithNegativeT": sum(1 for s in scorers if s["t"] is not None and s["t"] < 0), "scorersWithTAtMostMinus2": sum(1 for s in scorers if s["t"] is not None and s["t"] <= -2),
                    "foldOverlapViolationsWithEmbargo": bounds["violationsWithEmbargo"], "thresholdViolationsNow": bounds["thresholdViolationsNew"], "examIdsInAnyFit": exam["examIdsInAnyFit"]},
        "scorers": scorers,
        "family": {"tests": len(family), "correction": "Holm", "testsWithTAtLeast2": fam,
                   "note": "a test with two or three skipped trades can show a large Welch t when those few trades happen to have nearly the same result (two full stops): the permutation p beside it is the honest reading. No such test is a scorer's own verdict test"},
        "audit": {"features": feats, "labels": labels, "leakage": {"permutation": perm, "canary": canary, "singleFeature": single, "foldBoundaries": bounds, "exam": exam},
                  "power": power, "overfitting": over, "calibration": cal, "regimes": reg},
        "protocol": proto, "policyFactors": signs,
        "deviations": [
            "Embargo: the pre-registration set the label window to the larger of the rule's bound and the longest observed signal-to-exit time. The run adds 72 hours (a weekend) to it, because a time exit that falls in the weekend is filled at the reopen. It is stricter, never looser.",
            "Family size: the pre-registration lists the tests that make the Holm family; it gave no count. The run has %d." % len(family),
            "Additions the pre-registration did not list, none of which a verdict depends on: a permutation p beside every family test with t >= 2; the per-edge prior rate as the Brier bar of the pooled scorers in the calibration table; a minimum of 5 trades a side for a t inside a year or a regime; the in-sample description of which short-list inputs the stored fits lean on; the reference scorer walked forward under the first trainer's rules, to measure what the two fixes changed.",
        ],
    }
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, "result.json"), "w") as fh:
        json.dump(result, fh, indent=1)
        fh.write("\n")
    with open(os.path.join(a.out, "RESULT.md"), "w") as fh:
        fh.write(result_md(result))
    print("wrote %s and RESULT.md (%d scorers, %d passed, %d family tests)" % (os.path.join(a.out, "result.json"), len(scorers), len(passed), len(family)))


if __name__ == "__main__":
    main()
