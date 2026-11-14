# The FOMC cycle: US index returns in the even weeks between meetings (pre-registration)

Written 14 Nov 2026, **committed and pushed alone, before any candle is read for a result and before `run.mjs` exists**. The
rule, the day counting, the costs, the windows, the statistic, the placebo and the pass bar are fixed here; nothing in them
changes after the results are seen. Paper research only: nothing live reads this study, no rule, size, stop, config or
council member changes whatever the verdict.

## Question

Cieslak, Morse and Vissing-Jorgensen ("Stock returns over the FOMC cycle", Journal of Finance 2019; cited from memory, not
opened from this sandbox, so none of its figures is relied on) report that the US equity premium since 1994 was earned
mostly in the **even weeks** of the FOMC cycle (weeks 0, 2, 4, 6 counted from the scheduled statement day). Ranked first in
`research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`). This study asks whether, on the council's
own index CFD feeds and net of a CFD trader's costs, **weeks 2, 4 and 6** earn more per day than weeks 1, 3 and 5.

**Week 0 is left out on purpose**: the day before and the day of the statement were tested by `research/edge/pre-fomc-drift`
(branch `pre-fomc-drift`, FAIL). No day of week 0 is used here, on either side.

Duplicate check (14 Nov): `ls research/edge` on `origin/main` and every remote branch whose name holds fomc / cycle / even
(`bond-fomc-drift`, `fomc-follow`, `pre-fomc-drift`, `pre-fomc-gold-usd`, `index-cycle`, `cycle-gate-study`, …) were read; none
splits returns by the weeks of the FOMC cycle (`git grep` for "even week", "FOMC cycle", "Vissing" finds only the backlog).

## Data

- Daily mid candles of **SPX500 (US500)**, **NAS100** and **US30** from council-data `research/daily/<key>.json` (OANDA, UTC
  days, the snapshot written 7 Nov 2026, last complete day 6 Nov 2026), read with `git show origin/council-data:…` (no
  network). Saturday / Sunday candles (the Sunday reopen stub) are folded into the next weekday: its open becomes the first
  weekend open, its high / low take the weekend's, its close is its own. A **trading day** = one folded weekday candle.
- **FOMC dates** in `dates.mjs`: scheduled statement days 2008-2021 copied from `research/edge/pre-fomc-drift/events.mjs`
  (written there from the Federal Reserve's meeting calendars, federalreserve.gov, which this sandbox cannot reach; that study
  checked them by the release-minute range on SPX500 M5), 2022 on from `council/events.mjs` (HISTORY + EVENTS). The 2008-2021
  list is cross-checked in the test against nothing newer (no overlap); the 2022-on list IS the repository's calendar.
  Unscheduled announcements (2008-01-22, 2008-10-08, 2010-05-09, 2020-03-03, 2020-03-15) are listed apart; the scheduled
  17-18 Mar 2020 meeting, replaced by 15 Mar, is not in the scheduled list.

## Day counting (the paper's)

- **Day 0** = the trading day whose UTC date is the scheduled statement's date (statements are 14:00 / 14:15 New York, the
  same UTC date). A meeting whose date has no candle is dropped and listed.
- **Day k** = the k-th trading day after day 0 (day −1 the one before). The return of day k = close(k) / close(k−1) − 1.
- **Week w** = days **5w − 1 to 5w + 3**. Even weeks used: **week 2 = days 9-13, week 4 = days 19-23, week 6 = days 29-33**.
  Odd weeks (the comparison): **week 1 = days 4-8, week 3 = days 14-18, week 5 = days 24-28**. (The brief that ordered this
  study wrote "days 10-14, 20-24, 30-34"; the paper's counting above is primary, and the brief's, week w = days 5w to 5w + 4
  with odd weeks 5-9 / 15-19 / 25-29, is reported as sensitivity S1, not judged.)
- A **cycle** runs from day −1 of a scheduled meeting to the day before day −1 of the next scheduled meeting. A window (one
  week) is used only when all five of its days lie inside its cycle, so week 6 (and sometimes week 5) is dropped in short
  cycles. No day of week 0 or of week 7 and later is ever used.
- **Unscheduled announcements, primary**: they never start a cycle, and a window is dropped (from either side) when its
  entry day or any of its five days falls on days −1 to +3 of an unscheduled announcement (its day 0 = the first trading day
  on or after its date).
- Holes: a window is dropped if two consecutive trading days in it (entry day included) are more than 5 calendar days apart.

## The trade (T1)

For every usable window, even and odd alike: **buy at the close of the trading day before the window** (day 5w − 2), **stop
at entry − 2 x ATR(20)** (true range of the 20 folded days up to and including the entry day; every trade has a stop),
**exit at the close of the window's last day** (day 5w + 3), or earlier at the stop: a day whose open is at or below the stop
exits at the open (gap), else a day whose low is at or below the stop exits at the stop. Long only. Result in **% of the entry
price**.

- **Costs (fixed now)**: round trip **SPX500 1.0 index point, NAS100 2.0 points, US30 3.0 points** (the first two are
  `pre-fomc-drift`'s; US30 3.0 is the ICT lab's YM round trip in `api/_ictlab.js`; all several times the demo spread measured
  by `cost-floor-map`, conservative), plus long financing of **6 % a year of the entry price / 365 per rollover crossed**
  (rollover = 22:00 UTC on a weekday, Friday counts three: `pre-fomc-drift`'s rule and rate; no index financing rate is
  measured in the repository, so this is an assumed rate, said as one). Net % = gross % − point cost / entry − financing.
- **Per day** = net % of the window / 5 (a window stopped early is still divided by 5: the money sat out the rest).

## The statistic

- Per cycle c with at least one usable even and one usable odd window: **D_c = mean over its even windows of net % a day −
  mean over its odd windows of net % a day**. A cycle belongs to the window of its meeting date.
- t = mean(D) / (sd(D) / √n) across cycles (cycle blocks, about six weeks, non-overlapping; longer than weekly blocks).
- **Windows**: IS = meetings 2008-01-01 to 2016-12-31; **OOS = meetings 2017-01-01 to the data's end (decides)**; full
  2008 → now reported.
- **Holm** over the three markets' OOS net tests: one-sided p = 1 − Φ(t) (normal), Holm-adjusted; "t ≥ 2 after Holm" means a
  Holm-adjusted p ≤ 1 − Φ(2) = 0.02275.
- **Placebo**: 40 seeds (mulberry32, seeds 1-40). In each seed every scheduled meeting's day 0 is moved by its own random
  number of trading days drawn uniformly from ±5 … ±20 (32 values); the moved dates are sorted and de-duplicated and the
  whole counting, trade and statistic are recomputed for SPX500 OOS (unscheduled exclusions as in the real run). Placebo
  statistic = OOS mean D net.

## Pass bar (SPX500, all four)

1. OOS mean D net > 0 with t ≥ 2 after Holm (above);
2. IS mean D net > 0 (same sign);
3. at 2 x costs: OOS mean D > 0 **and** the even-week long alone (mean net % a day over the OOS even windows) > 0;
4. OOS mean D net above at least **38 of the 40** placebo seeds.

PASS = all four on SPX500. NAS100 and US30 are reported with their Holm-adjusted p, as confirmation or not; they do not
rescue a SPX500 fail. A pass would be a lead for a forward paper shadow and a replication on other indices, never "an edge".

## Reported, not judged

- T2: the even-week long alone and the odd-week long alone: n windows, mean net % a day, t on calendar-month sums of window
  net % (by exit month), IS / OOS / full; gross figures beside every net one.
- S1: the brief's counting (above). S2: unscheduled announcements not excluded. Per year (OOS, SPX500). Stops taken.
- The verdict reason is written inside the bold "**Verdict: …**" line of RESULT.md, the whole headline under 220 characters.

## Files

`dates.mjs` (FOMC dates), `run.mjs` (`fetch <dir>` = the three daily files from council-data with `git show`; `<dir>` = run;
writes `result.json` and `RESULT.md`), `tests/fomc-even-week.test.mjs` (offline: the counting on hand-made dates, the report
against result.json).
