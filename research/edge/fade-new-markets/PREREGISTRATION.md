# Fading the first structure break on new markets and a second feed (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/grid7-wide-fade` found that FADING the first structure break (`edgekit` `structure`, 3 candles a side; market
entry against the break at the next 5-minute open) makes a small tilt before costs in both 2005-14 and 2015-26 on ten markets
of OANDA mid candles (for example M15, no context, 1 ATR stop, 2R: +0.054R / +0.042R a trade, month t 11.4 / 11.3), and that
every cell's mirror (traded WITH the break) loses. Two things could still explain it away:

1. something particular to those ten markets;
2. something in OANDA's mid candles (a feed artefact).

This study tests both with the grid's exact rules: Test A on eight markets the grid never read, Test B on a second feed
(HistData) for the grid's own markets. It does not pick new cells: the five rules below are passing cells of that grid, fixed
here before any run, and nothing about them changes.

## The rules (5, unchanged from grid7-wide-fade)

All with context **none** (every structure event on the trigger timeframe) and session **all**:

- **m15 none atr 2R all**
- **m15 none ext swing all**
- **m15 none ext 2R all**
- **h1 none ext 2R all**
- **m5 none atr 2R all**

The code is `grid7-wide-fade/run.mjs` imported unchanged (`signals`, `exits`, `breaks`, `CAP`, `ATRK`), with `combo-grid-3`
`frames`, `dom-trade-through` `atr14` / `startIdx`, `grid7-wide-core` `mstat` / `p1`. In words: the break = a close beyond the
last confirmed swing (3 a side, confirmed 3 candles later), each swing broken once, known at the close of the break candle j.
The fade: side s = -d, market entry at the open of the first 5-minute candle starting at or after that close. Stop **ext** =
past the break candle's extreme by 0.1 x ATR(14) of the trigger timeframe at j; **atr** = 1 x ATR(14) from the fill. Exit
**2R**, or **swing** = the opposite swing standing when the break happened (no trade in that rule when it is not on the winning
side of the fill). Stop first when one 5-minute candle holds both; a gap fills at the open. Time limit M5 8 h, M15 1 day, H1
2 days. Trades overlap freely. A fill at or past the stop is no trade; a risk under the market's round-trip cost is no trade
(the grid's rule). Every trade has its stop on the losing side of the fill (the run throws otherwise).

## Gate (first, before Test A or B)

The runner of this study, on OANDA eurusd from the cache, must reproduce `grid7-wide-fade/result.json` `perMarket` eurusd
confirmation rows (fills 2015-01-01 to 2026-10-31) for all five rules **exactly**: n, mean R, month t, mean R after costs (to
the six decimals stored there). If it does not, Tests A and B are not run until the difference is found in the code; if it
cannot be found, the verdict is INCONCLUSIVE.

## Test A: new markets, OANDA mid

- Markets (8, never read by the fade grid): **nas100, spx500, de40** (indices); **gbpjpy, audjpy, cadjpy, eurgbp, euraud**
  (crosses). Other studies (the combination grids) read some of them; the fade grid and its passing cells never did.
- OANDA mid 5-minute candles from the shared cache (`edgekit` `load`), loaded from 2004-01-01; **fills 2005-01-01 to
  2026-10-31** (or from where OANDA's history starts), 262 calendar months, an empty month counted as 0.
- Exclusions: `combo-grid-2` `exclusions(market)` (the data-quality audit's bad intervals; that audit covered 2020 on).
- Costs (after-cost figures only, not the bar): `combo-grid-2` `COSTS`, **ASSUMED, not measured** for all eight: gbpjpy 0.014,
  audjpy 0.010, cadjpy 0.010, eurgbp 0.00009, euraud 0.00013 (price units); nas100 1.0, spx500 0.4, de40 1.5 points.

## Test B: a second feed, HistData

- HistData M1 candles from `origin/council-data` `research/candles/*` (read with `git show`, converted to UTC only through
  `council/histdata.mjs` `histStampUtc`, grouped into 5-minute candles by `dom-second-feed` `parseHist` / `histM5`, imported).
- Markets: the fade grid's markets that council-data holds in HistData: **xau, xag, eurusd, gbpusd, usdjpy, audusd, usdcad,
  usdchf** (8 of 10; nzdusd and eurjpy have none).
- Candles from 2018-01-01 (the files start there); **fills 2018-02-01 to 2026-10-31** (105 months; January 2018 is warm-up).
- No exclusions (the audit's intervals belong to the OANDA cache). Costs: `combo-grid-2` `COSTS` (the demo figures for xau and
  the four majors; ASSUMED for xag, usdcad, usdchf).
- Beside it, not part of the bar: the same eight markets and window on OANDA mid (the cache), so the two feeds can be compared.

## The bar (judged BEFORE costs, calendar-month sums of R, pooled over the test's markets)

Ten primary tests: 5 rules x {A pooled, B pooled}. For each, one-sided p from the month-sum t (df = months - 1); Holm over the
ten. A rule **passes** when, in BOTH A and B: mean R > 0, month-sum t >= 2, and Holm-adjusted p < 0.05.

Verdict: **PASS** if one rule or more passes; **FAIL** otherwise. **INCONCLUSIVE** if the gate fails (above), or fewer than 6
of the 8 markets of either test load.

## Also reported (not part of the bar)

- **Per-market rows** for every rule (A and B, and OANDA on B's window), before and after costs.
- **The windows** of Test A: 2005-14 and 2015-26 apart.
- **The mirror** of every rule (traded WITH the break: same fill, the stop at the same distance on the other side, targets at
  the same distances in R), pooled A and B. Expected to lose before costs if the fade's tilt is real.
- **Side-flipped check (by side)**: the fade's buys (fading down breaks) and sells (fading up breaks) apart, pooled A and B: a
  tilt that lives on one side only is more likely drift than a reversal of the break.
- **After costs** beside every figure, and the mean cost / risk per rule.
- **Cut test**: on five dates in two Test A markets and one Test B series, the signals known by a date computed on candles cut
  there equal the full run's.

## What a result means

A pass says the before-cost tilt is not particular to the ten markets nor to OANDA's mid candles; it is still a before-cost
tilt, and the grid found it smaller than the round trip. It is never called an edge, nothing is adopted, no live change. One
run, no variants.
