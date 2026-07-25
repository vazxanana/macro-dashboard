# F2 — Level taxonomy, graded by actual evidence

**Status:** CONFIRMED — one genuinely rigorous evidence base exists (Osler); most of the rest is
folklore.
**Evidence type:** academic (order-book studies) + industry
**Confidence:** high on the grading; all figures search-derived (WebFetch blocked).

---

## The one rigorous foundation: Osler's order-book work

Two NY Fed papers by **Carol Osler** using real Royal Bank of Scotland order data — **9,655
orders, $55B+ face value**, USD/JPY, GBP/USD, EUR/USD, 1999–2000. This is the strongest
evidence in the entire "levels" space because it has *order-book causality*, not chart-eyeballing.

**What it established:**

1. **Stop-loss and take-profit orders cluster densely at round numbers** — ~10% of orders sit
   exactly at 00-endings vs a much flatter random baseline.
2. **The clustering is asymmetric, and that asymmetry explains both level behaviours:**
   - **Take-profits cluster on the *approach*** to a round number → a *braking* effect → price
     stalls/reverses at the level.
   - **Stop-losses cluster *just past*** it → an *acceleration/cascade* effect → price runs once
     the level breaks.
3. A separate paper tested **published bank-desk S/R levels** against **10,000 randomised
   control levels** via bootstrap: a real but **modest** edge — **60.8% vs 56.2% bounce
   frequency (+4–8pp by currency), decaying over ~5 business days.**

That +4–8pp is the honest size of the "levels work" effect. Real, tradeable, not overwhelming.

**Note this mechanism explains your platform's own `sweep` logic.** A wick through a level that
closes back inside = take-profit braking; a body close through = stop-cascade acceleration.
Your structure engine already encodes Osler's finding without citing it.

---

## Grades by level type

| Level | Grade | Basis |
|---|---|---|
| **Round numbers** | **B+** | Osler order-book causality. Modest effect sizes. FX data; gold extrapolated by inference, not directly studied |
| **Published/consensus S/R** | **B** | Osler bootstrap vs randomised controls: +4–8pp, ~5-day decay |
| **VWAP** | **B** | Different evidence class — a *structural* fact: large quantified share of institutional flow is mechanically routed to execute at/near VWAP. Equity-specific; no gold/FX usage-share data found |
| **General S/R (equities)** | **C** | Studies exist by title; findings not retrievable via search |
| **Opening range breakout** | **C, contested** | Actively split: a 2024 paper claims 2.4 Sharpe on a specific implementation; a 2026 arXiv falsification study on MNQ futures found ORB variants fail. Conflicting rigorous results usually signal implementation-dependent overfitting |
| **PDH / PDL** | **C/D** | **No rigorous study found.** Evidence is single-instrument retail blog stats ("71% of the time" for SPY) with no cited methodology |
| **Prior day CLOSE** | **D** | Rests on behavioural anchoring theory applied by inference. The "70%/85% of traders reference this" stats have **no visible source** |
| **Prior week H/L/close** | **D** | Same as PDH/PDL but with even less specific evidence — only retail pivot-calculator content surfaced |

**Gold-specific evidence: none of academic quality was found for any level type.** All gold
round-number content ($2000/$2500/$3000 psychological levels) is broker education asserting the
Osler mechanism without gold order-book data. Extension is *plausible* by mechanism — deep
retail plus CTA/algo participation — but it is extrapolation.

---

## Uncomfortable implication for the current platform

Your engine leans on **PDH/PDL/PDC** (they appear in `structState` and in the engulfing
`nearLevel()` structure filter) — and those grade **C/D**. Meanwhile:

- **Round numbers** (grade B+) are already in `nearLevel()` via `r100`/`r50` — good, keep.
- Your **reaction zones** (`reactionZones()`) are conceptually the closest thing to Osler's
  "published S/R levels" (grade **B**) — levels where price demonstrably reacted before. That's
  your best-evidenced level construct and it's home-grown.
- **VWAP** (grade B) you already compute.

So the ranking of what you have, best-evidenced first: **reaction zones ≈ round numbers ≈ VWAP
> PDH/PDL > prior closes.** That is close to the inverse of how prominently prior-day levels
feature in the engulfing filter.

---

## The self-fulfilling objection — answered honestly

"Levels only work because traders watch them" is **true and not disqualifying**. Osler's
round-number finding *is* a self-fulfilling mechanism: orders cluster there by choice, so price
behaves differently there because those orders exist.

The operative qualifier: **the mechanism requires the level to be widely watched.** Round
numbers, PDH/PDL, VWAP and published desk levels qualify structurally. Obscure indicator-derived
levels do not.

Two consequences:
- Reflexivity is a **necessary condition** for a level to matter — not evidence against it.
- But it implies **fragility**: modest effect sizes, and decay as participation shifts. The
  Turtle Trading history is the cautionary case — a famous breakout system whose edge degraded
  with adoption.
