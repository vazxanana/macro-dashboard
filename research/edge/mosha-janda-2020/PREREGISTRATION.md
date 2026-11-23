# The Janda two-step barrier entry on 18 markets, 2020 to now (pre-registration, 23 Nov 2026)

Written and committed before any code of this study ran and before any of its trades was looked at.

## Why
The owner's notes describe a two-step confirmation at a barrier (the "Janda"): price reaches a higher-timeframe zone, the
lower timeframe prints a structure break against the prior move (a QM / BO Structure), then a normal break of the next swing
the same way; the entry is the pullback into the small base of that second break, not the first. The notes report that the
best version did well when the turn was shallow and that buys did much better than sells, on gold only and with no costs
stated. The repository's `barrier-qm-janda` study (gold, a Daily direction filter, target the nearest swing 2R or more away)
failed. This study asks the plainer question on many markets: a fixed target, no direction filter, all 18 markets of the
candle cache pooled, 2020 to now.

## Data
- The edgekit candle cache (OANDA mid 5-minute candles, outside git): xau eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf
  eurjpy xag gbpjpy eurgbp audjpy cadjpy euraud nas100 spx500 de40. Candles from 2019-09-01 (warm-up) to the last candle in the
  cache; trades count from a fill on or after 2020-01-01.
- Timeframes built from the 5-minute candles: H4 and H1 (UTC buckets), M15, M5.
- Costs: the round trip of `research/edge/combo-grid-2/run.mjs` `COSTS` (price units), charged once a trade over its opening
  risk. No financing. A trade whose fill falls in a bad interval of `research/edge/data-quality/quality.json` (the
  `exclusions()` of the same file) is dropped.

## The rule (closed candles only; swings K = 3 on every timeframe)
Two pairs, run side by side on each market: barrier H4 -> confirmation M15, barrier H1 -> confirmation M5 (the notes' own
"one step lower" table for these two barrier timeframes; M1 is not in the cache).
1. **Barrier zones** on the barrier timeframe B, exactly as `research/edge/barrier-qm-janda/run.mjs` `zones()` (imported):
   (a) the origin of every structure break (broken level to the extreme of the leg; a break up is a buy zone), (b) every engulf
   zone (the base candle, wick to wick, completed within 3 candles). Known at the close of the candle that completes it.
2. **Touch**: the first closed B candle after the zone is known that trades into it (`touchOf`, imported: gone if a B candle
   closes beyond the far side first, or after 100 B candles). The touch candle closing beyond the far side ends the setup.
3. **Step 1, the QM**: the first QM (edgekit `qms`) of the zone's side on the confirmation timeframe C whose breaking candle
   closes after the touch candle's close, within 48 C candles, with its head (the reversal extreme) inside the zone. A C close
   beyond the zone's far side before it ends the setup.
4. **Step 2, the second break**: the first C close beyond the latest swing high (buy) / swing low (sell) confirmed after the QM
   break candle, within 48 C candles of it; a C close beyond the QM head first ends the setup.
5. **The leg and its base**: the leg's extreme = the lowest low (buy) / highest high (sell) of the C candles from the one after
   the QM break to the second-break candle. The base = the latest engulf of the trade's side (`engulfs`, imported) whose base
   candle lies at or after that extreme and which is completed by the second-break candle at the latest. Its zone = the PAIR:
   from the lower to the higher of the two candles' wicks (base candle and completing candle). No such engulf: no trade.
6. **Order**: a limit at the middle (50 %) of that pair zone, placed at the close of the second-break candle; it must lie on
   the pullback side of that close (else no trade). Stop = the leg's extreme plus a buffer of 0.1 x ATR(14) of C at the
   second-break candle, beyond it. Risk = entry - stop (buy). A risk under 3 round-trip costs is skipped (so cost is at most
   a third of 1R). The order lives 24 C candles; a C close beyond the stop cancels it; the target trading before the fill
   cancels it.
7. **Exit**: a fixed target at 2R (primary) and, as a separate stream, 3R; stop on the losing side always; time exit at the
   close of the 20th B candle after the fill candle. Fills on 5-minute candles (edgekit `simulate`: a candle holding both stop
   and target is a stop; on the fill candle only the stop counts). One position or resting order at a time per market, pair
   and target.

## Tests (each pooled over the 18 markets and both pairs, target 2R)
- **T1**: every Janda trade, buys and sells.
- **T2**: buys only.
- **T3**: shallow turns only. **Shallow** = the QM head went no further than half way into the barrier zone from its near
  edge: for a buy zone [lo, hi], (hi - head) / (hi - lo) <= 0.5; a sell mirrors it.
Reported, not tested: every test at 3R; gold alone; each pair alone; sells alone; before costs; by year.

## Windows and the bar
Discovery 2020-01-01 to 2023-12-31, confirmation 2024-01-01 to the last candle. Month sums = the R after costs of every trade
pooled by the calendar month of its exit, months with no trade counted as zero; t = mean month sum / its standard error.
A test PASSES only if all hold:
- discovery: n >= 100, mean R a trade after costs > 0, month-sum t >= 2;
- confirmation: n >= 50, mean R a trade after costs > 0, month-sum t >= 2 and Holm-adjusted two-sided p < 0.05 over the three
  tests;
- mean R a trade at twice the cost > 0 in both windows.
Verdict: PASS if any test passes; INCONCLUSIVE if no test passes but one has fewer than 50 confirmation trades, or one is
positive after costs in both windows with confirmation month t >= 1; otherwise FAIL.

## No look-ahead
Every step reads candles closed by the moment it acts on. A cut test: on gold, the orders placed before a cut date must be
identical when every candle after the cut is removed; the test file repeats it on synthetic candles.
