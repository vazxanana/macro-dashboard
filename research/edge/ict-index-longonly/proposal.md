# Proposal: NQ/ES A-setup = gold-rule buys after a down month (not implemented)

**Rule change, in one sentence.** On NQ and ES only, replace the index A-rule with a new aRule. A-setup = a BUY iFVG
signal (grade ≥ 3) with a stop of 0.3-0.75x the daily ATR, taken only when the last completed daily close is below the
daily close 20 trading days earlier; size 1, no break-even, the gold exit (trail from +2R, 36 H1 max). Sells and all
other signals are still recorded but are not A-setups.

YM and RTY are not covered by this test and stay on the index rule.

## Evidence
NAS100+SPX cash, 2018-01 to 2026-10, run through the desk's own `signals()` and `simulate()`, net of costs.

| | IS 2018-23 | OOS 2024-26 |
|---|---|---|
| Current index A-rule | n 550, +0.03R/trade, +15.7R, DD 30.3, t 0.45 | n 247, +0.14R, +35.4R, DD 15.7, t 1.44 |
| **Proposed** | n 256, **+0.21R**, +53.2R, DD 13.7, t 2.20 | n 114, **+0.48R**, +54.7R, DD 9.3, t 3.21 |

- **Beyond drift:** after subtracting random longs (same market, year, 200-MA regime, stop band, exit and costs), the
  proposed rule makes +0.17R a trade IS and +0.47R OOS. The OOS block-bootstrap 95% CI is +0.19 to +0.75.
- **Every year positive:** 9 of 9 years, pooled and on SPX alone.
- **Bear windows:** the ungated gold-rule buys beat random longs in every bear window (2018 Q4, Feb-Mar 2020, 2022,
  Aug 2024, Apr 2025). The mirror sells do not beat random shorts. So the edge is the buy signal's timing, not long
  exposure.
- **Without the gate:** the buys in a rising market (20-day return > 0) earn only drift: −0.02R OOS. That half is what
  the gate removes.

## Risks
- **Selection:** 26 variants were tried. OOS is well above IS, so plan on about +0.2R a trade.
- **Fewer trades:** about 40 a year across NQ+ES, vs about 90 for the current rule. Strong up-trend years such as 2019
  will be close to flat.
- **No shorts:** the rule never sells. In a crash, its only defence is not buying. In the 2022 bear it made +2.3R
  gated, vs +21.7R for the current rule.
- **Untested on futures:** the test used cash data. Futures roll gaps and the 17:00 halt differ, and the 20-day close
  must come from the tracker's own daily series.
- **Paper first:** the A-setup counts and the replay should be compared side by side for at least a month before the
  live A-rule is switched.
