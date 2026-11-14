# Pre-registration: spot gold's first week follows the previous month (14 Nov 2026)

Written and pushed ALONE, before any return around these dates was computed. The code (`run.mjs`), the result and the test
come in later commits.

## What this is, and what it is not

A **calendar study of its own**: when a new calendar month starts (new allocations, month-start flow reports, rebalanced
funds), does spot gold's first week carry on in the direction of the month that just ended? Trade in the sign of the
previous calendar month's return, from the close of the month's last trading day, for the first days of the new month.

It is **not** a gate, exit, entry or size change of the live gold book (Gold trend, Gold daily engulf, the Mosha cycle): it
reads none of their trades or positions, uses none of the book's 2006-17 positions, and tests no book rule. Paper only;
nothing live changes whatever the verdict. A PASS would only be written up as a proposal for the owner.

Dedupe (each RESULT.md read): `gold-turn-of-month` traded fixed LONG windows around the turn (TD-2..TD+3, TD-3..TD-1 short,
TD+1..TD+5 long), never conditioned on the previous month's direction; `gold-mid-month-turn` traded against the
month-to-date move from mid-month; `gold-quarter-end` faded the quarter- / month-to-date move over the last days;
`gold-rebalance-flow` traded the last three days against gold's lead over the S&P; `gold-month-washout` bought the whole
month after a washout month; `gold-month-engulf` followed an outside month; `gold-tsmom` held whole months on a 12-month
lookback; `gold-dxy-month-shock` read the dollar. None trades the first days of a month in the direction of the previous
month's return. `fx-month-start` is the dollar basket. Slug appended to the shared topic list before this file.

## Data, market set, windows

- Market set, fixed now: **spot gold only** (council-data `research/daily/xau.json`, OANDA mid, UTC daily candles, read with
  `git show`, no network, no cache written), weekend candles folded into the next Monday with `council/fills.mjs`
  `foldWeekend` (read only).
- **Trading days** are the folded candles: a month's last trading day (TD-1) is the last folded candle dated in that month,
  TD+1 the first candle dated in the next month, and so on along the file.
- **Signal**, known at the close of TD-1 of month m: `r = ln(close TD-1 of m / close TD-1 of m-1)` (the calendar month's
  return close to close). Side = sign(r); no trade when r is exactly 0.
- Events are keyed by the month of their ENTRY candle (TD-1). **In sample 2007-01 to 2016-12** (120 month ends),
  **out of sample 2017-01 to 2026-10** (118 month ends; counted on the trading calendar before any return was read). Events
  whose exit candle is not yet on file are dropped and counted.

## The three tests (side from the signal; each tested one-sided, excess > 0)

- **T1 (primary)**: enter at the close of TD-1, out at the close of TD+5 (the first five trading days).
- **T2**: the same entry, out at the close of TD+3.
- **T3**: the same entry, out at the close of TD+10.

Every trade has a stop (absolute rule 1): **2 x ATR(20)** of the folded daily candles up to and including the entry candle,
checked on every candle of the hold; a gap through it fills at the open (`fills.mjs` `stopFill`). R = move in the trade's
favour / initial risk.

## Costs

- Round trip **$0.60** (spread plus slippage), charged in R as $0.60 / initial risk.
- **Financing on buys**: `nights(entry, exit)` x `FIN.xau.long` (0.0148 % of price a rollover, the demo broker's XAUUSD swap
  of 11 Nov 2026, imported from `council/fills.mjs`) x entry / risk. Sells pay and receive nothing (as every gold study here).
- 2x costs check: $1.20 and twice the financing.

## Baseline (what each trade is judged against)

For each event, the baseline is the **same-side trade of the same length on every day of the same calendar year**: for every
folded candle i of the entry's year (i >= 20, exit on file), the trade entered at the close of i with the event's side, the
same hold in trading days, the same stop and costs; b(year, side, hold) = mean net R of those trades (event days included).
**Excess** of an event = its net R - b(year of entry, its side, its hold). At 2x costs both the event and the baseline are
recosted.

## Statistics and the bar

- t on calendar-month sums of excess (one trade a month per test, grouped by the entry month).
- One-sided p in the excess > 0 direction; **Holm over T1, T2, T3** (out-of-sample p's).
- **Placebo**: 40 seeded draws (seed 20261114). Each draw replaces every out-of-sample event with a random other candle of
  the SAME calendar month as the entry, side = sign of the 21-candle log return up to that candle (the same "last month's
  direction" rule, without the turn of the month), same hold; its excess against the same-year same-side baseline. The rule
  beats a seed when its out-of-sample mean excess is above that seed's.
- Also reported, not gating: plain net and gross R and their month t, the opposite side (fading the previous month), win
  rate, stops, by year, buys and sells apart.
- **A test passes only if ALL hold**: out-of-sample mean excess > 0 with month t >= 2; Holm-adjusted one-sided p < 0.05;
  in-sample mean excess > 0 (same sign); out-of-sample mean excess still > 0 at 2x costs; the rule beats at least 38 of 40
  placebo seeds.
- **Verdict**: PASS only if T1 passes; T2 and T3 are reported each with their own pass / fail. Nothing is called an edge
  without n and t.
