# Grid 7: the Mosha storyline and the market cycle on ten markets and 22 years, few cells (pre-registration)

Written 23 Nov 2026, before any run of this study. Research only: nothing live changes, nothing is placed.

## Why

The grids of 22-23 Nov 2026 tested thousands of cells on five markets with a 2010-2014 discovery window; they landed at
chance, and the one cell that confirmed failed its holdout (`research/edge/msnr-box-holdout`). This study turns that round:
FEW cells (54, every one fixed below), ten markets and long windows, so that a real tilt of about +0.05R a trade would show
with a month-sum t well above 2 and chance has little room. One run, no variants added after it.

## Data

OANDA mid 5-minute and daily candles of the edgekit cache (`research/edge/_lib/edgekit.mjs`, `EDGE_DATA`), fetched with
`research/edge/_lib/fetch-cache.mjs`: xau xag eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy, 2004 (warm-up only)
to 31 Oct 2026. 15m / 1h / 4h = UTC buckets of the 5m candles (`resample`); D1 = 17:00 New York trading days (`dailyNY`).
Bad intervals of `research/edge/data-quality/quality.json` (`exclusions()` of `research/edge/combo-grid-2/run.mjs`): a trade
whose fill-to-exit span touches one is dropped. Said plainly: the 2005-2009 years of the five read markets and the five other
markets were kept as an untouched holdout by the studies of 22-23 Nov; this study reads them (it is the first to).

- **Discovery**: trades filled 2005-01-01 to 2014-12-31 (120 months).
- **Confirmation**: trades filled 2015-01-01 to 2026-10-31 (142 months).

Costs: `COSTS` of `research/edge/combo-grid-2/run.mjs` (round trip in price units, the same for every year). The figures for
nzdusd, usdcad, usdchf, eurjpy and xag are ASSUMED, not measured on the demo account. The judgement is BEFORE costs; every
figure after costs is reported beside it.

## The readings (closed candles only)

Every reading is a market entry at the close of its trigger candle, filled at that close and managed on 5m candles from the
next 5m candle. Every trade has its stop on the losing side of the fill; a trade whose stop is not is not built.

1. **Mosha storyline (BO, VR, CF)**: the signals of `research/edge/grid5-mosha-cycle/run.mjs` `storylines` (imported,
   never edited; the page's own `msAnalyze` through `council/mosha-desk.mjs` `loadFns`): BO = a break of the upper
   timeframe (N 6); VR = the first BO Structure against it on the lower timeframe (N 3); CF = the next BO Structure with
   it on the same lower timeframe, before the move reached the VR's extreme. Ladders H4->H1 and H1->M15. Entry = market at
   the CF candle's close; stop = past the CF zone's far side (the pullback extreme before the CF) by 0.1 x ATR(14) of the
   CF timeframe (grid 5's `MKT-cfz`). Variant: CF zone clear of the VR box vs inside it (grid 5's `inVR`).
2. **Cycle (pullback end)**: the definitions of `research/edge/_lib/phase.mjs` (edgekit `structure(bars, 3)` on H4 and H1,
   read event by event over the whole series): H4 side d = the side of the last H4 break. After it, the first H1 break
   against d starts the pullback; the first H1 break with d after that ends it (the ChoCh back with H4): the trigger. One
   trigger per H4 break. Variant: the pullback went past 50 % of the H4 leg (the leg's extreme back to the pullback's
   extreme is at least half of the leg's range, the leg as `readTf`'s external range of closed H4 candles) vs not.
3. **Continuation**: the same H4 leg after the cycle trigger: the next H1 break with d, with no H1 break against d in
   between: the trigger. At most one per H4 break. Variant: the pullback before it past 50 % vs not (the same pullback).
4. **Control**: every H1 structure break (edgekit `structure(H1, 3)`, either kind) is a candidate control trade. For each
   real trade of a cell a control trade is drawn at random (seeded) from the same market, the same calendar month and the
   same side, with the same exit, the same time limit and a valid target for that exit. Control cells are these matched
   draws (one per real trade, with replacement).

Stops of the H1-break triggers (2, 3, 4): the extreme of the H1 candles from the broken swing to the break candle (lowest
low for a buy), past it by 0.1 x ATR(14) of H1.

**Daily MSNR call**: `council/eg-methods.mjs` `direction()` (imported) on H4 candles with the Daily trading days as the
timeframe above, as `research/edge/grid5-msnr-box/run.mjs` `h4Calls` does (imported); the call of the last H4 candle closed by
the trigger close. "Agreeing" = the call equals the trade's side.

## Exits

- **1R**, **2R**: fixed targets.
- **ext**: the H4 leg's extreme = `readTf`'s external range of the H4 candles closed by the trigger close (the leg of the last
  H4 break: for a buy its high, for a sell its low); only when it is 1R or more ahead of the fill, else the trade is not in
  that cell.

A candle that opens past the stop or the target exits at its open; a candle holding both is a stop. Time limit at the close:
5 days for readings 2, 3 and Mosha H4->H1; 2 days for Mosha H1->M15 (the control is simulated with the cell's own limit).

## Cells (54)

| Reading | Variants | Exits | Cells | With MSNR agreeing | Total |
|---|---|---|---:|---:|---:|
| Mosha | 2 ladders x CF clear / inside | 3 | 12 | 12 | 24 |
| Cycle | past 50 % / not | 3 | 6 | 6 | 12 |
| Continuation | past 50 % / not | 3 | 6 | 6 | 12 |
| Control (every H1 break, unmatched) | - | 3 | 3 | 3 | 6 |

All cells pool the ten markets. The six unmatched control cells are reported and judged like the others (they are the
plain baseline); the matched control draws are drawn per real cell.

## Judgement (before costs; month-sum t over a fixed calendar, empty months = 0)

A cell **passes** when all of these hold:

- n >= 300 in discovery AND n >= 300 in confirmation;
- mean R > 0 and month-sum t >= 2 in discovery AND in confirmation;
- its confirmation p (two-sided, df = 141) after Holm over all 54 cells is at most 0.05;
- it beats its matched control at the same exit: Welch t (trades, real minus control) >= 2 in discovery AND in confirmation
  (the six control cells cannot pass this line and therefore cannot pass).

**Placebo**: every trade of every cell traded the other way at the same fill moment and price, its stop and target mirrored;
the same bar is applied to it and its passes are counted.

**Verdict**: PASS when at least one cell passes and the placebo has fewer passing cells than the real readings; FAIL
otherwise; INCONCLUSIVE when fewer than 10 of the 48 non-control cells reach n >= 300 in both windows.

Reported for every cell: n, mean R, month t, in both windows, before and after costs; the matched control's mean R and the
Welch t; the placebo's figures. For any passing cell: one row per market.

## Checks

- Cut test: on random cut times, every signal (reading, side, trigger time, stop, ext, variant, MSNR call) known by the cut
  from the whole series equals the one computed on candles cut there.
- Gate: every simulated trade has risk > 0 with the stop on the losing side.

Nothing of `market-structure.html`, `assets/`, `council/`, `research/edge/_lib/` or any other study is edited.
