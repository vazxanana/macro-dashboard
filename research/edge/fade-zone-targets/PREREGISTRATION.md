# Key levels as the fade's targets and stops (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.
Never called an edge without n and t.

## Why

`research/edge/grid7-wide-fade` found that fading the first M15 structure break at market (cell `m15 none atr 2R all`) has a
small tilt before costs in both 2005-14 and 2015-26 on ten markets; `fade-new-markets` saw it on other markets and a second
feed; `fade-conditions` / `fade-hour-check` placed most of it in the 20-23 UTC block. Every one of those runs exits at a fixed
2R and stops at 1 x ATR. The desks' key levels (engulf zones, two-candle dominant zones, supply / demand zones, turns of the
closes) failed as ENTRY signals in the combination grids. This study asks a different question: used as the fade's TARGET (the
nearest level in front of the trade) or its STOP (past the nearest level behind it), do they do better than the grid's own
fixed exit and ATR stop, on the very same trades? One run, no variants.

## The entries (unchanged, imported)

`grid7-wide-fade` cell `m15 none` by its own code (`signals`, `exits`, `CAP['15m']` = 1 day; `combo-grid-3` `frames`,
`dom-trade-through` `atr14` / `startIdx`): the first close beyond the last confirmed M15 swing (3 candles a side), known at the
close of the break candle; fade it (enter AGAINST the break) at the open of the first 5-minute candle starting at or after that
close. Same fills, exclusions (`combo-grid-2` `exclusions`), cost filter and drop rule as the grid's ATR-stop cells. Closed
candles only. Every trade has its stop on the losing side of the fill (the run throws otherwise).

**The trade set** = every signal the grid trades in its `m15 none atr` cells (risk of the 1-ATR stop at or above the round
trip, resolved by the data end, the grid's mirror resolved too). All twelve cells below use exactly these trades; a stop or a
target variant changes the exit only, never which trades exist.

## The key levels (the desks' own definitions, imported, never edited)

On **H1 and H4** (built from the 5-minute candles by `combo-grid-3` `frames`):
- **EG**: `combo-grid-3` `buildZones('eg')` (engulf completed within three candles, `council/eg-methods.mjs` `engulfAt`; the
  zone = the first candle wick to wick);
- **DOM**: `buildZones('dom')` (two candles of one colour, the second closing beyond the first's extreme; zone = the first
  candle's body);
- **SD**: `grid5-sd-eg` `sdZones` (the order block of a structure break; `lo` / `hi`, `end`);
- **Turn (V / A)**: `buildZones('av')` (a turn of the closes, 2 candles a side; a V from its low to its close, an A from its
  close to its high).

A level is **standing** at the break candle's close `ts` when it was known by then (`at <= ts`) and has not ended (`ts < end`:
not closed through, not past its life). Each family keeps its own side `d` (+1 demand / V, -1 supply / A).

Let `s` be the fade's side (+1 buy, -1 sell), `fill` the fill price, `a` the M15 ATR(14) at the break candle.

## Stops

- **(i) ATR** (the grid's): `fill - s x a`.
- **(ii) Zone**: among the standing levels of side `d = s` (supply above a sell, demand below a buy: the levels the break ran
  into, behind the fade) whose FAR side lies beyond the fill on the losing side (`s x (fill - far) > 0`; `far` = `bot` for
  `s = +1`, `top` for `s = -1`), take the one whose far side is NEAREST the fill; stop = that far side `- s x 0.1 x a`. Used
  only when its distance from the fill is at most `2 x a` and at least the market's round trip; otherwise the ATR stop (i).

## Exits (each in R of the trade's own stop; stop first in a 5-minute candle that holds both; a gap fills at the open; out at
the close after 1 day, the grid's `exits`)

- **(a) 2R** (the grid's).
- **(b) Zone target**: among the standing levels of side `d = -s` (demand below a sell, supply above a buy: in front of the
  fade), whose NEAR side lies strictly ahead of the fill (`s x (near - fill) > 0`; `near` = the `top` of a demand zone below a
  sell, the `bot` of a supply zone above a buy), take the nearest; target = its near side when it is at
  least 1R away, else 2R. A farther level is never taken instead.
- **(c) Swing**: the broken swing's opposite swing standing at the break (`grid7-wide-fade` `breaks` `opp`), when it lies
  ahead of the fill; otherwise 2R (so every cell keeps the same trades; the share that fell back is reported).

## Cells

3 exits x 2 stops x 2 hour sets = **12 cells**: all hours, and the **20-23 UTC** block (the UTC hour of the break candle's
START is 20, 21, 22 or 23: `fade-conditions` `hourLevel` = 5).

## Data and windows

OANDA mid 5-minute candles (the `edgekit` cache, `EDGE_DATA`), markets **xau xag eurusd gbpusd usdjpy audusd nzdusd usdcad
usdchf eurjpy** (gold from 2006), fills 2005-01-01 to 2026-10-31; windows **2005-14** (120 months) and **2015-26** (142
months), `grid7-wide-core` `monthOf` / `NM` / `DM`. Costs (after costs, beside only): `combo-grid-2` `COSTS` (the demo
figures for gold and the four majors); **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## Gate

The trade set under (a, i) must reproduce `grid7-wide-fade/result.json` cell `m15 none atr 2R all` in both windows (n equal,
mean within 0.0005R), and its 20-23 subset in 2015-26 must equal `fade-conditions` (n 27,671, mean +0.169 to three decimals).
Otherwise INCONCLUSIVE, nothing judged.

## Primary tests (judged BEFORE costs, paired by trade on the same trades)

For each trade the difference `R(variant) - R(a, i)`, summed by calendar month (month of the fill); t of the month sums
(`grid7-wide-core` `mstat`) in each window. Six tests:

- **P1** exit (b) with stop (i) minus (a, i), all hours;
- **P2** exit (a) with stop (ii) minus (a, i), all hours;
- **P3** exit (b) with stop (ii) minus (a, i), all hours;
- **P4, P5, P6** the same three in the 20-23 UTC block.

A test passes when the mean difference is > 0 AND the month-sum t >= 2 in **both** windows AND its Holm-adjusted p < 0.05;
Holm over the six, each test's p = the LARGER of its two windows' one-sided p (t distribution, months - 1 df).

**PASS** = at least one primary test passes; **FAIL** = none; **INCONCLUSIVE** = the gate fails or fewer than 8 markets ran.
A pass means a zone-based exit or stop beats the grid's own on these trades before costs, in R of each trade's own stop; it is
not an edge and it says nothing about costs.

## Reported, not judged

Every cell: n, mean R, month-sum t, median R and share of wins, in both windows, and after costs beside (cost R = round trip /
the trade's own risk). The swing exit (c) cells. The share of trades where the zone stop / the zone target was used (else the
fallback), and of swing exits that fell back to 2R. Because a zone stop changes the risk, each primary difference is also given
in units of the M15 ATR (`R x risk / a`), which compares money at a fixed size per ATR. Per-market means of the primary
differences.

## Checks

- **Cut test**: on two markets and three cut dates, the signals and every stop and target level known by a cut, computed on
  candles cut there, equal the full run's (0 differences).
- Every trade's stop on the losing side of its fill; every target on the winning side.
