# Chart rules 2020: barrier retest and sweep reversal (pre-registration, 23 Nov 2026)

Written and committed before any result was computed. Two entry rules read off the owner's own marked charts, written here
in this repository's own words, tested once on 18 markets, 2020 to the last candle on file. Research only: nothing live reads it.

## Data

- OANDA mid 5-minute candles through the research cache (`research/edge/_lib/edgekit.mjs` `load`), 2019-01-01 to the last
  closed candle (2019 is warm-up only; no trade is counted before 2020-01-01). H1 and H4 = `resample` of the 5-minute candles
  (UTC buckets); D1 = `dailyNY` (17:00 New York trading days).
- Markets (18): xau eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy xag gbpjpy eurgbp audjpy cadjpy euraud nas100 spx500 de40.
- Costs: `COSTS` of `research/edge/combo-grid-2/run.mjs` (round trip in price units). A trade whose fill falls inside a
  data-quality bad interval (`exclusions(market)` of the same file) is dropped.
- Windows by the fill time: discovery 2020-01-01 to 2023-12-31, confirmation 2024-01-01 to the end.

## Shared pieces

- ATR(14) of a timeframe = the mean true range of its last 14 candles CLOSED at the order time.
- Target zones: engulf zones (`buildZones('eg')`) and failed-engulf zones (`buildZones('ef')`) of
  `research/edge/combo-grid/run.mjs`, built on H4 and on D1. A zone is standing at moment T when it was known (`at <= T`) and
  not yet ended (`T < end`). For a buy the target is the near edge (bottom) of the nearest standing SELL zone (d = -1) lying
  wholly above the entry, H4 and D1 together; a sell mirrors it (top of the nearest standing buy zone wholly below). No such
  zone, or a target under 3R from the entry, = no trade. A farther zone is never taken instead.
- Stop = the rule's reference level past by 0.25 x ATR(14) of the rule's timeframe plus half the round-trip cost. Every trade
  has its stop on the losing side (checked; a trade without one is dropped).
- Fill and exits: `multi()` of `research/edge/combo-grid/run.mjs` on 5-minute candles: a limit fills on the first candle that
  reaches it (on that candle only the stop counts); a close past the stop before the fill cancels the order; stop first when
  one candle holds both; a gap through a level exits at the open. Time limit: 5 days from the fill for H1 rules, 10 days for
  the H4 rule (exit at that candle's close). A trade still open at the end of the file is not counted.
- R after costs = R - cost / risk. Trades may overlap (no one-at-a-time rule); every trade counts.

## The rules

**(A) Barrier retest.** Boxes = `boxesClose` (a box is the high and low of the candles since the last close outside a box;
a close outside ends it and gives the side). When a box breaks up (a close above its high), a buy limit at the box's high
(the broken edge), placed at the close of the breaking candle, valid 24 candles of that timeframe; stop below the box's low
(the far side) by 0.25 x ATR(14) + half the cost; target as above (3R or more). A break down mirrors it.
- **T1**: H1 boxes. **T2**: H4 boxes.

**(B) Sweep reversal, T3.** H1 swings `swings(H1, 3)`. A buy: an H1 candle trades below the last confirmed swing low L (the
sweep; each swing low is swept once); within the next 24 H1 candles an H1 candle closes above the most recent confirmed swing
high that is a lower high (below the confirmed swing high before it) and lies above the sweep's low (the break the other way).
The swept low = the lowest low from the sweep candle to the break. A buy limit at the broken swing high, placed at the close
of the break, valid 24 H1 candles; stop below the swept low by 0.25 x ATR(14) H1 + half the cost; target as above (3R or more).
If the price closes below the swept low before the break, the sweep is void. A sell mirrors it.

## Tests and bar

Three tests, T1-T3. A test PASSES only if all hold:
1. Discovery 2020-2023: n >= 100, mean R after costs > 0, month-sum t >= 2.
2. Confirmation 2024-now: n >= 50, mean R after costs > 0, month-sum t >= 2, and its two-sided month-sum p after Holm over
   T1-T3 below 0.05.
3. Mean R > 0 at twice the cost in both windows.

Month sums = the sum of R of the trades filled in each calendar month (empty months count as 0); t = mean / (sd / sqrt(months)).
Verdict: PASS if at least one test passes; INCONCLUSIVE if every test that fails does so only on a count (n under the bar);
otherwise FAIL.

Reported, not judged: before costs; by market; the same signals with a fixed 2R target (are the far targets what matters?);
every signal without the 3R zone filter at a fixed 2R target.

## No look-ahead

Every signal is built from candles closed at its order time. A test cuts the candles at random moments and checks that the
signals with an order time before the cut are the same as from the whole series.
