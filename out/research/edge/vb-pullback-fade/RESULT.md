# Breakout day, then fade the pullback: the M15 Break fade split by the day's T1 breakout (result)

**Verdict: FAIL. 0 of 3 tests pass; WITH-breakout fades made -0.088R a trade after costs in 2016-26 (n 5178, month t -3.99; before costs +0.036R), AGAINST -0.140R (n 6895, t -7.32), the no-breakout-day control -0.007R (n 8690, t -0.42).**

Run 2026-11-24 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live changed,
nothing is proposed. One run, no variants. A before-cost tilt is not an edge.

## What was run

Gold and USD/JPY, OANDA mid 5-minute candles. Breakout days from the T1 studies' own `buildDays` / `daySkip` / `vbTrade` (k 0.5,
both sides); the M15 Break fade (`grid7-wide-fade` cell `m15 none atr 2R all`, its own `signals` and `exits`). A fade whose M15
break closed after the breakout's fill candle (and before 21:00 UTC) is WITH when it points the breakout's way (a pullback faded),
AGAINST otherwise; CONTROL = every fade of a day whose breakout did not fill. Costs = the fade's parent costs (`combo-grid-2`):
gold $0.3, USD/JPY 0.008 a round trip (demo figures, not assumed). Discovery 2007-2015, confirmation
2016 to October 2026, month sums with empty months as 0.

## The tests (Holm over three)

| Test | Pass | Holm p |
|---|---|---:|
| T1 WITH fades after costs | no | 1.000 |
| T2 AGAINST fades after costs | no | 1.000 |
| T3 WITH minus CONTROL after costs: diff -0.045R (Welch t -1.58) in 2007-15, -0.081R (t -3.11) in 2016-26 | no | 1.000 |

## Pooled

| Set | n 07-15 | R before costs | R after | month t (after) | n 16-26 | R before costs (month t) | R after | month t (after) | cost R | won |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| WITH | 4072 | +0.048 | -0.086 | -3.29 | 5178 | +0.036 (t 1.67) | -0.088 | -3.99 | 0.123 | 35.2 % |
| AGAINST | 5594 | +0.002 | -0.133 | -6.62 | 6895 | -0.016 (t -0.89) | -0.140 | -7.32 | 0.123 | 33.3 % |
| CONTROL | 7542 | +0.150 | -0.041 | -2.46 | 8690 | +0.150 (t 9.15) | -0.007 | -0.42 | 0.157 | 38.6 % |
| first WITH fade of each day (reported) | 2286 | +0.046 | -0.089 | -2.95 | 2798 | -0.005 (t -0.2) | -0.130 | -4.72 | 0.124 | 33.9 % |

WITH minus AGAINST, after costs: +0.047R (Welch t 1.59) in 2007-15, +0.052R (t 1.94) in 2016-26 (reported).

## Per market

### xau

Breakout days 3850, no-fill days 1452; risk under cost 24, stop on the wrong side 0, still open 1, excluded 1.

| Set | n 07-15 | R before costs | R after | month t (after) | n 16-26 | R before costs (month t) | R after | month t (after) | cost R | won |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| WITH | 1758 | +0.046 | -0.122 | -3.19 | 2390 | +0.061 (t 2.2) | -0.083 | -2.83 | 0.144 | 36.4 % |
| AGAINST | 2534 | +0.013 | -0.157 | -5.43 | 3286 | -0.020 (t -0.88) | -0.163 | -6.69 | 0.143 | 33.3 % |
| CONTROL | 3915 | +0.154 | -0.092 | -4.05 | 4409 | +0.147 (t 6.69) | -0.040 | -1.73 | 0.187 | 38.6 % |

### usdjpy

Breakout days 4157, no-fill days 1499; risk under cost 0, stop on the wrong side 0, still open 0, excluded 28.

| Set | n 07-15 | R before costs | R after | month t (after) | n 16-26 | R before costs (month t) | R after | month t (after) | cost R | won |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| WITH | 2314 | +0.050 | -0.059 | -1.84 | 2788 | +0.014 (t 0.48) | -0.092 | -3.08 | 0.106 | 34.3 % |
| AGAINST | 3060 | -0.007 | -0.114 | -3.88 | 3609 | -0.013 (t -0.54) | -0.118 | -4.87 | 0.105 | 33.3 % |
| CONTROL | 3627 | +0.146 | +0.015 | 0.61 | 4281 | +0.154 (t 6.26) | +0.027 | 1.19 | 0.126 | 38.6 % |

## No look-ahead

Cut test (signals, their set and day labels known at a cut date, computed on candles cut there, against the full run): xau 2009-06-10: 5848 signals, missing 0, extra 0, day labels differing 0; xau 2013-03-13: 12498 signals, missing 0, extra 0, day labels differing 0; xau 2017-09-20: 20007 signals, missing 0, extra 0, day labels differing 0; xau 2021-02-17: 25735 signals, missing 0, extra 0, day labels differing 0; xau 2025-05-07: 32941 signals, missing 0, extra 0, day labels differing 0; usdjpy 2009-06-10: 8012 signals, missing 0, extra 0, day labels differing 0; usdjpy 2013-03-13: 14792 signals, missing 0, extra 0, day labels differing 0; usdjpy 2017-09-20: 22754 signals, missing 0, extra 0, day labels differing 0; usdjpy 2021-02-17: 28706 signals, missing 0, extra 0, day labels differing 0; usdjpy 2025-05-07: 36082 signals, missing 0, extra 0, day labels differing 0.

## Caveats

- The breakout does not pick better fades: on breakout days both sets lose after costs, and the fades of the quiet no-fill days
  are the least bad (before costs +0.15R a trade in both windows against +0.04R / -0.02R). Fading WITH the breakout beats fading
  AGAINST it by about 0.05R (Welch t under 2 in each window), never enough to cover costs. Reported, not a rule.
- Fades overlap freely (as the parent); month sums carry that, but trades of one day are not independent.
- Costs are today's demo figures charged on every year; the fade's M15 stop is small, so cost takes a large share of R.
- The breakout itself is not traded here; this asks only whether the day's breakout picks better fades.
