# Pre-registration: gold-interim-bottom (20 Nov 2026)

Paper research only. A test of one claim in the owner's own macro material: the **"interim bottom" framework** quoted in the
veteran batch's gold brief (`research/macro-veteran/references/gold-market-brief-2026-11-07.md`, section "WGC 'interim bottom'
framework: test it, do not adopt it"). A stand-alone monthly rule on spot gold, not a gate, exit, entry or size of the live gold
book (owner decision 44: none of that book's records are read). Nothing live changes and no proposal is written by this study.

Written and pushed alone, before any code for it exists and before any month-end of it has been classified or any trade computed.

## The claim (in my own words, as the brief reports it)

Inside a gold bear regime (50-day average below the 200-day for at least 20 consecutive trading days), month-ends where at least
two of three conditions hold, (1) gold unusually far below its 200-day average, (2) a sharp 52-week rise of the dollar index,
(3) speculative futures positioning unusually low against open interest, each "the most extreme 30 %" of bear months, were
followed by a positive three-month gold return in 9 of 10 episodes (median +4.2 %), against 63 % / +3.2 % for spaced bear
month-ends. The brief itself asks for a point-in-time public-proxy test against the bear-regime baseline, with thresholds from
prior data only. Nothing in `research/edge/` has tested it (nearest: `gold-200d-stretch` fades a 2-sd z from the 200-day on any
day, both sides, no regime and no dollar; `gold-13w-low` a weekly closing low; `gold-dollar-lead` a one-week dollar move).

## Data

- Gold: council-data `research/daily/xau.json` (OANDA mid D1 from March 2006), read with `git show` (no network), folded to trading
  days with `council/fills.mjs` `foldWeekend`.
- Dollar index: the council's ICE DXY build from the five pairs' daily closes (`eurusd`, `gbpusd`, `usdjpy`, `usdcad`, `usdchf`,
  each folded the same way), imported from `research/edge/gold-dxy-month-shock/run.mjs` `dxyIndex` (not edited).
- **Condition (3) is left out**: council-data COT history starts in 2019 (`macro/cot-raw.json`) and the CFTC host is refused here.
  So this is a **public-proxy reconstruction with two of the three conditions**, not a faithful replication of the WGC table
  (which used Bloomberg data and its own definitions).

## Definitions (fixed now; day i = a folded gold trading day, closes known at its end)

- SMA50(i), SMA200(i) = simple means of the last 50 / 200 closes up to and including day i.
- Month-end m = the last gold trading day of each calendar month.
- **Bear regime at m**: SMA50 < SMA200 on each of the 20 trading days ending at m (all with a full SMA200).
- **Stretch** x(m) = close(m) / SMA200(m) − 1.
- **Dollar 52-week change** D(m) = DXY on the latest DXY day ≤ m divided by DXY on the latest DXY day ≤ m − 365 calendar days,
  minus 1 (no value if either is missing or more than 5 calendar days stale).
- **Point-in-time thresholds**: over the bear month-ends strictly BEFORE m (from the first one on file), C1 = x(m) at or below the
  30th percentile of their x (linear interpolation); C2 = D(m) at or above the 70th percentile of their D. Fewer than 12 earlier
  bear month-ends → no signal at m (counted and reported).
- **Signal S2** (the primary): bear regime AND C1 AND C2. Reported, not tested: S1 = bear AND (C1 OR C2); C1 alone; C2 alone.

## The trade (fixed now)

- Enter long at the open of the first gold trading day after m.
- Stop = entry − 3 × ATR20(m) (ATR20 = simple mean of the last 20 true ranges up to m). 1R = 3 × ATR20(m). A day whose low reaches
  the stop exits there; a day that opens below it exits at its open.
- Otherwise out at the close of the 63rd trading day held (entry day = day 1), about three months.
- **One position at a time** for the signal streams (a signal while a position is open is skipped; this is also the brief's
  three-month spacing).
- **Cost**: 0.0001 × entry a round trip, plus overnight financing `nights(entry, exit) × FIN.xau.long × entry`
  (`council/fills.mjs`, today's demo rate for every year). Net R = (exit − entry − cost) / 1R.
- **Baseline B**: the same trade from EVERY bear month-end (overlap allowed, each its own trade), the brief's comparison.
  Reported: the same trade from every month-end (no regime).

## Window

2007-01-01 (first full SMA200) to the last month-end whose 63-day hold completes on file. The claim's author used data since 2005,
so no window here is untouched by the claim; this is a replication on another price source with point-in-time thresholds, net of
costs. Halves: 2007-2016 and 2017 → end.

## Tests (Holm over T1 and T2)

- **T1**: S2 trades, net R a trade > 0 and t ≥ 2 (each trade starts in its own calendar month, so the calendar-month-sum t equals
  the trade t), and mean net R > 0 in each half that has at least 3 trades.
- **T2 (incremental information, the brief's question)**: S2 trades minus baseline B trades, net R a trade, Welch t ≥ 2.
- PASS = T1 and T2 both pass with Holm-adjusted p < 0.05 (one-sided normal p). Otherwise FAIL.

Reported, not tested: hit rate of the three-month price return (exit close / entry − 1, ignoring the stop) with an exact binomial
95 % interval, its median, for S2, S1, C1, C2, B and all month-ends; the number of separate bear episodes the signals fall in.

## Expected size and limits

S2 will be rare (the brief's own table has 5-10 episodes over about 20 years); with n under 10 the t-bar is close to unreachable
and a FAIL may only mean "too few". That is the honest outcome of the claim's sample size, said in advance. COT is missing; DXY is
built from five pairs, not the ICE future; OANDA spot, not the WGC's series.

## What would change nothing

A pass is a replication on the author's own years, at most a proposal for a forward record; never a live rule without the owner.
