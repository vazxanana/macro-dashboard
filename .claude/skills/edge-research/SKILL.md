---
name: edge-research
description: Checklist and reusable pieces for testing any trading edge in this repository (Mosha, Engulfing, MSNR, LIT, ICT, macro, breakouts, level fades). Use before writing a new study in research/edge/, when a desk reading or a split "looks good", when a result passes before costs, or when the owner asks to "make it an edge" or "add other strategies to complement it". Covers the cost-in-R check, placebo levels, matched-time controls, the entry fill rule, higher-timeframe and filter add-ons, and what to reuse from the round-number studies.
---

# Edge research: what to check before calling anything an edge

Lessons of the level and fade studies of 22-24 Nov 2026 (`research/edge/grid7-wide-fade`, `fade-new-markets`,
`dom-placebo`, `dom-trade-through`, `limit-random`, `round-number-breaks`, `round-fade-net`), written as checks that
apply to every edge. Absolute rules of `CLAUDE.md` still hold: pre-register first, 2020 or earlier to now, in sample vs out
of sample, net of costs, never an edge without n and t, ICT kept apart, nothing live without the owner.

## 1. Cost in R decides first

Before testing a rule, compute what the round trip costs as a share of its risk: `cost R = round trip / (entry - stop)`.
`grid7-wide-fade` and `round-number-breaks` print it per cell; do the same.

| Stop size (typical) | Cost R | What a rule must make before costs just to break even |
|---|---:|---|
| M5 candle extreme | about 0.5 | +0.5R a trade: no tested rule here comes close |
| M15 candle extreme | about 0.3 | +0.3R |
| H1 candle extreme | about 0.2 | +0.2R |
| H4 candle extreme | about 0.1 | +0.1R |

Every short-term fade / pull-back found so far makes +0.02 to +0.09R before costs, so it dies on M5-H1. Moving to
H4 shrinks the cost AND the tilt (`round-fade-net`: H4 +0.03R gross, -0.08R net). Rule of thumb: if gross R a trade
is not at least twice the cost R on the timeframe you trade, do not spend a study on filters; change the idea.
Judge the main bar AFTER costs whenever the cost R is above 0.1, and name which costs are measured
(xau, eurusd, gbpusd, usdjpy, audusd) and which are assumed.

## 2. Is it the level, or any level? (placebo levels)

A level rule must beat the same rule on levels that mean nothing:
- **Shifted grid**: the same events on a price grid of the same spacing moved by a fraction of a step
  (`round-number-breaks` `events(T, atr, { off, S, ratio })` with `SHIFTS` 0.23 / 0.41 / 0.59 / 0.77). Round numbers
  did no better than the shifted grid (Welch t -0.7 to -2.2).
- **Random earlier zone**: `dom-placebo` (a random same-colour body beat the dominant zone).
- **Random band / random limit**: `dom-touch-market`, `limit-random`.
If the placebo does as well, the edge is the entry mechanics (a pull-back after a close), not the level. Then the
level, zone or skill concept should not be sold as the reason.

## 3. Matched-time controls

Compare a rule with a control taken at the SAME times, not the control's unconditional average.
`round-number-breaks` matches each trade to the nearest plain-fade trade within 24 h: the plain fade made +0.065R
unmatched but about -0.05R at the times round numbers were crossed (fast markets). An unmatched control would have
made the rule look worse than it is; a matched one can make it look better. Report both, and the placebo of section 2.

## 4. The fill rule (limit orders on mid candles)

A limit that "fills on touch" of a mid candle is flattered: `dom-trade-through` took +0.055R to +0.011R once the fill
needed a trade-through of half the round trip. Every limit entry must be tested with a trade-through fill, or at market
at the next 5-minute open (what the fade studies do). Never call a limit-entry result real on touch fills.

## 5. "Complementing" with other strategies: what works and what did not

Adding pieces from other desks as filters is cheap to test and rarely pays. Tried and failed (before or after costs):
structure side on H1 / H4 / D1, the timeframe chain (`ltf-structure`, `direction-chain-gate`, `vb-structure-filter`),
the MSNR direction call, the Gold Macro Score as a size step on the breakout (`vb-macro-size`), exhaustion candles, quiet hours, the
daily-range edge (`round-fade-net`), market-cycle labels (`regime-switch-book`). A filter helps only if it raises gross
R a trade by more than the cost R it leaves; most cut n and move gross R by under 0.02R. Pre-register filters as a
small fixed set, Holm over them, and require each to beat the unfiltered rule (Welch t >= 2), not just to pass alone.

## 6. Reusable pieces (import, never copy or edit)

| Need | Use |
|---|---|
| Candles, resampling, swings, structure, QM, stats, Holm | `research/edge/_lib/edgekit.mjs` |
| M15 / H1 / H4 / D1 frames from 5m | `research/edge/combo-grid-3/run.mjs` `frames` |
| Costs, bad-data exclusions | `research/edge/combo-grid-2/run.mjs` `COSTS`, `exclusions` |
| ATR(14), first 5m candle after a time, fill rules | `research/edge/dom-trade-through/run.mjs` `atr14`, `startIdx`, `findFill` |
| Several targets in one pass, stop first, gaps at the open | `research/edge/grid7-wide-fade/run.mjs` `exits` |
| First structure break with the opposite swing | `grid7-wide-fade` `breaks` |
| Session of a fill (London / New York / other) | `grid7-wide-fade` `sessionOf` |
| Month sums t, one-sided p, Welch t, windows 2005-14 / 2015-26 | `research/edge/grid7-wide-core/run.mjs` `mstat`, `p1`, `welch`, `FROM`, `SPLIT`, `TO` |
| Level crosses and failed crosses on any grid (real or shifted) | `research/edge/round-number-breaks/run.mjs` `events`, `STEPS`, `SHIFTS` |
| Exhaustion / quiet hours / 20-day range-edge filters | `research/edge/round-fade-net/run.mjs` `filtersOf` |

Every study also needs: a cut test (signals known by a date equal the full run when candles are cut there), a stop
on the losing side of every fill (throw otherwise), RESULT.md line 3 = the verdict line, result.json, and an offline
test pinning RESULT.md to result.json.

## 7. Order of work for a new idea

1. Write the rule in plain words; compute its expected cost R (section 1). Below 2x gross: stop.
2. Pre-register (fixed cells under 60, windows, bar, controls, placebo), commit and push it alone.
3. Run on the ten-market cache (`EDGE_DATA`, `fetch-cache.mjs`; restart a market that throws, finished years are kept).
4. Judge: the bar, then the placebo and matched control, then after costs, then per market (measured costs alone).
5. A pass before costs only is a tilt, not an edge. A pass after costs is a candidate for a forward paper record
   with its own pre-registration (as `gold-vol-breakout-forward`), never a live rule without the owner.
6. One run, no variants on the same years after seeing the result.

## What has held up so far (for comparison)

Only two rules have passed after costs out of sample and on a second check: the gold and the USD/JPY volatility
breakouts (stop entries, wide stops, measured at the broker's ticks: `gold-vol-breakout-exec`,
`usdjpy-vol-breakout-exec`). Both have forward records running. Their common shape: a stop order in the direction of
a range break, a stop of about half the prior day's range (cost R about 0.02 on gold, measured), one trade a day. New ideas with that
shape (wide stop, cost R under 0.05) are the ones worth a study.
