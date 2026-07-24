# Is the Daily Bias engine sound? — a validation report

**Date:** 2026-07-24 · **Genre:** validation · **Slug:** `daily-macro-signals`
**Corpus:** 16 sources (8 academic, 2 primary, 6 industry), 61 captured quote lines
**Findings:** F1–F6 in `findings/`

---

## 0. Read this first — a constraint on the whole investigation

**WebFetch was blocked organization-side for this entire session.** Every external domain
returned HTTP 403 at the egress proxy — including neutral controls (`example.com`, Wikipedia,
`fred.stlouisfed.org`). Confirmed via `curl -sS "$HTTPS_PROXY/__agentproxy/status"`, which
logs the denials as `connect_rejected — gateway answered 403 to CONNECT (policy denial)`. The
proxy README's instruction is explicit: *do not retry or route around it — report it.*

Consequence: **WebSearch worked, WebFetch did not.** Source files were reconstructed from
search summaries and are labelled inside each file as *not independently verified against
primary-source text*. Every sub-agent correctly refused to fabricate verbatim quotes.

This changes the confidence you should place in different parts of this report:

| Evidence class | Status |
|---|---|
| **F1, F2, F3 core arithmetic** — derived from your source code and from binomial statistics computed in-session | **Fully verified. Depends on no external source.** |
| **F4, F6** — horizon mismatch, safe-haven timing | **Well-triangulated** across 4–6 differently-typed sources, but figures are search-derived; re-verify before external citation |
| **F5** — combination methodology | **Insufficiently sourced.** Zero source files written (fetch blocked). The named results are real and well-known, but are not triangulated *in this investigation* and are reported as such |

The strongest findings here happen to be the ones that needed no internet at all.

---

## 1. Bottom line

Your engine has a **category error at its centre**, three **mechanical defects**, and one
component that is **statistically indefensible** — but the surrounding architecture (Trade Plan
gating, Edge Tracker, session logic) is genuinely well-built and largely insulates you from the
worst of it.

The category error: **the macro stack is built from contemporaneous state descriptors, and the
engine uses them as forward-looking daily predictors.** No amount of reweighting fixes that;
it's a mismatch between what the data can say and what it's being asked to say.

---

## 2. Hypothesis scorecard

| # | Hypothesis | Verdict |
|---|---|---|
| **H1** | Drivers are contemporaneous, not daily-predictive | **UPHELD** — every quantified result located is monthly/quarterly/multi-year or explicitly attributional (F4) |
| **H2** | Drivers are collinear; summing inflates confidence | **UPHELD** — 5 of 15 derive from DFII10 alone; `Dollar Smile` is a function of 5 other drivers (F1) |
| **H3** | Equal weights fine; n=30 auto-tuning harmful | **UPHELD, both halves** — and quantified: the tuner fires on noise ~95% of the time (F3, F5) |
| **H4** | Cluster-agreement check is right instinct, under-specified | **PARTIALLY REFUTED** — the literature conditions on observable *states*, not signal agreement; and your two clusters aren't independent anyway (F5) |

---

## 3. What's broken, ranked by severity

### 3.1 — The VIX driver may be trading the wrong side of the effect ⚠ HIGHEST SEVERITY

Baur & Lucey (2010), the foundational safe-haven paper, reports the effect is *"extremely
short-lived so that an investor buying gold one day after a shock loses money."*

Your engine votes **long gold on elevated VIX** — i.e. one day after a shock. That's the exact
trade the canonical reference says loses money.

Worse, in acute liquidity crises gold is *sold* to meet margin calls: **−25/−30% in 2008,
−12/−15% in March 2020**. So at maximum VIX — where your driver is most confidently long — the
historical record shows gold falling hardest. (F6)

### 3.2 — 15 drivers are effectively 5–7

`DFII10` drives five drivers (#1, #2, #6, #7, #13). `Dollar Smile` (#13) is a deterministic
function of five drivers already voting. The real-rate complex carries **~45–50% of total
directional weight** while displaying as five independent confirmations.

Grinold & Kahn's law scales with *independent* breadth. Correlated signals add none. Your UI
shows consensus where there is one variable counted five times. (F1)

### 3.3 — The auto-tuner fires on noise ~95% of the time

At n=30, a 60% hit rate has **p = 0.18** under a coin-flip null. Testing all 15 drivers
simultaneously: **P(at least one spuriously boosted) = 0.95**.

You'd need **n≈80** for single-driver significance, **n≈200** with multiple-testing correction
— about 0.8 years of daily data *per driver*. The tuner activates at 30. (F3)

### 3.4 — Confidence is mechanically distorted and never calibrated

- `Yen carry-unwind` is `dir: null` by design but `w: 1`, so it sits in the denominator forever
  — a permanent ~2.5pp drag on every reading.
- Failed feeds also inflate `wTot`, so **confidence partly tracks feed uptime**.
- `st.dir` flips at an absolute `net = ±3` regardless of `wTot` — so degraded-feed days trigger
  calls on proportionally much thinner evidence (3/10 = 30% vs 3/22 = 14%, same verdict).
- Nothing ever checks whether 63% confidence means a 63% hit rate. (F2)

### 3.5 — Credit spreads are under-conditioned

Gold rallies on widening HY spreads **only when the widening is systemic** (co-moving with the
NFCI). Counter-examples where spreads widened with no gold rally: 1991 Gulf War, Dot-Com bust,
2014–15 commodity slowdown. Your driver fires on any ≥8bp weekly move. (F6)

---

## 4. What's actually sound — credit where it's due

This matters as much as the criticism:

1. **Hand-set integer weights (3/2/1) are fine.** The forecast-combination literature
   (DeMiguel/Garlappi/Uppal; Smith & Wallis; Timmermann; Clemen) consistently finds simple
   weighting beats estimated-optimal weighting out-of-sample. **Don't optimise them.** (F5)
2. **The Yen carry row's `dir: null` treatment is exactly right** — a genuinely two-sided
   effect refusing to fake a direction. That's the pattern the VIX and HY drivers should adopt.
3. **The Trade Plan's gating is the strongest thing in the system.** It refuses to print
   without structure agreement, below 1.5R, or on red-folder days. The macro layer never
   directly produces a trade unaided — this insulates you substantially.
4. **The Edge Tracker is the right instrument** and its conservative fill/cost model is honest.
5. **Session-specific ATR for stops** is well-grounded and correctly implemented.
6. **The synthesis layer's instinct** — checking whether clusters agree rather than just
   summing — is directionally correct, even if the clusters aren't yet independent.

---

## 5. Adversarial pass

**Steel-manning the current design** (the strongest case *against* my own conclusions):

- **"It's decision support, not alpha."** A consistent framework that prevents impulsive
  trading has real behavioural value even with zero statistical edge. *This is valid* — but
  then don't display a *percentage*, which implies a frequency claim.
- **"Relative ordering still works."** Even uncalibrated, 80% days may genuinely differ from
  55% days. *Plausible, and untested — which is the point. Test it.*
- **"Real yields SHOULD dominate."** If real yields genuinely are the master driver, 45%
  weight is defensible. *Fair — but then say so explicitly with one weighted driver, rather
  than disguising it as five independent votes. The objection is to the presentation as much
  as the math.*
- **"The technical layer carries direction anyway."** True, and it's the best defence. The
  macro stack's flaws are partly quarantined by Trade Plan gating.

**What would refute my recommendations:** if the Edge Tracker accumulates 200+ trades and the
Daily Bias strategy shows positive expectancy, that's direct empirical evidence the macro layer
works despite these theoretical objections. **You already built the instrument that settles
this.** Theory loses to data — let it run.

**Gaps in this investigation:** zero *discussion*-type sources (forums, replication attempts,
practitioner post-mortems) — the corpus skews academic/industry. F5's methodology claims have
no source files at all. Nothing was verified against primary text.

---

## 6. Ranked change list

| # | Change | Effort | Impact | Finding |
|---|--------|--------|--------|---------|
| 1 | **Stop the VIX driver voting long at daily horizon.** Make it a tail-conditional gate; flag liquidation risk at extremes | S | **High** | F6 |
| 2 | **Disable the auto-tuner** (or gate at n≥100 with shrinkage). It currently fires on noise 95% of the time | XS | **High** | F3 |
| 3 | **Collapse duplicate drivers** — one vote per raw series; demote `Dollar Smile` from vote to regime modifier; strip TIPS/DXY from `Macro composite` | M | **High** | F1 |
| 4 | **Exclude structurally-null drivers from `wTot`**; separate `wAvailable`; make the direction threshold proportional | S | Medium | F2 |
| 5 | **Add a calibration panel** — bucket historical days by stated confidence, plot realized hit rate | M | Medium | F2 |
| 6 | **Condition HY on systemic vs idiosyncratic** widening | S | Medium | F6 |
| 7 | **Reframe macro output as regime/context**, not a directional forecast; let structure carry direction | M | **High** | F4 |
| 8 | Z-score normalise drivers before combining | M | Low-Med | F5 |

**If you do only two things:** #1 and #2. Both are small changes to code that is currently
working against you, and neither requires new data.

---

## 7. What I could not establish

- Any daily-horizon out-of-sample R² for macro variables on gold — **no located study tested
  it**. This absence is itself the finding.
- Empirical validation of the Dollar Smile framework. It appears to be a widely-taught
  qualitative heuristic; the only formal exercise surfaced was Jen & Yilmaz's original 2001
  Morgan Stanley note. Treat it as a *lens*, not a tested model.
- Whether your specific 15-driver combination has edge. **Only your Edge Tracker can answer
  that**, and it needs ~200 trades.
