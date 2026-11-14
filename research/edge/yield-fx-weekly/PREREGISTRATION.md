# Do weekly moves in US 2-year yields lead the dollar against low-yielding currencies? Pre-registration

Written and committed **alone, before any price was read** (14 Nov 2026). Only the files' names, first and last dates and row
counts were looked at (below), and the demo broker's swap fields in `ctrader/symbols.json`. Everything in this file is fixed
now; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. A stand-alone research rule tested on its own trades (owner decision 44: never a gate, exit, entry or size
of the live gold book). Nothing live changes, whatever the outcome; a pass would only be reported to the owner.

## Claim

A change in rate expectations, read as the weekly change in the US 2-year Treasury yield, is followed over the next week by
the dollar moving the same way against currencies whose own rates are low (yen, Swiss franc, euro): information crossing from
the bond market to the currency market slowly, over days rather than minutes.

Background, cited and **not opened in this session** (no paper was read; the citations are from memory and only frame the
question): gradual diffusion of information across markets and investors (Hong and Stein, 1999, "A unified theory of
underreaction, momentum trading and overreaction"; Hong, Torous and Valkanov, 2007, "Do industries lead stock markets?");
delayed portfolio adjustment in currencies (Bacchetta and van Wincoop, 2010, "Infrequent portfolio decisions: a solution to the
forward discount puzzle"). Nothing here depends on them.

**Related (this repository)**: `research/edge/bond-lead-intraday` (branch `bond-lead-intraday`, 14 Nov 2026, not merged when
this was written) tested a sharp 15-minute move of the US 10-year Treasury CFD leading gold and USD/JPY for ONE HOUR: a real
gross lead in the expected direction (gross t 2.0-2.9 since 2016), smaller than the round-trip cost of a one-ATR M15 stop
(FAIL, 0 of 3). This study asks the same question at a WEEKLY horizon, where the move to be caught is many times the cost of
one round trip. Its code is not imported; what is reused is copied.

## Data (all from council-data, read with `git show origin/council-data:<path>`, no network)

`research/daily/<key>.json` (OANDA mid daily candles, complete UTC days, `rows [[t, o, h, l, c, v]]`):

| key | instrument | first candle | last candle | rows |
|---|---|---|---|---|
| `usb02y` | USB02Y_USD (2-year US Treasury note CFD, a PRICE) | 2003-04-01 | 2026-11-06 | 7,094 |
| `usdjpy` | USD_JPY | 2002-05-07 | 2026-11-06 | 7,720 |
| `usdchf` | USD_CHF | 2002-05-07 | 2026-11-06 | 7,709 |
| `eurusd` | EUR_USD | 2002-05-07 | 2026-11-06 | 7,744 |

**Sign convention.** `usb02y` is the price of a 2-year note. Its price FALLS when the 2-year yield RISES. So a bond return
below the threshold = **yields up** = buy USD; a bond return above it = **yields down** = sell USD. USD/JPY and USD/CHF are
quoted with USD as the base (buy USD = buy the pair); EUR/USD has USD as the quote (buy USD = SELL the pair).

## Candles

Every file is passed through `council/fills.mjs` `foldWeekend` (imported, not edited): Saturday and Sunday candles are folded
into the next weekday's candle (its time and close, the first weekend open, high / low over all). So a Monday candle opens at
the **Sunday reopen**: the first quote after the weekend. A trailing weekend candle with no weekday after it is dropped.

## Rule (fixed here)

For each pair separately, at every **Friday** candle (UTC weekday 5) of the folded `usb02y` file:

1. Bond return `r = close(Friday) / close(the bond candle 5 candles earlier) - 1`, only when those two candles are at most 10
   calendar days apart (else no signal that week).
2. Threshold `sd` = the sample standard deviation of the same 5-candle return taken at each of the previous 52 Fridays
   (calendar weeks before this one; this week's return is NOT in it), using the ones that exist; at least 40 of the 52 needed,
   else no signal.
3. `r < -0.5 x sd` (yields up) -> buy USD; `r > +0.5 x sd` (yields down) -> sell USD; otherwise flat.
4. The pair must have a candle on the same Friday date (the signal day); else no trade that week.
5. **Entry** at the OPEN of the pair's next folded candle after the signal Friday (normally the Monday candle, whose open is
   the Sunday reopen).
6. **Stop** (absolute rule 1, every trade has one): `2 x ATR(20)` from the entry, ATR = the simple mean of the true range of
   the pair's 20 folded candles ending with the signal Friday (needs 20 candles before it, each with a previous close). Checked
   on every held candle from the entry candle on, in candle order: a candle whose open is already beyond the stop fills at
   that open (gap), else a candle whose low (buy) / high (sell) reaches the stop fills at the stop.
7. **Exit** at the CLOSE of the 5th held candle (entry candle = 1st), if the stop was not hit. One position at a time per
   pair (a signal whose entry would fall inside an open trade is skipped; with weekly signals and 5-candle holds this should
   only happen around holidays).
8. **R** = side x (exit - entry) / (2 x ATR). The stop distance is fixed at entry and never moved.

Tests, one per pair: **T1** USD/JPY (buy USD = long), **T2** USD/CHF (long), **T3** EUR/USD (buy USD = SHORT).

## Costs (repo raw-spread model, `council/fills.mjs` and CLAUDE.md "Forex spreads")

- Trading, per round trip in price: a quoted spread of **0.3 pip** paid once + **22.5 USD per million of notional a side**
  (`2 x 22.5e-6 x entry` in price units for all three pairs) + **half a spread (0.15 pip) of slippage on each side** (0.3 pip
  in all). Pip = 0.01 for USD/JPY, 0.0001 for the others. Total: `0.6 pip + 4.5e-5 x entry`.
- Financing, per rollover night held: `nights(entryT, end)` of `council/fills.mjs` (Monday-Friday 22:00 UTC, Wednesday counts
  three). `entryT` = the entry candle's start; `end` = the exit candle's start + 20 h for a time exit (a position closed at the
  Friday close is not rolled), the stop candle's start for a stop exit. The swap in pips per lot per night (cTrader `swap`
  type 0; positive = credit, negative = charge), from the demo broker (`ctrader/symbols.json`, 2026):
  - USD/CHF long **+0.437**, short **-1.314** (measured on the demo, as quoted);
  - EUR/USD long **-0.621**, short **+0.244** (measured; buy USD = short = +0.244);
  - USD/JPY: **not in the file** (the demo account carries no USD/JPY). **Assumed**: long **+1.0**, short **-2.0** pips a
    night (a US-Japan short-rate gap of about 3.5 % a year at a price of 155 is about 1.5 pips a night; the broker credits
    less and charges more, as on the two measured pairs).
  - Financing in R = nights x swap x pip / (2 x ATR). Today's rates are applied to every year (the broker's past rates are
    not known; the rate gaps were much smaller in 2009-2021 and the sign of the USD/CHF and EUR/USD swaps may have differed).
- Net R = R - trading cost / (2 x ATR) + financing R.
- **Cost levels reported**: 0 (gross: no trading cost, no financing), **base** (as above; the verdict uses base), **2x** (trading
  cost doubled, every financing charge doubled, every financing credit dropped to 0).

## Windows

- **Decisive**: entries from 2016-01-01 to the last complete trade in the files (November 2026).
- **Replication**: entries from the data start (the first Friday with 40 earlier weekly returns, about spring 2004) to
  2015-12-31.

## Pass rule (per test; all must hold)

1. Mean net R a trade (base costs) > 0 in BOTH windows.
2. Decisive t >= 2 on calendar-month sums of net R (months with at least one trade; t = mean / (sd / sqrt(months))).
3. Holm over T1-T3 at 0.05 on the decisive one-sided p (normal approximation of that t).
4. Decisive n >= 100.
5. **Placebo**: 40 seeds (1-40, mulberry32). Each seed draws, from all decisive Fridays on which a trade on that pair COULD
   have been entered (bond signal threshold ignored: entry, ATR and exit candles available), as many weeks as the real decisive
   trades, without replacement, each with a random side (buy / sell USD, equal odds), traded by the same entry, stop, exit and
   costs. The real decisive mean net R a trade must be above the 95th percentile of the 40 seeds' means (sorted, linear
   interpolation at rank 0.95 x 39).

The study passes if at least one test passes all five; each is reported separately. Never call a test an edge without its n
and t.

## Reported only (no verdict reads them)

- **Variant, no threshold**: the same rule trading EVERY Friday on the sign of the bond return (r < 0 -> buy USD, r > 0 ->
  sell USD, r = 0 -> flat).
- Per year (net R, n, mean), by side (yields up / down), gross / base / 2x for both windows, worst drawdown, share of stops.

## Repeat

`node research/edge/yield-fx-weekly/run.mjs fetch <dir>` (writes the four daily files from `origin/council-data` with
`git show`, no network), then `node research/edge/yield-fx-weekly/run.mjs full <dir>` (writes `result.json`).
Tests: `tests/yield-fx-weekly.test.mjs` (offline).
