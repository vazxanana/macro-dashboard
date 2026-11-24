# Pre-registration: fade-late-hourcost (24 Nov 2026)

Paper research only. Nothing live changes, nothing is placed, no rule is proposed from it. Written and pushed alone, **before
the late-hour trades of these two markets are charged at the broker's spreads** (the code that charges them is not written yet).

## Why

`research/edge/grid7-wide-fade` (cell `m15 none atr 2R all`) fades the first M15 structure break and shows a small tilt before
costs that loses after them. `fade-conditions` and `fade-hour-check` showed the tilt sits at 20 and 23 UTC, and that it stays
there with the rollover fills (21:00-22:59 UTC) left out (OANDA 2015-26, ten markets: +0.109R a trade, month t 7.12, before costs;
-0.081R after one flat round trip a market). `fade-tick-exec` found that real bid / ask fills cost about 0.02R a trade more than
mid. Nobody has charged the late-hour trades at the spread the demo broker really quotes in those hours. This study does, on the
two markets where that spread is measured: gold (XAUUSD) and USD/JPY.

**These years and these hours were already read** (by `fade-conditions` and `fade-hour-check`, which chose the hours): this is
cost accounting on a selection already made, not new evidence of a tilt. A PASS is a hypothesis for a forward paper record only,
never a reason to trade.

## The rule (unchanged, imported from `grid7-wide-fade/run.mjs`, never edited)

`signals(frames(M5))` with trigger timeframe M15 (`tf` 1) and context none (`cx` 0): the first structure break on M15, direction
d; the fade sells / buys the other way (s = -d) at market at the open of the first 5-minute candle starting at or after the break
candle's close. Stop 1 x ATR(14) of M15 from the fill (on the losing side), target 2R, out at the close of the first 5-minute candle
ending at or after fill + 1 day. On the fill candle stop first; a gap through the stop or the target books at the open (exactly
`exits()` of grid7-wide-fade; the exit time is read by the same walk and the R must equal `exits()` for every trade, else the run
stops). The rule's own skips stay: risk under the market's round-trip cost (`combo-grid-2` `COSTS`), a fill inside a data-quality
exclusion interval, an unresolved trade. OANDA mid 5-minute candles from the research cache (`EDGE_DATA`, outside git).

**Only entries with the fill (entry) time in 20:00-20:59 or 23:00-23:59 UTC** are kept. Beside it (reported, not judged): the
`fade-hour-check` definition (break candle starting at 20 or 23 UTC, fill outside 21:00-22:59).

Gate: before the hour filter the trade lists equal `fade-hour-check`'s per-market counts (xau 35,212, usdjpy 38,598 trades over
2005-26) and 0 trades differ from `exits()` in R. If not, the verdict is INCONCLUSIVE and nothing is judged.

## The cost (the measured part)

Spread source: the demo broker's (Fusion Markets) last bid / ask at given moments, read by `council/tick-probe.mjs` `marks` for
`fade-tick-exec` (council-data `research/probe/ticks-<SYM>-fade-*.json`, commit `3e30f22b6aa52d26ee3b913ba14a9bb15d7eca98`; about
2,200 moments a symbol, Nov 2023 to Nov 2026, at this rule's own fills and exits). USD/JPY has no `hourProfile` on file (every
probe file of it carries an empty one), so the marks are the one measurement for both symbols. Per symbol and UTC hour: the
**median of (ask - bid) / mid** over the marks of that hour (each moment once; at least 20 marks an hour, else the run stops).

Cost of one trade, as a share of price, times the fill price:

- 0.5 x spread(entry hour) + 0.5 x spread(exit hour)  (a mid fill crosses half the spread at each end);
- + commission: the broker's own figure, a side, 12 USD per million on XAUUSD and 22.5 on USDJPY (`council/ctrader-symbols.mjs`
  `commissionRT`: 0.000024 and 0.000045 of price a round trip);
- + on a STOP exit (gaps included) another 0.5 x spread(exit hour) of slippage.

Exit hour = the UTC hour of the exit: the candle's start for a touch or a gap, the last second of the candle for a time exit.
Costs measured in 2023-26 are applied to 2015-26 as a share of price (the same relative spread every year: said, not known).

Sensitivity rows (reported, not judged): the 90th percentile spread of each hour; commission 0.000024 a SIDE on gold (the figure
`fade-tick-exec` used); gold's `hourProfile` (first two minutes of each hour, council-data commit `0459ec37e`) instead of the marks;
the `fade-hour-check` hour definition.

## Tests

Windows: W1 = fills 2015-01 to 2019-12, W2 = 2020-01 to 2026-10. Judged on W1 + W2 together (2015-01 to 2026-10). Month-sum t on
calendar-month sums of R after cost (empty months count as 0), one-sided p.

Three tests: gold, USD/JPY, the two pooled. Each holds when **mean R after measured costs > 0, month-sum t >= 2, n >= 300, and the
mean after costs is positive in W1 and in W2**. Holm over the three one-sided p values (p < 0.05 after Holm, with the other
conditions).

- **PASS**: the pooled test holds (each market reported with its own Holm p).
- **FAIL**: the pooled test does not hold.
- **INCONCLUSIVE**: the gate fails, or the spread measurement is missing an hour.

Power, said before: `fade-hour-check` gives about 1,000-1,500 late-hour trades a market over 2015-26 with a per-trade sd near
1.4R, so a true +0.05R a trade after costs would give a month t of about 1.2-1.5 per market and about 2 pooled: the study can see
a tilt of about +0.07R or more pooled, not a smaller one. FAIL does not prove there is nothing; PASS on years already read is not
an edge.

## What is not done

No other market, hour, exit, stop or timeframe. No re-run with other settings after the result. Nothing live changes.
