# Trendline break, retest and M15 QM on gold: result (23 Nov 2026)

**Verdict: INCONCLUSIVE** (by the pre-registered rule: T1 has 6 out-of-sample trades, under the 30 required). Read it as
"too rare to judge, and nothing in the record points to an edge": no test meets any part of the bar that needs a t, and
the 2010-2019 replication of T1 loses after costs.

Pre-registration: `PREREGISTRATION.md` (committed before this code). Code: `run.mjs` (imports the shared toolkit).
Data: OANDA mid 5-minute gold, 2010-01-03 to 2026-11-22, grouped to H1 / M15 / H4. Costs $0.30 a round trip.

| Test | 2010-2019: n / mean R (month t) | IS 2020-23: n / mean R (month t) | OOS 2024-: n / mean R (month t) | OOS at 2x costs | OOS before costs | Holm p |
|---|---|---|---|---|---|---|
| T1 | 49 / -0.190 (t -1.07) | 10 / +0.614 (t 1.16) | 6 / -0.205 (t -0.42) | -0.234 | -0.176 | 1.000 |
| S1 | 21 / -0.062 (t -0.23) | 1 / +1.109 (t 1.00) | 3 / +0.612 (t 0.80) | +0.576 | +0.649 | 1.000 |
| S2 | 145 / -0.223 (t -2.02) | 56 / -0.233 (t -1.31) | 38 / +0.034 (t 0.14) | -0.001 | +0.070 | 1.000 |

Mean R is per trade after costs; month t is on calendar-month sums with empty months counted as zero. T1 = the rule with
the swing target; S1 = T1 only with the H4 structure side; S2 = T1's entries with a fixed 2R target.

## What happened, in plain words
- The trendline breaks are common (4,460 in 17 years), but the full chain is rare: 815 never retested within 24 H1
  candles, 3,386 retested with no M15 QM of the trade's side within 16 M15 candles, 10 were cancelled by a close 1 ATR
  back through the line. 247 setups reached an entry; 182 of them had no H1 swing target 1R or more away (the latest swing
  beyond the entry is usually close), so T1 traded 65 times in 17 years, about 4 a year.
- T1 lost in 2010-2019 (-0.19R a trade, n 49) and out of sample (-0.20R, n 6); the 2020-23 plus (+0.61R, n 10) is ten
  trades. S1 has 25 trades in all. S2, the one stream with enough trades, loses in 2010-2019 (-0.22R, n 145, month t -2.02)
  and in 2020-23 (-0.23R, n 56) and is flat out of sample (+0.03R, n 38, month t 0.14; -0.001R at 2x costs).
- By side and by year: `result.json` (`bySide`, `byYear`). No year pattern stands out beyond noise.

## What it does NOT show
- It does not judge trendlines drawn by eye: the line here is the straight line through the last two confirmed 3-a-side
  H1 swings, nothing else. A trader's choice of which line matters is not in any rule.
- It does not say the method loses with enough trades: T1 has too few trades to judge either way, which is why the
  verdict is INCONCLUSIVE rather than FAIL. S2's loss on 201 trades before 2024 is the clearer signal, and it is negative.
- One reading of an unspecified detail: ATR(14) is the simple mean of the last 14 H1 true ranges at the break (the
  pre-registration names no smoothing). Holm counts a test whose out-of-sample t is not positive as p = 1.
- No variant (swing size, tolerances, windows, targets) is run after this result, as the pre-registration says.

Nothing live changed. Research only, paper only.
