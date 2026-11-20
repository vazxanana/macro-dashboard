# Red folder surprise on USD/JPY (pre-registration, 20 Nov 2026)

Paper research only. Written and pushed alone, before any USD/JPY return around these releases was computed.

## Why
`red-folder-surprise` (19 Nov 2026) found gold's first 5 minutes after US core CPI and payrolls go the way of the miss against
the calendar consensus on 60 of 83 releases, but the trade from T+5 to T+60 failed (−0.007 % out of sample). The owner's news
register asks the same of the dollar. USD/JPY is the dollar pair the desk now follows (its T1 breakout passed). This is the same
test on USD/JPY, with the design copied, not tuned.

## Data
- Releases, times, consensus and first prints exactly as `red-folder-surprise` (imported: `events` inputs from
  `council/event-base.json`, `council/consensus-history.json`, `firstPrints`): US core CPI m/m and non-farm payrolls, 2018 to
  4 Apr 2025, a miss of 0 dropped.
- USD/JPY: HistData M1 from council-data (`research/candles/USDJPY`), clock by `council/histdata.mjs` `histStampUtc`, grouped to
  UTC 5-minute candles (as `usdjpy-vb-feed`). Price at T = close of the 5-minute candle that ends at T; T+5 = close of the candle
  starting at T; T+60 = close of the candle starting at T+55. A release with any of the three missing is dropped (counted).

## Direction and cost
Hot (actual above consensus) = dollar up = USD/JPY up: `dir = sign(actual − consensus)`. Return in % of price. Cost 0.015 % a
round trip (about 2 pips at 150; the demo quotes 0.8 pip on a normal hour and wider at a release, see `gold-release-quotes`).

## Tests
- **T1 (reported, binomial)**: share of releases whose T → T+5 move has the sign of `dir`.
- **T2 (the one test)**: trade `dir` from T+5 to T+60, net of cost. Pass when mean > 0 in 2018-2021 AND mean > 0 in 2022 → Apr 2025
  AND t >= 2 in 2022 → Apr 2025 (the gold study's bar).

## Reported, not tested
Gross T+5 → T+60; release → T+60 (not tradable); CPI and payrolls apart; above vs at-or-below the median absolute miss.

## Reading
A fail repeats gold's lesson for the dollar: know the side before the print, do not chase after it. Nothing live changes.
