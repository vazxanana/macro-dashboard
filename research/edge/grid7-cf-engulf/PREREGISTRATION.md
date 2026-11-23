# Grid 7: the Mosha CF that is also an engulf, or breaks an opposite engulf zone (pre-registration)

Written 23 Nov 2026, before any run of this study. Research only: nothing live changes, nothing is placed.

## Why

Two of the desk's signals can sit on the same candle: the CF of the Mosha storyline (BO on the upper timeframe, VR = the
first break against it on the lower timeframe, CF = the next break back with the BO) and an engulf. The question is whether a
CF candle that is ALSO an engulf of the BO's side, or that closes through an engulf zone of the other side (an EF), makes
better trades than a CF that is neither. Built on the wide design of `research/edge/grid7-wide-core` and
`research/edge/grid7-wide-mosha-cycle`: few cells (48, every one fixed below), ten markets pooled, long windows. One run, no
variants added after it.

## Data

OANDA mid 5-minute candles of the edgekit cache (`research/edge/_lib/edgekit.mjs`, `EDGE_DATA`), fetched with
`research/edge/_lib/fetch-cache.mjs`: xau xag eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy, 2004 (warm-up only)
to 31 Oct 2026. 30m / 1h / 4h = UTC buckets of the 5m candles (`resample`). Bad intervals of
`research/edge/data-quality/quality.json` (`exclusions()` of `research/edge/combo-grid-2/run.mjs`): a trade whose
fill-to-exit span touches one is dropped.

- **Discovery**: trades whose CF closed 2005-01-01 to 2014-12-31 (120 months).
- **Confirmation**: 2015-01-01 to 2026-10-31 (142 months).

Costs: `COSTS` of `research/edge/combo-grid-2/run.mjs` (round trip in price units, the same for every year). The figures for
xag, nzdusd, usdcad, usdchf and eurjpy are ASSUMED, not measured. The judgement is BEFORE costs; every figure after costs is
reported beside it.

## The signal (closed candles only)

**Storyline**: `research/edge/grid5-mosha-cycle/run.mjs` `storylines` (imported, never edited; the page's own structure engine
through `council/mosha-desk.mjs` `loadFns`), with the CF read on the VR's timeframe. BO = a break of the upper timeframe
(N 6); VR = the first BO Structure against it on the lower timeframe (N 3); CF = the next BO Structure with the BO on the
same lower timeframe, before price reached the far end of the VR's move. Its fields used here: side d, the CF candle, the
pullback extreme between the VR's far end and the CF (`origin`), the far end of the move before the VR (`x`, "the VR
extreme"), and whether the CF zone overlaps the VR box (`inVR`: "inside" vs "clear"). Ladders: **H4->H1**, **H1->M15**,
**M30->M5**. (The market-cycle stage of that function is not used and not computed.)

**Engulf flags of the CF candle** (`council/eg-methods.mjs`, imported, 3-candle span `EG_SPAN`), on the lower timeframe:

- **EG**: `engulfAt(C, cf, 3)` gives an engulf of side d on the CF candle (the CF candle, or the pair ending on it, closes
  beyond the last opposite-colour candle within 3 candles).
- **EF**: an engulf zone of side -d of `zones(C, tf, 3)` is first closed through (its `fi`) by the CF candle itself: the CF
  breaks out of an opposite engulf zone.

A CF may carry both, one or neither.

## Trades

Market entry at the open of the first 5-minute candle that starts at or after the CF candle's close. Every trade has its
stop on the losing side of the fill; a trade whose stop is not is not built (counted).

- **With the BO** (the method): side d; stop past the pullback extreme (`origin`) by 0.1 x ATR(14) of the CF timeframe.
  Exits 1R, 2R and **ext** = the VR extreme `x`, only when it is 1R or more ahead of the fill (else the trade is not in that
  cell).
- **Against the BO**: side -d; stop past the CF candle's extreme (its high when d is up, its low when d is down) by
  0.1 x ATR(14) of the CF timeframe. Exits 1R and 2R.

Managed on 5m candles from the fill candle (`manage` of grid 5, imported): a candle that opens past the stop or target exits
at its open; a candle holding both is a stop. Time limit: 5 days (H4->H1), 2 days (H1->M15), 1 day (M30->M5), at the close.

## Cells (48)

| Set | Ladders | Signal | Place | Exits | Cells |
|---|---:|---|---|---|---:|
| With the BO | 3 | EG / EF | clear / inside | 1R, 2R, ext | 36 |
| Against the BO | 3 | EG / EF | pooled | 1R, 2R | 12 |

All cells pool the ten markets.

## Controls

1. **Primary, plain CF**: for an EG cell, every CF trade of the same ladder, set, place and exit whose CF candle is NOT an
   EG; for an EF cell, every one whose CF is NOT an EF. Test: Welch t (trades, signal minus plain) in each window.
2. **Secondary, no storyline** (reported, not judged): for each real trade a random candle (seeded) of the same lower
   timeframe, the same market, the same calendar month, carrying the same signal of the same side d (an engulf of side d for
   EG; the first close through a zone of side -d for EF) and NOT a CF candle of that ladder, traded the same way: same set
   (with / against d), market at the next 5m open, the stop at the same distance in ATR(14) of that timeframe as the real
   trade, the same exits (ext at the real trade's own R multiple), the same time limit. Welch t reported.

## Judgement (before costs; month-sum t over a fixed calendar, empty months = 0)

A cell **passes** when all hold:

- n >= 300 in discovery AND in confirmation;
- mean R > 0 and month-sum t >= 2 in discovery AND in confirmation;
- its confirmation p (two-sided, df = 141) after Holm over all 48 cells is at most 0.05;
- it beats its plain-CF control: Welch t >= 2 in discovery AND in confirmation.

**Side-flipped check (placebo)**: every trade of every cell traded the other way at the same fill, its stop and target
mirrored around the fill; the same bar applied, its passes counted.

**Verdict**: PASS when at least one cell passes and the placebo has fewer passing cells; FAIL otherwise; INCONCLUSIVE when
fewer than 10 of the 48 cells reach n >= 300 in both windows.

Reported for every cell: n, mean R, month t in both windows, before and after costs; the plain-CF control's n, mean R and
Welch t; the secondary control's; the placebo's figures. For any passing cell: one row per market.

## Checks

- Cut test: on random cut times, every signal (ladder, side, CF close, fill candle, stop, VR extreme, place, EG, EF) known by
  the cut from the whole series equals the one computed on candles cut there.
- Gate: every simulated trade has risk > 0 with its stop on the losing side.

Nothing of `market-structure.html`, `assets/`, `council/`, `research/edge/_lib/` or any other study is edited.
