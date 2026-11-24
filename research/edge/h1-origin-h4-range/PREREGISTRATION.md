# An H1 break-origin zone, split by its place in the H4 dealing range (pre-registration, 24 Nov 2026)

Written and committed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

A common reading says a "barrier" (the last opposite candle before a structure break) is worth buying only when it sits in the
lower half of the larger range (discount) and worth selling only in the upper half (premium). The nearest studies here:
`mosha-barrier-wide` (the desk's barrier boxes with a lower-timeframe confirmation and MARKET fills, split by the structure of
the timeframe above: FAIL, 0 of 36), `mosha-barrier-6r`, `smc-ob-fvg` and `gold-premium-discount` (a 20-day range on daily gold:
FAIL). None split a break-origin zone by its place in the H4 swing range, and none took the plain first return with a resting
limit. That is this study: 4 cells, all fixed below.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs` `load`), read from 2004-01-01 for warm-up.
- Markets (5, pooled): xau, eurusd, gbpusd, usdjpy, audusd.
- H1 and H4 candles grouped from the 5-minute ones in UTC buckets (`resample`); a candle is used only once its bucket has ended.
- Exclusions: `combo-grid-2`'s `exclusions(market)`; an order whose fill falls in a bad interval is dropped.
- Windows by FILL time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31** (142
  months). Month sums count every calendar month of the window, an empty month as 0 (gold's candles start in March 2006).

## The zone

1. **Break**: on closed H1 candles, `edgekit` `structure(H1, 3)`: a close above the last confirmed swing high (3 candles a side)
   not yet broken is a break up; a close below the last confirmed swing low is a break down. Every break counts (with or
   against the side held before).
2. **Origin candle**: for a break up at H1 candle j, the most recent H1 candle before j (searching back from j-1, at most 20
   candles) that closed below its open. For a break down, the most recent one that closed above its open. None in 20: no zone.
3. **Zone** = that candle, wick to wick (low to high). A break up gives a BUY zone, a break down a SELL zone. The zone must lie
   wholly on the losing side of the break candle's close (buy: zone high below the close; sell: zone low above it), else no zone.

## The order (first return only)

- A resting **limit at the near edge** (buy: the zone's high; sell: the zone's low), placed at the close of the break candle,
  alive for 5 days (120 hours) from then. One order a break; it fills once or never (first return only).
- **Stop**: past the far edge by 0.1 x ATR(14) of H1 (simple mean of the true range of the 14 H1 candles ending at j). The
  stop is always on the losing side of the entry (the run throws otherwise).
- Risk (entry to stop) under 2 x the market's round-trip cost: no order.
- **Fill and exits** on 5-minute candles with `edgekit` `simulate` (limit): the first 5-minute candle starting at or after the
  order time that trades to the entry fills it (at its open when it opens past the entry); on the fill candle only the stop
  counts; afterwards a candle that opens past the stop or target exits at its open, a candle that holds both is a STOP; the
  trade ends at the close of the candle that reaches 5 days after the fill. Targets **1R** and **2R** from the fill.
- Costs: `combo-grid-2` `COSTS` (round trip, price units, the demo account's figures for all five markets), charged as
  cost / risk on every filled trade. R is reported before and after costs.

## The split: where the zone sits in the H4 dealing range

At the order time, on H4 candles closed by then: the most recently confirmed H4 swing high and the most recently confirmed H4
swing low (`edgekit` `swings(H4, 3)`, each known only after its third later candle closed). Dealing range = from that low to
that high; its middle = (high + low) / 2. The order is classed by its ENTRY price:

- **aligned**: a buy whose entry is in the lower half (at or above the range low, below the middle), or a sell whose entry is in
  the upper half (above the middle, at or below the range high);
- **opposite**: a buy in the upper half or a sell in the lower half;
- entry outside the range (above the high or below the low), entry exactly at the middle, or no valid range (no two swings yet,
  or the swing high not above the swing low): the order is in neither class (counted and reported as "outside").

## Cells (4)

| cell | placement | target |
|---|---|---|
| aligned 1R | aligned | 1R |
| aligned 2R | aligned | 2R |
| opposite 1R | opposite | 1R |
| opposite 2R | opposite | 2R |

## Pass bar

A cell passes with: n >= 300 filled trades in EACH window, mean R AFTER costs > 0 and t of the calendar-month sums of R after
costs >= 2 in BOTH windows, and a Holm-adjusted p < 0.05 over the 4 cells in confirmation (p two-sided from the month t with
months - 1 degrees of freedom; a cell with mean <= 0 gets p = 1). Verdict: PASS if any cell passes; INCONCLUSIVE if no cell
has 300 trades in both windows; else FAIL.

## Reported (no verdict)

- For every cell and window: n, win rate, mean R before costs and after, month t of each.
- Aligned minus opposite, per target and window: difference of mean R after costs and its Welch t on trades (the hypothesis
  itself; it changes no verdict).
- Per market, the four cells' confirmation n and mean R after costs.
- Counts: breaks, zones, orders, fills, "outside", dropped by the exclusions.
- A cut test: the orders made from candles cut at several moments equal the full run's orders up to each moment.

## Limits said in advance

- Mid candles: a limit is counted as filled when price TOUCHES it, which flatters a limit entry (`dom-trade-through`); the real
  result is at best what is reported here.
- Today's demo costs are charged for every year.
- One run, no variants. Whatever the result, no other swing size, zone definition, range or target is tried on these years.
