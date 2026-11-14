# Pre-registration: spot gold around the turn of the month (14 Nov 2026)

Written and pushed ALONE, before any return around these dates was computed. The code (`run.mjs`), the result and the test
come in later commits.

## What this is, and what it is not

A **calendar study of its own**: does spot gold move in a set direction around the turn of a calendar month (the window
studied for stocks, month-end fund rebalancing, the first days of a month when ETF holdings and central-bank purchases are
reported)? It is **not** a gate, exit, entry or size of the live gold book (Gold trend, Gold daily engulf, the Mosha cycle):
it reads none of their trades and tests no book rule on any window. docs/owner-decisions.md item 44 stops further tests ON
the book's rules over its 2006-17 window; my reading is that a standalone calendar trade on spot gold, judged on its own
pre-registered windows, is not such a test (the same reading `gold-comex-calendar` and `gold-month-of-year` used). Paper
only; nothing live changes whatever the verdict. A PASS would only be written up as a proposal for the owner.

Dedupe (each RESULT.md read): `turn-of-month` (#826) tested days -1..+3 on SPX500 / US30 / NAS100 only, FAIL;
`seasonality` H3 the same window on NQ / ES; `fx-month-end` the London 4 pm fix on the dollar basket; `fx-month-start` the
dollar basket over the first two days; `crypto-month-end` coins; `bond-month-end*` the 10-year note; `rebalance-flow`
SPX500 / NAS100; `gold-month-of-year` whole calendar months of gold; `gold-comex-calendar` the COMEX options-expiry and
first-notice windows on gold (5 business days into expiry, after it, and 5 business days into the last business day of the
month before an active contract, short). None put a turn-of-month window on gold. T2 below is the nearest to
`gold-comex-calendar` T3 and differs from it: 3 trading days, every month, not 5 business days in six months of the year.

## Data, market set, windows

- Market set, fixed now: **spot gold only** (council-data `research/daily/xau.json`, OANDA mid, UTC daily candles, read with
  `git show`, no network, no cache), weekend candles folded into the next Monday with `council/fills.mjs` `foldWeekend`
  (read only).
- **Trading days** are the folded candles themselves: the month's last trading day (TD-1) is the last folded candle dated in
  that month, TD+1 the first candle dated in the next month, and so on along the candle file. Holiday candles the broker
  prints (1 January, 25 December) count as trading days, said, not removed.
- In sample: events whose ENTRY candle falls in **2008-01 to 2016-12**. Out of sample (the judged window): **2017-01 to
  2026-10**. Events whose exit candle is not yet on file are dropped and counted.

## The three tests (side fixed now, tested one-sided in that sign)

- **T1 (primary), LONG the turn of the month**: buy at the close of TD-2 (the second-to-last trading day), sell at the close
  of TD+3: the returns of TD-1, TD+1, TD+2, TD+3 (the published stock window, 4 days).
- **T2, SHORT the last three days (month-end rebalancing sales)**: sell at the close of TD-4, buy back at the close of TD-1:
  the returns of TD-3, TD-2, TD-1 (3 days). It shares the TD-1 return with T1; they are separate tests under one Holm.
- **T3, LONG the first five days (ETF / central-bank flow reports)**: buy at the close of TD-1, sell at the close of TD+5
  (5 days).

Every trade has a stop (absolute rule 1): **2 x ATR(20)** of the folded daily candles up to and including the entry candle,
checked on every candle of the hold; a gap through it fills at the open (`fills.mjs` `stopFill`). R = move in the trade's
favour / initial risk. The opposite side of each test is computed and reported.

## Costs

- Round trip **$0.60**: the gold spread $0.30 plus half a spread of slippage on each of the two market orders (the
  paper-fill model of `fills.mjs`). Charged in R as $0.60 / initial risk.
- **Financing on longs only**: `nights(entry, exit)` x `FIN.xau.long` (0.0148 % of price a rollover, the demo broker's
  XAUUSD swap of 11 Nov 2026, imported) x entry / risk. Shorts pay and receive nothing (as every gold study here).
- 2x costs check: $1.20 and twice the financing.

## Statistics and the bar

- t on calendar-month sums (trades grouped by the month of their entry; one trade a month per test).
- One-sided p in the test's sign; **Holm over T1, T2, T3** (out-of-sample p's).
- **Placebo**: 40 seeded draws (seed 20261114). Each draw replaces every event with a random window of the SAME length and
  side whose entry is another candle of the same calendar month as the event's entry; the rule beats a seed when its
  out-of-sample mean net R is above that seed's.
- Also reported, not gating: the event window's gross log return against every other window of the same length whose
  entry is in the same months (Welch t), gross figures, win rate, stops, by year.
- **A test passes only if ALL hold**: out-of-sample net R > 0 with month t >= 2; Holm-adjusted one-sided p < 0.05;
  in-sample net R > 0 (same sign); out-of-sample net R still > 0 at 2x costs; the rule beats at least 38 of 40 placebo seeds.
- **Verdict**: PASS only if T1 passes; T2 and T3 are reported each with their own pass / fail. Nothing is called an edge
  without n and t.
