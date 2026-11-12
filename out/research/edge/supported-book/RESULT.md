**Verdict:** FAIL: on untouched 2006-17, after costs and financing on every unit, the two-system book (Gold trend + Gold daily engulf) made +59.3R, +5.2R a year (330 positions, t 1.86 on daily book R, under the pre-registered 2), with a worst drawdown of 19.8R that began in 2014 and was not regained by the end of 2017; positive but unproven, and almost all of it earned in 2006-11.

# The supported book, run as a book (11 Nov 2026)

Paper research only. No live rule, size, filter, stop, config or council member was changed. The question, the records, the
costs and the pass bar were committed before any book number was computed (`PREREGISTRATION.md`, commit 6fc5b614).

**The question.** On data none of the rules saw (2006-07 to 2017-12), after spread, slippage and overnight financing on
every unit at today's broker rate, is the return of the owner's two-system paper book distinguishable from zero? Pass bar:
t on daily book R at least 2, both halves positive, still positive at doubled costs.

**The answer: FAIL on the first of the three.** t is 1.86. Both halves are positive (+55.3R and +4.0R) and the book stays
positive at doubled costs (+48.7R), so it is **positive but unproven**, not a losing book.

**Records.** The unit-level output of the committed `gold-systems-oos` engine (not edited, same candles): 963 units of the
three systems. Gate: summed by position they reproduce all 813 positions of the committed `result.json` (same ids, same
close minute, same gross R): 0 mismatches.

## The book on untouched data, 2006-07 to 2017-12 (fixed 1R a unit, booked on the close day)

| | **S2: Gold trend + daily engulf** (the live paper book) | S3: with Gold trend fast added |
|---|---|---|
| positions (units) | 330 (364) | 458 (543) |
| gross R | +90.4 | +134.2 |
| spread and slippage ($0.30 a unit) | −10.6 | −12.5 |
| financing, every unit, today's rate | −20.5 (1.8R a year) | −35.4 (3.1R a year) |
| **net R** | **+59.3** | +86.4 |
| **R a year** (90 % bootstrap interval) | **+5.2** (+0.3 to +10.3) | +7.5 (−0.1 to +15.4) |
| net R a position (per-position t) | +0.180 (1.89) | +0.189 (2.22) |
| **t on daily book R** (the pre-registered statistic) | **1.86** | 1.77 |
| t on monthly sums | 1.65 | 1.57 |
| 2006-07 to 2011-12 / 2012-01 to 2017-12 | +55.3 (t 2.14) / **+4.0 (t 0.22)** | +84.1 (t 2.01) / +2.2 (t 0.09) |
| **worst drawdown, closed trades** | **19.8R**, from 18 Mar 2014, low 30 Sep 2015, **not regained by the end of 2017** (988 weekdays, 3.8 years) | 29.5R, from 5 Oct 2012, not regained (1,365 weekdays, 5.2 years) |
| worst drawdown, marked to market | 22.1R (990 weekdays, not regained) | 31.9R (1,375 weekdays, not regained) |
| return ÷ drawdown (90 % interval) | 3.0 (0.1 to 8.9) | 2.9 (0.0 to 9.3) |
| worst year / positive years | 2013: −8.1R / 6 of 12 | 2013: −15.4R / 7 of 12 |
| months with a profit | 40 % | 38 % |
| at doubled spread and slippage | +48.7R (t 1.53; second half −0.9R) | +73.8R (t 1.52; second half −3.5R) |
| at half the financing rate | +69.6R (t 2.15) | +104.0R (t 2.09) |
| without financing (the earlier studies' basis) | +79.8R (t 2.43) | +121.7R (t 2.39) |
| share of weekdays with a unit open | 37 % (mean 0.56 units, at most 4) | 51 % (mean 1.17, at most 6) |

By year, S2: 2006 (from July) −2.8, 2007 +13.8, 2008 −4.4, 2009 +6.4, 2010 +23.9, 2011 +18.4, 2012 +9.6, 2013 −8.1,
2014 −2.5, 2015 −2.0, 2016 +12.2, 2017 −5.2.

### The two legs inside the book (S2, untouched, after financing)

| leg | positions | net R | R a position | per-position t | worst drawdown | financing | weekdays open |
|---|---|---|---|---|---|---|---|
| Gold trend (20-day) | 74 | +23.1 | +0.313 | 1.20 | 5.6R | 9.1R | 25 % |
| Gold daily engulf | 256 | +36.2 | +0.141 | 1.46 | 16.5R | 11.4R | 20 % |

- **The legs are close to uncorrelated**: daily net R 0.01, monthly 0.21. Both are open on 8 % of weekdays. That is why the
  book's t (1.86) is higher than either leg's (1.20, 1.46): the book is two different gold ideas, not one bet twice.
- **Financing on every unit costs Gold trend more than the earlier table said.** Charged on the first unit only
  (`trend-breadth` Part A) the leg kept +0.398R a position (t 1.49); with its add unit charged too it keeps **+0.313R
  (t 1.20)**. The add is bought after a 1R run, so its own risk is small and its financing, as a share of that risk, is
  large: 9.1R of financing for the leg against 6.8R on the first units alone.
- **Financing is the difference between passing and failing here.** Without it the book's t is 2.43; at half today's rate
  2.15; at today's rate 1.86. The broker's past rates are not known. Dollar rates were near zero in 2009-15, so the true
  past cost was probably between the half-rate and the no-financing column, but a position opened **today** pays today's
  rate, and that is the column the verdict was fixed on.

### Adding Gold trend fast (S3)

It adds 46 % more net R (+59.3 → +86.4) and 49 % more drawdown (19.8R → 29.5R), and lowers the book's t (1.86 → 1.77): it
is 0.91 correlated with Gold trend day by day, so it enlarges the trend position rather than adding a third idea. Return ÷
drawdown is the same (3.0 against 2.9). On this evidence there is **no case for or against** making it live: it is a size
decision, as the edge review said.

## The years the rules were built on (not a test)

| window | book | positions | net R | R a year | t daily | worst drawdown closed / marked | worst year |
|---|---|---|---|---|---|---|---|
| 2018-01 to 2026-10 (built on) | S2 | 255 | +118.1 | +13.4 | 2.99 | 11.3R (321 weekdays) / 13.7R | 2018: −5.0 |
| | S3 | 354 | +205.7 | +23.3 | 2.89 | 19.2R / 25.6R | 2018: −8.0 |
| 2020-01 to 2026-10 (**in sample**: "2020 → now") | S2 | 200 | +103.0 | +15.1 | 2.83 | 8.1R (313 weekdays) / 11.6R | 2022: −3.5 |
| | S3 | 278 | +179.3 | +26.2 | 2.73 | 10.4R / 20.5R | 2022: −1.1 |

There is no out-of-sample stretch after 2018 for these rules: both were chosen on 2018-26. These rows are three times the
untouched rate (+13.4R against +5.2R a year) in the years gold rose most; they show size, they prove nothing. 2025 alone is
+39.1R of S2's +118.1R.

## What a year means at 0.25 % risk a unit

| | untouched 2006-17 | built-on 2018-26 (not evidence) |
|---|---|---|
| S2 a year | **+1.3 %** (90 % interval +0.1 % to +2.6 %) | +3.3 % |
| S2 worst drawdown, closed / marked | **5.0 % / 5.5 %**, lasting almost four years | 2.8 % / 3.4 % |
| S3 a year | +1.9 % (0.0 % to +3.9 %) | +5.8 % |
| S3 worst drawdown, closed / marked | 7.4 % / 8.0 %, over five years | 4.8 % / 6.4 % |

In plain words: on the only data that can test it, the book earned about **one and a third per cent a year at a quarter
per cent of risk a trade, and at one point was down five per cent for almost four years**. Half the years lost. Six
tenths of months had no profit. Whoever runs it must expect long flat and falling stretches: from 2012 to 2017 it made
+4R in six years.

## What this does and does not say

- **Said:** the edge review's "+6R a year after financing" was a little high; the book itself gives **+5.2R a year**
  (interval +0.3 to +10.3) with a 20-22R drawdown. It is positive in both halves and at doubled costs, and it is not
  proven: t 1.86, and with financing counted on every unit neither leg alone has a t above 1.5.
- **Said:** the profit is concentrated: 2006-11 (gold's bull run) made +55.3R of the +59.3R. In the six years gold fell
  and ranged the book held its ground (+4.0R) but did not earn.
- **Not said:** that the owner's decision was wrong. Every other book tested on the same data did worse
  (`research/edge/honest-book`: the eight-system book +4.3R a year before financing with an 83R drawdown).
- **Not said:** anything about the future. Today's financing rate is the highest in the sample; if rates fall the cost
  falls with them.
- **Not changed:** any rule, size or config.

## The sizing question that is left (study B)

By the rule fixed in the pre-registration (S2 positive on untouched data → one sizing comparison, chosen then): **the
trend leg's pyramid add, on against off**, at book level with financing. This study shows why it is worth asking: the add
unit carries a quarter of the trend leg's financing on a small risk base. It is run under its own pre-registration in
`research/edge/book-sizing`.

## To repeat

`node research/edge/supported-book/run.mjs` (reads `legs.json`, the committed `gold-systems-oos/result.json` for the gate
and `honest-book/gold-1d.json` for the marked series; no network). `legs.json` is rebuilt with
`CANDLES=<dir> OUT_DIR=<dir> node research/edge/gold-systems-oos/replay.mjs`, then `node run.mjs legs <dir>/trades.json`.
Tests: `tests/supported-book-study.test.mjs`.
