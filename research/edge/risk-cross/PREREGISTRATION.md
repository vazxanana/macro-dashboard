# Pre-registration: AUD/JPY and NZD/JPY held only while US equities are in a calm uptrend (14 Nov 2026)

Written and pushed before any trade of this study was computed. Nothing below may change after the first run; anything
looked at later is reported as "not pre-registered".

## The idea

Published idea: "risk-on" carry crosses (AUD/JPY, NZD/JPY) earn while equity risk appetite is high and crash when it ends.
So hold the cross long only while the S&P 500 is in an uptrend and calm, and be flat otherwise. Not the same question as
#859 (S&P sessions spilling into the yen overnight), #828 (time-series momentum on 20 markets) or #869 (G10 cross-sectional
momentum): here the cross's own price never decides the position; the equity regime does.

## Data (no network)

council-data `research/daily/audjpy.json`, `nzdjpy.json`, `spx500.json` (OANDA mid, complete UTC daily candles, `[t, o, h, l,
c, v]`), read with `git show origin/council-data:…` (branch at a70613a7c, last candle 6 Nov 2026). Each series is passed through
`council/fills.mjs` `foldWeekend` (the Sunday 22:00 UTC stub and any Saturday candle are folded into the next weekday), so a
"day" below is one folded weekday candle.

## Signal (S&P 500 regime, at each daily close)

On the SPX500 folded closes, for day d (using day d and earlier only):
- `sma200` = simple mean of the last 200 closes; `up` = close > sma200.
- `rv20` = sample standard deviation of the last 20 close-to-close log returns.
- `calm` = rv20 < the median of the last 252 rv20 values (today's included).
- **T1 / T2 signal** = up AND calm. **T3 signal** = up only.

A cross's day d reads the SPX state of the latest SPX day whose time is ≤ d's time (both are UTC days ending 24:00 UTC, so
the S&P close is known before the cross's next open). Days without enough history have signal off.

## Position

- **Entry**: when the signal turns on (off on day d−1, on on day d) and no position is open, buy at the OPEN of day d+1.
- **Exit**: when the signal is off at the close of day x−1, sell at the OPEN of day x.
- **Stop (every position has one)**: r0 = 3 × ATR(20) of the cross, ATR = simple mean of the last 20 true ranges ending at
  the signal day d (true range uses the previous close). Stop = entry − r0, fixed (never moved). Checked on every held day
  from the entry day on: if a day opens at or below the stop, filled at that open (gap fill); else if its low reaches the
  stop, filled at the stop. If a day both opens below the stop and is a signal-exit day, it is a stop at the open (same price).
- **After a stop**: flat until the signal has turned off and on again (a new off-to-on change), then the entry rule applies.
- One position at a time per test. A position still open at the last candle is closed at its close and flagged `open`.
- **R** gross = (exit − entry) / r0, one unit, no sizing.

Tests: **T1** AUD/JPY with the full signal; **T2** NZD/JPY with the full signal; **T3** AUD/JPY with the trend-only signal.

## Costs (price units, yen per unit of the cross)

- Spread: 0.3 pip (0.003) once per round trip. Slippage: 0.5 pip (0.005) a side, stop fills included (0.010 a round trip).
- Commission: 22.5 USD per million of notional a side = 22.5e-6 × price a side, so 22.5e-6 × (entry + exit) a round trip.
- **Financing**: council-data `ctrader/symbols.json` lists no AUDJPY or NZDJPY (only XAUUSD, five USD majors, crypto and
  indices), so no broker swap is known. Two columns are reported: **zero carry**, and a **flat charge of 0.004 % of the entry
  price a night** on the long, nights counted by `council/fills.mjs` `nights` (22:00 UTC weekday rollovers, Wednesday counts
  three), from the entry day's start to the exit day's start (a stop exit: to the end of the stop day, which can only charge
  more). Historically these longs earned carry; the charge is a deliberately costlier assumption. **The verdict is decided on
  the costlier column (the charge).**

## Windows

Positions belong to the window of their entry day. **Decisive: 2016-01-01 to the last candle. Replication: 2008-01-01 to
2015-12-31.** The replication window contains the 2008 crash (AUD/JPY lost about 40 % from July to October 2008) and is
exactly the event the idea claims to step aside from; it is reported as such. Positions entered before 2008 are not counted.

## Statistics

- Per test and window: n positions, mean net R a position, win rate, total net R, worst drawdown of closed net R.
- **t on calendar-month sums**: positions' net R summed by the calendar month of their exit, every month from the window's
  first month to the later of the window's last month and the last exit month (months without an exit count as 0);
  t = mean / (sd / √months). One-sided p = 1 − Φ(t) (normal).
- **Time in market** = days held / days in the window (a day is held from the entry day to the day before a signal exit, or
  to the stop day included).
- **Sharpe of the daily equity curve**: daily R of the window's positions marked to the close (entry day: close − entry;
  then close − previous close; signal exit day: exit − previous close; stop day: fill − previous close; all / r0), the
  spread / slippage / commission charged half on the entry day and half on the exit day, financing on the exit day; every
  day of the window counts (0 when flat); mean / sd × √252.

## Placebo (40 seeds, decisive window, costlier column, per test)

For seed s = 1..40 (mulberry32): the test's K decisive positions and their realised held days d_i (summing to D). Shuffle the
d_i; split the N − D other days of the window into K + 1 gaps uniformly at random (stars and bars), the K − 1 inner gaps at
least 1 day; so K intervals with exactly the same count and the same total time in market as the real record. Each interval
is a long entered at the open of its first day, exited at the open of the day after its last (the last close if past the
data), with the same 3 × ATR(20) stop (ATR to the day before entry), the same gap fill and the same costs and charge. The
placebo statistic is the mean net R a position; its 95th percentile is the 38th of the 40 sorted values.

## Pass bar (all on the costlier column)

A test passes only when all hold:
1. decisive mean net R a position > 0 and monthly-sum t ≥ 2;
2. Holm over the three tests: adjusted one-sided p < 0.05;
3. replication 2008-15 mean net R a position > 0 (same sign);
4. decisive mean net R a position above the placebo's 95th percentile;
5. at least 20 decisive positions (fewer: INCONCLUSIVE for that test, never PASS).

**Verdict**: PASS if T1 or T2 passes (the risk-on idea); T3 passing alone is reported as "trend only", not the idea. FAIL if
no test passes. Paper research only: it changes no rule, trade, size, stop or council member. A pass becomes at most a
proposal under `research/proposals/` for the owner.
