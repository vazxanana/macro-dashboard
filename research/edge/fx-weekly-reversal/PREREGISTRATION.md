# Pre-registration: one-week cross-sectional reversal in nine currencies against the dollar (14 Nov 2026)

Written and pushed **alone, before any trade, return or statistic of this rule was computed**. The rule, the costs, the windows,
the pass bar and the two reported-only variants are fixed here and do not change after the results are seen. Anything added
later is labelled post-hoc in `RESULT.md`. Paper research only: nothing here changes a council rule, a trade, the mirror, a
config or any live file. A pass would only make a candidate for a paper shadow that the owner decides on (absolute rule 3).

## Claim tested

Over one week, the currencies that fell most against the dollar tend to recover part of the fall the next week (short-horizon
cross-sectional reversal). Literature, cited from memory and **not opened from this sandbox**: Menkhoff, Sarno, Schmeling and
Schrimpf (2012, Journal of Financial Economics, "Currency momentum strategies") document cross-sectional currency momentum at
1-12 month horizons; whether that paper itself reports reversal at a one-week horizon was not checked here. The weekly
reversal effect is best known in equities (Lehmann 1990, Jegadeesh 1990, both not opened). This study does not rely on any
published number: it is one rule written down before the run.

## Related work in this repository (said before the run)

- `research/edge/fx-xs-momentum/` (branch `fx-xs-momentum`, 13 Nov 2026): **monthly** cross-sectional MOMENTUM on seven G10
  currencies (63-day and 21-day lookbacks, 3 x ATR(20) stops): FAIL. This study is the opposite sign at a much shorter horizon
  (WEEKLY REVERSAL) and is distinct. Its loader, ATR, stop and statistics are copied here (not imported across branches).
- `research/edge/fx-reversal/` (branch `fx-reversal`, 13 Nov 2026, not merged): a one-week cross-sectional reversal on the
  **seven** USD majors with equal-volatility weights, a 3 x ATR(20) stop, unfolded Sunday candles and a flat 1 % a year
  financing charge: **FAIL, 0 of 4** (decisive 2016-2026 month-sum t -1.60 net, +0.03 gross). **That result was known to the
  writer of this pre-registration.** This study is a related but separate specification set by the coordinator before that
  result was read here: two more currencies (SEK, NOK: the literature reports short-horizon effects more strongly on wider,
  higher-cost sets), equal RISK per leg (1R = 2 x ATR(20)), Sunday stubs folded into Monday, and the demo broker's own swaps
  where they exist. Because a close relative already failed, a pass here should be read with that in mind (two looks at one
  idea), and a fail adds no new reason to try a third.

## Data

- council-data `research/daily/<key>.json` (OANDA mid, complete UTC daily candles, 00:00 UTC starts) for `eurusd gbpusd usdjpy
  audusd nzdusd usdcad usdchf usdsek usdnok`, read with `git show origin/council-data:…` (no network). The council-data commit
  read is recorded in `result.json`.
- Weekend stubs (Saturday / Sunday candles) are folded into the next weekday by `council/fills.mjs` `foldWeekend` (imported),
  so Monday's open is the Sunday reopen and its high / low include the stub.
- **Every currency is expressed as its value in USD.** EUR, GBP, AUD, NZD: the pair as quoted. JPY, CAD, CHF, SEK, NOK (USD-base
  pairs): inverted candle by candle, open 1/o, high 1/low, low 1/high, close 1/c. Ranks, returns, ATRs, stops and R are all on
  these USD-value series, so "buy NOK" = sell USD/NOK.
- **Calendar**: the trading days on which all nine series have a candle after the fold (the common calendar starts in June
  2004, when the USD/SEK file starts).

## The rule (the one judged test)

1. **Decision day `d`**: the last trading day of each Monday-Sunday UTC week in the common calendar (normally Friday).
2. **Signal**: each currency's return over the past 5 trading days = close(d) / close(d - 5 rows) - 1, closes up to and
   including `d` only. Rank the nine; a tie is broken by the key order above (never by a later price).
3. **Legs**: **buy the 2 that fell most, sell the 2 that rose most**, each against USD, at the **open of the next trading day**
   (normally Monday, = the Sunday reopen).
4. **Size: equal risk per leg.** 1R = 2 x ATR(20) of that currency's USD-value series, ATR(20) = the simple mean of the true
   range (high - low, or the gap from the previous close when larger) of the 20 trading days ending on `d`.
5. **Stop on every leg (absolute rule 1)** at 1R from the entry: below for a buy, above for a sell. Checked on every candle from
   the entry candle to the exit candle. A candle that opens beyond the stop (after the entry candle) fills at its open (gap
   fill), otherwise at the stop. **A stopped leg is flat until the next rebalance.** No target, no break-even, no trail.
6. **Exit**: a leg not stopped closes at the close of the next decision day (the next week's last trading day). Every leg is
   closed and re-opened each week even when the same currency keeps its side (a full round trip a week, conservative).
7. **R per week** = the sum of the four legs' R / 4 (so a week's figure is in R of one leg's risk, between about -1 and +).
   A week is attributed to the calendar month of its EXIT day.
8. The last decision day on file has no exit and is left out; a week whose exit day is beyond the file is left out.

## Costs (every leg, round trip, in R of that leg)

- **Majors** (EUR, GBP, JPY, AUD, NZD, CAD, CHF): the repository's raw-spread model (CLAUDE.md "Forex spreads", 12 Nov 2026):
  spread 0.3 pip (paid once a round trip on mid prices) + half a spread of slippage a side (0.15 pip a side, 0.3 pip a round
  trip) + commission 22.5 USD per million of notional a side (0.0045 % of price a round trip). Pip 0.0001; 0.01 on USD/JPY.
- **SEK and NOK**: an ASSUMED wider spread of **20 pips (0.0020 of USD/SEK, USD/NOK)**, slippage half of it a side (10 pips a
  side, 20 a round trip), and the same commission. Not measured on the demo (the broker's spec file has no SEK / NOK symbol).
- Cost as a fraction of the pair's entry price: `(spread + 2 x slippage) / price + 0.000045`; in R = that fraction x the
  USD-value entry / the stop distance (a fraction of price is the same in the quoted and the inverted series).
- **Financing per night** = `council/fills.mjs` `nights(entryTime, exitTime)` (Mon-Fri 22:00 UTC rollovers, Wednesday three) x
  a rate per night as a fraction of price, x entry / stop distance in R. Entry time = the entry candle's start (00:00 UTC
  Monday for a weekly leg); exit time = the exit candle's start + 20 h for a Friday close (the
  market shuts before the Friday rollover) and + 24 h for a close on any other weekday; the candle's start for a gap fill; the
  candle's start + 12 h for a stop inside a candle.
- **Rates**: the demo broker's swaps in council-data `ctrader/symbols.json` (commit 4cadce96b3e5, read 14 Nov 2026,
  Fusion Markets, swap type 0 = pips a lot a night), turned into a fraction of that file's bid and fixed here as constants;
  positive = a charge, negative = a credit actually paid by the broker (credits ARE counted, at 1x in every cost scenario):

  | Currency leg | Long the currency | Short the currency |
  |---|---|---|
  | EUR (EUR/USD long -0.621, short +0.244 pips; bid 1.10211) | 5.635e-5 | -2.214e-5 |
  | GBP (GBP/USD -0.179 / -0.203; 1.32100) | 1.355e-5 | 1.537e-5 |
  | AUD (AUD/USD +0.041 / -0.273; 0.67734) | -6.053e-6 | 4.030e-5 |
  | CAD (USD/CAD long +0.219, short -0.884; 1.42693; long CAD = short the pair) | 6.195e-5 | -1.535e-5 |
  | CHF (USD/CHF +0.437 / -1.314; 0.83876) | 1.567e-4 | -5.210e-5 |
  | JPY, NZD, SEK, NOK (not in the file) | 4.0e-5 assumed | 4.0e-5 assumed |

  The assumed 0.004 % a night against every leg of JPY, NZD, SEK, NOK is the `fx-xs-momentum` assumption. **Today's rates are
  used for every past year**; past rate differentials (the carry) are not known here (FRED is refused from this sandbox), so
  this test measures the price reversal with today's financing, not a carry-inclusive book.
- **Cost scenarios reported**: 0x (gross: no trading cost, no financing), **base (judged)**, 2x (trading costs doubled and
  financing CHARGES doubled; credits kept at 1x).

## Windows

- **Decisive**: weeks whose exit day is in 2016-01-01 to the last complete week on file.
- **Replication**: weeks whose exit day is from the first computable week (ATR and the 5-day lookback need 21 prior days of the
  common calendar, from June 2004) to 2015-12-31.

## Pass bar (all must hold, base costs)

1. Mean net R a week > 0 in the decisive window.
2. Mean net R a week > 0 in the replication window.
3. Decisive t >= 2 on **calendar-month sums** of weekly net R (t = mean / sd x sqrt(n months)).
4. At least 300 decisive weeks.
5. **Placebo**: 40 seeded runs (mulberry32, seeds 1-40) that pick 2 random longs and 2 random shorts among the nine each week,
   same entries, stops, exits and costs; the real decisive month-sum t must be ABOVE the 95th percentile of the 40 placebo
   month-sum t values.

One test, so no multiple-test correction. Verdict PASS only when all five hold; else FAIL.

## Variants (reported only, never judged, never a reason to change the verdict)

- **V1, daily rebalance**: at each trading day's close rank by the past 1-day return, buy the 2 that fell most and sell the 2
  that rose most at the next open, same 2 x ATR(20) stop, out at that day's close. Same costs (a full round trip a day).
- **V2, four currencies**: the same weekly rule on a universe of EUR, JPY, GBP, AUD only (the four most traded against the
  dollar), buying the 2 that fell most and selling the 2 that rose most, i.e. every currency is in the book every week.

## Reported, not judged

Weekly stats (mean gross / net R, win share, t), per-year net R, worst drawdown of cumulative weekly R, legs stopped and gap
fills, cost and financing per leg, the cost scenarios, the placebo distribution, and which currencies drive the result
(net R by currency and side in the decisive window).

## Files

`run.mjs` (reads council-data with `git show`, writes `result.json`), `RESULT.md` (verdict line first), `result.json`,
`tests/fx-weekly-reversal.test.mjs` (offline).
