# vb-adaptive-k: a k set by yesterday's range against its 20-day median (pre-registration, 24 Nov 2026)

Paper research only. Written and pushed alone before any trade at an adaptive k was computed. Nothing live changes.

## Question

The gold and USD/JPY intraday volatility breakouts (T1: buy stop at the UTC open + k x the previous folded day's range,
sell stop at the open - k x that range, stop back at the open, out at 21:00 UTC, k 0.5) were swept over FIXED k
(`gold-vol-breakout-k`, `usdjpy-vb-k`: both BROAD, k stayed 0.5). Not yet asked: does a k chosen each day by how wide the
previous day was, relative to its own recent range, beat the fixed k 0.5 after costs? (`nr7-breakout` and
`compression-breakout` tested a narrow range as a SIGNAL of its own, not as a setting of this rule.)

## The one mapping (fixed here, no other is run)

- ratio = previous folded day's range / median of the ranges of the 20 folded trading days ending with that previous day
  (the 20 `prevRange` values of today and the 19 trading days before it in `buildDays`' list; all known before the open).
- ratio < 0.7 (narrow day) -> k 0.3; ratio > 1.3 (wide day) -> k 0.7; otherwise k 0.5.
- A day with fewer than 20 earlier ranges is left out of BOTH arms (the comparison is paired on the same days).

Everything else is T1 unchanged: `buildDays`, `daySkip`, `vbTrade` imported from `research/edge/index-vol-breakout/original.mjs`
(the verbatim copy of `gold-vol-breakout/run.mjs`, sha256 afa36e03...), never edited. Note: the stop stays at the open, so k
changes both the trigger distance and the risk (1R = k x prevRange, roughly).

## Data and costs

- OANDA mid M5 from the shared cache (`research/edge/_lib/edgekit.mjs` `DATA_DIR`, markets `xau`, `usdjpy`).
- Gold: the measured hourly cost C1 of `gold-vol-breakout-hourcost` (half the median quoted spread of the fill hour + half of
  hour 20 + commission 0.000024, as a share of the entry, + 0.05 x M stop slippage, M = median M5 range of the 12 candles to
  the fill), read from that study's committed `result.json` `profile`, minus the rule's own long financing `finR`.
- USD/JPY: `fx-vol-breakout` `charge` (commission 0.000045 of price + 0.5 pip a round trip), as `usdjpy-vb-k` (no financing,
  as there).
- Windows: discovery 2005-01-01 -> 2014-12-31 (gold from its first cache year, 2006), confirmation 2015-01-01 -> the last
  complete day in the cache. Gold therefore uses other window edges than its earlier studies; said why: the task fixes
  2005-2014 / 2015-now for both markets.

## Harness gate (before any adaptive figure is read)

Fixed k 0.5 on all days (no 20-day requirement) must reproduce, from this cache:
- USD/JPY 2005-01-04 -> 2015-12-31: n 2089, net +0.079R (`usdjpy-vb-k`);
- gold 2007-01-01 -> 2026-11-12 under C1: n 3713, net +0.139R (`gold-vol-breakout-hourcost`).
Exact, or within n +/- 1 % and net +/- 0.005R (the cache is a different download of the same feed); the difference is
reported. Outside that tolerance the run stops and nothing is concluded.

## Tests (three, Holm over three)

Paired per day: d = net R of the adaptive arm - net R of the fixed k 0.5 arm (a day one arm does not trade counts 0 for that
arm). Summed by calendar month; t of the monthly sums.

- A1 gold, A2 USD/JPY, A3 pooled (both markets' daily differences summed into one monthly series).

A test passes only if ALL hold:
1. mean d > 0 in discovery AND in confirmation;
2. confirmation month t of d >= 2, one-sided p after Holm over the three tests < 0.05;
3. the adaptive arm's own net R a trade > 0 in both windows;
4. n >= 200 trades of the adaptive arm in each window;
5. placebo: 40 seeds, the days' k labels shuffled at random within the market and window (same share of 0.3 / 0.5 / 0.7
   days); the real confirmation mean d must exceed the placebo's 95th percentile.

Verdict PASS if A3 passes; otherwise FAIL (A1 / A2 reported either way). A pass would say an adaptive k beat the fixed one on
these years; it would not adopt anything: any change to the forward records needs the owner and its own forward test.

## Reported, not tested

- The three range buckets at FIXED k 0.5: n, gross and net R a trade, month t, per market and window (descriptive).
- Each arm's n, gross / net R, month t, and net at 2x costs.
