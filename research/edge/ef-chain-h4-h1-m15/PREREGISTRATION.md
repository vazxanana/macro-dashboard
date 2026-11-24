# A chain of failed engulfs: H4 fails, H1 fails, M15 engulfs (pre-registration, 24 Nov 2026)

Written and committed alone BEFORE any run on real candles. Research only: nothing live reads it, nothing is placed, no rule
is proposed. One run, no variants.

## Why

A reading of engulf zones says a zone that fails (a close through its far side) becomes a level for the other side, and that
the same thing repeating one timeframe lower, when price comes back to that level, is the sign the level holds. The chain
tested here: an H4 engulf zone fails; on price's return an H1 engulf zone of the OLD side fails too; then an M15 engulf WITH
the new side completes, and that close is the entry.

**Already tested, and how this differs.** `eg-ef-choch-ladder` (FAIL, 0 of 56) ran an H4 zone (engulf or failed engulf,
pooled) with an H1 turn (ChoCh or failed engulf) and an M15 trigger that was a ChoCh or a FAILED M15 engulf, with the stop
past the extreme made in the H4 zone. `h4-ef-to-eg` (FAIL) took a failed H4 zone with an M15 structure break and a limit at
the zone. `grid7-ltf-ef` (FAIL) took the failed engulf alone, `grid7-wide-eg-chain` (FAIL) an engulf on every step. None used
the three-step chain "H4 fails, H1 fails, M15 ENGULF completes" with the tight stop past the M15 engulf's own zone. That is
the untested variation run here: the higher zone is ONLY a failed H4 zone, the middle step ONLY a failed H1 zone, the trigger
a COMPLETED M15 engulf with the new side, the stop past that M15 zone.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `EDGE_DATA`; read only, no network),
  loaded from 2004-01-01 (warm-up) to 2026-10-31.
- Markets (5): xau, eurusd, gbpusd, usdjpy, audusd (gold starts where the cache starts, March 2006).
- M15, H1, H4: UTC buckets of the 5-minute candles (`edgekit.resample`, 900 / 3600 / 14400 s).
- Exclusions: `combo-grid-2` `exclusions(market)` (the data-quality audit's bad intervals); a trade whose fill falls in one
  is dropped.
- Windows by the FILL time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.
- Costs: `combo-grid-2` `COSTS` (round trip in price units, the demo account's figures for these five markets), the same for
  every year: after costs = R - cost / risk.

## The rule (closed candles only). A BUY is described; a sell mirrors it exactly.

Engulf zones on every timeframe are `council/eg-methods.mjs` `zones(C, tf)`, imported unchanged (the desk's one definition,
`engulfAt`: the base is the last candle of the other colour; the 1st, 2nd or 3rd candle after it that closes beyond its high
(buy) / low (sell) completes the engulf; the zone is the base candle wick to wick, known at the completing candle's close
`at`; `fail` = the close time of the first candle that closes through the zone's far side within the desk's zone life).

1. **The level (H4 failed engulf).** An H4 SELL engulf zone that failed: an H4 candle closed above its top (`fail`). From that
   close the box [bottom, top] is a level for buys. It serves for 20 days from `fail`, or until an H4 candle closes back below
   its bottom (`turnBack`, imported), whichever is first.
2. **The return.** The first H1 candle k that starts at or after `fail` and trades into the box (low <= top and high >=
   bottom), starting before the level stops serving. Only this first return counts (one setup per level and variant).
3. **The H1 failure.** An H1 SELL engulf zone (the old side) whose completing candle is no earlier than 24 H1 candles before
   k, and which FAILS (an H1 close above its top) on a candle from k to k + 23 (k included), that close no later than the
   level's end of service. The first such failure in time is taken (of two on one candle, the zone completed later). An H1
   close below the level's bottom on a candle from k up to the failure candle ends the setup with no trade. Two variants:
   - **at**: the H1 zone's box must overlap the level's box (its bottom <= the level's top and its top >= the level's bottom);
   - **any**: no condition on where the H1 zone sits.
4. **The trigger.** The first M15 BUY engulf whose completing candle starts at or after the H1 failure's close and closes no
   later than 24 M15 candles (6 hours) after it, and before the level stops serving. An M15 close below the level's bottom on
   a candle from the H1 failure's close up to and including the completing candle ends the setup with no trade.
5. **Entry.** Market at the open of the first 5-minute candle starting at or after the M15 completing close; if no 5-minute
   candle starts within 1 hour of that close (a weekend or a hole), no trade.
6. **Stop.** Below the M15 engulf zone's bottom (the base candle's low) by 0.1 x ATR(14) of M15 (the mean true range of the 14
   M15 candles ending with the completing candle). Risk = fill - stop. A fill at or past the stop is no trade; a risk under the
   market's round-trip cost is no trade (the same for every cell and for the mirror).
7. **Exits** (three): a target at **1R**; at **2R**; or **opp** = the bottom (near side) of the NEAREST H4 SELL engulf zone
   standing at the M15 completing close (completed by then, not failed, inside its life) whose bottom is above the fill, only
   when it is 1R or more away (if the nearest is nearer than 1R, or there is none, that trade is not in the opp cells; a
   farther zone is never taken instead). Also: the stop; the close of the 5-minute candle that reaches 3 days after the fill.
   The engine is `edgekit.simulate` (a 5-minute candle that opens past the stop or the target exits at its open; one that holds
   both is a stop). A trade not resolved at the end of the data is left out.
8. **One trade** per (market, M15 completing candle, side) within a cell.

## Cells (6, all fixed here)

H1 failure variant {at, any} x exit {1R, 2R, opp}, the five markets pooled.

## The pass bar

A cell passes only if ALL hold: n >= 300 in discovery and in confirmation; mean R AFTER costs > 0 in both windows; the t of
the calendar-month sums of after-cost R >= 2 in both windows; Holm-adjusted p < 0.05 over the 6 cells' one-sided confirmation
p values (after-cost month t, months - 1 degrees of freedom). Verdict: PASS if any cell passes; INCONCLUSIVE if no cell
reaches n >= 300 in both windows; else FAIL.

## Reported (no verdict from these)

- Every cell: n, R before costs and after costs with their month t, win rate, mean cost in R, both windows.
- Every cell per market.
- A mirror control: the same fill traded the OTHER way with the same stop distance and the same targets in R (for opp, the
  same distance), same cost.
- Counts down the chain (levels, returns, H1 failures, triggers, trades, dropped).
- A cut test on gold: the trades' signals known by five dates, computed on candles cut there, must equal the full run's.

## What is not claimed

A pass would be a result on mid candles with flat costs, not an edge; a fail closes this chain on these years. No variant
(other timeframes, windows, stops or targets) will be run on these years after the result.
