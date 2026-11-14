# Pre-registration: gold-vol-breakout-with-book (14 Nov 2026)

**A descriptive note. No rule is tested, there is no pass or fail, and nothing live changes.** It describes how two records
that already exist sit side by side: the daily gold volatility breakout's paper record and the supported gold book's
recorded positions. It is **not** a gate, exit, entry or size of the live gold book (owner decision 44 holds: no such test
is run on that book's 2006-17 window, and none is run here), and it is **not** a sizing proposal. Any use of the breakout
is the owner's decision (see the forward-record proposal being prepared on branch `gold-vol-breakout-proposal`).

Written and pushed before any combined figure was computed.

## The two records, as they were recorded

- **The book** = Gold trend (`gtrend`) + Gold daily engulf (`geg`), the supported book of 11 Nov 2026, exactly as
  `research/edge/supported-book/` records it: its committed `legs.json` (unit records of the committed gold-systems-oos
  engine) through its own exported `positions()` and `bookStats()` (imported, not edited, not re-implemented), with its
  costs: $0.30 a unit and financing on every unit (`council/fills.mjs` `nights` x `FIN.xau.long`; variant `x1F1`). Its
  daily series is `bookStats(...).v`: a position's net R booked on its close day (weekends rolled to Monday), on
  weekdays (`weekdays()`), 1R a unit.
- **The breakout** = the `gold-vol-breakout` study's T1 (UTC open ± 0.5 x the previous weekend-folded UTC day's range,
  first fill wins, stop back at the open, out at the 20:55 UTC candle's close), exactly as the replication study
  (branch `gold-vol-breakout-replicate`) ran it: the original `run.mjs` copied **verbatim** into this folder as
  `original.mjs` (sha256 afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f; the run refuses to start if
  the file differs), its `buildDays`, `daySkip`, `vbTrade`, `TESTS.T1` imported unchanged, with its $0.60 round trip
  (`COST`) and financing as `vbTrade` books it. Candles: OANDA mid XAU/USD M5 from the replication study's cache
  (`xau-5m.json.gz`, November 2006 on, kept out of git); the forming last day is left out. Its daily series: the trade's
  `net` R on its trade day, 0 on a weekday without a trade, 1R a trade.

## Windows (named before any figure)

- **A: 2007-01-01 to 2017-12-31.** The book's untouched window (its supported-book W1 starts 2006-07; 2007 is the first
  full year the breakout has). For the breakout, 2007-15 is its replication window and 2016-17 lie in the original
  study's 2016-20 in-sample years.
- **B: 2018-01-01 to 2026-10-31.** Built-on years for the book's rules (all in sample for them). Shown as description
  only, never as evidence.

## What is reported, per window (nothing else)

For the book alone, the breakout alone, and the two combined at equal size (1R a book unit, 1R a breakout trade; the
combined daily series is the plain sum of the two):

- n (book positions, breakout trades), total R, R a year (total / calendar years of the window);
- worst closed drawdown (supported-book's `drawdown()` on the daily series, the peak floored at 0) and the longest
  time under water (its `longest`, in weekdays);
- the share of calendar months with a positive sum; month-sum t (supported-book's `tOf` on the monthly sums);
- correlation of the two daily series and of the two monthly series (supported-book's `corr`);
- **the combined drawdown divided by the sum of the two separate drawdowns.**

A consistency check, not a test: the book's monthly t and drawdown from this note's function equal `bookStats`' own
`tMonthly` and `maxDD` for the same window.

## What this note will not do

No threshold, no verdict class, no weighting search, no other k, no other cost, no other window, no filter of either
record by the other. The RESULT.md verdict line starts "Verdict: DESCRIPTIVE, no rule tested". The figures change nothing
in the book, its forward-test protocol (item 43) or its stop lines.

## Files

`run.mjs` (writes `result.json` and `RESULT.md`), `original.mjs` (verbatim copy), `result.json`, `RESULT.md`;
test `tests/gold-vol-breakout-with-book.test.mjs` (offline: the series builders on hand-made records, the sha256 of
`original.mjs`, the report against result.json).
