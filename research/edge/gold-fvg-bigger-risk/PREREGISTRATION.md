# Gold FVG return on H4 and D1 gaps at the broker's measured costs (pre-registration, 24 Nov 2026)

Written and pushed before any run. Research only: nothing live changes, no rule is proposed.

## Question

`fvg-hourcost` found the FVG return (`grid7-fvg-wide` cell **1h mkt large 1R**) on gold at +0.038R a trade before costs and
-0.010R after the demo broker's measured costs in 2015-26 (n 4,998, month t -0.69; cost 0.048R a trade): the cost is a large
share of a small stop (median stop 0.147 % of price). On gold only, does the SAME cell rule on gaps of a higher timeframe (H4,
D1), where the stop is larger, clear the measured costs?

## What is already known (read before writing this; said so the test is not mistaken for new evidence)

- `grid7-fvg-wide` reported gold **4h mkt large 1R** before costs: 2005-14 +0.115R (n 1,249, month t 3.66), 2015-26 +0.023R
  (n 1,697, month t 1.01). So the H4 test below can hardly reach a confirmation month t of 2 at any cost; it is run anyway as
  cost accounting, and the answer is expected to be FAIL.
- `fvg-htf-exits` built gold D1 gaps with the same entries (17:00 New York days) and tested 2R, 3R and a time exit at the grid's
  ASSUMED cost ($0.30): gold D1 large 2R 2005-14 -0.012R gross (n 241), 2015-26 +0.178R gross / +0.152R net (n 312, t 1.93).
  The D1 1R exit and gold at measured cost were not tested. The D1 entries were therefore already seen; this is a further look at
  the same trades, not untouched data.
- `gold-daily-fvg` (a different rule: limit at the near edge, 2R, 0.25 ATR minimum gap) FAILED.

## Trades

`fvg-htf-exits` `signals(M5, 'xau')` (imported, not edited; it calls `grid7-fvg-wide`'s `bandsOf` / `eventsOf`): three-candle
gaps on H4 (`grid7` `frames`) and D1 (`edgekit` `dailyNY`), market entry (`kind 0`) at the next 5-minute open after the first M15
close inside the gap, stop past the far side + 0.1 ATR. **Large** gaps only: height / ATR above gold's own 2005-14 median of that
timeframe (computed by `signals`). Filters as `fvg-htf-exits`: 2005-01-01 <= fill < 2026-11-01, `combo-grid-2` `exclusions`, risk
> 0, risk >= $0.30. Exit = `dom-trade-through` `manage` slot 0: target **1R**, stop, or the close at the time limit (H4 5 days,
D1 20 days; grid7 / fvg-htf-exits caps). `fvg-hourcost` `exitWalk` gives the exit candle and kind and must reproduce `manage`'s
R on every trade (a mismatch drops the trade; more than 0.1 % dropped = INCONCLUSIVE). OANDA mid 5-minute candles, edgekit cache.

**Gate**: H4 before costs reproduces grid7 `perMarket["4h mkt large 1R"]` xau (n 1,249 / 1,697 within 1 %, mean within 0.005R
in each window); D1 n reproduces `fvg-htf-exits` T4 xau (241 / 312, within 1 %; same entries, other exit). Miss = INCONCLUSIVE.

**Control**: the random bands (`ctl 1`) of the same timeframe, same entry, exit and cost.

## Cost a trade

`fvg-hourcost`'s model, its own `costFrac` and `profile.json` (imported): 0.5 x spread(entry UTC hour) + 0.5 x spread(exit UTC
hour) + commission (0.000024 of price, `ctrader/symbols.json`), + another 0.5 x spread(exit hour) on a stop exit; spread = gold's
measured `hourProfile` median of that hour (council-data `0459ec37e2`). In R: x fill / risk.
**Plus overnight financing on buys** (D1 trades are held days): `council/fills.mjs` `nights(fill, exit)` x `FIN.xau.long`
(0.000148 of price a rollover) x fill / risk; sells pay and earn nothing (the council's rule). Today's rates charged on every
past year. Reported beside, not judged: the same without financing, and at the 90th-percentile hourly spread.

## Windows

Discovery 2005-2014 (gold from March 2006), confirmation 2015-01 to 2026-10 (the parent studies' windows, so the gate compares
like with like). Month sums of net R by fill month, empty months 0.

## Tests (Holm over the two confirmation one-sided p)

- **T1**: H4 large 1R, gold.
- **T2**: D1 large 1R, gold.

A test PASSES when all hold: n >= 200 in each window; mean net R > 0 in 2005-14 AND 2015-26; month t >= 2 in 2015-26 with Holm
p < 0.05; mean net R >= 0 in 2015-26 at 2x the cost (spread, commission and financing doubled); Welch t >= 2 against its
random-band control after the same cost in 2015-26. The study PASSES if either test passes; it is then in-sample cost accounting
on entries already read (see above) and at most a candidate for its own forward record, never an edge.

## Also reported (not judged)

By window: before-cost R, cost R a trade split into spread / commission / financing, median stop as a share of price, exits by
kind, buys and sells, year by year.

## Tests file

`tests/gold-fvg-bigger-risk.test.mjs`: result.json figures, the cost function on a hand-made trade, and a cut test (signals
known by a date are the same when computed on candles cut there).
