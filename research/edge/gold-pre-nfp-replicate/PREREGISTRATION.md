# Gold in the three days before US payrolls, replicated on 2006-2021: pre-registration

Written and pushed **before** any candle of 2006-2021 was read for this study and before any return was computed (14 Nov 2026).
The rule, the dates, the costs, the statistics, the placebo and the pass bar are fixed here and do not change after the results
are seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes; ICT is not involved.

## Why this study, and what it is not

`gold-pre-cpi` (branch `gold-pre-cpi`, FAIL 0 of 3) found one near miss: **T2**, buy gold at 17:00 New York on the third
weekday before the US payrolls release (Employment Situation, "NFP") and sell at 08:00 New York on release day, made
**+0.088R a trade net (n 47, month t 2.07, Holm p 0.067, 37 of 40 placebos)** on 2022-2026, the only payroll dates the
repository had. It was the best of three tests, so it is a post hoc pick. This study is its **replication on payroll dates
before 2022, which that study never saw**: exactly the same rule, nothing tuned.

**Item 44 (`docs/owner-decisions.md`)**: this is a stand-alone event study on spot gold. It reads no record or position of the
live gold book (Gold trend, Gold daily engulf, Mosha cycle) and is not, and cannot become by this study, a gate, exit, entry or
size of that book. It does use 2006-2017 candles, but as an event study of payroll weeks, not as a test of the book's rules.
A pass would be a hypothesis for a forward paper shadow the owner decides on, never a live rule and never an edge.

Dedupe (read before writing): `pre-release-drift` (24 hours before CPI / payrolls, FAIL), `nfp-follow` (the minutes after the
print, FAIL), `gold-pre-cpi` (this rule on 2022-26, near miss), the untested backlog (its item 2 holds index CFDs and bonds
through the release day, other markets). No study has held gold three days into payrolls before 2022.

## The rule (copied from gold-pre-cpi T2, unchanged)

For a payroll release on New York date R (08:30 New York):
- **E** = 17:00 New York on the 3rd weekday (Mon-Fri) before R. Entry = close of the OANDA mid H1 gold candle that ends at E;
  if missing, the last candle ending in the 3 hours before E; none → event skipped for want of data.
- **X** = 08:00 New York on R. Exit = close of the H1 candle ending at X; missing → skipped.
- **Long only.** ATR20 = mean true range of the 20 most recent complete H1 candles ending at or before the entry candle.
  **Stop = 2 x ATR20 x √(hold in hours)**, fixed at entry, never moved; every trade has one. Managed on the H1 candles after
  entry up to the exit candle: a candle opening through the stop exits at its open, one whose low reaches it exits at the stop.
- **Costs:** $0.30 spread + $0.15 slippage on each of the two market orders = **$0.60 a round trip**, plus financing
  `nights(entry, exit) x FIN.xau.long x entry` imported from `council/fills.mjs` (0.000148 a night, the demo broker's swap of
  11 Nov 2026, Wednesday three; today's rate used for every year, as gold-pre-cpi did). Net R = (exit − entry − 0.60 −
  financing) / |entry − stop|. 2x costs = both doubled.
- **Clean window:** an event is dropped (and listed) when another release (below) falls after E and at or before 16:00 New
  York on R (gold-pre-cpi's window end C).

The code of `gold-pre-cpi/run.mjs` (branch not on main) is copied into `run.mjs` for the pieces used (`timesOf`, `endingAt`,
`atr`, `trade`, statistics), unchanged. **Harness gate:** the same code on the same candles must reproduce gold-pre-cpi's T2
on 2022-26 (n 47, net +0.088R within 0.002). If it does not, no verdict is given.

## Payroll dates before 2022

BLS pages (bls.gov) are refused by the build sandbox's proxy (tried 14 Nov 2026: www.bls.gov 403 at CONNECT; FRED and the web
archive too). So the dates are **derived by the BLS rule** and listed in `dates.mjs`:

1. Reference week = the Sunday-Saturday week holding the 12th of the month. Release = the **third Friday after that week ends**.
2. If that Friday is on or before 3 January, the release is one week later (the holiday-season shift; for example, in the repository's own list
   it gives 10 Jan 2025 and 9 Jan 2026, both as `council/events.mjs` has them).
3. If that Friday is a federal holiday (observed New Year's Day, Independence Day, Christmas), the release is the Thursday
   before it.
4. Known exception written by hand, with its source: the October 2013 shutdown. September 2013 report released Tuesday
   22 October 2013 (derived 4 Oct), October 2013 report released Friday 8 November 2013 (derived 1 Nov). From memory of the BLS
   notices; not fetched. January 2019: BLS was funded, no change (rule gives 1 Feb 2019).

**Check of the rule on the repository's dates (done before this was written; dates only, no returns):** on the 59 payroll
dates of `council/events.mjs` HISTORY + EVENTS (2022-2026), the rule gives **56 of 59**; the three misses are the 2025-26
shutdown changes that file documents (20 Nov 2025, 16 Dec 2025, 11 Feb 2026).

**Release-minute check (verification, decided now):** for every derived date from June 2006 (OANDA M5 gold starts then), the
range of the M5 candle opening at 08:30 New York on R is divided by the median range of the 08:30 candle on the other weekdays
of R − 9 days to R + 8 days. **Ratio ≥ 2 = verified** (the bar `council/events.mjs` used). If the derived date fails and
exactly one of R − 7 / R + 7 passes with a higher ratio, the event moves to that date (labelled "moved by the check"). Else the
derived date is kept and labelled **unverified**. This reads only volatility at the release minute, never a return or the
three-day window. Dates before June 2006 (April and May 2006) are unverified. The count of verified / moved / unverified dates is
reported. Information only: T2 restricted to verified dates.

## Other releases (exclusion only, never events)

- FOMC 2008-2021: the scheduled statement days of `research/edge/fomc-even-week/dates.mjs` (branch, from the Federal
  Reserve's calendars, checked there on SPX500 M5), copied, at 14:00 New York (14:15 before 2013 — the exclusion only asks
  whether the statement falls inside the window, so the 15 minutes do not matter). Its unscheduled list (2008-01-22,
  2008-10-08, 2010-05-09, 2020-03-03, 2020-03-15) also.
- FOMC 2006-2007, **from memory, unverified**: 2006-01-31, 03-28, 05-10, 06-29, 08-08, 09-20, 10-25, 12-12; 2007-01-31,
  03-21, 05-09, 06-28, 08-07, 09-18, 10-31, 12-11; unscheduled 2007-08-17 (08:15).
- CPI: 2018-2021 `CPI_EARLY` (event-reaction's BLS schedule list, as gold-pre-cpi); 2012-2017 the `MEMORY` list of
  `research/edge/cpi-follow/events.mjs` (branch; written from memory, unverified); **2006-2011 no CPI list is reachable**. CPI
  falls in the week after payrolls in every year with a list; how many payroll windows a CPI date blocks in 2012-2026 is
  reported, so the size of the gap in 2006-11 can be judged.
- Payrolls themselves (for the placebo).

## Windows and the one test

- **Replication window (the test):** every payroll release from April 2006 (the first with 20 H1 candles before E) to
  December 2021.
- **Halves:** the kept events in chronological order split by count into a first and a second half.
- **Information only, never judged:** the pooled 2006-2026 figure (replication + the 2022-26 recomputation); T2 on verified
  dates only; by year; 2006-2016 vs 2017-2021 (the brief's in-sample / out-of-sample years; for this replication the whole of
  2006-21 is out of sample to the rule).

**One test, so no Holm correction.**

## Statistics and the bar

Net R summed by calendar month of the release (one payroll a month, so a month sum is one trade); t = mean of month sums /
(sd / √months); one-sided p (H1: mean > 0).

**Placebo:** 40 draws, seed fixed (mulberry32, seed 20261114 + draw, as gold-pre-cpi). In each draw every kept event is moved
to a random weekday of the same calendar month that is not a release day of the lists above and whose own window (its E to its
16:00) holds no such release; the same times, rules and costs. Statistic: mean net R a trade.

**PASS only if all hold on the replication window:**
(a) mean net R a trade > 0 and month t ≥ 2 (one-sided); (b) mean net R > 0 at 2x costs; (c) the mean beats at least 38 of
its 40 placebo means; (d) mean net R > 0 in each chronological half. Else FAIL. The harness gate must pass first.
A pass is a replicated hypothesis for a paper shadow, never an edge or a live rule.

## Data

OANDA mid H1 gold (`xau`) from the site's keyless proxy (`/md/bars`), March 2006 to November 2026 (H1 starts 19 Mar 2006);
OANDA mid M5 gold around each derived date for the release-minute check. Cache outside git (`fetch.mjs <dir>`).

## Deliverables

`dates.mjs`, `fetch.mjs`, `run.mjs`, `RESULT.md` (bold verdict line with its reason), `result.json`,
`tests/gold-pre-nfp-replicate.test.mjs` (date rule, the trade on hand-made candles, no look-ahead, report against result.json),
`out/` rebuilt.
