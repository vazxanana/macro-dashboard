# The Asia box met by London and New York (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

The owner reads price through boxes (a range from a low to a high, then a close outside it). The most common box a desk trader
looks at is the Asia session's range before London opens. `research/edge/grid7-wide-fade` found that fading the first structure
break has a before-cost tilt, and `research/edge/grid7-wide-sweeps` found that Asia sweeps did not beat the plain fade. This
study asks the box question directly, with every cell fixed below: when London or New York first takes price out of the Asia box,
does trading WITH the break, FADING it, trading a false break back, or trading the second break the other way make money before
costs in both decades, and does it beat a plain control?

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA` on the
  machine that runs it), loaded from 2004-01-01.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy.
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m (UTC buckets), 1d (17:00 New York), 1w.
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31** (142
  months), `grid7-wide-core`'s `FROM` / `SPLIT` / `TO` (imported). Month sums count every calendar month, an empty one as 0.
- Costs (after the fact only): `combo-grid-2`'s `COSTS` (imported), a round trip in price. **ASSUMED, not measured** for xag,
  nzdusd, usdcad, usdchf, eurjpy.

## The Asia box (one a weekday, UTC)

High and low of the 5-minute candles that START in [00:00, 07:00) UTC, Monday to Friday. A day with fewer than 60 of the 84
candles has no box. Height H = high minus low; H > 0 required. It is complete (known) at 07:00 UTC.

## The events (closed M15 candles only, candles that start 07:00 to 16:45 UTC, so every event is known by 17:00 UTC)

M15 ATR = `dom-trade-through`'s `atr14` on the M15 frame, read at the event candle. B = 0.1 x that ATR.

- **(a) the break, WITH it**: the first M15 candle whose CLOSE is beyond the box (above the high: up; below the low: down).
  Market entry WITH it at the next 5-minute open. Stop past the break candle's other extreme (its low for an up break) by B.
- **(b) the break, FADED**: the same candle, entry AGAINST it at the next 5-minute open. Stop past the break candle's extreme
  (its high for an up break) by B.
- **(c) a false break, traded back**: the first M15 candle that trades beyond the box by its wick (high above the box high, or
  low below the box low; if one candle does both, no event that day). If that candle or one of the next 2 closes back inside
  the box (close between the low and the high), the first such close is the event; entry back into the box (short after an
  upside probe) at the next 5-minute open. Stop past the extreme reached beyond the box from the probe candle through the
  close-back candle, by B. No close back inside within those 3 candles: no event.
- **(d) the second break, the other way**: after the first break (a) of direction d, the first later M15 candle (start by 16:45)
  whose close is beyond the box's OTHER side (-d). Market entry WITH it (side -d) at the next 5-minute open, stop past that
  candle's other extreme by B.

Every trade must have its stop on the losing side of the fill (the run throws otherwise); a fill at or past the stop and a risk
under the round-trip cost are no trades (same rule for every cell and every control).

## Exits (four; all trades are closed at 21:00 UTC that day at the latest)

1R, 2R, **box** (a target the box height H away from the fill, in the trade's direction), **21:00** (no target: close at the
close of the last 5-minute candle that ends at or before 21:00 UTC). Outcomes on 5-minute candles from the fill candle: a candle
that opens past the stop or a target fills at its open; a candle that holds both the stop and a target is the stop. R before
costs; after costs = R minus cost / risk.

## Splits

- **height**: H / the Daily ATR(14) of the last 17:00 New York daily candle closed by 07:00 UTC: under 0.3 / 0.3 to 0.6 / over 0.6.
- **MSNR call**: the Daily MSNR call (`council/eg-methods.mjs` `direction()` on the daily candles with weekly key levels;
  `grid7-wide-core`'s `dailyCalls`, imported) of the last daily candle closed by the event candle's close. agree = the call
  equals the trade's side; disagree = otherwise (no call counts as disagree).
- **session**: the event candle closes at or before 12:00 UTC = London; later = New York.

## Cells (44)

- 16 main cells: event (a, b, c, d) x exit (1R, 2R, box, 21:00), every split pooled.
- 28 split cells, 2R exit only: event (a, b, c, d) x (height under 0.3, 0.3-0.6, over 0.6, MSNR agree, MSNR disagree, London,
  New York).

## Controls

- For (b) and (c): the plain `grid7-wide-fade` M15 rule in the same hours: every M15 structure break (`grid7-wide-fade`'s
  `breaks`, 3 candles a side, imported) whose candle starts 07:00-16:45 UTC on a weekday with an Asia box, faded at the next
  5-minute open, stop past the break candle's extreme by B, the same exit (box = that day's Asia box height; the same 21:00 close).
  For a split cell the control trades are split by the same rule on their own data (session by their close, height by their
  day's box, MSNR by their side).
- For (a) and (d): a random-time M15 entry in the same direction and hours. For each event trade, one twin: a weekday with an
  Asia box drawn at random (seeded) from the same market and window (not the event's day), a random M15 candle of the same
  session (London: starts 07:00-11:45, New York: 12:00-16:45), the event's side, entry at the next 5-minute open, stop past that
  candle's other extreme by B, the same exit. The twin belongs to its event's cells.

## The bar (a cell passes with all of them)

1. n >= 300 in each window;
2. mean R > 0 and calendar-month-sum t >= 2 BEFORE costs in discovery AND in confirmation;
3. Holm-adjusted one-sided p < 0.05 over the 44 confirmation tests;
4. beats its control: Welch t (trade level) >= 2 in BOTH windows.

Verdict: PASS if one or more cells pass; FAIL if none; INCONCLUSIVE if fewer than 8 markets could be run. Reported beside, never
part of the bar: every cell, after-cost figures, per-market rows for any passing cell, the controls.

## Checks

- Cut test: events known by five cut dates, computed on candles cut there, equal those of the full run (no look-ahead).
- One run, no variants on these years. Tests: `tests/asia-box-london.test.mjs` (offline; pins RESULT.md to result.json).
