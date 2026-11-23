# The failed engulf (EF) on the lower timeframes, on ten markets (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/grid7-wide-fade` found that fading the first structure break at market has a small tilt before costs in both
2005-14 and 2015-26 on ten markets (for example M15, stop past the break candle, 2R: +0.094R / +0.054R a trade, month t 11.4 /
12.2), far smaller than the round trip. The desks read a related idea on the lower timeframes: an engulf (EG) zone that is
closed through on its far side (it FAILED, an EF) gives a trade the other way. This study asks whether that failed engulf, on
its own and soon after the engulf formed, does better before costs than the plain fade of a structure break on the same
timeframe and exit, in both decades. Every cell is fixed below; nothing is picked from an earlier run.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA` on the
  machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (gold and silver from where OANDA's
  history starts). The list, windows, month counting and costs are `grid7-wide-core`'s (imported).
- Timeframes from the 5-minute candles with `combo-grid-3`'s `frames` (imported): M5 = the candles themselves, M15 and H1 (UTC
  buckets).
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The engulf zone (trigger timeframe T = M5, M15 or H1; closed candles only)

`council/eg-methods.mjs` `zones(T, tf)` (imported, unchanged; 3-candle span, `EG_SPAN`): the base is the last candle of the
other colour, a candle at most three candles after it that closes beyond the base's high (a buy zone) / low (a sell zone)
completes the engulf (candle i, known at its close); the zone is the base candle, wick to wick, direction dir = +1 (buy) /
-1 (sell). A zone FAILS at the first later candle fi that closes through its far side (a buy zone: a close below the base's
low; a sell zone: a close above its high), known at that candle's close.

## Context (two)

- **none**: every zone.
- **brk** (the engulf confirms a break of its own side): at the engulf's completing candle i, the most recent structure break
  known by then on T (`grid7-wide-fade`'s `breaks`, equal to `edgekit` `structure(T, 3)`: a close beyond the last confirmed swing,
  3 candles a side; break candle index at or before i) is of the zone's direction, and it is at most 24 candles of T before i.

## (a) The failed engulf, traded the other way: the judged cells

- **K (three)**: the zone fails within K candles of T of its completing candle: fi - i <= K, K = **3, 6, 12** (nested).
- Side s = -dir (the EF side). Market entry at the open of the first 5-minute candle starting at or after the close of fi.
- **Stop**: past the extreme between the base candle and the failing candle (for a sell: the highest high of candles base..fi;
  for a buy: the lowest low) by 0.1 x ATR(14) of T at fi. Every trade has its stop on the losing side; a fill at or beyond the
  stop is no trade.
- **Exit (three)**: **1R**, **2R**, or **proj** = the base candle's range projected 1:1 from the side the zone was closed
  through (a failed buy zone, traded short: target = base low - (base high - base low); a failed sell zone, traded long: base
  high + range). proj is a trade only when that target is 1R or more from the fill on the winning side; otherwise no trade in
  that cell.
- Stop first when one 5-minute candle holds stop and target; a gap through either fills at the open. **Time limit**: M5 8 hours,
  M15 1 day, H1 2 days from the fill; out at the close of the 5-minute candle that reaches it (as `grid7-wide-fade`).
- Trades overlap freely; a trade whose risk is under the market's round-trip cost is no trade (the `grid7-wide-fade` rule).

**The cells (54, fixed here)**: 3 timeframes (m5, m15, h1) x 3 K (3, 6, 12) x 2 contexts (none, brk) x 3 exits (1R, 2R, proj),
each named `<tf> K<k> <ctx> <exit>`:

- m5 K3 none 1R; m5 K3 none 2R; m5 K3 none proj; m5 K3 brk 1R; m5 K3 brk 2R; m5 K3 brk proj;
- the same six for m5 K6 and m5 K12; then m15 (18 cells) and h1 (18 cells).

## (b) The engulf traded WITH it (reported, not judged: shows the mirror)

The same zones, side s = dir, market entry at the open of the first 5-minute candle starting at or after the close of the
completing candle i (no wait for any failure). Stop past the extreme between the base candle and the completing candle on the
losing side (a buy: their lowest low) by 0.1 x ATR(14) of T at i. Exits 1R, 2R, proj (base range projected 1:1 from the side the
engulf broke: a buy zone, target = base high + range), same rules otherwise. 18 rows: 3 timeframes x 2 contexts x 3 exits. They
are reported with every statistic and the bars 1-3 below, but they are not in the Holm family and cannot make the verdict.

## Control (named per cell)

The plain `grid7-wide-fade` rule, context "none", stop "ext" (past the break candle's extreme + 0.1 ATR), on the same trigger
timeframe, run here with that study's own `signals` and `exits` (imported) on the same candles, costs and exclusions:
exit 1R against the fade's 1R, 2R against its 2R, and **proj against its "swing"** exit (each the rule's own structural target).

## The bar (judged BEFORE costs)

A cell of (a) passes when ALL hold:
1. n >= 300 trades in each window;
2. mean R > 0 and month-sum t >= 2 in discovery;
3. mean R > 0 and month-sum t >= 2 in confirmation;
4. Holm-adjusted one-sided p < 0.05 over the 54 confirmation tests (p from the month-sum t, df = months - 1);
5. it beats its control: Welch t (per trade, cell mean R minus control mean R) >= 2 in discovery AND in confirmation.

Verdict: **PASS** if one cell or more passes; **FAIL** otherwise. INCONCLUSIVE only if the data cannot be read (fewer than 8 of
the 10 markets load).

## Also reported (not part of the bar)

- **Side-flipped check (the mirror)**: every cell of (a) and every row of (b) traded the other way (same fill, the stop at the
  same distance on the other side, targets at the same distances in R).
- **After costs** beside every figure: R less (round-trip cost / risk) per trade, `combo-grid-2` `COSTS` (the demo figures for
  gold and the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).
- **Per-market rows** for any passing cell.
- **Cut test**: on five dates in two markets, the signals known by a date computed on candles cut there equal the full run's.

## What a result means

A pass is a before-cost tilt in both decades that also beats the plain fade, nothing more: if the cost in R is larger than the
tilt, it is not tradable and is said so. Not adopted, never called an edge, no live change; a forward record would need the
owner. One run, no variants.
