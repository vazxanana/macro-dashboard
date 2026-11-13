# Result: Bitcoin / Ether hour-of-day returns, out of sample (13 Nov 2026)

**Verdict: FAIL, 0 of 4 tests.** The hours picked on 2022-23 (long 20:00 UTC, short 01:00 UTC) lost money after costs on
2024-26 for both coins: long BTC -0.064R a trade (n 1035, month-sum t -7.24), long ETH -0.048R (n 1035, t -4.98), short BTC
-0.016R (n 1035, t -1.20), short ETH -0.007R (n 1035, t -0.50). Not an edge; nothing is proposed and nothing live changed.

Pre-registration: `PREREGISTRATION.md` (committed first). Code: `run.mjs`. Every figure: `result.json`.

## Data

Binance spot 5-minute candles of BTCUSDT and ETHUSDT from council-data `research/candles/crypto5m` (2022-01-01 to
2026-10-31, 42,358 complete hours each). Every exchange API (Binance, Kraken and the rest) was refused by the sandbox's network
proxy, so the planned 2018-21 discovery was not possible: as fixed in the pre-registration before any result, discovery is
2022-01-01 to 2023-12-31 and the decisive window 2024-01-01 to 2026-10-31. The published papers' own period (to about 2018-19)
is not covered here.

## The choice (discovery only, BTC and ETH pooled, gross hour return)

| | UTC hour | mean (bp) | t | n |
|---|---|---|---|---|
| Long (highest t) | 20 | +4.86 | 2.62 | 1460 |
| Short (lowest t) | 01 | -3.89 | -2.10 | 1460 |

With 24 hours to pick from, a t of 2.6 at the top is about what chance gives.

## Decisive window, 2024-01-01 to 2026-10-31 (1R = 2 x ATR(24) on H1; stop on every trade)

| Test | n | net R a trade | gross R | cost R | financing R | month-sum t | Holm p | stops |
|---|---|---|---|---|---|---|---|---|
| Long 20 UTC, BTC | 1035 | -0.0638 | +0.0077 | 0.0375 | 0.0340 | -7.24 | 1.000 | 23 |
| Long 20 UTC, ETH | 1035 | -0.0482 | +0.0002 | 0.0256 | 0.0228 | -4.98 | 1.000 | 30 |
| Short 01 UTC, BTC | 1035 | -0.0163 | +0.0209 | 0.0372 | 0 | -1.20 | 1.000 | 29 |
| Short 01 UTC, ETH | 1035 | -0.0070 | +0.0183 | 0.0253 | 0 | -0.50 | 1.000 | 25 |

The 20:00 UTC hour ends at 17:00 New York in US summer time, the broker's crypto rollover, so two thirds of the long trades
(696 BTC, 690 ETH) also paid a night of financing. Every year (2024, 2025, 2026) of both long legs is negative.

## What the decisive hours did (descriptive, not tested)

- Pooled gross hour returns: 21:00 UTC +5.39 bp (t 4.04), 22:00 UTC +3.39 bp (t 2.57), 23:00 UTC -2.94 bp (t -2.86),
  13:00 UTC -3.71 bp (t -2.32). The late-UTC-day strength the literature reports shows in 2024-26 at 21-22 UTC, but 21:00
  UTC had t -1.85 in 2022-23: the hour that is best now was among the worst in discovery, and the discovery's best hour
  (20:00 UTC) did nothing after (+0.39 bp, t 0.28).
- Under the rule, **no hour is profitable net for BTC on either side** (48 of 48 cells negative; best long 17:00 UTC
  -0.015R, best short 13:00 UTC -0.015R). For ETH one cell of 48 is above zero: short 13:00 UTC +0.004R. A one-hour hold
  moves a few basis points; the 0.04 % round trip alone is 0.025-0.037R of a 2-ATR stop. The hour-of-day pattern, where
  it exists, is smaller than the cost of trading it this way.

## Placebo (40 seeds, a random long hour and a different random short hour, pooled net R a trade)

The real long choice (-0.0560R) beats 0 of 40 seeds (seeds range -0.056 to -0.010R: it is the worst); the real short choice
(-0.0116R) beats 35 of 40. Every seed loses on both legs.

## Notes

- Today's financing rates (BTC long 15 %, short 7.5 %; ETH long 15 %, short 10 % a year) are charged for every year.
- Entry at the Binance hour open; the broker's 16:59-17:02 New York break means a CFD fill at exactly 17:00 New York is not
  possible (it does not affect the chosen hours' entries, 20:00 and 01:00 UTC).
- Not tested: a longer hold (several hours), other coins, 2018-21 data. Any of them needs its own pre-registration.

Tests: `tests/crypto-hour.test.mjs`.
