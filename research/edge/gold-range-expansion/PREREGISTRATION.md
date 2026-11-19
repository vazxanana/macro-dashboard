# Pre-registration: spot gold after a range-expansion day (14 Nov 2026)

Written and pushed ALONE, before any return after these days was computed. The code (`run.mjs`), the result and the test
come in later commits.

## What this is, and what it is not

A **stand-alone daily rule of its own**: after a gold day whose high-low range is far wider than usual AND that closes at
one end of that range (a "range-expansion day", the wide-range-bar of the trading literature), does gold keep going the way
it closed (continuation), or give part of it back the next day (fade)? It is **not** a gate, exit, entry or size of the live
gold book (Gold trend, Gold daily engulf, the Mosha cycle): it reads none of their trades or positions and tests no book rule
on any window. docs/owner-decisions.md item 44 stops further tests ON the book's rules over its 2006-17 window; a standalone
rule on spot gold judged on its own pre-registered windows is not such a test (the reading `gold-turn-of-month`,
`gold-comex-calendar` and `gold-shock-revert` used). Paper only; nothing live changes whatever the verdict. A PASS would only
be written up as a proposal for the owner.

Dedupe (each RESULT.md read): the nearest is `gold-shock-revert` (#850): its event is a CLOSE-TO-CLOSE move over 2 x ATR(20)
(69 events in twenty years, both rules under its n bar), with no condition on the day's range or where it closed in it. This
study's event is the day's own HIGH-LOW range against the ATR of the 20 days before it, AND a close in the outer quarter of
that range: a day can qualify with a modest close-to-close change (a wide day that opened at one end and closed at the other)
and a shock day that closed mid-range does not. `gold-vol-breakout*` trade a break of the open +/- k x the previous day's
range INSIDE the day; `nr7-breakout`, `gold-inside-day`, `gold-squeeze` are range CONTRACTION; `gold-ibs` reads the close
location on every day with no range condition; `gold-key-reversal`, `gold-h4-pinbar` are reversal candles; `gold-streak`
counts consecutive closes; `gold-volume-spike` uses tick volume. None tests a wide range with an extreme close on gold.

## Data, market set, windows

- Market set, fixed now: **spot gold only** (council-data `research/daily/xau.json`, OANDA mid, UTC daily candles, read with
  `git show`, no network, no cache), weekend candles folded into the next Monday with `council/fills.mjs` `foldWeekend`
  (read only).
- In sample: events whose ENTRY candle falls in **2007-01 to 2016-12**. Out of sample (the judged window): **2017-01 to
  2026-10**. Events whose exit candle is not yet on file are dropped and counted.

## The event (decided now, no other setting will be run)

On folded daily candle D, with ATR20 = the mean true range of the 20 candles BEFORE D (D itself not in it):
- range(D) = high - low >= **1.75 x ATR20**, and
- close location CL = (close - low) / (high - low): **CL >= 0.75 = an up-expansion day**, **CL <= 0.25 = a down-expansion
  day**. Everything used is known at D's close.

## The three tests (side fixed now, tested one-sided as "the trade makes money")

All enter at the **close of D** (a market order at the daily close), one position at a time per test (an event whose entry
candle comes before the previous trade of that test has exited is skipped and counted).
- **T1 (primary), continuation, 5 days**: trade WITH the close (buy after an up-expansion day, sell after a down one), out at
  the close of D+5.
- **T2, fade, 1 day**: trade AGAINST the close, out at the close of D+1.
- **T3, continuation, 20 days**: as T1, out at the close of D+20.

Every trade has a stop (absolute rule 1): **2 x ATR(20)** of the folded daily candles up to and including the entry candle,
checked on every candle of the hold; a gap through it fills at the open (`fills.mjs` `stopFill`). R = move in the trade's
favour / initial risk. The opposite side of each test is computed and reported (not judged).

## Costs

- Round trip **$0.60**: the gold spread $0.30 plus half a spread of slippage on each of the two market orders (the
  paper-fill model of `fills.mjs`). Charged in R as $0.60 / initial risk.
- **Financing on buys only**: `nights(entry, exit)` x `FIN.xau.long` (0.0148 % of price a rollover, the demo broker's XAUUSD
  swap of 11 Nov 2026, `council/fills.mjs`, imported) x entry / risk. Sells pay and receive nothing (as every gold study here).
- 2x costs check: $1.20 and twice the financing.

## Statistics and the bar

- t on calendar-month sums of net R (trades grouped by the month of their entry).
- One-sided p in the test's sign; **Holm over T1, T2, T3** (out-of-sample p's).
- **Placebo**: 40 seeded draws (seed 20261114). Each draw replaces every out-of-sample trade with a trade of the SAME side and
  hold whose entry is a random other candle of the same calendar month as the event's entry; the rule beats a seed when its
  out-of-sample mean net R is above that seed's.
- Also reported, not gating: gross figures, win rate, stops, by year, the event counts by side.
- **A test passes only if ALL hold**: out-of-sample net R > 0 with month t >= 2; Holm-adjusted one-sided p < 0.05; in-sample
  net R > 0 (same sign); out-of-sample net R still > 0 at 2x costs; the rule beats at least 38 of 40 placebo seeds.
- **Verdict**: PASS only if T1 passes; T2 and T3 are reported each with their own pass / fail. Nothing is called an edge
  without n and t.
