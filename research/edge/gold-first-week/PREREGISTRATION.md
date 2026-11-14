# Pre-registration: spot gold's first week of the month, followed to the month's end (14 Nov 2026)

Written and pushed ALONE, before any return of this rule was computed. The code (`run.mjs`), the result and the test come in
later commits.

## What this is, and what it is not

A **stand-alone rule of its own** on spot gold: does the direction gold takes in the first trading days of a calendar month
carry on over the rest of that month (intramonth momentum)? It is **not** a gate, exit, entry or size change of the live gold
book (Gold trend, Gold daily engulf, the Mosha cycle): it reads none of their trades or positions and tests no book rule on
any window. docs/owner-decisions.md item 44 stops further tests ON the book's rules over its 2006-17 window; a calendar
direction rule on spot gold, judged on its own pre-registered windows, is not such a test (the reading `gold-turn-of-month`,
`gold-month-of-year` and `gold-comex-calendar` used). Paper only; nothing live changes whatever the verdict. A PASS would only
be written up as a proposal for the owner.

Dedupe (each RESULT.md read or its headline in the research ledger / the 14 Nov untested backlog):
- `gold-turn-of-month` (FAIL): fixed-side long / short windows TD-4 .. TD+5 around the turn; no direction signal.
- `gold-month-of-year` (FAIL): whole calendar months by their name; no signal from inside the month.
- `gold-month-levels` (FAIL): breaks of LAST month's high / low.
- `gold-weekly-momentum` (FAIL): last calendar week's sign -> next week; weeks, not the month's own opening days.
- `gold-tsmom`, `tsmom`, `dual-momentum`: 1-12 month look-backs on whole months.
- `gold-range-expansion`, `gold-box-breakout`, `gold-weekly-vol-breakout`: price-pattern triggers, not the calendar month.
- `fx-month-start`: the dollar basket over the first two days only, fixed side.
None uses the direction of a month's first days to trade the rest of that same month. Slug `gold-first-week`, appended to
the shared topic list before this file was written.

## Data, market set, windows

- Market set, fixed now: **spot gold only** (council-data `research/daily/xau.json`, OANDA mid, UTC daily candles, read with
  `git show origin/council-data:…`, no network, no candle cache written), weekend candles folded into the next Monday with
  `council/fills.mjs` `foldWeekend` (read only).
- **Trading days** are the folded candles: a month's TD+1 is its first folded candle, TD+k the k-th; TD-1 is the previous
  month's last folded candle (its close = the month's reference open). Holiday candles the broker prints count as trading
  days, said, not removed. The month's last trading day (TDlast) is its last folded candle.
- In sample: months **2007-01 to 2016-12**. Out of sample (the judged window): months **2017-01 to 2026-10**. A month whose
  exit candle is not on file is dropped and counted (none expected inside the windows).

## The rule and the three tests

Signal at the close of TD+k: `s = sign(close[TD+k] - close[TD-1])` (no trade when exactly 0). Trade in direction `s`
(buy if up, sell if down) at the close of TD+k, out at the close of TDlast, one trade a month a test. **Both-sided by
construction** (the primary test is the signed rule, longs and shorts together).

- **T1 (primary)**: k = 5 (the first week), held to the month's last close (about 15-18 trading days).
- **T2**: k = 10 (the first two weeks), held to the month's last close (about 10-13 trading days).
- **T3**: k = 5, only months where `|close[TD+5] - close[TD-1]| >= 1 x ATR(20)` (a strong first week); else no trade.

Every trade has a stop (absolute rule 1): **2 x ATR(20)** of the folded daily candles up to and including the entry candle
(all closed at entry), checked on every candle after entry; a gap through it fills at the open (`fills.mjs` `stopFill`).
R = move in the trade's favour / initial risk. Nothing after the entry close is read to decide the trade (a test checks that
changing every later candle leaves the side and the stop unchanged).

**Unconditional same-side baselines** (reported, not gating, same windows, hold, stop and costs): always LONG from TD+k to
TDlast, and always SHORT, every month. The signed rule's net R is also shown against them by side: the rule's longs against
the always-long trades of the same months is the answer to "is the signal better than just being long gold".

## Costs, and their expected share of R

- Round trip **$0.60** (the gold spread $0.30 plus half a spread of slippage on each of two market orders, the paper-fill
  model of `fills.mjs`), charged in R as $0.60 / initial risk.
- **Financing on buys only**: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD
  swap of 11 Nov 2026, imported from `council/fills.mjs`) x entry / risk. Shorts pay and receive nothing (as every gold study
  here). Today's rate is charged for every past year (said, an overstatement before 2022 when cash rates were lower).
- **Expected share of R, stated before any run** (from gold's usual daily ATR, not from this rule's returns): a 2 x ATR(20)
  stop is about $25-60 in 2007-16 and $40-120 in 2017-26 (median stop well above $10), so the $0.60 round trip is about
  0.01-0.03R; a buy held about 22 calendar nights pays about 0.003 of price, about 0.10-0.17R. So costs are small on sells and
  a real hurdle (about 0.1-0.2R) on buys. The run reports the measured median stop ($) and median cost R per test.
- 2x costs check: $1.20 and twice the financing.

## Statistics and the bar

- t on calendar-month sums of net R (one trade a month per test, months without a trade are left out of that test's
  series), one-sided p in the positive direction.
- **Holm over T1, T2, T3** (out-of-sample one-sided p's).
- **Placebo**: 40 seeded draws (seed 20261114). Each draw replaces every out-of-sample trade's side by a fair coin (same
  entry, exit, stop and costs); the rule beats a seed when its out-of-sample mean net R is above that seed's.
- Also reported, not gating: gross figures, win rate, stops, longs and shorts apart, by year, the baselines, the median stop
  in $ and the median cost in R.
- **A test passes only if ALL hold**: out-of-sample net R > 0 with month t >= 2; Holm-adjusted one-sided p < 0.05; in-sample
  net R > 0 (same sign); out-of-sample net R still > 0 at 2x costs; the rule beats at least 38 of 40 placebo seeds.
- **Verdict**: PASS only if T1 passes; T2 and T3 are reported each with their own pass / fail. Nothing is called an edge
  without n and t.
