# Result: the US dollar on the day before a US market holiday (2026-11-14)

**Verdict: FAIL**: the long USD dollar basket on the day before a US holiday (side learned 2005-14) makes +0.015R a holiday out of sample (n 109, t +0.53).

Judged on the pre-registered bar (PREREGISTRATION.md, pushed before any candle was read). Out of sample 2015-01-01 to 2026-11-06: +0.015R a holiday after costs (n 109, event t +0.53, month-sum t +0.52); in sample +0.003R (n 89); at 2x cost +0.007R; above 26 of 40 placebo seeds. Nothing live changed and no proposal follows.

Data: OANDA mid daily candles (UTC days, close 00:00 UTC = 19:00 / 20:00 New York), council-data research/daily/<key>.json (git show), weekend folded into Monday (council/fills.mjs foldWeekend); basket days 2002-10-24 to 2026-11-06 (6254; 128 dates skipped where a pair lacked the day or its previous candle differed). 198 NYSE full holidays from 2005-01-03 (ict/calendar.mjs cmeYear, the pre-holiday study's dayKind); pre-holiday days without a basket candle: none. **The close is the UTC daily close (19:00 or 20:00 New York), not 17:00 New York**: no intraday forex history for all seven pairs since 2005 is on file. Costs: 0.3 pip spread + 0.0045 % commission a round trip per leg. Financing: broker swaps (frozen 2026-11-14T03:13:45.026Z) for EUR, GBP, AUD, CAD, CHF, today's swap for every year; the fx-carry study's approximate rate table less 1 % for NZD and JPY; holiday value-date days not modelled.

Side: **long USD**, the sign of the in-sample mean gross long-USD basket % on pre-holiday days, applied out of sample (in-sample gross long-USD basket +0.0115 % a holiday).

## The pre-holiday day (judged)

| Window | n | gross % long USD | gross R (side) | net R cost 0 | net R base | net R 2x | event t | month-sum t (months) | won | leg stops | Welch t vs ordinary days (gross) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| In sample 2005-01-03 to 2014-12-31 | 89 | +0.0115 | +0.009 | +0.009 | +0.003 | −0.003 | +0.12 | +0.12 (80) | 50.6 % | 13 | +0.41 |
| Out of sample 2015-01-01 to 2026-11-06 | 109 | +0.0197 | +0.021 | +0.022 | +0.015 | +0.007 | +0.53 | +0.52 (99) | 53.2 % | 12 | +0.55 |

## Pass bar

| Test | Holds |
|---|---|
| T1 out of sample net R > 0, event t >= 2 and month-sum t >= 2 | no (+0.015R, t +0.53, month t +0.52) |
| T2 in sample net R > 0 | yes (+0.003R) |
| T3 out of sample net R > 0 at 2x cost | yes (+0.007R) |
| T4 above at least 38 of 40 placebo seeds | no (26 of 40) |

## Placebo

40 seeds, each drawing as many ordinary out-of-sample days per year as the rule traded (from 2761 ordinary days), traded on the same side with the same stop and costs. The rule's +0.015R is above 26 of them; seed means range −0.075R to +0.093R.

## Out of sample by holiday

| Holiday | n | net R | t |
|---|---|---|---|
| Christmas Day | 11 | −0.066 | −1.38 |
| Good Friday | 12 | +0.084 | +1.15 |
| Independence Day | 12 | −0.142 | −1.51 |
| Juneteenth | 5 | +0.211 | +1.41 |
| Labor Day | 12 | +0.097 | +1.47 |
| Martin Luther King Day | 12 | +0.166 | +1.84 |
| Memorial Day | 12 | +0.003 | +0.03 |
| New Year's Day | 10 | −0.001 | −0.01 |
| Presidents' Day | 12 | +0.019 | +0.34 |
| Thanksgiving Day | 11 | −0.129 | −1.10 |

Per leg, out of sample, gross % long USD a pre-holiday day: EUR +0.0751, GBP +0.0050, AUD −0.0046, NZD +0.0113, JPY +0.0287, CAD −0.0093, CHF +0.0319.

## The day after the holiday (reported only)

Side long USD, learned in sample the same way.

| Window | n | gross % long USD | gross R (side) | net R cost 0 | net R base | net R 2x | event t | month-sum t (months) | won | leg stops | Welch t vs ordinary days (gross) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| In sample | 88 | +0.0225 | +0.002 | +0.002 | −0.004 | −0.010 | −0.10 | −0.10 (80) | 56.8 % | 32 | +0.48 |
| Out of sample | 110 | +0.1078 | +0.095 | +0.096 | +0.089 | +0.082 | +2.65 | +2.50 (99) | 62.7 % | 23 | +2.59 |

## Reading

- The day after the holiday was pre-registered as reported only, and it is reported only: out of sample +0.089R a holiday (n 110, t +2.65) on a side learned in a sample where it made −0.004R (t −0.10). A window with no in-sample support, picked from a second look, is not evidence; it would need its own pre-registration on data not yet read, and the 2015-now figures cannot be that data.
- One observation is one holiday (the seven legs of one basket are one bet, not seven); about nine holidays a year.
- The UTC close sits two or three hours after the 17:00 New York rollover; a test at 17:00 New York would need intraday candles since 2005 for all seven pairs.
- Today's broker swaps are charged on every past year; the NZD / JPY rate table is approximate; the extra value days some brokers roll before a US holiday are not charged. On a one-day hold financing is small next to the spread and commission.
- Paper only. Never call this an edge without its n and t.

To repeat: `node research/edge/fx-us-holiday/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Test: `tests/fx-us-holiday.test.mjs`.
