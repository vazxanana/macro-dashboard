# FVG return taken only with the day's volatility breakout (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

Two Equinox desks meet here. The FVG return (`grid7-fvg-wide` cell `1h mkt large 1R`: a three-candle H1 fair-value gap larger
than the market's 2005-14 median, market with the gap at the next 5-minute open after the first M15 close inside it, stop past
its far side + 0.1 ATR, 1R, out after two days) tilts positive before costs (+0.035R a trade in 2015-26, month t 7.27) and
loses after costs (-0.113R). The T1 volatility breakout (UTC open +/- 0.5 x the previous day's range, stop back at the open, out
at 21:00 UTC) passed on gold and USD/JPY. Question: once a day's breakout has filled and the day's direction is known, does the
FVG return taken only in that direction (a continuation entry on the pullback into the gap) pay AFTER costs where the plain FVG
return does not? Checked first: `grid7-fvg-wide`, `fvg-htf-exits` (H4 / D1, other exits, no breakout split), `vb-pullback-fade`
(the M15 Break fade split by the breakout, not the FVG), `vb-retest-limit` (the breakout's own entry on a retest) and
`vb-structure-filter` ask other questions; this split is not answered in `research/edge/`.

## Data and code (imported, never edited)

- OANDA mid 5-minute candles, shared cache (`research/edge/_lib/edgekit.mjs` `load`, from 2004-01-01 to 2026-11-01).
- Markets: **xau, eurusd, gbpusd, usdjpy, audusd, usdcad, usdchf** = the markets of both families (the FVG grid's ten intersected
  with gold + the six forex majors of `fx-vol-breakout`).
- FVG trades: `grid7-fvg-wide` `signals(M5, market, med)` with `med` = that study's own 2005-14 medians from its `result.json`
  (as `council/edge-desks-2.mjs` `fvgTrades` reads the desk); kept: real bands (`ctl` 0), timeframe 1h, entry kind 0 (mkt),
  `large`; the trade exactly as its `runMarket` builds it: fill = the signal's fill, its stop, `combo-grid-2` `exclusions(market)`
  dropped, risk under the round-trip cost dropped, `dom-trade-through` `manage(M5, s, fi, fill, stop, CAP['1h'], firstFull)` and
  its 1R result `R[0]`.
- Breakout days: gold with `gold-vol-breakout-hourcost/original.mjs`, k = `costs.mjs` `T1.k` (0.5); forex with
  `index-vol-breakout/original.mjs`, k = `fx-vol-breakout` `K` (0.5); `buildDays`, `daySkip`, `vbTrade(…, sides 'both', cost 0)`,
  exactly as `vb-pullback-fade` and the Equinox desks read them. A day is a **breakout day** when `vbTrade` fills: direction D =
  its side, fill candle start fillT. A **no-fill day** when `daySkip` is null and `vbTrade` returns `nofill`. Other days: no set.
- Costs: `combo-grid-2` `COSTS` (the FVG's parent costs) charged as cost / risk on every trade: gold $0.30, EUR/USD 0.00006,
  GBP/USD 0.00008, USD/JPY 0.008, AUD/USD 0.00006 (demo figures); **USD/CAD and USD/CHF 0.00007 ASSUMED, not measured**.

## Sets (closed candles only)

An FVG trade belongs to the UTC day d0 of its decision time et (the close of the M15 candle that closed inside the gap), only when
et - d0 < 21:00 UTC.
- On a breakout day only trades with et >= fillT + 300 (the breakout's fill candle has closed) count; earlier ones are in no set.
  **WITH** = the FVG side equals D; **AGAINST** = the other side.
- **CONTROL** = every FVG trade of a no-fill day (00:00-21:00 UTC).
- **ALL** = every FVG trade of the cell (no day filter), reported beside, as the plain desk rule.
- **REST** = every FVG trade of the cell that is not WITH.

## Windows

Discovery = fills 2005-01 to 2014-12 (gold from March 2006, its first candles), confirmation = 2015-01 to 2026-10: the FVG
parent's own windows. The breakout rule is only a day label here; its forex years 2005-26 were read by earlier studies (said).

## Tests (three, Holm over their one-sided confirmation p)

- **T1 WITH after costs**: n >= 200 in each window, mean net R > 0 in BOTH windows, confirmation month-sum t >= 2, Holm p < 0.05,
  AND the placebo below passes.
- **T2 WITH minus REST after costs** (Welch on trades): difference > 0 in both windows, confirmation Welch t >= 2, Holm p < 0.05.
- **T3 WITH minus AGAINST after costs** (Welch on trades): same bar.
- Verdict **PASS** only when T1 passes (T2 / T3 alone never make a pass: a better subset that still loses is not a rule).

## Control / placebo (random-day matched sample)

40 seeded draws: for every WITH trade a random FVG trade of the SAME market, SAME side and SAME window, from ANY other UTC day
(drawn with replacement from the cell's trades); the draw's mean net R. T1's placebo passes when the WITH mean net R in the
confirmation window beats at least 38 of 40 draws. The no-fill-day CONTROL set is reported beside.

## Month sums

Calendar months of the fill (UTC), empty months 0, discovery 120 months, confirmation 142 months; t = mean / (sd / sqrt n).

## No look-ahead

A cut test: day labels and the set of every FVG signal known by five cut dates (computed on candles cut there) equal the full
run's (0 missing / 0 extra required on xau and usdjpy).

## What it does not do

No other cell, exit, k, timeframe or market; no variants after the result. Trades overlap freely (as the parent). Today's costs
charged on every year.
