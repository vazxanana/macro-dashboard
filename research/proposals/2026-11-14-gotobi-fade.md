# Proposal: follow the gotobi fade on USD/JPY as a paper shadow (14 Nov 2026)

For the owner. Nothing here changes a live rule, size, filter, stop or the mirror; it only asks whether to watch one rule on
paper. Absolute rules 1-3 hold: every trade has a stop, paper and demo only, the owner decides.

## What passed

`research/edge/gotobi/` (pre-registered before any trade was computed; RESULT.md, result.json). On Japanese settlement days
(5th, 10th, 15th, 20th, 25th and the last Tokyo business day, rolled back to the previous Tokyo business day), four tests:
long USD/JPY or EUR/JPY from 07:00 Tokyo into the 09:55 fix, and the fade, a sell at 09:55 bought back at 15:00 Tokyo. Stop
1.5 x the 20-day median of the same window's move; net of 0.3 pip spread, USD 22.5 per million a side and 0.5 pip slippage a
side.

**One of four passed every condition: T2, the USD/JPY fade.**

| Window | n | Net R a trade | Gross | Month t |
|---|---|---|---|---|
| 2016-01 to 2026-11 (decisive) | 771 | +0.148 | +0.261 | 2.74 |
| 2010-15 (replication) | 425 | +0.131 | +0.243 | 2.45 |

Holm-adjusted p 0.012 over the four tests; above all 40 placebo seeds of ordinary days (their 95th percentile −0.016R; the
same window on every ordinary day −0.063R, so the gotobi days are about 0.2R a trade better than ordinary ones).

## What to keep in mind

- **The margin over costs is thin**: costs are 0.11R a trade (about 2 pips against a median stop of 19.5 pips). At twice the
  costs the decisive-window figure is +0.035R. The real demo's spread at 00:55 UTC on USD/JPY has not been measured.
- Positive in 8 of 11 years of 2016-now (2018, 2023 and so far 2026 negative) and 5 of 6 of 2010-15.
- About 72 trades a year, held five hours; at +0.15R a trade that is about +11R a year before any sizing decision.
- The three other tests did not pass (USD/JPY long t 0.93; EUR/JPY long negative in 2010-15; EUR/JPY fade t 1.84). The
  long leg into the fix, the half most often described, is the weaker one here.
- It is a published effect; it may be weaker after publication and in years when importers hedge differently.

## The decision

1. **Paper shadow (recommended)**: record the T2 rule forward as a shadow stream (never alerted, not mirrored), judge it on
   its own forward record with n and t, together with a measurement of the demo's USD/JPY spread at 00:55 and 06:00 UTC.
2. Do nothing: keep the result in the Edge lab only.

No code for either option was written.
