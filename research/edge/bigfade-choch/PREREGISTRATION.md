# Big-candle fade: wait for a 1-minute (or 30-second) ChoCh before entering (pre-registration, 24 Nov 2026)

Owner: "find a way to improve the win rate or add maybe m1 choch or 30s choch". Written and pushed alone before any trade
was run on 1-minute or 30-second candles. Paper research only.

## The rule being varied
`big-candle-fade` cell m15 k1.5 nobreak (the Equinox Big-candle fade desk): a closed M15 candle with a body over 1.5 x
ATR(14) that is not a structure break is faded at once, stop past its extreme by 0.1 x ATR, target its 50 %, out after 1 day.
The desk wins about 30 % of the time. Its `signals()` are imported and not edited.

## Data
OANDA mid candles through the site's candle proxy into the shared cache: 5-minute (the signals), **1-minute from 2018**,
**30-second from 2024**. Markets: the five with measured costs, xau, eurusd, gbpusd, usdjpy, audusd (`combo-grid-2` `COSTS`).
Windows by entry time: discovery 2018-01 to 2021-12, confirmation 2022-01 to 2026-10. The 30-second candles cover 2024-01 to
2026-10 only, on xau and eurusd: one window, reported as context, no verdict.

## The entries (same signals, same target, same 1-day limit)
Let L be the lower timeframe (1 minute, or 30 seconds). For a bullish big candle (the fade sells; a bearish one mirrors):
- **BASE**: sell at the open of the first L candle at or after the big candle's close; stop = the candle's high + 0.1 x ATR;
  taken only when the 50 % is 1R or more away (the desk's rule). These signals are the study's set.
- **CHOCH**: after the big candle's close, wait up to **60 minutes** (1-minute) or **30 minutes** (30-second) for the first L
  candle that CLOSES below the most recent confirmed L swing low. A swing low is the lowest low of five candles (two each
  side), confirmed when its second right-hand candle has closed; swings from the 30 L candles before the big candle's close
  onward count. Sell at the open of the next L candle. Stop = the highest high from the big candle through the entry candle
  + 0.1 x ATR (so it is never inside the move that came after). Target = the same 50 % level. No trade when the 50 % is reached
  before the ChoCh, when the stop level is traded before it, when no ChoCh comes in time, or when the entry is already at or
  past the target. No minimum R.
Exits on L candles: stop first when one candle holds both; a gap fills at the open; out at the close of the candle that
reaches 1 day from the entry. Costs: the round trip of the cost table, in R of each trade's own risk.

## Tests (1-minute, judged on the confirmation window; discovery must agree in sign)
1. **Win rate**: CHOCH trades win more often than BASE trades (two-proportion z >= 2).
2. **R a trade after costs**: CHOCH is above BASE (Welch t >= 2 on trades, and the t of the monthly differences >= 2).
3. **Worth trading**: CHOCH is above zero after costs (mean > 0, t of calendar-month sums >= 2).
**PASS** needs all three. 1 and 2 without 3 = a better entry on a rule that still loses.

## Reported, not tested
Per window and market: signals, trades taken and why the rest were not (target first, stop first, no ChoCh, past the target),
winners, median planned R, R before and after costs; the same for the 30-second ChoCh on its one window; the R a SIGNAL
(a signal with no trade counts 0) for both entries.

## Reading, fixed before the result
A ChoCh entry sells lower with a stop further away: more winners is expected, a smaller planned R too. Whether that pays is
the question. On a PASS the entry would be proposed to the owner for the desk's paper record, as a hypothesis for a forward
record (these years were read when the rule was chosen). Nothing live changes whatever the result.
