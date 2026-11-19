# Gold in the three days before US CPI and payrolls, and the fade after the print: pre-registration

Written and pushed **before** any candle was read for this study and before any return was computed (14 Nov 2026). The event
list, the times, the rules, the costs, the statistics, the placebo and the pass bar are fixed here and do not change after the
results are seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes; ICT is not involved.
**A stand-alone event rule on spot gold.** It reads no position of the live gold book (Gold trend, Gold daily engulf, Mosha
cycle) and is not, and can never become by this study, a gate, exit, entry or size of that book. Item 44 of
`docs/owner-decisions.md` (no more gates / exits / entries / sizes tested on the book's 2006-17 window) is therefore not
touched: this study uses no 2006-17 data at all, because the repository's release dates start in 2018. A pass would be a
hypothesis for a forward paper shadow the owner decides on, never a live rule.

## Dedupe (read before writing this)

- `pre-release-drift` (branch, FAIL 0 of 10): gold and the dollar in the **24 hours** before CPI / payrolls, entry 24 h before,
  out 5 minutes before, 1 x ATR(14) H1 stop. Gold long CPI −0.404R net (n 86, t −1.82), NFP −0.609R (n 51, t −3.43); gold's raw
  drift +0.040 % (CPI) and +0.038 % (NFP), t under 0.5. **So the one-day window is done; this study does not repeat it.** Its
  last 24 hours overlap the end of this study's window: that much of these data has been looked at (said again in RESULT.md).
- `cpi-follow`, `nfp-follow` (branches, FAIL): follow / fade the first 15 minutes AFTER the print. They condition on the
  post-release move; nothing conditions on the move **into** the release.
- `pre-fomc-gold-usd`, `pre-fomc-drift`, `fomc-follow`, `bond-fomc-drift`: FOMC, not CPI / payrolls.
- `event-reaction` (main, FAIL): gold from the release minute vs the dollar index's first 5-minute read; nothing before it.
- `event-risk`, `news-filter`: releases as a filter on other systems' trades, not as a trade.
- The untested backlog (`untested-backlog` branch) lists index CFDs and bonds held through the release day: other markets.

**What is new here:** (T1, T2) a three-day pre-release hold of gold (de-risking or hedging into the print over several
sessions, not the last 24 hours); (T3) fading, after the print, the move gold made in those three days (does the
pre-positioning unwind once the number is out?).

## Release dates (from the repository only; none written by hand)

- **CPI 2018-2021**: `council/event-base.json` `rows` of type `CPI` dated before 2022 (built 10 Nov 2026 from the BLS schedule
  list `CPI_EARLY` in `research/edge/event-reaction/build.mjs`, kept only where the dollar index's release-minute spike check
  passed). The dates event-base lists under `dropped` (failed or missing spike check) are **not** events here; they are
  listed in RESULT.md and still count as releases for the exclusions below.
- **CPI and NFP 2022 on**: `council/events.mjs` `HISTORY` + `EVENTS`, types `CPI` and `NFP`, release time `t` (08:30 New
  York), up to the last release whose day is complete in the candles (CPI 10 Nov 2026, NFP 6 Nov 2026). This includes the
  shutdown-moved releases of late 2025 as that file has them, and the dates event-base lists as `missing` (its HistData
  candles had a hole; the dates themselves are in `HISTORY`).
- **Payrolls before 2022 are not reachable from the repository** (no list); NFP is tested 2022 on only.
- **Other releases, used only to exclude (never as events):** FOMC 2018-21 = `FOMC_EARLY` of
  `research/edge/histdata-clock/run.mjs` (14:00 New York), FOMC 2022 on = `HISTORY` + `EVENTS`; every CPI date of
  `CPI_EARLY`; NFP 2022 on; and for 2018-21, where payroll dates are not in the repository, the first and second Friday of each
  month at 08:30 New York (as `histdata-clock` treated them).

**Clean window rule:** an event is dropped (and listed) when any other release above falls after its entry and at or before
16:00 New York on its release day (so neither the three-day window nor the post-release window holds another release).

## Data

OANDA mid H1 gold (`xau`) through the site's keyless candle proxy (`/md/bars`, `fetch.mjs`, complete candles only, UTC
hours), cached outside git. Only 2017-12 to 2026-11 is read.

## Times (New York wall clock; all whole hours, so they sit on H1 boundaries)

For a release on New York date R:
- **E** = 17:00 on the 3rd weekday (Mon-Fri) before R. Entry price = close of the H1 candle that ends at E; if missing, the
  last candle ending in the 3 hours before E; none → event skipped for want of data.
- **X** = 08:00 on R (30 minutes before the 08:30 print): close of the H1 candle ending at X; missing → skipped.
- **F** = 09:00 on R (30 minutes after the print); **C** = 16:00 on R. Closes of the candles ending at F and C; missing → T3
  skips the event.

## The three tests

ATR20(t) = the simple mean of the true range of the 20 most recent complete H1 candles that end at or before t (true range
with the previous H1 close). **Stop = 2 x ATR20 x √(hold in hours)**, fixed at entry, never moved; every trade has one.
Managed on the H1 candles after the entry candle up to the exit candle: a candle that opens through the stop exits at its open;
one whose low (long) / high (short) reaches it exits at the stop; else the trade exits at the planned close.

- **T1 — pre-CPI long.** Buy gold at E before each CPI, exit at X. Hold H = (X − E) hours (about 63; longer over a weekend).
- **T2 — pre-payrolls long.** The same before each NFP.
- **T3 — fade the pre-release move after the print** (CPI and NFP pooled, one trade per event). Pre-move = close(X) / close(E)
  − 1. At F trade AGAINST it (pre-move up → sell, down → buy; exactly 0 → no trade), exit at C (7 hours, stop
  2 x ATR20(F) x √7).

Why long for T1 / T2, fixed now: the scheduled-announcement premium literature (Savor and Wilson 2013, Lucca and Moench 2015,
Ai and Bansal 2018) describes a price paid for bearing scheduled macro risk; for gold the matching reading is hedging demand
into the print. The 24-hour version of this (pre-release-drift) found no drift; this asks whether it shows over three days.

**Costs** (price units a round trip, two market orders): $0.30 spread + half a spread ($0.15) of slippage on each of the two
orders = **$0.60**. Gold longs also pay financing `nights(entry, exit) x FIN.xau.long x entry price` (`council/fills.mjs`,
imported: the demo broker's swap of 11 Nov 2026, Wednesday three, today's rate for every year). Shorts are charged and credited
nothing. Net R = (direction x (exit − entry) − 0.60 − financing) / |entry − stop|. Reported beside: gross and at 2x costs (both
the $0.60 and financing doubled).

## Statistics and the bar

- Per test: net R of each trade, summed by **calendar month of the release** (one CPI and one NFP a month, so T1 / T2 are
  almost one trade a month; T3 can hold two). t = mean of the month sums / (sd / √months); one-sided p from Student's t
  (H1: mean > 0). **Holm over the three tests.**
- **Halves:** each test's kept events split in chronological order into a first and a second half (by count). For CPI the
  2018-21 vs 2022-26 split is reported too (descriptive). There is no untouched out-of-sample: the dates start in 2018 (CPI)
  and 2022 (NFP), and the last 24 hours of T1 / T2's window were read by `pre-release-drift`. **The sample is small** (about
  90 CPI, 58 NFP before drops).
- **Placebo:** 40 draws, seed fixed (mulberry32, seed 20261114 + draw). In each draw every kept event is moved to a random
  weekday of the **same calendar month** that is not a release day of the lists above and whose own window (its E to its C)
  holds no release of those lists; the same times, rules and costs relative to that day (T3 uses that day's own pre-move). An
  event with no such day in its month is left out of that draw. Statistic: mean net R a trade.
- **PASS** for a test only if all hold: (a) month-sum t ≥ 2 and Holm p < 0.05, mean net R > 0; (b) mean net R > 0 in both
  chronological halves; (c) mean net R > 0 at 2x costs; (d) the test's mean net R beats at least 38 of its 40 placebo means.
  The study's verdict is PASS if any test passes, else FAIL. A pass is a hypothesis for a paper shadow, never an edge or a
  live rule.

## Reported, never judged

Gross R; the raw three-day drift (mean %, t over events) for CPI and NFP; stop hits; by year; T3 split by CPI / NFP and by the
sign of the pre-move; the correlation between the pre-move and the 09:00-16:00 move (descriptive).

## Deliverables

`fetch.mjs` (candles, cache out of git), `run.mjs`, `RESULT.md` (the bold verdict line with its reason), `result.json`,
`tests/gold-pre-cpi.test.mjs` (rule on hand-made candles, no look-ahead, report against result.json), `out/` rebuilt.
