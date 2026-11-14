# Result: gold after a weekly candle with a long wick (14 Nov 2026)

**Verdict: FAIL, 1 of 4 checks: trading gold the way a long weekly wick points lost -0.070R a trade net in 2017-26 (n 73, month t -0.55); in sample +0.115R (n 72, t 0.80).**

Pre-registered in `PREREGISTRATION.md` (pushed alone, before `run.mjs` existed). Paper research only; a stand-alone weekly rule,
never a gate, exit, entry or size of the live gold book (Gold trend / Gold daily engulf), and none of that book's 2006-17
positions was read (item 44). Nothing live changed and no proposal follows.

Rule: OANDA mid H1 XAU_USD (20 Mar 2006 to 13 Nov 2026, 125,704 candles) grouped into 17:00 New York days
(`gold-drd-long` `days()`) and Monday-Friday weeks. A completed week of at least 4 days and a range of at least half the
20-week average range is a **buy** when its lower wick is more than 60 % of the range, a **sell** when its upper wick is.
Market entry at the next week's first H1 open, stop $0.30 past the signal week's low (buy) or high (sell), checked on H1 (a
gap fills at the open), otherwise out at the close of the 10th trading day (T2: the 5th). One position at a time. Net of
$0.60 a round trip and, on buys, `nights` x `FIN.xau.long` (0.000148 of price a rollover). t on calendar-month sums of net R
by exit month; Holm over three; placebo of 40 seeded draws (seed 20261114).

## Tests

| Test | Window | n (buy / sell) | Gross R | Net R | Net R at 2x costs | Spread R | Financing R | Win % | Stops | Median stop $ | Month t (net) | Month t (gross) | Worst drawdown R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 both sides, 10 days (primary) | 2007-16 | 72 (45 / 27) | +0.176 | +0.115 | +0.055 | 0.022 | 0.039 | 48.6 | 26 | 31.86 | 0.80 | 1.21 | -7.0 |
| T1 both sides, 10 days (primary) | 2017-26 | 73 (35 / 38) | -0.016 | -0.070 | -0.125 | 0.019 | 0.036 | 43.8 | 31 | 37.23 | -0.55 | -0.12 | -9.8 |
| T2 both sides, 5 days | 2007-16 | 84 (51 / 33) | +0.054 | +0.009 | -0.037 | 0.023 | 0.023 | 51.2 | 22 | 30.39 | 0.09 | 0.54 | -5.6 |
| T2 both sides, 5 days | 2017-26 | 85 (41 / 44) | +0.111 | +0.072 | +0.033 | 0.019 | 0.020 | 50.6 | 20 | 37.07 | 0.74 | 1.13 | -3.5 |
| T3 buys only, 10 days | 2007-16 | 47 | +0.248 | +0.161 | +0.074 | 0.022 | 0.065 | 53.2 | 15 | 30.72 | 0.91 | 1.37 | -5.2 |
| T3 buys only, 10 days | 2017-26 | 41 | +0.131 | +0.037 | -0.057 | 0.019 | 0.075 | 51.2 | 16 | 34.93 | 0.22 | 0.75 | -6.1 |
| Baseline: buy every eligible week, 10 days | 2007-16 | 332 | +0.112 | -0.006 | -0.123 | 0.053 | 0.065 | 34.0 | 182 | 19.64 | -0.05 | 1.08 | -67.8 |
| Baseline: buy every eligible week, 10 days | 2017-26 | 303 | +0.119 | -0.013 | -0.146 | 0.047 | 0.085 | 35.3 | 166 | 22.97 | -0.14 | 1.21 | -44.4 |

Out-of-sample p (two-sided, normal) / Holm-adjusted: T1 0.58 / 1.00, T2 0.46 / 1.00, T3 0.83 / 1.00.

## Checks (T1, all required)

| Check | Bar | Result |
|---|---|---|
| OOS net month t, Holm | t >= 2 and Holm p < 0.05 | -0.55, Holm p 1.00: **no** |
| In-sample net mean, same sign | > 0 | +0.115: yes |
| OOS net mean at 2x costs | > 0 | -0.125: **no** |
| Placebo (40 random weeks, T1's buy / sell counts) | above its 95th percentile (0.81) | -0.55: **no** (median -1.18; 10 of 40 draws at or above it) |

## Reading

- The in-sample gain (+0.115R a trade, t 0.80) did not carry over: out of sample the two-week book lost -0.070R a trade, and
  before any cost it was flat (-0.016R). The sells lost most of it: the OOS years are gold's strongest rise.
- Costs are small next to the stop (median stop $31-37; spread 0.02R, financing 0.04R on the book), so the failure is not a
  cost story: there is nothing to cost.
- The buy side (T3) beats the unconditional weekly buy's gross by about 0.01-0.14R a trade, with t under 1 in both windows: a
  long lower wick says little more about gold's next two weeks than any week does.
- The one-week hold (T2) is +0.072R OOS (t 0.74), negative at 2x costs in sample: noise.
- By year, T1's net R swings between -4.7R and +8.4R with no run of either sign (`result.json` `yearsT1`).

Not an edge; never call it one. A FAIL closes this reading of the weekly wick on gold. To repeat:
`node --use-env-proxy research/edge/gold-weekly-wick/run.mjs fetch <dir>` (candles outside git), then
`node research/edge/gold-weekly-wick/run.mjs full <dir>`. Test: `tests/gold-weekly-wick.test.mjs`.
