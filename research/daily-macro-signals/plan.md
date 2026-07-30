# Plan — Daily Macro Signals for a Gold Bias Engine

**Slug:** `daily-macro-signals`
**Started:** 2026-07-24
**Depth:** deep
**Genre:** validation (validating an existing design against external evidence), with decision elements

---

## Phase 1 — Reframe

### As asked
"Which macro signals actually have predictive power for daily XAUUSD direction, and how should
they be weighted and combined into a daily bias model?"

### The decision underneath
The user is not doing academic research. They ship a live Daily Bias engine with 15 weighted
drivers in 4 clusters. The real decision is:

> **Do I keep this design, and if not, which specific parts do I change — the driver set, the
> weights, the synthesis layer, or the confidence number?**

That reframing changes what counts as a useful finding. "The literature is mixed" is not
actionable. "This driver is contemporaneous, not predictive" *is* actionable — it means the
driver should be reclassified as a regime/state descriptor rather than scored as a directional
vote.

### The critical distinction the question hides
Most published gold–macro relationships are **contemporaneous** (same-period correlation:
gold fell today *because* real yields rose today) rather than **predictive** (today's real yield
level forecasts tomorrow's gold return). A scoring engine that sums contemporaneous signals into
a forward-looking "bias" is committing a category error that no amount of weight tuning fixes.
Establishing which of the 15 drivers fall on each side of that line is the single highest-value
output of this investigation.

### Falsifiable hypotheses

| # | Hypothesis | Refuted if |
|---|-----------|-----------|
| **H1** | Most of the 15 drivers are contemporaneous with gold returns, not predictive at a daily horizon; daily-horizon out-of-sample R² of macro variables for gold is ≈0. | Studies show macro variables with meaningful, replicated daily-ahead predictive power (OOS R² clearly >0, or hit rates persistently >55%). |
| **H2** | The drivers are heavily collinear — real yields, 2Y, breakevens, DXY, Dollar Smile, EU growth all encode overlapping rates/dollar information — so summing them as independent votes inflates apparent confidence relative to true information content. | Evidence that these series are largely independent at daily frequency, or that naive summing is robust to collinearity. |
| **H3** | Simple/equal weighting beats optimized weights out-of-sample (the 1/N and "simple heuristics" results), so hand-set weights are *not* the main defect — but auto-tuning weights on a ~30-observation hit rate is actively harmful overfitting. | Evidence that small-sample adaptive weighting reliably improves OOS performance in macro signal blending. |
| **H4** | The rates-vs-dollar cluster-agreement check is directionally right but under-specified: the literature conditions on *volatility/liquidity regimes*, not on internal signal agreement. | Evidence that signal-agreement gating is an established, validated technique that dominates regime conditioning. |

### Explicitly out of scope
- Intraday/microstructure signals (order flow, tick data) — the engine is daily.
- Options-implied gold vol surfaces (no free feed; already noted as unavailable).
- Anything requiring paid data the platform can't consume (the platform is keyless/free-feed only).

---

## Phase 2 — Genre & blocks

**Genre:** validation

**Blocks:**
1. Verdict summary (what's sound / what's broken / what to change)
2. Evidence per driver class — predictive vs contemporaneous, with effect sizes where published
3. Combination methodology — what institutional practice actually does
4. Failure-mode audit — mapped specifically onto this engine's design
5. Adversarial pass — steel-man the current design; strongest case *against* the recommendations
6. Concrete change list, ranked by expected impact vs implementation cost

---

## Phase 3 — Sourcing strategy

### Channels
- Academic: SSRN, NBER, journal abstracts (gold–real yield, safe-haven literature, forecasting)
- Primary/official: Fed (FRED research notes), BIS, World Gold Council research
- Industry/practitioner: bank research summaries, quant blogs with published methodology
- Discussion/adversarial: quant forums, replication attempts, failure post-mortems

### Subtopic → agent map (parallel fan-out)
| Agent | Subtopic | Source file range |
|---|---|---|
| 1 | Real yields / TIPS / breakevens / 2Y → gold; predictive vs contemporaneous | 01–08 |
| 2 | DXY & dollar cycle → gold; daily horizon | 10–17 |
| 3 | VIX, credit spreads, safe-haven behavior; when it fails | 20–27 |
| 4 | COT positioning as a contrarian signal; hit rates, horizon | 30–37 |
| 5 | Institutional multi-signal combination: weighting, regime conditioning, collinearity | 40–49 |
| 6 | Failure modes of multi-factor scoring + documented fixes | 50–59 |

### Opposition queries (run deliberately, not incidentally)
- "gold real yield correlation broke down / decoupled"
- "macro variables cannot predict daily returns / efficient market"
- "COT positioning no predictive power"
- "signal blending overfitting / equal weight beats optimized"
- "safe haven gold failed during crisis"

### Triangulation rule
Every thesis in the final report needs ≥3 independent sources of **different types**. Anything
below that ships labelled *insufficient evidence*, not as a finding.

### Risk register
| Risk | Mitigation |
|---|---|
| Confirmation bias — user wants their design validated | Mandatory adversarial pass; opposition queries listed above are run regardless of what the confirming evidence says |
| Practitioner sources are marketing, not evidence | Score every source on Credibility/Recency/Bias; broker/vendor content capped at low credibility unless it publishes methodology |
| Academic results at monthly horizon get misread as daily | Every extracted claim must record its **horizon**; horizon mismatch is itself a finding |
| Thin corpus on niche claims (e.g. Dollar Smile daily) | Say "insufficient evidence" rather than extrapolating |

### Stop criteria
Stop searching when: each of the 4 clusters has ≥3 differently-typed sources on the
predictive-vs-contemporaneous question, AND the combination-methodology subtopic has ≥3, AND
the opposition queries have been run and their results incorporated.

---

## Changelog
- 2026-07-24 — plan created, hypotheses committed before searching.
- 2026-07-24 — Phase 3.5 capability discovery: **WebFetch blocked organization-side** (HTTP 403
  at egress proxy on every domain incl. `example.com`; confirmed via
  `curl -sS "$HTTPS_PROXY/__agentproxy/status"`). WebSearch functional. Investigation continued
  at a reduced evidentiary standard, explicitly labelled throughout. All sub-agents correctly
  refused to fabricate verbatim quotes.
- 2026-07-24 — Phase 4: 6 sub-agents run in parallel. 16 source files written (8 academic,
  2 primary, 6 industry). Agents 5 (combination methods) and the COT agent wrote zero files —
  their findings are reported but flagged as un-triangulated.
- 2026-07-24 — Phase 5: `sources.csv` built; 61 quote lines captured; all 16 files carry an
  explicit verification caveat. **Gap: zero discussion-type sources.**
- 2026-07-24 — Phase 6: findings F1–F6 written; report assembled with adversarial pass
  (steel-man + explicit refutation condition: a positive Edge Tracker result at n≥200 overrides
  the theoretical objections).
- 2026-07-24 — Phase 6.5: 6 load-bearing claims spot-verified against saved sources — all traced.
- 2026-07-24 — Phase 7: `refresh_targets.md` written, including a code-drift detector and the
  Edge Tracker as the empirical arbiter.
