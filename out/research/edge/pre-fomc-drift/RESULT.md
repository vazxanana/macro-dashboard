# The pre-FOMC announcement drift, out of sample: result

**Verdict: FAIL.** SPX500, 2016 → now (the window that decides): n 86, +0.044R a trade net of costs, t +1.35; the 40-seed placebo's 95th percentile is +0.092R (the FOMC windows beat 22 of 40 seeds). NAS100 does not confirm it: n 86, +0.090R, t +2.45, placebo 95th percentile +0.092R.

Pre-registered in `PREREGISTRATION.md` (committed before any candle was fetched). Events: 150 scheduled FOMC statements, 2008 to October 2026 (Federal Reserve FOMC meeting calendars (federalreserve.gov/monetarypolicy/fomccalendars.htm and the historical materials by year), scheduled meetings only; 2022 on from council/events.mjs); unscheduled 2008-01-22, 2008-10-08, 2010-05-09, 2020-03-03, 2020-03-15 excluded. Rule: buy at the close of the M5 candle ending 24 h before the scheduled FOMC statement, exit at the close of the one ending 5 min before it; stop entry - 1.5 x ATR(14) of New York days; long only. Costs: round trip SPX500 1.0 point, NAS100 2.0 points, XAU/USD $0.50, plus 6 % a year financing per rollover. Data: OANDA mid M5 candles through the candle proxy.

## Per market and window

| market | window | n | net R a trade | t | gross R | win | stops | placebo 95th pct | beats seeds | pass |
|---|---|---|---|---|---|---|---|---|---|---|
| SPX500 | 2008-2015 | 64 | −0.003 | −0.07 | +0.040 | 47 % | 3 | +0.037 | 30 / 40 | not judged |
| SPX500 | 2016 → now | 86 | +0.044 | +1.35 | +0.073 | 54 % | 1 | +0.092 | 22 / 40 | no |
| NAS100 | 2008-2015 | 64 | +0.019 | +0.36 | +0.060 | 48 % | 2 | +0.076 | 28 / 40 | not judged |
| NAS100 | 2016 → now | 86 | +0.090 | +2.45 | +0.107 | 58 % | 1 | +0.092 | 36 / 40 | no |
| XAU/USD (descriptive) | 2008-2015 | 64 | −0.054 | −1.04 | −0.025 | 39 % | 2 | +0.076 | 5 / 40 | not judged |
| XAU/USD (descriptive) | 2016 → now | 86 | +0.048 | +1.23 | +0.073 | 49 % | 0 | +0.072 | 31 / 40 | not judged |

Window A (2008-2015) and gold are descriptive, as pre-registered. "pass" = mean net R > 0, t ≥ 2 and above the placebo 95th percentile.

## The paper's own measure (descriptive)

Mean % change from the entry to the exit close, no stop, no costs:

- SPX500: 2008-2015 +0.3691 % (t +2.02); 2016 → now +0.1882 % (t +2.79).
- NAS100: 2008-2015 +0.4464 % (t +2.35); 2016 → now +0.3033 % (t +3.02).
- XAU/USD (descriptive): 2008-2015 −0.0584 % (t −0.49); 2016 → now +0.1278 % (t +1.59).

## By year, SPX500 (net R a trade, n)

2008 +0.16 (8) · 2009 +0.30 (8) · 2010 −0.21 (8) · 2011 −0.17 (8) · 2012 +0.04 (8) · 2013 +0.00 (8) · 2014 −0.17 (8) · 2015 +0.00 (8) · 2016 −0.01 (8) · 2017 +0.00 (8) · 2018 +0.05 (8) · 2019 −0.10 (8) · 2020 +0.15 (7) · 2021 −0.11 (8) · 2022 +0.27 (8) · 2023 +0.10 (8) · 2024 +0.20 (8) · 2025 +0.02 (8) · 2026 −0.10 (7)

## Event list check

Release-minute range of SPX500 against the same minute on nearby weekdays: median 4.61x. Below 1x (listed, not dropped): 2008-12-16, 2011-09-21. No candle at the release minute: none.

## What this means

The pre-registered bar is not met on SPX500 in 2016 → now, so this is not an edge on the council's feeds after costs. No proposal is written and nothing live changed. The figures above are the record; any other version of the rule (another hold, another market, a filter) would need its own pre-registration on data not used here.

What the placebo shows: random 24-hour long windows on the same weekdays, away from FOMC days, made +0.030R a trade on SPX500 and +0.034R on NAS100 on average across the 40 seeds in 2016 → now (an index long over any 24 hours earns the index's own drift). The FOMC windows sit at 22 and 36 of 40 seeds: whatever the paper's measure (above) shows before costs, after costs the pre-FOMC hours do not clear the placebo's 95th percentile on either index (the index drift, not an FOMC effect, is most of what the rule earns).

To repeat: `node --use-env-proxy research/edge/pre-fomc-drift/fetch.mjs <dir>`, then `node research/edge/pre-fomc-drift/run.mjs <dir>`. Tests: `tests/pre-fomc-drift.test.mjs`.
