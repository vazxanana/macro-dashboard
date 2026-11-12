# The supported book, run as a book: pre-registration

Written and committed **before** any book-level number below was computed (11 Nov 2026). The question, the records, the
windows, the costs, the metrics and the pass bar are fixed here; nothing in them changes after the results are seen. Anything
added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes, whatever the outcome.

## Why this study

On 11 Nov 2026 the owner made the live paper book **Gold trend (20-day, `gtrend`) + Gold daily engulf (`geg`)**. The review
behind that decision said plainly: "the two-system book itself has not been run as a book". Its figure ("about +6R a year
after financing") was put together from two other studies: the four-system book of `research/edge/honest-book` and the
first-unit financing table of `research/edge/trend-breadth`. This study runs the two-system book itself, day by day, with
financing on every unit, and puts one pre-registered question to it.

## What is already known (seen before this was written)

- Per position, untouched 2006-17, after the flat cost and before financing (`gold-systems-oos`): Gold trend +0.489R
  (n 75, t 1.77), Gold daily engulf +0.186R (n 256, t 1.89), Gold trend fast +0.372R (n 129, t 1.92).
- By close day in `honest-book` W1: Gold trend +32.3R (74 positions), engulf +47.6R (256), so the two together +79.9R
  before financing. The four-system book B there had a daily t of 2.37 before financing.
- `trend-breadth` Part A: first-unit financing at today's rate took 6.8R from Gold trend and 11.5R from the engulf on that
  window; the daily harness suggested the trend leg's add unit raises its financing by about a third.
- Not known: the two-system book's daily series, its t, drawdown, drawdown length, worst year, the legs' correlation
  inside this book, the time in the market, or any of these after financing on every unit.

## Records

The per-position records of `research/edge/gold-systems-oos/result.json` (`positions`: the live rules of 7 Nov 2026 replayed
unchanged on OANDA gold M5 / H4 / D1, 2006-2026). Those records sum a position's units and do not carry the add unit's own
entry time, price or risk, which financing needs. So the same committed engine
(`research/edge/gold-systems-oos/replay.mjs`, not edited) is run once more on the same candles and its **unit-level** output
for `gtrend`, `gtrend5` and `geg` is committed here as `legs.json` (`node run.mjs legs <replay trades.json>`):
`sys, id, of` (the first unit's id for an add), `t` (fill, unix), `c` (close), `e` (entry), `r0` (initial risk), `R`
(gross, as the engine booked it), `end` (still open at the end of the data).

**Gate, before anything is computed from it:** summed by position, `legs.json` must reproduce every `gtrend`, `gtrend5` and
`geg` position of the committed `result.json` (same ids, same close minute, gross R within 0.002). If it does not, the
study stops and says so. Expired and missed orders are not positions.

## Costs (per unit, as a share of that unit's own risk)

- **Spread and slippage:** the flat round trip the source study used: x1 = $0.30 a unit, x2 = $0.60.
- **Overnight financing:** `council/fills.mjs` `nights(t, c)` (Monday-Friday 22:00 UTC rollovers strictly inside the hold, a
  Wednesday counts three) × `FIN.xau.long` (0.000148 of price, the demo broker's rate of 11 Nov 2026) × the unit's entry
  price ÷ the unit's `r0`: the live cost model's own method and constant, imported, on **every** unit (first and add).
  F1 = that rate. F½ = half of it, reported beside it (the broker's past rates are not known; neither is called the truth
  for the past). F0 = no financing, reported for comparison with the earlier studies.
- **The verdict is read at x1 with F1.**

## Books (fixed 1R a unit, exactly as the source study and the live Trader size them)

| book | systems |
|---|---|
| **S2, the supported book** (the question) | `gtrend`, `geg` |
| S3, with the fast leg (reported; the owner may ask) | `gtrend`, `geg`, `gtrend5` |

## Daily series and windows

- UTC calendar days, weekdays only. A position's net R is booked on the day its last unit closes (a Saturday / Sunday close
  moves to Monday), as in `honest-book`. A day with no close is 0R.
- **W1, untouched: 2006-07-01 to 2017-12-31**, halves 2006-07 to 2011-12 and 2012-01 to 2017-12. Every rule here was built
  on 2018-26, so this is the only window that can test anything. **The verdict is decided on W1.**
- W2, built on: 2018-01-01 to 2026-10-31. Reported, never a test.
- W3: 2020-01-01 to 2026-10-31, the "2020 → now" window the owner asks for. For these rules all of it is **in sample**
  (there is no out-of-sample stretch after 2018); it is reported and labelled so.
- A unit still open at the end of the data (`end`) is booked at its marked value on the last day.

## Metrics (S2 and S3; each window; x1 and x2; F0, F½, F1)

Positions, units, total net R, **R a year**, mean net R a position with its per-position t, **t on daily book R** (mean ÷ sd
× √weekdays), t on calendar-month sums, **worst drawdown** of the cumulative daily series (peak floored at 0) with its
**length** (weekdays from the peak to the day the peak is regained, or to the window's end if it is not), the longest time
under water, **worst calendar year** and positive years, total by half, the **correlation of the two legs** (daily and
monthly net R; S3: every pair), the **share of weekdays with at least one unit open** and the mean units open, the share of
days both systems are open, financing R in total and a year, and a month-block bootstrap (2,000 draws, seed 1) 90 % interval
for R a year and for return ÷ drawdown.

**Marked to market (reported beside the closed-trade figures):** the same book with open units valued at each day's gold
close (`research/edge/honest-book/gold-1d.json`): equity(day) = closed net R to date + Σ open units (close − entry) ÷ r0.
Its worst drawdown and length are reported because a trend position gives back open profit before it closes; the
closed-trade drawdown understates what the account shows on the way.

**What a year means:** R a year × 0.25 % (the sizing guide of a quarter of a percent of the account a unit), with the
worst drawdowns (closed and marked) × 0.25 % beside it, and the bootstrap interval.

## The one question and its pass bar

**On data none of the rules saw, after spread, slippage and financing on every unit at today's rate, is the supported
two-system book's return distinguishable from zero?**

**PASS** only if all three hold for S2 on W1:
1. t on daily book R at x1, F1 is **at least 2**;
2. total net R at x1, F1 is above 0 in **both** halves;
3. total net R at x2, F1 is above 0.

Otherwise **FAIL** (the book is positive-but-unproven, or not positive: the text says which, with n and t). One book, one
window, one statistic: no selection, so no multiple-test correction applies to the verdict. S3, W2, W3, F½, F0, the marked
series and the monthly t are sensitivities and cannot change it.

## Study B, decided now

Whether a sizing study follows, and what it compares, is fixed here before A's numbers exist:

- **B is run only if S2's total net R on W1 at x1, F1 is above 0** (sizing a book that lost on untouched data is not worth a
  test). If not, A's RESULT.md says so and there is no B.
- **Its one comparison would be the trend leg's pyramid add, on (as live) against off**, at book level with financing, on
  W1 by return ÷ drawdown with a paired bootstrap interval, under its own pre-registration (`research/edge/book-sizing`).
  Why this and not weights between systems: weights were tested twice (`research/edge/sizing`: keep fixed 1R;
  `research/edge/portfolio-v2`: no edge on untouched data). The add is the one sizing element inside the supported book
  never judged at book level, and it is the unit that pays the most financing. Known already, per position and before
  financing (`gold-systems-oos` diagnostics): first unit alone +0.362R (t 2.09), with the add +0.489R (t 1.77).

## What the result may be used for

A statement to the owner of what the approved book has done on untouched data and what a year of it looks like. A PASS
does not make the book an edge beyond its n and t, and does not change its size. A FAIL does not reverse the owner's
decision (the alternative books did worse on the same data); it sets the expectation. Any change is a proposal.
