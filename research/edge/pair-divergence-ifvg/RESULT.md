# Pair divergence at an H1 sweep, M15 inversion-gap entry (result)

**Verdict: FAIL. Best divergence cell "div 2R fx" made -0.044R a trade after costs in 2015-26 (n 1,597, month t -1.22; +0.002R before costs) and -0.041R in 2005-14 (n 1,457, month t -1.16); 0 of 12 cells pass.**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). EUR/USD with GBP/USD and gold with silver, OANDA mid
5-minute candles from the `edgekit` cache (M15 and H1 built from them), discovery 2005-2014, confirmation 2015 to October 2026,
`combo-grid-2` costs (silver ASSUMED) and data-quality exclusions. Judged after costs on calendar-month sums. Research only: nothing
live changed, no rule is proposed, and nothing of the ICT desk was read or used.

The rule, in short: an H1 candle trades through the market's last live H1 swing high (low) and closes back; "div" = the partner
market still has its own last swing high (low) and does not trade through it in the same three H1 candles; then, within 6 hours,
an M15 candle closes back through a three-candle gap of the leg that made the sweep; market entry against the sweep at the next
5-minute open, stop past the extreme plus one round trip, target 2R or the opposite H1 swing (1R or more away), 5-day limit.

## The 12 cells

R a trade; "gross" = before costs, "net" = after; t = t of calendar-month sums of net R; Holm over the 12 confirmation p values.

| Cell | n 05-14 | gross 05-14 | net 05-14 (t) | n 15-26 | gross 15-26 | net 15-26 (t) | win 15-26 | cost R | Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| div 2R fx | 1,457 | -0.008 | -0.041 (-1.16) | 1,597 | +0.002 | -0.044 (-1.22) | 34% | 0.046 | 0.223 | no |
| div 2R metals | 971 | +0.017 | -0.115 (-2.69) | 1,276 | -0.017 | -0.141 (-3.72) | 33% | 0.124 | 0.002 | no |
| div 2R pooled | 2,428 | +0.002 | -0.071 (-2.62) | 2,873 | -0.007 | -0.087 (-3.30) | 33% | 0.081 | 0.006 | no |
| div swing fx | 1,281 | -0.048 | -0.084 (-1.90) | 1,432 | -0.023 | -0.071 (-1.75) | 33% | 0.048 | 0.190 | no |
| div swing metals | 832 | -0.003 | -0.139 (-2.78) | 1,106 | -0.021 | -0.146 (-3.51) | 35% | 0.126 | 0.004 | no |
| div swing pooled | 2,113 | -0.030 | -0.105 (-3.20) | 2,538 | -0.022 | -0.104 (-3.43) | 34% | 0.082 | 0.005 | no |
| all 2R fx | 2,933 | +0.014 | -0.016 (-0.64) | 3,158 | -0.009 | -0.052 (-2.00) | 33% | 0.043 | 0.190 | no |
| all 2R metals | 2,125 | +0.007 | -0.120 (-3.97) | 2,737 | +0.003 | -0.115 (-4.36) | 34% | 0.118 | 0.000 | no |
| all 2R pooled | 5,058 | +0.011 | -0.060 (-3.28) | 5,895 | -0.003 | -0.081 (-4.19) | 34% | 0.078 | 0.000 | no |
| all swing fx | 2,598 | -0.049 | -0.081 (-2.53) | 2,856 | -0.013 | -0.057 (-1.96) | 33% | 0.045 | 0.190 | no |
| all swing metals | 1,853 | -0.033 | -0.164 (-4.74) | 2,409 | -0.007 | -0.128 (-4.20) | 35% | 0.120 | 0.000 | no |
| all swing pooled | 4,451 | -0.042 | -0.115 (-4.70) | 5,265 | -0.010 | -0.090 (-4.28) | 34% | 0.080 | 0.000 | no |

## With the divergence against without it

Not judged cells. "rest" = the same sweep and entry where the partner confirmed (traded through its own level in the window) or had
no live level; difference = div minus rest, net R a trade, Welch t on trades.

| Scope | Target | Window | div n | div net | conf n | conf net | nolevel n | nolevel net | div - rest (t) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| fx | 2R | 2005-14 | 1,457 | -0.041 | 739 | +0.042 | 737 | -0.025 | -0.050 (-0.96) |
| fx | 2R | 2015-26 | 1,597 | -0.044 | 747 | -0.042 | 814 | -0.075 | +0.015 (0.30) |
| fx | swing | 2005-14 | 1,281 | -0.084 | 648 | +0.005 | 669 | -0.158 | -0.006 (-0.09) |
| fx | swing | 2015-26 | 1,432 | -0.071 | 666 | -0.088 | 758 | -0.005 | -0.027 (-0.46) |
| metals | 2R | 2005-14 | 971 | -0.115 | 648 | -0.109 | 506 | -0.142 | +0.009 (0.14) |
| metals | 2R | 2015-26 | 1,276 | -0.141 | 762 | -0.134 | 699 | -0.046 | -0.049 (-0.91) |
| metals | swing | 2005-14 | 832 | -0.139 | 563 | -0.182 | 458 | -0.187 | +0.045 (0.66) |
| metals | swing | 2015-26 | 1,106 | -0.146 | 654 | -0.135 | 649 | -0.089 | -0.034 (-0.57) |
| pooled | 2R | 2005-14 | 2,428 | -0.071 | 1,387 | -0.029 | 1,243 | -0.073 | -0.021 (-0.54) |
| pooled | 2R | 2015-26 | 2,873 | -0.087 | 1,509 | -0.089 | 1,513 | -0.061 | -0.012 (-0.33) |
| pooled | swing | 2005-14 | 2,113 | -0.105 | 1,211 | -0.082 | 1,127 | -0.170 | +0.019 (0.42) |
| pooled | swing | 2015-26 | 2,538 | -0.104 | 1,320 | -0.111 | 1,407 | -0.044 | -0.027 (-0.65) |

## Per market

Net R a trade (month t); * = cost ASSUMED.

| Market | Target | div n 05-14 | div net (t) | div n 15-26 | div net (t) | all n 15-26 | all gross | all net (t) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| eurusd | 2R | 726 | -0.082 (-1.66) | 818 | +0.002 (0.04) | 1,623 | +0.024 | -0.019 (-0.57) |
| eurusd | swing | 640 | -0.162 (-2.65) | 733 | -0.018 (-0.33) | 1,464 | +0.007 | -0.038 (-0.99) |
| gbpusd | 2R | 731 | -0.001 (-0.01) | 779 | -0.092 (-1.81) | 1,535 | -0.043 | -0.086 (-2.41) |
| gbpusd | swing | 641 | -0.006 (-0.08) | 699 | -0.127 (-2.23) | 1,392 | -0.033 | -0.078 (-1.90) |
| xau | 2R | 538 | -0.134 (-2.33) | 663 | -0.133 (-2.48) | 1,450 | -0.009 | -0.074 (-2.01) |
| xau | swing | 467 | -0.150 (-2.28) | 588 | -0.139 (-2.51) | 1,294 | -0.040 | -0.107 (-2.71) |
| xag* | 2R | 433 | -0.091 (-1.24) | 613 | -0.149 (-2.82) | 1,287 | +0.017 | -0.161 (-4.63) |
| xag* | swing | 365 | -0.125 (-1.54) | 518 | -0.154 (-2.35) | 1,115 | +0.030 | -0.152 (-3.36) |

## Checks

- Cut test: 12 cuts on eurusd, gbpusd, xau, xag: 17,168 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under 3 round trips are no trades.

| Market | candles from | sweeps | no leg gap | cancelled | no inversion in 6 h | entries | trades | div | conf | nolevel | bad data | past the stop | risk under 3 costs | unresolved |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| eurusd | 2005-01-02 | 6,465 | 501 | 2,362 | 490 | 3,112 | 3,106 | 1,544 | 758 | 804 | 6 | 0 | 0 | 0 |
| gbpusd | 2005-01-02 | 6,382 | 451 | 2,462 | 477 | 2,992 | 2,985 | 1,510 | 728 | 747 | 5 | 0 | 1 | 1 |
| xau | 2006-03-19 | 5,598 | 416 | 2,122 | 475 | 2,585 | 2,578 | 1,201 | 751 | 626 | 0 | 0 | 7 | 0 |
| xag | 2006-03-19 | 5,741 | 372 | 2,118 | 497 | 2,754 | 2,284 | 1,046 | 659 | 579 | 7 | 0 | 463 | 0 |

## What it means

No divergence cell clears the bar. After costs the six divergence cells make -0.146 to -0.044R a trade in 2015-26 and
-0.139 to -0.041R in 2005-14; before costs -0.023 to +0.002R and -0.048 to +0.017R. The same sweep and entry
whatever the partner did makes -0.128 to -0.052R after costs in 2015-26. The partner condition does not pick the better
sweeps: the Welch t of "div minus the rest" runs from -0.96 to 0.66 over the twelve scope / target / window
comparisons. Not an edge and not a filter; do not re-test variants of these cells on these years. Nothing live changed; no rule
is proposed.

Limits: OANDA mid candles (no bid / ask at the entry); one swing definition (3 candles a side) and one gap definition; silver's
cost is assumed; trades of one market can overlap and the two markets of a pair are correlated, which the month sums absorb only
in part.
