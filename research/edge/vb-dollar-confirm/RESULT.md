# Gold and USD/JPY breakouts, split by the other's earlier fill (vb-dollar-confirm, 24 Nov 2026)

**Verdict: FAIL, 0 of 4: confirmation 2016 → 2026-11-20, gold agree +0.049R a trade (n 593) vs disagree +0.014R (n 315, Welch t +0.43) vs none +0.154R (n 1152); USD/JPY agree +0.107R (n 444) vs disagree +0.000R (n 212, t +1.11) vs none +0.061R (n 1424)**

Paper research only. Rule, groups, costs, windows and bar were fixed in `PREREGISTRATION.md` (committed alone first; sha256 in `result.json`). Nothing live changed; the two forward records and the Equinox desks run on unchanged. This page is written by `run.mjs` from `result.json`.

Groups for a trade of one market: **agree** = the other market's T1 filled earlier that UTC day the dollar-consistent way (gold up with USD/JPY down, or gold down with USD/JPY up); **disagree** = it filled earlier the other way; **none** = no earlier fill (later, the same 5-minute candle, or no trade). Only the other trade's fill time and side are read, never its result.

## Groups (net R a trade after each desk's cost; month t on calendar-month sums)

| Market | Window | All n / net | Agree n | Agree net | Agree gross | Agree 2x cost | Agree month t | Disagree n | Disagree net | None n | None net | Mean fill hour UTC (agree / disagree / none) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gold | discovery 2007-2015 | 1657 / +0.188 | 444 | +0.169 | +0.183 | +0.155 | +3.05 | 358 | +0.065 | 855 | +0.249 | 11.61 / 11.89 / 9.42 |
| gold | confirmation 2016-2026-11-20 | 2060 / +0.102 | 593 | +0.049 | +0.065 | +0.032 | +1.04 | 315 | +0.014 | 1152 | +0.154 | 10.84 / 11.97 / 8.75 |
| USD/JPY | discovery 2007-2015 | 1711 / +0.079 | 258 | +0.062 | +0.089 | +0.035 | +0.84 | 201 | −0.016 | 1252 | +0.098 | 12.19 / 12.05 / 7.27 |
| USD/JPY | confirmation 2016-2026-11-20 | 2080 / +0.064 | 444 | +0.107 | +0.136 | +0.078 | +2.13 | 212 | +0.000 | 1424 | +0.061 | 11.77 / 12.31 / 7.01 |

## The four tests

| Test | Comparison | Discovery diff (Welch t) | Confirmation diff (Welch t) | p (two-sided) | Holm p | Better group | Same sign | Welch ≥ 2 | Holm < 0.05 | Better > 0 both | Better month t ≥ 2 | n ≥ 200 | 2x cost > 0 | Placebos beaten | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | gold: agree − disagree | +0.104 (+1.14) | +0.035 (+0.43) | 0.667 | 0.909 | agree | yes | no | no | yes | no | yes | yes | 5 of 40 | FAIL |
| T2 | gold: agree − none | −0.080 (−0.99) | −0.105 (−1.67) | 0.095 | 0.38 | none | yes | no | no | yes | yes | yes | yes | 40 of 40 | FAIL |
| T3 | USD/JPY: agree − disagree | +0.078 (+0.75) | +0.107 (+1.11) | 0.266 | 0.798 | agree | yes | no | no | yes | yes | yes | yes | 34 of 40 | FAIL |
| T4 | USD/JPY: agree − none | −0.036 (−0.44) | +0.046 (+0.75) | 0.454 | 0.909 | agree | no | no | no | yes | yes | yes | yes | 34 of 40 | FAIL |

## In plain words

T1 (gold, agree − disagree): discovery +0.104R (Welch t +1.14), confirmation +0.035R (t +0.43, Holm p 0.909); FAIL, lines not met: welch2, holm, keptT2, placebo38. T2 (gold, agree − none): discovery −0.080R (Welch t −0.99), confirmation −0.105R (t −1.67, Holm p 0.38); FAIL, lines not met: welch2, holm. T3 (USD/JPY, agree − disagree): discovery +0.078R (Welch t +0.75), confirmation +0.107R (t +1.11, Holm p 0.798); FAIL, lines not met: welch2, holm, placebo38. T4 (USD/JPY, agree − none): discovery −0.036R (Welch t −0.44), confirmation +0.046R (t +0.75, Holm p 0.909); FAIL, lines not met: sameSign, welch2, holm, placebo38. The groups split trades that the base rules already take; a profitable group says nothing by itself, only the difference between groups does. Gold's "none" group (no earlier USD/JPY fill) fills earliest (mean 8.75 h UTC in confirmation against 10.84 h for agree) and did best in both windows (+0.249R and +0.154R a trade): the earlier-fill pattern holdout-vb-early already reported, not a dollar confirmation (T2's difference is not significant). A dollar-consistent earlier fill did not make either breakout measurably better.

## Within fill-hour blocks (confirmation; agree − comparison, net R, Welch t)

| Test | 00-06 UTC | 06-12 UTC | 12-21 UTC |
|---|---|---|---|
| T1 | +0.003 (+0.01; n 98 / 37) | +0.078 (+0.46; n 199 / 89) | +0.016 (+0.18; n 296 / 189) |
| T2 | −0.307 (−1.77; n 98 / 356) | −0.047 (−0.43; n 199 / 401) | +0.038 (+0.53; n 296 / 395) |
| T3 | −0.534 (−0.63; n 52 / 15) | +0.147 (+0.92; n 132 / 60) | +0.146 (+1.63; n 260 / 137) |
| T4 | +0.150 (+0.66; n 52 / 647) | +0.085 (+0.84; n 132 / 460) | +0.045 (+0.58; n 260 / 317) |

## Harness gate (unconditioned rules against the published results)

| Source | Window | Published n / net | Here n / net | Within 2 % and 0.01R |
|---|---|---|---|---|
| gold-vol-breakout-hourcost C1 W1 | 2007-01-01 → 2011-12-31 | 929 / +0.202 | 929 / +0.202 | yes |
| gold-vol-breakout-hourcost C1 W2 | 2012-01-01 → 2015-12-31 | 728 / +0.170 | 728 / +0.170 | yes |
| gold-vol-breakout-hourcost C1 W3 | 2016-01-01 → 2020-12-31 | 935 / +0.094 | 935 / +0.094 | yes |
| gold-vol-breakout-hourcost C1 W4 | 2021-01-01 → 2026-11-12 | 1121 / +0.105 | 1121 / +0.105 | yes |
| usdjpy-vol-breakout-early 2005-2015 | 2005-01-04 → 2015-12-31 | 2089 / +0.079 | 2089 / +0.079 | yes |
| fx-vol-breakout usdjpy 2016-2020 | 2016-01-01 → 2020-12-31 | 955 / +0.036 | 955 / +0.036 | yes |
| fx-vol-breakout usdjpy 2021 on | 2021-01-01 → 2026-11-19 | 1124 / +0.087 | 1124 / +0.087 | yes |

## What this does NOT show

- It does not re-test the breakouts: both rules were read on every year used here. Only the split by the other market's earlier fill is new.
- A trade can only be "agree" or "disagree" after the other market filled, so those groups fill later in the day than "none" by construction; the fill-hour table is there to separate that from a dollar effect.
- Costs: gold at the demo's measured 2026 hourly spreads and commission (slippage assumed), USD/JPY at the measured commission plus an assumed 0.5 pip; both charged on every year. OANDA mid candles, not broker ticks.
- Nothing here is an edge on its own and nothing live changes; a before-cost tilt is not an edge.

## Data and method

- gold 3861 T1 trades 2006-03-21 → 2026-11-20, USD/JPY 4169 T1 trades 2005-01-04 → 2026-11-20; the shared toolkit's OANDA mid M5 cache, the last day on file left out.
- Gold T1 built with the pinned hourcost copies (vbTrade k 0.5, both sides, out at 20:55 UTC), charged route C1 (measured hourly half-spreads at the fill hour and hour 20 + commission 0.000024 of price + 0.05 x the M5 median range + financing on buys). USD/JPY T1 from usdjpy-vol-breakout-early trades (out 21:00 UTC), cost 0.000045 x entry + 0.5 pip. Matched by UTC day; the other trade counts only when its fill candle started strictly before this one's. Welch t two-sided, normal p; Holm over T1-T4 on the confirmation p. Month t on calendar months with a trade. Placebo: 40 seeded random subsets of the market's confirmation trades of the better group's size.
- To repeat: `node research/edge/vb-dollar-confirm/run.mjs` (reads the toolkit cache at EDGE_DATA, kept out of git).

