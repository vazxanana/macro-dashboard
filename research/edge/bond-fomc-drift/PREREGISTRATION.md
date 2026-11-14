# Treasuries after the FOMC: follow the 2-year's reading of the decision: pre-registration

Written and committed **before** any candle was fetched for this study or any trade computed (14 Nov 2026). The event list,
the signal, the rule, the costs, the windows, the placebo and the pass bar are fixed here; nothing in them changes after the
results are seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. ICT is not involved. A pass is a
hypothesis for a forward paper shadow that the owner decides on; it is never a live rule. Paper and demo only.

## The claim being tested

The market's own reading of an FOMC decision shows first in the 2-year Treasury, the maturity most tied to the policy path.
The claim: when the 2-year's price ROSE (its yield fell) between just before the statement and the 16:00 New York close of
the decision day, the market read the decision as dovish, and long-duration Treasuries keep rising over the next three
trading days as the reading is absorbed; when the 2-year's price fell, they keep falling. A follow-through, not a
pre-announcement drift (the published "pre-FOMC drift" in bonds is weak and is not tested here).

## What is already known (seen before this was written)

- `tsmom` (branch, PR #892, 13-14 Nov 2026): 12-1 month momentum on 25 OANDA markets; its bond set (usb10y, de10yb,
  uk10yb) lost: 2016-26 −0.239R a month (t −0.78), 2008-15 −0.843R (t −2.96). A monthly trend rule; nothing about FOMC
  days. Its rule is not repeated here. Its cost assumption for bond CFDs (0.10 % of price a round trip) is reused.
- `pre-fomc-drift` (branch): long SPX500 / NAS100 in the 24 h before the statement, FAIL (2016 → now SPX500 +0.044R, t 1.35,
  inside the placebo). `fomc-follow` (branch): a follow rule on other markets after FOMC; neither touched Treasuries.
- That OANDA serves USB02Y, USB10Y and USB30Y M5 candles from January 2008 through the candle proxy (one request of
  7 January 2008 each, made only to see whether the history exists; no return was computed), and that council-data
  `research/daily/usb02y|usb10y|usb30y.json` start in March / April 2003.
- No study in this repository has measured a Treasury CFD around FOMC.

## Event list (scheduled FOMC decision days only)

Copied into `events.mjs` of this study (never imported from another study or branch):
- 2008-2021: the list of `pre-fomc-drift/events.mjs` (written there from the Federal Reserve's FOMC meeting calendars,
  federalreserve.gov "Meeting calendars and information" and "Historical materials by year"; the build sandbox cannot reach
  federalreserve.gov, so these dates are from memory there and should be checked against that source; a release-minute
  check below reports any date without a visible reaction).
- 2022 on: `council/events.mjs` (`HISTORY` + `RAW.FOMC`), copied as fixed dates; a test checks the copy against that file.
- Excluded: the unscheduled announcements 22 Jan 2008, 8 Oct 2008, 9 May 2010, 3 Mar 2020, 15 Mar 2020; the scheduled
  17-18 Mar 2020 meeting (replaced by 15 Mar). Decision day `D` = the statement date (New York).
- Statement time `T` (New York, DST-correct): 14:15 for 2008-2012, 12:30 on the 2011-2012 press-conference meetings
  (27 Apr, 22 Jun, 2 Nov 2011; 25 Jan, 25 Apr, 20 Jun, 13 Sep, 12 Dec 2012), 14:00 from January 2013.
- **Release-minute check** (validates the list, decides nothing): the USB02Y range of the M5 candle starting at `T` against
  the median range of that same clock candle on the weekdays within ±25 days; an event under 1x is listed, never dropped.

## Data

OANDA mid M5 candles of USB02Y, USB10Y, USB30Y through the site's keyless proxy (`/md/bars`), 1 Nov 2007 to 13 Nov 2026,
complete candles only (`node --use-env-proxy research/edge/bond-fomc-drift/fetch.mjs <dir>`; kept out of git). Daily
candles for the ATR: council-data `research/daily/usb10y.json`, `usb30y.json` (complete UTC days; Saturday / Sunday candles
folded into the next weekday by `council/fills.mjs` `foldWeekend`). New York times are converted with the zone rules of
each date (DST-correct). The 2-year yield for financing: weekly FRED DGS2, copied from `index-overnight/rates.json`
(itself a copy of `gold-carry/rates.json`), into this study's `rates.json`.

## Signal (decision-day data only)

`S` = close of the USB02Y M5 candle ending at 16:00 New York on `D` minus the close of the USB02Y M5 candle ending at
`T − 5 min` on `D` (13:55 for a 14:00 statement, 14:10 for 14:15, 12:25 for 12:30). If no candle ends exactly there, the last
candle ending in the 30 minutes before it; none → the event is skipped and listed. `S > 0` (price up, yield down) → BUY;
`S < 0` → SELL; `S = 0` → no trade. No threshold, no scaling by size.

## The trade (one per event per market; T1 USB10Y, T2 USB30Y, the same signal)

- **Trading day** = a New York weekday whose M5 file of that market holds the 09:30 candle and a candle ending in
  15:30-16:00. Entry day `E1` = the first trading day after `D`; `E3` = the third trading day counting `E1` as the first.
- **Entry**: the open of the M5 candle starting 09:30 New York on `E1`.
- **Exit**: the close of the M5 candle ending 16:00 New York on `E3` (if none ends exactly there, the last ending in the
  30 minutes before it).
- **Stop (every trade has one)**: 1.5 x ATR(20) on the losing side of the entry, ATR(20) = the mean true range of the 20
  complete daily candles (weekends folded) that ENDED at or before the entry time. Checked on H1 candles built from the M5
  candles, hourly blocks starting at the entry (09:30-10:30, 10:30-11:30, …, the last block cut at the exit): a block that
  opens at or beyond the stop exits at its open (a gap), else a high / low that reaches the stop exits at the stop. Never
  moved. A trade with a stop distance ≤ 0 or no ATR is skipped and listed.
- **R** = side x (exit − entry) / stop distance.
- **Costs**: spread and slippage **0.10 % of the entry price a round trip** (the `tsmom` bond CFD assumption, stated there,
  not measured), plus **financing per rollover** counted by `council/fills.mjs` `nights(entryTime, exitTime)` (22:00 UTC
  weekdays, Wednesday three): a long pays (DGS2 + 2.5 %) / 365 of the entry price a night, a short pays max(0, 2.5 % − DGS2)
  / 365 (DGS2 = the last weekly value on or before the entry). Net R = R − (cost + financing) / stop distance.
  At x2 costs both parts are doubled.

## Windows

- **Decisive: 2016-01-01 to 2026-11-13.** **Replication: 2008-01-01 to 2015-12-31.** An event belongs to the window of `D`.

## Tests and statistics

- **T1** USB10Y, **T2** USB30Y (each: every event's trade). Holm over these two.
- **Pooled** (one test, reported beside them): both markets' trades together.
- Statistic: mean net R a trade; **t on calendar-month sums** of net R over the months that hold at least one trade
  (one FOMC a month, so a month is about one event; the pooled month sums both markets). One-sided p from that t
  (Student, n − 1). Also shown, never deciding: gross R, without financing, at x2 costs, win rate, stops hit, by year, by
  side, the per-trade t.
- **Placebo, 40 seeds** (seeded generator, seed 1 to 40): per window and market, the same number of trades as the real
  test, on days drawn without replacement from New York weekdays of that window that are not a scheduled or unscheduled
  FOMC day and not within 5 calendar days after one, with the same signal construction (USB02Y 13:55 → 16:00 that day),
  the same entry, stop, exit and costs. Reported: the 5th / 50th / 95th percentile of the seeds' mean net R and month t,
  and how many seeds the real test beats.

## Pass bar (all must hold for a test, decisive window)

1. Mean net R > 0 and month-sum t ≥ 2.
2. Holm-adjusted one-sided p < 0.05 (T1, T2).
3. Mean net R above the placebo's 95th percentile.
4. Replication window mean net R > 0.
5. Mean net R > 0 at x2 costs.

**Verdict**: PASS if T1 or T2 passes all five; the pooled test is reported with the same five checks (Holm on it = its own p)
and does not decide alone. Otherwise FAIL. A PASS is a hypothesis for a forward paper shadow; never a live rule.

## Not done, on purpose

No threshold on the 2-year's move, no other hold length, no other maturity, no European bonds, no pre-announcement drift,
no filter by the decision's size. Any of them would need its own pre-registration on data not used here.
