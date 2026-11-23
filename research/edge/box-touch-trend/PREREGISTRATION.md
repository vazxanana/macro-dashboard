# Box-edge touch with the H1 trend: pre-registration (23 Nov 2026)

Written and committed before any trade of this rule is computed and before any candle of a test window is read for it.
Research only: nothing live changes, no proposal follows unless the owner asks. The rule was shaped by the owner on gold
candles of 20 Nov 2026, so 2020-now is not untouched for its idea; 2010-2019 is the replication it must also pass.

## The rule (written once, not tuned)
- **Box** (`edgekit.boxesHL(bars, 3)`, closed candles only): the range between a confirmed swing low and a confirmed swing high
  (3 candles a side). It is KNOWN at the close of the candle that confirms the later of the two swings (`s`) and lives until a
  candle CLOSES above its high or below its low (`bi`). Boxes chain as the toolkit chains them. Nothing about a box's end is
  used before that end candle has closed.
- **Side**: the H1 trend = the side of the last H1 break (BO or ChoCh) of `edgekit.structure(H1, 3)` on H1 candles (resampled
  from 5m, UTC hours) CLOSED at the moment of the fill. No side (0) = no trade.
- **Order**: when a box becomes known, if the H1 side is up, a buy limit rests at the box LOW; if down, a sell limit at the
  box HIGH (only the edge in the trend's direction). Placed only if the last close is inside the box. It is cancelled at the
  close of the candle that ends the box, or 24 hours after it was placed, whichever comes first; the H1 side is checked again at
  the fill and a fill whose side has turned is not taken. First touch only: one order per box.
- **Stop**: beyond the touched edge by 0.20 x the box height (one distance, fixed now). **Target**: the opposite edge of the
  box (the next high / low), so a full target is 5R before costs. **Time exit**: 24 hours after the fill, at that candle's close.
- **Size filter**: no order when the stop distance is under 4 x the market's round-trip cost (`edgekit.COSTS`), so cost is at
  most 0.25R at the stop.
- **Fills and exits** by `edgekit.simulate` on 5m candles (type limit; on the fill candle only the stop counts; a gap past the
  stop exits at the open). One open position at a time per market and test, in order of fill time.
- **Markets**: xau, eurusd, gbpusd, usdjpy, audusd (the toolkit cache, OANDA mid). **Timeframes**: boxes on M15 (primary) and
  on M5 (a separate test), both built from the 5m cache (`resample`, UTC-aligned).

## Data windows
- In sample 2020-01-01 to 2023-12-31; out of sample 2024-01-01 to 2026-11-13 (entries; the week of 16-22 Nov 2026, in which the
  rule was shaped, is left out of every window). Replication 2010-01-01 to 2019-12-31 (untouched by this rule).
- Costs: `edgekit.COSTS` round trip per trade, taken off in R of each trade's own risk; a second run at 2 x costs.

## Tests (Holm over the three out-of-sample p values)
1. **T1 (primary)**: M15 boxes, five markets pooled.
2. **T2**: M5 boxes, five markets pooled.
3. **T3**: M15 boxes, gold alone (the market the rule was shaped on).
Reported only, no verdict: each market alone, buys and sells apart, before costs, exits by reason, the year table.

## Statistic and pass bar
Mean R a trade after costs; t on calendar-month sums of R (by exit month), Holm-adjusted p from that t. A test **PASSES** only
if all hold: OOS mean > 0; OOS month t >= 2 and Holm p < 0.05; IS mean > 0; OOS mean > 0 at 2 x costs; at least 30 OOS trades;
AND on 2010-2019 mean > 0 with month t >= 2 at 1 x costs.
- **FAIL**: OOS mean <= 0, or IS mean <= 0, or negative at 2 x costs, or 2010-2019 mean <= 0.
- **INCONCLUSIVE**: positive everywhere but a t bar or Holm missed, or fewer than 30 OOS trades, or 2020-now passes while
  2010-2019 is positive with month t under 2.
The study's verdict is PASS if T1 passes, FAIL if T1 fails; T2 and T3 are reported with their own verdicts and cannot rescue
T1. No other stop distance, target, swing size, timeframe or filter is tried after the result; a follow-up needs its own
pre-registration on other data. Never call a pass an edge beyond its n and t; a pass only earns a forward paper record.

## What earlier work says (why this design)
A Daily-zone + H4-box rule failed on 2010-19 because its target was close (median 0.35R) (`box-zone`); box breakouts and
fades on gold failed (`gold-box-breakout`, `gold-box-fade`); lower-timeframe structure as a permission did not pick better
trades (`ltf-structure`). So the target here is the far edge (5R) and the direction is one condition only (the H1 side).
