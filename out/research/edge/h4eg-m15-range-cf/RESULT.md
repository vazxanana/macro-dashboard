# H4 engulf zone, then on M15 a break, a range at the extreme and a confirmation break back (result)

**Verdict: FAIL. 0 of 8 cells pass; the best cell, built touch 2R, made -0.049R a trade after costs in 2015-26 (n 8,855, month t -3.36; before costs -0.002R, t -0.17) and -0.022R after costs in 2005-14 (n 7,727, month t -1.33; before costs +0.020R, t 1.23).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, nothing
is proposed. One run, no variants.

## What was run

Key level: an H4 engulf zone (`combo-grid-3` `buildZones('eg')`, imported). At its first or second visit, within 64 M15
candles: the first M15 structure break AGAINST the zone, then the first M15 structure break back WITH it (the confirmation);
the range runs from the extreme made between the two to the level the confirmation closed beyond. A resting limit at that
level for 6 hours, stop past the extreme by 0.1 ATR(14) of M15, target 1R or 2R, 2-day limit. Fill on a touch, or only when
price trades through the level by half the round trip. "built" = the level is a swing made after the break (the range was
built at the extreme); "any" = every sequence. Five markets pooled (xau, eurusd, gbpusd, usdjpy, audusd), OANDA mid 5-minute
candles, discovery = fills 2005-2014, confirmation = 2015 to October 2026. Judged after costs on calendar-month sums; Holm
over the 8 confirmation tests.

## The bar, cell by cell

- n >= 300 in both windows: 8 of 8.
- After-cost mean R > 0 and month t >= 2 in discovery: 0; in confirmation: 0.
- Holm-adjusted p < 0.05: 0.
- **All four: 0.**

## Every cell

R a trade (month-sum t): before costs, then after costs; "cost R" = mean round-trip cost / risk; win = share of trades with R > 0 before costs.

| Cell | n 05-14 | before 05-14 (t) | after 05-14 (t) | n 15-26 | before 15-26 (t) | after 15-26 (t) | win 15-26 | cost R 15-26 | Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| any touch 1R | 10,039 | +0.007 (0.72) | -0.034 (-3.42) | 11,819 | +0.005 (0.57) | -0.040 (-4.59) | 50% | 0.045 | 1.000 | no |
| any touch 2R | 10,039 | +0.017 (1.25) | -0.023 (-1.67) | 11,819 | -0.005 (-0.38) | -0.050 (-3.89) | 36% | 0.045 | 1.000 | no |
| any through 1R | 9,882 | -0.013 (-1.34) | -0.054 (-5.38) | 11,607 | -0.018 (-2.11) | -0.064 (-7.12) | 49% | 0.045 | 1.000 | no |
| any through 2R | 9,882 | -0.005 (-0.35) | -0.045 (-3.22) | 11,607 | -0.029 (-2.26) | -0.074 (-5.73) | 35% | 0.045 | 1.000 | no |
| built touch 1R | 7,727 | +0.009 (0.71) | -0.033 (-2.76) | 8,855 | +0.002 (0.17) | -0.045 (-4.50) | 50% | 0.047 | 1.000 | no |
| built touch 2R | 7,727 | +0.020 (1.23) | -0.022 (-1.33) | 8,855 | -0.002 (-0.17) | -0.049 (-3.36) | 35% | 0.047 | 1.000 | no |
| built through 1R | 7,603 | -0.013 (-1.09) | -0.055 (-4.55) | 8,695 | -0.020 (-2.02) | -0.067 (-6.60) | 49% | 0.047 | 1.000 | no |
| built through 2R | 7,603 | -0.003 (-0.17) | -0.045 (-2.75) | 8,695 | -0.027 (-1.89) | -0.074 (-5.09) | 35% | 0.047 | 1.000 | no |

## Per market

After-cost R a trade (n) in 2005-14 | 2015-26, per cell.

| Cell | xau | eurusd | gbpusd | usdjpy | audusd |
|---|---:|---:|---:|---:|---:|
| any touch 1R | -0.092 (1,677) \| -0.041 (2,305) | -0.042 (1,978) \| -0.052 (2,359) | -0.044 (1,991) \| -0.015 (2,246) | -0.003 (2,229) \| -0.016 (2,433) | -0.003 (2,164) \| -0.075 (2,476) |
| any touch 2R | -0.077 (1,677) \| -0.019 (2,305) | -0.090 (1,978) \| -0.095 (2,359) | -0.014 (1,991) \| -0.050 (2,246) | +0.048 (2,229) \| +0.013 (2,433) | -0.003 (2,164) \| -0.097 (2,476) |
| any through 1R | -0.122 (1,630) \| -0.072 (2,248) | -0.055 (1,959) \| -0.064 (2,327) | -0.054 (1,972) \| -0.036 (2,208) | -0.029 (2,190) \| -0.039 (2,392) | -0.025 (2,131) \| -0.104 (2,432) |
| any through 2R | -0.117 (1,630) \| -0.057 (2,248) | -0.104 (1,959) \| -0.107 (2,327) | -0.021 (1,972) \| -0.072 (2,208) | +0.023 (2,190) \| -0.009 (2,392) | -0.029 (2,131) \| -0.123 (2,432) |
| built touch 1R | -0.107 (1,274) \| -0.045 (1,738) | -0.027 (1,486) \| -0.055 (1,725) | -0.036 (1,529) \| -0.019 (1,628) | -0.018 (1,756) \| -0.026 (1,897) | +0.003 (1,682) \| -0.078 (1,867) |
| built touch 2R | -0.084 (1,274) \| -0.014 (1,738) | -0.071 (1,486) \| -0.101 (1,725) | -0.020 (1,529) \| -0.042 (1,628) | +0.023 (1,756) \| -0.004 (1,897) | +0.021 (1,682) \| -0.086 (1,867) |
| built through 1R | -0.139 (1,235) \| -0.071 (1,693) | -0.040 (1,474) \| -0.066 (1,700) | -0.046 (1,514) \| -0.039 (1,601) | -0.048 (1,723) \| -0.050 (1,868) | -0.021 (1,657) \| -0.105 (1,833) |
| built through 2R | -0.126 (1,235) \| -0.056 (1,693) | -0.085 (1,474) \| -0.110 (1,700) | -0.027 (1,514) \| -0.063 (1,601) | -0.006 (1,723) \| -0.027 (1,868) | -0.005 (1,657) \| -0.113 (1,833) |

## The funnel

Orders = sequences found (one per confirmation candle and side). Counts for the touch fill / the trade-through fill.

| Market | candles from | H4 zones | visits read | with a break against | orders | of them "built" | not filled | filled and resolved | past the stop | risk under cost | bad data | open at data end |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 8,259 | 14,419 | 13,008 | 4,509 | 3,385 | 526 / 630 | 3,982 / 3,878 | 0 / 0 | 0 / 0 | 1 / 1 | 0 / 0 |
| eurusd | 2005-01-02 | 8,902 | 15,626 | 14,169 | 4,982 | 3,677 | 643 / 694 | 4,337 / 4,286 | 0 / 0 | 0 / 0 | 1 / 1 | 1 / 1 |
| gbpusd | 2005-01-02 | 8,847 | 15,522 | 14,000 | 4,857 | 3,586 | 617 / 674 | 4,237 / 4,180 | 0 / 0 | 0 / 0 | 3 / 3 | 0 / 0 |
| usdjpy | 2005-01-02 | 8,921 | 15,813 | 14,363 | 5,285 | 4,096 | 620 / 700 | 4,662 / 4,582 | 1 / 1 | 0 / 0 | 1 / 1 | 1 / 1 |
| audusd | 2005-01-02 | 8,957 | 15,893 | 14,586 | 5,301 | 4,026 | 658 / 735 | 4,640 / 4,563 | 0 / 0 | 0 / 0 | 3 / 3 | 0 / 0 |

## Checks

- Cut test: 10 cuts on xau, eurusd: 25,047 orders known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of its fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.
- On the fill candle only the stop can be hit; a candle holding stop and target is a stop.
- When two zones reach the same confirmation candle and side, the reading of the zone listed first (the earlier engulf) is kept.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

## What it means

No cell clears the bar. The best cell (built touch 2R) made -0.002R a trade before costs and -0.049R after costs in
2015-26, and +0.020R / -0.022R in 2005-14. Waiting for the range and the confirmation break at an H4 engulf zone and
resting a limit at the confirmation level does not make money after costs on these five markets. This sequence at an H4
engulf zone is closed on these years: no variant of these 8 cells is re-tested on them. Nothing live changed; no rule is proposed.
