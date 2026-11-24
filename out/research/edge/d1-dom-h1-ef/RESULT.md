# Daily dominant zone, first return, H1 failed engulf with the zone (result)

**Verdict: FAIL. 0 of 12 cells pass after costs; the best cell, any W12 3R, made -0.043R a trade after costs in 2015-26 (n 1,535, month t -1.10; -0.022R before costs; 2005-14 +0.032R after costs, n 1,180, month t 0.64).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed,
nothing is proposed. One run, no variants.

## What was run

Key level: a Daily dominant zone (two Daily candles of one colour, the second closing beyond the first's extreme; the zone
is the first candle's body; `combo-grid-3` `buildZones('dom')`). On price's FIRST return (the first H1 candle trading into
it), within 12 or 24 H1 candles and before an H1 close beyond the zone's far side: an H1 engulf of the OTHER side that
fails (an H1 close through it; `council/eg-methods.mjs` `zones`). "visit" = the engulf was completed during the return,
"any" = whenever. Market entry with the zone at the next 5-minute open; stop past the extreme made at the zone (half the
round trip + 0.1 x H1 ATR beyond it); target 1R, 2R or 3R; 10-day limit; stop first when a candle holds both. Five markets
pooled (xau, eurusd, gbpusd, usdjpy, audusd), OANDA mid 5-minute candles. Discovery = fills 2005-2014, confirmation = 2015 to October 2026.
Judged AFTER costs (the desk's demo round trips) on calendar-month sums; Holm over the 12 confirmation tests.

## The bar, cell by cell

- n >= 300 in both windows: 12 of 12.
- After costs, mean R > 0 and month t >= 2 in discovery: 0; in confirmation: 0; both: 0.
- Holm-adjusted p < 0.05: 0.
- **All of it: 0.**

## Every cell

R a trade before costs and after costs, each with its calendar-month-sum t; "cost R" = mean round trip / risk in 2015-26;
mirror = the same fills traded AGAINST the zone (same stop distance on the other side), after costs, a control.

| Cell | n 05-14 | gross 05-14 (t) | net 05-14 (t) | n 15-26 | gross 15-26 (t) | net 15-26 (t) | win 15-26 | cost R | Holm | Mirror net 15-26 (t) | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| visit W12 1R | 845 | -0.008 (-0.23) | -0.029 (-0.81) | 1,058 | -0.039 (-1.33) | -0.062 (-2.10) | 48% | 0.023 | 1.000 | +0.014 (0.48) | no |
| visit W12 2R | 845 | -0.013 (-0.26) | -0.034 (-0.68) | 1,058 | -0.037 (-0.82) | -0.060 (-1.33) | 33% | 0.023 | 1.000 | +0.017 (0.47) | no |
| visit W12 3R | 845 | +0.035 (0.59) | +0.014 (0.24) | 1,058 | -0.058 (-1.12) | -0.081 (-1.57) | 27% | 0.023 | 1.000 | -0.016 (-0.35) | no |
| visit W24 1R | 1,812 | -0.005 (-0.18) | -0.024 (-0.90) | 2,269 | -0.031 (-1.63) | -0.053 (-2.75) | 49% | 0.022 | 1.000 | +0.008 (0.40) | no |
| visit W24 2R | 1,812 | -0.022 (-0.62) | -0.041 (-1.16) | 2,269 | -0.017 (-0.56) | -0.038 (-1.30) | 34% | 0.022 | 1.000 | +0.008 (0.28) | no |
| visit W24 3R | 1,812 | +0.001 (0.02) | -0.018 (-0.41) | 2,269 | -0.026 (-0.74) | -0.047 (-1.36) | 28% | 0.022 | 1.000 | -0.011 (-0.31) | no |
| any W12 1R | 1,180 | -0.005 (-0.15) | -0.024 (-0.77) | 1,535 | -0.011 (-0.46) | -0.032 (-1.34) | 50% | 0.021 | 1.000 | -0.013 (-0.54) | no |
| any W12 2R | 1,180 | +0.019 (0.46) | -0.000 (-0.01) | 1,535 | -0.019 (-0.53) | -0.040 (-1.12) | 34% | 0.021 | 1.000 | -0.008 (-0.24) | no |
| any W12 3R | 1,180 | +0.052 (1.02) | +0.032 (0.64) | 1,535 | -0.022 (-0.56) | -0.043 (-1.10) | 28% | 0.021 | 1.000 | -0.024 (-0.58) | no |
| any W24 1R | 2,036 | -0.008 (-0.31) | -0.027 (-1.06) | 2,558 | -0.020 (-1.06) | -0.042 (-2.19) | 49% | 0.021 | 1.000 | -0.004 (-0.19) | no |
| any W24 2R | 2,036 | -0.005 (-0.13) | -0.024 (-0.68) | 2,558 | -0.020 (-0.74) | -0.042 (-1.51) | 34% | 0.021 | 1.000 | -0.009 (-0.31) | no |
| any W24 3R | 2,036 | +0.016 (0.38) | -0.003 (-0.08) | 2,558 | -0.024 (-0.73) | -0.045 (-1.38) | 28% | 0.021 | 1.000 | -0.022 (-0.67) | no |

## The best cell by market (any W12 3R; no verdict)

| Market | cost | n 05-14 | gross (t) | net (t) | n 15-26 | gross (t) | net (t) |
|---|---:|---:|---:|---:|---:|---:|---:|
| xau | 0.3 | 191 | +0.082 (0.60) | +0.040 (0.29) | 287 | -0.161 (-1.80) | -0.192 (-2.13) |
| eurusd | 0.00006 | 233 | -0.024 (-0.22) | -0.036 (-0.33) | 312 | -0.021 (-0.22) | -0.039 (-0.42) |
| gbpusd | 0.00008 | 245 | +0.010 (0.09) | -0.003 (-0.03) | 294 | +0.060 (0.71) | +0.043 (0.51) |
| usdjpy | 0.008 | 241 | +0.029 (0.28) | +0.009 (0.09) | 312 | +0.072 (0.75) | +0.052 (0.55) |
| audusd | 0.00006 | 270 | +0.153 (1.43) | +0.139 (1.30) | 330 | -0.064 (-0.79) | -0.085 (-1.05) |

## Checks

- Cut test: 10 cuts on xau, eurusd: 8,793 signals known by the cut dates, 0 missing or extra when the candles are cut there.
- Every trade has its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk under the round-trip cost are no trades.
- Exclusions: the data-quality audit's bad intervals (`combo-grid-2` `exclusions`).

| Market | candles from | Daily zones | first returns | signals (both engulf rules) | simulated | dropped (bad data) | past the stop | risk under cost | unresolved at data end |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 1,681 | 1,528 | 1,553 | 1,553 | 0 | 0 | 0 | 0 |
| eurusd | 2005-01-02 | 1,896 | 1,744 | 1,837 | 1,835 | 2 | 0 | 0 | 4 |
| gbpusd | 2005-01-02 | 1,922 | 1,782 | 1,774 | 1,768 | 4 | 2 | 0 | 0 |
| usdjpy | 2005-01-02 | 1,828 | 1,681 | 1,668 | 1,668 | 0 | 0 | 0 | 2 |
| audusd | 2005-01-02 | 1,892 | 1,764 | 1,860 | 1,860 | 0 | 0 | 0 | 3 |

## What it means

No cell clears the bar: a failed H1 engulf on the first return to a Daily dominant zone does not make money after costs in
both windows on these five markets. The mirror column shows what the same fills did the other way. Do not re-test variants of
these 12 cells on these years. Nothing live changed; no rule is proposed.
