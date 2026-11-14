# Pre-registration: the quarterly open as a level on gold (14 Nov 2026)

Committed and pushed ALONE, before any trade, return or statistic of these rules was computed and before the candle file
was read for this study.

**Question.** Does the opening price of the calendar quarter act as a level on spot gold, on the daily chart: does price
that has moved well away from it and comes back hold there (support / resistance), break through it, or get pulled back
to it?

**What this is not.** A stand-alone rule, tested on its own. It is **not** a gate, exit, entry, filter or size of the live
gold book (Gold trend + Gold daily engulf) and reads none of its positions; owner decision 44 (no further gate, exit, entry
or size tested on that book's 2006-17 window) is untouched. Paper research only: nothing live changes, and a pass would
only be reported to the owner as a lead to watch on paper, never applied.

**Dedupe.** Read before writing: `gold-month-levels` (previous calendar MONTH high / low, FAIL 0 of 3), `gold-weekly-open`
(the WEEKLY open as a level, FAIL 0 of 3), `gold-quarter-end` (fading the quarter-to-date move in the last 4 days of a
quarter, FAIL), `ict-quarters` (ICT quarterly theory on A-setups), `gold-floor-pivots`, `gold-round-numbers`, `gold-macd`,
`gold-squeeze`, `gold-inside-week`, the untested-backlog proposal of 14 Nov 2026 and the scratchpad topics list. None
uses the quarter's opening price as a level. The weekly and monthly level studies are the nearest; the quarter open is a
different, slower anchor (four a year), and the rules below were written before reading their trade tables.

## Data (fixed before any result)

- Market: **spot gold only** (XAU/USD), OANDA mid daily candles, council-data `research/daily/xau.json`, read with
  `git show origin/council-data:research/daily/xau.json` (no network; a copy kept outside git). Rows start 20 March 2006.
- Weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend` (the live engulf's day rule). Only
  complete days: a last row dated on or after the file's `updated` day is dropped.
- ATR(14) = simple mean of the last 14 true ranges up to and including the day named.
- First quarter traded: Q1 2007 (2006 is warm-up only).

## The level

- **O(q)** = the open of the first folded trading day of calendar quarter q (UTC dates: January, April, July, October).
- A level is used for signals only on days inside its own quarter; a position opened in a quarter runs to its own exit
  after the quarter ends.

## The three tests (one position at a time per test; each test is its own stream)

**Every trade carries a stop**, set at entry from ATR(14) of the day BEFORE the entry day, never moved. 1R = the stop
distance. A stop is checked from the entry day on; a day that opens beyond the stop fills at that open.

- **Arming** (T1, T2): while flat, on the CLOSE of a day i of the quarter, the rule is armed LONG when
  close >= O + 2 x ATR(14)[i] and armed SHORT when close <= O - 2 x ATR(14)[i]; the latest arm replaces an earlier one.
  Only closes before the trigger day arm it.
- **T1, primary: the quarter open holds (both sides).** Armed long, on a later day j of the same quarter whose low <= O:
  buy at O (at the day's open if that open is already at or below O). Armed short, a later day whose high >= O: sell at
  O (at the open if it is already at or above O). Stop 1.5 x ATR(14)[j-1] from the entry. Exit at the close of the 5th
  trading day after the entry day, or at the stop. On the entry day the stop counts as hit if the day's low (long) /
  high (short) reaches it: coming from above, price traded O before any lower print, so this is exact for a fill at O.
  A fill disarms the rule.
- **T2: the quarter open breaks.** Armed long (price was 2 ATR above O), a later CLOSE of the quarter below O → sell at
  the next day's open; armed short, a close above O → buy at the next open. Stop 1.5 x ATR(14) of the signal day from the
  entry; exit at the close of the 5th trading day after the entry day, or at the stop. A signal disarms the rule.
- **T3: the quarter open pulls (magnet).** While flat, a close of day i of the quarter at least 3 x ATR(14)[i] above O →
  sell at the next open, target O; at least 3 x ATR(14)[i] below → buy at the next open, target O. Skipped when the next
  open is already at or through O. Stop 1.5 x ATR(14)[i] from the entry, away from O. Target fills at O when the day
  trades it. If a day holds both the stop and the target, the stop counts (worst case). Out at the close of the 10th
  trading day after the entry day if neither is hit.
- A position still open on the last candle is closed at that candle's close and reported as open.

## Costs

- **$0.60 an ounce a round trip** on every trade, taken off as 0.60 / stop distance in R.
- **Financing on buys**: `nights(entry time, exit time)` x `FIN.xau.long` (0.000148 of price a rollover: the demo
  broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price / stop distance. Today's rate for every year,
  as every gold study since 11 Nov. Shorts charged and credited nothing. Stamps: an open = 00:00 UTC of the day, a fill
  or stop inside a day = 12:00 UTC, a close = 22:00 UTC.
- **2x costs**: $1.20 a round trip and twice the financing.
- **Cost share of R, stated before any run (estimate)**: gold's ATR(14) runs from about $10 (2007) to about $40 (2025-26),
  so 1.5 x ATR stops should have a median around $25-35 (and above the $10 floor the brief asks for); $0.60 is then about
  0.02R. Financing on a 5-day buy (about 7 rollovers) at $1,500-2,500 gold is about 0.04-0.06R; on a 10-day T3 buy about
  twice that. The run reports the real median stop and the measured cost and financing per trade; if the median stop is
  under $10 that is said beside the verdict.

## Windows

- **In sample (IS)**: trades whose entry day is 1 January 2007 to 31 December 2016.
- **Out of sample (OOS)**: entry day 1 January 2017 to the last complete candle (early November 2026).
- OOS halves (descriptive): 2017-2021 and 2022-end.

## Statistics

- Per test and window: n, win rate, R a trade gross and net, total net R, worst closed-trade drawdown, median stop in $,
  mean cost and financing in R.
- **Month t**: net R summed by the calendar month of each trade's exit over every calendar month of the window (an empty
  month counts 0); t = mean / (sd / sqrt(months)); two-sided p from Student's t, months - 1 degrees of freedom.
- **Holm** over the three tests' OOS p-values.
- **Placebo, 40 seeds** (mulberry32, seeds 1-40), per test, OOS window: each quarter's O is replaced by
  O + s x u x ATR(14) of the day before the quarter's first day, u uniform in [1, 3], s a random sign, drawn per quarter;
  the same rule, stops, holds and costs are run on that level. Score = OOS net R a trade. This asks whether the quarter
  open beats a nearby arbitrary level of the same quarter.

## Pass bar (T1 is the primary test; all must hold)

1. OOS net R a trade > 0 and OOS month t >= 2 with Holm-adjusted p < 0.05.
2. IS net R a trade > 0 (same sign in sample).
3. OOS net R a trade > 0 at 2x costs.
4. Beats at least 38 of the 40 placebo seeds.
5. OOS n >= 30.

**The study's verdict is T1's.** T2 and T3 are judged on the same bar and reported; a pass of T2 or T3 alone would be
named as a secondary lead to replicate, not a PASS of the study. Whatever the result, no live rule changes.

## Deliverables

`run.mjs` (`fetch <dir>` copies the candle file with `git show`; `full <dir>` runs and writes `result.json`), `RESULT.md`,
`result.json`, `tests/gold-quarter-open.test.mjs` (offline: the level, arming, fills and stops on hand-made candles, no
look-ahead, a stop on every trade, the report against result.json), and the rebuilt `out/`.
