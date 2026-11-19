# Gold over the FOMC cycle: long weeks 2, 4, 6 and short weeks 1, 3, 5 after a meeting: result

**Verdict: FAIL, T1 even-week long OOS +0.136R net (n 186, month t +2.27, Holm p 0.02321) but IS −0.050R; T2 odd-week short OOS −0.073R (t −1.59).**

Pre-registered in `PREREGISTRATION.md` (committed and pushed alone before `run.mjs` existed). Research only: no live rule, size, filter, stop or config changed; not a gate, exit, entry or size of the live gold book (item 44); ICT untouched. Topic: candidate 1 of `research/proposals/2026-11-14-untested-backlog.md` (the FOMC cycle; the index version `fomc-even-week` failed) carried to spot gold, where no study had read it.

Data: council-data research/daily/xau.json (OANDA mid, UTC days, weekends folded), 2006-03-20 → 2026-11-06. Meetings: 156 scheduled statements from 2007-05-09 (Federal Reserve FOMC meeting calendars (scheduled meetings): Dec 2006 and 2007 written here and checked on the gold M5 release window; 2008-2021 as in research/edge/fomc-even-week/dates.mjs; 2022 on from council/events.mjs); unscheduled 2007-08-10, 2007-08-17, 2008-01-22, 2008-10-08, 2010-05-09, 2020-03-03, 2020-03-15 never start a cycle and weeks touching their days −1..+3 are dropped. Rule: week w = days 5w-1..5w+3 after the scheduled statement day; enter at the close before the week, stop 2 x ATR(20), out at the close of its last day or at the stop; T1 long weeks 2, 4, 6; T2 short weeks 1, 3, 5; week 0 not used. Costs: $0.60 a round trip, and on buys 0.000148 of price a rollover (`council/fills.mjs` `FIN.xau.long`, today's demo rate for every year; `nights`, Wednesday three); sells pay nothing. Windows by entry date: IS 2007-2016, OOS 2017 → Oct 2026. t on calendar-month sums of net R; Holm over T1 and T2 (bar p ≤ 0.02275).

New 2006-07 dates checked on OANDA M5 (largest 5-minute range 18:00-19:30 UTC against the median of the 20 weekdays before, ≥ 1.5 needed): 2006-12-12 1.38 (dropped), 2007-01-31 1.21 (dropped), 2007-03-21 1.39 (dropped), 2007-05-09 2, 2007-06-28 1.39 (dropped), 2007-08-07 2.33, 2007-09-18 7.67, 2007-10-31 10.53, 2007-12-11 3.51.

## The tests

| test | window | n | net R a trade | gross R | month-sum t net | t gross | net at 2x costs | t 2x | win % | stops | cost R a trade | Holm p | placebo beaten |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 long gold in weeks 2, 4, 6 | 2007-2016 | 174 | −0.050 | −0.004 | −1.06 | −0.07 | −0.097 | −2.05 | 48.9 | 31 | +0.047 | · | · |
| T1 long gold in weeks 2, 4, 6 | 2017 → Oct 2026 | 186 | +0.136 | +0.190 | +2.27 | +3.12 | +0.083 | +1.39 | 56.5 | 23 | +0.053 | 0.02321 | 38 of 40 |
| T2 short gold in weeks 1, 3, 5 | 2007-2016 | 214 | −0.086 | −0.070 | −1.48 | −1.21 | −0.102 | −1.76 | 41.6 | 36 | +0.016 | · | · |
| T2 short gold in weeks 1, 3, 5 | 2017 → Oct 2026 | 221 | −0.073 | −0.059 | −1.59 | −1.28 | −0.087 | −1.90 | 43.0 | 38 | +0.014 | 0.94408 | 28 of 40 |

- T1 checks: oos not met · isSign not met · x2 met · placebo met. Placebo OOS month t: mean +0.95, max +2.59.
- T2 checks: oos not met · isSign not met · x2 not met · placebo not met. Placebo OOS month t: mean −1.97, max −0.44.

## Reported, not judged

- long gold in every week 1-6: IS −0.026R (n 388, t −0.74), OOS +0.087R (n 407, t +2.09).
- long gold in weeks 1, 3, 5: IS −0.006R (n 214, t −0.12), OOS +0.045R (n 221, t +0.85).
- Even minus odd weeks, long, per cycle (D, net R a trade): IS −0.011 (77 cycles, t −0.16), OOS +0.083 (78 cycles, t +1.19).
- IS with all nine 2006-07 dates kept (the check dropped 4): T1 −0.041R (n 184, t −0.89), T2 −0.105R (n 223, t −1.85).
- T1 sensitivity: S1, week w = days 5w..5w+4: IS +0.006 (t +0.12), OOS +0.105 (t +1.79); S2, unscheduled not excluded: IS −0.053 (t −1.14), OOS +0.124 (t +2.06).
- T2 sensitivity: S1, week w = days 5w..5w+4: IS −0.057 (t −0.89), OOS −0.137 (t −2.59); S2, unscheduled not excluded: IS −0.088 (t −1.55), OOS −0.077 (t −1.68).

## By year (sum of net R, by entry year)

- T1: 2007 −1.7 · 2008 −1.2 · 2009 −2.5 · 2010 +2.3 · 2011 −2.4 · 2012 +0.4 · 2013 −1.5 · 2014 −0.7 · 2015 −0.2 · 2016 −1.1 · 2017 +3.5 · 2018 −2.6 · 2019 +2.2 · 2020 +5.4 · 2021 +1.1 · 2022 −0.9 · 2023 +5.0 · 2024 +6.8 · 2025 +5.3 · 2026 −0.3
- T2: 2007 −6.7 · 2008 −0.5 · 2009 −7.8 · 2010 −3.1 · 2011 −8.5 · 2012 −0.2 · 2013 +8.9 · 2014 −0.3 · 2015 +3.1 · 2016 −3.1 · 2017 −1.1 · 2018 −1.6 · 2019 −2.1 · 2020 −1.5 · 2021 +2.2 · 2022 −0.6 · 2023 +1.7 · 2024 −4.3 · 2025 −8.5 · 2026 −0.2

## Weeks dropped (all weeks, whole file)

No candle on the statement day: 2026-12-09. Cut by the next meeting: 125. Past the data: 0. Holes: 0. Unscheduled: 10.

## What this means

Neither test meets the pre-registered bar. T1 comes closest and is said plainly: out of sample the even-week long made +0.136R a trade after costs (month-sum t +2.27, above 38 of 40 moved calendars, positive at twice the cost), but its Holm-adjusted p (0.02321) is just over the bar (0.02275) and in sample it lost −0.050R a trade (t −1.06), so the sign does not hold across the two windows. A rule that loses for ten years and wins for the next ten, in a decade when gold itself rose, is not evidence of an FOMC-cycle effect; the odd-week short lost in both windows. This closes the gold version of backlog candidate 1. No proposal is written and nothing live changed. Re-reading the same 2017-26 weeks with another counting, week 0 or a filter would be a re-fit of this result; any other version needs its own pre-registration on data not used here.

To repeat: `node research/edge/gold-fomc-cycle/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `node research/edge/gold-fomc-cycle/run.mjs <dir> <xau-5m.json.gz>` (the M5 file only checks the 2006-07 dates; OANDA through `/md/bars`, kept out of git). Tests: `tests/gold-fomc-cycle.test.mjs`.
