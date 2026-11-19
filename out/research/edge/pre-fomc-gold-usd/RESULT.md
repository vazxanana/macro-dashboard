# The pre-FOMC drift in gold and the US dollar: result

**Verdict: FAIL.** 0 of 2 tests meet the pre-registered bar. T1 long gold, 2016 → now: n 86, +0.070R a trade net, t +1.26, Holm p 0.19; 2008-15 −0.049R (n 64). T2 short USD basket, 2016 → now: n 86, +0.061R a trade net, t +1.32, Holm p 0.19; 2008-15 +0.016R (n 64). T3 (gold before rate changes) was not run: the event list has no decision (rate-change) field, so T3 was dropped before any data was seen.

A stand-alone rule, pre-registered in `PREREGISTRATION.md` (committed before any candle was fetched). It is not, and cannot become by this study, a gate, exit, entry or size of the live gold book (docs/owner-decisions.md item 44). Paper research only; nothing live changed.

Events: 150 scheduled FOMC statements, 2008 to November 2026 (Federal Reserve FOMC meeting calendars (federalreserve.gov/monetarypolicy/fomccalendars.htm and the historical materials by year), scheduled meetings only; 2022 on from council/events.mjs); unscheduled 2008-01-22, 2008-10-08, 2010-05-09, 2020-03-03, 2020-03-15 excluded. **The 2008-2021 dates are unverified** (2008-2021 event dates written from memory in a sandbox that cannot reach federalreserve.gov: unverified (2016-21 inside the decisive window); 2022 on from council/events.mjs). Rule: enter at the close of the M15 candle ending 24 h before the scheduled FOMC statement, exit at the close of the one ending 15 min before it; each leg a stop 1.0 x ATR(20) of New York days on its losing side. Data: OANDA mid M15 candles through the candle proxy.

Costs: gold $0.30 a round trip + FIN.xau.long x nights x entry (council/fills.mjs); forex commission 0.000045 of price a round trip + one default spread of slippage (0.0001; USD/JPY 0.01) + charged swaps from council-data ctrader/symbols.json: EUR/USD long 0.621 pip a night, GBP/USD long 0.179 pip; AUD/USD long is a credit (counted 0); USD/JPY short not in the file (counted 0).

## Per test and window

| test | window | n | gross R | net R a trade | t | one-sided p | net R at 2x costs | win | stops (legs) | placebo mean | placebo 95th pct | beats seeds |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 2008-2015 (replication, dates unverified) | 64 | −0.019 | −0.049 | −0.64 | 0.7371 | −0.078 | 44 % | 7 | +0.009 | +0.127 | 8 / 40 |
| T1 | 2016 → now (decisive) | 86 | +0.098 | +0.070 | +1.26 | 0.1055 | +0.043 | 50 % | 3 | +0.038 | +0.125 | 27 / 40 |
| T2 | 2008-2015 (replication, dates unverified) | 64 | +0.035 | +0.016 | +0.32 | 0.3753 | −0.003 | 55 % | 41 | −0.032 | +0.075 | 29 / 40 |
| T2 | 2016 → now (decisive) | 86 | +0.084 | +0.061 | +1.32 | 0.095 | +0.039 | 51 % | 17 | −0.011 | +0.069 | 37 / 40 |

## The bar

| test | net R > 0, 2008-15 | net R > 0, 2016 → now | Holm p (2016 → now) < 0.05 | n ≥ 60 | pass | above placebo 95th pct |
|---|---|---|---|---|---|---|
| T1: long gold (XAU/USD) | no | yes | no (0.19) | yes | **no** | no |
| T2: short USD (long EUR/USD, GBP/USD, AUD/USD; short USD/JPY), equal risk | yes | yes | no (0.19) | yes | **no** | no |

Holm is over the two window-B tests. The placebo and the 2x-cost column are reported beside the bar, as pre-registered.

## Without the stop and the costs (descriptive)

Mean signed % move from the entry close to the exit close (gold long; the basket = mean of the four legs, USD/JPY short):

- T1: 2008-2015 −0.0555 % (t −0.47); 2016 → now +0.1202 % (t +1.50).
- T2: 2008-2015 +0.0919 % (t +1.30); 2016 → now +0.0731 % (t +2.09).

## By year (net R a trade, n)

- T1: 2008 −0.15 (8) · 2009 +0.09 (8) · 2010 −0.15 (8) · 2011 +0.40 (8) · 2012 −0.51 (8) · 2013 +0.01 (8) · 2014 −0.10 (8) · 2015 +0.03 (8) · 2016 +0.31 (8) · 2017 +0.07 (8) · 2018 −0.04 (8) · 2019 −0.02 (8) · 2020 +0.33 (7) · 2021 −0.25 (8) · 2022 −0.14 (8) · 2023 +0.29 (8) · 2024 +0.32 (8) · 2025 −0.20 (8) · 2026 +0.15 (7)
- T2: 2008 +0.16 (8) · 2009 +0.20 (8) · 2010 −0.17 (8) · 2011 −0.12 (8) · 2012 +0.04 (8) · 2013 +0.07 (8) · 2014 −0.12 (8) · 2015 +0.07 (8) · 2016 +0.03 (8) · 2017 +0.17 (8) · 2018 −0.02 (8) · 2019 +0.07 (8) · 2020 +0.38 (7) · 2021 −0.22 (8) · 2022 +0.10 (8) · 2023 +0.30 (8) · 2024 +0.34 (8) · 2025 −0.20 (8) · 2026 −0.29 (7)

## Skipped events

- T1 A: none
- T1 B: none
- T2 A: none
- T2 B: none

## Event list check (descriptive, nothing dropped)

Range of the EUR/USD M15 candle starting at the statement time against the same candle on nearby weekdays: median 7.61x. Below 1x: 2013-01-30. No candle at the statement time: none.

## What this means

The pre-registered bar is not met by either test, so the pre-FOMC drift is not an edge in gold or the dollar on the council's feeds after costs. No proposal is written and nothing live changed. Any other version (another hold, a rate-change filter, other pairs) would need its own pre-registration on data not used here.

To repeat: `node --use-env-proxy research/edge/pre-fomc-gold-usd/fetch.mjs <dir>`, then `node research/edge/pre-fomc-gold-usd/run.mjs <dir>`. Tests: `tests/pre-fomc-gold-usd.test.mjs`.
