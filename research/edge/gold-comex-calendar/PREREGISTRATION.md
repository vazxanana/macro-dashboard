# Pre-registration: spot gold around the COMEX gold futures calendar (14 Nov 2026)

Written and pushed ALONE, before any return around these dates was computed. The code (`dates.mjs`, `run.mjs`), the result
and the test come in later commits.

## What this is, and what it is not

A **calendar study of its own**: does spot gold move in a set direction around two dates of the COMEX gold (GC) futures
calendar? It is **not** a gate, exit, entry or size of the live gold book (Gold trend, Gold daily engulf, the Mosha cycle),
it reads none of their trades, and no book rule is touched (docs/owner-decisions.md item 44 bans further tests ON the book's
2006-17 window; this study tests no book rule on any window). Paper only; nothing live changes whatever the verdict. A PASS
would only be written up as a proposal for the owner.

Dedupe: no earlier study tested a COMEX expiry or first-notice window on gold. The nearest are `gold-month-of-year` (whole
calendar months, FAIL), `gold-lbma-fix` (intraday auctions, FAIL), `opex-week` and `index-roll-week` (US index options /
futures calendars, FAIL), `turn-of-month` (indices, FAIL) and `futures-roll` (a data-integrity note on the ICT desk's CNBC
candles, no return test).

## The calendar (`dates.mjs`, from the CME rule text)

- **CME business day**: Monday to Friday, not a US exchange holiday. Holidays are read (read only) from `council/datacheck.mjs`
  `usHolidays`: every `closed` day (New Year, Good Friday, Christmas) and every `early` day that is a federal holiday (Martin
  Luther King, Presidents', Memorial, Juneteenth from 2022 only, Independence, Labor, Thanksgiving). The day after Thanksgiving
  and 24 December are business days (early closes). A Saturday New Year is not moved to 31 December (the exchanges stayed open).
- **Options expiry (OG, monthly)**: gold options on the futures expire on the 4th last business day of the month BEFORE the
  option month; if that day is a Friday or the business day before an exchange holiday, the prior business day. Every calendar
  month holds one expiry (the serial and quarterly options together cover all twelve months).
- **First notice day (FND)** of the active months Feb, Apr, Jun, Aug, Oct, Dec: the last business day of the month before
  delivery, i.e. the last business day of Jan, Mar, May, Jul, Sep and Nov.

Checked by hand against dates I can state; not checked against CME's published calendar (cmegroup.com is not reachable from
the build sandbox). One-off closures (2007 Ford funeral, 2012 storm, 2018 Bush funeral) are not in the holiday list.

## Data, market set, windows

- Market set, fixed now: **spot gold only** (council-data `research/daily/xau.json`, OANDA mid, UTC daily candles), weekend
  candles folded into the next Monday with `council/fills.mjs` `foldWeekend` (read only). The candle dated D stands for the
  business day D (its close, 24:00 UTC, is after the COMEX settlement and the 12:30 CT options close).
- In sample: events whose entry falls in **2008-01 to 2016-12**. Out of sample (the judged window): **2017-01 to 2026-10**.

## The three tests (signs from the desk lore, fixed now, tested one-sided)

Lore: before options expiry gold is pushed down toward large strikes (written calls), then released; it dips into first notice
as longs liquidate rather than take delivery.

- **T1 (primary), SHORT into options expiry**: sell at the close of the business day 5 business days before expiry, buy back
  at the close of expiry day (5 daily returns).
- **T2, LONG the release**: buy at the close of expiry day, sell at the close 5 business days later.
- **T3, SHORT into first notice**: sell at the close 5 business days before FND, buy back at the FND close, active months only.
  Its control: the same window (5 business days into the month's last business day) in the inactive months (Feb, Apr, Jun,
  Aug, Oct, Dec), reported as a Welch difference of the gross returns.

Every trade has a stop (absolute rule 1): 2 x ATR(20) of the folded daily candles before entry, checked on every candle of
the hold; a gap through it fills at the open (`fills.mjs` `stopFill`). R = move in the trade's favour / initial risk.
A missing candle for an entry or exit business day drops that event. The opposite side of each test is computed and reported.

## Costs

- Round trip **$0.60**: the gold spread $0.30 (`fills.mjs` `spreadOf` for spot gold) plus half a spread of slippage on each of
  the two market orders (the paper-fill model of `fills.mjs`). Charged in R as $0.60 / initial risk.
- **Financing on longs only**: `nights(entry, exit)` x `FIN.xau.long` (0.0148 % of price a rollover, the demo broker's XAUUSD
  swap of 11 Nov 2026) x entry / risk. Shorts pay and receive nothing.
- 2x costs check: $1.20 and twice the financing.

## Statistics and the bar

- t on calendar-month sums (trades grouped by the month of entry; T1 / T2 have one trade a month, T3 one every two months).
- One-sided p in the lore's sign; **Holm over T1, T2, T3** (out-of-sample p's).
- **Placebo**: 40 seeded draws (seed 20261114). Each draw replaces every event with a random 5-business-day window of the same
  side whose entry is a business day of the same calendar month and that is not the event window; the rule beats a seed when
  its out-of-sample mean net R is above that seed's.
- Also reported, not gating: the event window's gross return minus all other 5-business-day windows of the same months
  (Welch t), gross figures, win rate, stops.
- **A test passes only if ALL hold**: out-of-sample net R > 0 with month t >= 2; Holm-adjusted one-sided p < 0.05; in-sample
  net R > 0 (same sign); out-of-sample net R still > 0 at 2x costs; the rule beats at least 38 of 40 placebo seeds.
- **Verdict**: PASS only if T1 passes; T2 and T3 are reported each with their own pass / fail. Nothing is called an edge
  without n and t.
