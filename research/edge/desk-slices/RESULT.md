# Desk slices: the three slices that looked good on the desks, tested on 2020 to August 2026 (21 Nov 2026)

**Verdict: FAIL (0 of 3: two fail, one invalid).** None of the three slices is an edge. Nothing live changed.

Pre-registration: `PREREGISTRATION.md` (committed alone, before any candle was read). Candles: OANDA mid, 5-minute for
eleven markets and D1 / H4 / H1 for EUR/USD and GBP/USD, June 2019 to November 2026. In sample: fills 2020-01-01 to
2023-12-31. Out of sample: 2024-01-01 to 2026-08-22. Costs as pre-registered. t is on calendar-month sums.

| Test | Out of sample, after costs | In sample, after costs | Verdict |
|---|---|---|---|
| T1 engulf reading on EUR/USD | n 3,205, -0.136R a trade, month t -4.80 | n 5,045, -0.088R, t -3.80 | FAIL |
| T2 engulf reading on GBP/USD | n 3,255, -0.094R a trade, month t -2.92 | n 5,033, -0.064R, t -2.40 | FAIL |
| T3 LIT "market on the break", as the desk records it | n 109, +0.738R a trade, month t 4.27 | n 176, +0.722R, t 5.47 | INVALID |

## T1 and T2: the engulf reading on EUR/USD and GBP/USD

Before costs both are zero: EUR/USD +0.004R a trade in sample and -0.032R out of sample, GBP/USD +0.007R and -0.007R
(over 16,000 trades in all). The cost is about 0.09 to 0.10R a trade, because an H1 engulf's stop is a few pips, and that is
the whole loss. Every year of 2020-26 is negative on EUR/USD; GBP/USD has one flat year (2020, +2.8R) and six negative.
No timeframe is positive out of sample (D1, H4, H1 all negative on both pairs). The +36R and +20R the desk showed for these
two pairs over ninety days were ninety days of luck before costs.

## T3: why the pass is invalid

On the pre-registered checks T3 passes all five. It is not a result. The desk tries three executions on each LIT candidate
in order: the rule's limit order, a looser limit order, and only when NEITHER limit fills, "market on the break". The market
entry happens on the candle after the break; whether a limit would have filled is known only later. A limit at the order
block does not fill when price never comes back, which is exactly when a market entry in that direction wins. So the stream
"market on the break, as the desk records it" is chosen with knowledge of the future (62 % winners at targets of 1.5R and
more, a worst drawdown of 6R in six years). The pre-registration copied the desk's selection without seeing this; the
fault is in the desk's order of executions, not in the candles.

Reported after the result, not pre-registered: the same market entry on EVERY candidate, with no limit tried first and one
position at a time, which is the stream a person could have traded. Out of sample: n 468, 28 % winners, +0.497R a trade
after costs, month t 0.76. In sample: n 618, +0.772R, month t 0.94. The average rests on a handful of trades whose stop was
almost at the entry: one AUD/USD trade of 2 August 2024 books +299R of the +313R out-of-sample total before costs; the
median trade is -1.00R; without that one trade the 467 others make about +13R before costs and about -66R after. Years:
2022 +460R and 2024 +277R, the other five between -56R and +49R. Not an edge.

## What follows

- The desks' totals stay labelled as they are: paper records before costs, never evidence.
- On the LIT desk, a "market on the break" row should be read as "the limit never filled", not as an entry rule. A fix of
  the desk's order of executions (so it never records a stream chosen by the future) is a separate change for the owner.
- Do not test these slices on other pairs: the engulf reading has no return before costs on 16,000 trades.

To repeat: `node --use-env-proxy research/edge/desk-slices/run.mjs fetch <dir>` (about 3 minutes, 60 MB outside git), then
`node --max-old-space-size=6000 research/edge/desk-slices/run.mjs run <dir>`.
