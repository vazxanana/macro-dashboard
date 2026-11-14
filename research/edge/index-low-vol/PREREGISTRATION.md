# The low-volatility anomaly across national stock indices: pre-registration

Written and committed **before** any return or volatility below was computed (14 Nov 2026). The universe, the ranking, both
constructions, the costs, the windows and the pass bar are fixed here; anything added later is labelled post hoc in
`RESULT.md`. Seen before this file: the first and last date of each candle file (council-data `research/daily/_index.json`)
and the result of the related study `index-long-reversal` (same universe and cost model, a different signal: see Related).

Paper research only. Whatever the outcome, no live rule, size, filter, stop, config, cost constant or mirror setting
changes; a pass would at most lead to a written proposal for a paper shadow, for the owner. Not a test of the gold book
(owner decision 44 untouched); ICT is not involved.

## The claim

Blitz and van Vliet (2007), "The volatility effect: lower risk without lower return", *Journal of Portfolio Management*
34(1); Frazzini and Pedersen (2014), "Betting against beta", *Journal of Financial Economics* 111(1), which reports the
effect across country equity indices too: across assets, the low-volatility ones earn a better return per unit of risk than
the high-volatility ones. Their samples end before 2016, so the decisive window here is after the papers.

## Related (not the same question)

- `index-long-reversal` (branch of the same name, FAIL): same 17 index CFDs, same cost model and stop, ranked by the
  36-month return. Its code (month ends, ATR, the DGS2 as-of lookup, financing a rollover night, Newey-West, the seeded
  placebo) is COPIED into this study's `run.mjs`, not imported across branches.
- `vol-managed-index` (branch of the same name, FAIL): volatility TARGETING of one index through time (scale exposure by
  1 / sigma); this study is CROSS-SECTIONAL (which indices to hold against which), a different question.

## Universe (fixed now)

The same 17 keys of `_index.json` with `group: "index"` and `status: "ok"`: `au200`, `ch20`, `cn50`, `de40`, `es35`,
`eu50`, `fr40`, `hk33`, `in50` (file ends 2022-07-12), `jp225`, `nas100`, `nl25`, `sg30`, `spx500`, `uk100`, `us2000`,
`us30`; the others end 2026-11-06. Read with `git show origin/council-data:research/daily/<key>.json` (no network). OANDA
mid daily candles; Saturday / Sunday candles folded into the next weekday with `council/fills.mjs` `foldWeekend`.
Stated now: CFD **price** series (no dividends), each in its own quote currency, not hedged or converted. Several overlap
(US30 / SPX500 / NAS100 / US2000; EU50 / DE40 / FR40 / NL25 / ES35).

## The ranking (both tests)

- **Month end** of a market = its last candle of the calendar month. A market is **ranked** at the end of month m only if
  (a) its last candle of month m is within the last 7 calendar days of the month (else stale), (b) it has a month-end close
  at month m-12 (at least 13 months of history), and (c) at least 150 daily returns in the window below.
- **Volatility** = the sample standard deviation of the daily log returns `ln(close_k / close_{k-1})` of the market's
  candles dated after the end of month m-12 up to and including its month-m candle (12 months; the first return uses the
  month m-12 close). Nothing after the end of month m is read.
- Ranked ascending by volatility (ties by key). **Low = the 3 lowest, High = the 3 highest.** A month end with fewer than
  6 ranked markets forms no book.
- One cohort per month end, held for ONE month (no overlap), rebalanced at the next month end.

## Every position has a stop (absolute rule 1)

Entry at the OPEN of the market's first candle after the end of month m. Stop at **3 x ATR(20)** from the entry (ATR =
mean true range of the 20 candles ending at the month-m candle). Each day from the entry candle on: an open beyond the stop
exits at the open (gap fill), else a low (long) / high (short) through the stop exits at the stop. A stopped position is
flat until the next rebalance. Otherwise it exits at the close of the market's last candle of month m+1 (at its last close
when its file ends first: "data end"). A selected market with no later candle is not entered (counted).

## T1: equal risk, long Low 3 / short High 3

Each leg risks 1R = 3 x ATR(20) (the stop distance). A leg's R = its price move over 1R in the trade direction, less
costs in R. **The book's monthly R = the mean of its entered legs' R** (6 legs). Book month = m+1.

## T2: equal volatility contribution, long-only Low 3 against long-only High 3

Each leg, in BOTH books, is a LONG with notional weight `w = 1 % / (sigma_daily x sqrt(21))` of a notional book (target
1 % of the book a month per leg, by the same trailing 12-month volatility used for the ranking). Its return in % of the
book = `w x (exit - entry) / entry`, less costs times w. Same stop (3 x ATR(20)) and exits as above. Book return a month
= the sum of its 3 legs' returns. **T2's monthly figure = Low book return - High book return** (in % of the notional book;
the spread of the two long books). Each book alone is reported too.

## Costs (both tests)

- **CFD round trip 0.04 % of price per leg**: 0.02 % of the entry price at the entry, 0.02 % of the exit price at the exit.
- **Overnight financing on every leg, longs and shorts alike** (a short is not credited, conservative), per rollover night
  (`council/fills.mjs` `nights`): `(max(0, DGS2) + 2.5 %) / 365` of that day's close. DGS2 = council-data
  `macro/cache.json` `score.fred.DGS2` (as-of), a fixed 4 % before its first value. The same US rate for every market.
- Reported at 0 x, base (1 x) and 2 x costs; the verdict is read at 1 x.

## Windows

- **Decisive**: book months 2016-01 to the last complete month (2026-10).
- **Replication**: from the book month after the first month end with 10 or more ranked markets, to 2015-12.

## Pass bar (two judged tests, T1 and T2; per test all must hold)

1. Mean net monthly figure (T1: R; T2: return spread) > 0 in the decisive window AND in the replication window.
2. Decisive Newey-West t (Bartlett, 3 lags) of the monthly net figure >= 2.
3. **Holm** over T1-T2: one-sided p = 1 - Phi(t_NW) of the decisive window; the smaller p must be <= 0.025, the larger
   <= 0.05 (a test passes Holm only if every smaller p before it does).
4. **Placebo**: 40 seeded draws (seed 20261114), each month the ranked markets put in random order instead of by volatility,
   the same construction (T1: equal risk long / short; T2: the two long books with each market's own weight), stops and
   costs; the real decisive mean must be above the 95th percentile of the 40 draws' decisive means.

The study passes if at least one test passes all four.

## Reported only (named variant and descriptions, not judged)

- **Variant: a 6-month volatility window** (candles after the end of month m-6, needing a close at m-6 and 75 returns),
  both T1 and T2, same everything else.
- Per year, worst drawdown, cost sensitivity, each book of T2 alone, how often each market is Low / High, each market's
  share of the result, stop / time / data-end counts.

Repeat: `node research/edge/index-low-vol/run.mjs fetch <dir>` (git show, no network; candles outside git), then
`node research/edge/index-low-vol/run.mjs full <dir>`.
