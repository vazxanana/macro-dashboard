# F6 — The VIX driver may be trading the wrong side of the safe-haven effect

**Status:** CONFIRMED, and this is the highest-severity finding in the investigation.
**Evidence type:** academic (foundational + international replication) + industry + case study
**Confidence:** high — triangulated across 4+ differently-typed sources.

⚠ Sourcing caveat as F4/F5: search-derived, WebFetch blocked. The Baur & Lucey finding is
consistently reported across independent passes and is the canonical reference in this
literature, but the quote below should be re-verified against the primary text before external
citation.

---

## The finding

**Baur & Lucey (2010)** — the paper that introduced the hedge/safe-haven distinction — reports
that gold's safe-haven property is:

> "extremely short-lived so that an investor buying gold one day after a shock loses money"

(source `20_baur_lucey_hedge_or_safe_haven.md`)

**Baur & McDermott (2010)** independently describe gold as "the stronger and more immediate
safe haven" during crises (source `21`). *Immediate* — not lagged.

## Why this is severe for this specific engine

The Daily Bias engine's risk driver:

```js
add('Risk sentiment (VIX)', vs >= 5 ? 'long' : vs <= 3 ? 'short' : null, 1, vixLabel(), 'risk');
```

Elevated VIX → vote **long gold**. But VIX is elevated *because a shock already happened*. The
engine reads that state and issues a long bias for the **following** session — which is
precisely the "buying gold one day after a shock" trade the foundational literature says loses
money.

The safe-haven effect is real, but it is captured **in the same session as the shock**, by
people already positioned or reacting within minutes. A daily-bias engine reading yesterday's
VIX is systematically arriving after the move it is trying to trade.

## The failure mode is worse than "no edge"

In acute liquidity crises, gold is **sold**, not bought — because it is liquid enough to raise
cash for margin calls. Triangulated across three independent sources (`22`, `23`, `25`):

| Episode | Gold's move |
|---|---|
| 2008 GFC (phase one) | **−25% to −30%** |
| March 2020 COVID crash | **−12% to −15%** |

Gold reasserts its haven role only *weeks* later, once central-bank liquidity returns. So in
exactly the highest-VIX conditions — when the engine's risk driver votes most confidently long
— the historical record shows gold falling hardest.

Source `25` (PLOS ONE) adds that during COVID-19, gold's own implied-vol market (GVZ) failed
standard symmetric Granger-causality tests against VIX, and Treasuries — gold's usual haven
companion — broke down entirely.

Source `26` shows this is live, not just historical: Morgan Stanley on record (July 2026) that
gold "is really acting like a risk asset and not really like a safe haven."

## Credit spreads are under-conditioned too

The engine fires `Credit stress (HY spreads)` long on any ≥8bp weekly widening. Per the World
Gold Council (source `24`), gold rallies on widening spreads **only when the widening reflects
systemic risk** (co-moving with the NFCI) — not idiosyncratic or sector credit stress. Three
named counter-examples where spreads widened with no gold rally: 1991 Gulf War, the Dot-Com
bust, and the 2014–15 commodity slowdown. The HY/gold correlation is also sign-unstable across
regimes (2003–07: tightening spreads alongside a gold bull market).

## The hedge vs. safe-haven distinction the engine collapses

- **Hedge** = unconditional negative/zero correlation *on average*.
- **Safe haven** = the same property, but **only conditional on extreme tail stress**.

Gold is additionally *graded* (zero correlation = weak haven; negative = strong) and
*geographically inconsistent* — works for US/UK/major Europe, but reportedly not for
Australia, Canada, Japan, or the BRICs (source `21`).

The engine's VIX driver fires on ordinary volatility upticks (`vixScore() >= 5`), treating a
conditional tail property as an unconditional linear one.

## Recommendations

1. **Stop voting long on elevated VIX at a daily horizon.** The evidence says that trade is
   late by construction.
2. If the risk cluster is kept, **make it a tail-conditional gate**, not a linear vote: only
   engage at genuine extremes, and explicitly encode the *inversion* — at the highest stress
   levels, flag liquidation risk (gold sold for margin), which is the opposite of the current
   vote's direction.
3. **Condition the HY driver on systemic vs. idiosyncratic** widening — e.g. require
   confirmation from a second stress channel before it votes.
4. This is the same logic the platform **already applies correctly** to the Yen carry-unwind
   row (`dir: null`, warning not direction). That treatment is right; extend it to VIX and HY
   rather than having them vote.
