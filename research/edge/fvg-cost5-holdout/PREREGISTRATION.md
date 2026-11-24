# FVG return with a cost of at most 5 % of the risk, on eight markets no FVG study has read (pre-registration, 24 Nov 2026)

Owner: "I was expecting more studies". Paper research only; nothing live changes whatever the result.

## Why

`equinox-cost-ratio` (today) failed at its pre-registered 10 % cut, but its context table showed one cell above zero after
costs in both windows: the FVG return kept only where the round-trip cost is at most 5 % of the risk (+0.026R in 2005-14,
n 13,887, month t 2.80; +0.016R in 2015-26, n 10,728, t 1.32). That was seen after looking, on the ten markets the rule was
found on, so it proves nothing. This is the one honest way to test it: markets no FVG study has read.

## The rule (one test)

The Equinox FVG return (`grid7-fvg-wide` cell 1h mkt large 1R, the grid's own `signals()`): a three-candle H1 fair-value gap
larger than the market's median gap (as a share of ATR), entered with the gap at the next 5-minute open after the first M15
close inside it, stop past the gap's far side + 0.1 ATR, target 1R, out after 2 days. A trade is KEPT only when the market's
round-trip cost is at most **5 %** of its risk.

## Data

Eight markets: GBP/JPY, AUD/JPY, CAD/JPY, EUR/GBP, EUR/AUD, Nasdaq 100, S&P 500, DAX. OANDA mid 5-minute candles on file from
2019. "Large" = larger than the market's own median H1 gap of **2019** (the grid's definition, on the year before the test);
trades filled 2020-01 → 2026-10. Costs: the shared table of `combo-grid-2` (ASSUMED on all eight, not measured).

## Pass bar (all of them)

- R a trade after costs above zero over 2020-26, t of calendar-month sums at least 2;
- above zero after costs in 2020-22 AND in 2023-26;
- at least 300 kept trades;
- above zero after costs at twice the cost.

Anything else is FAIL. A pass would be a candidate for a forward paper record only (its own pre-registration), never an edge
on assumed costs.

## Context only

All trades of the cell and the 10 % cut on the same markets; the kept trades by market. Nothing is adopted from them.
