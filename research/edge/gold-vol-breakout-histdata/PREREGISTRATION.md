# Gold volatility breakout, feed check: the frozen T1 on HistData XAU/USD M1

Pre-registered 14 Nov 2026, committed and pushed alone before `run.mjs` exists and before any HistData trade of this rule was
computed. Paper research only. A stand-alone intraday rule, never a gate, exit, entry or size of the live gold book (owner
decision 44 concerns that book; none of its records are read). Nothing live changes and no proposal is written, whatever the
result.

## Why

`gold-vol-breakout` (branch `gold-vol-breakout`) T1: at the 00:00 UTC open O, a buy stop at O + 0.5 x the previous
weekend-folded UTC day's range and a sell stop at O − 0.5 x that range; the first to fill wins, the stop goes back at O, out at
the 20:55 candle's close (21:00 UTC). On OANDA mid M5 it made +0.009R a trade net in 2016-20 and +0.072R in 2021-26 (month t
1.86); the replication on untouched 2007-15 (branch `gold-vol-breakout-replicate`) made +0.111R net, month t 3.19, and passed.
Every figure comes from ONE feed, OANDA mid M5, and the stop entries fill on that feed's highs and lows. A feed artefact (a
spike print, the 00:00 open candle, how the candles are stamped) would show in all of them alike. This check runs the rule
unchanged on a feed that shares nothing with OANDA: HistData XAU/USD M1 (bid prices) in council-data
`research/candles/xau-histdata/XAUUSD_M1_<year or yyyymm>.csv.gz`, read with `git show origin/council-data:<path>` and
decompressed locally, no network.

## The rule: frozen, not re-implemented

`original.mjs` is a byte-for-byte copy of `research/edge/gold-vol-breakout-replicate/original.mjs`, itself a verbatim copy of
the original study's `run.mjs`; sha256 `afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f`, pinned in the test.
`run.mjs` imports from it, unchanged: `buildDays` (days and the previous folded D1 built with `council/fills.mjs`
`foldWeekend`), `daySkip` (no previous day, a flat previous day, no candle in the first hour, fewer than 200 M5 candles in
00:00-20:55), `vbTrade` (T1: k 0.5, both sides; fills at the level or at a gapped open; both levels in one candle: the nearer to
its open; worst case inside the fill candle; financing `FIN.xau.long` on buys held over a rollover, none here), `placeboTrade`,
`summary`, `monthT` and the statistics. Cost $0.60 a round trip per ounce, as the original; 2x reported.

## The only new parts

1. **The candle loader.** HistData M1 rows `YYYYMMDD HHMMSS;open;high;low;close;volume`. Each label is converted to UTC with
   `council/histdata.mjs` `histStampUtc` and nothing else; rows whose converted time repeats are dropped (the export artefact
   named in the converter's header). M1 candles are aggregated into M5 candles on UTC 5-minute boundaries
   (`floor(t / 300) x 300`: open of the first minute present, high max, low min, close of the last minute present), rows
   `[t, o, h, l, c]`, the shape `buildDays` reads. A missing minute is not filled. The candle cache is written outside git.
2. **One data guard, applied to BOTH feeds alike** (the rule itself never sees a hole bigger than a weekend on OANDA, so this
   changes nothing there unless OANDA also has a hole): a day whose previous folded D1 lies more than 4 calendar days earlier
   is skipped (`prevgap`): its "previous day's range" would come from before a data hole. Exits never cross a hole: every
   trade is closed by 21:00 UTC the same day, and a day with fewer than 200 M5 candles is already skipped (`thin`).

## Window

W = 2018-01-01 to 2026-10-31, the last full month in the HistData files (the files run to October 2026). The OANDA reference
is the cache this session already holds (OANDA mid M5 XAU/USD 2006-11 → 2026-11-13, out of git), run with the same code, the
same guard and cut to the same W. Days are matched by UTC date.

## The pre-registered question and the bar

"The effect is not an OANDA artifact" when ALL of:

1. **H1** HistData T1 over W: net R a trade > 0.
2. **H2** HistData T1 over W: gross month t >= 2 (calendar-month sums of gross R, the frozen `monthT(…, 'R')`).
3. **H3** on the common days (both feeds trade that day), the two feeds take the same side on at least 70 %.

Verdict "NOT AN OANDA ARTIFACT" when H1-H3 all hold, otherwise "FEED-DEPENDENT", naming what failed. One frozen rule on one
more feed: no Holm (one test) and the verdict does not rest on a placebo. This is a feed check, not a new search: the common
brief's in-sample-to-2016 / out-of-sample-2017 windows do not apply; the windows here are fixed above.

## Reported, not judged

- A table per feed over W: n, win %, net R a trade, gross R, cost R, net at 2x cost, total net R, month t (net), gross month t,
  month t at 2x cost, stops / time exits, max drawdown, median stop $, buys / sells.
- The same split into 2018-20 and 2021 → 2026-10 (the original's in-sample years overlap 2018-20) and by year, both feeds.
- Agreement: days traded by both, by HistData only, by OANDA only; same-side share; Pearson correlation of daily net R and of
  daily gross R on the common days; share of common days with the same sign of net R; how many common days stopped on one feed
  and not the other; median and 95th percentile of |fill time difference| in minutes and of |entry difference| in $.
- The common-days-only table for both feeds (n, net, gross, month t).
- Data coverage: weekdays in W with no HistData candle in 00:00-20:55 UTC; days skipped and why on each feed; total missing M1
  minutes in 00:00-20:55 UTC on weekdays HistData has; the number of days with an intraday gap over 30 minutes; the longest
  hole in the HistData file over W (in days).
- The original placebo (40 seeds, random market entry 01:00-18:00 UTC, fair-coin side, stop 0.5 x the previous range, same
  costs) on HistData over W, reported beside the real figure.
- The OANDA figure over W, said plainly beside the HistData one: if HistData fails H2 and OANDA over the same W also has gross
  month t < 2, the report says the shortfall is the window, not the feed.

## What this does not do

A pass does not make the rule an edge to trade or a council rule; a fail does not undo the OANDA studies. Nothing is changed
outside `research/edge/gold-vol-breakout-histdata/`, `tests/gold-vol-breakout-histdata.test.mjs` and the rebuilt `out/`.
