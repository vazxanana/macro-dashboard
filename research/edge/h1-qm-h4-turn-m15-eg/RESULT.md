# An H1 quasimodo at an H4 turn level, entered at the left shoulder after an M15 engulf (result)

**Verdict: INCONCLUSIVE. Best cell eg 3R: -0.043R a trade after costs in 2015-26 (n 220, month t -0.35); 2005-14 -0.024R (n 172, t -0.20).**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, nothing
is proposed. One run, no variants.

## What was run

An H1 quasimodo (for a sell: a swing high, a higher low, a higher high = the head, then an H1 close below the higher low;
`edgekit` `qms`, swings 3 a side) whose head reached the last H4 peak of the closes (2 candles a side) still unbroken at the
break. Entry: a limit at the left shoulder (the first swing high), stop past the head by half the round trip, target 2R or
3R, out after 2 days. **eg** = the limit is placed only after a 15-minute engulf with the trade completed at the shoulder
(within 24 hours of the break; the order then lives 12 hours); **now** = the same limit placed at the break (24 hours), the
control. A limit fills only when a 5-minute candle trades through it by half the round trip; on the fill candle only the stop
counts; a candle that holds stop and target is a stop. Buys mirror. Markets pooled: xau, eurusd, gbpusd, usdjpy, audusd; OANDA mid
5-minute candles. Discovery = fills 2005-2014, confirmation = 2015 to October 2026. Costs: the desk's demo round trips.

## Every cell

R a trade (month-sum t); "net" = after costs; win and cost R (mean round trip / risk) are for 2015-26.

| Cell | n 05-14 | R 05-14 (t) | net 05-14 (t) | n 15-26 | R 15-26 (t) | net 15-26 (t) | win | cost R | Holm p | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| eg 2R | 172 | +0.075 (0.79) | +0.027 (0.28) | 220 | -0.110 (-1.16) | -0.163 (-1.71) | 33 % | 0.053 | 1.000 | no |
| eg 3R | 172 | +0.025 (0.21) | -0.024 (-0.20) | 220 | +0.010 (0.08) | -0.043 (-0.35) | 31 % | 0.053 | 1.000 | no |
| now 2R | 511 | +0.037 (0.59) | -0.050 (-0.77) | 694 | -0.074 (-1.34) | -0.165 (-2.94) | 33 % | 0.092 | 1.000 | no |
| now 3R | 511 | -0.036 (-0.52) | -0.123 (-1.72) | 694 | -0.062 (-0.93) | -0.154 (-2.28) | 27 % | 0.092 | 1.000 | no |

## The bar (after costs), the two `eg` cells

- n >= 300 in both windows: 0 of 2.
- Mean R after costs > 0 and month t >= 2 in discovery: 0; in confirmation: 0.
- Holm-adjusted p < 0.05 (over the 4 cells): 0.
- **All of them: 0.**

## Per market, the `eg` cells

| Market | Cell | n 05-14 | R (t) | net (t) | n 15-26 | R (t) | net (t) | win | cost R |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | eg 2R | 24 | +0.006 (0.02) | -0.101 (-0.38) | 37 | -0.227 (-1.14) | -0.309 (-1.55) | 30 % | 0.083 |
| xau | eg 3R | 24 | +0.086 (0.27) | -0.022 (-0.07) | 37 | -0.231 (-1.01) | -0.313 (-1.37) | 27 % | 0.083 |
| eurusd | eg 2R | 39 | +0.366 (1.54) | +0.338 (1.42) | 52 | -0.278 (-1.58) | -0.322 (-1.82) | 25 % | 0.044 |
| eurusd | eg 3R | 39 | +0.278 (1.12) | +0.250 (1.01) | 52 | -0.096 (-0.43) | -0.140 (-0.62) | 25 % | 0.044 |
| gbpusd | eg 2R | 38 | -0.264 (-1.33) | -0.302 (-1.51) | 39 | +0.053 (0.25) | +0.008 (0.04) | 44 % | 0.046 |
| gbpusd | eg 3R | 38 | -0.382 (-1.68) | -0.420 (-1.82) | 39 | +0.040 (0.16) | -0.006 (-0.02) | 39 % | 0.046 |
| usdjpy | eg 2R | 36 | +0.168 (0.83) | +0.117 (0.57) | 48 | -0.041 (-0.24) | -0.094 (-0.54) | 33 % | 0.053 |
| usdjpy | eg 3R | 36 | +0.383 (1.47) | +0.331 (1.28) | 48 | +0.125 (0.55) | +0.073 (0.32) | 31 % | 0.053 |
| audusd | eg 2R | 35 | +0.072 (0.33) | +0.033 (0.15) | 44 | -0.035 (-0.16) | -0.079 (-0.37) | 34 % | 0.044 |
| audusd | eg 3R | 35 | -0.227 (-0.86) | -0.265 (-1.00) | 44 | +0.186 (0.68) | +0.142 (0.52) | 34 % | 0.044 |

## Counts

| Market | candles from | H1 QMs | head at the H4 level | risk under 2 x cost | void before an engulf | engulf found | fills eg | fills now | no fill eg | no fill now | dropped (bad data) | open at data end |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| xau | 2006-03-19 | 1,565 | 489 | 41 | 95 | 83 | 61 | 189 | 22 | 259 | 0 | 0 |
| eurusd | 2005-01-02 | 1,906 | 624 | 19 | 151 | 112 | 91 | 284 | 21 | 321 | 0 | 0 |
| gbpusd | 2005-01-02 | 1,870 | 609 | 28 | 133 | 114 | 77 | 269 | 37 | 312 | 0 | 0 |
| usdjpy | 2005-01-02 | 1,620 | 534 | 32 | 102 | 109 | 84 | 231 | 25 | 271 | 0 | 0 |
| audusd | 2005-01-02 | 1,765 | 577 | 26 | 110 | 109 | 79 | 232 | 30 | 319 | 0 | 0 |

## Checks

- Cut test (eurusd): 3 cuts, 1,137 orders known by the cut dates, 0 missing or extra when the candles are cut there.
- Every order has its stop on the losing side of its entry (the run throws otherwise).

## What it means

The setup is too rare on five markets to judge by the pre-registered bar (300 trades in each window). The figures above are descriptive only.
Waiting for the 15-minute engulf against placing the limit at once, 2R target: -0.163R against -0.165R a trade after costs in 2015-26
(+0.027R against -0.050R in 2005-14); descriptive, the two share most of their trades.
Do not re-test variants of these cells on these years. Nothing live changed; no rule is proposed.
