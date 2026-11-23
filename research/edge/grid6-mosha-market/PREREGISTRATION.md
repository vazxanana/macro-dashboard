# Grid 6: the Mosha storyline BO, VR, CF with market and trade-through entries only (pre-registration)

Written 23 Nov 2026, before any run of this grid. Research only: nothing live changes, nothing is placed.

## Why

Grid 5 (`research/edge/grid5-mosha-cycle`, FAIL) tested the storyline with the market-cycle stage, a barrier and the CF's
place. This grid asks the same question from the entry side: with the cleanest entries only (a market order at the next
5-minute open, or a limit that must be traded THROUGH), which ladder, break type, CF place, entry, stop, exit, session or
Daily direction call, if any, holds BEFORE costs on 2010-2019. One run, every combination, discovery then confirmation.

## Data

OANDA mid 5-minute candles of xau, eurusd, gbpusd, usdjpy, audusd from the edgekit cache (`EDGE_DATA`), 2009 (warm-up only)
to 2019. 15m / 30m / 1h / 4h = UTC buckets of the 5m candles (`resample`); D1 = 17:00 New York trading days (`dailyNY`).
Bad intervals of `research/edge/data-quality/quality.json` (`exclusions()` of `research/edge/combo-grid-2/run.mjs`): a trade
whose fill-to-exit span touches one is dropped. Costs = combo-grid-2 `COSTS` (round trip in price units). Discovery = trades
filled 2010-01-01 to 2014-12-31; confirmation = 2015-01-01 to 2019-12-31.

## The storyline (the page's own structure engine through `council/mosha-desk.mjs` `loadFns`, never edited)

- Structure: `msAnalyze(bars, 3)` (3 candles a side) on every timeframe. An event is known at the close of its break
  candle. Only `dir`, `level`, `structure`, `fromIdx`, `breakIdx` are read (through grid 5's `eventsOf`, imported).
- Ladders (upper > lower): D1>H4, H4>H1, H1>M15, M30>M5. The VR and the CF are both read on the lower timeframe.
- BO = every break event of the upper timeframe (side d), whatever its type. Its storyline ends when the next upper event is
  known.
- Break type (factor `brk`), applied to the VR and the CF: `any` = any event of the lower timeframe (a close beyond the last
  3-a-side swing the engine tracks); `qm` = events with `structure` true only (a structure shift). The two are separate
  storyline sets (not nested).
- VR = the first lower event against d (of the break type) known after the BO and before the storyline ends. VR extreme x =
  the highest high (d > 0; lowest low d < 0) of lower candles from the BO candle's start to the VR break candle. VR leg
  extreme v = the lowest low (d > 0) of lower candles from x's candle to the VR break candle. VR box = between x and v.
- CF = the first lower event with d (of the break type) known after the VR whose level is not beyond x; none when a lower
  candle traded to x first or a with-d event beyond x comes first. Only the first CF a storyline.
- CF zone = from the pullback extreme o (the lowest low, d > 0, of lower candles from x's candle to the CF break candle) to the
  CF level.

## Factors and levels

| Factor | Levels |
|---|---|
| ladder | D1>H4, H4>H1, H1>M15, M30>M5 |
| brk | any, qm |
| place | any; back (a lower candle between the VR break candle and the CF break candle traded back to the BO level); inside (CF zone overlaps the VR box); outside (it does not) |
| entry | MKT: market at the open of the first 5m candle after the CF candle's close. EG: after the CF, the first lower candle that trades into the CF zone starts the pullback; the EG = a lower candle closing beyond the high (d > 0; low d < 0) of the last opposite-colour candle since then; market at the open of the next 5m candle; none when a lower candle closes through the CF zone's far side or reaches x first, or after 48 lower candles. LIM: a limit at the CF level placed at the CF close, filled only when a 5m candle trades THROUGH it by half the round-trip cost (fill at the limit, or the open when it opens past it), cancelled after 24 lower candles, by a lower close through the zone's far side, or when x is reached first |
| stop | vr: past v (the VR leg extreme); cfz: past o (the CF zone's far side); each by 0.1 x ATR(14) of the lower timeframe |
| exit | 1R, 2R, 3R, VR (target = x, only when x is ahead of the entry), trail (1R behind the best price from +1R) |
| session | any; London (fill 07:00-11:59 UTC); New York (12:00-16:59 UTC); other |
| msnr | any; with; against: the Daily MSNR call (`council/eg-methods.mjs` `direction()`, imported, H4 working candles with D1 key levels) at the last H4 candle closed by the CF close, equal to d (with) or to -d (against); a 0 call counts only under any |

Every trade has its stop on the losing side; a trade whose stop is not is not built (counted). Simulation on 5m candles with
grid 5's `manage` (imported): a market entry is managed from its fill candle on; on a limit's fill candle only the stop counts;
a candle that opens past the stop or a target exits at its open; a candle holding both is a stop; time limit 10 days (D1>H4),
5 days (H4>H1), 2 days (H1>M15), 1 day (M30>M5), at the close. R before costs; after costs = R - cost / risk.

Combinations: 4 x 2 x 4 x 3 x 2 x 5 x 4 x 3 = 11,520 cells, per market (5) and pooled, 69,120 in all.

## Judgement (before costs, month-sum t over a fixed calendar of 60 months, empty months = 0)

- Discovery 2010-2014: a cell is a winner when n >= 100, mean R > 0 and month t >= 2.
- Confirmation 2015-2019: a winner passes when n >= 100, mean R > 0, month t >= 2 and its Holm-adjusted two-sided p (over all
  discovery winners of all scopes, from the confirmation month t, df = 59) is at most 0.05.
- Chance: discovery winners against 2.3 % of the cells with n >= 100 (a guide; the cells are nested and correlated).
- Placebo: every trade traded the other way at the same fill moment and price, its stop and the VR target mirrored; counted
  the same way.
- After-cost figures beside every reported cell; a pass that loses after costs is not tradable.
- **Verdict**: PASS when at least one cell passes AND the placebo has fewer passing cells than the real grid; FAIL otherwise;
  INCONCLUSIVE when fewer than 20 cells reach n >= 100 in discovery.

## Checks

- Cut test: on random cut times, every storyline (side, CF time, levels, factors) known by the cut from the whole series
  equals the one computed on candles cut there.
- Gate: every simulated trade has risk > 0 with the stop on the losing side.

Nothing of `market-structure.html`, `assets/`, `council/`, `research/edge/_lib/` or any other study is edited.
