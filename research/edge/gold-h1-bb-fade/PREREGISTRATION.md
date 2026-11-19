# Pre-registration: gold H1 Bollinger band fade in a quiet regime (14 Nov 2026)

Written and pushed alone, before any trade of this study is computed.

## Question
When spot gold is quiet on H1 (low ADX) and an H1 candle closes outside its 20-period Bollinger band, does price come back to
the middle band often enough to pay a fixed stop and the round-trip cost?

## Scope (owner decision 44)
A **new stand-alone intraday mean-reversion rule**. It is not a gate, exit, entry or size of the live gold book (Gold trend +
Gold daily engulf), it reads none of that book's positions and it adds nothing to that book's 2006-17 window. Paper research
only: nothing live changes whatever the verdict; a PASS would be a proposal to the owner at most, never a live change.

## Why it is not a duplicate
- `gold-squeeze` (14 Nov, FAIL): Bollinger inside Keltner, then TRADES THE BREAKOUT in the band's direction (H4 / D1).
- `gold-vwap` (14 Nov, FAIL): fades a 2 sd close from the SESSION VWAP on M5, first signal of the day.
- `gold-hourly-shock` (14 Nov, FAIL): fades / follows a single H1 RETURN beyond 3 sd of the last 500 returns, no regime filter.
- `gold-ibs`, `metals-rsi2`, `rsi2-*`: DAILY candles, IBS or RSI(2) oscillators. `gold-shock-revert`: daily 2 x ATR days.
- `gold-asia-break`, `gold-us-asia`: session breakouts / session direction, not a band fade.
None fades an H1 close outside a Bollinger band, and none conditions the fade on a low-ADX (non-trending) regime. No branch or
study named for a Bollinger / ADX fade exists (`git branch -r`, `research/edge`, the untested-backlog list of 14 Nov).

## Data (named before any result)
- Spot gold only: OANDA mid H1 XAU_USD `[[t, o, h, l, c], ...]` (UTC hour start), 2006-03-19 to 2026-11-13, the desk's research
  cache built through the site's candle proxy (kept out of git; `run.mjs` takes its path).
- OANDA mid M5 XAU_USD (same shape, from 2006-11-01), used only to order a stop and a target inside one H1 candle.
- No other market, no other data.

## Indicators (each from candles closed at or before the signal candle; computed on the file's consecutive candles)
- Bollinger(20, 2.0) on H1 closes: middle = SMA(20) of closes, bands = middle ± 2 x the POPULATION standard deviation of the
  same 20 closes.
- ATR(14), Wilder: true range against the previous candle's close, first value = mean of the first 14 TRs, then
  ATR = (13 x ATR + TR) / 14.
- ADX(14), Wilder: +DM / −DM, smoothed with Wilder's 14 sums alongside TR; DX = 100 x |+DI − −DI| / (+DI + −DI); ADX = first
  the mean of 14 DX values, then Wilder-smoothed.
- The first 200 candles of the file are warm-up only.

## Signal and trade (T1)
- Signal candle i: ADX(i) < 20 AND close(i) > upper band(i) → SELL; close(i) < lower band(i) → BUY.
- The next candle must start within 3 hours of the signal candle's start (else no trade: weekend / closure).
- Entry E = the next candle's open (market).
- Stop: SELL = high(i) + 0.5 x ATR(i); BUY = low(i) − 0.5 x ATR(i). 1R = r0 = |E − stop|. Every trade has this stop; a trade
  whose entry is already at or beyond its stop is skipped.
- Target = the middle band at the signal close (SMA20(i)), fixed at entry. Skipped when the target is less than 0.5R away from
  E in the trade's direction (or already passed).
- Time exit: at the close of the 12th H1 candle counted from the entry candle (the entry candle is the first).
- An open position meeting a closure (the next candle starts more than 6 hours after the previous one) exits at the first open
  after it (a gap past the stop fills there).
- Stop and target inside an H1 candle are ordered on its M5 candles: the first M5 candle that touches either decides; if one M5
  candle touches both, the STOP is taken; an M5 open beyond the stop fills at that open (gap). An hour with no M5 candles is
  read on the H1 candle, stop first.
- One position at a time per test: a signal candle that closes before the open position's exit candle has ended is skipped.
  Several closes outside the band in a row are each a signal; only those met while flat trade.

## The three tests
- **T1**: the rule above (ADX < 20, any hour). The primary test.
- **T2**: T1's rule with only signal candles starting 22:00 to 06:00 UTC (they close by 07:00 UTC; the Asian session).
- **T3**: T1's rule with ADX < 15.
Each is its own one-at-a-time stream.

## Costs
- $0.60 a round trip (spread + slippage, as `gold-squeeze` / `gold-hourly-shock`), in R = 0.60 / r0.
- Financing on BUYS only: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, `council/fills.mjs`: the demo
  broker's XAUUSD swap of 11 Nov 2026) x E / r0. A sell pays and earns nothing. The exit time is the end of the M5 candle that
  closed the trade (the H1 candle's end when read on H1).
- 2x costs: $1.20 and twice the financing.

## Windows (by entry time)
- In sample (IS): 2007-01-01 to 2016-12-31.
- Out of sample (OOS): 2017-01-01 to 2026-10-31. Trades entered after 31 Oct 2026 are not counted.

## Statistics and the pass bar
- Per test and window: n, gross and net R a trade, net at 2x costs, win %, total, worst drawdown, median stop in $, cost per
  trade in R and the cost share (mean cost R / mean gross R when gross is positive), by year, by side, exits.
- t = mean / standard error of the CALENDAR-MONTH SUMS of net R (months with a trade, by entry month).
- One-sided p from the normal tail of the OOS month t; Holm over the 3 tests.
- Placebo, 40 seeds (mulberry32, seeds 1-40), per test, OOS: the same signal candles as the rule, the same entry, the same stop
  distance and target distance, but the SIDE drawn at random (50/50) and the levels mirrored around the entry; same time exit,
  same costs, its own one-at-a-time stream. "Beats" = rule OOS net R a trade above the placebo seed's.
- **A test passes only with all of**: OOS net month-sum t ≥ 2 and Holm p ≤ 0.05; IS net R a trade of the same sign (> 0);
  OOS net R a trade at 2x costs > 0; OOS n ≥ 200; beats ≥ 38 of the 40 placebo seeds.
- The verdict is PASS if any test passes, else FAIL. Reported, never tested: OOS halves 2017-21 / 2022-26, years, sides.

## What would not change the verdict
No parameter (bands, ADX cut, stop buffer, target, hold, session) is tuned after this file is pushed. A near miss is reported
as a near miss.
