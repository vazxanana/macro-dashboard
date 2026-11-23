# Fading the first structure break: into an opposite Daily level against a clear way (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/grid7-wide-fade` found that FADING the first structure break at market makes a small tilt before costs on ten
markets in both decades (M15, 1 ATR stop, 2R: +0.054R a trade in 2005-14, +0.042R in 2015-26, month t 11.38 / 11.33), and that
after costs it loses. A common reading of structure says a break that runs INTO an opposite higher-timeframe level (supply above
a buy break, demand below a sell break) is likely to fail, and one with a clear way ahead is likely to run. This study asks one
question: on the grid's own fade trades, is the fade stronger when the break runs into an opposite Daily level than when the way
is clear? It changes nothing in the fade rule; it only splits its trades by what lies ahead of the break.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs`, `fetch-cache.mjs`, `EDGE_DATA` on the
  machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy.
- Timeframes from the 5-minute candles with `combo-grid-3` `frames` (imported): 15m, 1h (UTC buckets), 1d (17:00 New York).
  The Daily levels are read from these Daily candles (the same Daily the grids use), not from OANDA's UTC daily file.
- Exclusions: `combo-grid-2` `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months). Month sums count every calendar month of the window, an empty month as 0.

## The trades (unchanged from `grid7-wide-fade`, its code imported, never edited)

`grid7-wide-fade` `signals(F)`, context "none" only (every first structure break, 3 candles a side), trigger timeframe **M15**
or **H1**. Side s = -d (against the break). Market entry at the open of the first 5-minute candle starting at or after the
break candle's close. **Stop: 1 x ATR(14) of the trigger timeframe from the fill** ("atr"; on the losing side, the run throws
otherwise). **Exits (two): 2R**, and **swing** = the opposite swing standing at the break (no swing target on the winning side =
no trade in that exit). Stop first when one 5-minute candle holds stop and target; a gap fills at the open. Time limit: M15
1 day, H1 2 days. A risk under the market's round-trip cost is no trade. All by `grid7-wide-fade`'s `exits`.

**Gate**: for each trigger timeframe and exit, the three places of "any level" added together must reproduce `grid7-wide-fade`'s
cells "m15 none atr 2R all", "m15 none atr swing all", "h1 none atr 2R all", "h1 none atr swing all" (n and mean R in both
windows). A run that does not is reported as broken, not judged.

## What lies ahead of the break (measured at the break candle's close ts, from closed candles only)

P = the break candle's close; d = the break's direction; A = ATR(14) of the Daily candles closed by ts (the last Daily candle
with close time <= ts). Only levels KNOWN by ts and still STANDING at ts count. "Opposite" = against the break: above price for
an up break (supply, resistance), below price for a down break (demand, support).

### Level kinds (four)

- **eg**: Daily engulf zones from `council/eg-methods.mjs` `zones` (3-candle span, `EG_SPAN`), the base candle wick to wick,
  known from the completing candle's close, standing until a Daily close through its far side or the end of its life; side:
  a sell engulf zone for an up break, a buy engulf zone for a down break. (The Daily candles are handed in with time = close
  - 86400, so a zone is known at the completing candle's close exactly.)
- **dom**: `combo-grid-3` `buildZones('dom', Daily)` (two same-colour candles, the second closing beyond the first's extreme;
  zone = the first candle's body), known from the second candle's close, standing until a close through the far side or 120
  candles; side: d = -1 zones for an up break, d = +1 for a down break.
- **av**: `combo-grid-3` `buildZones('av', Daily)`: a V / A turn of the closes (2 candles a side), zone from the turn candle's
  wick to its close, known 2 candles after the turn, standing as above; side: A turns (d = -1) for an up break, V turns for a
  down break.
- **pd**: the previous day's high (up break) or low (down break) = the last Daily candle closed by ts; a line, always standing.

A level is a range [bot, top] (a line has bot = top).

### Places (three, exclusive)

For an UP break (a down break is the mirror: swap above / below and bot / top):
- **(a) into**: an opposite level that the close has not fully crossed and that is within 1 A ahead: top > P and bot - P <= A
  (price inside the zone counts as into).
- **(b) through**: an opposite level the close has already crossed, within 1 A behind: top <= P and P - top <= A.
- **(c) clear**: neither.
A break with levels of both (a) and (b) is (a). Places are computed per level kind, and once more over all four kinds together
("any": (a) if any kind gives (a), else (b) if any gives (b), else (c)).

## The cells (60, fixed here)

2 trigger timeframes (m15, h1) x 5 level sets (eg, dom, av, pd, any) x 3 places (into, through, clear) x 2 exits (2R, swing).
Named `<tf> <set> <place> <exit>`, e.g. "m15 any into 2R". Each cell: n, mean R before costs, month-sum t, win share, mean R
after costs, cost R, in both windows.

## The primary tests (20) and the bar (judged BEFORE costs)

For each trigger timeframe x level set x exit (20): **into minus clear**, mean R of (a) minus mean R of (c).
A test passes when ALL hold:
1. n >= 300 in (a) and in (c) in each window;
2. (a) minus (c) > 0 with Welch t >= 2 (trade level) in discovery;
3. the same in confirmation;
4. Holm-adjusted one-sided p < 0.05 over the 20 confirmation tests (p from the Welch t, normal approximation).

Verdict: **PASS** if one test or more passes; **FAIL** otherwise. INCONCLUSIVE only if fewer than 8 of the 10 markets load or
the gate fails.

## Also reported (not part of the bar)

- Each cell's own mean R and month-sum t in both windows (a cell's mean > 0 is not the question here).
- **through minus clear** (Welch t, both windows) beside each primary test.
- The month-sum t of the paired monthly difference (a) minus (c) beside the Welch t (trades of a month share its moves).
- **After costs** beside every figure: R less (round-trip cost / risk), `combo-grid-2` `COSTS` (the demo figures for gold and
  the four majors; **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy).
- Share of trades in each place.
- **Cut test**: on five dates in two markets, the signals and their places known by a date, computed on candles cut there,
  equal the full run's.

## What a result means

A pass says the fade's before-cost tilt is larger where a break runs into an opposite Daily level, in both decades: a reading
of where the tilt lives, not an edge. `grid7-wide-fade` already showed the tilt is smaller than the bid / ask on these stops; a
larger tilt in one place matters only if it is said beside its cost. Nothing adopted, no live change, no rule proposed. One
run, no variants.
