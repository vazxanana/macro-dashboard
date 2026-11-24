# The two breakouts by a public gauge known the day before: implied volatility, policy uncertainty, rate moves (pre-registration, 24 Nov 2026)

Paper research only. Written and pushed alone before any breakout trade was split by any of these gauges.

## Why
`vb-vol-regime` found that the market's own REALISED volatility does not pick the better days of the gold and USD/JPY
volatility breakouts (T1, k 0.5). Options-implied volatility, policy uncertainty and the size of recent rate moves were never
tried: FRED could not be reached. Each is public before the trading day starts.

## Trades
Exactly `vb-vol-regime`'s harness, imported and not edited: `load2` (OANDA 5-minute candles, the shared cache), `tradeOf` (T1 at
k 0.5 with the measured cost for gold and the demo cost for USD/JPY), `daySkip`. Gate first: the unlabelled trades must
reproduce that study's gate (gold n 3,713 / +0.139R on 2007 → 12 Nov 2026; USD/JPY n 2,089 / +0.079R on 2005-15) or the run
stops.

## Gauges (FRED keyless csv; a value dated D is used only for trading days after D)
For a trading day T the reading is the last value dated before T, compared with earlier values of the same series only.
- **G1 gold, implied volatility rising**: `GVZCLS` above the mean of its previous 20 values.
- **G2 gold, policy uncertainty high**: the mean of the last 5 `USEPUINDXD` values above the median of the previous 252 such means.
- **G3 gold, real yields moving**: |5-value change in `DFII10`| above the median of the previous 252 such changes.
- **J1 USD/JPY, equity volatility rising**: `VIXCLS` above the mean of its previous 20 values.
- **J2 USD/JPY, US 2-year moving**: |5-value change in `DGS2`| above the median of the previous 252 such changes.

## Tests (five, Holm)
Each claims the trades on "on" days make MORE net R a trade than on "off" days. Windows: discovery to 2014-12-31,
confirmation 2015-01-01 on (`vb-vol-regime`'s). A test passes when, in the confirmation window, Welch t of on minus off is
>= 2, the t of the monthly differences (months with trades in both groups) is >= 2, Holm p < 0.05 over the five, and the
difference has the same sign in the discovery window. G1 has no discovery years worth the name (GVZ starts June 2008), so its
windows are 2008-07 → 2016-12 and 2017 on.

## Reported, not tested
n, net R a trade and win rate on and off in both windows; days on.

## Reading
A pass would be a hypothesis for a size step, to be confirmed on the forward records before anything is proposed to the
owner. The breakouts' rule, size and forward records are not changed by this study whatever the result.
