# Gold time-of-day periodicity: result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: the strongest block lost −0.072R a trade net out of sample (n 2,537, month t −5.37), +0.006R before costs, and did worse than the same trades moved to a random block.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any block statistic was computed). Code: `run.mjs`. Every figure:
`result.json`. A new stand-alone rule, not a gate, exit, entry or size of the gold book; none of the book's positions is read
(docs/owner-decisions.md item 44). Paper research only: nothing live changed and no proposal is written.

## Rule (as pre-registered)

- Spot gold, OANDA mid XAU/USD H1, 125,704 candles, 21 Mar 2006 to 13 Nov 2026; 5,346 UTC weekdays, 26,540 complete blocks.
- Five 4-hour blocks of the UTC day (00-04, 04-08, 08-12, 12-16, 16-20); 20-24 UTC never read. Each block on day d is traded
  on the sign of its own mean log return over its last L complete occurrences on EARLIER days (same-block periodicity, after
  Heston, Korajczyk and Sadka 2010).
- Market at the block's first open, stop 1.0 x the block's mean range over the same L days (every trade has a stop), out at
  the block's last close. $0.60 a round trip; financing on buys is 0 by construction (no block crosses the rollover).
- T1 (primary): the block with the largest |z| of the day, L 20. T2: the same, L 60. T3: every block, L 20.
- Placebo (40 seeds): each trade keeps its day and side and is moved to another block of the same day (T3: the day's sides
  shuffled across its blocks). It is the same-side, same-day baseline: it carries the same exposure to gold's rise.

## Results

| Test | Window | n | Buys | Gross R | Net R | Net at 2x | Win % | Total net R | Worst DD R | t net (months) | t gross |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 strongest block, L 20 (primary) | IS 2007-16 | 2,589 | 1,310 | +0.017 | −0.080 | −0.177 | 45.1 | −206.56 | −218.63 | −5.80 | +1.29 |
| T1 strongest block, L 20 (primary) | OOS 2017-Oct 26 | 2,537 | 1,365 | +0.006 | −0.072 | −0.151 | 44.7 | −182.91 | −193.74 | −5.37 | +0.49 |
| T2 strongest block, L 60 | IS 2007-16 | 2,589 | 1,329 | +0.004 | −0.091 | −0.185 | 43.3 | −234.92 | −246.86 | −6.22 | +0.28 |
| T2 strongest block, L 60 | OOS 2017-Oct 26 | 2,537 | 1,482 | −0.014 | −0.092 | −0.170 | 43.3 | −233.44 | −234.40 | −7.24 | −1.19 |
| T3 every block, L 20 | IS 2007-16 | 12,866 | 6,518 | +0.016 | −0.079 | −0.174 | 43.8 | −1,017.79 | −1,023.91 | −11.15 | +2.73 |
| T3 every block, L 20 | OOS 2017-Oct 26 | 12,620 | 6,611 | −0.014 | −0.089 | −0.164 | 43.5 | −1,125.07 | −1,129.34 | −13.07 | −2.55 |

Costs averaged 0.075-0.097R a trade (the $0.60 against a 4-hour block's mean range). Holm-adjusted p is 1.000 for all three
(every out-of-sample net t is negative).

| Placebo, OOS mean net R (40 seeds) | Median | 95th percentile | Range | Rule |
|---|---|---|---|---|
| T1 (another block, same day and side) | −0.057 | −0.043 | −0.078 to −0.037 | −0.072 |
| T2 | −0.060 | −0.042 | −0.102 to −0.041 | −0.092 |
| T3 (sides shuffled across the day's blocks) | −0.073 | −0.063 | −0.085 to −0.062 | −0.089 |

Each rule sits BELOW its placebo's median: picking the block by its own recent sign did worse than the same day and side in
a block picked at random.

| Pass-bar check (T1) | Needed | Got |
|---|---|---|
| OOS net month t, Holm | >= 2, adjusted p <= 0.05 | −5.37, p 1.000 |
| IS mean net R | > 0 | −0.080 |
| OOS mean net R at 2x costs | > 0 | −0.151 |
| OOS mean net R vs placebo 95th percentile | above −0.043 | −0.072 |

## What it says

- **There is no same-block memory in gold's day worth trading.** Before costs T1 makes +0.017R in sample (t 1.29) and +0.006R
  out of sample (t 0.49), and the longer memory (T2) is negative out of sample before costs.
- **The one gross hint reversed.** Trading every block (T3) was +0.016R before costs in sample (month t +2.73) and −0.014R
  out of sample (t −2.55): what persisted in 2007-16 turned against the rule in 2017-26.
- **Not a drift story either way.** Out of sample T1 bought 54 % of the time; buys lost −0.060R net (n 1,365, t −3.14) and
  sells −0.086R (n 1,172, t −4.60). No block of the day helps: every block's T1 picks are negative after costs (t −2.0 to
  −4.2). 16 of 20 years of T1 are negative after costs (2011, 2013, 2025 and 2026 the small exceptions, +0.3R to
  +8.0R; see `result.json` `years`).
- Not tested: half-hours or single hours (costs would be two to four times larger in R), and the 20-24 UTC hours.
- Not an edge. Nothing is proposed; no live rule, size, filter, stop, config or council member changed.

## To repeat

`node --use-env-proxy research/edge/gold-hour-periodicity/run.mjs fetch <dir>` (candles kept out of git), then
`node research/edge/gold-hour-periodicity/run.mjs <dir>/xau-1h.json`. Tests: `tests/gold-hour-periodicity.test.mjs`.
