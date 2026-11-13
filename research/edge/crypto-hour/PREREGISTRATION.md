# Pre-registration: Bitcoin / Ether hour-of-day returns, out of sample (13 Nov 2026)

Written and committed before any hour-of-day figure of these candles was computed. Paper research only: no live rule, size,
filter, stop, config or council member changes, whatever the result.

## Why

Published work (Baur, Cahill, Godfrey and Liu 2019 on Bitcoin intraday and day-of-week returns; later papers that report
positive returns late in the UTC day, around 21-23 UTC, and around the US cash-equity open) suggests that some hours of the
day carry a mean return in crypto. This asks one question: an hour picked on one stretch of data, traded every day on a later
stretch, after the demo broker's costs, with a stop on every trade. It is not the council's crypto trend rule or any of the
engine setups, and not the weekly momentum study of the same day (`research/edge/crypto-weekly-mom`, FAIL).

## Data, and a change to the plan forced by the network

The plan was Binance spot H1 klines from 2018 (discovery 2018-2021). From the build sandbox every exchange API is refused by the
network proxy (403 on api.binance.com, data-api.binance.vision, data.binance.vision, api.binance.us, api.kraken.com, Bitstamp,
Coinbase, OKX, Bybit, BitMEX, Gemini, Dukascopy, CryptoCompare, CoinGecko; checked 13 Nov 2026), so the council's Kraken path
is not reachable either, and no hourly crypto candles before 2022 exist in the repository or in council-data (the daily cache
`research/candles/crypto1d` has no hours). What is on file: council-data `research/candles/crypto5m/BTCUSDT_5m.json.gz` and
`ETHUSDT_5m.json.gz`, Binance spot 5-minute candles `[time, open, high, low, close]` from 2022-01-01 00:00 UTC to the end of
October 2026 (the cache `research/edge/shadow-scalp-filters` used), read with `git show origin/council-data:…`, no network.

So the windows are moved, before any result, and fixed here:
- **Discovery: 2022-01-01 to 2023-12-31** (the hour choice is made here, once).
- **Decisive: 2024-01-01 to the data end (2026-10-31).**
A 2018-21 discovery would have been preferable (it is the published papers' period); it is not available. Said in the result.

H1 candles are built from the 5-minute candles: UTC hours, open of the first, high / low over all, close of the last; an hour
counts only when all twelve 5-minute candles are on file.

## Discovery: the hour choice (made once, from discovery only)

For each UTC hour h (0-23), pool BTC and ETH: every complete hour h of every discovery day of each coin is one observation of
the hour's return r = close / open - 1 (gross, no cost). Mean and t = mean / (sd / sqrt n). **Long hour = the hour with the
highest t; short hour = the hour with the lowest t.** Nothing else is chosen; no figure of the decisive window is looked at
before the run that writes the result.

## The rule (decisive window; fixed)

- Every UTC day, each coin (BTC, ETH) separately: **leg L** buys at the open of the long hour, **leg S** sells at the open of
  the short hour; each is out at that hour's close (the open of the next hour) unless stopped first.
- **Stop (every trade has one):** 2 x ATR(24) on H1 candles: ATR = simple mean of the true range of the 24 complete H1 candles
  that closed before the entry hour (true range uses the previous H1 close; the 25 hours before entry must all be complete,
  else no trade that day). Long stop = entry - 2 ATR, short stop = entry + 2 ATR. Checked on the entry hour's twelve
  5-minute candles in order: a candle that reaches the stop exits at the stop, or at its open when it opened beyond the stop.
- **R** = side x (exit - entry) / (2 ATR), net of costs and financing below. 1R = the stop distance.
- **Costs:** `CFD_CRYPTO` (council/fills.mjs, 0.04 % of the entry price a round trip), charged on every trade.
- **Financing:** the demo broker's crypto CFD swap, council-data `ctrader/symbols.json` of 13 Nov 2026 (cTrader swap type 1 =
  percent a year): BTCUSD long 15 %, short 7.5 %; ETHUSD long 15 %, short 10 %; `rollover3Days` 5 = Friday counts three. The
  broker's crypto day ends at 17:00 New York (its schedule's 16:59-17:02 break). A trade pays rate / 365 x entry price x
  nights, where nights = 1 (3 when the rollover is a Friday's) if the 17:00 New York instant falls in (entry time, exit time],
  else 0. So only an hour ending at 17:00 New York (21:00 UTC in US summer time, 22:00 UTC in winter) can pay financing.
  Today's rates are charged for every year.

## Tests and the pass

Four tests: {leg L, leg S} x {BTC, ETH}, decisive window. For each: n trades, net R a trade, and the month-sum t (t of the
calendar-month sums of net R; a trade belongs to the month of its entry). One-sided p from that t (normal). Holm over the four.
A test passes when **all** hold: n >= 300, net R a trade > 0, month-sum t >= 2, Holm-adjusted p < 0.05.
**Verdict: PASS if at least one of the four passes; FAIL otherwise.**

## Reported, never part of the pass

- The full hour-of-day table of the decisive window, per coin and pooled: mean gross hour return, its t, and the net R a trade
  of a long and of a short in that hour under the rule above (descriptive; picking from it would be a new, untested choice).
- The discovery table the choice was made on.
- Placebo: 40 fixed seeds (1-40); each draws a random long hour and a different random short hour from 0-23 (uniform), and the
  same rule is run on the decisive window. Reported: each seed's pooled net R a trade per leg, and how many seeds the real
  choice beats.
- Gross R (before costs and financing), per year, stops hit.

A PASS would lead only to a proposal of a paper shadow (owner's decision). A FAIL changes nothing.
