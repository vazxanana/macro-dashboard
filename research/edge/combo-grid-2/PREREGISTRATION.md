# Combination grid 2: more filters, the body engulf, ten markets, 2020 to now (pre-registration)

Written 23 Nov 2026, after the first grid (`research/edge/combo-grid`, FAIL, 0 of 463,064 confirmed) and before any run of
this one. Owner: "do the most work you can … the more data and study we have the better, make sure the market data is high
quality".

## What changes from the first grid

Everything of `research/edge/combo-grid/PREREGISTRATION.md` holds (chains, entries, stops, exits, costs, windows, the pass
bar, the placebo with a trigger only), with these additions:

1. **Filters** (one at a time, read at the signal from closed candles only): the five of the first grid, plus
   - the weekly side: the last completed week closed beyond the week before it in the trade's direction;
   - the Daily efficiency ratio of the last 20 closed trading days >= 0.2 (not ranging), and >= 0.35 (a strong trend);
   - the weekly side AND the ratio >= 0.2 together (the pair the owner's notes report as the best tested filter);
   - the London session (the signal between 07:00 and 12:00 UTC); the New York session (12:00 to 17:00 UTC).
   That is 11 filters.
2. **A ninth key zone**: the body engulf (the second candle's body covers the first candle's whole body, the first body at
   least 40 % of its range; zone = the first candle wick to wick), one of the engulf definitions the schools disagree on.
3. **Ten markets**: xau, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy, xag (the last five at the assumed
   round-trip costs of `edgekit.COSTS`), each alone and the ten pooled.
4. **Data quality**: a trade whose fill falls in an interval that `research/edge/data-quality/quality.json` (an audit of the
   candle cache run alongside, before this grid's run) lists as bad is dropped. The audit decides the intervals, not this
   grid's results.

About 326,000 rules x 11 scopes. The bar is unchanged: discovery 2020-23 (n >= 100, mean > 0, month t >= 2), confirmation
2024-now (n >= 50, mean > 0, month t >= 2 after Holm over every discovery winner, positive at twice the cost). Reported:
the counts against chance and against the placebo, as in the first grid.

## Honest limits

These years are now read by the first grid as well: anything this grid confirms still needs data neither grid read before
anyone calls it more than a hypothesis. Nothing live changes from this study.
