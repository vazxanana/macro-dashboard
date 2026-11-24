# The breakout managed by structure: exit on the first ChoCh against the trade (result)

**Verdict: FAIL. 0 of 3 ChoCh exits beat T1's own exit; the best, E3 H1 ChoCh, changed R by -0.002 a trade in 2016-26 (n 4,117, month t -0.86; early -0.002, t -0.85) against T1's +0.052R after costs.**

Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live
changed, nothing is proposed. One run, no variants.

## What was run

T1 (k 0.5, both sides, out at 21:00 UTC) on gold and USD/JPY, OANDA mid 5-minute candles; the same trades exited also at the
first ChoCh against the position on M5, M15 or H1 (edgekit `structure`, 3 a side, closed candles), else as T1. Paired per
trade (exit minus T1's own) before costs, month-sum t, early 2005-2015 / late 2016 to Oct 2026; costs beside (gold $0.60 a
round trip, USD/JPY the demo commission + half a pip). The T1 years were read before: a pass would only go to a forward record.

## Gold + USD/JPY pooled

| Exit | n early | R / net early | change (t) early | n late | R / net late | change (t) late | left on ChoCh late | Holm | Pass |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| base | 3,890 | +0.146 / +0.087 | - | 4,117 | +0.105 / +0.052 | - | - | - | - |
| E1 M5 ChoCh | 3,890 | +0.054 / -0.006 | -0.092 (-4.77) | 4,117 | +0.020 / -0.033 | -0.085 (-5.32) | 89% | 1.000 | no |
| E2 M15 ChoCh | 3,890 | +0.101 / +0.042 | -0.045 (-3.35) | 4,117 | +0.067 / +0.014 | -0.038 (-3.51) | 56% | 1.000 | no |
| E3 H1 ChoCh | 3,890 | +0.145 / +0.085 | -0.002 (-0.85) | 4,117 | +0.103 / +0.050 | -0.002 (-0.86) | 4% | 1.000 | no |

## Per market (after costs; change against T1's own exit, month t)

| Exit | Market | net early | change early (t) | net late | change late (t) |
|---|---|---:|---:|---:|---:|
| base | xau | +0.096 | +0.000 (0.00) | +0.041 | +0.000 (0.00) |
| base | usdjpy | +0.079 | +0.000 (0.00) | +0.063 | +0.000 (0.00) |
| E1 M5 ChoCh | xau | -0.024 | -0.119 (-4.36) | -0.067 | -0.108 (-4.91) |
| E1 M5 ChoCh | usdjpy | +0.010 | -0.069 (-3.10) | -0.000 | -0.063 (-3.12) |
| E2 M15 ChoCh | xau | +0.053 | -0.042 (-2.29) | -0.001 | -0.042 (-2.82) |
| E2 M15 ChoCh | usdjpy | +0.032 | -0.047 (-2.83) | +0.028 | -0.034 (-2.41) |
| E3 H1 ChoCh | xau | +0.092 | -0.003 (-1.50) | +0.040 | -0.002 (-0.52) |
| E3 H1 ChoCh | usdjpy | +0.079 | +0.000 (0.05) | +0.061 | -0.002 (-0.68) |

## Checks

- T1 reproduced on USD/JPY: early n 2,089, +0.079R after costs (published 2,089, +0.079); late n 2,068, +0.063R (published 2,079, +0.063). Small differences come from the candle cache (same OANDA feed, fetched again).
- The ChoCh exit uses only candles closed before it (the exit is at the next 5-minute open); the stop never moves; every trade has its stop on the losing side (the run throws otherwise).

## What it means

Getting out of the breakout on a ChoCh against it does not improve T1: whatever the structure says during the day, holding to 21:00 is as good or better. Structure breaks did not complement the one rule here that passes, as a filter, an entry or an exit. Nothing live changed; no rule is proposed.
