# The three-timeframe engulf chain, 2020 to now: pre-registration (23 Nov 2026)

Written and committed before any trade of this study is computed. Research only: nothing live changes, no desk rule is edited,
no proposal follows unless the owner asks. The Engulfing desk already records one reading of this method (`council/eg-methods.mjs`
`sopTrades3`, "Three-timeframe SOP" in CLAUDE.md). Its only earlier look was 60 days on five markets, in sample and before
costs: not evidence. This is the full 2020-now test, after costs.

## The rule (the desk's code, imported and not edited)
Per chain [zone timeframe, engulf timeframe, confirmation timeframe]: D1 / H4 / H1 (C1), H4 / H1 / M15 (C2), H1 / M15 / M5 (C3).
1. **Marking zone**: an engulf zone on the zone timeframe (an engulf = a candle closing beyond the high (buy) / low (sell) of the
   last candle of the other colour, at most 3 candles after it; the zone = that first candle, wick to wick), still alive.
2. **Engulf at the zone**: after price comes back into the marking zone, an engulf of the same side on the engulf timeframe whose
   zone touches the marking zone.
3. **Confirmation**: then an engulf of the same side on the confirmation timeframe whose zone touches the engulf's zone, within
   24 confirmation candles, both higher zones alive.
- **Entry**: a limit at 50 % of the confirmation engulf's zone, alive 24 confirmation candles, cancelled by a confirmation close
  through the far side of the engulf-timeframe zone. On the fill candle only the stop counts.
- **Stop**: past the far side of the ENGULF-timeframe zone (the second timeframe) by the desk's buffer ($0.30 on gold; the same
  share of price elsewhere). Every trade has a stop on the losing side (the code refuses any other).
- **Target**, two variants: (a) **2R** exactly; (b) **roadblock** = the near side of the nearest opposite engulf zone of the engulf
  timeframe standing ahead of the entry when the order is placed, if it is 1R or more away, else 2R (`target: 'zone'`).
- **Close-based cut** (the method's own exit, added in this study on top of the desk's stop): after the fill, at the close of each
  confirmation-timeframe candle, if that close is beyond the far side of the confirmation engulf's zone (a buy: below its low),
  the trade is closed at that close. The hard stop and the target are checked first inside each 5-minute candle (a candle that
  opens beyond the stop exits at its open). The trades are the desk code's own (fills and the one-position-at-a-time rule per
  chain and market, applied by the code on its stop / target path); the cut only ends a trade earlier, so the kept set never overlaps.
- Candles: OANDA mid 5m from the edgekit cache; M15 / H1 / H4 resampled on UTC boundaries; D1 = the cache's raw UTC days, folded
  over the weekend by the desk code (as on the desk). Closed candles only.
- **Markets**: all 18 of the cache: xau eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy xag gbpjpy eurgbp audjpy cadjpy
  euraud nas100 spx500 de40. The desk code sizes its stop buffer only for the markets it lists; for the eight it does not list
  (nzdusd usdchf eurjpy gbpjpy eurgbp audjpy cadjpy euraud) it would use gold's $0.30 in price units, so the code is called with
  the key `eurusd` for them (the same "share of price" buffer; it changes nothing else but labels).
- Costs: the round trips of `research/edge/combo-grid-2/run.mjs` `COSTS` (price units), taken off each trade in R of its own
  risk. Trades whose fill falls in a bad interval of `research/edge/data-quality/quality.json` are dropped.

## Windows and statistic
Fills from 2020-01-01 to the last candle (22 Nov 2026). Discovery 2020-01 to 2023-12 (48 months); confirmation 2024-01 to
2026-11. Mean R a trade after costs; t on calendar-month sums of R by FILL month, empty months counted as 0. Trades still open at
the last candle are not counted.

## Tests (six, pooled over the 18 markets; Holm over the six one-sided confirmation p values)
T1 C1 2R, T2 C1 roadblock, T3 C2 2R, T4 C2 roadblock, T5 C3 2R, T6 C3 roadblock (all with the cut).

A test **PASSES** only if all hold: discovery n >= 100, mean > 0, month t >= 2; confirmation n >= 50, mean > 0, month t >= 2,
Holm p < 0.05; confirmation mean > 0 at twice the cost. **FAIL**: discovery or confirmation mean <= 0, or negative at 2x cost.
**INCONCLUSIVE**: positive but a t bar or Holm missed, or n under the minimum. The study PASSES if any of the six passes (each
reported with its own verdict), else FAIL if every test fails, else INCONCLUSIVE.

Reported only, never a verdict: each market alone; buys and sells; before costs; how often the cut ends a trade; the desk's
reading WITHOUT the cut (the code's own R); the year table; the share of trades whose risk is within 30 of the market's pips
and the roadblock trades whose nearest opposite zone is 2R or more away (two points where the owner's notes differ from the
desk). No other chain, stop, target, filter or market set is tried after the result; a follow-up needs its own pre-registration
on other data. Never call a pass an edge beyond its n and t; a pass only earns a forward paper record.

## Where the owner's notes differ from the desk's code (recorded, not tested as rules)
- The notes' chains are D1 / H4 / H1, H1 / M15 / M5 and M15 / M5 / M1 (one step each, never M30); the desk's middle chain is
  H4 / H1 / M15 (also one step a timeframe). M1 is not in the cache; M15 / M5 / M1 is not tested.
- The notes also mark failed (EF) and two-candle (DOM) zones; the desk's marking zone is an engulf zone only.
- The notes want price to come back to the zone sideways (weakening), not with momentum, and the second engulf to close inside
  the zone; the desk has no such filter (touch only).
- The notes' stop is a cut on a close; a hard stop, if one is needed, sits beyond the main zone 20-30 pips from the entry, and the
  risk should not exceed 20-30 pips with at least 2R to the target. The desk's stop has no pip cap.
- The notes' targets are the roadblocks (the next lower-timeframe zones up to the opposite higher-timeframe zone), with partials;
  the desk takes one target. A roadblock nearer than 2R would make the notes skip the trade; the desk falls back to 2R.
- Zone life: the notes keep a zone until a body closes through it (and avoid zones used about three times); the desk ends a
  zone after a fixed number of candles as well.
