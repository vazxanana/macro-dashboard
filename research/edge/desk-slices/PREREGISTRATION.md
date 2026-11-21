# Pre-registration: the desk slices that looked good, tested on 2020 to August 2026 (21 Nov 2026)

Written and pushed alone, before any trade of these tests is computed. The tests run once; nothing below is changed after a
result is seen. Paper research only: nothing live changes, no council member, mirror, config or desk reads the result.

## Why
The Engulfing desk and the LIT desk (21 Nov 2026) keep paper records of two readings, before costs. In their first files
three slices stood out: the engulf reading on EUR/USD (+30.1R, 301 trades, 90 days) and on GBP/USD (+31.4R, 300 trades), and
the LIT reading's "market on the break" execution (+25.2R, 20 trades, 180 days). Ninety days of one reading, with no costs,
chosen because they looked good, is not evidence. This asks the one fair question: did the same code make money, after
costs, on years it was not picked on?

## What is tested
The desk's own code, imported and not edited: `council/edge-desks.mjs` `egTrades` and `litTrades` (which read
`council/lit.mjs` and the LIT study's `managePosition`). No parameter is varied.
- **T1**: the engulf reading on EUR/USD: D1, H4 and H1 together, buys and sells, as the desk records it.
- **T2**: the same on GBP/USD.
- **T3**: the LIT reading on the desk's eleven markets, only the trades whose execution is "market on the break"
  (`kind` `lit-break`), pooled. The one-position-at-a-time rule is applied as the desk applies it (over every execution),
  then the `lit-break` trades are kept.

## Data
OANDA mid candles through the keyless candle proxy, kept out of git: M5 for every market (fills and exits), and D1, H4, H1
for EUR/USD and GBP/USD, from 2019-06-01 (warm-up) to the run day. Trades are kept by their fill time.

## Windows
- In sample: fills 2020-01-01 to 2023-12-31.
- Out of sample: fills 2024-01-01 to 2026-08-22. **The desk's own record starts on 23 August 2026 (EUR/USD, GBP/USD) and the
  slices were chosen on it, so nothing from 23 August 2026 on is in either window.** (The LIT file starts 25 May 2026; its
  `lit-break` trades of 25 May to 22 August 2026 are inside the out-of-sample window and were among the 20 that prompted
  the test: said here, and reported apart.)

## Costs (per round trip, taken off every trade in R = cost / the trade's opening risk)
- Forex (EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD): commission 0.000045 of price plus 0.5 pip of spread and slippage,
  the cost `fx-vol-breakout` used (the demo account's measured raw-spread commission, `Forex spreads`, 12 Nov 2026).
- Gold: 0.00005 of price (measured hourly spread about 0.000026 plus commission 0.000024, `gold-vol-breakout-hourcost`).
- Silver: 0.0005 of price (measured about $0.02 on the demo, `silver-vol-breakout-hourcost`).
- NAS100: 0.000027 of price; S&P 500: 0.000047 (measured, `index-vol-breakout-hourcost`). Dow 30 and DAX 40: 0.00005 of
  price, **assumed** (not measured on the demo).
- No financing is charged (LIT closes by the day's end; an engulf trade lives ten candles at most, so D1 trades can cross
  rollovers: reported as a limit).
- 2x costs: twice every figure.

## Statistics and the bar
Per test and window: n, win %, R a trade before and after costs, total, worst drawdown, t on calendar-month sums of net R,
by year and (T1, T2) by timeframe. One-sided p from the out-of-sample month-sum t (normal), Holm over the three tests.
**A test passes only if all hold**: out-of-sample n >= 100; out-of-sample net R a trade > 0 with month-sum t >= 2 after
Holm (p < 0.05); in-sample net R a trade > 0; out-of-sample net > 0 at 2x costs. Anything else is FAIL. A test with fewer
than 100 out-of-sample trades is "too few to judge" and counts as not passed.

## What a result means
A pass makes a slice a candidate for a forward paper record with its own pre-registration; it changes no rule and is not
an edge on its own. A fail means the slice's 90-day (180-day) figure was the period, not the reading: the desks keep
recording, and the slice is not looked at again from the same record.
