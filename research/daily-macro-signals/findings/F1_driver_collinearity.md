# F1 — The 15 drivers are not 15 independent signals

**Status:** CONFIRMED — verified directly from source code, requires no external citation.
**Evidence type:** primary (the system's own implementation, `gold-trading.html`)
**Confidence:** high — this is a structural fact about the code, not an empirical claim.

---

## Claim

The Daily Bias engine presents 15 drivers as independent weighted votes. They are not
independent. A small number of underlying data series are counted repeatedly, so the net score
systematically overstates how much *distinct* evidence supports the day's bias.

## The dependency map (traced from `refreshFundamentalsX()` and `computeDailyBias()`)

| # | Driver | Weight | Underlying raw input |
|---|--------|--------|----------------------|
| 1 | Real yields (master driver) | 3 | FRED **DFII10** |
| 2 | Macro composite (TIPS·DXY·flows·seasonal) | 2 | **DFII10** + **DXY** + seasonal (+ real-yield override) |
| 3 | Market structure — Daily bos/ChoCh | 3 / 2 | price only |
| 4 | Supply/Demand block | 2 / 1 | price only |
| 5 | Risk sentiment (VIX) | 1 | **VIXCLS** |
| 6 | Real-yield 1-wk momentum | 2 | **DFII10** (first difference) |
| 7 | Inflation expectations (breakeven) | 1 | DGS10 − **DFII10** |
| 8 | Fed expectations (2Y trend) | 1 | **DGS2** |
| 9 | USD 5-day momentum (ICE DXY) | 1 | **DXY** (Frankfurter basket) |
| 10 | Funds positioning (COT) | 1 | CFTC weekly |
| 11 | Yield curve (10Y–3M) | 1 | DGS10, DGS3MO |
| 12 | Credit stress (HY spreads) | 1 | **BAMLH0A0HYM2** |
| 13 | Dollar Smile regime | 1 | **function of #5, #6, #8, #9, #12** + swap/SOFR |
| 14 | Eurozone growth pulse | 1 | OECD BSCICP03DEM665S |
| 15 | Yen carry-unwind risk | 1 | USDJPY + **VIXCLS** — `dir` always `null` |

## Repetition counts

- **DFII10 (10Y real yield)** appears in drivers **1, 2, 6, 7, 13** — five of fifteen.
- **DXY** appears in **2, 9, 13** — three.
- **VIX** appears in **5, 13, 15** — three.
- **DGS2** appears in **8, 13**. **HY** appears in **12, 13**. **DGS10** appears in **7, 11**.

## The worst case: Dollar Smile is a pure derivative

`dollarSmileRegime()` reads `fundX.dxyMom`, `fundX.hy`, `fundX.dgs2`, `vixState.val`,
`realYield.chg` — every one of which is *already voting elsewhere in the same tally*. It
contributes no new information whatsoever; it is a deterministic re-expression of five
existing drivers, then counted a sixth time as though independent.

This does not mean the Dollar Smile concept is wrong. As a **regime label** it is genuinely
useful — it says which of several conflicting interpretations of the same data applies. The
error is scoring it as an additional directional vote in the same sum as its own inputs.

## Weight concentration

Cluster weights on a typical day (`wTot = 20`, per observed test output `net +5 of ±20`):

- Rates cluster: 3 + 2 + 1 + 1 + 1 = **8 of 20 = 40%**
- Plus the TIPS component inside Macro composite (#2) and the `realYield.chg` component
  inside Dollar Smile (#13), so the real-rate complex effectively drives **~45–50%** of all
  directional weight — while being displayed to the user as five separate confirmations.

## Why this matters (the mechanism, not just the tidiness)

When DFII10 moves, roughly eight weight units move together *by construction*. The UI reports
this as a broad consensus of independent drivers. It is one variable, counted five times.

This is the textbook **breadth-vs-conviction failure**: apparent agreement across many signals
is only informative if the signals are independent. Grinold's fundamental law of active
management expresses value as a function of *independent* breadth; correlated signals do not
add breadth. The engine's own synthesis layer added a rates-vs-dollar agreement check, which
is the right instinct — but the two clusters it compares are not independent either, because
`Macro composite` sits in the dollar cluster while containing TIPS, and `Dollar Smile` sits in
the dollar cluster while containing `realYield.chg`.

## Implication for the design

The fix is not to delete drivers. It is to stop treating derived and raw versions of the same
series as separate evidence:

1. Collapse each raw series to **one** directional vote (level *or* momentum, not both summed).
2. Reclassify `Dollar Smile` from a vote to a **regime modifier** that scales or gates the
   other votes — which is what it actually is.
3. Remove TIPS and DXY from `Macro composite`, or remove `Macro composite` (it is a legacy
   aggregate that now duplicates drivers added after it).
4. Recompute cluster membership so the rates and dollar clusters are genuinely disjoint at the
   *raw input* level, otherwise the agreement check is partly checking a variable against itself.
