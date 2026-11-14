# Tokyo fix every day: is the 09:55 fix-minute effect special to gotobi days? (pre-registration)

Written and pushed before any candle of this study is fetched or any figure of it computed. Paper research only: no live
rule, size, filter, stop, config, council member or mirror setting changes, whatever the result. **No live proposal follows
from this study, whatever the reading.**

## Why

`research/edge/gotobi` (#878, branch `gotobi`) found that selling USD/JPY at 00:55 UTC (the 09:55 Tokyo fix) and buying back
at 06:00 UTC on gotobi days made +0.148R a trade net on 2016-now (n 771, month t 2.74; its T2). `research/edge/gotobi-timing`
(#908) showed on OANDA M1 that the result sits almost entirely on the 00:55 minute: one minute late keeps about a third of it.

The Tokyo fix happens every Tokyo business day. The gotobi explanation is that importers' dollar demand into the fix is
concentrated on settlement days. This study asks the mechanism question: **is the fix-minute effect special to gotobi days,
or is it there on every Tokyo business day?** It is not a search for a new trade.

**Known before this study, said plainly**: #878's result.json already reports the same fade on every non-gotobi Tokyo business
day of 2016-now on M5 (`allDays`: n 1,870, −0.063R a trade net, month t −2.37). So T1 below is not blind; it is re-measured on M1
with the frozen code so that T1, T2 and T3 rest on the same candles. No M1 figure of a non-gotobi day, and no fix-minute move of
any day, has been computed before this file was pushed.

## Data

- OANDA mid USD/JPY M1 candles through the site's candle proxy (`/md/bars`, `node --use-env-proxy`), 00:00-06:15 UTC of every
  Tokyo business day from 2010-01-01 to 2026-11-11 (the last day of #878 and #908). Candle files stay out of git.
- The stop distance D comes from #878's OANDA M5 file (`usdjpy-5m.json.gz`, from 2009-11-01) through the frozen code, exactly
  as #908 did.
- Japan has no daylight saving: 00:55 UTC is 09:55 Tokyo on every day.

## Frozen code

`frozen.mjs` is a byte copy of `origin/gotobi-timing:research/edge/gotobi-timing/frozen.mjs` (sha256
`645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32`, pinned in the test). From it: the Tokyo calendar
(`isTokyoBusinessDay`), the gotobi day list (`gotobiSet`: the 5th, 10th, 15th, 20th, 25th and the month's last Tokyo business
day, each rolled back to the previous Tokyo business day), the stop distance (`stopDist`: 1.5 x the median absolute move of the
00:55-06:00 window over the 20 Tokyo business days before, M5, at least 15 of them), the costs (`costPx`: 0.3 pip spread, 0.5 pip
slippage a side, USD 22.5 per million a side), `summary`, `monthT`, `normCdf`, `holm`, `mulberry32`. The M1 trade is #908's
`tradeM1` (copied into `run.mjs`, unchanged): entry at the open of the 00:55 M1 candle, stop D above it, exit at the open of the
06:00 M1 candle (else the close of the last M1 candle starting up to 15 minutes before), stop checked candle by candle (a gap
through the stop fills at the open).

**Gate** (before any test is read): on gotobi days of 2016-now the M1 trade must give n within 8 of 771 and net R a trade within
0.010R of +0.1481 (#908's gate). If the gate fails, the study reports it and no reading is made.

## Windows

- Decisive: 2016-01-01 to 2026-11-11.
- Replication: 2010-01-01 to 2015-12-31 (as far as the M1 history on the proxy reaches; the first day with candles is stated).
- The reading is made on the decisive window only. The replication window is reported beside it, and the report says whether
  each test has the same sign there.

## Tests

- **T1 (every other day).** The frozen fade (sell 00:55, buy back 06:00 UTC, frozen D, frozen costs) on every Tokyo business day
  that is NOT a gotobi day. Figures: n, gross R, cost R, net R a trade, total, month t on calendar-month sums of net R (frozen
  `monthT`). One-sided p = 1 − Φ(month t) (the claim tested is "positive").
- **T2 (the fix spike).** For every Tokyo business day with both candles: the fix-minute move = open of the 00:55 M1 candle
  minus open of the 00:54 M1 candle, in pips (0.01), i.e. the move over the minute that ends at 09:55:00 Tokyo. Mean over gotobi
  days against mean over non-gotobi days; Welch t on the difference of the per-day values; sign pre-registered as gotobi >
  non-gotobi; one-sided p = 1 − Φ(Welch t). Also reported, descriptive only and not tested: the same move divided by the day's D
  (in R), and the minute after the fix (open 00:56 − open 00:55).
- **T3 (gotobi against the rest).** T1's trades against the same trade on gotobi days (the #908 M1 base), compared month by
  month: each calendar month's net R a trade (the month's net R sum divided by its number of trades, so that the different
  number of days a month does not decide the comparison), Welch t on those monthly values, gotobi minus non-gotobi. Reported, not
  in the reading.

**Holm** over T1 and T2 (two one-sided p values, alpha 0.05); the adjusted p values are reported.

## Placebo (40 seeds, reported, not in the reading)

Each seed (mulberry32, seeds 1-40) draws, independently for every non-gotobi Tokyo business day of the decisive window, one
5-minute window [m, m + 5) from those starting 00:00, 00:05, ..., 04:55 UTC, excluding the windows that end at 00:50, 00:55 and
01:00 (the fix's neighbourhood). On that day:
- (a) the one-minute move into the window's end mark, open(m + 5) − open(m + 4), in pips, the analogue of T2's fix minute;
- (b) the frozen fade entered at the open of the window's end mark instead of 00:55, same D, same 06:00 exit, same costs.
Per seed: the mean of (a) and the net R a trade of (b). Reported: the 95th percentile of the 40 seed means (the 38th of 40,
sorted) for each, and where the non-gotobi fix minute (T2's non-gotobi mean) and T1 sit against them. This shows whether the fix
minute on ordinary days stands out from ordinary minutes of the same morning.

## Pre-registered reading (decisive window)

- **GOTOBI-SPECIFIC** if T1 is ≤ 0 net, or its month t < 1, AND T2 shows gotobi > non-gotobi with Welch t ≥ 2 and a
  Holm-adjusted p ≤ 0.05.
- **EVERY-DAY** if T1 is positive with month t ≥ 2 and a Holm-adjusted p ≤ 0.05.
- **UNCLEAR** otherwise.

The RESULT.md carries one line "Verdict: <reading word>" with these words. Whatever the reading, there is no live proposal: the
gotobi fade itself (#878) is an owner decision outside this study, and this study only describes where its effect comes from.

## Files

`PREREGISTRATION.md` (this file, pushed alone first), then `frozen.mjs`, `run.mjs`, `RESULT.md`, `result.json` and
`tests/tokyo-fix-daily.test.mjs` (offline: the frozen file's sha256, the T2 move and the placebo on hand-made candles, Welch t,
the reading rule, the report against result.json).

To repeat: `node --use-env-proxy research/edge/tokyo-fix-daily/run.mjs fetch <m1Dir>`, then
`node research/edge/tokyo-fix-daily/run.mjs <m1Dir> <usdjpy-5m.json.gz>`.
