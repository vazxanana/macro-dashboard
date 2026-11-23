# Daily rejection, H4 break, limit at the broken level: pre-registration (23 Nov 2026)

Committed alone, before any candle of this study was read. Paper research only: nothing live reads it or changes with it.

## Question

The gold plan's direction rule (council/eg-methods.mjs `snrSides`, imported, never edited) taken as a trade on 18 markets: does a
limit order at the broken H4 level, after a Daily rejection of a fresh key level and an H4 break the same way, make money after
costs on 2020 to now, in a discovery window and again in a confirmation window?

## Data

- OANDA mid 5-minute candles from the edgekit cache (`research/edge/_lib/edgekit.mjs`, filled by `fetch-cache.mjs`), 2019 on
  (2019 = warm-up only). Markets (18): xau eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy xag gbpjpy eurgbp audjpy cadjpy
  euraud nas100 spx500 de40.
- Daily candles = `edgekit.dailyNY` on the 5-minute candles (17:00 New York trading days, weekend candles folded into Monday);
  handed to `snrSides` with `time` = the day's end minus 24 h (so `time + 86400` = the moment the day closes).
- H4 candles = `edgekit.resample(M5, 14400)` (UTC-aligned, as the desk).
- Costs: round trip in price units from `research/edge/combo-grid-2/run.mjs` `COSTS`. Trades whose fill falls inside a
  data-quality exclusion (`exclusions(market)`, from `research/edge/data-quality/quality.json`) are dropped.
- Windows (by fill time): discovery 2020-01-01 to 2023-12-31; confirmation 2024-01-01 to the last candle.

## Signal (the repository's own reading, unchanged)

`snrSides(D1, H4)`: a Daily candle wicks through a fresh Daily key level and closes back on the other side (rejection). Key
levels = V / A levels (turns of the Daily CLOSES, 2 candles a side, last 60 days) and open-close levels (two Daily candles of one
colour; the first one's close). Then an H4 candle closes beyond the last H4 A level (buy; V level for a sell; a turn of the H4
closes, 2 a side) that stood when price tapped the Daily level, within the window `snrSides` uses (3 trading days, `SNR.boDays`).
The side is known at the later of the break's close and the Daily close.

## Tests (three, Holm over the three)

- **T2 (plain close)**: every side `snrSides` returns.
- **T1 (strong body)**: T2 only when the breaking H4 candle (the first close beyond the level, the one `snrSides` names) has a
  body (|close − open|) of at least 1 × ATR(14) of H4, and its body points the trade's way. ATR(14) = the mean true range of the 14
  H4 candles closed before the breaking candle (known at its close).
- **T3 (structural stop)**: T1 with the stop past the rejection Daily candle's extreme (its low for a buy, high for a sell) by
  3 pips, instead of 30 pips past the entry; target 3R of that risk. A signal whose stop would not be on the losing side of the
  entry is skipped.

## Order and exit (all tests)

- A limit at the broken H4 level (the A / V level's close), placed at the moment the side is known, valid for 24 H4 candles
  (96 h). If price is already past the level when the order is placed, the order fills at the first 5-minute open that reaches
  it (edgekit-style: a buy limit above the price fills at the open). An order is cancelled if a 5-minute candle closes past the
  stop before it fills.
- T1 / T2: stop 30 pips past the entry (pip = `pipOfMarket`, council/eg-methods.mjs: gold 0.10, silver 0.01, indices 1, a
  five-decimal pair 0.0001, a yen pair 0.01), target 3R (90 pips). Risk is measured from the fill.
- Exits on 5-minute candles (`multi` of research/edge/combo-grid-2/run.mjs, 3R column): a candle that opens past the stop or the
  target exits at its open; a candle that holds both is a stop; on the fill candle only the stop counts. A trade still open after
  30 days exits at that candle's close. A trade still open at the end of the file is not counted.
- At most 2 entries a UTC day per market (by fill time, in fill order); no other position limit.
- R after costs: R − cost / risk; at twice the cost: R − 2 × cost / risk.

## Pass bar (each test)

PASS only if: discovery n >= 100, mean R after costs > 0, month-sum t >= 2; confirmation n >= 50, mean R after costs > 0,
month-sum t >= 2 after Holm over the three tests (one-sided p from the confirmation month-sum t, Holm-adjusted, <= 0.0228); and
mean R > 0 at twice the cost in both windows. Month sums are by fill month (empty months between the first and last trade count
as 0). The verdict is PASS if any test passes, FAIL if none does with enough trades, INCONCLUSIVE if a test cannot reach its n.

## Reported, not judged

Gold alone and each market as descriptive rows (n, R a trade after costs, month-sum t per window). A cut test for look-ahead:
the signals and orders computed on candles cut at several moments must equal those of the whole file up to each cut.

Never call a result an edge without n and t. Never quote the owner's private material.
