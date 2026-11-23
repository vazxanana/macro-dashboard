# The dominant zone touched, entered at market: is it the zone, and does it hold on unread data? (pre-registration)

Written 23 Nov 2026, committed and pushed ALONE before any code of this study runs. Research only: nothing live changes,
nothing is placed, no council file is read.

## Why

`grid6-dom-confirm` found that a MARKET entry at the next 5-minute open after the first M5 candle that trades into an H1
dominant (DOM) zone keeps a small tilt before costs in both halves of 2010-2019 (H1 > M5, first visit, Daily call any, session
any: zone stop 1R +0.037R / +0.032R a trade, n 38,353 / 38,658, month t 7.06 / 6.02; touch-candle stop with the trail +0.123R /
+0.071R, n 24,487 / 22,995), and loses after costs. Earlier, with resting limits, a random same-colour candle body did as well
as the DOM zone (`dom-placebo`). Two questions:

- **Q1, is it the DOM zone?** The same market-at-touch rule with the zone replaced by controls, on the same years.
- **Q2, does it hold on data the grids never read?** The rule exactly, on 2005-2009, on five other markets, and (reported) on
  2020 to now.

## The rule (fixed; the grid's code, imported, never edited)

- Candles: OANDA mid 5-minute candles of the edgekit cache; H1 = `K.resample(M5, 3600)` (as combo-grid-3 `frames`). Costs:
  combo-grid-2 `COSTS` (round trip, price units; the holdout markets' figures are ASSUMED, not measured). Exclusions:
  combo-grid-2 `exclusions` (a trade whose fill falls in an excluded interval is dropped).
- Zone: combo-grid-3 `buildZones('dom', H1)` unchanged (two consecutive H1 candles of one colour, the second closing beyond the
  first's extreme; zone = the first candle's body; known at the second candle's close; it ends at the first H1 close through its
  far side or after 120 H1 candles).
- Visit: the first touch only, found exactly as combo-grid-3 `signalsFor` finds it (the first M5 candle starting at or after
  the zone is known that trades into the zone, before the zone ends). This study re-implements that search for any zone list;
  it must give the same first touches as `signalsFor` (checked in the test).
- Entry: none if the touch candle closes beyond the zone's far side; else MARKET at the next 5-minute open (combo-grid-3
  `multi(M5, d, close, stop, 'mkt', touch candle end, …, cap 2 days)`), reference price = the touch candle's close.
- Stops (two cells): **zone** = the far side -/+ (half the round trip + 0.25 x H1 ATR(14) of the last closed H1 candle);
  **swing** = the touch candle's extreme -/+ half the round trip. Every trade has its stop on the losing side (the code throws
  otherwise); a trade whose risk is under 2 round trips is not taken (as the grid).
- Exits: **zone stop with a 1R target**, **swing stop with the trail** (1R behind the best price from +1R, `multi` slot 6);
  2R reported beside. Both exits end by the 2-day cap at the last close.
- Primary cells: C1 = zone stop, 1R; C2 = swing stop, trail. (The grid's best-sample cells: H1 > M5, first visit, any Daily
  call, any session.)
- Side-flipped placebo: the same moment, the side reversed, the stop the same distance on the other side (as the grid).
  Reported.

## Gate (before any result is read)

On fills 2010-01-01 .. 2019-12-31, the five markets, the code must reproduce `grid6-dom-confirm/result.json` for these cells
EXACTLY (n, mean R before and after costs to 4 decimals, month t to 2 decimals, each half): zone 1R, zone trail, swing trail
(the passes) and zone 2R, swing 2R (its `view`). If it does not, the study stops and says so; nothing is judged.

## Q1: controls (fills 2010-2019, xau eurusd gbpusd usdjpy audusd)

Each control keeps the side, the moment it is known, the zone life rule (first H1 close through the far side or 120 H1
candles) and everything after the zone (visit, entry, stops, exits, costs) identical. Only the zone differs.

- **(a) random same-colour body**: for each DOM zone completed at H1 candle i, the body of one H1 candle drawn uniformly among
  candles i-120 .. i-2 whose colour is the zone's side (never the DOM's own first candle). Seeded (5 seeds per market, FNV hash
  of market and seed, `K.rng`); the 5 seeds pooled = the control; each seed reported.
- **(b) any H1 candle body**: for every closed H1 candle i of colour d, the body of the last earlier H1 candle of the OPPOSITE
  colour, side d, known at candle i's close; one zone per source candle and side (the first time it is named). No DOM condition.
- **(c) random band**: for each DOM zone, a band of the same height and side, known at the same moment, whose near edge sits
  u x ATR(14) of candle i from candle i's close on the zone's usual side (below for a buy, above for a sell), u drawn uniformly
  from the near-edge distances (in ATR units) of the last 500 DOM zones of that market completed before it (none drawn while
  fewer than 50 exist). Seeded (5 seeds pooled).

**The DOM rule beats a control** in a cell when, in BOTH halves (fills 2010-2014 and 2015-2019), DOM minus control mean R a trade
before costs is > 0 with Welch t >= 2 (per trade; the month-sum t of the per-month difference is reported beside). Q1 holds
for a cell when the DOM beats all three controls in that cell.

## Q2: unread data (the DOM rule exactly, before costs)

- **Set A**: xau eurusd gbpusd usdjpy audusd, fills 2005-01-01 .. 2009-12-31 (K.HOLDOUT.early).
- **Set B**: nzdusd usdcad usdchf eurjpy xag, fills 2010-01-01 .. 2019-12-31 (costs assumed).
- **Set C**: the five markets, fills 2020-01-01 to the cache's end (Nov 2026). Reported only, not judged (the grids read it).

Test per cell and set: mean R a trade > 0 and month-sum t >= 2 (calendar-month sums of the set's whole window, empty months
counted as 0), one-sided p from that t (df = months - 1). Holm over the 4 primary tests (C1 and C2 on A and B). **Q2 holds for a
cell** when it passes on both A and B with Holm p < 0.05.

## Verdict

- **PASS** only if there is a cell for which Q2 holds AND Q1 holds.
- **INCONCLUSIVE** if the gate passes but a primary cell has fewer than 1,000 trades on Set A or Set B.
- **FAIL** otherwise (also when Q2 holds but a control does as well as the DOM: the tilt is then not the zone's).

Reported beside, never judged: after-cost figures (the round trip in R), per-market rows, the side-flipped placebo, Set C, the
2R exit. Per-trade Welch t is generous (trades overlap in time); a PASS would still be a before-cost tilt, not a tradable rule.
