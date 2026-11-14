# Pre-registration: does the gold Friday-session long replicate? (14 Nov 2026)

Written, committed and pushed alone before `run.mjs` exists and before any number of this study was computed. Paper
research: nothing here is read by the council, the mirror or the page, and no live rule changes whatever the verdict. Not an
ICT study. **Item 44**: a stand-alone calendar rule, not a gate, exit, entry or size of the gold book; says nothing about it.

## What is being replicated
Branch `gold-weekday` (PR #1078, `research/edge/gold-weekday/`): its T2, chosen as the best weekday on 2007-16 only, is a LONG
on every Friday 17:00-New-York session (in at the session's first H1 open, out at its last H1 close, stop 1 x ATR(20) of the
20 days before, checked on H1, a gap fills at the open; $0.60 a round trip; `council/fills.mjs` `FIN.xau.long` financing per
22:00 UTC rollover on longs). Out of sample 2017-01 to 2026-10: +0.060R net a trade, n 500, month t 2.10, Holm 0.036, above 38
of 40 placebo means. That study called it "a lead, not an edge". This study checks it on three cuts.

**The rule is not touched.** `original.mjs` in this folder is a verbatim copy of that branch's `run.mjs` (its sha256 is pinned
in the test); every trading function (`enrich`, `dayIndex`, `simulate`, `runWeekday`, `inWin`, `monthT`, `summary`, `holm`,
`placebo`, `phi`, Friday = weekday 5, side +1) is imported from it unchanged. `run.mjs` only loads candles, sorts trades into
groups and writes the report. Days are `research/edge/gold-drd-long/run.mjs` `days()` 17:00 New York days (imported by
`original.mjs`).

## Gate G0 (before any replication figure is read)
On the OANDA mid H1 XAU_USD cache (`fetch.mjs` of gold-weekday, the same request; a copy made by another session of 14 Nov,
2006-03-19 to 2026-11-13, out of git), the frozen rule must reproduce the original's T2 out of sample: n within 500 +/- 3 and
mean net R within 0.060 +/- 0.003. If it does not, the study stops and reports that, with no replication figure.

## R1: is it only payroll Fridays?
- A Friday session is a **payroll Friday** when its closing date (its 17:00 New York day) is a US Employment Situation release
  date. Dates from 2022 on: `council/events.mjs` `HISTORY` + `EVENTS` entries of type NFP (their local date; read only). Dates
  before 2022: the BLS rule as written in branch `gold-pre-nfp-replicate` `dates.mjs` (copied into `run.mjs`, not imported):
  the reference week is the Sunday-Saturday week holding the 12th, the release is the third Friday after it; a Friday on or
  before 3 January moves one week later; a federal-holiday Friday (observed New Year, 4 July, Christmas) moves to the Thursday
  before; the October 2013 shutdown exceptions (September report 22 Oct 2013, October report 8 Nov 2013). Derived, not checked
  against a BLS page (bls.gov is not reachable from the build sandbox); a release that fell on a Thursday or another weekday
  makes no Friday a payroll Friday.
- Split the original's out-of-sample Friday trades (2017-01-01 to 2026-10-31 by entry) into payroll Fridays and other Fridays;
  report n, gross, net, net at 2x costs, month t (every month counts, 0 when no trade of the group closed), for both, and the
  in-sample 2007-16 split beside it.
- **R1 survives only if the other (non-payroll) Fridays alone have out-of-sample mean net R > 0 and month t >= 1.5.**
- Reported, deciding nothing: the same split by `ict/tracker.mjs`'s fallback proxy (a Friday dated the 1st to the 7th).

## R2: a second feed (HistData XAU/USD M1, bid)
- council-data `research/candles/xau-histdata/XAUUSD_M1_*.csv.gz` (2018 to October 2026), read with
  `git show origin/council-data:<path>` (no network), cache out of git (scratchpad). Each label is converted to UTC with
  `council/histdata.mjs` `histStampUtc` and nothing else; a repeated converted minute is dropped. M1 candles are aggregated into
  UTC H1 candles `[t, o, h, l, c]` (first open, max high, min low, last close of the minutes present; a missing minute is not
  filled; an hour with no minute is no candle). Then the frozen rule, Friday long, $0.60 a round trip (HistData is bid; the
  same dollar cost), financing as the original.
- Window: entries 2018-01-01 to 2026-10-31 (month t over its 106 months). The OANDA figure over the same window is reported
  beside it, deciding nothing.
- **R2 passes if: mean net R > 0, month t of net R >= 2, Holm-adjusted p < 0.05 (Holm over R2 and R3), and mean net R at 2x
  costs > 0.**

## R3: gold in euros (OANDA mid M5 XAU_EUR)
- The cache `xaueur-5m.json.gz` made by another session of 14 Nov through the site's keyless candle proxy (2006-03 to
  2026-11-13, out of git). M5 candles aggregated into UTC H1 as above; then the frozen rule, Friday long.
- Cost: 0.016 % of the entry price a round trip (spread and slippage together; no measured XAU/EUR spread exists in the
  repository, so this is an assumption, stated); financing on longs at `FIN.xau.long` per rollover x entry price (today's
  USD-gold rate, the same assumption; almost every session holds no rollover).
- Report in sample 2007-01-01 to 2016-12-31 and out of sample 2017-01-01 to 2026-10-31.
- **R3 passes if the out-of-sample mean net R > 0, month t >= 2 and Holm-adjusted p < 0.05.** In sample, 2x costs reported.

## Statistics
- t on calendar-month sums of net R by exit month (the original's `monthT`); one-sided p = 1 - Phi(t); Holm over R2 and R3
  only (R1 is a split of the original trades, not a new test).
- Placebo, 40 seeds, reported for R1's other Fridays, R2 and R3, deciding nothing: the original's `placebo` (each real trade
  moved to a random trading day of the same year, any weekday, same side, rule and costs; the R1 and R3 cost settings as above).

## Verdict
**REPLICATES** only if R1 survives AND R2 passes AND R3 passes. Otherwise **FAIL**, naming the part or parts that broke.
Said plainly in the report whatever the verdict: R2 and R3 re-read the same calendar years as the original (2017-26) on other
prices of the same metal; they are not independent evidence. **R4 is the real test.**

## R4: the forward line (written now, nothing computed)
The next 52 Friday sessions from the session closing Friday 20 November 2026 (holiday-shortened or missing sessions are skipped,
not replaced), traded by the frozen rule on OANDA mid H1 XAU_USD with $0.60 a round trip and `FIN.xau.long`: **the lead holds
only if their mean net R a trade is > 0.** Read once, after the 52nd, by whoever runs it; no figure of R4 exists in this study.

## Deliverables
`original.mjs`, `run.mjs`, `RESULT.md`, `result.json` in this folder; `tests/gold-friday-replicate.test.mjs` (offline,
hand-made candles); `out/` rebuilt. Nothing else is touched.
