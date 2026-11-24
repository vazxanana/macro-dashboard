# The H4 > H1 > M15 engulf chain, WITH against AGAINST the H4 direction call (result)

**Verdict: FAIL. 0 of 12 cells pass; the best cell, AGAINST touch opp, made -0.107R a trade after costs in 2015-26 (n 8,920, month t -2.52).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, nothing is
proposed. One run, no variants.

## What was run

The three-timeframe engulf chain on its H4 > H1 > M15 ladder (`grid7-wide-eg-chain`'s `chainSignals`, imported; engulf zones from
`council/eg-methods.mjs` `zones`): a live H4 engulf zone gives the side; price comes back into it and an H1 engulf of that side
completes touching it; an M15 engulf of that side then completes touching the H1 zone within 24 candles. Order: a limit at the
middle of the M15 zone for 24 M15 candles (cancelled by an M15 close past the stop), stop past the H1 zone's far side + 0.1 ATR(14)
of H1, exits 1R, 2R or the nearest live opposite H4 zone (1R or more away), 3-day limit. Two fills: `touch` (a 5-minute candle
trades to the entry: the desk's fill) and `through` (it trades through the entry by half the round trip). Each order is put in
WITH or AGAINST by the direction call (`direction()`, unchanged) of the last H4 candle closed at the order: H4 working, Daily key
levels. Five markets pooled (xau, eurusd, gbpusd, usdjpy, audusd), OANDA mid 5-minute candles, discovery = fills 2005-2014, confirmation = 2015 to
October 2026. Costs: the demo round trips of `combo-grid-2`, in R of each trade's own risk.

Orders: 58,372; side equal to the call 27,755 (47.5 %), opposite 30,540 (52.3 %), no call yet 77.

## The 12 judged cells (the bar is after costs)

R a trade (calendar-month-sum t). Pass = n >= 300 in both windows, after-cost R > 0 with month t >= 2 in both, Holm p < 0.05.

| Cell | n 05-14 | before 05-14 (t) | after 05-14 (t) | n 15-26 | before 15-26 (t) | after 15-26 (t) | win 15-26 | Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| WITH touch 1R | 9,843 | -0.012 (-0.91) | -0.097 (-7.25) | 11,705 | +0.000 (0.03) | -0.103 (-7.40) | 49 % | 1.000 | no |
| WITH touch 2R | 9,843 | -0.006 (-0.29) | -0.090 (-4.57) | 11,705 | +0.004 (0.19) | -0.099 (-4.87) | 34 % | 1.000 | no |
| WITH touch opp | 5,660 | +0.013 (0.29) | -0.087 (-1.91) | 6,883 | -0.009 (-0.24) | -0.134 (-3.40) | 26 % | 1.000 | no |
| WITH through 1R | 9,674 | -0.054 (-4.09) | -0.139 (-10.16) | 11,477 | -0.047 (-4.07) | -0.150 (-10.84) | 47 % | 1.000 | no |
| WITH through 2R | 9,674 | -0.046 (-2.37) | -0.131 (-6.56) | 11,477 | -0.041 (-2.27) | -0.144 (-7.15) | 32 % | 1.000 | no |
| WITH through opp | 5,563 | -0.036 (-0.83) | -0.135 (-3.06) | 6,747 | -0.070 (-2.00) | -0.195 (-5.21) | 25 % | 1.000 | no |
| AGAINST touch 1R | 10,991 | -0.003 (-0.25) | -0.090 (-6.73) | 12,801 | -0.006 (-0.45) | -0.108 (-7.68) | 49 % | 1.000 | no |
| AGAINST touch 2R | 10,991 | +0.010 (0.47) | -0.077 (-3.64) | 12,801 | -0.003 (-0.14) | -0.105 (-5.60) | 33 % | 1.000 | no |
| AGAINST touch opp | 7,759 | -0.040 (-0.99) | -0.137 (-3.36) | 8,920 | +0.009 (0.22) | -0.107 (-2.52) | 25 % | 1.000 | no |
| AGAINST through 1R | 10,772 | -0.052 (-4.04) | -0.141 (-9.86) | 12,570 | -0.053 (-3.89) | -0.157 (-10.76) | 47 % | 1.000 | no |
| AGAINST through 2R | 10,772 | -0.041 (-1.96) | -0.129 (-5.98) | 12,570 | -0.045 (-2.52) | -0.149 (-7.87) | 32 % | 1.000 | no |
| AGAINST through opp | 7,602 | -0.092 (-2.44) | -0.192 (-4.98) | 8,760 | -0.035 (-0.88) | -0.154 (-3.77) | 24 % | 1.000 | no |

Passing: 0 of 12. Best cell (highest confirmation after-cost month t): AGAINST touch opp.

## WITH against AGAINST (reported, not judged)

Mean R WITH minus mean R AGAINST, before costs, and the Welch t of the trades.

| Fill, exit | diff 05-14 | Welch t | diff 15-26 | Welch t |
|---|---:|---:|---:|---:|
| touch 1R | -0.009 | -0.62 | +0.006 | 0.47 |
| touch 2R | -0.015 | -0.78 | +0.006 | 0.33 |
| touch opp | +0.053 | 1.40 | -0.018 | -0.49 |
| through 1R | -0.002 | -0.15 | +0.006 | 0.44 |
| through 2R | -0.006 | -0.29 | +0.004 | 0.23 |
| through opp | +0.056 | 1.51 | -0.035 | -0.98 |

## Every chain order, no call condition (reported)

| Cell | n 05-14 | before 05-14 (t) | after 05-14 (t) | n 15-26 | before 15-26 (t) | after 15-26 (t) | win 15-26 | | |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| ALL touch 1R | 20,896 | -0.007 (-0.74) | -0.093 (-9.44) | 24,506 | -0.003 (-0.35) | -0.106 (-11.13) | 49 % |  |  |
| ALL touch 2R | 20,896 | +0.003 (0.19) | -0.083 (-5.57) | 24,506 | +0.000 (0.03) | -0.102 (-7.85) | 34 % |  |  |
| ALL touch opp | 13,445 | -0.017 (-0.55) | -0.115 (-3.69) | 15,803 | +0.001 (0.05) | -0.119 (-4.03) | 26 % |  |  |
| ALL through 1R | 20,506 | -0.053 (-5.66) | -0.139 (-13.67) | 24,047 | -0.050 (-5.86) | -0.154 (-15.64) | 47 % |  |  |
| ALL through 2R | 20,506 | -0.043 (-2.95) | -0.129 (-8.51) | 24,047 | -0.043 (-3.59) | -0.147 (-10.96) | 32 % |  |  |
| ALL through opp | 13,191 | -0.068 (-2.27) | -0.167 (-5.49) | 15,507 | -0.051 (-1.87) | -0.172 (-6.13) | 24 % |  |  |

## Per market, the best cell (AGAINST touch opp)

| Market | n 05-14 | before (t) | after (t) | n 15-26 | before (t) | after (t) |
|---|---:|---:|---:|---:|---:|---:|
| xau | 1,177 | -0.072 (-0.87) | -0.251 (-2.99) | 1,722 | -0.076 (-1.21) | -0.230 (-3.52) |
| eurusd | 1,598 | -0.018 (-0.19) | -0.089 (-0.94) | 1,757 | +0.106 (0.80) | +0.007 (0.06) |
| gbpusd | 1,746 | -0.151 (-2.20) | -0.228 (-3.30) | 1,699 | +0.024 (0.28) | -0.075 (-0.88) |
| usdjpy | 1,760 | +0.012 (0.14) | -0.093 (-1.11) | 1,845 | +0.032 (0.39) | -0.077 (-0.93) |
| audusd | 1,478 | +0.030 (0.37) | -0.045 (-0.57) | 1,897 | -0.038 (-0.56) | -0.160 (-2.28) |

## Checks

- Cut test: 25 cuts on xau, eurusd, gbpusd, usdjpy, audusd: 157,441 orders (side, time, entry, stop, call) known by the cut dates, 0 missing or extra when the candles are cut there.
- Every order has its stop on the losing side of its entry (the run throws otherwise); a trade whose risk is under the round trip is no trade; a fill candle that opens past the stop is booked at -1R; on the fill candle only the stop counts; stop first when one candle holds both.
- Exclusions: the data-quality audit's bad intervals.

| Market | candles from | orders | WITH / AGAINST / no call | filled touch / through | unfilled touch / through | risk under cost | dropped |
|---|---|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 10,236 | 4,854 / 5,372 / 10 | 7,863 / 7,632 | 2,221 / 2,450 | 305 | 1 |
| eurusd | 2005-01-02 | 11,486 | 5,339 / 6,135 / 12 | 8,961 / 8,834 | 2,453 / 2,582 | 131 | 11 |
| gbpusd | 2005-01-02 | 11,589 | 5,469 / 6,096 / 24 | 9,080 / 8,957 | 2,414 / 2,535 | 165 | 25 |
| usdjpy | 2005-01-02 | 12,912 | 6,198 / 6,699 / 15 | 10,085 / 9,868 | 2,703 / 2,915 | 226 | 27 |
| audusd | 2005-01-02 | 12,149 | 5,895 / 6,238 / 16 | 9,413 / 9,262 | 2,656 / 2,808 | 145 | 12 |

## What it means

Taking the chain's orders only on the side of the H4 direction call does not make the chain profitable after costs, and neither
does taking them against it: no cell clears the bar. WITH beat AGAINST with a Welch t of 2 or more in both windows in 0 of 6
fill x exit pairs. Do not re-test variants of these cells on these years. Nothing live changed; no rule is proposed.
