# Pre-registration: the weekly-bull daily rejection long as one book on gold and silver, one position at a time (13 Nov 2026)

Written and pushed before any number of this book is computed.

## Why
`gold-drd-silver` passed its bar on silver but was not robust: its t counted overlapping trades as independent; on calendar-month
sums it was 1.15-1.43, and without 2025 about 1. Its RESULT names the next test: one position at a time on gold and silver
together, judged on calendar-month sums, with its own pre-registration. This is that test.

## What was already seen (said plainly)
Nothing here is untouched data. Gold 2006 to October 2022 is where `gold-drd-long` and `gold-drd-er` measured this rule, and where
the two cuts below were noticed AFTER the fact; gold November 2022 to now is the window the rule was found on (the playbook's own).
Silver 2006 to now was measured by `gold-drd-silver`. So this study cannot prove an edge; it asks only whether the result survives
the honest way of counting (no overlap, monthly sums, financing charged). A FAIL ends this line of work; a PASS is a proposal,
never a live change.

## Path to live, item 44
Item 44 forbids a new gate, exit, entry or size test on the gold BOOK (Gold trend + Gold daily engulf) on 2006-17. This study tests
neither system and changes no part of them: it is a different rule (the playbook's daily rejection long), with its rule, cuts and
windows all fixed by earlier studies. No new gate, exit, entry or size is introduced here.

## Rule (imported, never edited)
`research/edge/gold-drd-long/run.mjs`: 17:00 New York days (`days`), weeks (`weeks`), weekly structure (`weekState`), signals
(`signals`, threshold 0.7, longs), the trade (`simulate`: next day's first H1 open, stop $0.30 under the signal day's low, 3R, out
at the 10th day's close, stop first when one candle holds both), statistics (`stats`). Silver's price-scaled signal and trade are
`research/edge/gold-drd-silver/run.mjs` `signals` / `simulate` (buffer $0.004, cost $0.03). ER20 and the 20-day direction are
`research/edge/gold-drd-er/run.mjs` `er` / `up`. A signal without 20 earlier days (ER null) is dropped, as in gold-drd-er.

## The book
- Candidates: every rule signal on XAU/USD and on XAG/USD, each simulated alone as above. Streams: **T1** every signal; **T2** ER20
  >= 0.3; **T3** ER20 >= 0.2 and the signal day's close above the close 20 days earlier. Each stream builds its own book.
- **One open position across both markets**: candidates in order of entry time; one is taken only when its entry time is at or
  after the close of the position last taken (close = the end of the H1 candle it exits in). Same entry time: gold first. A skipped
  candidate is gone (no waiting). The selection runs once over the whole history, then results are cut into windows.
- A trade whose 10-day window runs past the last candle on file and is not yet stopped or at target is dropped (still open).
- **R a trade, net** = gross R - cost / risk (gold $0.35, silver $0.03 a round trip) - financing. Financing: gold buys only, by
  `council/fills.mjs` `financing` (rollovers by `nights` between the entry and the close, `FIN.xau.long` x entry / risk, today's
  rate for every year). Silver is charged no financing (no measured rate in the repository), said as a limit.

## Windows
- **A: 2006-01-01 to 2022-10-31** (the window the gold rule was not found on), halves **A1 2006-01 to 2014-05** and **A2 2014-06
  to 2022-10** (101 months each).
- **B: 2022-11-01 to the data's end**, reported apart.
- A trade belongs to the month (UTC) and the window of its ENTRY.

## Tests (three, Holm over the three)
For each stream: the book's monthly series = net R summed per calendar month over every month of A (a month with no trade is 0).
t = mean / (sd / sqrt(months)); p one-sided from the normal approximation; Holm over T1, T2, T3.
A stream **PASSES** only if all hold: monthly t >= 2 on A with Holm-adjusted p < 0.05; PF > 1 in A1 and in A2; total net R > 0
in B. **Verdict: PASS if any stream passes**; each stream's result is reported.

## Reported, not tested
n, R a trade, PF, win rate, worst closed drawdown (in order of close), per market (gold / silver trades in the book), year by year,
trade-level t, total with costs doubled, total without financing, how many candidates the one-at-a-time rule skipped, B's monthly t.

## Data
OANDA mid H1 XAU_USD and XAG_USD from March 2006 through the site's candle proxy, the files the earlier studies fetched
(gold-drd-long and gold-drd-silver `fetch`), cached outside git. Nothing live changes whatever the result.
