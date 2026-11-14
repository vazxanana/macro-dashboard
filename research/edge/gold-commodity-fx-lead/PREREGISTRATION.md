# Do the commodity currencies lead spot gold? Pre-registration

Written and committed **before** any number below was computed (14 Nov 2026). The data, the markets, the signal, the trade,
the costs, the statistics and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **A stand-alone rule on gold (XAU/USD)**: not a gate, filter, size step, entry or exit for the live gold
book (Gold trend, Gold daily engulf, Mosha cycle), never compared with or applied to it (owner decision 44). It is judged on
its own out-of-sample window (2017 on). No live rule, size, filter, stop, config, cost constant or council member changes,
whatever the outcome.

## Question and economic reason

Chen, Rogoff and Rossi ("Can Exchange Rates Forecast Commodity Prices?", Quarterly Journal of Economics 125(3), 2010) show
that the currencies of commodity exporters (Australia, New Zealand, Canada, South Africa, Chile) forecast world commodity
prices out of sample, and not the reverse: a floating exchange rate is a forward-looking asset price, and the currency of a
country whose exports are commodities prices the expected terms of trade before the slower commodity markets do. Groen and
Pesenti (NBER working paper 15743, 2010) find the commodity-currency forecasts modest but real; Ferraro, Rogoff and Rossi
(Journal of International Money and Finance 54, 2015) find the oil / CAD link mostly contemporaneous at the daily frequency.
Australia and South Africa are among the largest gold producers; the AUD and the ZAR are the practitioners' "gold
currencies". The open question here: does a strong week (or month) of the commodity currencies, **after removing the US
dollar's own move**, lead spot gold the same way over the following week (month), by enough to trade after costs?

Removing the dollar matters: a commodity currency against the USD carries the dollar's move, and the dollar's own lead for
gold was already tested and failed (`gold-dollar-lead`, `intermarket-lead` F3). The residual is the part of the commodity
currencies' move that the dollar does not explain: the terms-of-trade channel the papers describe. The raw (not
dollar-neutral) form, the papers' own regressor, is the second test.

## Dedupe (read before writing this)

- `commodity-fx-lead` (branch, #899): the opposite direction (a big WTI / copper DAY leads USD/CAD / AUD/USD the next day).
  FAIL. Not gold, and the currencies are the follower there.
- `gold-dollar-lead` (branch): the ICE dollar index's weekly / daily shock with gold lagging its co-move, into gold. FAIL.
  The dollar, not the commodity currencies, and conditioned on a lag.
- `intermarket-lead` (branch) F3: the dollar's past month as a monthly leader for the metals. FAIL. The dollar only.
- `gold-bond-lead`, `gold-oil-lead`, `copper-gold`, `gold-silver-lead-intraday`, `gold-haven-shock`, `risk-spill-jpy`,
  `risk-cross`, `audnzd-revert` (branches): bonds, oil / copper, the copper / gold ratio, silver, equity shocks, the yen,
  AUD/JPY as a risk filter, the AUD/NZD spread. None uses the commodity currencies as a lead for gold.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`, branch `untested-backlog`) leaves out a
  "commodity-currency SPREAD fade" (a pair spread, mean reversion); it lists no commodity-currency LEAD for gold.
- `ls research/edge` on main, every remote branch name and the shared topics list read. Nothing tests this. New.

## Data (no network)

- OANDA mid daily candles, UTC alignment, from the council's research cache on `council-data` (`research/daily/<key>.json`,
  `git show origin/council-data:<path>`; the commit is recorded in `result.json`). From `_index.json` (no prices read):
  xau 2006-03-20; audusd, usdcad, usdzar, eurusd, gbpusd, usdjpy, usdchf 2002-05; nzdusd 2002-09; usdsek 2004-06; all to
  2026-11-06. Gold limits the study to 2006 on. `node run.mjs fetch <dir>` copies them out of git (kept out of the
  repository); `node run.mjs full <dir>` runs it.
- Weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` (imported) on every market; days
  are matched by UTC day stamp.
- **Market set, fixed now.** Commodity-currency index CC: the equal-weight mean of the log returns of AUD/USD, NZD/USD,
  1 / USD/CAD and 1 / USD/ZAR (each the commodity currency's value in USD). Dollar index: the ICE DXY formula on the six
  pairs EUR/USD, USD/JPY, GBP/USD, USD/CAD, USD/SEK, USD/CHF (as `gold-dollar-lead`). A week counts only when gold, all four
  CC pairs and all six DXY pairs have a folded candle on gold's last day of that Monday-based week. Traded market: `xau` only.

## Signal (weekly; only data at or before gold's last close of the week)

- Weekly log returns of CC (`c`) and of the dollar index (`d`) between consecutive qualifying week ends (a gap of over 14
  days restarts the history).
- **Residual** `e = c - beta x d`, `beta` = OLS slope (with intercept) of `c` on `d` over the 52 weeks BEFORE this week;
  `z_e = e / sd`, `sd` = standard deviation of the 52 earlier weeks' residuals under that same fit. **Raw** `z_c = c / sd(c
  over the 52 earlier weeks)`.
- T1 (primary): `z_e > +1` long gold, `z_e < -1` short gold; entry at gold's next daily open (the Sunday reopen folded into
  Monday), out at the close of the 5th gold candle.
- T2: the same with `z_c` (the raw commodity-currency move, the papers' regressor).
- T3 (month horizon): `m` = the sum of the last 4 weekly residuals `e` (each from its own week's fit, 4 consecutive rows of
  one unbroken history), `z_m = m / (2 x sd)` with `sd` of the current week's fit; `z_m > +1` long, `< -1` short; held 20
  gold candles.

## The trade (every trade has a stop)

- Stop: T1 / T2 2 x ATR(20), T3 3 x ATR(20), of the 20 gold candles before the entry candle (1R). Checked on each daily
  candle; an open beyond the stop fills at that open; a candle that touches the stop fills at the stop. Otherwise out at the
  close of the last held candle. One position at a time per test (a signal while a trade is open is skipped).
- Costs: $0.30 spread + $0.15 slippage on each of the two market orders = **$0.60 a round trip**, plus overnight financing
  on longs = `nights(entry, exit)` x `FIN.xau.long` x entry price (both imported from `council/fills.mjs`; today's demo
  rate for every year, as the earlier gold studies). Shorts are charged and credited nothing. Net R = gross R - cost / risk.

## Windows, statistics, bar

- In sample: signal weeks from the first with 52 earlier weeks (2007) to 2016-12-31. Out of sample: 2017-01-01 to
  2026-10-31.
- t = mean / standard error of **calendar-month sums** of net R by exit month (months with no trade count as 0), in each
  window. One-sided p from the normal; **Holm over T1-T3** on the OOS p.
- Placebo, per test, 40 seeds (1..40): the test's OOS sides shuffled onto the same number of eligible OOS weeks drawn at
  random, same trade rule, costs and one-at-a-time; the real OOS month-sum t is compared with the 40.
- **A test passes** when all hold: OOS net month-sum t >= 2 with Holm p < 0.05; in-sample net mean R a trade > 0 (same
  sign); OOS net mean > 0 at 2 x costs; real OOS t above at least 38 of the 40 placebo t; OOS n >= 30.
- **Verdict**: PASS if T1 passes; PARTIAL if only T2 or T3 passes; FAIL otherwise. No re-run with other thresholds, horizons,
  currencies or stops; any such look is labelled post hoc and cannot change the verdict.

## Reported, not judged

Long and short sides apart, gross R, stops hit, mean cost, and the in-sample / out-of-sample median beta of CC on the dollar.
