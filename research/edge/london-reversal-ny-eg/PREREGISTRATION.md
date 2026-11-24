# London reversal day, New York pullback into an H1 engulf zone (pre-registration, 24 Nov 2026)

Written and committed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

Two earlier studies sit next to this combination and neither tests it. `research/edge/asia-box-london` entered at the M15 close
out of the Asia box (with it, against it, the failed break, the second break) at market and failed (0 of 44 cells; the fade of
the box close-out was positive before costs only). `research/edge/evening-methods` asked whether ten method readings do better
in the evening hours. Neither waits for the London session to FINISH as a reversal day and then buys or sells a pullback in New
York with a resting limit at an hourly engulf zone. Other neighbours (`fx-asia-london-reversal`, `gold-london-reversal`,
`session-sweep`, `grid6-session-range`) trade the sweep itself, not the later pullback. So the assigned combination is untested
and is run as assigned.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs` `load`), loaded from 2004-12-01 for warm-up,
  to 2026-11-01. No network.
- Markets (5): xau, eurusd, gbpusd, usdjpy, audusd (gold from where its history starts). One market at a time.
- H1 candles: the 5-minute candles in UTC hour buckets (`edgekit` `resample`).
- Exclusions: `combo-grid-2` `exclusions(market)` (imported); a day whose 12:00 UTC falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.
- Costs: `edgekit` `COSTS` (round trip, price units; the demo figures), charged as cost / risk on every trade.

## The day (UTC weekdays, Monday to Friday; closed candles only)

- **Asia range**: the highest high and lowest low of the 5-minute candles that START 00:00 to 06:55 UTC; at least 60 of the 84
  candles must exist. Its middle = (high + low) / 2.
- **London**: the 5-minute candles that START 07:00 to 11:55 UTC; at least 48 of the 60 must exist. London's close = the close
  of the last of them (known at 12:00 UTC).
- **Reversal down so far**: London's high is above the Asia high (the high was swept) and London's close is below the level.
  **Reversal up so far**: London's low is below the Asia low and London's close is above the level. Level, two readings:
  - **mid**: the Asia middle.
  - **other**: the Asia range's other side (the low for a reversal down, the high for a reversal up). Every `other` day is also
    a `mid` day.
  A day is one direction at most (the close is on one side of the middle). The day's direction D is known at 12:00 UTC.

## The zone

`council/eg-methods.mjs` `zones(H1, '1h')` (imported, never edited; its default engulf: a candle closing beyond the high / low of
the last opposite-colour candle within three candles; the zone is that base candle wick to wick, known from the close of the
completing candle). Only its `dir`, `top`, `bot`, `at` and `i` are read (its own `touch` / `fail` fields are not: they are
stamped with an hourly candle's start). Eligible zones of the day: direction D, known (`at`) from 08:00 UTC of the day on, so
made by the day's own London or New York candles. Two zone sets:
- **lon**: known by 12:00 UTC (London's zones only).
- **any**: known before 16:00 UTC (a zone completed in New York counts from its `at`).

A zone is alive from `at` until the first 5-minute candle starting at or after `at` trades to its near edge (a buy zone: low at
or below the top; a sell zone: high at or above the bottom). A zone first touched before 12:00 UTC is spent (not the first
pullback of New York).

## The trade

- From 12:00 UTC a limit rests at the near edge of every alive eligible zone (a zone of the `any` set from its `at`). The FIRST
  5-minute candle starting 12:00 to 15:55 UTC that trades to a near edge fills the day's one trade (two zones in one candle: the
  edge reached first, the higher top for a buy, the lower bottom for a sell). Fill at the edge, or at the candle's open when
  it opens beyond the edge. No fill by 16:00 UTC = no trade. One trade a market a day per zone set.
- **Stop**: beyond the zone's far edge by 0.1 x ATR(14) of the H1 candles as of the zone's completing candle (simple mean of the
  true range of the 14 H1 candles ending at it). Always on the losing side. Risk = entry edge to stop; a trade whose risk is
  under the round-trip cost is not taken (counted).
- **Targets**: 1R and 2R (two exits of the same entry). On the fill candle only the stop counts; a candle holding stop and
  target is a stop; a candle opening beyond the stop or the target exits at its open.
- **Time**: out at the close of the 5-minute candle that ends at 20:00 UTC (the first closing at or after it).
- The engine is `edgekit` `simulate` (limit order), one call per target.

## Cells (8, all fixed)

level {mid, other} x zone set {lon, any} x target {1R, 2R}.

## Pass bar

A cell passes when, in BOTH windows, n >= 300 and the mean R AFTER costs is above zero with a t of calendar-month sums of the
after-cost R of at least 2, and its Holm-adjusted one-sided p (month t, after costs, confirmation window, over the 8 cells) is
under 0.05. Verdict: **PASS** if any cell passes; **INCONCLUSIVE** if no cell has n >= 300 in both windows; else **FAIL**.
One run, no variants.

## Reported

- Every cell, both windows: n, win rate, mean R before costs and after costs, month t before and after costs, mean cost in R,
  Holm p.
- By market for the best cell (context only).
- Beside, not part of the bar: the SAME limit rule on every weekday with no London condition (both directions, same zone sets
  and targets), and the difference reversal-day minus that, Welch t per trade (which counts trades as independent and can
  overstate).
- Counts: days read, reversal days per level, days with an eligible zone, fills, trades skipped for small risk, days excluded.
- A cut check: the day classifications, zones and orders computed on candles cut at five dates equal the full run's up to each
  date.
