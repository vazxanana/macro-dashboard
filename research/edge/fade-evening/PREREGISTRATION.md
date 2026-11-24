# A tradable evening fade? (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/fade-hour-check` (PASS before costs) found the fade of the first M15 structure break is strong in the evening
(17-01 UTC) and that it survives with rollover FILLS excluded, but: (1) a large share of its R is booked by EXITS inside
21:00-22:59 UTC, where mid quotes jump and the spread widens, so that part may not be tradable; (2) after one flat round trip
every cut is negative in 2015-26 (-0.081R a trade for 20 and 23 UTC). What is missing for a tradable rule:

- **no contact with the rollover at all** (no fill AND no exit or holding between 21:00 and 22:59 UTC);
- **less cost in R** (cost per trade is about 0.16-0.18R at a 1 ATR stop: a wider stop halves it);
- **a better entry price** (a limit inside the fade's direction instead of a market order at the next open);
- **a calmer regime** (`fade-conditions` found low volatility the better level, confirmed out of sample);
- **markets the hour split never read**.

This study puts those in one small, fixed grid, picks ONE cell on 2005-14 after costs, and judges it once after costs on
2015-26, on HistData, and on five forex crosses whose hours were never split. One run, no variants after it.

## The base rule (imported, unchanged)

`grid7-wide-fade` `signals` (M15, context none): the first close beyond the last confirmed M15 swing (3 a side), known at the
close of the break candle; the trade goes AGAINST the break (side s = -d). Closed candles only. Hour = UTC hour the break
candle starts (as `fade-conditions`). Data-quality exclusions on OANDA (`combo-grid-2` `exclusions`).

## Always on in this study (the rollover rule)

- No fill between 21:00 and 22:59 UTC (an order whose fill would fall there is not filled; a market entry there is no trade).
- Flat before the rollover: a trade still open when a 5-minute candle starting in 21:00-22:59 UTC comes is closed at the
  close of the candle before it (the last candle ending at or before 21:00). Also out after 1 day (the grid's M15 cap).
- Stop first when one 5-minute candle holds both; a gap through the stop or target fills at the open.

## The grid (24 cells, fixed now)

- **Hours** (break candle start): **A** = 20 and 23; **B** = 17, 18, 19, 20, 23, 00, 01.
- **Stop** k x ATR(14) of M15 from the entry price: **k = 1, 1.5, 2**. Target 2R. Every stop on the losing side (the run
  throws otherwise). A risk under the market's round-trip cost is no trade.
- **Entry**: **mkt** = market at the open of the first 5-minute candle starting at or after the break close (the grid's);
  **lim** = a limit 0.25 x ATR better than that open (lower for a buy, higher for a sell), valid 12 five-minute candles; filled
  at the limit (or the open if it gaps through); on the fill candle only the stop counts.
- **Filter**: **all**, or **calm** = `fade-conditions` `volLevel` low (ATR14 / its 100-candle median < 0.8 at the break).

## Costs

`combo-grid-2` `COSTS` (the demo figures; ASSUMED for xag, nzdusd, usdcad, usdchf, eurjpy and the five crosses), one round
trip a trade, charged as cost / risk. Beside: at twice the cost.

## Selection (discovery, OANDA 2005-01 .. 2014-12, ten markets of the grid)

The one cell with the highest mean R AFTER costs, among cells with n >= 1,000. Written down with its figures; nothing else is
picked.

## Primary tests (the selected cell only; Holm over the three)

- **P1** OANDA, the ten markets, fills 2015-01 .. 2026-10: mean R after costs > 0 and calendar-month-sum t (after costs) >= 2.
- **P2** HistData M1 -> 5 minutes (`fade-new-markets` `histM5`; xau xag eurusd gbpusd usdjpy audusd usdcad usdchf), fills
  2018-02 .. 2026-10: the same.
- **P3** five forex crosses the hour split never read, OANDA (**gbpjpy audjpy cadjpy eurgbp euraud**), fills 2005-01 ..
  2026-10: the same.

One-sided p from each month t (months - 1 df). **PASS** = all three pass after Holm (a candidate for a forward paper record,
never an edge by itself). **FAIL** = any fails. **INCONCLUSIVE** = no cell has n >= 1,000 in discovery, or the gate fails.

## Gate

With the rollover rule OFF, k = 1, mkt, filter all, hours 20-23, the code reproduces `fade-hour-check`'s 20-23 block in
2015-26 (n 27,671, +0.169R before costs).

## Reported beside (descriptive)

All 24 cells in every window, before and after costs and at twice the cost; the selected cell per market and per year; and,
as the "complement", its monthly R after costs set beside the two rules that passed their own tests, the gold and USD/JPY
volatility breakouts (`gold-vol-breakout-forward/baseline.json`, `usdjpy-vol-breakout-forward/baseline.json`, daily R after
their costs): monthly correlation and a combined book (1R each) over their common months. No weights are fitted.

Never called an edge without n and t; the 2015-26 years and HistData were already read by hour in `fade-hour-check`, which is
said in the result; the crosses are the cleanest test.
