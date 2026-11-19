# Result: the Treasury auction cycle in bond CFD prices (14 Nov 2026)

Shorting the 10-year note CFD in the five days before its auction made +0.012R a trade net out of sample (n 107, t 0.13) and lost in sample.

**Verdict: FAIL.** Short `usb10y` from the close five US trading days before the 10-year note auction to the auction day's
close (stop 1.5 x ATR(20), dates derived by rule): out of sample (December 2017 to October 2026) +0.012R a trade after costs
and financing (n 107, t 0.13; +0.134R before costs, t 1.53); in sample (January 2009 to November 2017) -0.217R (n 107,
t -2.63; -0.107R before costs). At 2 x costs the out-of-sample mean is -0.111R. It beat 38 of the 40 random-window placebo
means (the only one of the four checks met). Not an edge on these CFDs; nothing live changed and no proposal is written.

Pre-registration: `PREREGISTRATION.md` (pushed alone, before any number was computed). Code: `run.mjs`. Every figure:
`result.json`.

**Read this FAIL as weak evidence about the published effect.** The official auction calendar could not be read
(TreasuryDirect and Fiscal Data were refused by the session proxy), so the dates come from a fixed rule (10-year: the
Wednesday on the 7th to 13th, moved to the previous trading day on a holiday). Only two dates are verified (10 Nov 2026 and,
for the 30-year, 12 Nov 2026, from the Forex Factory calendar the Macro strategist stores in council-data); the rule hits
both. Against ten 2024 dates written from memory (not opened) it hits eight and is one trading day late on two (FOMC weeks).
So the dates cannot be shown to be within one trading day for most months: this measures a fuzzy five-day window around the
auction, on CFD closes at 19:00-20:00 New York rather than the paper's cash yields.

## The judged test (T1; R a trade; net = after 0.03 % spread and 3 % a year financing; t on calendar-month sums, one trade a month)

| Window | n | gross R | t gross | net R | t | win % | stops |
|---|---|---|---|---|---|---|---|
| In sample 2009-01 to 2017-11 | 107 | -0.107 | -1.29 | -0.217 | -2.63 | 36.4 | 36 |
| Out of sample 2017-12 to 2026-10 | 107 | +0.134 | 1.53 | +0.012 | 0.13 | 51.4 | 26 |

| Check (all needed) | Value | Met |
|---|---|---|
| Out-of-sample t >= 2 (base cost) | 0.13 | no |
| In-sample net > 0 | -0.217R | no |
| Out-of-sample net > 0 at 2 x costs | -0.111R | no |
| Beats >= 38 of 40 random-window placebo means | 38 of 40 (rule +0.012R, placebo 95th pct +0.010R, median -0.045R) | yes |

Cost sensitivity, out of sample: 0 x +0.134R (t 1.53), 1 x +0.012R (t 0.13), 2 x -0.111R (t -1.31). **At ZN futures cost**
(one tick + $3.70 a round trip = 0.019325 points, no financing; #943's method, one CFD point taken as one futures point):
+0.110R out of sample (t 1.26), -0.128R in sample (t -1.53); 2 x +0.086R (t 0.98). It fails at futures cost too.

## Timing placebo (reported, not judged): the same short with the auction day shifted

| Shift (trading days) | OOS n | OOS net R | t | OOS gross R | IS net R | t |
|---|---|---|---|---|---|---|
| -5 | 108 | -0.202 | -2.46 | -0.077 | -0.185 | -2.21 |
| **0 (the rule)** | 107 | +0.012 | 0.13 | +0.134 | -0.217 | -2.63 |
| +5 | 107 | +0.052 | 0.57 | +0.177 | -0.072 | -0.78 |

Over every shift from -10 to +10 the rule's window ranks 5th of 21 out of sample; windows ending within a few days either side
of the auction are near zero net out of sample, those ending 5 to 10 days before it lose. In sample the rule's window is among
the worst (-2.63). Moving the window by a week does not change the answer: there is no consistent dip into the auction.

## Reported-only streams (same rule family, same costs; nothing judged)

| Stream | IS net R (t) | OOS net R (t) | OOS gross R (t) | OOS 2 x | OOS at futures cost (t) | placebo beaten |
|---|---|---|---|---|---|---|
| L10 long 10-year, A10 to A10+5 | -0.121 (-1.40) | -0.211 (-2.36) | -0.089 (-0.98) | -0.334 | ZN -0.113 (-1.24) | 11 / 40 |
| S30 short 30-year, A30-5 to A30 | -0.088 (-1.07) | +0.048 (0.53) | +0.126 (1.36) | -0.029 | ZB +0.107 (1.16) | 34 / 40 |
| L30 long 30-year, A30 to A30+5 | -0.018 (-0.21) | -0.151 (-1.97) | -0.074 (-0.96) | -0.228 | ZB -0.093 (-1.20) | 17 / 40 |
| S5 short 5-year, A5-5 to A5 | -0.161 (-2.14) | -0.261 (-3.58) | -0.060 (-0.81) | -0.463 | ZF -0.084 (-1.14) | 5 / 40 |
| L5 long 5-year, A5 to A5+5 | -0.202 (-2.56) | -0.149 (-1.66) | +0.056 (0.62) | -0.353 | ZF +0.032 (0.35) | 33 / 40 |

The "recovery after the auction" half of the claim is negative out of sample on all three markets' CFD closes before costs
on the 10- and 30-year. The 5-year dates are the roughest of the three (the last full week's 2-5-7 cycle) and overlap the
month-end window `bond-month-end` tested.

## Dates

- Rule (fixed before any result): 10-year A10 = the Wednesday on the 7th-13th; 30-year A30 = the Thursday on the 8th-14th;
  5-year A5 = the Wednesday on the 21st-27th; a day that is not a US bond trading day moves to the previous one; January 2009
  to October 2026 (214 months each; the file ends 6 Nov 2026, before the November auction). 211 months are on the plain
  weekday, 3 were moved by a holiday (Veterans Day on a Wednesday / Thursday).
- Verified: 2 dates (both hit). From memory, not opened: ten 2024 10-year dates, eight hit, two (12 Mar, 11 Jun 2024) one
  trading day earlier than the rule. Every other date is unverified. Known misses of such a rule: FOMC weeks (most often
  December) and holiday weeks, by one or two days.
- Before 2009 the 10- and 30-year schedules were not monthly (from memory): not tested, so the in-sample half is 2009-17
  rather than the first half of the candle file (2003 on).

## Per year (T1, net R total)
2009 +0.14, 2010 -2.13, 2011 -3.21, 2012 -4.10, 2013 +2.12, 2014 -2.55, 2015 -3.07, 2016 -4.65, 2017 -6.03, 2018 +0.63,
2019 -0.52, 2020 -2.36, 2021 -1.93, 2022 +2.60, 2023 -3.16, 2024 +3.72, 2025 +0.33, 2026 (10 months) +2.17. No stop was
filled by a gap.

## What this does not test
The paper's cash-yield, New York close measurement; the exact auction dates; the 2-, 3-, 7- and 20-year auctions; futures
prices themselves (the futures line is a re-cost of the CFD trades). A further test needs the official auction dates (the
Fiscal Data auction file, if a session can reach it) and its own pre-registration.
