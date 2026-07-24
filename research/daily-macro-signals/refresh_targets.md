# Refresh targets — `daily-macro-signals`

Entry point for an `update daily-macro-signals` run. Produces a delta in `diffs/`, not a
full re-investigation.

---

## 0. Re-run these first (blocked this session)

**WebFetch was blocked organization-side for the entire original investigation** (HTTP 403 at
the egress proxy on every domain). If fetching works on the refresh run, the single highest-value
action is verifying the search-derived claims against primary text.

Priority fetch list — these carry the report's most load-bearing claims:

| Priority | Target | Verifies |
|---|---|---|
| 1 | Baur & Lucey (2010) "Is Gold a Hedge or a Safe Haven?" — the *"one day after a shock loses money"* line | F6 §highest severity |
| 2 | EFMA 2024 gold intraday-jump paper — the 18–28% figure | F4 §most damaging result |
| 3 | Chicago Fed Letter No. 464 — the 3.4%/100bp coefficient | F4 (quote already captured verbatim; confirm attribution) |
| 4 | Erb & Harvey, *The Golden Dilemma* (NBER/FAJ) + 2024 follow-up | F4 baseline correlation |
| 5 | DeMiguel/Garlappi/Uppal (2009 RFS); Grinold & Kahn; Meucci ENB; Bailey & López de Prado | **F5 and F3's literature support — currently ZERO source files** |
| 6 | Sanders, Irwin & Merrin (2009 JARE) on COT forecasting ability | COT skeptical result (no source file written) |

## 1. Numbers to re-pull

| Number | Current value | Where |
|---|---|---|
| Gold/real-yield rolling correlation | 0.84 (2005–21) → 0.03 (2022–23) | source 05 |
| Gold vs 10Y breakeven divergence | gold +135% (2022–26) vs T10YIE range-bound 2.0–2.6% | source 08 |
| 2008 acute-phase gold drawdown | ~30% | source 23 |
| March 2020 gold drawdown | ~12–15% | source 22 |
| Intraday jumps explained by scheduled macro news | 18–28% | source 07 |

## 2. Entities to re-check

- **Morgan Stanley's stance** — as of July 2026, on record that gold "is really acting like a
  risk asset and not really like a safe haven" (source 26). Has this reversed?
- **World Gold Council GRAM** — methodology changes, any move to sub-monthly attribution.
- **Dollar Smile** — still no located formal backtest. Has anyone published one?

## 3. Hypotheses to re-test

| # | Verdict at time of writing | Re-test trigger |
|---|---|---|
| H1 (contemporaneous, not predictive) | UPHELD | Any published daily-horizon OOS R² study for gold |
| H2 (collinearity inflates confidence) | UPHELD | Only if the engine's driver set is de-duplicated — then re-derive the dependency map |
| H3 (equal weights fine; n=30 tuner harmful) | UPHELD | Re-run the binomial calc if the tuner's gate changes |
| H4 (agreement check under-specified) | PARTIALLY REFUTED | Literature on signal-agreement gating as a validated technique |

## 4. The empirical arbiter — check this before anything else

**The Edge Tracker settles this investigation better than any paper can.**

On refresh, read `localStorage.edgeLedger` and check the **Daily Bias** strategy's record:

- **< 30 closed trades** → too early to conclude anything. Report as such.
- **30–200** → directional read only; note it is below the significance thresholds in F3.
- **200+** → *this overrides the theoretical findings in this report.* Positive expectancy at
  n≥200 is direct evidence the macro layer works despite the objections in §3 of the report.
  Theory loses to data.

Also compare against **Structure + S/D** over the same window — if the price-only strategy
outperforms the macro-driven one, that independently supports F4's recommendation to let
structure carry direction and demote macro to context.

## 5. Code state at time of writing (detect drift)

If any of these have changed, the corresponding finding needs re-deriving:

```
driverTuningTable(): gate at s.n < 30, mult 1.25 / 0.75 at 0.6 / 0.4     → F3
st.conf = 50 + |net|/wTot * 50                                           → F2
st.dir threshold: absolute net >= 3 / <= -3                              → F2
'Yen carry-unwind risk' passed dir:null with w:1                         → F2
dollarSmileRegime() reads dxyMom, hy, dgs2, vix, realYield.chg           → F1
getMacroData() -> computeMacroScore() returns tipsS, dxyS                → F1
15 drivers, 4 clusters, wTot ≈ 20–22                                     → F1
```
