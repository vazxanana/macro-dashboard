# Pre-registration: spot gold's mid-month turn against the month-to-date move (14 Nov 2026)

Written and pushed ALONE, before any return of this rule was computed. The code (`run.mjs`), the result and the test come in
later commits.

## What this is, and what it is not

A **stand-alone rule of its own** on spot gold: after the first ten trading days of a calendar month, does gold turn
AGAINST the month-to-date move over the next week (a mid-month reversal)? It is **not** a gate, exit, entry or size change
of the live gold book (Gold trend, Gold daily engulf, the Mosha cycle): it reads none of their trades or positions and tests
no book rule on any window, so docs/owner-decisions.md item 44 (no more tests on the book's 2006-17 positions) is not
touched. Paper only; nothing live changes whatever the verdict. A PASS would only be written up as a proposal for the owner.

Dedupe (each RESULT.md read, or its headline in the research ledger / the 14 Nov untested backlog):
- `gold-first-week` (FAIL, branch of 14 Nov): FOLLOWS the month's first 5 / 10 trading days to the month's END (its T2:
  sign of TD+10, held to the last close, +0.079R out of sample, month t 0.83). This study trades the OPPOSITE side over a
  fixed SHORT hold of five trading days from TD+10 (or TD+8), so it asks whether the first days after mid-month reverse,
  a question its month-end hold does not separate. The overlap is said here, before any figure.
- `gold-turn-of-month` (FAIL): fixed-side windows TD-4 .. TD+5 around the turn; no direction signal, not mid-month.
- `gold-month-levels`, `gold-month-engulf`, `gold-month-of-year`: last month's levels / candle / the calendar month's name.
- `gold-weekly-momentum`, `gold-streak`, `gold-capitulation`, `gold-200d-stretch`: price-run reversal or momentum triggers,
  not the calendar month's own move.
None trades against the month-to-date direction from mid-month over a fixed week. Slug `gold-mid-month-turn`, appended to the
shared topic list (re-read first) before this file was written.

## Data, market set, windows

- Market set, fixed now: **spot gold only** (council-data `research/daily/xau.json`, OANDA mid, UTC daily candles, read with
  `git show origin/council-data:…`, no network, no candle cache written), weekend candles folded into the next Monday with
  `council/fills.mjs` `foldWeekend` (read only).
- **Trading days** are the folded candles: TD+1 is a month's first folded candle, TD+k the k-th; TD-1 the previous month's
  last folded candle (its close = the month's reference). Holiday candles the broker prints count, said, not removed.
- In sample: months **2007-01 to 2016-12**. Out of sample (the judged window): months **2017-01 to 2026-10**. A month whose
  exit candle is not on file is dropped and counted.

## The rule and the three tests

Month-to-date move at the close of TD+k: `m = close[TD+k] - close[TD-1]`; no trade when exactly 0. Trade AGAINST it
(`side = -sign(m)`: sell after an up month-to-date, buy after a down one) at the close of TD+k, out at the close of the
`h`-th trading day after entry (it may run into the next month), one trade a month a test. **Both-sided by construction.**

- **T1 (primary)**: k = 10, h = 5 (TD+10 close -> TD+15 close).
- **T2**: k = 10, h = 5, only when `|m| >= 1 x ATR(20)` (a strong first half); else no trade.
- **T3**: k = 8, h = 7 (the same exit day, an earlier entry: TD+8 close -> TD+15 close).

Every trade has a stop (absolute rule 1): **2 x ATR(20)** of the folded daily candles up to and including the entry candle,
checked on every candle after entry; a gap through it fills at the open (`fills.mjs` `stopFill`). No target. R = move in the
trade's favour / initial risk. Nothing after the entry close decides the trade (a test changes every later candle).

**Unconditional same-side baselines** (reported, not gating; same entry day, hold, stop and costs): always LONG and always
SHORT from TD+k for h days, every month. The rule's buys are set against always-long in the same months, its sells against
always-short.

## Costs, and their expected share of R (stated before any run)

- Round trip **$0.60** (spread $0.30 plus half a spread of slippage on each of two market orders), in R as $0.60 / risk.
- **Financing on buys only**: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's
  XAUUSD swap of 11 Nov 2026, imported from `council/fills.mjs`) x entry / risk; shorts pay and receive nothing. Today's
  rate for every past year (an overstatement before 2022).
- Expected share: gold's daily ATR(20) is about 1 % of price, so the 2 x ATR stop is about 2 % of price: about $25-60 in
  2007-16 and $35-120 in 2017-26 (median stop well above $10). The $0.60 round trip is then about 0.01-0.02R; a buy held
  five trading days pays about 7 rollovers, about 0.001 of price, about **0.05R**. Costs about 0.02R on sells and 0.07R on
  buys, about 0.045R a trade on average. The run reports the measured median stop ($) and median cost R.
- 2x costs check: $1.20 and twice the financing.

## Statistics and the bar

- t on calendar-month sums of net R (by entry month), one-sided p in the positive direction.
- **Holm over T1, T2, T3** (out-of-sample one-sided p's).
- **Placebo**: 40 seeded draws (seed 20261114). Each draw replaces every out-of-sample trade's side by a fair coin (same
  entry, exit, stop and costs); the rule beats a seed when its out-of-sample mean net R is above that seed's.
- Also reported, not gating: gross figures, win rate, stops, longs and shorts apart, baselines, by year, median stop and cost.
- **A test passes only if ALL hold**: out-of-sample net R > 0 with month t >= 2; Holm-adjusted one-sided p < 0.05; in-sample
  net R > 0 (same sign); out-of-sample net R still > 0 at 2x costs; the rule beats at least 38 of 40 placebo seeds.
- **Verdict**: PASS only if T1 passes; T2 and T3 are reported with their own pass / fail. Nothing is called an edge without
  n and t.
