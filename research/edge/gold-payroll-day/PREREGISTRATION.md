# Pre-registration: gold in the three days after US payrolls, and on the release day itself (14 Nov 2026)

Written and pushed ALONE, before any gold return of this study is computed. The rule, the dates, the costs, the baseline, the
statistics, the placebo and the pass bar are fixed here and do not change after the results are seen. Anything added later is
labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes; ICT is not involved.

## Why this study, and what it is not

A calendar study of the US Employment Situation release ("payrolls", 08:30 New York) on spot gold, on the days AROUND the
release that no study has held:

- **T1 (primary): the three trading days after the release.** Hypothesis: the payroll surprise moves the dollar and rate
  expectations, and the adjustment of a slow asset like gold is not finished on the release day, so the days after carry a
  drift. The direction of that drift has no reliable prior; the side is fixed here as **long** (the side of gold's own
  long-run drift), and the test is whether these days beat the same long on every day of the same year (the baseline), so
  the drift itself is taken out.
- **T2: the release day itself** (close of the day before to close of the release day). The announcement-day premium
  (Savor and Wilson, Journal of Financial and Quantitative Analysis 2013, cited from memory, not opened) on gold, which the
  `announcement-premium` study (branch, FAIL 0 of 5) did not include: it held index and bond CFDs only.

Dedupe (read before writing, 14 Nov 2026): `gold-pre-nfp-replicate` and `gold-pre-cpi` (the three days BEFORE the release, up
to 08:00 New York on release day: FAIL), `pre-release-drift` (24 hours before CPI / payrolls: FAIL), `nfp-follow` (the
minutes after the print, traded in the first move's direction: FAIL), `announcement-premium` (the release day on index and
bond CFDs: FAIL), `post-holiday-metals`, `gold-pre-holiday`, `gold-turn-of-month`, `gold-first-week` (calendar windows that are
not tied to the payroll date; payrolls fall on the 1st-10th, so the first week overlaps in part, but no study has used the
release date itself). No study has held gold over the release day or the three days after it.

**Item 44 (`docs/owner-decisions.md`)**: a stand-alone event study on spot gold. It reads no record or position of the live gold
book (Gold trend, Gold daily engulf, Mosha cycle), never uses the book's 2006-17 positions, and is not, and cannot become by
this study, a gate, exit, entry or size of that book. It uses 2007-16 gold candles as an event study of payroll days, not as a
test of the book's rules. A pass would be a hypothesis for a forward paper shadow the owner decides on, never a live rule and
never an edge.

## Data

- OANDA mid daily gold candles, council-data `research/daily/xau.json` (`git show origin/council-data:…`, no network; complete
  UTC days, close 00:00 UTC = 19:00 / 20:00 New York, so the 08:30 New York release is inside its day's candle). Copied to a
  cache outside git (`run.mjs fetch <dir>`), deleted after the run.
- Weekend candles (the Sunday reopen stubs) are folded into the next weekday with `council/fills.mjs` `foldWeekend`
  (imported). A "trading day" = one folded candle. US holidays on which gold prints a candle count as days.
- The market set is gold only (`xau`), named here before any result.

## Payroll dates

- **2007-01 to 2021-12: derived by the BLS rule** (bls.gov refused by the sandbox's proxy, as `gold-pre-nfp-replicate`
  found), copied from that study's `dates.mjs` unchanged: reference week = the Sunday-Saturday week holding the 12th; release =
  the third Friday after that week ends; a Friday on or before 3 January moves one week later; a Friday that is an observed
  New Year's Day, Independence Day or Christmas moves to the Thursday before; two hand-written exceptions (October 2013
  shutdown: September report 2013-10-22, October report 2013-11-08). That study checked the rule on the 59 payroll dates
  2022-26 of `council/events.mjs` (56 of 59; the three misses are 2025-26 shutdown changes) and on the OANDA M5 release
  minute 2006-21 (165 of 189 verified). Its 5 "moves by the check" are NOT used (it judged them doubtful itself); the rule's own
  dates are used, unverified ones included, as they are.
- **2022-01 on: `council/events.mjs`** (`HISTORY` + `EVENTS`, type `NFP`, BLS schedule; imported, read only).
- Counted before writing (dates only, no returns): **in sample 2007-01-01 to 2016-12-31: 120 releases; out of sample
  2017-01-01 to 2026-10-31: 117 releases** (October 2025 cancelled; November 2025 report released 2025-12-16). Both windows
  meet the minimum of 100.

## The rule

For a release on date R (New York date = the UTC date of the candle holding 08:30 New York):

- Let i = the index of the folded candle of date R. If gold has no candle dated R, the event is skipped and listed.
- **T1 (primary): long the three days after.** Entry = close of candle i; exit = close of candle i + 3.
- **T2: long the release day.** Entry = close of candle i − 1; exit = close of candle i.
- **Stop (absolute rule 1)**: 2 x ATR(20), ATR = simple mean of the true range of the 20 folded candles ending with the entry
  candle; fixed at entry, never moved. Checked on each candle after the entry candle up to the exit candle: a candle opening
  at or below the stop exits at its open; else a low at or below the stop exits at the stop. Every trade has a stop.
- **R** = (exit − entry) / (2 x ATR).
- **Costs**: $0.60 a round trip ($0.30 spread + $0.15 slippage on each of the two market orders, as `gold-pre-cpi`) plus
  financing `nights(entryTime, exitTime) x FIN.xau.long x entry`, both imported from `council/fills.mjs` (0.000148 of price a
  rollover, the demo broker's XAUUSD swap of 11 Nov 2026, Wednesday three; today's rate used for every year). Times: entry
  and exit at the candle's close (candle start + 86,400 s). Net R = (exit − entry − 0.60 − financing) / (2 x ATR). 2x costs:
  both doubled.

## The baseline (same side, every day of the same year)

For each calendar year Y and each test, the baseline is the same long with the same hold length, stop rule and costs entered
at the close of EVERY folded candle j whose exit candle (j + 3 for T1; j + 1 for T2) is dated in Y, payroll days included.
`base(Y)` = the mean net R (and, for the gross and 2x lines, the mean gross / 2x net R) of those trades. Each event's
**excess** = its net R − base(year of its exit candle). Same at 0x (gross) and 2x costs.

## Windows

In sample = releases dated 2007-01-01 to 2016-12-31; out of sample = releases dated 2017-01-01 to 2026-10-31 (an event whose
exit candle is not on file is skipped and listed). Gold candles start 2006-03-20, so every 2007 event has its ATR.

## Statistics

- Per test and window: n, mean gross R, mean net R, mean excess (gross, net, 2x), event t, and **the month-sum t**: excess net
  R summed per calendar month of the release (one release a month, so the month sum is the event; a month with two, such as
  December 2025's late release, sums them), t = mean / (sd / √months).
- One-sided p from the Student t distribution with months − 1 degrees of freedom; **Holm over the two tests** (T1, T2).
- **Placebo**: 40 seeded draws (mulberry32, seed 20261114 + draw). In each draw every out-of-sample event is moved to a random
  folded candle of the same calendar month that is not a payroll release day and whose exit candle is on file; same hold,
  stop and costs; the draw's mean excess net R is computed. The rule "beats" a draw when its own out-of-sample mean excess net
  R is higher.

## Pass bar (per test; the verdict is T1's)

All of:
1. out-of-sample month-sum t of excess net R >= 2 **and** Holm-adjusted one-sided p < 0.05;
2. in-sample mean excess net R > 0 (the same sign);
3. out-of-sample mean excess at 2x costs > 0;
4. out-of-sample mean net R > 0 (the trade itself pays, not only against the baseline);
5. the rule beats at least 38 of the 40 placebo draws.

**PASS** = T1 meets all five. T2 is reported with its own checks; a T2 pass alone is written as "T1 fails, T2 passes" and is a
lead to be replicated, not a verdict on the primary question. Whatever happens: not an edge, nothing live changes, no
proposal is written by this study.

## Deliverables

`research/edge/gold-payroll-day/{PREREGISTRATION.md, run.mjs, RESULT.md, result.json}`, `tests/gold-payroll-day.test.mjs`
(offline: the rule and the stop on hand-made candles, no look-ahead, the date rule, the report against result.json), `out/`
rebuilt. Nothing else is touched.
