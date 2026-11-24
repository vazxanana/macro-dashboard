# A chain of failed engulfs: H4 fails, H1 fails, M15 engulfs (result)

**Verdict: FAIL. 0 of 6 cells pass; the best confirmation cell (highest after-cost R), at 1R, made -0.106R a trade after costs in 2015-26 (n 3,152, month t -5.88; -0.010R before costs; discovery -0.124R after costs, n 2,579, t -6.14).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone before any run). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

An H4 engulf zone that failed (an H4 close through its far side) is a level for the other side for 20 days or until an H4
close back through it. On the first H1 return into it, an H1 engulf zone of the OLD side must fail too within 24 H1 candles
("at": that H1 zone overlaps the level; "any": anywhere). Then the first M15 engulf WITH the new side within 6 hours is the
entry: market at the next 5-minute open, stop past the M15 zone by 0.1 x ATR(14) of M15. Exits: 1R, 2R, or "opp" = the near
side of the nearest standing H4 engulf zone of the other side when it is 1R or more away; the stop; 3 days. Engulf zones are
the desk's own (`council/eg-methods.mjs` `zones`, imported). Five markets pooled (xau, eurusd, gbpusd, usdjpy, audusd), OANDA mid
5-minute candles; discovery = fills 2005-2014, confirmation = 2015 to October 2026. Judged AFTER costs (the demo
account's round trips, flat for every year) on calendar-month sums; Holm over the 6 confirmation tests.

## The bar, cell by cell

- n >= 300 in both windows: 6 of 6.
- After costs, mean R > 0 and month t >= 2 in discovery: 0; in confirmation: 0.
- Holm-adjusted p < 0.05: 0.
- **All: 0.**

## Every cell

R a trade (month-sum t). "cost R" = mean round trip / risk in 2015-26. Mirror = the same fill traded the other way with the
same stop distance and the same targets in R, after costs.

| Cell | n 05-14 | before 05-14 (t) | after 05-14 (t) | n 15-26 | before 15-26 (t) | after 15-26 (t) | win 15-26 | cost R | Holm | Mirror after 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| at 1R | 2,579 | -0.040 (-2.06) | -0.124 (-6.14) | 3,152 | -0.010 (-0.58) | -0.106 (-5.88) | 49 % | 0.096 | 1.000 | -0.093 (-5.21) | no |
| at 2R | 2,579 | -0.051 (-1.90) | -0.135 (-4.91) | 3,151 | -0.025 (-1.00) | -0.121 (-4.75) | 33 % | 0.096 | 1.000 | -0.072 (-2.98) | no |
| at opp | 1,358 | -0.115 (-2.21) | -0.212 (-3.99) | 1,747 | -0.048 (-0.99) | -0.152 (-3.14) | 24 % | 0.104 | 1.000 | -0.044 (-0.79) | no |
| any 1R | 5,527 | -0.051 (-3.38) | -0.135 (-8.55) | 6,545 | -0.023 (-1.81) | -0.117 (-9.26) | 49 % | 0.094 | 1.000 | -0.078 (-6.02) | no |
| any 2R | 5,527 | -0.057 (-2.82) | -0.140 (-6.83) | 6,544 | -0.025 (-1.44) | -0.120 (-6.73) | 33 % | 0.094 | 1.000 | -0.041 (-2.24) | no |
| any opp | 2,825 | -0.057 (-1.69) | -0.152 (-4.36) | 3,468 | -0.040 (-1.22) | -0.143 (-4.33) | 25 % | 0.103 | 1.000 | -0.055 (-1.35) | no |

## Per market

After costs, R a trade (month-sum t) [n]; before costs in the second line of each cell.

| Cell | Window | xau | eurusd | gbpusd | usdjpy | audusd |
|---|---|---:|---:|---:|---:|---:|
| at 1R | 05-14 | -0.236 (-4.24) [407]<br>before -0.070 | -0.086 (-1.94) [525]<br>before -0.032 | -0.131 (-2.94) [520]<br>before -0.067 | -0.110 (-2.77) [557]<br>before -0.016 | -0.088 (-1.91) [570]<br>before -0.025 |
| at 1R | 15-26 | -0.178 (-4.39) [607]<br>before -0.034 | -0.044 (-1.08) [627]<br>before +0.035 | -0.137 (-3.41) [622]<br>before -0.059 | -0.103 (-2.36) [628]<br>before -0.011 | -0.073 (-1.78) [668]<br>before +0.015 |
| at 2R | 05-14 | -0.277 (-3.70) [407]<br>before -0.110 | -0.146 (-2.60) [525]<br>before -0.092 | -0.127 (-2.04) [520]<br>before -0.063 | -0.063 (-1.30) [557]<br>before +0.031 | -0.104 (-1.77) [570]<br>before -0.042 |
| at 2R | 15-26 | -0.133 (-2.25) [607]<br>before +0.011 | -0.070 (-1.21) [627]<br>before +0.009 | -0.172 (-3.22) [622]<br>before -0.095 | -0.119 (-2.04) [628]<br>before -0.026 | -0.112 (-2.21) [667]<br>before -0.024 |
| at opp | 05-14 | -0.338 (-2.33) [241]<br>before -0.148 | -0.175 (-1.37) [267]<br>before -0.115 | -0.307 (-2.86) [270]<br>before -0.232 | -0.066 (-0.52) [302]<br>before +0.036 | -0.204 (-1.92) [278]<br>before -0.136 |
| at opp | 15-26 | -0.160 (-1.35) [336]<br>before -0.005 | -0.215 (-2.33) [362]<br>before -0.130 | -0.056 (-0.48) [345]<br>before +0.033 | -0.105 (-0.98) [342]<br>before -0.006 | -0.217 (-2.20) [362]<br>before -0.120 |
| any 1R | 05-14 | -0.225 (-6.68) [952]<br>before -0.057 | -0.112 (-3.51) [1,119]<br>before -0.057 | -0.139 (-4.42) [1,116]<br>before -0.077 | -0.095 (-3.04) [1,106]<br>before -0.004 | -0.119 (-3.64) [1,234]<br>before -0.059 |
| any 1R | 15-26 | -0.188 (-6.62) [1,289]<br>before -0.046 | -0.078 (-2.78) [1,340]<br>before -0.000 | -0.132 (-4.88) [1,301]<br>before -0.055 | -0.069 (-2.33) [1,269]<br>before +0.020 | -0.121 (-4.27) [1,346]<br>before -0.032 |
| any 2R | 05-14 | -0.228 (-5.23) [952]<br>before -0.060 | -0.162 (-4.07) [1,119]<br>before -0.108 | -0.120 (-2.51) [1,116]<br>before -0.059 | -0.086 (-2.26) [1,106]<br>before +0.004 | -0.120 (-2.72) [1,234]<br>before -0.060 |
| any 2R | 15-26 | -0.159 (-3.78) [1,289]<br>before -0.017 | -0.096 (-2.41) [1,340]<br>before -0.019 | -0.142 (-4.03) [1,301]<br>before -0.065 | -0.075 (-1.76) [1,269]<br>before +0.014 | -0.127 (-3.36) [1,345]<br>before -0.038 |
| any opp | 05-14 | -0.258 (-2.39) [536]<br>before -0.071 | -0.058 (-0.69) [563]<br>before +0.002 | -0.248 (-3.34) [549]<br>before -0.178 | -0.101 (-1.13) [573]<br>before -0.005 | -0.104 (-1.32) [604]<br>before -0.040 |
| any opp | 15-26 | -0.194 (-2.61) [667]<br>before -0.040 | -0.179 (-2.72) [720]<br>before -0.092 | -0.103 (-1.41) [717]<br>before -0.016 | -0.041 (-0.45) [668]<br>before +0.053 | -0.196 (-2.86) [696]<br>before -0.099 |

## Down the chain

| Market | candles from | failed H4 zones | first returns | H1 failure (at / any) | M15 trigger (at / any) | signals | no 5m candle in 1 h | past the stop | risk under cost | bad data | unresolved | trades (cells) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 6,594 | 6,050 | 1,247 / 3,023 | 1,139 / 2,839 | 3,283 | 19 | 0 | 9 | 0 | 0 | 8,290 |
| eurusd | 2005-01-02 | 7,272 | 6,705 | 1,423 / 3,278 | 1,331 / 3,101 | 3,614 | 1 | 0 | 0 | 2 | 0 | 9,134 |
| gbpusd | 2005-01-02 | 7,197 | 6,737 | 1,389 / 3,250 | 1,285 / 3,052 | 3,569 | 4 | 3 | 0 | 3 | 0 | 8,999 |
| usdjpy | 2005-01-02 | 7,124 | 6,607 | 1,456 / 3,237 | 1,357 / 3,065 | 3,563 | 2 | 0 | 1 | 0 | 0 | 9,005 |
| audusd | 2005-01-02 | 7,317 | 6,840 | 1,527 / 3,460 | 1,422 / 3,258 | 3,824 | 0 | 0 | 2 | 4 | 2 | 9,574 |

## Checks

- Cut test on xau: 5 cuts, 8,314 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a 5-minute candle that holds stop and target is a stop (`edgekit.simulate`).
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

## What it means

No cell clears the bar. Waiting for a failed H4 zone, a failed H1 zone on the return and an M15 engulf with the new side does
not make money after costs in both decades; the tight stop past the M15 zone makes the round trip a large share of 1R (the
"cost R" column). Read with `eg-ef-choch-ladder`, `h4-ef-to-eg`, `grid7-ltf-ef` and `grid7-wide-eg-chain`: the failed-engulf
ladders are closed on these years. Do not re-test variants of these 6 cells. Nothing live changed; no rule is proposed.
