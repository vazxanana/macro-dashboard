# Result: the US dollar on the first two trading days of a month (2026-11-14)

**Verdict: FAIL: the dollar basket over the first two days of a month, short USD (learned 2005-14): out of sample −0.030R a month (n 143, t −0.74), placebo 16 of 40.**

Judged on the pre-registered bar (PREREGISTRATION.md, pushed before any candle was read). Out of sample 2015-01-01 to 2026-11-02: −0.030R a month after costs (n 143, event t −0.74, month-sum t −0.74); in sample −0.026R (n 119); at 2x cost −0.038R out of sample; above 16 of 40 placebo seeds. Nothing live changed and no proposal follows.

**The direction was learned in sample and only applied out of sample**: side **short USD**, the sign of the in-sample mean gross long-USD basket %, learned in sample and applied out of sample (in-sample gross long-USD basket −0.0264 % a month). Choosing the side on the same years flatters the in-sample figure (here it is negative all the same: the side follows the gross % of the basket, while R weights each leg by its stop distance and the short side has its own stops); only the out-of-sample figures judge the rule.

Data: OANDA mid daily candles (UTC days, close 00:00 UTC = 19:00 / 20:00 New York), council-data research/daily/<key>.json (git show), weekend folded into Monday (council/fills.mjs foldWeekend); spx500 the same way for the reported split; basket days 2002-09-24 to 2026-11-06 (6280). 262 month-start events from 2005-02-01; months skipped (a pair missing a day or an extra candle in the window): 2005-01. **The close is the UTC daily close (19:00 or 20:00 New York), not 17:00 New York**: no intraday forex history for all seven pairs since 2005 is on file. Holiday candles the broker prints (1 January) count as basket days. Stop 1.5 x ATR(20) daily on every leg, checked on each held candle. Costs: 0.3 pip spread + 0.0045 % commission a round trip per leg (the demo's raw-spread account; its measured median spread is 0, so the 0.3 pip is conservative). Financing: broker swaps (frozen 2026-11-14T03:22:38.489Z) for EUR, GBP, AUD, CAD, CHF, today's swap for every year; the fx-carry study's approximate rate table less 1 % for NZD and JPY.

## Primary: close of the month's last day to the close of the 2nd day (judged)

| Window | n | gross % long USD | gross R (side) | net R cost 0 | net R base | net R 2x | event t | month-sum t (months) | won | leg stops | total R | worst DD R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| In sample 2005-02-01 to 2014-12-31 | 119 | −0.0264 | −0.012 | −0.021 | −0.026 | −0.033 | −0.69 | −0.69 (119) | 46.2 % | 86 | −3.12 | −6.70 |
| Out of sample 2015-01-01 to 2026-11-02 | 143 | −0.0002 | −0.009 | −0.023 | −0.030 | −0.038 | −0.74 | −0.74 (143) | 43.4 % | 103 | −4.23 | −5.26 |

## Pass bar

| Test | Holds |
|---|---|
| T1 out of sample net R > 0, event t >= 2 and month-sum t >= 2 | no (−0.030R, t −0.74, month t −0.74) |
| T2 in sample net R > 0 | no (−0.026R) |
| T3 out of sample net R > 0 at 2x cost | no (−0.038R) |
| T4 above at least 38 of 40 placebo seeds | no (16 of 40) |

## Placebo

40 seeds, each drawing one mid-month two-day window (entry on day 8 to 19 of the month) in every month that has an event, learning its own side from its in-sample windows and trading it out of sample with the same stop, costs and financing (1216 out-of-sample candidate windows). The rule's −0.030R is above 16 of them; seed means range −0.092R to +0.054R (sides learned: SLLLLLSSSLSLLLSSLLLSSSSSSLSLLLSSSSSLSSSL). Welch t of the events' gross long-USD basket % against all out-of-sample mid-month windows: +0.04.

Per leg, out of sample, gross % long USD over the two days: EUR +0.0176, GBP +0.1181, AUD −0.0446, NZD −0.0086, JPY −0.0937, CAD −0.0070, CHF +0.0165.

By year, net R a month on the rule's side: 2005 −0.09, 2006 +0.22, 2007 +0.01, 2008 −0.17, 2009 +0.11, 2010 +0.21, 2011 −0.20, 2012 −0.09, 2013 −0.08, 2014 −0.19, 2015 −0.07, 2016 +0.10, 2017 −0.15, 2018 −0.09, 2019 −0.05, 2020 +0.17, 2021 +0.14, 2022 −0.05, 2023 −0.09, 2024 −0.08, 2025 +0.06, 2026 −0.26.

## Day 1 alone (reported only)

Close of the month's last day to the close of the first day of the new month; side long USD, learned in sample the same way.

| Window | n | gross % long USD | gross R (side) | net R cost 0 | net R base | net R 2x | event t | month-sum t (months) | won | leg stops | total R | worst DD R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| In sample | 119 | +0.0137 | +0.001 | +0.000 | −0.005 | −0.011 | −0.18 | −0.18 (119) | 54.6 % | 29 | −0.62 | −4.54 |
| Out of sample | 143 | −0.0116 | −0.004 | −0.003 | −0.010 | −0.018 | −0.35 | −0.35 (143) | 49.6 % | 45 | −1.42 | −5.29 |

## After an up or down month for US equities (reported only)

Sign of the SPX500 CFD return over the month that ends at E; each group learns its own side in sample.

| Group | side (learned in sample) | in sample n | in sample net R | out of sample n | out of sample net R | out of sample t |
|---|---|---|---|---|---|---|
| SPX500 up in the month | long USD | 74 | +0.029 | 93 | +0.052 | +1.24 |
| SPX500 down in the month | short USD | 45 | +0.043 | 50 | +0.076 | +0.96 |

## Reading

- One observation is one month (the seven legs of one basket are one bet, not seven); with one event a month the month-sum t equals the event t.
- The reported splits (day 1 alone, the equity-return groups) were fixed in advance as reported only. A group with a large figure picked from these looks is not evidence; it would need its own pre-registration on data not yet read.
- The rebalancing story expects dollar selling at the turn after a month of US equity gains. The split learned long USD after an up month and short USD after a down month; out of sample +0.052R (n 93, t +1.24) and +0.076R (n 50, t +0.96): neither group reaches t 2, and the split was a reported look, not a test.
- The UTC close sits two or three hours after the 17:00 New York rollover; a test at the rollover or at a fix would need intraday candles since 2005 for all seven pairs.
- Today's broker swaps are charged on every past year; the NZD / JPY rate table is approximate. On a two-day hold financing is small next to the spread and commission.
- Paper only. Never call this an edge without its n and t.

To repeat: `node research/edge/fx-month-start/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… full <dir>`. Test: `tests/fx-month-start.test.mjs`.
