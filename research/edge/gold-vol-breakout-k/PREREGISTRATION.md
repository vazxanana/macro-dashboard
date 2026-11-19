# Pre-registration: gold-vol-breakout-k (14 Nov 2026)

Paper research only. A **parameter-stability** check of one stand-alone intraday rule on spot gold. It is **not** a gate,
exit, entry or size of the live gold book (Gold trend + Gold daily engulf): owner decision 44 forbids further tests of that
book on its 2006-17 window, and this study reads none of the book's records or positions. Nothing live changes; no proposal
follows from this study.

Written and pushed before any figure of the rule at a setting other than the ones already published was computed.

## Why

`research/edge/gold-vol-breakout` (commit 72009ebe) tested the UTC open ± k × previous-day-range breakout on OANDA gold M5,
2016-2026: T1 (k 0.5) failed narrowly out of sample (+0.072R net, month t 1.86); T2 (k 0.7) was positive before costs and not
significant. `research/edge/gold-vol-breakout-replicate` (commit 3360a2cf) ran T1 unchanged on untouched 2007-2015 and passed:
+0.111R a trade net, n 1,657, month t 3.19, gross +0.203R.

The question here: **is k = 0.5 a lucky peak, or does the effect hold across nearby settings?**

## What this study is NOT

- **It does not choose a new k.** The tested rule stays k = 0.5, exit 21:00 UTC, day anchored at 00:00 UTC. Every other
  setting below is read only to see the shape of the effect around the tested one. A setting that looks better here is
  NOT adopted: any other k, exit or anchor would need its own pre-registration on data none of these studies has read, and
  little such data is left (OANDA M5 gold starts in 2006; 2007-2026 is now read in full).
- No gate, filter or size of the live gold book. Other work (costs, a second feed, the risk profile) is done elsewhere and
  not here.

## The rule (imported, unchanged)

The original study's `run.mjs` is copied **verbatim** into this folder as `original.mjs` (sha256
afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f, the same file as
`research/edge/gold-vol-breakout-replicate/original.mjs` on branch `gold-vol-breakout-replicate`). This study's `run.mjs`
imports `buildDays`, `daySkip`, `vbTrade`, `placeboTrade`, `rng`, `monthT`, `summary`, `quantile`, `normP`, `holm`, `COST`,
`SEEDS`, `PLACEBO` from it and changes none of them. Only parameters change:

- `k` is passed to `vbTrade` (the rule's own argument).
- The exit time is set by the candles handed to `vbTrade`: the rule places its orders on, and exits at the close of the last
  of, the candles it is given (that is how the original makes 00:00-20:55 and the 21:00 exit). For an exit at time X the
  day's candles from 00:00 UTC up to the one ending at X are handed over, so the order window and the hold both end at X,
  exactly as in the rule. Financing (`FIN.xau.long` × `nights`, `council/fills.mjs`) is charged by the original's own
  `close()` on buys held over the 22:00 UTC rollover.
- The anchor variant builds its days from 17:00 New York (below) and hands those candles to the same `vbTrade`.

Costs: $0.60 a round trip per ounce (`COST`), plus financing on buys; 2x costs reported.

## Data

`xau-5m.json.gz`: OANDA mid XAU/USD M5, rows `[t, o, h, l, c]`, 2006-11-01 on, from the keyless candle proxy (the replicate
study's cache), kept out of git. The day of the last candle is dropped as forming, as in the original. Eligible days are the
original's (`daySkip` on the 00:00-20:55 UTC candles: a previous day, an open before 01:00 UTC, 200 candles or more) for every
k and every exit; the anchor variant applies the same checks to its own days.

## Harness gate (before any other figure is read)

`original.mjs` functions on this cache, k = 0.5, 2007-01-01 → 2015-12-31, must reproduce the replicate's published `main`
**exactly**: n 1657, netR 0.111, grossR 0.203, net2R 0.018, month t 3.19, gross t 5.96. A second check: the exit-sweep code at
21:00 UTC must give, trade for trade, the same trades as the base rule (it hands over the same candles). If either fails, the
study stops and reports the difference.

## Windows

2007-01-01 → 2011-12-31, 2012-01-01 → 2015-12-31, 2016-01-01 → 2020-12-31, 2021-01-01 → the last complete day, and pooled
2007-01-01 → the last complete day. The first two are the replicate's untouched halves, the last two the original's in-sample
and out-of-sample windows. All of them have now been read at k = 0.5; that is why no setting chosen here could be "confirmed"
on them.

## 1. k sweep (both sides, exit 21:00 UTC, 00:00 UTC anchor)

k ∈ {0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0}. For each k and each window: n, gross and net R a trade, month t of net and of
gross R (calendar-month sums, the original's `monthT`), net R a trade at 2x costs. Shown as a heat table (k × window, net R a
trade with its month t).

Placebo per k (pooled window, 40 seeds, the original's `placeboTrade`): every eligible day, one market entry at a random
5-minute mark 01:00-18:00 UTC, side by a fair coin, stop k × the previous day's range away, out at 21:00 UTC or the stop, the
same costs; the number of seeds the real pooled net R beats is reported.

## 2. Exit-time sweep (k = 0.5)

Exit at the close of the candle ending 16:00, 18:00, 21:00 (the rule) and 24:00 UTC (the 23:55 candle). Orders live on the
same candles. Exits past the 22:00 UTC rollover pay financing on buys. Same table per window.

## 3. Day-anchor check (k = 0.5)

The trading day runs from 17:00 New York (`nyOffsetH` of `council/histdata.mjs`, read only: 21:00 UTC in US summer time,
22:00 UTC otherwise) to 17:00 the next New York day; Sunday's reopen starts Monday's day, weekend candles (if any) are folded
into the next weekday. Open = the first M5 candle at or after the anchor (must start within 1 hour, else no trade); prevRange =
high − low of the previous trading day; buy / sell stops at open ± 0.5 × prevRange, stop back at the open, the order window and
the hold are **21 hours from the anchor** (the rule's own length: 00:00 → 21:00 UTC), exit at the close of the candle ending
anchor + 21 h. A day needs 200 candles in that window. The day is dated by its New York trading date (the date of the 17:00
close it ends at) for windows and month sums. Same table per window.

## 4. Stability reading (fixed now)

The effect is called **broad** only if BOTH hold on the pooled window:

1. net R a trade > 0 for at least 6 of the 8 k values, and
2. gross month t ≥ 2 for every k in {0.3, 0.4, 0.5, 0.6, 0.7}.

Otherwise it is called **narrow**. The exit sweep and the anchor check are reported beside it and do not enter the reading.

Multiple tests: the 12 configurations (8 k + 3 other exits + 1 anchor) are each given a one-sided p from their pooled net
month t, adjusted with Holm over the 12, and reported. They do not change the reading; no configuration is a new candidate.

## Outputs

`run.mjs` (writes `result.json` and `RESULT.md`, which is a function of `result.json`), `tests/gold-vol-breakout-k.test.mjs`
(offline: the parameter plumbing on hand-made candles, no look-ahead, the anchor's day building, the reading, and the report
against `result.json`).
