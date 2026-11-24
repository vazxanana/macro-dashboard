# The breakouts split by the previous day's close location (vb-prior-close, 24 Nov 2026)

**Verdict: FAIL: T3 gold + USD/JPY pooled: confirmation with +0.067R (n 1537) vs against +0.005R (n 1507), difference +0.062R (Welch t +1.43, paired month t +1.76); discovery difference −0.035R (t −0.68)**

Paper research only. Rule, split, costs, windows and bar were fixed in `PREREGISTRATION.md` (committed alone first; sha256 in `result.json`). Nothing live changed; no filter is adopted; the two breakouts' forward records stay the judge. Written by `run.mjs` from `result.json`.

"With the close" = a buy after the previous UTC day (weekend folded) closed in the top third of its range, or a sell after a bottom-third close; "against" = the opposite. Net R after costs (gold: measured hourly route C1; USD/JPY: 0.000045 × entry + 0.5 pip). Month t = calendar-month sums.

## The table

| Test | Window | All n / net | With n / net / gross / month t | Against n / net / gross / month t | Middle n / net | With − against net (Welch t) | Gross diff (Welch t) | Paired month t (months) | Control: share of 1,000 relabellings beaten (95th pct) |
|---|---|---|---|---|---|---|---|---|---|
| T1 gold | discovery 2005-2014 | 1611 / +0.189 | 598 / +0.134 / +0.150 / +2.83 | 485 / +0.154 / +0.168 / +2.64 | 528 / +0.283 | −0.020 (−0.24) | −0.018 (−0.22) | −0.06 (105) | 0.333 (+0.164) |
| T1 gold | confirmation 2015 → 2026-11-21 | 2250 / +0.098 | 754 / +0.073 / +0.089 / +1.58 | 734 / +0.067 / +0.083 / +1.46 | 762 / +0.153 | +0.006 (+0.09) | +0.006 (+0.09) | +0.45 (141) | 0.555 (+0.107) |
| T2 USD/JPY | discovery 2005-2014 | 1894 / +0.092 | 662 / +0.019 / +0.047 / +0.44 | 647 / +0.075 / +0.102 / +1.60 | 585 / +0.195 | −0.056 (−0.84) | −0.055 (−0.82) | −0.87 (119) | 0.145 (+0.134) |
| T2 USD/JPY | confirmation 2015 → 2026-11-21 | 2275 / +0.055 | 783 / +0.061 / +0.091 / +1.39 | 773 / −0.054 / −0.024 / −1.25 | 719 / +0.165 | +0.115 (+1.95) | +0.115 (+1.95) | +2.11 (143) | 0.915 (+0.133) |
| T3 gold + USD/JPY pooled | discovery 2005-2014 | 3505 / +0.137 | 1260 / +0.073 / +0.096 / +2.28 | 1132 / +0.109 / +0.130 / +2.75 | 1113 / +0.237 | −0.035 (−0.68) | −0.034 (−0.66) | −0.43 (120) | 0.189 (+0.112) |
| T3 gold + USD/JPY pooled | confirmation 2015 → 2026-11-21 | 4525 / +0.076 | 1537 / +0.067 / +0.090 / +1.97 | 1507 / +0.005 / +0.028 / +0.15 | 1481 / +0.159 | +0.062 (+1.43) | +0.062 (+1.43) | +1.76 (143) | 0.865 (+0.089) |

## The bar (confirmation unless named)

| Test | p | Holm p | Diff > 0 both windows | Welch t ≥ 2 and Holm < 0.05 | Paired month t ≥ 2 | n ≥ 200 each | With net > 0 both windows | Beats 95 % of relabellings | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 0.463 | 0.463 | no | no | no | yes | yes | no | FAIL |
| T2 | 0.026 | 0.077 | no | no | yes | yes | yes | no | FAIL |
| T3 | 0.077 | 0.153 | no | no | no | yes | yes | no | FAIL |

## Sides inside the groups (confirmation)

- T1 gold: with = 429 buys + 325 sells; against = 328 buys + 406 sells.
- T2 USD/JPY: with = 444 buys + 339 sells; against = 313 buys + 460 sells.
- T3 gold + USD/JPY pooled: with = 873 buys + 664 sells; against = 641 buys + 866 sells.

## In plain words

T3 pooled (the decision): FAIL (items not met: diffBoth, welch2Holm, pairedMonthT2, control95). T1 gold: FAIL (not met: diffBoth, welch2Holm, pairedMonthT2, control95). T2 USD/JPY: FAIL (not met: diffBoth, welch2Holm, control95). T1 gold: confirmation with +0.073R (n 754) vs against +0.067R (n 734), difference +0.006R (Welch t +0.09, paired month t +0.45); discovery difference −0.020R (t −0.24). T2 USD/JPY: confirmation with +0.061R (n 783) vs against −0.054R (n 773), difference +0.115R (Welch t +1.95, paired month t +2.11); discovery difference −0.056R (t −0.84). A split that does not hold in both windows and against the relabelling control is not a filter; the breakouts stay as they are.

## What this does NOT show

- It reads one fixed split (thirds of the previous UTC day, weekend folded). Quartiles, 0.5, a New York day or the close location of a longer window are not tested, and trying them now on these trades would be a search.
- Gold is charged today's measured relative spread on every year; USD/JPY today's demo commission and an allowance. Older spreads were wider.
- OANDA mid candles, not broker ticks. The breakouts themselves are not re-tested; only the split is new.

- Middle-third days averaged more than either group in every row; that was not a pre-registered test and is reported only (a post-hoc look, not a finding).

## Data

- OANDA mid M5 (toolkit cache): xau 2006-03-19 → 2026-11-21, 3861 T1 trades; usdjpy 2005-01-02 → 2026-11-21, 4169 T1 trades (last day on file left out).
- Harness gate: gold T1 2021-01-01 → 2026-11-12 under route C1 = n 1121, +0.105R (gold-vol-breakout-hourcost: n 1121, +0.105R): held.
- To repeat: `node research/edge/vb-prior-close/run.mjs` (toolkit cache at EDGE_DATA, out of git).

