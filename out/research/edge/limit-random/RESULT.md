# Is it the zone, or any resting limit near the market? (result)

**Verdict: FAIL. Random resting limits at the DOM's own distance make -0.010R a trade before costs (n 64,451; month t -1.24 in 2010-14, -1.45 in 2015-19), while the DOM makes +0.055R (n 151,045); DOM minus random Welch t 10.59.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, pushed alone first). Pooled xau, eurusd, gbpusd, usdjpy and audusd,
fills 2010-2019, OANDA mid 5-minute candles, grid 3's `multi()` and the `dom-placebo` DOM trade unchanged (its counts are
reproduced exactly: 27,965 / 30,514 / 30,197 / 30,335 / 32,034). Judged before costs (the owner's basis); after costs beside.
Research only: nothing live changed.

## Tests (trail exit, before costs, Holm over two)

| Test | Result | Holm p | Pass |
|---|---|---:|---|
| T1 random limits (U drawn from the DOM's distances) > 0 in both halves | 2010-14 -0.0085R (n 32,909, month t -1.24); 2015-19 -0.0105R (n 31,542, month t -1.45) | 0.926 | no |
| T2 DOM minus random | +0.0642R a trade, Welch t 10.59 (month t of the per-month difference 9.78) | 6.5e-25 | yes |

By the reading fixed in advance (T1 fails, T2 passes): **the tilt needs the zone (or a body); a random resting limit near the
market does not have it.** It is not a property of resting limits on mid candles or of the fill rule.

## Pooled streams, before costs (after costs in brackets)

| Stream | n | Trail exit | 2R exit |
|---|---:|---:|---:|
| DOM | 151,045 | +0.055 (t 14.23) [-0.052] | +0.049 (t 10.30) [-0.058] |
| Random, U from the DOM's distances | 64,451 | -0.010 (t -1.92) [-0.101] | -0.013 (t -2.63) [-0.105] |
| Random, U = 0.25 ATR | 96,638 | -0.003 (t -0.81) [-0.094] | -0.008 (t -2.32) [-0.099] |
| Random, U = 0.5 ATR | 58,018 | +0.006 (t 1.39) [-0.087] | -0.001 (t -0.12) [-0.094] |
| Random, U = 1.0 ATR | 21,872 | -0.002 (t -0.22) [-0.102] | -0.019 (t -2.02) [-0.118] |

DOM minus each fixed-U stream (trail): +0.058R (t 10.84), +0.048R (t 7.67), +0.057R (t 6.00). After costs the DOM is still ahead of
the random limits by +0.049R (t 8.06), but every stream loses after costs.

## Per market (trail, before costs)

| Market | DOM | Random (n) | Random month t | DOM - random (t) | Random after costs |
|---|---:|---:|---:|---:|---:|
| Gold | +0.030 | -0.011 (12,033) | -1.03 | +0.041 (2.98) | -0.175 |
| EUR/USD | +0.061 | -0.005 (12,932) | -0.45 | +0.066 (4.82) | -0.070 |
| GBP/USD | +0.057 | -0.006 (12,936) | -0.58 | +0.063 (4.56) | -0.075 |
| USD/JPY | +0.066 | -0.015 (12,993) | -1.53 | +0.081 (5.99) | -0.113 |
| AUD/USD | +0.058 | -0.011 (13,557) | -1.17 | +0.068 (5.21) | -0.076 |

The random stream is at or below zero in every market and both halves; the DOM is ahead in every market.

## The DOM's own distances (from its signals)

The DOM's limit sits a median 0.46-0.49 x ATR(14) of H1 from the last H1 close (p10 about 0.13, p90 1.2-1.5; 95 % of signals
on the right side of that close), and its stop a median 0.67-0.69 x ATR beyond the entry (S used for the random stop). About 1 in
4 H1 candles was picked (15,422-15,983 a market); 38-43 % of the random orders filled (U from the DOM's distances), 61-63 % at
0.25 ATR, 13-15 % at 1.0 ATR.

## Reading and caveats

- The before-cost tilt of the dominant-zone limit (and of the random recent body in `dom-placebo`) is not something any resting
  limit near the market earns on OANDA mid candles: random limits at the same distance with the same stop are at zero before costs.
  So the fill rule of `multi()` and short-term mean reversion around the H1 close do not explain it; the H1 candle body does.
- It still does not pay its costs: after costs every stream loses (DOM -0.052R, t -12.05). Not an edge; nothing is proposed.
- Differences of design, said plainly: the random order rests from an H1 close, the DOM's from the touch of its zone (any later
  M5 candle while the zone stands); the random orders fill less often; trades overlap in time (the month-sum t is given beside the
  per-trade Welch t).

To repeat: fill the cache (`_lib/fetch-cache.mjs <m> 5m 2009 2019`), then `run.mjs market <m> <dir>` for the five markets
(about 20 minutes each, side by side) and `run.mjs report <dir>`.
