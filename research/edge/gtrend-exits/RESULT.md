# Gold trend exits and re-entries: 12 variants against the live chandelier, untouched 2006–17 (8 Nov 2026)

**Verdict: FAIL / keep the live exit.** No exit or re-entry variant beats the live chandelier on the untouched 2006–17 window at x1 and x2 costs and then confirms on 2018–26. One of 24 comparisons (`C1` = 3 ATR trail + break-even at +1R, on the fast N5 leg) cleared the untouched window, by a hair on return/drawdown (4.25 against 4.13), and was not confirmed: it made less than live on 2018–26 (+90.3R against +96.7R). The honest difference against live is noise: monthly t 0.4, P(≤ 0) 0.35.

**Question.** Gold trend (`gtrend`, N20, live) and Gold trend fast (`gtrend5`, N5, shadow) are the council's two systems with the best honest out-of-sample edge (#530: +0.49R and +0.37R a position on 2006–17, t 1.8 / 1.9). Their exit is a chandelier: stop 2 ATR under the entry, lifted to (daily close − 2 ATR) on every closed day, one add at +1R with the same stop, no target, no time limit, immediate re-entry on the next qualifying close. Can the **exit and re-entry side** be improved robustly, with the entry and the initial 2 ATR stop left exactly as live? The grid, windows, costs and bar were pre-registered and pushed before any variant ran (`preregistration.md`, commit 5f702e8e).

## Key table (net R a position, x1 = $0.60 a unit round trip; OOS = untouched 2006-07 to 2017-12)

Bar (pre-registered): a variant beats live if, at **both** x1 and x2, its OOS total R and OOS return/DD are higher than live's, its total R is higher in both halves (H1 2006–11, H2 2012–17) and its mean is positive everywhere; it is then confirmed only if its 2018–26 total R and return/DD are also higher than live's at both cost levels.

### Gold trend N20 (`gtrend`)

| Variant | OOS n | R a pos | Total R | t | Max DD | Return/DD | x2 total / ret-DD | H1 total | H2 total | 2018–26 total / ret-DD (x1) | Beats OOS | Confirmed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **live** (2 ATR chandelier, add +1R) | 75 | +0.47 | **+35.4** | 1.72 | −5.5 | **6.5** | +32.8 / 5.8 | +25.6 | +9.8 | **+78.2 / 20.2** | — | — |
| T1.5 (1.5 ATR trail) | 97 | +0.18 | +17.2 | 0.87 | −7.8 | 2.2 | +13.9 / 1.7 | +18.3 | −1.1 | +41.7 / 4.6 | no | — |
| T3 (3 ATR trail) | 60 | +0.62 | +37.2 | 1.45 | −7.2 | 5.2 | +35.3 / 4.8 | +28.7 | +8.5 | +73.1 / 16.7 | no | — |
| T4 (4 ATR trail) | 52 | +0.67 | +34.6 | 1.42 | −9.2 | 3.8 | +33.0 / 3.5 | +31.0 | +3.6 | +61.5 / 12.3 | no | — |
| TL10 (10-day low) | 66 | +0.33 | +21.6 | 1.30 | −7.2 | 3.0 | +19.6 / 2.6 | +13.8 | +7.8 | +35.5 / 5.4 | no | — |
| TL20 (20-day low) | 53 | +0.52 | +27.7 | 1.24 | −8.8 | 3.2 | +26.1 / 2.9 | +21.8 | +6.0 | +53.7 / 7.5 | no | — |
| S20 (time stop 20 days) | 85 | +0.36 | +30.3 | 1.77 | −5.5 | 5.6 | +27.5 / 4.9 | +20.4 | +9.9 | +66.6 / 17.2 | no | — |
| S40 (time stop 40 days) | 76 | +0.45 | +34.0 | 1.75 | −5.5 | 6.2 | +31.4 / 5.6 | +24.2 | +9.8 | +80.1 / 20.7 | no | — |
| A0 (no add) | 75 | +0.35 | +26.3 | **2.03** | **−3.4** | **7.7** | +24.6 / 7.0 | +19.8 | +6.5 | +44.8 / 13.1 | no (total R) | — |
| A2 (add at +2R) | 75 | +0.39 | +29.1 | 1.73 | −3.8 | 7.7 | +27.0 / 6.5 | +20.5 | +8.6 | +57.9 / 17.6 | no (total R) | — |
| BE1 (break-even at +1R) | 75 | +0.47 | +35.3 | 1.71 | −5.3 | 6.7 | +32.7 / 6.0 | +25.8 | +9.5 | +79.2 / 20.1 | no (total R) | — |
| RF (re-entry above the last peak) | 20 | +1.12 | +22.3 | 1.72 | −2.1 | 10.4 | +21.6 / 9.8 | +22.3 | 0 trades | +35.3 / 15.1 | no (no H2) | — |
| C1 (T3 + BE1) | 60 | +0.76 | **+45.6** | 1.60 | −7.1 | 6.4 | +43.6 / 5.9 | +35.2 | +10.4 | +82.6 / 19.6 | no (ret/DD 6.40 < 6.48 at x1) | — |

### Gold trend fast N5 (`gtrend5`)

| Variant | OOS n | R a pos | Total R | t | Max DD | Return/DD | x2 total / ret-DD | H1 total | H2 total | 2018–26 total / ret-DD (x1) | Beats OOS | Confirmed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **live** | 129 | +0.36 | +46.1 | 1.85 | −11.2 | 4.1 | +42.2 / 3.5 | +35.4 | +10.8 | **+96.7 / 12.7** | — | — |
| T1.5 | 163 | +0.15 | +24.3 | 1.01 | −16.5 | 1.5 | +19.2 / 1.1 | +22.3 | +2.0 | +58.1 / 5.5 | no | — |
| T3 | 95 | +0.52 | +48.9 | 1.71 | −13.5 | 3.6 | +46.3 / 3.3 | +36.4 | +12.6 | +83.7 / 14.5 | no | — |
| T4 | 78 | +0.60 | +46.9 | 1.73 | −15.1 | 3.1 | +44.8 / 2.9 | +43.7 | +3.2 | +70.2 / 11.4 | no | — |
| TL10 | 115 | +0.23 | +26.6 | 1.37 | −10.3 | 2.6 | +23.7 / 2.1 | +18.9 | +7.7 | +50.7 / 6.9 | no | — |
| TL20 | 82 | +0.52 | +42.6 | 1.69 | −15.2 | 2.8 | +40.5 / 2.6 | +38.4 | +4.2 | +60.6 / 8.4 | no | — |
| S20 | 149 | +0.31 | +46.5 | **2.09** | **−7.8** | **6.0** | +42.0 / 5.0 | +27.6 | +18.9 | +81.2 / 11.0 | no (H1, x2 total) | — |
| S40 | 130 | +0.34 | +44.4 | 1.89 | −11.2 | 4.0 | +40.5 / 3.4 | +33.6 | +10.8 | +90.2 / 11.8 | no | — |
| A0 | 129 | +0.24 | +31.1 | 2.00 | −10.5 | 3.0 | +28.5 / 2.5 | +26.3 | +4.8 | +50.4 / 6.6 | no | — |
| A2 | 129 | +0.27 | +34.7 | 1.62 | −12.2 | 2.9 | +31.4 / 2.5 | +30.4 | +4.3 | +76.7 / 10.1 | no | — |
| BE1 | 129 | +0.36 | +46.3 | 1.85 | −11.2 | 4.2 | +42.4 / 3.5 | +35.7 | +10.6 | +97.2 / 12.7 | no (H2) | — |
| RF | 20 | +1.12 | +22.3 | 1.72 | −2.1 | 10.4 | +21.6 / 9.8 | +22.3 | 0 trades | +35.3 / 15.1 | no (no H2) | — |
| **C1 (T3 + BE1)** | 95 | +0.59 | **+55.8** | 1.81 | −13.1 | 4.25 | +53.0 / 3.8 | +41.7 | +14.1 | +90.3 / 15.1 | **yes** | **no** (2018–26 total R 90.3 < 96.7, x1 and x2) |

Positive calendar years 2006–17: live 8/12 on both legs; C1 8/12 (N20) and 7/12 (N5); S20 9/12 on N5. Every variant stays positive at x2 on the full window; the losers against live are the tight trail (T1.5), the Donchian lows (TL10, TL20) and the 4 ATR trail on H2.

## What the grid says

- **Nothing beats the live exit robustly.** 23 of 24 comparisons miss the untouched-window bar outright; the one that clears it, `C1` on N5, clears return/DD by 0.12 and is then beaten by live on 2018–26. The difference it makes month by month (+9.7R over 138 months) has t 0.39 and a block-bootstrap P(≤ 0) of 0.35. At N20, `C1` also makes more total R (+45.6 against +35.4) but misses return/DD by 0.08 at x1 (6.40 against 6.48). These are two readings of the same noise: a wider trail gives back more of each run, so it wins big years (2007, 2009, 2011, 2019) and loses the whipsaw years (2008, 2010, 2015). It is not an improvement; it is a different bet on the same trend.
- **The trail width is a return-for-drawdown trade-off, not an edge.** Tighter (1.5 ATR, 10-day low) cuts total R by 40–50% on both legs and in both windows. Wider (3–4 ATR, 20-day low) keeps about the same or less total R with a deeper drawdown (−7 to −15R against −5.5 / −11.2R). Out of sample the 2 ATR chandelier has the best return/drawdown of the pure trail variants on both legs; in the confirmation window the 3 ATR trail does better on N5 (14.5 against 12.7) and worse on N20 (16.7 against 20.2).
- **The add is what #530 said it was.** No add (`A0`) has the best t on both legs (2.03 / 2.00) and the shallowest drawdown at N20 (−3.4R), but a quarter to a third less total R; add at +2R (`A2`) sits between. The pre-registered bar asked for more total R *and* a better return/drawdown, and the add trade-off cannot deliver both. The owner may still prefer `A0` as a lower-variance sleeve, but that is a sizing choice, not an edge; this study does not propose it.
- **A 20-day time stop helps the fast leg's drawdown and nothing else.** `S20` on N5: t 2.09, drawdown −7.8R against −11.2R, return/DD 6.0 against 4.1, and the best H2 of any variant (+18.9R). It misses the bar on H1 (−7.8R against live) and makes less at x2; on N20 it loses 5R of total. It also sells the 2011 and 2025 runs after 20 days. It is the one idea worth re-testing if the fast leg is ever promoted, on data after this study.
- **Break-even at +1R changes almost nothing.** A position that closes a day ≥ +1R above the entry has the chandelier already near or above the entry most of the time: −0.1R total at N20, +0.2R at N5 over 11.5 years, the same number of positions.
- **The fresh-high re-entry (`RF`) is a dead rule as written.** Requiring the signal close to exceed the stopped position's peak made 20 positions in 11.5 years and none from Aug 2011 (peak $1,912) to Jul 2020, when gold first closed above that peak again. Both legs collapse to the same 20 positions because the barrier dominates the N-day high. Its +1.12R a position and 10.4 return/DD describe 20 trades in two bull markets, not a re-entry rule. The live rule's immediate re-entry is the better one of the two tested.
- **24 comparisons, one chance clearance before confirmation**: consistent with no true improvement, which is what the confirmation window then says.

## Calibration gate (read before any variant number)

The `live` variant at #530's cost ($0.30 a unit) reproduces `research/edge/gold-systems-oos/result.json` exactly, both legs, four windows:

| Leg | Window | #530 n / R a pos / t / max DD | This replay |
|---|---|---|---|
| gtrend | OOS 2006–17 | 75 / +0.489 / 1.77 / −5.38 | 75 / +0.489 / 1.77 / −5.38 |
| gtrend | H1 / H2 | 46 / +0.574 / 1.47 ; 29 / +0.353 / 0.99 | identical |
| gtrend | 2018–26 | 59 / +1.336 / 2.48 / −3.81 | identical |
| gtrend5 | OOS 2006–17 | 129 / +0.372 / 1.92 / −10.75 | 129 / +0.372 / 1.92 / −10.75 |
| gtrend5 | H1 / H2 | 67 / +0.544 / 1.73 ; 62 / +0.187 / 0.86 | identical |
| gtrend5 | 2018–26 | 99 / +0.986 / 2.64 / −7.51 | identical |

`run.mjs` refuses to write a result when the gate fails. At this study's x1 cost ($0.60: the fills.mjs model with half a spread of slippage on the market entry and on the stop exit) the live figures become +0.47R / +0.36R a position, which is the line every variant is measured against.

## Method

- **Data.** OANDA XAU/USD mid candles through the site's `/md/bars` proxy (`research/edge/gold-systems-oos/fetch.mjs`, the 2017–26 cache reused, 2006–16 fetched): 1,471,794 M5 and 6,481 D1 candles, 2006-03-19 to 2026-11-06, UTC buckets with the Sunday stub, as live. Kept out of git.
- **Harness.** `run.mjs` is `gold-systems-oos/replay.mjs` restricted to the two trend legs, with the variant hooks in the daily ratchet, the add and the entry check: one run 4 minutes after every M5 close, 719 closed daily candles a window, a market entry at the close of the M5 candle the run falls in, a daily signal valid for 24 h, stops on M5 candles with `stopFill` / `exitR` / `spotSkip` from `council/fills.mjs`, the daily ratchet after management. Each leg and variant is its own book; the entry rule and the initial 2 ATR stop never change.
- **Variants** exactly as pre-registered: `T1.5` / `T3` / `T4` ratchet to (close − k ATR14); `TL10` / `TL20` ratchet to the lowest low of the last 10 / 20 closed days; `S20` / `S40` exit both units at market on the first run after the 20th / 40th closed day since entry; `A0` no add, `A2` add at +2R; `BE1` lifts the shared stop to the first entry once a closed day is ≥ +1R; `RF` needs the signal close above the stopped position's peak; `C1` = `T3` + `BE1`. The stop only rises in every variant.
- **Costs.** `spreadOf` for spot ($0.30) plus `SLIP_SPREADS` (0.5 spread) on the market entry and on the exit, none of which is a resting target: x1 = $0.60 a unit round trip, x2 = $1.20, charged on the first unit and on the add. Gross and the #530 cost are in `result.json`.
- **Statistics.** Positions (first unit + add) dated by entry; n, win%, mean, total, t, worst drawdown on the closed-position equity curve, return/DD, per window and per year; exits by kind; median days held; monthly difference against live over the 138 OOS months with t and a 10,000-resample block bootstrap. The bar is applied mechanically (`bar.tests`, `bar.missed` per variant in `result.json`).
- **Post-hoc remarks** (diagnostics, not part of the verdict): the reading of `RF` as a dead rule, and the note that `S20` on N5 is worth a later re-test. No variant was added or changed after the results.

## Files

- `preregistration.md`: grid, windows, costs, bar, committed before any variant ran.
- `run.mjs`: the replay, the gate, the statistics and the bar. Writes `result.json`.
- `result.json`: gate, every variant's periods, years, exits, bar tests, monthly difference against live, and the live positions per leg.

## Reproduce

```
export SCR=<scratch dir>
CANDLES_IN=<gold-systems-oos candle cache, optional> node research/edge/gold-systems-oos/fetch.mjs $SCR/candles   # ~2 min for 2006-16
CANDLES=$SCR/candles node research/edge/gtrend-exits/run.mjs > research/edge/gtrend-exits/result.json              # ~20 s
```

No live rule, config, trader, replay or site code was changed. Paper research only.
