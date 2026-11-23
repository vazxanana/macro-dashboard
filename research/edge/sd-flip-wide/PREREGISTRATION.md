# The flip: a broken supply / demand or engulf zone traded the other way (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

A common reading of key levels: a supply zone that price closes through becomes demand, a demand zone closed through becomes
supply, and an engulf zone closed through (a failed engulf) serves the other side. The day's wide grids (`grid7-wide-core`)
tested failed engulf zones only as one family among six, on their whole life; this study asks the flip question directly, on
the FIRST return to the flipped zone, with two controls that say whether the flip adds anything: the same zones touched
before any break (traded with their own side), and a random band at a matched distance. Design of `grid7-wide-core`: few
cells fixed below, ten markets, discovery 2005-2014, confirmation 2015 to the end of October 2026.

## Data

- OANDA mid 5-minute candles, the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA` on the
  machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (gold and silver from where OANDA's
  5-minute history starts).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): 15m, 1h, 4h (UTC buckets), 1d (17:00 New
  York trading days), 1w.
- Exclusions: `combo-grid-2`'s `exclusions(market)` (the data-quality audit's bad intervals); a trade whose fill falls in one is
  dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31** (142
  months). Month sums count every calendar month of the window, an empty month as 0.

## Zones (zone timeframe L = 1d or 4h, closed candles only)

- **sd**: fresh supply / demand, `grid5-sd-eg`'s `sdZones(L)` (imported): the base candle at the origin of a structure break.
- **eg**: engulf zone, `combo-grid-3`'s `egZones(L, 3)` (imported; `council/eg-methods.mjs` `engulfAt` with a 3-candle span),
  the base candle wick to wick.

**The flip.** A zone of side d whose far side is closed through by an L candle (index fi; `sdZones`' `dead`, `egZones`' `fi`;
within the zone's 120-candle life) becomes a zone of side s = -d over the same price range, known at the close of candle fi.
The flipped zone ends at the first later L close back through its own far side (for a flipped supply: an L close above the
top), or 120 L candles after fi.

**First return.** On the trigger timeframe T (two steps under L: 1d -> 1h, 4h -> 15m), the first T candle starting at or after
the close of fi that trades back into the range from the side it was broken to (a flipped supply: high >= bottom; a flipped
demand: low <= top), starting before the flipped zone's end. Only that visit counts.

**Split variables** (all known at the return):
- **dist**: how far price went beyond the broken edge between the break candle (inclusive) and the return candle (exclusive),
  in ATR(14) of L at fi: under 1 (`near`) or at least 1 (`far`).
- **body**: the break candle's body |close - open| in ATR(14) of L at fi: under 1 (`small`) or at least 1 (`big`).
- **msnr**: the Daily MSNR call (`council/eg-methods.mjs` `direction()` on the 1d candles with the 1w as the timeframe above,
  as `grid7-wide-core`'s `dailyCalls`, imported) of the last 1d candle closed at the trigger candle's close equal to the side.

## Entries (on T, within the 24 T candles from the return candle inclusive, closing before the zone's end)

- **(a) close**: the first T candle that closes inside [bottom, top].
- **(b) break**: the first structure break of the flipped side (`edgekit.structure(T, 2)`, BO or ChoCh: a close beyond the
  last confirmed 2-a-side swing in the side's direction).

Market entry at the open of the first 5-minute candle starting at or after the trigger candle's close.

## Trade

- Stop: past the zone's far side by 0.1 x ATR(14) of L at fi (flipped supply: top + 0.1 ATR; flipped demand: bottom - 0.1 ATR).
- Every trade has its stop on the losing side of the fill; a fill at or past the stop is no trade; a trade whose risk is under
  the market's round trip is no trade (every stream alike).
- Exits: a target at **1R** or **2R**, the stop, or the close of the 5-minute candle reaching the time limit (2 days for 1d
  zones, 1 day for 4h zones); a candle opening past the stop or the target exits at its open; a candle holding both is a stop
  (`grid7-wide-core`'s `exits`, imported).
- R before costs; after costs R - round trip / risk with `combo-grid-2`'s `COSTS` (demo figures for xau, eurusd, gbpusd,
  usdjpy, audusd; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).

## Cells (56, fixed)

Per L (1d, 4h) x entry (close, break) x exit (1R, 2R) = 8 combinations, each with seven groups:

1. `sd all`, 2. `eg all` (each family alone, every flip);
3. `both near`, 4. `both far` (dist split), 5. `both small`, 6. `both big` (body split), 7. `both msnr` (the call agrees).

"both" pools the two families; a trade (same L, entry, trigger candle, side) met through both families counts once, with the
split values of the sd zone when both give it (sd is read first). Each cell pools the ten markets.

## Controls (same L, entry, exit)

- **Unbroken**: every sd / eg zone's ordinary first touch (the first T candle from the zone's known time that trades into it,
  before any close through it), traded with the zone's OWN side, the same entries, stop past its far side + 0.1 ATR(14) of L at
  the zone's known time, same exits. The control of a cell takes the cell's family (both = pooled, deduplicated the same way)
  and, for the msnr group, the trades where the call agrees with its side; the dist and body groups use the whole unbroken set.
- **Random band**: for each flip, a band of the same width on the same side of price as the flipped zone, its near edge at
  u x D from the flip candle's close, where D = the distance from that close to the flipped zone's near edge and u is uniform on
  [0.5, 2.0] (seeded from market, family, L and fi; it may overlap the real zone). It is traded exactly as the flipped zone
  (side s, first return, same entries, stop past the band's far side + 0.1 ATR, same exits, same end rule) and carries the
  flip's dist / body / msnr values, so every cell has its own random control.

## The bar (judged BEFORE costs; after-cost figures beside)

A cell passes only if ALL hold:

1. n >= 300 in discovery AND in confirmation;
2. mean R > 0 and month-sum t >= 2 in discovery AND in confirmation;
3. Holm over the 56 confirmation tests (one-sided p of the confirmation month-sum t, df = months - 1): adjusted p < 0.05;
4. it beats BOTH controls: Welch t (trade R of the cell against trade R of the control) >= 2 in discovery AND confirmation,
   against the unbroken control and against the random band.

**Verdict**: PASS if at least one cell passes; FAIL if none does; INCONCLUSIVE if no cell reaches n >= 300 in both windows.
Nothing is adopted from a pass: it would be a candidate for its own forward record and an owner decision.

## Also reported

- Every cell: n, mean R, month t in both windows, before and after costs; both controls' figures and the two Welch t.
- The **side-flipped placebo** of every cell (same fill, the other side, stop at the same distance, same exits), judged by bars 1-3.
- Per-market rows for any passing cell.
- A cut test: signals of several markets computed on candles cut at a date equal the full run's signals known by that date.
- One run, no variants. Do not re-test variants of these cells on these years.
