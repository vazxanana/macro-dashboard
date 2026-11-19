# Gold's Sunday-open gap: does it fill? Pre-registration

Written and committed **before** `run.mjs` exists and before any candle was read for a result (13 Nov 2026). Everything
below is fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. Nothing here trades, and no live rule, size, filter, stop, config, cost constant or mirror setting
changes, whatever the outcome. A PASS would lead to one written proposal (a paper shadow stream, for the owner); a FAIL to
nothing.

## What this is, and what it is not (owner decision 44)

Decision 44 (12 Nov 2026) stopped further gates, exits, entries or sizes being tested on the live gold book's 2006-17
window. **This is not a test of that book.** It is a NEW stand-alone rule (a weekend gap fade, no relation to Gold trend or
Gold daily engulf; no position of the book is read or changed), and it is decided on **2020 to now**. 2010-19 is a
replication window only.

Not a duplicate of `research/edge/gold-weekend` (11 Nov 2026): that study asked how the daily systems should treat the
Sunday "stub" candle (fold it into Monday, act on a Friday close at the reopen). It traded no gap and measured no fill.
This study asks one different question: after gold reopens on Sunday away from Friday's close, does price come back to
Friday's close before Monday noon New York, often enough to pay for the trade?

## Data

OANDA spot gold (XAU/USD) mid M5 candles through the council's keyless candle proxy (`/md/bars?sym=xau&tf=5m`, the same
source and format as `research/edge/mosha-sweep`: rows `[time, open, high, low, close]`, time = candle start, unix UTC),
kept outside git. Data needed from late 2009 (ATR warm-up) to the last complete Monday noon before the run.

## Definitions (New York time with US daylight saving, `council/histdata.mjs` `nyOffsetH`)

- **Friday close time** `F` = Friday 17:00 New York of each week.
- **Friday's last close** `fc` = the close of the last M5 candle that STARTS before `F` (so it is closed by `F`). The week is
  used only when that candle starts on that Friday (New York date) at or after 12:00 New York; otherwise (Good Friday, a
  holiday, a data hole) the week is skipped and counted under `skipped.friday`.
- **Reopen** = the first M5 candle starting at or after Sunday 17:00 New York (`F + 48 h`; the end of the spot-shut window
  of `council/fills.mjs` `spotClosed`). Stray prints inside the weekend are never used. The week is used only when the
  reopen candle starts before Sunday 21:00 New York; otherwise skipped (`skipped.reopen`).
- **Reopen price** `ro` = the open of the reopen candle. **Gap** = `ro − fc`.
- **ATR** = the simple mean of the true ranges of the last 20 complete 17:00-New-York trading days ending with the day that
  closed at `F` (a day = the M5 candles from 17:00 New York to 17:00 the next day; the Sunday-evening candles belong to
  Monday's day; weekend stray prints are dropped; a day needs at least 12 candles). Known at `F`: no candle after `fc` is
  read for it.
- **Eligible week**: `0.25 × ATR ≤ |gap| ≤ 1.5 × ATR`.

## Rules (two, fixed)

- **Rule G (fill)**: at the close of the reopen candle (the first M5 close after the reopen), enter toward Friday's close:
  buy when `fc` is above the entry, sell when below. Target = `fc`. Risk `r0 = |fc − entry|`; stop = `entry − side × r0`
  (the same distance beyond the entry: 1R target, 1R stop). No trade when the reopen candle's close is already at or beyond
  `fc` (the gap filled inside the first five minutes; counted) or when `r0 < 0.1 × ATR` (counted).
- **Rule H (after the first hour)**: the same eligible weeks; entry at the close of the first M5 candle that ENDS at or
  after one hour after the reopen candle's start (Sunday 18:00 New York when the reopen is 17:00), as long as price has not
  touched `fc` since the reopen (a touch before = no trade, counted as filled). Target = `fc`; stop the same distance beyond
  the entry; the same `r0` floor.
- **Exit** (both): on the M5 candles after the entry candle, in order. A candle that opens beyond the stop exits at its open;
  a candle whose range reaches the stop exits at the stop; else one that reaches the target exits at the target. **The stop
  is checked first** when one candle holds both. Otherwise out at the close of the last candle ending at or before Monday
  12:00 New York (time exit). Every trade has its stop.
- One trade a week per rule; the rules are judged as separate streams.

## Costs

`R = side × (exit − entry) / r0`. Net R = `R − cost / r0 − financing`, cost = **$0.30** a round trip (the repository's
gold cost), and also reported at **$0.60** (the reopen spread is wide). Financing = `council/fills.mjs` `financing()`
(imported; `FIN.xau.long` on buys held over a 22:00 UTC Monday-Friday rollover, shorts nothing). A Sunday-to-Monday-noon
hold crosses no rollover, so it is expected to be 0; it is computed, not assumed.

## Windows

- **Decisive**: weeks whose `F` is in 2020-01-01 to the end of the data (2020 to now).
- **Replication**: weeks whose `F` is in 2010-01-01 to 2019-12-31.

## Statistics and the pass bar

Per rule and window: n, win rate, mean gross R, mean net R at $0.30 and $0.60, trade t = mean / (sd / √n) of net R at
$0.30, the exit mix, worst drawdown (closed, cumulative net R), and the t on calendar-month sums (reported, not in the bar).
One-sided p of each rule's decisive t from the normal distribution; Holm over the two rules at the one-sided level of t = 2
(α = 0.02275: the smaller p must be ≤ α / 2, the other ≤ α).

**A rule PASSES only if, on the decisive window, all hold:**

1. mean net R a trade > 0 at $0.30, **and** > 0 at $0.60;
2. its p passes Holm over the 2 rules as above (that is, trade t ≥ 2 after Holm);
3. n ≥ 80;
4. its replication mean net R at $0.30 has the same sign (positive) on 2010-19.

The study PASSES if at least one rule passes; otherwise FAIL.

## Also reported (not in the bar)

- **The plain fill rate by gap size**: in each window, the share of weeks in which any candle from the reopen candle up to
  Monday 12:00 New York touches `fc`, by `|gap| / ATR` bin: under 0.25, 0.25-0.5, 0.5-1.0, 1.0-1.5, over 1.5; split up /
  down gaps.
- **Placebo**: 40 seeded runs (seeds 1-40) on Rule G's own trades (same entry, same `r0`, same exit time), each trade's
  direction drawn at random: target `entry + side × r0`, stop `entry − side × r0`, same exit order and costs. Reported: the
  placebo distribution of decisive mean net R at $0.30 and where Rule G sits in it. If a rule passes but its mean does not
  exceed the placebo's 95th percentile, RESULT.md says the pass is not robust.

## Files

`run.mjs` (`node --use-env-proxy run.mjs fetch <dir>`; `CANDLES=<dir> node run.mjs run` → `result.json`), `RESULT.md`
(verdict first), `tests/gold-weekend-gap.test.mjs` (offline: week boundaries with US daylight saving, the gap with no
look-ahead, stop first, the time exit, RESULT.md against result.json).
