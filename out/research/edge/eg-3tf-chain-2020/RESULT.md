# The three-timeframe engulf chain, 2020 to now: result (23 Nov 2026)

**Verdict: FAIL. After costs 0 of 6 pass and all six lose in the confirmation window; the best, T2 (D1 / H4 / H1, roadblock target), made −0.183R a trade (n 2880, month t −1.31).**

Before costs (a second verdict, asked for by the owner after the pre-registration): **INCONCLUSIVE**. 0 of 6 pass; the two D1 / H4 / H1 tests are positive in both windows but under the t bar (best T2: +0.093R a trade before costs, n 2880, month t 1.80, Holm p 0.2422); the four lower chains lose before costs. Nothing is an edge.

Pre-registered in PREREGISTRATION.md (committed before any trade was computed). Trades = the Engulfing desk code `council/eg-methods.mjs` `sopTrades3` (imported, not edited), run again on 5-minute candles with the close-based cut on the confirmation timeframe (`run.mjs` `withCut`). 18 markets pooled, OANDA mid 5m (edgekit cache), fills 2020-01-01 to 22 Nov 2026; discovery 2020-2023, confirmation 2024 on. t on calendar-month sums of R by fill month (empty months 0). Costs: `combo-grid-2` round trips in R of each trade's own risk; data-quality exclusions applied.

## Before costs (the owner's question: read this first)

| Test | discovery n | R a trade | month t | confirmation n | R a trade | month t | Holm p | verdict before costs |
|---|---|---|---|---|---|---|---|---|
| T1 D1 / H4 / H1, 2R | 4181 | +0.005 | 0.30 | 2892 | +0.013 | 0.52 | 1 | INCONCLUSIVE |
| T2 D1 / H4 / H1, roadblock | 4092 | +0.017 | 0.68 | 2880 | +0.093 | 1.80 | 0.2422 | INCONCLUSIVE |
| T3 H4 / H1 / M15, 2R | 15217 | −0.039 | −5.41 | 10751 | −0.027 | −2.06 | 1 | FAIL |
| T4 H4 / H1 / M15, roadblock | 15159 | −0.024 | −1.87 | 10863 | −0.020 | −1.09 | 1 | FAIL |
| T5 H1 / M15 / M5, 2R | 60539 | −0.046 | −10.43 | 42068 | −0.041 | −6.07 | 1 | FAIL |
| T6 H1 / M15 / M5, roadblock | 62071 | −0.026 | −4.20 | 42987 | −0.004 | −0.44 | 1 | FAIL |

Same bar as the pre-registration (discovery n >= 100, mean > 0, month t >= 2; confirmation n >= 50, mean > 0, month t >= 2, Holm p < 0.05 over these six), the twice-the-cost clause dropped (it has no meaning before costs). Not pre-registered: a second, labelled verdict only.

## After costs (the pre-registered verdict)

| Test | discovery n | R a trade | month t | confirmation n | R a trade | month t | at 2x costs | Holm p | verdict |
|---|---|---|---|---|---|---|---|---|---|
| T1 D1 / H4 / H1, 2R | 4181 | −0.115 | −6.07 | 2892 | −0.290 | −2.31 | −0.593 | 1 | FAIL |
| T2 D1 / H4 / H1, roadblock | 4092 | −0.106 | −3.94 | 2880 | −0.183 | −1.31 | −0.459 | 1 | FAIL |
| T3 H4 / H1 / M15, 2R | 15217 | −0.233 | −18.54 | 10751 | −0.241 | −9.17 | −0.456 | 1 | FAIL |
| T4 H4 / H1 / M15, roadblock | 15159 | −0.217 | −13.13 | 10863 | −0.226 | −8.88 | −0.432 | 1 | FAIL |
| T5 H1 / M15 / M5, 2R | 60539 | −0.473 | −13.42 | 42068 | −0.420 | −9.41 | −0.798 | 1 | FAIL |
| T6 H1 / M15 / M5, roadblock | 62071 | −0.490 | −9.98 | 42987 | −0.341 | −18.39 | −0.678 | 1 | FAIL |

## Reported only, never a verdict (confirmation window unless said)

| Test | cut ends | desk reading without the cut, before costs | after costs | median cost a trade | risk within 30 pips | buys / sells after costs |
|---|---|---|---|---|---|---|
| T1 | 47 % | +0.034R (t 1.21) | −0.269R | 0.039R | 63 % | −0.256 / −0.326 |
| T2 | 47 % | +0.086R (t 1.53) | −0.191R | 0.039R | 62 % | −0.188 / −0.178 |
| T3 | 54 % | −0.013R (t −0.79) | −0.227R | 0.073R | 84 % | −0.259 / −0.225 |
| T4 | 54 % | −0.007R (t −0.38) | −0.213R | 0.072R | 84 % | −0.242 / −0.210 |
| T5 | 55 % | −0.027R (t −3.87) | −0.405R | 0.139R | 94 % | −0.415 / −0.425 |
| T6 | 54 % | +0.015R (t 1.34) | −0.322R | 0.139R | 94 % | −0.304 / −0.379 |

- Roadblock targets that fell back to 2R (no opposite zone 1R or more ahead): T2 9 %, T4 13 %, T6 10 %. The owner's notes would skip a trade whose nearest roadblock is under 2R; the trades whose nearest zone is 2R or more away: T2 n 905, +0.188R before costs, −0.583R after; T4 n 2737, −0.025R before costs, −0.568R after; T6 n 9062, +0.066R before costs, −0.868R after.
- **Odd in the data: the desk code has no minimum stop.** The median cost is 0.04-0.14R a trade, but a tail of trades with a stop of a few points carries costs of several R (p99 1.2R on D1 / H4 / H1, 2.9R on H1 / M15 / M5, the largest about 1,800R), so the mean after costs is far below the median. The same tiny stops give the roadblock tests their largest winners (up to 176R before costs): the before-costs mean of T2 (+0.093R) falls to about +0.03R when only trades whose cost is at most 0.25R are kept (94 % of them). Descriptive, not a test.
- Markets: the desk code sizes its stop buffer only for the markets it lists; for nzdusd, usdchf, eurjpy, gbpjpy, eurgbp, audjpy, cadjpy, euraud it was called with the key `eurusd` (the same share-of-price buffer; without it gold's $0.30 would have been used in their price units).
- Per market (result.json `tests[].markets`, before and after costs): no market is positive in both windows with month t >= 2 before costs in any test; single-window t over 2 (T1: USD/CAD confirmation, AUD/JPY discovery; T2: CAD/JPY confirmation) flip or vanish in the other window.
- No look-ahead: with every candle after a cut removed (gold, cut 15 Jun 2023; EUR/JPY, cut 10 Mar 2025), every trade of both targets that ended before the cut is the same, and so is its cut outcome (xau: 4692 + 4787 trades, 0 differ; eurjpy: 7046 + 7190 trades, 0 differ).

## Where the owner's notes differ from the desk code (recorded, not tested)

The notes chain M15 / M5 / M1 (not in the cache) where the desk has H4 / H1 / M15; they also mark failed (EF) and two-candle zones; they want a sideways approach to the zone and the second engulf closing inside it; they cap the risk at 20-30 pips with at least 2R to the target (here 63-94 % of trades are within 30 pips, depending on the chain) and skip a roadblock under 2R; they take partials at several roadblocks; a zone lives until a close through it. None of these is in the desk code, and none was tried after the result.

## What it means

The desk's reading of the three-timeframe engulf chain is not an edge on 2020-2026 over 18 markets: the lower two chains lose before costs, and the Daily chain is within 0.1R of zero before costs with month t under 2 (and its roadblock figure leans on a tail of tiny stops), which the costs of its small stops turn into a loss. The close-based cut ends about half the trades early and changes little against the desk's plain stop. Do not re-test variants on these years; a follow-up (the notes' sideways and pip-cap filters, say) needs its own pre-registration on other data.
