# Proposal: record the demo broker's yen-pair spreads at 00:55 and 06:00 UTC (14 Nov 2026)

For the owner to approve (docs/owner-decisions.md item 54). Branch `yen-spread-log`; nothing is merged until you say so,
because it touches council code (`council/ctrader-symbols.mjs`, which runs in every council round).

## Why

The gotobi fade (sell USD/JPY at 00:55 UTC on Japanese settlement days, buy back at 06:00 UTC; studies #878 and #889, cost
study #893 on branch `gotobi-cost`) is a cost question before it is anything else. #893 found that on USD/JPY 2016-now the
fade keeps a month t of 2 only while spread + 2 x slippage stays under about **1.95 pips a round trip** (commission on top,
about 0.5 pip), and breaks even at 3.73 pips; the four crosses pooled: 1.81 and 3.20 pips. Its verdict was "inconclusive on
cost" because **nothing in the repository records a yen pair's bid and ask**: the cTrader symbol dump reads only the symbols
the demo mirror trades (no yen pair), and the OANDA candle proxy serves mid prices only. The spread at those two minutes is
exactly what is missing: 00:55 UTC is five minutes before the Tokyo fix, and spreads can widen around it.

## What it records

- `council/ctrader-symbols.mjs` gets a second, separate list, `WATCH` = USDJPY, GBPJPY, AUDJPY, CADJPY, CHFJPY. Through the same
  READ-ONLY demo session as today (the session's allowlist has no trading message; the live-account refusal and the demo host
  are unchanged) it reads for each: the last bid / ask, the same spread fields the forex majors get (`spread`, `quoteSpread`,
  `spreadLog`, `spreadTypical`, `commissionRT`, by the same `spreadFields` function), and `windows`: after each weekday's
  00:55 and 06:00 UTC window has passed, the broker's own bid and ask tick history from 3 minutes before to 3 minutes after
  the minute, reduced to the spread in force at the minute (`atTarget`) and the median / min / max over the window. Up to 4
  windows a run, the last 3 days, about 400 kept per pair (some 200 weekdays). A failed read is retried, never stored empty.
- It is written to `ctrader/symbols.json` under a new key `watch`. The keys the mirror, the Trader's cost model and the data
  health check read (`symbols`, `markets`, `missing`) are byte-for-byte what they were: the mirror can never pick, size or
  trade a yen pair from this (tests: `tests/ctrader-symbols.test.mjs`, "watch list", two tests).
- `council/yen-spread.mjs` (pure, not wired into anything) turns the file into a table: per pair, the reads within 3 minutes of
  00:55 and 06:00 UTC on weekdays, in pips, split gotobi days / other days, plus the commission in pips. Its gotobi calendar
  is a copy of the one in `research/edge/gotobi/run.mjs` (branch `gotobi`), checked against that file's own output.
  `node council/yen-spread.mjs <council-data dir>` prints it.

## How long until it answers

About **six gotobi days a month**. Because each window is read from the broker's tick history after it has passed (a council
round every ~11 minutes would rarely land inside a 6-minute window by itself), every weekday gives one read at each minute.
So about **two months for ~12 gotobi reads at each minute** (mid-January 2027 if merged now), with some 30 other weekdays
alongside as the comparison. The question it can then answer: is the spread at 00:55 and at 06:00 on gotobi days, plus the
commission, well under the #893 line? A round trip pays roughly half the spread at each of the two minutes; slippage is not
measured by this (no demo fills of a yen pair exist).

## What it does NOT do

- No trading: no order, no rule, no mirror copy, no alert, no page, no cost-model change. The gotobi fade stays a study.
- It does not decide anything about the fade; when the reads are in, a separate write-up compares them with #893's lines and
  you decide whether any test follows (with its own pre-registration).
- Demo account only, as every cTrader reader; paper trading only (absolute rule 2). No paid service (rule 5).

## Cost of running it

Two more message types it already sends (symbol details, tick history), about 2-3 seconds a round within the step's 90-second
limit; at most 8 extra tick reads a pair a run (4 windows, bid and ask) while catching up, then about 2 a pair at each new window.
