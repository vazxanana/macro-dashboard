# Big-candle fade plus: what is missing, explored IN SAMPLE (24 Nov 2026)

Not a test and not evidence. `explore.mjs` on the ten markets `big-candle-fade` already read (xau xag eurusd gbpusd usdjpy
audusd nzdusd usdcad usdchf eurjpy, fills 2005 to Oct 2026), costs as in that study (`combo-grid-2` `COSTS`, five ASSUMED). Every
figure below was found by looking, after the result of `big-candle-fade` was known; whatever is kept is judged only on markets
this work never read (`PREREGISTRATION.md`).

## What is missing

`big-candle-fade` found a real before-cost tilt (an M15 candle over 1.5 x ATR that is not a structure break gives part of itself
back: +0.31R / +0.19R a trade to its 50 %) but the bid / ask takes 0.35-0.48R a trade on stops just past a 15-minute candle. Per
market, the 50 % exit before costs was +0.12R (silver) to +0.32R (NZD/USD) and after costs -0.06R (GBP/USD) to -0.50R (silver).
The missing piece is the ratio of the move to the cost, not the direction.

## Pieces of the other methods tried (M15, k >= 1.5, three entries x three stops x three exits, alone and in pairs)

- Entries: market at the next 5-minute open; an engulf-style confirmation (the next M15 candle closes the other colour, enter
  after it, as on the MSNR / engulfing desks); a limit 25 % of the candle's range further on (one hour to fill).
- Stops: past the extreme by 0.1, 0.5 or 1 ATR. Exits: the candle's 50 %, its open (full retrace), 2R. Time limit 1 day.
- Filters: break / no break; London-New York vs Asia (21:00-07:00 UTC); D1 trend (close vs 20-day average) and H4 structure side,
  with or against the candle; a sweep of the prior New York day's high / low (closed back inside, or beyond); a rejection wick of
  25 % or more; the US release clock (12:15-14:00 UTC); size k >= 2 / 3; range >= 0.3 / 0.5 x the D1 ATR.

## What came out

- **No single piece is positive after costs in both decades.** The best single filters lose 0.05-0.09R a trade after costs
  (sweep-back with the confirmation and 2R: -0.075R / -0.055R; rejection wick with the confirmation, 1 ATR stop, full retrace:
  -0.089R / -0.087R). Wider stops cut the cost in R but cut the tilt as much; the limit entry raises the cost in R; D1 / H4 side
  and the prior-day sweep change little.
- **Two pairs are positive after costs in both decades, both weak:**
  1. **Overnight shock fade**: Asia hours + range >= 0.5 x D1 ATR, market entry, stop 0.1 ATR past the extreme, exit at the
     candle's open: +0.177R (n 622, month t 1.35) in 2005-14 and +0.208R (n 982, t 1.20) in 2015-26 after costs. It is a
     lottery: median trade -1.07R, the best trade +97.5R, without the 10 best trades -0.013R a trade, without the best 1 %
     -0.089R. Its winners are overnight central-bank, intervention and shock candles that fully retrace.
  2. **Rejection wick + confirmation**: wick >= 25 % + range >= 0.5 x D1 ATR, the confirmation entry, stop 0.5 ATR, 2R: +0.028R
     (n 710, t 0.55) and +0.068R (n 956, t 1.48) after costs. Small and steadier, not tail-driven.
- Many cells were looked at (17 filters alone and 120 pairs, 27 mechanics each): two weak positives among them is about what chance gives.
  They are hypotheses, nothing more.
