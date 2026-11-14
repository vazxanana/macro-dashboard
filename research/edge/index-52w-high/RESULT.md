# Result: the 52-week-high anchor on equity indices (14 Nov 2026)

**Verdict: FAIL, 0 of 3.** An index closing at or within 1 % of its prior 252-day closing high did NOT beat its own average over
the next 20 trading days: on the S&P 500 the signal trade made -0.084R a trade less than the same trade on every other day in
2016-now (n 90, month t -0.64) and -0.227R less before 2016 (n 86, t -1.88). Pooled over five other indices the same (-0.078R,
n 331, t -0.84; -0.151R before 2016). The opposite claim (a short more than 20 % below the high) fails too. Not an edge; nothing
live changed; nothing proposed.

Pre-registration: `PREREGISTRATION.md` (pushed alone first). OANDA mid daily candles from the council's cache (council-data
`research/daily/*.json`, commit `47bf8948`), weekend candles folded into Monday, 2003-03 to 2026-11-06. Long at the next open,
stop 2 x ATR20, out at the close of the 20th day, one at a time per index; net of a 0.04 % round trip and financing at the US 2Y
+ 2.5 % a year (FRED DGS2 from council-data `macro/cache.json`; **a fixed 4 % before 6 Jan 2006**, 386 trades of all streams).
D = signal net R a trade minus the same trade on every non-signal day (the index's own drift). Windows by entry day: decisive
2016-01-01 to 2026-11-06, replication 2004-03-16 (first entry with 252 days of history) to 2015-12-31.

## The three tests

| Test | Window | Signal n | Signal gross R | Signal net R | Every other day n | gross R | net R | D (net) | Month t | Holm p | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 spx500 near the high, long | 2016-now | 90 | +0.222 | +0.057 | 175 | +0.255 | +0.141 | **-0.084** | -0.64 | 1.00 | no |
| | 2004-2015 | 86 | -0.069 | -0.206 | 189 | +0.135 | +0.021 | **-0.227** | -1.88 | | |
| T2 five indices pooled, long | 2016-now | 331 | +0.135 | +0.001 | 924 | +0.168 | +0.064 | **-0.078** | -0.84 | 1.00 | no |
| | 2004-2015 | 325 | +0.005 | -0.123 | 1006 | +0.119 | +0.026 | **-0.151** | -1.86 | | |
| T3 six indices, > 20 % below the high, short | 2016-now | 77 | -0.450 | -0.466 | 1134 | -0.189 | -0.220 | **-0.245** | -2.04 | 1.00 | no |
| | 2004-2015 | 134 | -0.093 | -0.112 | 1118 | -0.127 | -0.167 | **+0.050** | +0.24 | | |

Pass bar (each test): D > 0 in both windows, decisive Holm p < 0.05 (one-sided, t on calendar-month sums; 131 decisive months,
142 replication months), decisive n >= 30. T1 and T2 fail all but n; T3 is positive only before 2016 and far from significance.

- **At 2x costs** (both parts doubled): T1 D -0.136R (t -1.05) / -0.250R (t -2.14); T2 -0.107R (t -1.18) / -0.184R (t -2.30);
  T3 -0.231R (t -1.95) / +0.070R (t 0.33). Nothing turns positive.
- **Placebo** (40 seeds, random same-count days in 2016-now against the real baseline): T1 median D -0.045R, median t -0.49, 29
  of 40 seeds reach the real t (-0.64), 7 of 40 have D > 0; T2 median D -0.012R, t -0.18, 40 of 40 reach the real t; T3 median
  D -0.030R, t -0.38, 40 of 40. The real signals do no better than random days, and for T2 / T3 worse than every placebo.

## By index (D, net R a trade, 2016-now | 2004-2015)

| Index | Near the high, long: n | D | n | D | Deep below, short: n | D | n | D |
|---|---|---|---|---|---|---|---|---|
| spx500 | 90 | -0.084 | 86 | -0.227 | 9 | -0.440 | 19 | +0.019 |
| nas100 | 83 | -0.023 | 75 | -0.138 | 21 | -0.018 | 19 | +0.078 |
| us30 | 78 | -0.080 | 74 | -0.173 | 4 | -0.293 | 17 | +0.062 |
| de40 | 62 | -0.239 | 70 | -0.053 | 15 | -0.232 | 28 | +0.009 |
| uk100 | 59 | -0.254 | 66 | -0.365 | 11 | -0.243 | 16 | +0.128 |
| jp225 | 49 | +0.245 | 40 | +0.045 | 17 | -0.422 | 35 | +0.043 |

Only the Nikkei is positive in both windows on the long side (n 49 and 40); one index of six, with no correction, is what chance
gives and is not a finding.

## Related
`research/edge/high52-rotation` (branch `high52-rotation`, FAIL) is the cross-sectional version of the same anchor: each month
it holds the 3 of 11 index CFDs closest to their 52-week high against an equal-weight book of all eleven (2016-26 excess +0.046 %
a month, Newey-West t 0.38; 2008-15 -0.138 %). This study is the per-index time-series version: does one index near its OWN high
beat its OWN drift over the next 20 days (each index against the same trade on its other days, not against other indices). Different
test, same answer; nothing was imported from it and its result was seen only after this study's pre-registration was pushed.

## What it means
Buying an index near its 52-week high and holding 20 days earns about the index's drift before costs (the S&P 500 signal trade
+0.222R gross against +0.255R on every other day in 2016-now) and less than the drift before 2016. The anchoring effect George and
Hwang found across stocks, and Li and Yu in aggregate index returns over months, does not show up as a tradeable 20-day long on
these six index CFDs with a 2 ATR stop. Nothing live changed, nothing touches gold, and no council member reads this study.

Caveats, said: the US 2Y is used for the financing of every index (the DAX, FTSE and Nikkei have their own rates; not offline);
a fixed 4 % before 2006; OANDA CFD candles before about 2008 are thinner on some indices (us30 and jp225 have fewer days early on).
None of these could turn a negative difference into a pass: the gross difference is already negative on the S&P 500.

To repeat: `node research/edge/index-52w-high/run.mjs fetch <dir>` (git show from `origin/council-data`, no network; kept out of
git), then `node research/edge/index-52w-high/run.mjs full <dir>`. Tests: `tests/index-52w-high.test.mjs`.
