**Verdict:** FAIL: within noise (no proposal, the live rule stays). On untouched 2006-17, after costs and financing, the two-system book with the Gold trend add made +59.3R on a 19.8R drawdown (return ÷ drawdown 2.99, t 1.86) and without it +54.3R on 18.9R (2.87, t 1.94); the difference is −0.12 with a bootstrap interval of −0.99 to +0.99.

# Book sizing: the trend leg's pyramid add, on against off (11 Nov 2026)

Paper research only. No live rule, size, filter, stop, config or council member was changed. The comparison was fixed in
`research/edge/supported-book/PREREGISTRATION.md` before that study ran, and its statistic and reading in
`PREREGISTRATION.md` here (commit 570305a2) before any number below was computed.

**The question.** The live Gold trend rule buys one more unit after a daily close 1R above the entry. Is the supported
book (Gold trend + Gold daily engulf) better with that add or without it, on data the rule never saw, after financing?

**The answer: the evidence does not separate them.** Nothing is proposed; the add stays as it is.

## Untouched 2006-07 to 2017-12 (x1 costs, financing on every unit at today's rate)

| | **ON** (as live) | **OFF** (first units only) |
|---|---|---|
| positions (units) | 330 (364) | 330 (330) |
| net R | +59.3 | +54.3 |
| R a year | +5.16 | +4.72 |
| t on daily book R | 1.86 | 1.94 |
| worst drawdown, closed trades | 19.8R (not regained by the end of 2017) | 18.9R (not regained) |
| worst drawdown, marked to market | 22.1R | 20.0R |
| **return ÷ drawdown** (the pre-registered statistic) | **2.99** | **2.87** |
| financing paid | 20.5R | 17.8R |
| Gold trend leg alone: net R, R a position (t) | +23.1, +0.313 (1.20) | +18.1, +0.245 (1.48) |

**Difference OFF − ON in return ÷ drawdown: −0.12.** Paired month bootstrap (2,000 draws): 90 % interval **−0.99 to
+0.99**, P(OFF better) **0.535**. By half: +0.45 in 2006-11, −0.04 in 2012-17. At doubled costs: −0.12.

**Pre-registered reading: within noise.** Neither "OFF is better" (it needed P ≥ 0.95, both halves and doubled costs) nor
"ON is better" (P ≤ 0.05 and the mirror) holds. It is a coin toss.

### The add units by themselves

| leg | window | add units | net R | mean net R | t | share with a profit | financing paid |
|---|---|---|---|---|---|---|---|
| Gold trend (20-day) | **untouched 2006-17** | 34 | +5.0 | +0.148 | 0.60 | 35 % | 2.7R |
| | built on 2018-26 | 29 | +31.4 | +1.082 | 2.45 | 52 % | 3.9R |
| Gold trend fast (shadow) | **untouched 2006-17** | 51 | +8.4 | +0.166 | 0.82 | 39 % | 4.5R |
| | built on 2018-26 | 36 | +44.3 | +1.230 | 3.06 | 61 % | 5.0R |

- On untouched data the add is a small plus with no evidence behind it: **+5.0R from 34 units in eleven and a half years
  (t 0.60)**. It raises the book's return by a tenth and its drawdown by about as much, and takes the trend leg's own t
  from 1.48 to 1.20 (more R, more noise).
- On the years the rule was built on the add looks seven times better (+1.08R a unit, t 2.45). That is what a setting
  chosen on those years looks like on those years; it is not evidence.

## The built-on years (in sample, not a test)

| window | ON: net R, drawdown, return ÷ drawdown | OFF | difference | P(OFF better) |
|---|---|---|---|---|
| 2018-01 to 2026-10 | +118.1R, 11.3R, 10.42 | +86.7R, 11.3R, 7.65 | −2.77 | 0.011 |
| 2020-01 to 2026-10 ("2020 → now", in sample) | +103.0R, 8.1R, 12.76 | +78.5R, 9.0R, 8.75 | −4.01 | 0.033 |

In the years gold trended hardest the add earned a quarter of the book's profit for no extra closed drawdown. The add was
chosen on these years, so they cannot judge it.

## With Gold trend fast in the book, and other cost bases (reported, never part of the reading)

Untouched 2006-17: three-system book ON +86.4R on 29.5R (2.93, t 1.77), OFF +72.9R on 26.9R (2.71, t 2.01); difference
−0.22, interval −1.49 to +1.52, P 0.532. Two-system book at half the financing rate: ON 3.68, OFF 3.51 (P 0.491);
without financing: ON 4.45, OFF 4.21 (P 0.449). The reading is the same on every basis.

## What this does and does not say

- **Said:** switching the add off would not have made the supported book better or worse on untouched data by any amount
  the data can see. There is no sizing change to propose.
- **Said:** the add's large built-on figures should not be expected forward. The honest expectation for it is about zero
  to a little positive (+0.15R a unit, t 0.6).
- **Not said:** that the add is harmful. It pays about a quarter of the trend leg's financing, and it still came out ahead
  on untouched data by +5R.
- **No other sizing question is worth a test now.** Weights between systems were tested twice (`research/edge/sizing`,
  `research/edge/portfolio-v2`) and the book has two legs with a correlation near zero; the remaining lever is the
  per-unit risk itself, which scales return and drawdown together and is the owner's choice, not a research question.

## To repeat

`node research/edge/book-sizing/run.mjs` (reads `research/edge/supported-book/legs.json`; no network). Tests:
`tests/book-sizing.test.mjs`.
