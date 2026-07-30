# F3 — The driver auto-tuner fires on noise ~95% of the time

**Status:** CONFIRMED — code-verified rule, plus first-principles binomial statistics computed
in-session (reproducible; see `plan.md` changelog).
**Evidence type:** primary (code) + computed statistics + corroborating literature (unverified
secondary, see caveat).
**Confidence:** high. The binomial arithmetic is exact and does not depend on any fetched source.

---

## The rule as implemented

```js
if (s.n < 30) continue;                       // needs 30 graded days
const r = s.hit / s.n;
out[k] = { mult: r >= 0.6 ? 1.25 : r <= 0.4 ? 0.75 : 1, ... };
```

A driver with ≥30 graded days and a ≥60% hit rate gets its weight multiplied by 1.25;
≤40% gets ×0.75.

## Why 30 observations cannot support that inference

Under the null hypothesis that a driver is pure noise (true hit rate 50%), the probability of
observing ≥60% by chance alone:

| n | Threshold to hit 60% | One-tailed p under H₀ |
|---|---|---|
| **30** (current rule) | 18/30 | **0.181** |
| 50 | 30/50 | 0.101 |
| 80 | 48/80 | 0.047 |
| 100 | 60/100 | 0.028 |
| 200 | 120/200 | 0.0028 |

At n=30 there is an **18% chance** a coin-flip driver clears the 60% bar. That is not evidence
of skill by any conventional standard.

## The multiple-testing problem makes it far worse

The tuner does not test one driver — it tests **all 15 simultaneously**, every day:

| Drivers tested at n=30 | P(at least one spuriously boosted) |
|---|---|
| 1 | 0.181 |
| 5 | 0.631 |
| **15** | **0.950** |

**On the day the tuner activates, there is a ~95% probability that at least one driver's weight
is being changed because of luck, not skill.** The symmetric ×0.75 downweight rule roughly
doubles the exposure — a genuinely useful driver has a similar chance of being spuriously
penalised.

## What sample size would actually be needed

- ~**80** observations for a 60% hit rate to reach p<0.05 on a *single* pre-specified driver.
- With a multiple-testing correction for 15 simultaneous tests (Bonferroni target p<0.0033),
  roughly **200** observations — about **0.8 years of daily data per driver**, and that is per
  driver, requiring the driver's definition to remain unchanged throughout.

The engine currently fires at 30, and its ledger had 3 graded days at time of writing.

## Corroborating literature (⚠ unverified — see caveat)

Search-derived, **not** verified against primary text because WebFetch was blocked
organization-side for this entire session:

- **Bailey & López de Prado**, Probabilistic Sharpe Ratio / Minimum Track Record Length —
  formalises the required track length as scaling with the inverse square of the excess
  Sharpe, growing further under negative skew/fat tails.
- **Harvey, Liu & Zhu**, "…and the Cross-Section of Expected Returns" — argues a t-ratio
  above ~3.0 (not the classical 2.0) is required for a newly claimed factor, precisely because
  of multiple testing across many candidate signals.
- Practitioner consensus surfaced repeatedly: <30 observations is treated as noise; ~100+ for
  basic confidence in a hit rate; ~200+ before trusting a derived ratio.

These are consistent with the exact binomial figures above, which stand on their own.

## The deeper irony

**F1** establishes that the drivers are heavily collinear. Collinear drivers will post
*correlated* hit rates — when the real-rate complex has a good month, all five DFII10-derived
drivers look skilful simultaneously. The tuner will then boost several of them at once,
compounding the concentration problem it cannot see. Auto-tuning on top of undiagnosed
collinearity doesn't just add noise; it amplifies the single largest structural flaw.

## Recommendation

1. **Disable the tuner at n=30.** Raise the gate to n≥100 minimum, ideally n≥200 with a
   multiple-testing-aware threshold.
2. **Shrink rather than switch.** Replace the hard 1.25/0.75 step function with a shrinkage
   estimator that pulls the observed hit rate toward 50% as a function of sample size
   (James–Stein style), so weight adjustment scales smoothly with evidence instead of
   snapping on at an arbitrary cutoff.
3. **De-duplicate before tuning** (see F1), or the tuner will keep rewarding the same
   underlying variable five times over.
4. Given the equal-weight literature (**F4**), the honest option is to **delete the tuner
   entirely**. It is unlikely to add value even when correctly gated.
