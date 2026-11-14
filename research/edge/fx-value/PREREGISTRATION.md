# Pre-registration: forex "value" as a five-year cross-sectional reversal, monthly rebalance (14 Nov 2026)

Written and pushed **alone, before any trade, return or statistic of this rule was computed**. The rule, the costs, the windows,
the pass bar and the variant are fixed here and do not change after the results are seen. Anything added later is labelled
post-hoc in `RESULT.md`. Paper research only: nothing here changes a council rule, a trade, the mirror, a config or any live
file. A pass would only make a candidate for a paper proposal that the owner decides on (absolute rule 3).

## Claim tested

Currencies that have fallen most against the others over five years tend to recover over the following month ("currency
value", measured as long-horizon reversal). Literature, cited from memory and **not opened from this sandbox**: Asness,
Moskowitz and Pedersen (2013, Journal of Finance, "Value and momentum everywhere") use the negative five-year change of the
real exchange rate as currency value; Menkhoff, Sarno, Schmeling and Schrimpf (2017, Review of Financial Studies, "Currency
value") study real-exchange-rate value signals. No published number is relied on here.

**This test uses the NOMINAL five-year return.** Consumer price indices are not reachable from the build sandbox (FRED is
refused) and no CPI series is in the repository, so the inflation differential that turns a nominal into a real exchange-rate
change is left out. Among the seven G10 currencies against USD, five-year inflation gaps are small next to five-year currency
moves, but they are not zero: this is a nominal long-horizon reversal, not the published real-value signal. Said again in
`RESULT.md`.

## Related work in this repository (said before the run)

All on unmerged branches, all FAIL, all known to the writer of this pre-registration:
- `research/edge/fx-xs-momentum/` (13 Nov 2026): monthly cross-sectional MOMENTUM, 63-day and 21-day lookbacks, the same seven
  currencies: FAIL (2016-26 month t −1.79 / −1.13). Its loader, calendar, ATR, stop, leg simulation, cost model, financing,
  statistics, Holm and placebo are **copied** into this study's `run.mjs` (not imported: that branch is not on `main`).
- `research/edge/fx-reversal/` and `research/edge/fx-weekly-reversal/`: one-WEEK cross-sectional reversal: FAIL.
- `research/edge/fx-carry/`: the carry trade on policy rates: FAIL.
No study in the repository ranks currencies by a multi-year return. This one does, with the reversal sign.

## Data

- council-data `research/daily/<key>.json` for `eurusd gbpusd audusd nzdusd usdcad usdchf usdjpy` (OANDA mid, complete UTC
  daily candles), read with `git show origin/council-data:…` (no network). Weekend stubs folded into the next weekday by
  `council/fills.mjs` `foldWeekend` (imported). Checked before writing this (dates only, no prices or returns): every file runs
  to the candle of 6 Nov 2026; NZD/USD starts 24 Sep 2002, the others in May 2002.
- **Each currency as the foreign currency against USD**: EUR, GBP, AUD, NZD as quoted; CAD, CHF, JPY the USD-base pair inverted
  candle by candle (open 1/o, high 1/l, low 1/h, close 1/c).
- **Calendar**: the trading days on which all seven series have a candle. A month's last trading day is the last day of that
  calendar month in this calendar. Month-end index list `ends` (first entry: September 2002).

## Rule (primary: 60-month return, no skip)

1. On the last trading day `d = ends[m]` of each month, for each of the 7 currencies: **value signal = −(close(ends[m]) /
   close(ends[m−60]) − 1)**, closes only up to and including `d`. A month without `ends[m−60]` gives no signal. Rank from the
   highest signal (the cheapest: fell most over five years) to the lowest; a tie is broken by the order EUR, GBP, AUD, NZD,
   CAD, CHF, JPY.
2. **Buy the 2 cheapest against USD and sell the 2 dearest against USD at the open of the next trading day** (the first
   trading day of the next month). Buying CAD, CHF or JPY against USD = selling USDCAD / USDCHF / USDJPY; selling them = buying
   the pair.
3. **Size: equal risk per leg.** 1R = 3 × ATR(20), ATR(20) = the simple mean of the true range of the 20 trading days ending on
   `d`, on the expressed series (as `fx-xs-momentum`).
4. **Every leg has a protective stop** at 3 × ATR(20) from the entry (= 1R): below the entry for a buy, above for a sell
   (absolute rule 1). Checked on every daily candle from the entry day to the exit day. A candle that opens beyond the stop
   fills at its open (gap fill), otherwise at the stop. A stopped leg stays flat until the month's end.
5. **Exit**: a leg not stopped is closed at the close of the last trading day of the month it was opened in. Every month's four
   legs are closed and opened anew (no netting; a currency that stays in its bucket pays both sides' costs again).
6. One month = one book of four legs, each 1R of risk. **Book net R for the month = the sum of the four legs' net R.**

**Variant (pre-registered, tested with the primary, Holm over the two): skip the latest 12 months**: signal = −(close(ends[m−12])
/ close(ends[m−60]) − 1) (a four-year return ending one year ago, so that one-year momentum does not enter the value signal).
Everything else identical; the same months exist for both.

## Costs (every leg, round trip, in R of that leg; exactly as `fx-xs-momentum`)

- **Base cost**: spread 0.3 pip (once a round trip on mid prices), slippage 0.5 pip a side, commission 22.5 USD per million
  USD of notional a side: `cost = 1.3 pip / pair price + 0.000045` as a fraction of price; pip 0.0001, or 0.01 for USD/JPY.
  Source: the raw-spread model measured on the demo account (CLAUDE.md, "Forex spreads", 12 Nov 2026). In R = cost × entry
  (expressed) / stop distance (expressed).
- **Financing: a flat 0.004 % of price a night against every leg, long or short** (the assumption of `trend-breadth-h1` and
  `fx-xs-momentum` for currencies). Nights = `council/fills.mjs` `nights(entryTime, exitTime)` (Mon-Fri 22:00 UTC rollovers,
  Wednesday three). Entry time = the entry day's candle start; exit time = the end of the exit day for a month-end close, the
  candle start for a gap fill, the candle start + 12 h for a stop inside a candle.
- **Limitation, stated now:** the true rate differential is not measured (FRED refused; the `fx-carry` branch's policy rates
  are written from memory and that branch is not merged). A month-long hold earns or pays the differential; a flat charge on
  both sides ignores it. Cheap currencies and high-rate currencies may overlap, so this measures the price part only, with a
  conservative financing charge.
- **Three cost levels**: 0 (gross: no trading cost, no financing), base (above), **2x (trading cost AND financing both
  doubled)**.

## Windows (what the data supports; the five-year lookback needs 60 month-ends first)

- The first signal is the month-end of September 2007 (60 month-ends after September 2002), so positions start October 2007.
- **In sample: positions entered October 2007 to December 2014.**
- **Out of sample (decisive): positions entered January 2015 to the last complete month on file** (October 2026; November 2026
  is incomplete and left out).
- The OOS window is the decisive one; the IS window must agree in sign.

## Statistics and the pass bar

Per signal and window: months n, book net R a month (mean), total, **month t = mean / sd × √n on the calendar-month book sums**
(sd with n − 1), annualised Sharpe, worst drawdown of the cumulative monthly sums; per leg n, win rate, stopped share, R a leg.

A signal **passes** only when ALL of these hold:
1. OOS: book net R a month at base cost > 0 **and** month t ≥ 2;
2. IS: book net R a month at base cost > 0;
3. OOS: book net R a month at 2x cost > 0;
4. **Holm over the 2 signals** (primary, skip variant) at 0.05 on the one-sided p of the OOS base-cost month t (normal
   approximation; direction positive, fixed here);
5. **placebo**: the OOS base-cost month t is above the 95th percentile of 40 placebo runs (beats at least 38 of 40). A placebo
   run picks, each month, 2 random longs and 2 random shorts (4 distinct currencies of 7; seeds 1 to 40, the `mulberry32`
   generator of `fx-xs-momentum`), with the same months, entries, stops, exits and costs. Percentile = linear interpolation.

**Verdict**: PASS when the primary passes; "PASS (skip variant only)" when only the variant passes; FAIL otherwise. A PASS is
evidence for a proposal to the owner, never a live change, and would first need the real-exchange-rate (CPI) version and the
measured carry checked.

**Reported, never part of the verdict:** gross and no-financing results; calendar years; how often each currency was bought /
sold; the placebo distribution (5th, median, 95th percentile and the rank of the rule).

## Repeat

`node research/edge/fx-value/run.mjs` (reads council-data through `git show`, writes `result.json`). Tests:
`tests/fx-value.test.mjs`.
