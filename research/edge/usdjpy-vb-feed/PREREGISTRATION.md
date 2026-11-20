# USD/JPY T1 on a second candle feed: HistData M1 2018 → Oct 2026 (pre-registration, 20 Nov 2026)

Paper research only. Written and pushed alone, before any T1 trade on these candles was computed.

## Why
USD/JPY's T1 breakout passed on OANDA mid candles in 2005-15 (`usdjpy-vol-breakout-early`, +0.079R, month t 2.95) and
2016-26 (`fx-vol-breakout`, +0.063R, t 2.50), and at the demo broker's ticks 2023-26 (`usdjpy-vol-breakout-exec`). Every one of
those reads OANDA's candles for the signal. A rule that depends on one feed's quirks (its day boundary, a stray print) would not
survive another feed. This checks the signal on HistData's USD/JPY M1 files on council-data (`research/candles/USDJPY`).

## Data
- council-data `research/candles/USDJPY/USDJPY_M1_*.csv.gz` (2018 to October 2026), read with `git show`, no network.
- Labels converted with `council/histdata.mjs` `histStampUtc` (the audited clock), the only converter allowed.
- M1 grouped into UTC 5-minute candles (open of the first, high / low over all, close of the last); a 5-minute slot with no
  minute is left out. Then `index-vol-breakout/original.mjs` `buildDays`, unchanged.
- Window: trading days 2018-01-02 → 2026-10-30.

## Rule and cost
T1 exactly as `usdjpy-vol-breakout-early` `trades('usdjpy', days)` (imported, not copied): k 0.5, both sides, the same skips, stop,
exit; cost `fx-vol-breakout` `charge('usdjpy', …)`. HistData quotes are bid prices; the cost is charged as on OANDA mid (a known
difference, stated, not adjusted).

## Test (one)
Pass when, on HistData 2018-01-02 → 2026-10-30: mean net R a trade > 0 AND t on calendar-month sums >= 2.

## Reported, not tested
- The same rule on OANDA mid 5m over the same days (from the `fx-vol-breakout` / `usdjpy-vol-breakout-early` candle file) for
  comparison: n, net R, month t.
- Day-level agreement: share of days traded on both feeds, share of those with the same side, correlation of net R per day.
- Each year's net R a trade on HistData.

## Reading
A pass says the edge is not an artefact of OANDA's candles. A fail with OANDA still passing on the same days says the result
leans on one feed: then the forward record and the broker-tick study carry more weight and no demo stream is proposed (item 63).
Nothing live changes either way.
