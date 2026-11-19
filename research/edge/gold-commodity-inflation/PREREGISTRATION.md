# Does a commodity-price impulse lead spot gold? Pre-registration

Written and committed **before** any number below was computed (14 Nov 2026). The data, the markets, the signal, the trade,
the costs, the statistics and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **A stand-alone rule on gold (XAU/USD)**: not a gate, filter, size step, entry or exit for the live gold
book (Gold trend, Gold daily engulf, Mosha cycle), never compared with or applied to it, and it does not use the book's
2006-17 window or its positions (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member
changes, whatever the outcome.

## Question and economic reason

Gold is held as an inflation hedge, and the fastest-moving part of headline inflation is commodity prices: energy and food
feed the CPI within one to three months, and market inflation expectations (breakevens) move with oil and food prices. A broad
rise in non-precious commodity prices is an inflation impulse that the slower, macro-driven gold market may price with a lag
(the "inflation news" channel; cross-commodity lead-lag and slow diffusion of information across related markets, Hong, Torous
and Valkanov, Journal of Financial Economics 83, 2007, for industries; the commodity analogue is the open question). The test:
does a strong past month of a basket of eight non-precious commodities lead spot gold the same way over the next month, by
enough to trade after costs, both ways? A second test asks the same of the part of the basket's move that gold did NOT already
follow (gold "behind" the commodity move), a third of a quarter-long impulse.

## Dedupe (read before writing this)

- `gold-oil-lead` (branch): a single big WTI / copper DAY (beyond 2 sd) leading gold 3 days. FAIL. One market, one day,
  shock form; here a broad eight-market basket over a month, the inflation channel.
- `copper-gold`, `gold-platinum-ratio`, `gold-silver-ratio`, `gold-silver-divergence`: ratio / spread trades between metals.
- `gold-commodity-fx-lead`: commodity CURRENCIES as a lead for gold. FAIL. Currencies, not commodity prices.
- `commodity-cycle`, `commodity-xs-momentum`, `commodity-skewness`, `commodity-fx-lead`, `energy-seasonal`,
  `grain-seasonality`: trade the commodities themselves (or FX), never gold on a basket signal.
- `gold-tsmom`, `gold-weekly-momentum`, `tsmom`, `dual-momentum`: gold's OWN past return.
- `gold-bond-lead`, `gold-rate-spread`, `gold-curve-slope`, `gold-dollar-lead`, `macro-gold`: rates and the dollar.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`, branch `untested-backlog`) lists no
  commodity-basket lead for gold. `ls research/edge`, every remote branch name and the shared topics list read. New.

## Data (no network)

- OANDA mid daily candles, UTC days, from council-data `research/daily/<key>.json` (`git show origin/council-data:<path>`; the
  commit is recorded in `result.json`). From `_index.json` (no prices read): xau 2006-03-20; wtico 2003-01, bco 2003-08,
  natgas 2003-01, corn / wheat / soybn 2003-03, sugar 2003-03, xcu 2003-03; all to 2026-11-06. `node run.mjs fetch <dir>`
  copies them out of git (kept out of the repository); `node run.mjs full <dir>` runs it.
- Weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` (imported) on every market.
- **Market set, fixed now.** Basket = equal-weight mean of the log returns of the eight non-precious commodity CFDs `wtico`
  (WTI), `bco` (Brent), `natgas`, `corn`, `wheat`, `soybn`, `sugar`, `xcu` (copper). Traded market: `xau` only. No market is
  added, removed or reweighted after this commit.

## Signal (weekly; only data at or before gold's last close of the week)

- Week end = gold's last folded candle of each Monday-based week. Each basket market's value at a week end = its last close at
  or before that UTC day, no more than 5 days older (else the week is skipped). Weekly basket return `b` = the mean of the
  eight log returns between consecutive qualifying week ends; gold's weekly log return `g` between the same ends. A gap of
  over 14 days restarts the history.
- **T1 (primary), the month impulse**: `B4` = sum of the last 4 weekly `b` (4 consecutive rows of one unbroken history);
  `z = B4 / (2 x sd)`, `sd` = standard deviation of `b` over the 52 weeks BEFORE the oldest of those 4. `z > +1` long gold,
  `z < -1` short gold. Entry at gold's next daily open; held 20 gold candles.
- **T2, gold behind the basket**: OLS (with intercept) of `b` on `g` over the 52 weeks before the current week; residuals
  `e = b - alpha - beta x g` of the last 4 weeks under that fit; `z = sum(e) / (2 x sd_e)`, `sd_e` = sd of the 52 fit
  residuals. Same sides, entry, hold as T1.
- **T3, the quarter impulse**: `B13` = sum of the last 13 weekly `b`; `z = B13 / (sqrt(13) x sd)`, `sd` of `b` over the 52
  weeks before the oldest of the 13. Same sides, entry, hold as T1.

## The trade (every trade has a stop)

- Stop: 3 x ATR(20) of the 20 gold candles before the entry candle (1R). Checked on each daily candle; an open beyond the stop
  fills at that open; a candle that touches the stop fills at the stop. Otherwise out at the close of the 20th held candle.
  One position at a time per test (a signal while a trade is open is skipped).
- Costs: $0.30 spread + $0.15 slippage on each of the two market orders = **$0.60 a round trip**, plus overnight financing on
  longs = `nights(entry, exit)` x `FIN.xau.long` x entry price (both imported from `council/fills.mjs`; today's demo rate for
  every year). Shorts are charged and credited nothing. Net R = gross R - cost / risk. The cost share (cost / |gross| summed)
  and the median stop in dollars are reported.

## Windows, statistics, bar

- In sample: signal weeks from 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.
- t = mean / standard error of **calendar-month sums** of net R by exit month (months with no trade count as 0), per window.
  One-sided p from the normal; **Holm over T1-T3** on the OOS p.
- **Baseline (reported for every test)**: the same trade taken long on EVERY eligible week, and short on every eligible week,
  one at a time, OOS and IS; the test's longs are compared with the all-weeks long baseline, its shorts with the all-weeks short.
- Placebo, per test, 40 seeds (1..40): the test's OOS sides shuffled onto the same number of eligible OOS weeks drawn at
  random, same trade rule, costs and one-at-a-time; the real OOS month-sum t is compared with the 40.
- **A test passes** when all hold: OOS net month-sum t >= 2 with Holm p < 0.05; in-sample net mean R a trade > 0 (same sign);
  OOS net mean > 0 at 2 x costs; real OOS t above at least 38 of the 40 placebo t; OOS n >= 30.
- **Verdict**: PASS if T1 passes; PARTIAL if only T2 or T3 passes; FAIL otherwise. No re-run with other baskets, weights,
  thresholds, horizons or stops; any such look is labelled post hoc and cannot change the verdict.

## Reported, not judged

Long and short sides apart, gross R, stops hit, mean cost, cost share, median stop in dollars, the baselines.
