# Gold volatility squeeze breakout: pre-registration (14 Nov 2026)

Written and pushed alone, before any candle was fetched or any trade computed.

## Question

After a volatility squeeze on spot gold (Bollinger Bands 20 / 2 inside Keltner Channels 20 / 1.5 ATR, the "TTM squeeze"
idea), does a close out of the Bollinger Bands give a breakout edge after costs?

A NEW stand-alone rule. It is not a gate, exit, entry or size of the live gold book (Gold trend, Gold daily engulf) and it reads
none of that book's records or its 2006-17 window (docs/owner-decisions.md item 44). Paper research only: nothing live changes.

## Dedupe (done before writing this)

- `nr7-breakout` (branch `nr7-breakout`, FAIL): a one-day narrow-range bracket on daily candles, exit the next day. Not a
  Bollinger / Keltner squeeze, not a band-close trigger, no H4.
- `gold-tsmom` (FAIL): 12-month time-series momentum, monthly rebalance. Different horizon and signal.
- `gold-asia-break` (FAIL): an intraday Asian-range bracket into London on M5. Different signal.
- No study in `research/edge` (main) or on a remote branch tests a Bollinger / Keltner squeeze; the untested backlog
  (`research/proposals/2026-11-14-untested-backlog.md`) does not list it.

## Market and data (fixed now)

- One market: spot gold, OANDA mid XAU/USD, through the candle proxy `https://meridianx.dev/md/bars` (`sym=xau`,
  `tf=4h` and `tf=1d`, UTC alignment), fetched by `fetch.mjs` from 2015-06-01 (indicator warm-up) to the run date. The cache
  is kept out of git. Daily candles: Saturday / Sunday stubs folded into the next weekday (`council/fills.mjs` `foldWeekend`).
  H4 candles used as served.
- Only complete candles (the forming one is dropped).

## Indicators (on closed candles, bar i includes its own close)

- Middle line M = SMA(20) of the close.
- Bollinger: M ± 2 × the population standard deviation of the last 20 closes.
- Keltner: M ± 1.5 × ATR(20), ATR = the simple mean of the last 20 true ranges (true range uses the previous close).
- Squeeze on at bar i: Bollinger upper < Keltner upper AND Bollinger lower > Keltner lower.
- SMA(50) of the close, slope at i = SMA50(i) − SMA50(i − 10).

## Signal (the release)

- A squeeze run = consecutive squeeze-on bars; it counts only when it lasts 6 bars or more.
- Bar i is a signal when the close of i is above the Bollinger upper of i (buy) or below the Bollinger lower of i (sell), the
  last bar of a qualifying squeeze run is one of bars i−5 … i−1 (or the run is still on at i−1), and no signal has yet been
  taken from that run (one signal per run: the first band close after it).
- Entry: market at the open of bar i+1.
- Stop: 1.5 × ATR(20) of bar i from the entry (every trade has it from the fill). Checked on every candle from the entry
  candle; a candle that opens beyond the stop fills at its open (gap).
- Exit (whichever first): the stop; a close back through the middle line (buy: close < M; sell: close > M) → market at the
  next candle's open; a time exit at the close of the N-th candle after entry (H4 N = 30, five trading days; D1 N = 20).
- One position at a time per test stream; a signal while a position is open is skipped.

## Tests (three, Holm over the three)

- **T1 (primary)**: H4, both sides.
- **T2**: D1, both sides, N = 20.
- **T3**: H4, only signals whose side agrees with the sign of the SMA(50) slope (buy when slope > 0, sell when < 0).

## Costs

- $0.30 a round trip (the spread, `council/fills.mjs` `spreadOf` for spot gold) plus half a spread of slippage on the market
  entry and half a spread on the exit (`SLIP_SPREADS` 0.5): $0.60 a trade in price, divided by the risk (1.5 ATR) for R.
  (Every exit is a market or stop order, so each pays the half spread.)
- Financing on buys: `nights(entry, exit)` × `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD swap of
  11 Nov 2026) × entry / risk. Sells charged and credited nothing. Today's rate is used for every year.
- 2× costs: spread, slippage and financing all doubled.

## Windows

- In sample: entries 2016-01-01 to 2020-12-31. Out of sample (decisive): entries 2021-01-01 to the last complete candle.
  (This study's own split, as the owner's request names it; the common brief's 2016 / 2017 split does not fit H4 data that
  starts in 2016.)

## Statistics

- Per test and window: n, gross and net R a trade, win %, total net R, worst closed drawdown in R, exits by reason.
- t on calendar-month sums of net R (by exit month, every month of the window counted, 0 where none); one-sided p from the
  normal approximation; Holm over the three OOS p values at alpha 0.05.
- Placebo, 40 seeds (seeded generator, seeds 1-40), per test, OOS window: each real trade is replaced by one on a uniformly
  drawn candle of the same timeframe in the OOS window, with the real trade's side, the same 1.5 ATR(20) stop, held for the
  real trade's number of candles unless stopped first, same costs. Overlap allowed. Reported: median and 95th percentile of
  the placebo's net R a trade.

## Pass bar (all four, per test)

1. OOS net t ≥ 2 and Holm-adjusted significant (alpha 0.05 over the three tests).
2. In-sample net R a trade > 0 (same sign).
3. OOS net R a trade > 0 at 2× costs.
4. OOS net R a trade above the placebo's 95th percentile.

Verdict PASS if T1 passes; a T2 / T3 pass alone is reported as "secondary pass, not the primary". A pass would be a
proposal only (research/proposals/), never a live rule without the owner.

## Deliverables

`fetch.mjs`, `run.mjs`, `RESULT.md`, `result.json` in this folder; `tests/gold-squeeze.test.mjs` (offline, hand-made candles:
the squeeze, the release, no look-ahead, the stop, the exits, and the report against result.json).
