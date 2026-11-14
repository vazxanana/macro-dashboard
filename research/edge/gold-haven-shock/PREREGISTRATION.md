# Gold as a safe haven after equity shock days: pre-registration

Written and committed **before** any number below was computed (14 Nov 2026). The data, the signal, the trade, the
statistics and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **This is a standalone signal study.** It is not a gate, filter, size step or exit for the live gold
systems (Gold trend, Gold daily engulf) and must never be read as one: owner decision 44 stopped further tests on that
book's 2006-17 window, and nothing here is applied to, or compared with, that book's trades. No live rule, size, filter,
stop, config, cost constant or council member changes, whatever the outcome.

## Question

After a US equity index has a daily close-to-close drop larger than twice its own trailing 20-day standard deviation of
daily returns, does spot gold rise over the next 1 and 5 trading days more than it does after ordinary days, as a trade
net of costs?

## Data (no network)

- OANDA mid daily candles, UTC alignment, from the council's research cache on the `council-data` branch
  (`research/daily/xau.json`, `spx500.json`, `nas100.json`; read with `git show origin/council-data:<path>`, the commit
  is recorded in `result.json`). At the time of writing: xau from 2006-03-20, spx500 and nas100 from 2003-03-24, all to
  2026-11-06. `node run.mjs fetch <dir>` copies the three files out of git; `node run.mjs full <dir>` runs the study.
- Weekend candles (the Sunday reopen stub, rare Saturday prints) are folded into the next weekday with
  `council/fills.mjs` `foldWeekend` (imported): first weekend open, high / low over all, the weekday's own close. Both
  gold and the indices are folded the same way, so every row is a Monday-Friday UTC day.
- HistData files are not used, so the research candle clock correction does not apply (OANDA candles are UTC).

## Signal

- Index day return `r_D = close_D / close_{D-1} - 1` on the folded candles.
- `sd_D` = sample standard deviation of the 20 returns `r_{D-20} … r_{D-1}` (days strictly before D; D's own return is
  not in it). A day needs 21 earlier closes to be eligible.
- **Shock day**: `r_D < -2 × sd_D`.
- Signal markets: `spx500` (tests T1, T2), `nas100` (test T3, replication market).

## Trade (every trade has a stop)

- **Timing.** The OANDA UTC daily candle of an index for day D closes at 00:00 UTC of D+1, after the US cash close (20:00
  or 21:00 UTC), so the shock is known at 00:00 UTC D+1. The first gold price after that is the open of gold's next
  folded daily candle, the first gold candle whose day is later than D (D+1 on Monday-Thursday; after a Friday shock the
  Monday candle, whose folded open is the Sunday reopen). **Entry = that candle's open.** No price of that candle or later
  is used by the signal or the stop.
- **Stop** = entry − 1 × gold's ATR(20) (simple mean of the last 20 true ranges of folded gold candles up to and
  including the last candle before the entry candle). Risk 1R = ATR.
- **Exit**: T1 at the close of the entry candle (day 1); T2 and T3 at the close of the 5th gold candle counting the entry
  candle as the first. Before that, the stop: on the entry candle a low at or under the stop exits at the stop; on a later
  candle an open at or under the stop exits at that open (gap), else a low at or under the stop exits at the stop. A
  trade whose gold candles end before its exit is left out (open).
- **One position at a time** per test: a signal whose entry candle is not after the open trade's exit candle is skipped.
- **Costs** (net R): $0.30 a round trip ÷ risk, plus financing for a gold long by `council/fills.mjs` `nights` and
  `FIN.xau.long` (imported, not copied): `nights(entryT, exitT) × FIN.xau.long × entry ÷ risk`. Entry stamp = the entry
  candle's day 00:00 UTC (the Sunday reopen is not a rollover night, so a folded Monday gives the same count). Exit stamp =
  the exit candle's day end (23:59:59 UTC) Monday-Thursday, and 21:59:59 UTC on Friday (spot gold is shut at the Friday
  rollover). A stop exit is stamped at its candle's end too (more nights, the cautious side). Today's rate is charged for
  every year (as in every other study here).
- Gross R = (exit − entry) ÷ risk.

## Ordinary days (the comparison)

The same trade (same entry, stop, exit and costs) taken on every eligible index day of the window that is **not** a
shock day, with no one-at-a-time rule: the baseline. A signal trade's **excess** = its net R − the baseline's mean net R
over the same window (gold's own unconditional drift over those days). Gross excess likewise.

## Windows

- **Decisive**: signal days from 2016-01-01 to the end of the data.
- **Replication**: signal days from the start of gold's data (plus the 21 / 20 days the signal and ATR need) to
  2015-12-31.
- These windows are chosen for this signal only. The 2006-15 window overlaps the gold book's history; it is used only to
  see whether the haven effect repeats, never to judge or adjust the gold book.

## Statistics

- Per test and window: n, win rate, mean gross R, mean net R, mean net excess, total net R, t on calendar-month sums of
  net excess (months by the exit day; every calendar month of the window counts, empty months as 0), and the plain
  per-trade t.
- **p** = one-sided normal upper tail of the decisive month-sum t of net excess. **Holm** over the three tests.
- **Placebo**: 40 seeds (fixed, 1-40, a seeded generator). Each draws, from the decisive window's eligible index days of
  that test's market, the same number of days as the real shock days, at random, and runs the identical trade and
  statistics (one at a time, the same baseline). Reported: the placebo month-sum t of each seed, how many reach t ≥ 2,
  and where the real t ranks. Informational, not part of the bar.
- **2x cost**: decisive mean net R with the round trip and the financing doubled. Reported; a PASS with a 2x-cost mean at
  or under 0 is labelled "fragile to costs".

## Pass bar (per test)

1. Mean net R a trade > 0 in **both** windows;
2. decisive-window month-sum t of net excess ≥ 2, **and** Holm-adjusted p < 0.05;
3. decisive n ≥ 30.

Verdict: **PASS** if T2 (the 5-day spx500 test) passes and T3 (nas100) passes too; **PARTIAL** if any test passes but not
that pair; **FAIL** if none passes. A pass makes this a paper hypothesis worth a forward record with its own proposal,
nothing more: no live change follows from this study.

## What is not tested

Intraday entries at the US cash close, other shock sizes or look-backs, other havens (yen, Treasuries), shorts, and any
use inside the gold book. A changed threshold after seeing results is post hoc and must say so.
