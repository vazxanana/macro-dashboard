# Wide Mosha grid: the storyline's CF traded with it and faded (pre-registration, 23 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

In `research/edge/grid6-mosha-market` the storyline (a BO on the upper timeframe, the VR = the first lower-timeframe break
against it, the CF = the next lower-timeframe break back with it) found FEWER discovery winners than chance gives (354 vs about
369), while its side-flipped placebo (the same fills traded the other way) found three times as many (1,155). In
`research/edge/grid7-wide-fade`, fading the first structure break at market had a small before-cost tilt in both 2005-14 and
2015-26 on ten markets (e.g. M15, 1 ATR stop, 2R: +0.054R / +0.042R a trade, month t 11.4 / 11.3) and lost after costs.

This study asks, with few cells fixed below and 22 years of data, two questions: (a) does trading WITH the CF (the method) make
money before costs, and (b) does FADING the CF make money before costs, AND does the storyline context pick better trades than
the plain rule on the same lower timeframe (the control)? If (b) only matches its control, the placebo result of grid 6 was the
general fade tilt, not something the storyline adds.

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs` `load`, `fetch-cache.mjs`, `EDGE_DATA` on
  the machine that runs it), loaded from 2004-01-01 for warm-up.
- Markets (10): xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy (gold and silver from where OANDA's
  history starts). Pooled.
- Timeframes from the 5-minute candles with `grid6-mosha-market`'s `frames` (imported): 15m, 30m, 1h, 4h (UTC buckets), 1d.
- Exclusions: `combo-grid-2`'s `exclusions(market)`; a trade whose fill falls in a bad interval is dropped.
- Windows by fill time: **discovery 2005-01-01 to 2014-12-31** (120 months), **confirmation 2015-01-01 to 2026-10-31**
  (142 months), `grid7-wide-core`'s `FROM` / `SPLIT` / `TO` / `monthOf`. Month sums count every calendar month, an empty month as 0.

## The storyline (closed candles only; imported, never edited)

`grid6-mosha-market` `storylines(F, h, v, 'any', [], cache)`, break type "any" (`edgekit` `structure(bars, 3)` on both
timeframes; the Daily MSNR call is not used, so an empty call list is passed). For each BO (a structure event on the upper
timeframe h, direction d): the VR = the first structure event on the lower timeframe v AGAINST d after the BO candle closed and
before the next upper event; x = the move's extreme from the BO candle's start to the VR break; the CF = the next lower event
WITH d after the VR whose level is not beyond x, and before price reaches x; its candle index `cfIdx`; the CF zone's far side o;
the VR leg's extreme vx (the pullback low for d = +1); the BO level L; `inside` = the CF zone (between o and the CF level)
overlaps the VR box (between x and vx). The storyline is known at the close of the CF candle.

Ladders (h > v): **H4 > H1, H1 > M15, M30 > M5.**

## The trades (every one at market at the next 5-minute open after the CF candle's close; never a limit)

Fill = the open of the first 5-minute candle starting at or after the CF candle's close (`dom-trade-through` `startIdx`).
ATR = `dom-trade-through` `atr14` of the lower timeframe v at the CF candle.

- **(a) WITH the CF** (side d): stop = vx - d * 0.1 * ATR (past the VR leg's extreme). Exits: 1R, 2R, and "struct" = the
  move's extreme x.
- **(b) AGAINST the CF, the fade** (side -d): stop = the CF candle's extreme (its high for d = +1) + d * 0.1 * ATR. Exits: 1R,
  2R, and "struct" = the BO level L.
- A structural target is used only when it is 1R or more away on the winning side of the fill; otherwise that storyline gives no
  trade in the "struct" cells (it still gives the 1R and 2R trades).
- No trade when the stop is not on the losing side of the fill, or when the risk (fill to stop) is under the market's round-trip
  cost (the `grid7-wide-fade` rule, applied to cells and controls alike). Every trade has a stop on its losing side; the run
  throws otherwise.
- Management: `grid7-wide-fade` `exits` (imported): stop first in a 5-minute candle that holds both, a candle opening past the
  stop or a target exits at its open, time limit = `grid7-wide-fade` `CAP` of the lower timeframe (H1 2 days, M15 1 day, M5 8
  hours) at the close of the first candle closing at or after it. One trade per storyline, side and exit.

## Cells (54, every one fixed here)

side (with, fade) x ladder (H4>H1, H1>M15, M30>M5) x CF place (any, clear = the CF zone does not overlap the VR box, inside =
it does) x exit (1R, 2R, struct) = 2 x 3 x 3 x 3 = **54**.

## Controls (named here)

- **(b) fade**: the plain `grid7-wide-fade` rule on the same lower timeframe, context "none": EVERY structure event on v
  (`grid7-wide-fade` `breaks`, imported), faded at the next 5-minute open, stop past the break candle's extreme + 0.1 ATR (the
  "ext" stop), the same exits 1R / 2R; the "struct" cells are compared with the control's "swing" exit (the opposite swing
  standing at the break, `grid7-wide-fade`'s third exit). Same cost filter, cap, exclusions and windows. (The CF break is one of
  these events, so each fade cell's trades are a subset of its control's.)
- **(a) with**: every structure event on v traded WITH the break at the next 5-minute open, stop past the break leg's origin
  extreme (the lowest low from the broken swing's candle to the break candle for d = +1, `grid7-wide-core`'s trigger stop, here
  with 3 candles a side) - d * 0.1 ATR; exits 1R and 2R; the "struct" cells are compared with this control's 2R.

## The bar (pre-registered; before costs)

A cell passes only when ALL hold:

1. n >= 300 trades in each window;
2. mean R > 0 and month-sum t >= 2 in discovery, and the same in confirmation;
3. Holm-adjusted one-sided p (from the confirmation month t, `grid7-wide-core` `p1`) < 0.05 over the 54 confirmation tests;
4. it beats its control: Welch t (cell trades against control trades, R before costs; `grid7-wide-core` `welch`) >= 2 in
   BOTH windows.

Verdict: PASS if at least one cell passes; FAIL if none; INCONCLUSIVE if fewer than 8 markets could be loaded. A pass is a
before-cost result only: after costs (`combo-grid-2` `COSTS`, round trip in price; the demo's figures for xau and the four
majors, **ASSUMED, not measured** for xag, nzdusd, usdcad, usdchf, eurjpy) is reported beside, never part of the bar, and no
cell is called an edge.

## Reported beside (not part of the bar)

- Every cell: n, mean R, month t for both windows, after-cost mean, the control's figures and the Welch t.
- The side-flipped check: each cell traded the other way from the same fill, stop at the same distance on the other side,
  targets at the same R (as `grid7-wide-fade`'s mirror); how many flipped cells clear bars 1-3.
- Per-market rows for any passing cell.
- A cut test: storylines known by a cut date equal the ones computed on candles cut there (several markets, several cuts).

One run, no variants. Nothing live changes whatever the result.
