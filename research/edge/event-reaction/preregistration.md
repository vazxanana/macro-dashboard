# Pre-registration: gold's reaction to US red-folder releases (the veteran's event playbook)

Written on 9 Nov 2026, before any reaction below was computed. The design, the windows, the buckets and the one test's pass
bar are fixed here. The test runs once and is reported whatever it shows. Nothing here changes a live rule, size or trade.

## Why

The veteran publishes an event playbook for each red-folder release within 72 hours (`council/playbook.mjs`). Its
"what happened before" panel needs reaction statistics that are honest: n, median and hit rate, labelled "descriptive,
not a tested edge" unless one pre-registered out-of-sample test passes. The owner's skill says "direction is set within
minutes (about 2.5-3 minutes in gold), with little drift afterwards" and "act after the release, not before". This file
tests one checkable version of that: after the first five minutes, does gold keep going the way the dollar first read the
print?

## Events

- **CPI** 08:30 New York. 2022-01 to 2026-10 from `council/events.mjs` (`HISTORY` and `EVENTS`, already checked against
  EUR/USD 1-minute bars). 2018-01 to 2021-12 from the BLS CPI release schedule of those years, added in `build.mjs`; each
  added date is kept only if the dollar index's (UDX) 5-minute range from the release minute is at least 2x the median of
  the same minute on the weekdays within ±25 days (the events.mjs check). Dates that fail are listed and dropped.
- **NFP** 08:30 New York and **FOMC statement** 14:00 New York: 2022-01 to 2026-10 from `council/events.mjs` only.
- Only events covered by the M1 files (council-data `research/candles/{xau,udx}-histdata`, HistData, EST without DST,
  +5 h to UTC) are used: from 1 Jan 2018 to 30 Oct 2026.

## Measures (per event; T = the scheduled minute)

- `pre`: XAU/USD close of the 1-minute bar that ends at T (the bar starting T-1). A bar up to 5 minutes older is accepted.
- `g5`, `g60`: gold % change from `pre` to the close at T+5 and T+60 minutes. `g5to60`: from T+5 to T+60.
- `dx5`, `dx60`: the same for the dollar index (UDX).
- **The dollar's read** of the print: `dx5 >= +0.05%` = "hot read" (dollar up), `dx5 <= -0.05%` = "cool read" (dollar
  down), else "in line". This is the market's own first read of the surprise, used because no survey consensus history
  exists in the repository; it is NOT a consensus surprise.
- For CPI 2022-24 only, a second split from the veteran batch's first-print ledger
  (`research/macro-veteran/references/cpi-first-print-release-ledger-2022-2024.json`): core first print minus the
  Cleveland Fed core nowcast captured the day before (a model benchmark, not survey consensus): `>= +0.05` hot,
  `<= -0.05` cool, else in line.
- Gold's release-day move (prior UTC daily close to the release day's UTC close, council-data `research/daily/xau.json`)
  is computed at run time by `council/playbook.mjs`, the same quantity the veteran's "gold up on the release day" call
  is scored on.

All statistics are descriptive (n, median, share up) except the one test below.

## The one test (CPI only)

**H:** on CPI release days with a clear dollar read (`|dx5| >= 0.05%`), gold's move from T+5 to T+60 has the sign
opposite to `dx5` (gold continues the way the dollar's first read sent it).

- Hit = `sign(g5to60) == -sign(dx5)`; a zero move is a miss.
- **Pass bar:** n >= 30, hit rate >= 60%, one-sided exact binomial p < 0.05 against 50%, AND the hit rate above 50% in
  both halves (2018-2021 and 2022-2026 separately). All four or it fails.
- There is no fitted parameter: the 0.05% threshold and the windows are fixed above, so every event is out of sample
  for this rule. The halves are the stability check.
- NFP and FOMC get the same numbers in the result, reported as secondary cells, never a pass route.

## What a pass would and would not mean

A pass makes the T+5→T+60 continuation a tested descriptive regularity the playbook may cite with its numbers. It is not
a trading rule: no cost, spread or slippage is modelled, the first five minutes are excluded on purpose (the skill says
do not trade the first spike), and nothing live reads it. A fail means the playbook labels every reaction statistic
"descriptive, not a tested edge".

## Amendment 1 (9 Nov 2026, after the first run; the design above is unchanged)

The first run converted the M1 files with +5 h all year, as the files' label says. The spike check then failed almost
every April-October release, and the bars showed why: the release spike sits at file time 08:30 in July (CPI 2019-06-12,
2024-07-11, 2026-07-14) and the FOMC of 3 Nov 2021 (14:00 EDT, after Europe's clocks went back) at file time 13:00. The
file clock is UTC−5, and UTC−4 while Europe is on summer time. `build.mjs` now converts with that rule (`fileToUtc`). The
first run's CPI test, on the wrong clock, was 20 of 32 (63%, p 0.11): a fail. Only the corrected run is reported in
RESULT.md; both runs fail the bar.
