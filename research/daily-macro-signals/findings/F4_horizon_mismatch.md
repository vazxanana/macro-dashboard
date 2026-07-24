# F4 — The evidence base is contemporaneous and monthly; the engine is predictive and daily

**Status:** CONFIRMED (H1 upheld) — with an explicit sourcing caveat, see below.
**Evidence type:** academic + primary/central-bank + industry, via search synthesis
**Confidence:** high on the *direction* of the finding (the horizon gap is consistent across
every independent search pass); medium on any specific quoted figure, which could not be
verified against primary text this session.

⚠ **Sourcing caveat.** WebFetch was blocked organization-side for this entire investigation
(HTTP 403 at the egress proxy on every domain, `example.com` included). Source files in
`sources/` are built from converging WebSearch summaries and are labelled as such inside each
file. Figures below should be re-verified against primary text before being cited externally.

---

## The claim

Essentially every quantified gold–macro result that could be located operates at a **monthly,
quarterly, or multi-year horizon**, or is explicitly **contemporaneous/attributional**. None
demonstrated genuine ahead-of-time predictive power at a **daily** horizon — which is the
horizon the Daily Bias engine operates at.

## What the located evidence actually measures

| Source | Headline figure | What it actually is |
|---|---|---|
| Erb & Harvey, *The Golden Dilemma* (NBER/FAJ) | −0.82 gold/real-yield correlation, 1997–2012 | **Static level correlation over 15 years.** The authors themselves caution it may be spurious/data-mined, with causal direction unresolved. |
| Chicago Fed Letter No. 464 (2021) | 100bp real-yield shock ↔ 3.4% real gold move | **Contemporaneous structural response** to yield innovations — not a forecast. |
| World Gold Council GRAM | Decomposes returns into opportunity-cost/risk/momentum factors | **Monthly, after-the-fact attribution.** Explains realized returns; does not forecast them. |
| Peer-reviewed OOS study (2023) | Only *inflation* showed out-of-sample forecast power | …and only at **2–3 month** horizons. A broad macro set (incl. default spreads, stochastic vol) showed none. |
| 2Y yield | −0.582 correlation, 1976–2024 | **Level correlation over five decades.** |

## The most damaging single result

An EFMA 2024 conference paper on gold's intraday jumps reportedly found that only
**18–28% of gold's intraday jumps are explained by scheduled macro news at all**, and that the
reaction is a same-instant response to the *surprise* component of a release — which is by
construction unforecastable from already-public real-yield and breakeven levels. Elevated
volatility preceded jumps by only 10–15 minutes.

If ~three-quarters of gold's large intraday moves are not attributable to scheduled macro news,
then a macro scoring model has no path to forecasting most of the day's realised movement,
regardless of how well the drivers are weighted.

## The relationship is also unstable

Apollo Academy's analysis of the 2022–2023 period reportedly found the gold/real-yield
correlation collapsed from **0.84 (2005–2021) to 0.03 (2022–2023)** — gold rallying while real
yields rose. Independently, breakevens decoupled: gold +135% from 2022–2026 while 10Y breakeven
(T10YIE) stayed range-bound at 2.0–2.6%.

A relationship that inverts for multi-year stretches cannot be treated as a stable daily
forecasting law. This is the same instability the dollar-focused pass found (gold and DXY
rising together through 2023–2026, correlation swinging from −0.72 to above zero within a
single year).

## What this does and does not mean

**It does not mean the drivers are worthless.** Contemporaneous relationships are genuinely
useful for:
- *Explaining* why gold moved today (attribution — what the platform's readouts already do well)
- *Regime identification* — knowing whether you are in a rates-driven or haven-driven tape
- *Risk sizing* — knowing which scheduled releases can move you

**It does mean** that summing them into a next-day directional forecast and reporting a
confidence percentage overstates what the underlying evidence supports. The drivers describe
the **present state**, and the engine presents them as a **forward-looking bias**.

## H1 verdict

**H1 upheld.** Most drivers are contemporaneous state descriptors, not daily-horizon
predictors. No located study demonstrated meaningful daily-ahead out-of-sample R² for macro
variables on gold.

## Design implication (the constructive reading)

The honest architecture is not to delete the macro stack — it is to **stop asking it to do a
job the evidence says it cannot do**, and give it the job it demonstrably can:

1. **Reframe the macro output as a regime/context label**, not a directional forecast.
   "Rates-driven risk-off tape, dollar confirming" is defensible. "63% confident LONG tomorrow"
   is not, on this evidence base.
2. **Let the technical layer carry the directional call.** Market structure and supply/demand
   operate on price, at the horizon actually being traded, and their edge (or lack of it) is
   directly measurable in the Edge Tracker — which is exactly the right instrument.
3. **Use macro as a gate/veto and a sizing input**, not as votes summed alongside price
   signals. This matches how the platform *already* treats the red-folder gate and the Yen
   carry warning — the pattern is right, it just isn't applied to the rest of the macro stack.
4. **Keep the Session Signals and Trade Plan as-is** — they already lean on structure for
   direction and use macro for context, which is the correct division of labour.
