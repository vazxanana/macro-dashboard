# F5 — Equal weighting is defensible; summing correlated signals is not

**Status:** CONFIRMED (H3 first half upheld, H2 upheld)
**Evidence type:** academic (portfolio theory / forecasting literature) + industry practice
**Confidence:** high — these are settled, widely-replicated results in the literature.

⚠ Same sourcing caveat as F4: search-derived, WebFetch blocked. Named papers below are
well-known and consistently attributed across independent search passes, but were not fetched.

---

## 1. Hand-set weights are NOT the main defect

The "forecast combination puzzle" is a settled empirical regularity, not folklore:

- **DeMiguel, Garlappi & Uppal (2009, RFS)** tested 14 optimised allocation models against
  naive 1/N across seven datasets. None consistently beat 1/N on Sharpe, certainty-equivalent
  return, or turnover. The estimation window required to reliably beat 1/N was reportedly
  measured in *centuries* of data.
- **Smith & Wallis (2009)** showed formally that the puzzle stems from finite-sample estimation
  error: when true optimal weights are near-equal, estimating them from data adds variance
  without adding accuracy — the noise in the weight estimate swamps the theoretical gain.
- **Timmermann (2006)** and **Clemen (1989)** reach the same conclusion across decades of
  forecasting research: simple combination is robust; sophisticated weighting is fragile OOS.

**Implication:** the engine's hand-set integer weights (3/2/1) are a reasonable design choice.
Do not spend effort optimising them. This also independently condemns the auto-tuner (**F3**) —
adaptive weighting is exactly the fragile-OOS approach this literature warns against, and the
engine applies it at n=30.

**H3 verdict:** upheld on both halves. Hand-set weights are fine; the tuner is the defect.

## 2. Correlated signals do not add breadth — this is the core error

**Grinold & Kahn's Fundamental Law of Active Management:** IR ≈ IC × √Breadth, where Breadth
is explicitly the number of **independent** decisions — not the number of signals. Correlated
signals contribute far less than their nominal count to the √Breadth term.

**Meucci's Effective Number of Bets (ENB)** makes the same point precisely: diversification is
measured through exposure to *uncorrelated* factors, not raw signal count. As average
correlation rises, adding more signals saturates the effective independent count well below N.

Applied to this engine (**F1**): 15 nominal drivers, but five of them derive from DFII10, three
from DXY, three from VIX, and one (`Dollar Smile`) is a deterministic function of five others.
The effective independent breadth is plausibly closer to **5–7** than 15. The net score is
computed as though breadth were 15.

**H2 verdict:** upheld.

## 3. The three correct treatments for correlated signals

From the literature, in increasing order of implementation cost:

1. **Collapse duplicates.** One directional vote per underlying raw series. Cheapest, largest
   immediate gain, no statistics required.
2. **Orthogonalise.** Regress each signal against the others and keep only the residual
   (idiosyncratic) component before combining. Requires history the platform doesn't currently
   store.
3. **Effective-breadth adjustment.** Compute the correlation structure across drivers and size
   conviction to the *effective* number of independent bets rather than the raw count.

For a browser-side, keyless platform, **(1) is the realistic option** and captures most of the
benefit.

## 4. Regime conditioning is done on states, not on signal agreement

**H4 verdict: partially refuted.** The engine's rates-vs-dollar agreement check is a reasonable
heuristic, but it is not how the literature conditions on regime:

- **Bridgewater's All Weather** conditions on growth/inflation *quadrants* (rising/falling
  growth × rising/falling inflation, relative to expectations) — and notably does **not**
  predict which regime comes next; it holds sub-portfolios each engineered to win in one
  quadrant, sized to equal risk contribution.
- Practitioner risk-parity research conditions volatility-targeted positions on measured
  economic *states*, using equally-weighted z-scored composites as the default aggregation
  before any regime tilt.

The common pattern: **condition on an observable state, size to risk, don't forecast the
regime.** The engine's agreement check is a weaker proxy — and per **F1** it is partly
comparing a variable against itself, since `Macro composite` (dollar cluster) contains TIPS and
`Dollar Smile` (dollar cluster) contains `realYield.chg`.

## 5. Aggregation mechanics worth adopting

The engine sums raw integer weights. Standard practice is to **z-score normalise each signal
first**, then combine equally. Without normalisation, a driver's influence depends on the
arbitrary scale of its thresholds rather than on its information content — e.g. the
real-yield momentum driver flips at ±0.02 (2bp/wk) while the DXY driver flips at ±0.25 points;
whether those represent comparable moves in their own distributions is currently unexamined.
