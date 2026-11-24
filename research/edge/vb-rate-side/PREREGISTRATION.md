# The breakout's side against the rate trend: gold with falling real yields, USD/JPY with a rising US 2-year (pre-registration, 24 Nov 2026)

Paper research only. Written and pushed alone before any breakout trade was split by a rate trend.

## Why
USD/JPY's breakout makes its money on buys (+0.148R against +0.001R on sells, 2005-26) and `usdjpy-vb-side-control-v2`
showed the entry adds to the drift. Gold moves against real yields and USD/JPY with US short rates on the same weeks
(`yen-us-yields`: correlation 0.51, no lead). So: is a breakout in the direction the rate trend supports a better trade than
one against it? `vb-dollar-confirm` and `vb-structure-filter` asked this of the dollar and of price structure; never of rates.

## Trades
`vb-vol-regime`'s harness, imported and not edited (`load2`, `tradeOf`, `daySkip`; T1 at k 0.5, measured costs), with the same
gate as `vb-fred-regime`. The side of a trade is read from the same `vbTrade` call (entry above the day's open = buy).

## Rate trend (FRED keyless csv; values dated before the trading day only)
Trend = the last value minus the value 20 observations before it.
- **R1 gold** (`DFII10`): WITH = a buy while the trend is below 0, or a sell while it is above 0. AGAINST = the other two.
- **R2 USD/JPY** (`DGS2`): WITH = a buy while the trend is above 0, or a sell while it is below 0. AGAINST = the other two.
A trend of exactly 0 is left out.

## Tests (two, Holm)
WITH trades make more net R a trade than AGAINST trades. Windows: discovery to 2014-12-31, confirmation 2015-01-01 on. Pass =
in the confirmation window Welch t >= 2 and the t of monthly differences >= 2, Holm p < 0.05 over the two, and the same sign
in the discovery window.

## Reported, not tested
The four cells (buy / sell x trend up / down) in both windows.

## Reading
A pass would be a hypothesis for a size step, to be confirmed on the forward records before anything goes to the owner.
The breakouts' rule, size and forward records do not change whatever the result.
