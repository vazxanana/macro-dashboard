# Pre-registration: the Treasury auction cycle in bond CFD prices (14 Nov 2026)

Written and pushed before any number of this study is computed. Research only: no rule, size, filter, stop, config or council
member changes. Paper only. Not an ICT study, not mixed with any council system.

## Why
The claim: Lou, Yan and Zhang, "Anticipated and Repeated Shocks in Liquid Markets" (Review of Financial Studies, 2013; cited
from memory, NOT opened: the publisher and SSRN hosts are not reachable from the build sandbox). Dealers and investors must
absorb a known, repeated supply of new Treasury coupon securities at each auction; because capital is slow to move, yields
of the securities being auctioned (and nearby maturities) tend to rise in the days before the auction and fall back after
it, so prices fall into the auction and recover after it. Nothing here relies on a figure from the paper; only the direction
of the claim is tested, on the CFDs the desk can reach, net of costs.

Not run before: the repository and every branch were searched for "auction" on 14 Nov 2026. The only hits are the macro
library's reference notes (`research/macro-veteran/`, reading only), `gold-lbma-fix` (the LBMA gold price auction) and an
NQ "auction market" video note. No Treasury-auction study exists. Related bond studies (other windows, not overlapping this
question): `bond-month-end` (#939, FAIL 0 of 2), `bond-month-end-replicate`, `bond-month-end-futures` (#943),
`bond-fomc-drift`, `bond-intraday-momentum`, `bond-lead-intraday` (branches).

## Data
- OANDA mid daily CFD candles from council-data `research/daily/<key>.json` (complete UTC daily candles; read with
  `git show origin/council-data:research/daily/<key>.json`, no network; `run.mjs fetch <dir>` writes them outside git).
- Judged: `usb10y` (USB10Y_USD). Reported only: `usb30y` (USB30Y_USD), `usb05y` (USB05Y_USD).
- The close of a day = the close of the OANDA daily candle of that UTC date (19:00 / 20:00 New York), i.e. after the 13:00
  New York auction result on an auction day. Stated limit: the paper measures cash yields at New York closes.

## Trading days (copied from `bond-month-end`, unchanged)
US trading day = a weekday that is not a US bond-market full holiday: `council/datacheck.mjs` `usHolidays(y)` (imported, read
only) in its own year, less its two half days (day after Thanksgiving, 24 December) and Juneteenth before 2022, plus Columbus
Day and Veterans Day (observed), plus the special closures 11 Jun 2004, 2 Jan 2007, 29-30 Oct 2012, 5 Dec 2018, 9 Jan 2025.
Weekend / holiday candles fold into the next trading day's bar (open first, high / low over all, close the day's own).

## Auction dates: derived by rule (the official schedule could not be read)
TreasuryDirect (`www.treasurydirect.gov`) and Fiscal Data (`api.fiscaldata.treasury.gov`) were tried once on 14 Nov 2026
through the session proxy: both refused (connect rejected). So the dates are an approximation, fixed now:
- **10-year note (A10)**: from January 2009 (monthly 3-, 10-, 30-year cycle: new notes in the refunding months Feb / May /
  Aug / Nov, reopenings in the others; from memory, not opened), the auction day of a month = **the Wednesday that falls on
  the 7th to the 13th of the month; if that day is not a US trading day, the previous US trading day.**
- **30-year bond (A30)**: the Thursday that falls on the 8th to the 14th (the day after A10's Wednesday); if not a US trading
  day, the previous US trading day.
- **5-year note (A5)**: the Wednesday that falls on the 21st to the 27th; if not a US trading day, the previous US trading day
  (the 2-, 5-, 7-year cycle of the last full week; rougher than the other two, reported only).
- Months before January 2009 are not tested (the 10- and 30-year schedules were not monthly then, from memory).
- **What is known about the rule's precision**: two real dates are on file, from the Forex Factory calendar the Macro
  strategist stores in council-data `macro/cache.json` (history since 7 Nov 2026): the 10-year auction on Tue 10 Nov 2026
  (Wed 11 Nov was Veterans Day) and the 30-year on Thu 12 Nov 2026. A table of 2024 dates written FROM MEMORY (not opened) is
  compared too and labelled so. Known ways the rule misses: FOMC weeks (the auctions are moved to avoid the FOMC day, often
  by one or two days, most often in December), other holiday weeks. Every date is "approximate": result.json counts how many
  months are on the plain Wednesday / Thursday and how many were moved by a holiday, and says the rest is unverified.
  **If the dates cannot be shown to be within +/- 1 trading day for most months (they cannot, with two verified dates),
  this test measures a fuzzy window around the auction and a FAIL is weak evidence against the published effect.**

## The rule
- **T1 (judged)**: SHORT `usb10y` at the close of the US trading day 5 trading days before A10 (A10-5); cover at the close of
  A10. One trade a month; trades never overlap.
- Reported only: **L10** long `usb10y` from the close of A10 to the close of A10+5; **S30 / L30** the same on `usb30y` around
  A30; **S5 / L5** the same on `usb05y` around A5.
- **Stop (absolute rule 1)**: 1.5 x ATR(20), ATR = simple mean of the true range of the 20 trading-day bars ending with the
  entry day; above the entry for a short, below for a long. Checked on every daily candle after the entry candle up to the
  exit candle: a candle opening through the stop fills at its open, else a high (short) / low (long) through it fills at the
  stop. Every trade has a stop.
- **R** = (entry - exit) / dist for a short, (exit - entry) / dist for a long; dist = 1.5 x ATR.
- **Costs** (the bond-month-end model, unchanged): round trip usb05y 0.03 %, usb10y 0.03 %, usb30y 0.05 % of the entry
  price. **Financing**: 3 % a year of the entry price per calendar night from entry to exit, ALWAYS charged, short or long
  (conservative: no measured rate exists for these CFDs; a short may earn).
- Net R = gross R - (cost + financing) x entry / dist. Reported at 0 x, 1 x (base) and 2 x costs and financing.
- **Futures cost line** (#943's method, reported, not judged): futures net R = gross R - round trip in points / dist,
  financing zero, one CFD point taken as one futures point: ZN (10-year) 1/64 + 0.0037 = 0.019325 pt; ZB (30-year)
  1/32 + 0.0037 = 0.034950 pt; ZF (5-year) 1/128 + 0.0037 = 0.011513 pt (ticks and fees as #943 / the replicate study: from
  web summaries and memory, not opened).

## Windows
All rule months January 2009 to the last month whose trade has its exit on file (October 2026 expected: the candle file ends
6 Nov 2026, before the November auction). **In sample = the first half of those months by count (the first floor(N / 2)),
out of sample = the rest.** (The candle file starts in 2003; the half is taken over the tested period because the date rule
does not cover 2003-08.)

## The test (T1) and the bar
Statistics on calendar-month sums of net R (one trade a month, so the month sum is the trade; a skipped month has no value).
T1 passes when ALL hold:
1. out-of-sample one-sample t of the monthly net R (base cost) >= 2;
2. in-sample mean net R (base cost) > 0;
3. out-of-sample mean net R at 2 x costs and financing > 0;
4. **random-window placebo**: 40 seeds (1 to 40). For each seed and each calendar year of the out-of-sample window, draw as
   many trades as the rule took that year, each entered at the close of a US trading day drawn uniformly (with replacement)
   from that year's trading days, held 5 trading days, short, same stop, costs and financing (the bond-month-end design with
   this study's hold and side). The rule's out-of-sample mean net R must be above at least 38 of the 40 seed means (>= 95 %).

**Verdict PASS** when T1 passes; otherwise FAIL. Only this rule is judged: no other offset, hold, stop, cost or market is
tried and reported as a finding.

## Reported, not judged
- **Timing placebo**: the same short with A10 shifted by -5 and by +5 trading days (and a profile of every shift from -10 to
  +10), to show whether the window's place relative to the (approximate) auction matters.
- The reported-only streams (L10, S30, L30, S5, L5) with the same statistics and placebo.
- Per-year net R, stops hit, gap fills, cost sensitivity, the futures line for every stream, the date-rule check table.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict first), `tests/treasury-auction-cycle.test.mjs`. A proposal (paper shadow
only, never a live change) only if the verdict is PASS.
