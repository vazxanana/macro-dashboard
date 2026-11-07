# Does the ICT A-setup edge depend on the macro regime?

**Verdict: null result. No regime filter passes.** Neither pre-registered hypothesis holds. The A-setups made money in high
VIX, and they made money when credit spreads widened. No paper variant was added and no live rule changed.

One unplanned lead turned up: A-setups did worse when the dollar was bid (Dollar Smile **left or right** side). The test for
it was chosen after seeing the data, and even those trades do not lose at the Coach's bar. It is a lead for a future
pre-registered test, not a filter.

## Setup

- **Trades.** Every closed A-setup in council-data `ict/replay.json`, replay of 7 Nov 2026 20:36 UTC. That is 257 trades,
  +73.0R, +0.284R a trade, t 2.80. This is the same set the Coach's `ictVariantVerdicts` judges. The brief's "253 trades at
  +0.30R" came from an earlier copy of the replay.
- **Regime.** For each trade, `features()` and `drivers()` from `council/macro.mjs`, unchanged, on the UTC day of the signal:
  - Prices are the daily candles before that day, so the prior day's close.
  - FRED series are used only after macro.mjs's publication lag.
  - VIX and VIX3M use the prior day's close (lag 1 day, not 2), because Cboe posts the close the same evening. This was
    pre-registered.
- **Data.** Fetched with macro.mjs's own `gather()`.
  - **What could not be fetched here.** This sandbox blocks FRED `fredgraph.csv`, the Cboe VIX/VIX3M CSVs, the US Treasury
    curves, the ECB, the calendar and CFTC (proxy 403).
  - **What was used instead.** FRED values come from council-data `macro/cache.json`: the last 300 FRED rows that the Macro
    strategist itself fetched on GitHub Actions. VIX starts 9 Sep 2025, HY OAS 16 Sep 2025, rates and SOFR late Aug 2025.
  - **Prices.** Daily candles come from `meridianx.dev/md/bars` (OANDA), which answered.
  - **The gap.** The 15 A-setups from 4 Aug to 24 Sep 2025 have no VIX or HY 5-day change, so they are left out of every
    split (+0.159R a trade). The analysis covers 242 trades, +0.292R a trade, t 2.74.
  - **To cover those 15 trades,** re-run `analyse.mjs` on GitHub Actions, where FRED answers.
- **Pre-registration.** `preregistration.md` was committed before any split was computed. It holds the hypotheses, thresholds,
  pass bar and test count.

## Regime table (242 trades with regime data)

Halves are each cell's trades sorted by close time and split by count. "p" is one-sided, for mean R < 0. "Holm" is that p
adjusted over all 12 cells and hypotheses. "vs rest" is a Welch test of the cell against the other trades, with its Holm p
over the 10 cells.

| Split | Cell | n | R/trade | t | 1st half | 2nd half | p (R<0) | Holm | vs rest (t, Holm p) |
|---|---|---|---|---|---|---|---|---|---|
| VIX level | VIX ≥ 22 | 18 | +0.344 | 1.03 | +0.410 | +0.279 | 0.84 | 1 | +0.06 (0.16, 1) |
| | VIX < 22 | 224 | +0.288 | 2.57 | +0.285 | +0.290 | 0.99 | 1 | −0.06 (−0.16, 1) |
| VIX curve | inverted (VIX/VIX3M > 1) | 10 | −0.010 | −0.02 | +0.022 | −0.042 | 0.49 | 1 | −0.32 (−0.71, 1) |
| | normal | 232 | +0.305 | 2.79 | +0.331 | +0.278 | 1.00 | 1 | +0.32 (0.71, 1) |
| Dollar Smile | left (stress) | 39 | −0.185 | −1.10 | +0.084 | −0.441 | 0.14 | 1 | −0.57 (−2.74, 0.063) |
| | right (US outperformance) | 67 | −0.184 | −1.03 | −0.133 | −0.234 | 0.15 | 1 | −0.66 (−3.00, 0.030) |
| | trough (global growth) | 52 | +0.689 | 2.87 | +0.490 | +0.888 | 1.00 | 1 | +0.51 (1.89, 0.43) |
| | mid (transitional) | 84 | +0.647 | 3.22 | +0.617 | +0.677 | 1.00 | 1 | +0.54 (2.32, 0.18) |
| Credit stress | HY OAS +8bp or more in 5 days | 69 | +0.303 | 1.47 | +0.359 | +0.249 | 0.93 | 1 | +0.02 (0.07, 1) |
| | HY not widening | 173 | +0.287 | 2.31 | +0.282 | +0.293 | 0.99 | 1 | −0.02 (−0.07, 1) |

VIX on trade days ranged from 14.1 to 27.4 (median 16.9). VIX never reached 28, so the Smile's left side came almost
entirely from HY widening of 15bp or more in 5 days (36 of 39 trades). The other 3 came from SOFR−EFFR of 15bp or more.

## Pre-registered hypotheses (12 tests counted; Bonferroni over the 2 hypotheses, one-sided p ≤ 0.025)

| | Filter drops | Dropped n | Dropped R/trade | t | Halves | p | Holm | Kept | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| H1 | VIX ≥ 22 or VIX/VIX3M > 1 | 18 | +0.344 | 1.03 | +0.410 / +0.279 | 0.84 | 1 | n 224, +0.288 | **fail** |
| H2 | HY OAS +8bp or more in 5 days | 69 | +0.303 | 1.47 | +0.359 / +0.249 | 0.93 | 1 | n 173, +0.287 | **fail** |

Both fail every part of the Coach's bar (n ≥ 30 dropped, t ≤ −2, both halves negative). H1 even has too few trades. The
trades each filter would drop made more than the trades it keeps.

## Sensitivity: VIX at macro.mjs's 2-day lag

The hypotheses do not change: H1 drops 22 trades at +0.154R, and H2 is identical. One cell does change. The inverted-curve
cell shrinks to 4 trades, all losing (−0.44R, Holm 0.036). That is too few trades to mean anything, and it flips with a
one-day change in the lag (10 trades at −0.01R with lag 1). The Smile cells barely move.

## Exploratory lead (post hoc; not counted; cannot become a filter here)

After seeing the Smile cells, I grouped left and right together, the two sides where the dollar is bid:

- **Dollar bid (left or right):** n 106, −0.185R a trade, t −1.44. Halves −0.082 / −0.287.
- **Mid or trough:** n 136, +0.663R a trade, t 4.31.
- **Difference:** Welch t −4.2, uncorrected and chosen after looking.
- **By market (dollar bid vs the rest):**
  - NQ: −0.52 vs +0.88
  - GC: −0.35 vs +0.55
  - YM: −0.20 vs +0.38
  - ES: −0.00 vs +0.83
  - RTY: +0.16 vs +0.92

This lead fails the Coach's bar even as it stands, because the dollar-bid trades lose at t −1.44, not −2. It also comes from
one 14-month sample.

**Next step, if wanted:** pre-register "skip A-setups on the Smile's left or right side" and test it on the HistData
2018–2026 NQ/ES/GC proxies of `research/edge/ict-filters`, with full FRED history, on GitHub Actions. Alternatively, watch it
forward. Do not adopt it on this evidence.

## Files

- `preregistration.md`: the hypotheses, written before the splits.
- `analyse.mjs`: the study. Usage: `node research/edge/ict-macro/analyse.mjs <replay.json> <macro/cache.json> [outDir]`.
  Set `VIX_LAG=2` for the sensitivity check.
- `result.json`: every cell, the hypotheses, data sources and coverage.
- `trades.json`: the regime of each trade.
