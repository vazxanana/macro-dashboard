# Grid 5: the Mosha storyline BO, VR, CF with the market cycle, a barrier and the CF's place (pre-registration)

Written 23 Nov 2026, before any run of this grid. Research only: nothing live changes, nothing is placed.

## Why

The Mosha desk records the storyline BO (a break of the timeframe above) -> VR (the first BO Structure against it one
timeframe lower) -> CF (the next BO Structure with it) as paper readings; no mechanical version has passed a test after
costs (`mosha-retrace`, `mosha-cycle`, `mosha-sweep`, `mosha-select`, `desk-rigor`, `storyline-qm-sop`). This grid asks
whether the storyline, combined with the conditions the method names, holds BEFORE costs on years no desk reading was built
on (2010-2019), with fills that cannot be flattered by a touch (`dom-trade-through`: a limit filled on a mere touch is
flattered by about +0.05R a trade). One run, every combination, judged on discovery then confirmation.

## Data

OANDA mid 5-minute candles of xau, eurusd, gbpusd, usdjpy, audusd from the edgekit cache (`research/edge/_lib/edgekit.mjs`,
`EDGE_DATA`), 2009 (warm-up only) to 2019. 15m / 1h / 4h = UTC buckets of the 5m candles (`resample`); D1 = 17:00 New York
trading days (`dailyNY`). Bad intervals of `research/edge/data-quality/quality.json` (`exclusions()` of
`research/edge/combo-grid-2/run.mjs`): a trade whose fill-to-exit span touches one is dropped. Costs = combo-grid-2 `COSTS`
(round trip in price units). Discovery = trades filled 2010-01-01 to 2014-12-31; confirmation = 2015-01-01 to 2019-12-31.

## The storyline (the page's own structure engine, lifted by `council/mosha-desk.mjs` `loadFns`, never edited)

- Structure: `msAnalyze(bars, N)` of `market-structure.html`; the BO timeframe with N = 6 (the desk's `PIVOT`), the VR and CF
  timeframes with N = 3. An event is known at the close of its break candle (`breakIdx`). Only `dir`, `level`, `structure`,
  `fromIdx`, `breakIdx` are read (the event's `top` / `bot` can be moved later by the engine and are never read).
- Chains (BO timeframe > VR timeframe): D1 > H4, H4 > H1, H1 > M15.
- BO = every break event of the BO timeframe (side d). Its storyline ends when the next BO-timeframe event is known.
- VR = the first VR-timeframe event against d with `structure` true, known after the BO and before the storyline ends. The
  VR extreme x = the highest high (d > 0; lowest low for d < 0) of the VR-timeframe candles from the BO candle's start to
  the VR break candle. VR box = between x and the VR event's level.
- CF = the first CF-timeframe event with d, `structure` true, known after the VR, whose level is not beyond x; none when a
  candle of the CF timeframe after the VR break candle and up to the CF break candle traded to x first, or when a with-d
  event beyond x comes first (the move went on). Only the FIRST CF of a storyline is taken.
- CF timeframe (factor `cftf`): `same` = the VR's timeframe (low risk); `lower` = one lower (H4 -> H1, H1 -> M15, M15 -> M5;
  high risk).
- CF zone = from the pullback extreme (the lowest low, d > 0, of the CF-timeframe candles from the VR extreme's candle to the
  CF break candle) to the CF level.

## Factors and levels

| Factor | Levels |
|---|---|
| chain | D1>H4, H4>H1, H1>M15 |
| cftf | same, lower |
| stage | any; pullback; continuation: the BO timeframe's stage at the CF close by `research/edge/_lib/phase.mjs` `readPhase` (closed candles only; the BO timeframe and the one below handed in) |
| barrier | any; yes; no: yes = the pullback low traded into a zone of side d of the BO timeframe that was untouched from its formation until the VR extreme's candle and had no close through its far side before the CF close. Zones: `msZones` (page; geometry and break index only) of the BO timeframe's break events, and the engulf zones `egZones(L, 3)` of combo-grid-3 |
| back | any; yes; no: yes = a CF-timeframe candle between the VR break candle and the CF break candle traded back to the BO level |
| inVR | any; clear; inside: inside = the CF zone overlaps the VR box (the method's "likely to fail" case) |
| entry + stop | MKT-cfz: market at the CF candle's close, stop past the CF zone's far side by 0.1 x ATR(14) of the CF timeframe; EG-cfz and EG-pb: after the CF, the first CF-timeframe candle that trades into the CF zone starts the pullback; the EG = a candle closing beyond the last opposite candle since then; market at the EG close; stop past the CF zone's far side (cfz) or past the pullback's extreme to the EG candle (pb), each by 0.1 x ATR(14); none when a candle closes through the CF zone's far side or reaches x first, or after 48 CF-timeframe candles; LIM-cfz: a limit at the CF level placed at the CF close, filled only when a 5m candle trades THROUGH it by half the round-trip cost (fill at the limit, or the open when it opens past it), cancelled after 24 CF-timeframe candles, by a CF-timeframe close through the zone's far side, or when x is reached first; stop as cfz |
| exit | 1R, 2R, 3R, VR (target = x, only when x is ahead of the entry), trail (1R behind the best price from +1R) |

Every trade has its stop on the losing side; a trade whose stop is not is not built. Simulation on 5m candles from the fill:
a market entry fills at the trigger candle's close and is managed from the next 5m candle; on a limit's fill candle only the
stop counts; a candle that opens past the stop or the target exits at its open; a candle holding both is a stop; time limit
10 days (D1>H4), 5 days (H4>H1), 2 days (H1>M15) at the close. R before costs; after costs = R - cost / risk.

Combinations: 3 x 2 x 3 x 3 x 3 x 3 x 4 x 5 = 9,720 cells, run per market (5) and pooled (all five), 58,320 in all.

## Judgement (before costs, month-sum t over a fixed calendar of 60 months, empty months = 0)

- Discovery 2010-2014: a cell is a winner when n >= 100, mean R > 0 and month t >= 2.
- Confirmation 2015-2019: a winner passes when n >= 50, mean R > 0 and its Holm-adjusted two-sided p (over all discovery
  winners, from the confirmation month t, df = 59) is at most 0.05.
- Chance: the number of discovery winners against 2.3 % of the cells with n >= 100 (one-sided t >= 2 under no effect; the
  cells are nested and correlated, so this is a guide, not a test).
- Placebo: every trade of every cell traded the other way at the same fill moment and price with its stop and targets
  mirrored; its discovery winners and confirmations are counted the same way.
- After-cost figures are reported beside every pass; a pass before costs that loses after costs is not tradable.
- **Verdict**: PASS when at least one cell passes confirmation AND the placebo has fewer confirmed cells than the real grid;
  FAIL otherwise; INCONCLUSIVE when fewer than 20 cells reach n >= 100 in discovery.

## Checks

- Cut test: on random cut times, every storyline signal (side, CF time, factors, entry, stop) known by the cut from the
  whole series equals the one computed on candles cut there.
- Gate: every simulated trade has risk > 0 with the stop on the losing side.

Nothing of `market-structure.html`, `assets/`, `council/`, `research/edge/_lib/` or any other study is edited.
