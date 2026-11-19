# Gold over the FOMC cycle: long gold in weeks 2, 4 and 6 after a meeting (pre-registration)

Written 14 Nov 2026, **committed and pushed alone, before any candle is read for a result and before `run.mjs` exists**. The
rule, the day counting, the costs, the windows, the statistics, the placebo and the pass bar are fixed here; nothing in them
changes after the results are seen. Paper research only: nothing live reads this study, and no rule, size, stop, config or
council member changes whatever the verdict. It is a new stand-alone rule on spot gold, **not a gate, exit, entry or size of
the live gold book** (Gold trend + Gold daily engulf; docs/owner-decisions.md item 44). ICT is not touched.

## Why this topic

`research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`) ranks seven candidates; none of them is about
gold. The highest-ranked one, **candidate 1, the FOMC cycle** (Cieslak, Morse and Vissing-Jorgensen, "Stock returns over the
FOMC cycle", Journal of Finance 2019; cited from memory, not opened from this sandbox, so none of its figures is relied on), was
tested on US index CFDs by `fomc-even-week` (branch, FAIL: US500 even minus odd weeks −0.028 % a day net 2017-26, t −0.73). The
paper's mechanism is Fed communication moving the price of risk between meetings; if it is real, gold, which is priced off US
real rates and the dollar, could carry a gold-side version of it in the same weeks. **No study has split gold's returns by the
weeks of the FOMC cycle.** Honest note: the prior is for equities, not gold, and the index version failed out of sample; this
lowers the prior. It is the backlog's top item carried to the one market this slot is for, and it is run because the data are
in hand, not because it is expected to pass.

Duplicate check (14 Nov): `ls research/edge` on `origin/main`, every remote branch whose name holds fomc / cycle / gold, and the
list of topics taken this round were read. Nearest:
- `fomc-even-week` (branch): the same weeks on US500 / NAS100 / US30. Not gold.
- `pre-fomc-gold-usd` (branch): gold and the dollar in the 24 hours BEFORE the statement (week 0). FAIL. Week 0 is not used here.
- `pre-fomc-drift`, `fomc-follow`, `bond-fomc-drift` (branches): the hours / days around the statement on indices and bonds.
- `event-reaction` (main): gold's first hour after CPI / NFP / FOMC releases.
- `gold-month-of-year`, `gold-turn-of-month`, `gold-tsmom`, `gold-weekly-momentum` (branches): calendar and momentum holds on
  gold with no FOMC calendar.

## Data

- **Gold**: OANDA mid XAU/USD daily candles from council-data `research/daily/xau.json` (UTC days, March 2006 to the snapshot's
  last complete day, 6 Nov 2026), read with `git show origin/council-data:…` (no network). Saturday / Sunday candles (the Sunday
  reopen stub) are folded into the next weekday: its open = the first weekend open, high / low over all, close its own. A
  **trading day** = one folded weekday candle.
- **FOMC dates** in `dates.mjs`: scheduled statement days 2008-2021 copied from `research/edge/fomc-even-week/dates.mjs` (itself
  a copy of `research/edge/pre-fomc-drift/events.mjs`, written from the Federal Reserve's meeting calendars), 2022 on from
  `council/events.mjs` (HISTORY + EVENTS). **New here: 12 Dec 2006 and the eight scheduled 2007 statements** (31 Jan, 21 Mar,
  9 May, 28 Jun, 7 Aug, 18 Sep, 31 Oct, 11 Dec), written from the Federal Reserve's 2007 calendar as remembered
  (federalreserve.gov is not reachable from this sandbox). They are **checked before use** on OANDA XAU/USD M5 candles (the
  study's cache of `/md/bars`, kept out of git): on each of the nine dates the largest five-minute range between 18:00 and
  19:30 UTC must be at least 1.5 times the median of the same window over the 20 weekdays before. A date that fails the check
  is reported and its meeting dropped (its cycle merges into the previous one). Unscheduled announcements never start a cycle:
  2007-08-10, 2007-08-17 (new here), 2008-01-22, 2008-10-08, 2010-05-09, 2020-03-03, 2020-03-15.

## Day counting (the paper's, as `fomc-even-week`)

- **Day 0** = the trading day whose UTC date is the scheduled statement's date (statements are 14:00 / 14:15 New York, the same
  UTC date). A meeting whose date has no candle is dropped and listed.
- **Day k** = the k-th trading day after day 0. **Week w = days 5w − 1 to 5w + 3.** Even weeks: **2 = days 9-13, 4 = days
  19-23, 6 = days 29-33**. Odd weeks: **1 = days 4-8, 3 = days 14-18, 5 = days 24-28.** Week 0 and week 7 or later are never used.
- A **cycle** runs from day −1 of a scheduled meeting to the day before day −1 of the next scheduled meeting; a week is used
  only when all its five days lie inside its cycle. A week is dropped when its entry day or any of its days falls on days −1 to
  +3 of an unscheduled announcement, or when two consecutive trading days in it (entry day included) are more than 5 calendar
  days apart.

## The trades

For every usable week: enter at the **close of the trading day before the week** (day 5w − 2), **stop 2 x ATR(20)** from the
entry (true range of the 20 folded days up to and including the entry day; **every trade has a stop**), exit at the **close of
the week's last day**, or earlier at the stop: a day that opens through the stop exits at its open (gap), else a day whose
range reaches the stop exits at the stop. One trade per week; weeks never overlap, so one position at a time.

- **T1 (primary, the paper's direction): long gold in weeks 2, 4 and 6.**
- **T2: short gold in weeks 1, 3 and 5** (the complement: if the cycle's premium sits in the even weeks, the odd weeks are where
  gold should do worst).
- Reported, not judged: long gold in every week 1-6 (the drift these weeks share), the odd-week long, and per cycle the even
  minus odd difference D (net R a trade, t across cycles).

**R** = (exit − entry) / (2 x ATR(20)) for a buy, the mirror for a sell, **net** of:
- **$0.60 a round trip** (spread and slippage, an assumed CFD figure, the brief's), in R = 0.60 / risk;
- **financing on buys only**: `nights(entry time, exit time)` x `FIN.xau.long` (0.000148 of price a rollover, Monday-Friday
  22:00 UTC, Wednesday three) x entry price / risk, imported from `council/fills.mjs` (today's demo rate charged for every year,
  as every gold study since 11 Nov). Sells pay and are credited nothing. Entry time = the entry day's close (its UTC midnight);
  exit time = the exit day's close, or that day's 12:00 UTC for a stop or gap exit (daily candles cannot place the minute; it
  only moves one rollover at most).

## Windows

By **entry date**: in sample (IS) **2007-01-01 to 2016-12-31**; out of sample (OOS) **2017-01-01 to 2026-10-31**. Trades
entering after 31 Oct 2026 are not used.

## Statistics

- Per test and window: n, mean net R a trade, mean gross R, and **t on calendar-month sums** of net R (months by exit date,
  months with no trade left out), also the same at 2 x costs.
- **Holm** over the two tests' OOS net month-sum t: one-sided p = 1 − Φ(t), Holm-adjusted; the bar is p ≤ 1 − Φ(2) = 0.02275.
- **Placebo**: 40 seeds (1-40, mulberry32); in each, every scheduled meeting is moved by its own random ±5..±20 trading days
  (uniform over the 32 shifts) and T1 and T2 are rebuilt on the moved calendar (unscheduled days unchanged). The real test's
  OOS net month-sum t must be above the placebo's in at least **38 of 40** seeds. This controls for gold's drift: a moved
  calendar holds the same long (or short) gold, only in other weeks.

## Pass bar (per test; the study passes if T1 or T2 passes)

1. OOS net mean R > 0 and OOS net month-sum t ≥ 2 after Holm (adjusted p ≤ 0.02275);
2. IS net mean R of the same sign (> 0);
3. OOS net mean R > 0 at 2 x costs ($1.20 and twice the financing);
4. above at least 38 of the 40 placebos.

A pass would be a lead to replicate (other years, silver), not an edge, and no proposal follows from it in this study. A fail
closes the gold version of backlog candidate 1. Sensitivity (reported, not judged): the brief's counting (week w = days 5w to
5w + 4); unscheduled announcements not excluded.

## Deliverables

`research/edge/gold-fomc-cycle/{PREREGISTRATION.md, dates.mjs, run.mjs, RESULT.md, result.json}`,
`tests/gold-fomc-cycle.test.mjs` (offline: day counting on hand-made candles, no look-ahead in the ATR and entries, costs, the
report against result.json), `out/` rebuilt. To repeat: `node research/edge/gold-fomc-cycle/run.mjs fetch <dir>` (git show of
the daily file), then `node research/edge/gold-fomc-cycle/run.mjs <dir> [<xau-5m.json.gz>]`.
