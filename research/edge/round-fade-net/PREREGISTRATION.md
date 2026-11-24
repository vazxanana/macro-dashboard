# Round-number fade after costs: higher timeframes and complements from the other studies (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

`research/edge/round-number-breaks` passed its bar before costs (4 of 48 cells, all "fade a 15-minute close through a round
number, 2R"; best +0.051R a trade, month t 8.68), but every cell loses after costs (about -0.31R: the round trip takes about
0.33R of each M15 trade), and the same fade through a NOT-round grid did as well, so the round number itself adds nothing.
What was missing is a way past the cost. This study asks one question, judged AFTER costs: does the fade of a close through a
round level make money net when (1) it is read on a higher timeframe, where the stop is wider and the round trip a smaller
share of 1R, and (2) it is combined with elements the other studies use: an exhaustion candle, the quiet session, and the
extreme of the daily range? Every cell is fixed below; one run, no variants.

## Data

As `round-number-breaks` (imported: its levels, events, `STEPS`, the `grid7-wide-fade` trade engine): OANDA mid 5-minute
candles, the same ten markets pooled (xau, xag, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy), the
data-quality exclusions, discovery = fills 2005-01-01 to 2014-12-31, confirmation = fills 2015-01-01 to 2026-10-31, month sums
counting empty months as 0. Costs: `combo-grid-2` `COSTS`, the demo figures for gold and the four majors, **ASSUMED, not
measured** for xag, nzdusd, usdcad, usdchf, eurjpy.

## The event and the trade

Trigger timeframe T = **M15, H1 or H4** (UTC buckets from the 5-minute candles, `combo-grid-3` `frames`). The event is
`round-number-breaks`' close beyond a round level on T (closed candles only; the farthest level crossed). The trade is the
FADE: side against the close's direction, market entry at the next 5-minute open, stop past the event candle's extreme + 0.1 x
ATR(14) of T. A fill at or past the stop, or a risk under the round trip, is no trade. Stop first when one 5-minute candle
holds both; a gap fills at the open. Time limit: M15 1 day, H1 2 days, H4 5 days.

## The complements (five filters, fixed)

- **none**: every event.
- **exhaust**: the event candle's range is at least 1.5 x ATR(14) of T (a climax close, the candle that most often pulls back).
- **quiet**: the fill falls in the "other" session (UTC 17:00-06:59), the best group of `round-number-breaks`.
- **dayext**: the fill is in the outer 20 % of the range of the 20 completed New York trading days before it, on the side of
  the close (a sell fade in the top 20 %, a buy fade in the bottom 20 %): fading INTO the daily range's edge.
- **exhaust+dayext**: both.

## The cells (30, fixed here)

3 timeframes (m15, h1, h4) x 5 filters x 2 exits (**2R**, **3R**) = 30 cells, named `<tf> <filter> <exit>`.

## The bar (judged AFTER costs)

A cell passes when ALL hold:
1. n >= 200 trades in each window;
2. mean R after costs > 0 and month-sum t (after costs) >= 2 in discovery;
3. the same in confirmation;
4. Holm-adjusted one-sided p < 0.05 over the 30 confirmation tests (p from the after-cost month-sum t, df = months - 1);
5. the cell is positive after costs on the five markets whose costs were MEASURED alone (xau, eurusd, gbpusd, usdjpy,
   audusd) in the confirmation window.

Verdict: **PASS** if one cell or more passes; **FAIL** otherwise; INCONCLUSIVE if fewer than 8 markets load.

## Also reported

Before-cost figures beside, the mean cost in R per cell, per-market rows for any passing cell, and a cut test (events known by
a date equal the full run's when the candles are cut there).

## What a result means

A pass would be a net tilt on these years, on mid candles with fixed costs, and a candidate for a forward paper record only
(never live without the owner). A fail closes the round-number fade: no further variants on these years.
