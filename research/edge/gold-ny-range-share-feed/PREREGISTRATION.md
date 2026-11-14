# Pre-registration: gold-ny-range-share on a second gold feed (HistData M1), a feed-robustness check (14 Nov 2026)

Pushed alone, before any HistData or OANDA candle of this check was loaded and before any trade was computed. Paper
research only: nothing live changes, no proposal is written whatever the result, and none of the gold book's 2006-17
positions is read (docs/owner-decisions.md item 44).

## Question

`research/edge/gold-ny-range-share` (branch `gold-ny-range-share`, commit bb6ecd15b, PR #1209) FAILED on its pre-registered bar,
but its primary test T1 (New York made >= 60 % of the 00-21 UTC range: follow New York's move for 5 days) beat the same-side
every-day trade out of sample on OANDA mid H1: excess +0.138R a trade, month t +2.63, n 198 (2017-26), against -0.012R,
t -0.25 in sample (2007-16). It is the strongest near miss of the gold studies of 13-14 Nov.

The one question here: **is that out-of-sample result a property of gold, or of the OANDA feed?** The same rule, unchanged,
is run on an independent gold feed. This is NOT a re-fit: no threshold, segment, hold, stop, cost or statistic changes.

## Rule (unchanged)

The study's own `run.mjs` is copied byte for byte into this folder as `rule.mjs` (git blob 6563a429d4bc of
`research/edge/gold-ny-range-share/run.mjs` on that branch, sha256 2bb6e4c3dec8...; a test pins the sha256). Every function
used comes from it: `daysOf`, `signals`, `atr`, `dayTrades`, `excessOf`, `exSummary`, `baseSummary`, `placebo`, `control`,
`holm`, `monthT`, and `P` (thresholds 0.60 / 0.10, segments 00-12 / 13-20 UTC, 2 x ATR(14) daily stop, holds 5 / 2 days,
$0.60 a round trip + `nights x FIN.xau.long x entry` on buys, 2x cost run, 40 placebo + 40 control seeds). T1 (primary),
T2 and T3 as defined there. Holm over the same three tests.

## Data (named before any result)

- **Second feed**: HistData XAU/USD M1, council-data `research/candles/xau-histdata/` (`XAUUSD_M1_2018.csv.gz` ... 
  `XAUUSD_M1_202610.csv.gz`, read with `git show origin/council-data:...`, no network), January 2018 to 30 October 2026.
  Labels converted to UTC ONLY through `council/histdata.mjs` `histStampUtc` (CLAUDE.md "Research candle clock"); a row whose
  converted minute repeats is dropped (the files' known October artefact). M1 aggregated to H1 by UTC hour (open of the
  first minute, high max, low min, close of the last). Kept in memory / a scratch directory, never in git.
- **Reference feed**: OANDA mid XAU/USD H1 through the candle proxy (`/md/bars`), 2006 to 30 Oct 2026, as the study fetched it.
- **The span the second feed allows**: HistData gold starts January 2018. So **2007-16 (the study's in sample) and 2017
  cannot be tested on it**; the in-sample sign check cannot be repeated. The window for both feeds in this check is
  **2018-01-01 to 2026-10-31** (halves 2018-21 / 2022-26). Months of 2018 before the 30-day warm-up count as zero months
  on both feeds alike.
- Known hole: the HistData files are thin from 20 Feb to 30 Jul 2023 (histdata-clock RESULT.md). Days with under 18 H1
  candles are not eligible (the rule's own `minBars`).

## Data-hole guard (fixed now, applied to both feeds alike)

The rule counts holds in eligible days, so a hole would stretch a "5-day" hold over months. On both feeds:
- a trade (signal or baseline) whose exit day is more than `hold + 7` calendar days after its signal day is dropped;
- a day whose ATR(14) window (days i-13..i) spans more than 30 calendar days takes no trade.
These are applied to the list of day trades `dayTrades` returns, before excess, placebo and control (the study's `study()`
is re-assembled in `run.mjs` from the copied functions with that one filter; nothing inside a function changes).

## Gates (before any comparison is read)

- **Parity**: the re-assembled pipeline on the OANDA candles over the study's own windows (2007-16 / 2017-26) must give
  the study's committed T1 figures: IS n 258, excess -0.012R; OOS n 198, excess +0.138R, month t +2.63 (to 0.005R / 0.05 t,
  the guard dropping at most 2 trades). If not, the check stops and reports why.
- HistData day count: at least 2,000 eligible days in 2018-26, else the check stops.

## Reported

For each feed, window 2018-01 to 2026-10, each test: n, gross / net / excess R a trade, excess month t, net month t,
Holm p (over the three tests on that feed), 2x-cost excess and net, placebo and control beaten (of 40), halves 2018-21 and
2022-26. Also the OANDA run over 2017-26 (the study's own OOS) for reference.

**Signal-day overlap (descriptive, no test)**: on days eligible on both feeds in 2018-26, the T1 signal days of each feed,
both, either, Jaccard, the share of shared signal days with the same side, and the correlation of the NY share; the same
for T2's days.

## Verdict (feed check; the study's own FAIL stands whatever this says)

**HOLDS** when T1 on HistData 2018-26 meets every out-of-sample check of the study: excess month t >= 2 with Holm p < 0.05;
net R a trade > 0 with net month t >= 2; excess and net > 0 at 2x costs; real t above at least 38 of 40 placebo and 38 of 40
control draws; n >= 100. **PARTLY** when the excess is positive with month t >= 1 but a check above fails. **DOES NOT HOLD**
otherwise. The in-sample check (2007-16) is not available on this feed and is reported as such. Even HOLDS would only say the
2017-26 result is not an OANDA artefact; it would not make the rule an edge (the in-sample failure stands) and no rule changes.
