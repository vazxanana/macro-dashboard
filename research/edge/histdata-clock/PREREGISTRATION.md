# HistData M1 clock audit: pre-registration

Written 10 Nov 2026, before `run.mjs` was written or run. This is a data audit, not a trading study: it tests no rule and
finds no edge. Its only question is which clock the HistData M1 research files are stamped in, per symbol and per year.

## Why

Every study in `research/edge/` that reads `research/candles/*` (council-data) turns the file's time label into UTC. The
repo has three different conversions in use:

- **fixed**: the label is UTC−5 all year (what HistData documents: "EST without daylight saving"). Most ICT studies.
- **new-york**: the label is New York wall-clock time, daylight saving included. The gold-systems, robustness, timing,
  costs and NQ open-run loaders.
- **europe**: UTC−5, and UTC−4 while Europe is on summer time. The event-reaction builder (its Amendment 1).

They cannot all be right. Which one a study used decides which hour every bar falls in.

## What is already known (disclosed, so nobody mistakes it for a blind test)

- `academy/data/clock-check.json` (10 Nov): gold H1 against OANDA in 27 weeks. 2018: the new-york reading matches in all
  three weeks. 2019 to 2026: the new-york reading is one hour early in the weeks the US is on daylight time and Europe is
  not, and matches in the May weeks.
- `research/edge/event-reaction/preregistration.md` Amendment 1 (9 Nov): CPI release spikes on gold and the dollar index.
- The unmerged branch `wip/data-clock-fixes` proposed a hybrid: new-york for 2018, europe from 2019.

So the hybrid is the favourite going in. The audit below is built so that it can fail: every rule is scored by the same
checks, and a symbol or year where the checks are thin or disagree is marked UNCERTIFIED, not guessed.

## Candidate rules (label time → UTC), fixed before running

| id | rule |
|---|---|
| R1 fixed | UTC = label + 5 h, all year |
| R2 new-york | label is New York wall-clock time: + 5 h, + 4 h from the 2nd Sunday of March to the 1st Sunday of November |
| R3 europe | + 5 h, + 4 h from the last Sunday of March to the last Sunday of October |
| R4 hybrid | R2 for labels before 1 Jan 2019, R3 from then on (the two agree from 4 Nov 2018 to 10 Mar 2019, so no stamp depends on the switch date) |

Every rule gives one offset (4 or 5 hours) for a whole Monday-to-Friday week, because all of the clock changes fall on a
Sunday while these markets are shut. The checks therefore work on "which offset does this week (or this release) show?".

**Mismatch windows**: the weeks between the 2nd and the last Sunday of March, and between the last Sunday of October and
the 1st Sunday of November. Only there do R2 and R3 differ. R1 differs from R3 in every European summer week.

## Data

- HistData M1 files as stored in council-data `research/candles/` (read only): XAUUSD, XAGUSD, NSXUSD, SPXUSD, UDXUSD,
  EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF; 2018 to October 2026. No bar is changed.
- Independent feed: OANDA mid H1 candles, UTC, through the site's keyless proxy (`/md/bars`), cached outside the repo.
  Mapping: XAUUSD → xau, XAGUSD → xag, NSXUSD → nas100, SPXUSD → spx500, the six pairs → the same pair.
  UDXUSD has no OANDA instrument: it is compared with OANDA EUR/USD with the sign flipped (the euro is 57.6 % of the
  index). That is a proxy and is named as one in the result.
- Release times: `council/events.mjs` HISTORY and EVENTS (CPI, NFP, FOMC, January 2022 on, read only); CPI 2018-21 from
  the BLS dates already listed in `research/edge/event-reaction/build.mjs`; NFP 2018-21 by the BLS rule (first Friday of
  the month, 08:30 New York; moved to Thursday 2 July 2020, and to the second Friday in January 2021, July 2018 / 2019 and
  where the first Friday is 1 January); FOMC 2018-21 from the Federal Reserve's meeting calendars (scheduled meetings
  only, statement 14:00 New York). A date with no clear spike is not counted for or against any rule, so a wrong date
  cannot support a rule.

## The checks

### A. Release minutes (outside source: the official release time)

For each release and symbol, two candidate label minutes: release UTC − 5 h and release UTC − 4 h. For a candidate minute m,
`ratio = max(range of the M1 bars labelled m and m+1) / median range of the M1 bars labelled in [m − 35, m − 5)` (at
least 20 bars in that half hour, else the candidate is not read).

- The release **shows offset k** when `ratio(k) ≥ 4` and the other candidate's ratio is `< 2`. Anything else is "not clear"
  and is not counted.
- Index symbols (NSXUSD, SPXUSD) and 08:30 New York releases: if the true offset is 5, the other candidate minute is the
  09:30 cash open, which spikes by itself. So for those: `ratio(5) ≥ 4` shows offset 5 whatever `ratio(4)` is; and
  "`ratio(5) < 2` and `ratio(4) ≥ 4`" is recorded as "4, open-confounded", reported, and left out of the pass criteria.
  FOMC (14:00) is read normally for the indices.
- A release agrees with a rule when the offset it shows is the offset the rule gives for that instant.

### B. Hourly returns against OANDA (outside source: a second feed with a known clock)

For each symbol and each Monday-to-Friday week (UTC), for each trial offset k in {3, 4, 5, 6} hours: build HistData hourly
closes as "the last M1 close whose label + k hours falls in that UTC hour"; take log returns between consecutive hours
that exist in both series; Pearson correlation with OANDA's H1 close-to-close returns over the week. At least 60 paired
hours, else the week is not read.

- The week **shows offset k** when k has the highest correlation, that correlation is `≥ 0.80`, and it beats the
  runner-up by `≥ 0.25`. Otherwise the week is "not decisive" and not counted.
- Every week of every year is read, not a sample: the mismatch windows, and all the control weeks in each season.

### C. Weekly close and reopen (inside the files: the venue's own week)

These venues close and reopen at a fixed New York time all year. For each weekend (a label gap of 40 hours or more), the
first label after it is converted with each rule to UTC and then to New York wall-clock time. Per symbol and rule, the
reference is the most common reopen minute (5-minute bins) over all weekends 2018-26.

- A weekend agrees with a rule when its reopen is within 10 minutes of that rule's reference minute.
- The same is reported for the last label before the weekend (the close), as a description only: closes vary more
  (early closes, thin last minutes).

### D. Raw-file artefacts at the clock changes (inside the files: labels only, no conversion)

- D1. The label gap across each weekend, minus the symbol's usual gap that year (its median). If the file clock and the
  venue clock change on different Sundays, the gap is one hour short or long on exactly those weekends. Each rule predicts
  the pattern for the four change weekends of a year (US spring, EU spring, EU autumn, US autumn):
  R1: −1 h, 0, 0, +1 h. R2: 0, 0, 0, 0. R3: −1 h, +1 h, −1 h, +1 h. R4: as R2 in 2018, as R3 from 2019.
  A change weekend agrees with a rule when the deviation is within 10 minutes of the prediction.
- D2. Repeated labels and missing label hours on the weekdays next to each change date (a clock that jumped while the
  market was open would repeat or skip an hour). Reported; expected: none, under every rule.

A and B are independent of each other and of the files' internal structure. C and D both rest on the venue's week, so they
count as one family ("session").

## Pass criteria, per symbol and year

A rule is **CERTIFIED** for a symbol-year when all of these hold for that rule:

1. **A**: at least 8 clear releases; at least 95 % of them agree; none of the clear releases inside a mismatch window
   disagrees.
2. **B**: at least 30 decisive weeks; at least 98 % of them agree; at least 3 decisive weeks inside the mismatch
   windows, and every one of those agrees.
3. **Session (C and D1)**: at least 85 % of the weekends agree in C; every Sunday reopen inside a mismatch window
   agrees in C; at least 3 of the 4 change weekends agree in D1.
4. No other candidate rule that gives different offsets in that symbol-year also passes 1 to 3.

A symbol-year where no rule passes is **UNCERTIFIED**: its bars are excluded from results labelled certified, and no
offset is guessed for it beyond the best-supported rule being named with its counts. If a symbol-year fails only on
thin coverage (criterion counts not reached, with zero disagreements), it is reported as "UNCERTIFIED (thin)".

The converter that the studies will use is the single rule that is certified in the most symbol-years, provided that no
symbol-year certifies a different, conflicting rule. If two symbols certify conflicting rules, the converter takes the
symbol as an argument and the result says so. The choice is made on these counts only: no study result is looked at
before the rule is fixed, and the rule is never changed because of what a re-run shows.

## What will be reported

`result.json` and `RESULT.md`: per symbol and year, the counts for A, B, C, D1 (read / agree) under each rule and the
verdict; the list of every disagreement; the D2 artefact counts; the chosen converter; what is uncertified and why.
The before → after table of the studies re-run on the corrected clock is added to `RESULT.md` afterwards (Step 3 of the
work order); it is a consequence of the audit, not part of its evidence.
