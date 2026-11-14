# Proposal: put the Mosha cycle back to a paper shadow (13 Nov 2026)

**For the owner to decide (docs/owner-decisions.md item 54). Nothing has changed.**

## What was found
The Mosha cycle (`mcycle`) has been a main paper system since 11 Nov (item 48) with no study behind it. The study
`research/edge/mcycle-base/` ran the live rule as the Trader runs it (council/mosha-cycle.mjs and the engine's
`msAnalyze`, imported unchanged; OANDA gold M5 / M15 / H1 / H4 from 2020; $0.30 round trip and financing on buys;
pre-registered before any candle was read):

| | n | R a trade after costs | t (calendar months) | worst drawdown |
|---|---|---|---|---|
| 2020 → 12 Nov 2026 | 115 | −0.574 | −3.99 | 66.0R |
| 2020-23 | 64 | −0.523 | −2.58 | 33.5R |
| 2024 → now | 51 | −0.638 | −3.16 | 32.6R |

- Both legs lose (pullback leg −0.756R, main leg −0.466R); every year 2020-26 is negative; win rate 16.5 %, profit factor
  0.34. Before costs it is still −0.514R a trade: the rule itself loses, not the costs.
- This is a clear negative, not "too few to judge": t −3.99 on 82 months, in both halves.

## Recommendation
Make `mcycle` a paper shadow again, the way the five systems of item 37 were: an owner rule adding `mcycle` to
`config.ownerShadow`. Its block already reads that setting (`cycleBlockers`, pull request #780). New trades would be
recorded as `shadow: true, blockedBy ['owner-shadow']`, no alerts, no futures ticket, the shadow book's demo account; a
trade already open stays live to its own exit with its stop. The live paper book would be Gold trend + Gold daily engulf
again.

## What it does not change
The owner's own Mosha trading and Luxus's lessons are not judged by this (the rule is the desk's mechanical reading of the
cycle, not anyone's discretion). The chart's Mosha layer stays (display only).

## If the owner says no
Nothing changes; the study stays on record and the forward record keeps running against a −0.57R a trade backtest.
