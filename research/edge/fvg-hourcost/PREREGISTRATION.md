# FVG return at the demo broker's measured hourly spreads (pre-registration, 24 Nov 2026)

Written and pushed before any run. Research only: nothing live changes, no rule is proposed.

## Question

The Equinox desk "FVG return" is `grid7-fvg-wide` cell **1h mkt large 1R** (H1 three-candle gap larger than the market's
2005-14 median gap / ATR, market entry at the next 5-minute open after the first M15 close inside the gap, stop past the gap's far
side + 0.1 ATR, target 1R, out after 2 days). It passed before costs (2015-26 +0.035R a trade, n 52,659, month t 7.27) and
lost after the grid's ASSUMED costs (-0.113R). Does it survive the demo broker's MEASURED cost by UTC hour?

Not answered before: `fvg-htf-exits` (H4 / D1 exits, assumed costs), `fvg-vb-side` (a breakout-side filter, assumed costs) and
the `*-hourcost` studies (other rules) never charged this cell at measured spreads.

## Which markets have a measured hourly profile (checked before writing this)

Read from council-data with `git show` (no network):

- **xau**: `research/probe/ticks-XAUUSD.json` at council-data `0459ec37e2` `hourProfile` (24 hours, n 14-44 a hour, the first
  two minutes of each UTC hour, 1.7-2.6 x 10^-5 of price). The later commit of the file has an empty profile.
- **xag**: `research/probe/ticks-XAGUSD.json` at `19c2477d5b` `hourProfile` (24 hours, n 14-44, about 3.6-7.2 x 10^-4 of price).
- **usdjpy**: no `hourProfile` (the file's profile is empty), but a measured profile by UTC hour from the broker's own quotes
  exists: `research/edge/fade-late-hourcost/profile.json` (built from council-data `3e30f22b6a` marks, 53-144 quotes every hour;
  0 in most hours, the raw-spread account). Used as USD/JPY's measured profile.
- **eurusd, gbpusd, audusd, nzdusd, usdcad, usdchf, eurjpy**: no hourly profile (their probe files hold depth and 40-60 scattered
  marks only). **Reported apart, NOT used for the verdict**, at two costs: the grid's assumed cost (`combo-grid-2` `COSTS`) and
  commission + the council's measured typical spread (`ctrader/symbols.json` `spreadTypical.median`, not by hour).

Commission (`ctrader/symbols.json` `commissionRT`, round trip, share of price): xau 0.000024, xag 0.000024, forex 0.000045.

## Trades

`grid7-fvg-wide`'s own code, imported, never edited: `signals(M5, market, med)` with the medians stored in its result.json,
real bands only (`ctl 0`), `kind 0` (mkt), `g 1` (H1), `large`; its filters (2005-01-01 <= fill < 2026-11-01, `exclusions`,
risk > 0, risk >= the grid's cost) and `dom-trade-through` `manage`, exit slot 0 (1R). OANDA mid 5-minute candles from the edgekit
cache. A walk of the same 1R exit gives the exit candle and kind (stop / target / time); it must reproduce `manage`'s R on every
trade (else the trade is dropped and counted; more than 0.1 % dropped = INCONCLUSIVE).

**Gate**: per market, n and mean R before costs within 1 % / 0.005R of grid7's `perMarket["1h mkt large 1R"]` in each window
(the cache has changed a little since grid7, `fvg-vb-side` notes it). Gate miss = INCONCLUSIVE.

**Control**: grid7's random bands (`ctl 1`) of the same cell (H1, mkt, large, 1R), through the same events and the same cost.

## Cost a trade (share of price, then x fill / risk)

0.5 x spread(entry hour) + 0.5 x spread(exit hour) + commission, + another 0.5 x spread(exit hour) when the exit is a stop
(the `fade-late-hourcost` model). spread = the profile's median `frac` of that UTC hour. "2x measured" = twice that cost.

## Windows

Discovery 2005-2014 (gold and silver from their first candle), confirmation 2015-01 to 2026-10 (grid7's windows, so the gate
compares like with like). Month sums of net R, empty months 0.

## Tests (Holm over the four confirmation one-sided p)

- **T1 (primary, decides the verdict)**: the three measured markets pooled (xau + xag + usdjpy).
- T2 xau, T3 xag, T4 usdjpy (each judged on the same bar, reported).

A test PASSES when all hold: n >= 200 in each window; mean net R > 0 in 2005-14 AND in 2015-26 at measured cost; month t >= 2 in
2015-26 with Holm p < 0.05; mean net R >= 0 in 2015-26 at 2x measured cost; the cell beats its control after the same cost in
2015-26 (Welch t >= 2).

Verdict: PASS if T1 passes; FAIL otherwise; INCONCLUSIVE if the gate or the walk check fails. A PASS would be a cost-accounting
result on years grid7 already read (in sample for the cell's choice), a candidate for a forward paper record, never an edge.

## Reported, not judged

The 90th-percentile spread of each hour; gold with the fade marks profile (`fade-late-hourcost/profile.json` xau) instead of
`hourProfile`; the seven unmeasured markets at the two costs above; R before costs; by fill hour and by year.
