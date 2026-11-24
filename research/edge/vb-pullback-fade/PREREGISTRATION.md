# Breakout day, then fade the pullback: the M15 Break fade split by the day's T1 breakout (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

Two Equinox families meet here. The T1 volatility breakout (gold, USD/JPY: buy / sell stop at the UTC open +/- 0.5 x the previous
folded day's range, stop back at the open, out at 21:00 UTC) passed at the broker's own quotes on gold and USD/JPY. The M15
Break fade (`grid7-wide-fade` cell `m15 none atr 2R all`: fade every M15 structure break at the next 5-minute open, stop 1 ATR(14)
of M15, 2R target, out after 1 day) tilts positive before costs (+0.042R a trade in 2015-26, `fade-mtf-context`) but loses after
costs on every market. Question: once a day's breakout has filled and the day's direction is known, do the fades that point WITH
that direction (an M15 break against the breakout, i.e. a pullback, faded back the breakout's way) make money AFTER costs where
plain fades do not? No study in `research/edge/` splits the fade by the breakout (checked: `fade-conditions`, `fade-htf`,
`fade-mtf-context`, `vb-structure-filter`, `vb-retest-limit` ask other questions).

## Data and code (imported, never edited)

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs` `load`, from 2004-01-01).
- Markets: **xau, usdjpy** (the two markets where T1 runs).
- Breakout days: gold with `gold-vol-breakout-hourcost/original.mjs` (`buildDays`, `daySkip`, `vbTrade`, k = `costs.mjs` T1.k =
  0.5, both sides, cost 0); USD/JPY with `index-vol-breakout/original.mjs` (the same three functions, k = `fx-vol-breakout` `K` =
  0.5), exactly as `council/edge-desks-2.mjs` reads the two Equinox breakout desks. A day is a **breakout day** when `vbTrade`
  returns a fill; its direction D = the fill's side (+1 buy, -1 sell) and its fill candle starts at fillT. A day is a **no-fill
  day** when `daySkip` is null and `vbTrade` returns `skip: 'nofill'`. Days skipped for any other reason are in neither set.
- Fade signals: `grid7-wide-fade` `signals(frames(M5))` (`combo-grid-3` `frames`), trigger timeframe M15, context `none`; the
  trade exactly as its `runMarket` builds cell `m15 none atr 2R all`: side s = -d (against the M15 break), fill = open of the
  first 5-minute candle starting at or after the break candle's close, stop = fill + d x ATR(14) of M15, target 2R, `exits()`
  with the 1-day cap; a fill inside `combo-grid-2` `exclusions(market)` is dropped; risk under the round-trip cost is no trade;
  every trade has its stop on the losing side. Trades overlap freely (as the parent).
- Costs = the fade's own parent costs, `combo-grid-2` `COSTS`: gold $0.30 and USD/JPY 0.008 a round trip (the demo figures of
  `edgekit`, not assumed), charged as cost / risk on every trade.

## Which fades belong to which day (closed candles only)

A fade signal belongs to a UTC day when its M15 break candle closes (ts) inside [day start, day start + 21:00 UTC).
- On a breakout day only signals with ts >= fillT + 300 (the close of the 5-minute candle in which the breakout filled) count:
  the breakout is known before the break that is faded. Earlier signals of that day are in no set.
  - **WITH** = s = D (the fade points the breakout's way: a pullback break faded).
  - **AGAINST** = s = -D.
- **CONTROL** = every signal of a no-fill day (whole 00:00-21:00 UTC window).

## Windows (by the fade's fill time)

- **Discovery 2007-01-01 to 2015-12-31** (108 months): gold's breakout studies start in 2007 (`gold-vol-breakout-hourcost`
  windows), USD/JPY's early study reads 2005-15; 2007 is the common start.
- **Confirmation 2016-01-01 to 2026-10-31** (130 months): the breakout studies' own later window (2016 on).
- Month sums over every calendar month of the window, an empty month as 0; month-sum t = mean / (sd / sqrt(months)).

## The tests (3, fixed here; markets pooled)

- **T1** WITH fades, R after costs: n >= 200 in each window; mean > 0 in both windows; month-sum t >= 2 in confirmation; Holm p <
  0.05 (one-sided, from the confirmation month-sum t, df = months - 1).
- **T2** AGAINST fades, the same bar.
- **T3** WITH minus CONTROL, per-trade R after costs: difference > 0 in both windows, Welch t >= 2 in confirmation, Holm p < 0.05
  (one-sided, normal from Welch t).

Holm over the three confirmation p values. **Verdict: PASS** if T1 and T3 both pass (with-breakout fades make money after costs
and beat plain fades), or if T2 passes; **FAIL** otherwise. INCONCLUSIVE only if a market's data cannot be read.

## Also reported (not part of the bar)

R before costs, cost R, win rate, per market; CONTROL after costs (the plain-fade control); WITH minus AGAINST; the first WITH
fade of each breakout day only; a no-look-ahead cut test (signals and day labels known at a cut date equal the full run's).
One run, no variants.
