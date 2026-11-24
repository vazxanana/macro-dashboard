# The other Equinox fade and gap rules, only the trades whose cost is small against their risk (pre-registration, 24 Nov 2026)

Owner, after the Big-candle fade's cost study: "and the other edges". Paper research only; nothing live changes whatever the result.

## Why

`bigfade-cost-ratio` found that the Big-candle fade's before-cost R lives in its tight-stop trades, where the cost eats it.
The four other fade / gap rules of the Equinox page also passed before costs and lose after them. The same question for each:
do the trades with room for the cost make money after it?

## The rules (four tests)

Each rule exactly as its Equinox desk records it, through the tracker's own adapters (`council/edge-desks-2.mjs`, which run
each study's own signal code and are compared with it trade by trade in `tests/edge-desks-2.test.mjs`), every signal a trade:

1. Break fade (`fadeTrades`: grid7-wide-fade, m15 none atr 2R all)
2. Round-number fade (`roundTrades`: round-number-breaks, fade other 2R)
3. Box fade (`boxTrades`: fade-breaks-holdout F1)
4. FVG return (`fvgTrades`: grid7-fvg-wide, 1h mkt large 1R)

A trade is KEPT when the market's round-trip cost is at most **10 %** of its risk (cost ÷ |entry − stop| ≤ 0.10), both known
at the entry. Nothing else changes. Trades still open at the end of the candles are left out.

## Data, windows, costs

OANDA mid 5-minute candles 2005 → October 2026, the ten markets, the shared cost table (assumed, not measured, on five), the
grids' data exclusions. Discovery 2005-14, confirmation 2015-26 (the grids' own split). These windows are the ones the rules
were found on; this split of them has not been read.

## Pass bar, per rule (all of them)

- kept trades: R a trade AFTER costs above zero in 2005-14 AND in 2015-26;
- t of calendar-month sums of the after-cost R at least 2 in both windows;
- Holm over the four rules on the 2015-26 one-sided p, under 0.05;
- at least 300 kept trades in each window;
- still above zero after costs in 2015-26 at twice the cost.

Anything else is FAIL for that rule. A pass would be a candidate for a forward paper record only (its own pre-registration).

## Context only, no verdict

All trades and the dropped trades of each rule; thresholds 5 %, 20 % and 30 %; kept trades by market. No threshold or market
is adopted from them. The two breakouts (already tested at the broker's own quotes) and the DOM zone (tested at the broker's
bid / ask) are not part of this study.
