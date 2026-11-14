# Gotobi feed check: the frozen T2 rule on an independent price feed (HistData USD/JPY M1)

Pre-registered 14 Nov 2026, committed and pushed alone before `run.mjs` exists and before any HistData trade of this rule was
computed. Paper research only: no live rule, size, filter, stop, config or council member changes, whatever the result.

## Why

The gotobi study (branch `gotobi`, PR #878) found that selling USD/JPY at the 09:55 Tokyo fix (00:55 UTC) on Japanese gotobi
days and buying back at 15:00 Tokyo (06:00 UTC), its T2, made +0.148R a trade net, month t 2.74, on 2016-now. The replication
(branch `gotobi-replicate`, PR #889) ran it frozen on four yen crosses and on USD/JPY 2005-09. Every one of those figures comes
from ONE price feed, OANDA mid M5. A feed artefact at the fix minute (a stamped candle, a fill rule, a thin print) would show up
in all of them alike. This check runs the identical rule on a feed that shares nothing with OANDA: the HistData USD/JPY M1 files
in council-data `research/candles/USDJPY/USDJPY_M1_<year>.csv.gz` (2018 to October 2026), read with
`git show origin/council-data:<path> | gunzip`, no network.

## The rule: frozen, not re-implemented

`frozen.mjs` is a byte-for-byte copy of `research/edge/gotobi-replicate/frozen.mjs` (branch `gotobi-replicate`), itself the
gotobi study's `run.mjs`; sha256 `645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32`, pinned in
`tests/gotobi-feed.test.mjs`. `run.mjs` imports every rule from it: the gotobi calendar, the Tokyo business days, the leg's
times (`legTimes('fade', …)`: entry at the open of the 00:55 UTC M5 candle, exit at the open of the 06:00 UTC candle, or the
close of the last candle up to 15 minutes before), the stop (1.5 x the median absolute move of the same window over the 20
Tokyo business days before, at least 15 of them on file), the stop / gap fills, the cost (`costPx`: 0.3 pip spread, 0.5 pip
slippage a side, USD 22.5 per million a side), `summary` and the month t. The trades come from the frozen `runPair(bars,
'fade', lastDay)` loop. No rule, cost, window or statistic is changed.

## The only new part: the candle loader

HistData M1 rows `YYYYMMDD HHMMSS;open;high;low;close;volume` (bid prices). Each label is converted to UTC with
`council/histdata.mjs` `histStampUtc` (the certified clock: New York time in 2018; from 2019 UTC−5, UTC−4 while Europe is on
summer time) and nothing else; rows whose converted time repeats are dropped (the export artefact the converter's header names).
The M1 candles are aggregated into M5 candles on UTC 5-minute boundaries (`floor(t / 300) x 300`: open of the first minute, high
max, low min, close of the last minute present), giving rows `[t, o, h, l, c]`, the shape the frozen code reads. As in
`gotobi-replicate/fetch.mjs`, only candles starting 00:00-06:55 UTC are kept (the fade leg and its lookback read 00:40-06:00
UTC). A missing minute is not filled; a missing 00:55 candle means no trade that day, exactly as on OANDA.
The last day used is the frozen rule's: the day before the date of the last candle on file.

## The OANDA reference on the same days

The frozen code is re-run on OANDA mid M5 USD/JPY (fetched through the site's keyless `/md/bars` proxy as
`gotobi-replicate/fetch.mjs` did, `node --use-env-proxy`, 2017-11-01 to the end, kept out of git), with the same `lastDay` as
HistData, so both feeds are judged on the same calendar window. Trades are matched by Tokyo date ("common days": a gotobi day
on which both feeds give a trade).

## The pre-registered question and the bar

Window W: 2018-01-01 to the HistData `lastDay` (the first weeks of January 2018 have no 20-day lookback on HistData and give no
trade: that is the frozen rule's own behaviour, not a choice).

1. **H1 (the rule on the other feed):** on HistData, T2 over W has net R a trade > 0 AND month t >= 2 (calendar-month sums of
   net R, the frozen `monthT`).
2. **H2 (the same trades):** on the common days, the Pearson correlation of per-trade net R between HistData and OANDA is at
   least 0.80.

**Verdict:** "FEED-ROBUST" when H1 and H2 both hold; otherwise "NOT FEED-ROBUST", naming the condition that failed. Read
beside it, not part of the verdict: if H1 fails on HistData while H2 holds and the OANDA figure on the same window also has month
t < 2, the shortfall is the shorter window (2018-now, about nine years against the original's ten-plus), not the feed; the report
says so in those words if and only if that is what the numbers show.

## Reported, not judged

- A table: feed, window, n, net R a trade, gross R, cost R, total net R, month t, months, win %, stopped %, median stop in pips,
  net R and month t at 2 x cost (gross R minus twice the cost in R, the `gotobi-replicate` definition). Rows: HistData W;
  OANDA same W; HistData and OANDA on the common days only.
- Price differences on the common days, HistData minus OANDA, in pips (0.01): entry price, exit price, the window's move, the
  stop distance D; median of the absolute difference, 95th percentile of the absolute difference, and the median signed
  difference (HistData is bid, OANDA mid: a constant offset of about half a spread is expected and cancels in the move).
- The correlation of the window move in pips (exit − entry) and the share of common days where the two feeds' net R has the
  same sign; how many days stopped on one feed and not the other.
- By year on both feeds (2019 and 2023 USD/JPY are UNCERTIFIED in the clock audit; 2023's files have a hole from 20 Feb to 30
  Jul; both are kept, not dropped, and named).
- Gotobi days with no trade on each feed, and why when the reason is visible (no 00:55 candle, no lookback, no exit candle).

## What this does not do

No placebo or Holm here: this is one frozen rule on one more feed, not a new search. A pass does not make T2 a council rule or
an edge to trade; a fail does not undo the OANDA studies. Nothing is changed outside `research/edge/gotobi-feed/`, its test and
the rebuilt `out/`.
