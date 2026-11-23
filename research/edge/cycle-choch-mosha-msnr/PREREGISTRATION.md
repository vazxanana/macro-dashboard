# The market cycle read three ways at once: H1 ChoCh, H4 stage, the Daily MSNR call, the Mosha CF (pre-registration)

Written 23 Nov 2026, before any run of this study. Research only: nothing live changes, nothing is placed.

## Why

The owner reads the market cycle with three lenses together: where H4 is in its cycle (move, pullback, continuation), the
Daily direction call of the MSNR procedure, and the Mosha storyline (BO, VR, CF). The grids of 23 Nov tested these pieces
mostly one at a time or as entries of their own (`grid7-wide-mosha-cycle`, `grid7-wide-trend-pullback`: FAIL). This study
takes ONE trigger, the H1 change of character, labels each one with all four readings at once, and asks whether any
combination, the "everything aligned" one above all, trades better than every H1 ChoCh. One run, no variants added after it.

## Data

OANDA mid 5-minute and daily candles of the edgekit cache (`research/edge/_lib/edgekit.mjs`, `EDGE_DATA`), fetched with
`research/edge/_lib/fetch-cache.mjs`: xau xag eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy, 2004 (warm-up only)
to 31 Oct 2026. 15m / 1h / 4h = UTC buckets of the 5m candles (`resample`, through `research/edge/grid5-mosha-cycle/run.mjs`
`frames`); D1 = 17:00 New York trading days (`dailyNY`). Bad intervals of `research/edge/data-quality/quality.json`
(`exclusions()` of `research/edge/combo-grid-2/run.mjs`): a trade whose fill-to-exit span touches one is dropped.

- **Discovery**: trades whose trigger closes 2005-01-01 to 2014-12-31 (120 months).
- **Confirmation**: 2015-01-01 to 2026-10-31 (142 months).

Costs: `COSTS` of `research/edge/combo-grid-2/run.mjs` (round trip in price units, the same for every year). The figures for
xag, nzdusd, usdcad, usdchf and eurjpy are ASSUMED, not measured on the demo account. The judgement is BEFORE costs; every
figure after costs is reported beside it.

## The trigger (closed candles only)

**H1 ChoCh**: edgekit `structure(H1, 3)` (3-a-side swings, a swing is used once confirmed): a close beyond the last
confirmed H1 swing AGAINST the side H1 held (event kind `ChoCh`). Direction d = the side of the break. Known at the close of
its H1 candle, time T.

**Entry**: at market, the open of the first 5-minute candle that starts at or after T. **Stop**: past the ChoCh's swing: the
extreme of the H1 candles from the broken swing to the break candle (lowest low for a buy), past it by 0.1 x ATR(14) of H1
(the same `h1Stop` as `grid7-wide-mosha-cycle`). A trade whose stop is not on the losing side of the fill is not built.

**Exits** (each its own cell):

- **1R**, **2R**: fixed targets.
- **ext**: the H4 leg's extreme: the external range of the last H4 break known by T (H4 candles closed by T; the leg from the
  broken swing to the furthest price since, as `grid7-wide-mosha-cycle` `legAt`), its high for a buy, its low for a sell,
  only when it is 1R or more ahead of the fill, else the trade is not in that cell.

A candle that opens past the stop or the target exits at its open; a candle holding both is a stop; out at the close of the
first 5m candle closing 5 days after the fill. Management: `research/edge/grid5-mosha-cycle/run.mjs` `manage` (imported).

## The four readings at T

**(a) H4 cycle position** (the definitions of `research/edge/_lib/phase.mjs`, computed event by event on the whole series:
edgekit `structure(H4, 3)` and `structure(H1, 3)`). H4 side d4 = the side of the last H4 break known by T. Stage of H4 just
BEFORE this ChoCh, read from the H1 breaks after that H4 break and before T: no H1 break against d4 = `move`; an H1 break
against d4 and none back with it = `pullback`; one back with it after that = `continuation`; the last two H4 breaks both
ChoChs with no H4 BO the same way before them = `range` (phase.mjs's rule). Then:

- **pullback end**: the stage is `pullback` and the ChoCh is WITH d4 (H1 turns back with H4).
- **pullback start**: the stage is `move` and the ChoCh is AGAINST d4 (an H4 pullback begins).
- **other, with**: any other ChoCh with d4.
- **other, against**: any other ChoCh against d4.

**(b) Daily MSNR call**: `council/eg-methods.mjs` `direction()` (imported) on H4 candles with the Daily trading days as the
timeframe above, through `research/edge/grid5-msnr-box/run.mjs` `h4Calls` (imported): the call of the last H4 candle closed
by T. `agrees` = the call equals d; otherwise (the other side, or no call) `not`.

**(c) Mosha CF of an H4 BO**: `research/edge/grid5-mosha-cycle/run.mjs` `storylines(F, Fn, '4h', '1h', '1h')` (imported;
the page's own structure engine through `council/mosha-desk.mjs` `loadFns`): BO = an H4 break (N 6), VR = the first BO
Structure against it on H1 (N 3), CF = the next BO Structure with it on H1 before the move reached the VR's extreme. The
ChoCh **is a CF** when such a storyline has the same side and its CF break candle is the SAME H1 candle (CF known at T).
Otherwise `no`. (Two structure engines read the same candles; an exact candle match is required, nothing looser.)

**(d) H4 pullback depth**: on the H4 leg of (a)'s last H4 break (H4 candles closed by T): how far price has come back from
the leg's extreme toward its origin, measured on H1 candles closed by T from the H4 candle of the extreme on, as a share of
the leg's range. `past 50%` (>= 0.5) or `under 50%`.

## Cells (51, fixed here)

Combinations (a) x (b) x (c) x (d), trimmed:

| (a) | split by | combinations |
|---|---|---:|
| pullback end | (b) agrees / not x (c) CF / no x (d) past / under 50% | 8 |
| other, with | (b) x (c) | 4 |
| pullback start | (b) | 2 |
| other, against | (b) | 2 |
| **control**: every H1 ChoCh, unsplit | - | 1 |

17 combinations x 3 exits = **51 cells**. A Mosha CF is with its BO, so (c) is split only on the with-H4 rows; depth is
split only on the pullback end, where it means something.

**Named in advance, the all-aligned cell**: pullback end, MSNR agrees, a Mosha CF, past 50% (each of its three exits).

## Judgement (before costs; month-sum t over a fixed calendar, empty months = 0)

A cell (not the control) **passes** when all of these hold:

- n >= 300 in discovery AND n >= 300 in confirmation;
- mean R > 0 and month-sum t >= 2 in discovery AND in confirmation;
- its confirmation p (two-sided, df = 141) after Holm over the 48 non-control cells is at most 0.05;
- it beats the control at the same exit: Welch t (trades of the cell against every H1 ChoCh at that exit) >= 2 in discovery
  AND in confirmation.

**Side-flipped check (placebo)**: every trade of every cell traded the other way at the same fill, its stop and the ext
target mirrored around the fill; the same bar is applied and its passes are counted.

**Verdict**: PASS when at least one cell passes and the placebo has fewer passing cells; FAIL otherwise; INCONCLUSIVE when
fewer than 10 of the 48 non-control cells reach n >= 300 in both windows.

Reported for every cell (the all-aligned cell whatever its n): n, mean R, month t in both windows, before and after costs;
the Welch t against the control; the placebo's figures. For any passing cell: one row per market.

## Checks

- Cut test: on random cut times, every trigger with its readings (side, T, stop, ext, (a)-(d)) known by the cut from the
  whole series equals the one computed on candles cut there.
- Gate: every simulated trade has risk > 0 with the stop on the losing side.
- A sample of (a) compared with `phase.mjs` `readPhase` itself (agreement reported, not judged).

Nothing of `market-structure.html`, `assets/`, `council/`, `research/edge/_lib/` or any other study is edited.
