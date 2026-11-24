# The zone fade with what it lacks: cost, hour and level filters, judged after costs (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.
Never called an edge without n and t.

## Why

`research/edge/fade-zone-targets` (23 Nov 2026) found that the M15 structure-break fade, closed at the nearest H1 / H4 key
level in front of it and stopped past the nearest level behind it, does better than the grid's 2R / 1-ATR exit before costs in
both decades (P3, 2015-26 +0.029R a trade, n 201,769, month t 7.92), but after costs it loses (-0.178R a trade, all hours;
-0.037R in the 20-23 UTC block). What the rule lacks is not direction: it is that the round trip is a large share of a small
stop (cost R about 0.16 on the 1-ATR stop, more on the tighter zone stop). The other fade studies point at three things that
could close that gap, each found on its own: the tilt lives in the 20-23 UTC block (`fade-conditions`, `fade-hour-check`); a
break that runs into a standing level is the case the zone stop is built for; a wider stop (H1 breaks, or a minimum risk
against the round trip) pays a smaller share in cost. This study puts them together as a small fixed set of candidates, picks
ONE on the first decade AFTER costs, and confirms it once, after costs, on the second decade and on eight markets the zone
fade has never been run on. One run, no variants.

What has already been read, said now: the ten markets 2005-26 were read by the fade grid, its hour split (20-23 UTC was chosen
on 2005-14 and confirmed on 2015-26), and `fade-zone-targets`. The eight confirmation markets were read by `fade-new-markets`
(five fixed fade cells, ATR / break-candle stops, before costs) but never with key-level exits, the hour block or the filters
below.

## The base trade (imported, never edited)

`grid7-wide-fade` `signals` (structure break, 3 candles a side, closed candles only), context none, on **M15** (`tf` 1, time
limit 1 day) or **H1** (`tf` 2, time limit 2 days); fade it at the open of the first 5-minute candle starting at or after the
break candle's close; the grid's exclusions, cost floor and membership (its 1-ATR stop must give a risk at or above the round
trip; its own fade and mirror calls must resolve). Exit and stop = `fade-zone-targets`' zone target (b) and zone stop (ii):
target the near side of the nearest standing H1 / H4 level in front (engulf, dominant, supply / demand, V / A turn), when 1R or
more away, else 2R; stop past the far side of the nearest standing level behind + 0.1 ATR, when within 2 ATR and at least the
round trip, else 1 ATR. Stop first in a 5-minute candle that holds both; a gap fills at the open. Every stop on the losing side
of the fill and every target on the winning side (the run throws otherwise). A variant still open when the data ends is closed
at the last close (counted).

## The three complements (fixed)

- **Hour**: the break candle STARTS in hour 20, 21, 22 or 23 UTC, and the fill is NOT in 21:00-22:59 UTC (the rollover hours,
  `fade-hour-check`'s cut).
- **Level**: the zone stop was used (a standing level of the fade's side lies behind the fill within 2 ATR: the break ran into a
  level).
- **Cost**: the round trip is at most **5 %** of the trade's own risk (cost R <= 0.05).

## Candidates (8, fixed)

| Key | Break timeframe | Filters |
|---|---|---|
| K1 | M15 | none (the `fade-zone-targets` P3 trade) |
| K2 | M15 | hour |
| K3 | M15 | hour + level |
| K4 | M15 | cost |
| K5 | M15 | hour + cost |
| K6 | M15 | hour + level + cost |
| K7 | H1 | cost |
| K8 | H1 | hour + cost |

## Data, costs

- **Ten markets** (selection and first confirmation): xau xag eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy, OANDA mid
  5-minute candles (`edgekit` cache), fills 2005-01-01 to 2026-10-31; **2005-14** = selection, **2015-26** = confirmation 1.
- **Eight markets** (confirmation 2): nas100 spx500 de40 gbpjpy audjpy cadjpy eurgbp euraud (`fade-new-markets` set A), all fills
  on file from 2005-01-01 to 2026-10-31 (the cache may start later; said in the result).
- Costs: `combo-grid-2` `COSTS` round trips. Measured on the demo account for xau eurusd gbpusd usdjpy audusd; **ASSUMED, not
  measured** for xag nzdusd usdcad usdchf eurjpy and all eight confirmation-2 markets.

## The test (AFTER costs; R net = R - round trip / risk; t of calendar-month sums)

1. **Selection** (ten markets, 2005-14): a candidate is eligible when n >= 300, net mean > 0 and net month t >= 2. The eligible
   candidate with the highest net month t is picked. None eligible = **FAIL**, nothing confirmed.
2. **Confirmation**, the picked candidate only, one test, no correction needed:
   - C1: ten markets 2015-26: n >= 300, net mean > 0, net month t >= 2;
   - C2: eight markets, all their fills: n >= 300, net mean > 0, net month t >= 2.
3. **PASS** = C1 and C2 hold. **FAIL** = otherwise. **INCONCLUSIVE** = the gate fails or fewer than 8 of the ten or 6 of the
   eight markets ran.

A PASS means one fixed combination of these filters made money after the assumed and measured round trips on mid candles in the
second decade and on new markets. It is not proof of a tradable edge: mid candles are not fills, and five of the ten and all
eight new markets have assumed costs. It would justify a forward paper record and a tick-level execution check, nothing more.

## Gate

K1 on the ten markets must reproduce `fade-zone-targets/result.json` cell "zone exit, zone stop, all" in both windows (n equal,
mean within 0.0005R). Otherwise INCONCLUSIVE.

## Reported, not judged

Every candidate in every window and set: n, gross and net mean R, month t, median, share of wins, net at 2 x costs; trades a
year; the measured-cost markets (xau eurusd gbpusd usdjpy audusd) alone; per market net mean of the picked candidate.

## Checks

- Cut test: two markets, three cut dates: every signal, filter value and level known by a cut, computed on candles cut there,
  equal the full run's.
