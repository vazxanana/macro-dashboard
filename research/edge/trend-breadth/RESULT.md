**Verdict:** INCONCLUSIVE: overnight financing, which no cost model here counts, takes Gold trend from +0.49R to +0.40R a position on untouched 2006-17 (n 75, t 1.77 → 1.49), the daily engulf from +0.19R to +0.14R (n 256, t 1.89 → 1.46) and the H4 trendline from +0.05R to +0.01R (n 402, t 0.83 → 0.23, does not survive); the breadth test of the trend rule on other markets missed its parity gate on gold, so no breadth number is interpreted.

# Trend breadth and financing (11 Nov 2026)

Paper research only. No live rule, size, filter, stop, config or council member was changed. The criteria were committed
before any number was computed (`PREREGISTRATION.md`, commit 6466c80c).

## Part A: what financing takes from the gold systems

Every cost model in the repository counts the spread and slippage only. A long gold position on the demo broker also pays
financing each night it is held: 5.903 pips of 0.1 an ounce (the broker's own symbol record), which the demo account's own
deals confirm (−$0.59 for one ounce held one night near $4,100). That is 0.0148 % of the price a night, about 5.3 % a
year. Applied to every recorded position of `research/edge/gold-systems-oos` (first unit only, so positions with an add
are undercharged):

| system | window | n | nights held (mean) | net R a position, as recorded | t | financing, R | after financing (today's rate) | t | after (half rate) | t |
|---|---|---|---|---|---|---|---|---|---|---|
| Gold trend (N20) | **untouched 2006-17** | 75 | 14.3 | +0.489 | 1.77 | 0.090 | **+0.398** | **1.49** | +0.444 | 1.63 |
| | 2018-26 | 59 | 15.2 | +1.336 | 2.48 | 0.111 | +1.225 | 2.33 | +1.281 | 2.41 |
| | 2020-26 | 49 | 14.6 | +1.212 | 2.03 | 0.097 | +1.115 | 1.90 | +1.164 | 1.97 |
| Gold trend fast (N5) | **untouched 2006-17** | 129 | 14.6 | +0.372 | 1.92 | 0.083 | **+0.289** | **1.53** | +0.331 | 1.73 |
| | 2018-26 | 98 | 17.2 | +0.998 | 2.64 | 0.112 | +0.886 | 2.40 | +0.942 | 2.53 |
| | 2020-26 | 77 | 16.7 | +1.061 | 2.42 | 0.100 | +0.961 | 2.24 | +1.011 | 2.33 |
| Gold daily engulf | **untouched 2006-17** | 256 | 3.7 | +0.186 | 1.89 | 0.045 | **+0.141** | **1.46** | +0.163 | 1.68 |
| | 2018-26 | 195 | 3.2 | +0.277 | 2.21 | 0.043 | +0.234 | 1.89 | +0.256 | 2.05 |
| | 2020-26 | 150 | 3.2 | +0.334 | 2.30 | 0.038 | +0.296 | 2.05 | +0.315 | 2.18 |
| Gold H4 trendline | **untouched 2006-17** | 402 | 3.0 | +0.048 | 0.83 | 0.035 | **+0.013** | **0.23** | +0.031 | 0.53 |
| | 2018-26 | 318 | 2.9 | +0.175 | 2.51 | 0.041 | +0.134 | 1.95 | +0.155 | 2.23 |
| | 2020-26 | 242 | 2.9 | +0.219 | 2.73 | 0.037 | +0.182 | 2.29 | +0.200 | 2.51 |

The 2018-26 and 2020-26 rows are the years the rules were built on: they are shown for size, they prove nothing.

**Pre-registered reading (untouched window, today's rate).** Gold trend, Gold trend fast and Gold daily engulf **survive
financing** (mean above 0, t at least 1). The Gold H4 trendline **does not survive at today's rate**: +0.013R a position,
t 0.23, +5.4R in total over 402 positions and eleven and a half years.

What it means in a year, on the untouched window: financing took 6.8R from Gold trend, 11.5R from the daily engulf and
13.9R from the trendline over 11.5 years, about **2.8R a year** between the three. The "honest book" of
`research/edge/honest-book` (those three plus Mosha BO) made +9.4R a year there before financing, so about **+6.6R a year
after it at today's rate** (about +8.0R at half the rate), before counting the add units.

- No system has an out-of-sample t of 2 before financing, and none has one after it. Financing does not turn a positive
  record negative for the two trend legs or the engulf; it moves each of them further from being provable.
- The rate is today's. The repository has no history of the broker's rate; when dollar rates were near zero (2009-15,
  2020-21) the charge was nearer the half-rate column. Neither column is the truth for the past; today's rate is what a
  position opened now pays.
- A short gold position is credited (+2.785 pips a night at the broker today). All four systems are long only.

**With the add unit (daily harness, see Part B; its 2006-17 window passed the parity check, its 2018-26 window did not).**
Charging the add as well, the harness puts Gold trend's financing at 0.134R a position on 2006-17 (first unit alone:
0.090R) and its net at +0.37R (n 72, t 1.35); Gold trend fast 0.125R and +0.26R (n 125, t 1.40). So the first-unit table
above understates the cost of the trend legs by about a third.

## Part B: the Gold trend rule on other markets: harness not validated

**The parity gate missed, so by the pre-registration no breadth number is interpreted.**

| system | window | positions, gold-systems-oos | positions, daily harness | gross R a position, reference | daily harness | within the gate |
|---|---|---|---|---|---|---|
| Gold trend (N20) | 2006-07 to 2017-12 | 75 | 72 | +0.506 | +0.517 | yes |
| Gold trend (N20) | 2018-01 to 2026-10 | 59 | 51 | +1.347 | +1.644 | **no** (mean off by 0.30R; the gate allows 0.15R) |
| Gold trend fast (N5) | 2006-07 to 2017-12 | 129 | 125 | +0.387 | +0.404 | yes (not part of the gate) |
| Gold trend fast (N5) | 2018-01 to 2026-10 | 98 | 90 | +1.008 | +1.163 | no (not part of the gate) |

### Why it missed (post-hoc diagnostic, not part of the verdict)

Position by position on 2018-26: 50 positions match the reference by entry day, and on those the two harnesses differ by
+0.36R in total. The reference has nine positions the daily harness does not (2020-01-08, 2020-07-28, 2021-01-06,
2022-01-26, 2023-12-04, 2024-10-31, 2025-04-03, 2025-10-17, 2026-01-29), eight of them losers. They are entries the live
rule makes **inside a day**: when a position is stopped out while the last closed day is still a fresh breakout that has
not been used, the next run buys again at market (4 December 2023: stopped, bought again and stopped again the same day).
Daily candles cannot say what price did after the stop within the day, so a daily harness cannot place those trades. It
therefore leaves out mostly losing trades and reads **better** than the live rule. The pre-registered departures did not
foresee this; the gate caught it.

### The figures, not interpreted

Shown so that nothing is hidden. They are not a finding in either direction: the harness is known to flatter the rule.

| set (N = 20, x1 costs with financing) | 2007-19: n | net R a position | monthly t | 2020-26: n | net R a position | monthly t | at x2 costs | Holm p | positions a year, 2020-26 |
|---|---|---|---|---|---|---|---|---|---|
| B1 other metals (long) | 315 | +0.173 | 1.10 | 179 | −0.040 | −0.20 | −0.082 | 1 | 26 |
| B2 equity indices (long) | 1,186 | −0.096 | −1.41 | 709 | −0.097 | −1.29 | −0.113 | 1 | 104 |
| B3 energies and agriculturals (long) | 496 | +0.005 | 0.08 | 249 | +0.236 | 1.47 | +0.188 | 0.28 | 36 |
| B4 currency majors (both sides) | 1,073 | −0.067 | −0.92 | 578 | −0.225 | −3.62 | −0.242 | 1 | 85 |

Per market, N = 5 and the no-financing columns are in `result.json` under `uninterpreted`.

## What this does and does not say

- **Said:** the gold systems' "What to expect" figures leave out a real, recurring cost. On the untouched window it is
  about a fifth of Gold trend's per-position expectancy, a quarter of the engulf's and three quarters of the trendline's.
- **Not said:** whether the Gold trend rule carries to other markets. That needs a harness that can place the rule's
  intraday re-entries, so candles of an hour or finer for every market, and its own pre-registration. Nothing in Part B
  is evidence for or against it.
- **Not changed:** any gold system, `council/fills.mjs`, `council/expect-base.json`. Adding financing to the cost model and
  the expectations is a proposal for the owner (`research/proposals/2026-11-11-edge-review.md`).

## To repeat

`node research/edge/trend-breadth/run.mjs fetch <dir>` (copies the daily candle cache out of the `council-data` branch with
`git show`; no network), then `node research/edge/trend-breadth/run.mjs full <dir>`. Tests: `tests/trend-breadth.test.mjs`.
