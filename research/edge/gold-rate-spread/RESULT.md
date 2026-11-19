# Result: does the US-German 10-year rate gap lead spot gold? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: trading gold the dollar-weakening way after a 1 sd 4-week move in the US-Bund 10-year gap makes +0.003R a trade net out of sample 2017-26 (n 100, month t 0.03); in sample -0.027R.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (commit 01cbf51cb, pushed alone before any number was computed).
Paper research only, a **stand-alone cross-asset rule** on spot gold: not a gate, entry, exit or size of the live gold book,
never compared with it, and the book's 2006-17 window and positions were not used (owner decision 44). No live rule, size,
filter, stop, config, cost constant or council member changed. No proposal is written.

## What was tested (as registered)

- Data: council-data `research/daily/xau.json`, `usb10y.json`, `de10yb.json` at the registered commit `60e9d956` (OANDA mid
  daily candles; gold 2006-03-20 to 2026-11-06, the two bond CFDs from March 2003), weekends folded with `foldWeekend`.
- Gap move `S = ln(US 10y bond / 20 common days ago) - ln(Bund / 20 common days ago)`; z against the 250 earlier common
  days. On gold's last candle of each week: z > +1 (US yields fell relative to German) = long gold, z < -1 = short gold.
- Entry at the next gold open (the Sunday reopen), stop 2 x ATR(20) (median $40.25 in sample, $47.81 out of sample), out at
  the close of the 10th gold candle, one position at a time. Costs $0.60 a round trip plus `nights()` x `FIN.xau.long` x
  entry on buys.
- **Cost share**: 0.039R a trade in sample and 0.054R out of sample, 4.8 % and 6.4 % of the mean absolute gross R. Costs
  are not what decides this rule: before costs it makes +0.012R (IS) and +0.057R (OOS) a trade, month t 0.13 and 0.51.

## The three tests

| Test | Window | n (long / short) | Win % | Gross R a trade | Net R a trade | Net at 2x costs | Total net R | Month t gross | Month t net | Stops |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 both-sided gap rule (primary) | IS 2007-16 | 114 (53 / 61) | 46.5 | +0.012 | -0.027 | -0.066 | -3.09 | 0.13 | -0.30 | 36 |
| | OOS 2017-26 | 100 (55 / 45) | 44.0 | +0.057 | +0.003 | -0.050 | +0.34 | 0.51 | **0.03** | 30 |

| Leg against its baseline | Window | Leg n | Leg net R | Baseline n | Baseline net R | Excess R | Excess at 2x costs | Month t of excess |
|---|---|---|---|---|---|---|---|---|
| T2 longs vs long every week | IS 2007-16 | 53 | -0.045 | 282 | -0.004 | -0.041 | -0.037 | -0.33 |
| | OOS 2017-26 | 55 | +0.126 | 269 | +0.094 | +0.032 | +0.026 | **0.20** |
| T3 shorts vs short every week | IS 2007-16 | 61 | -0.012 | 276 | -0.074 | +0.063 | +0.065 | 0.48 |
| | OOS 2017-26 | 45 | -0.147 | 282 | -0.187 | +0.040 | +0.042 | **0.28** |

| Test | OOS p (one-sided) | Holm p | OOS t >= 2 and Holm < 0.05 | IS > 0 | OOS 2x > 0 | OOS n >= 30 | Placebo (draws >= real t) | Pass |
|---|---|---|---|---|---|---|---|---|
| T1 | 0.488 | 1.000 | no | no | no | yes | 18 of 40 (needs <= 2) | **no** |
| T2 | 0.421 | 1.000 | no | no | yes | yes | | **no** |
| T3 | 0.390 | 1.000 | no | yes | yes | yes | | **no** |

**Baseline comparison.** Out of sample a long gold position held two weeks from any Friday made +0.094R a trade net (n 269)
and a short -0.187R (n 282): that is gold's rise. The gap rule's longs beat the unconditional long by only +0.032R (t 0.20)
and its shorts lose a little less than the unconditional short (+0.040R, t 0.28). The rule's tiny positive OOS total is
the long side riding the same rise, not the rate gap.

**Placebo** (40 seeded draws of 152 signals with the same long / short counts on random OOS weeks): median month t -0.07,
95th percentile 1.46, 18 of 40 draws at or above the real t of 0.03. The rule is indistinguishable from random timing.

**By year (T1 net R)**: in sample +4.5 (2007), +3.3 (2008), then negative or flat every year 2009-16; out of sample
+3.7, +1.4, -2.2, -1.5, +1.8, -7.1 (2022), +2.3, -1.7, +1.7, +2.0 (2017-26). No stable sign.

## Informational (no verdict, not in Holm)

| Variant | IS n | IS net R | IS month t | OOS n | OOS net R | OOS month t |
|---|---|---|---|---|---|---|
| I1 5-day gap move, held 5 candles | 152 | +0.074 | 1.26 | 125 | -0.060 | -0.95 |
| I2 US 10-year bond alone | 119 | +0.018 | 0.19 | 115 | -0.054 | -0.54 |
| I3 Bund alone | 125 | -0.099 | -1.44 | 123 | -0.027 | -0.27 |

The faster version (I1) looked positive in sample and reversed out of sample. Neither bond alone carries a lead either,
in line with `gold-bond-lead` (FAIL) on the US bond.

## Reading

The economic story (a narrowing US-German rate gap weakens the dollar and lifts gold) leaves no tradable trace at a
two-week horizon on spot gold, 2007-26: before costs the both-sided rule is within 0.06R a trade of zero in both windows,
and each leg is within noise of the plain same-side position. Not an edge, not a filter; nothing live changes.

To repeat: `node research/edge/gold-rate-spread/run.mjs fetch <dir>` (git show of the registered council-data commit, no
network, kept out of git), then `node research/edge/gold-rate-spread/run.mjs full <dir>`. Test:
`tests/gold-rate-spread.test.mjs`.
