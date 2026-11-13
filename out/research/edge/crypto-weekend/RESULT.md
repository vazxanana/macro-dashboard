# Result: the weekend vs weekday split in Bitcoin and Ether (13 Nov 2026)

**Verdict: FAIL, 0 of 4 tests pass.** Long the weekend (Friday 21:00 to Sunday 23:00 UTC) and short Monday (Monday 00:00 to
Tuesday 00:00 UTC), each with a 2 x ATR(24) H1 stop, `CFD_CRYPTO` round trip and the demo broker's crypto swap, made at most
+0.06R a trade on 2024-26 with t 0.58, and lost in the window before it, or the other way round. No day-of-week effect worth a
paper shadow; nothing live changed. Rules, windows and pass bar: `PREREGISTRATION.md` (committed before this run).

## Decisive window 2024-01-01 to 2026-10-31 (net R a trade; t on trades; Holm over four)

| Test | n | Net R | Gross R | Cost R | Financing R | t | Month-sum t | Holm p | Discovery net R (2022-23) | Pass |
|---|---|---|---|---|---|---|---|---|---|---|
| W-btc | 147 | +0.0004 | +0.0985 | 0.0301 | 0.0680 | 0.00 | 0.00 | 1.0000 | -0.0483 | no |
| W-eth | 147 | +0.0628 | +0.1334 | 0.0218 | 0.0488 | 0.58 | 0.61 | 1.0000 | -0.1170 | no |
| M-btc | 148 | -0.0764 | -0.0214 | 0.0479 | 0.0071 | -0.44 | -0.57 | 1.0000 | +0.2506 | no |
| M-eth | 148 | -0.1394 | -0.1023 | 0.0309 | 0.0063 | -0.88 | -1.09 | 1.0000 | +0.1502 | no |

- **Weekend long**: positive before costs on both coins in 2024-26 (+0.10R and +0.13R a trade) but financing (2.3 nights a
  hold on average, Friday counting three in New York winter) and the spread take most of it; Bitcoin ends at zero. In
  2022-23 it lost (-0.05R, -0.12R). With a Friday counted as one night: +0.017R (BTC), +0.075R (ETH), still far from t 2.
- **Monday short**: the one that worked in discovery (+0.25R BTC, +0.15R ETH on 2022-23, t 1.21 and 0.84) lost in the decisive
  window (-0.08R, -0.14R): positive in 2024, flat 2025, -0.40R / -0.53R a trade in 2026. 110 of 148 shorts were stopped (a
  2 x ATR(24) H1 stop is tight for a 24-hour hold).
- **Placebo** (40 seeds, same hold and side from a random weekday start): the weekend long beats 20 (BTC) and 17 (ETH) of 40;
  the Monday short 18 and 2 of 40. The real rules sit inside the noise of any other start.

## Context: daily candles (no stop, no cost; descriptive only)

Mean % return, Saturday open to Sunday close (weekend) and Monday open to close, with t:

| Coin | Window | Weekend % (t) | Monday % (t) |
|---|---|---|---|
| BTC | 2017-08-17 to 2021-12-31 | +0.316 (1.15) | +0.493 (1.61) |
| BTC | 2022-23 | +0.051 (0.22) | +0.081 (0.22) |
| BTC | 2024-26 | +0.140 (0.71) | +0.505 (2.16) |
| ETH | 2017-08-17 to 2021-12-31 | +1.005 (2.52) | +0.382 (0.98) |
| ETH | 2022-23 | -0.069 (-0.21) | -0.089 (-0.22) |
| ETH | 2024-26 | +0.252 (0.81) | +0.518 (1.57) |

Monday's open-to-close has been, if anything, up, not down (the short's pre-stated side), and Ether's strong 2017-21 weekend
did not repeat in 2022-26. The published anomalies come mostly from the early, thin years.

## Limits

- Discovery is 2022-23 only (5-minute candles start 2022-01-01; exchange APIs are refused from the build sandbox); the
  daily file reaches 2017 but cannot place the entry, exit or stop.
- Today's swap rates are charged for every year, and Saturday and Sunday are charged as well as the triple Friday (the costlier
  reading of the broker file); the sensitivity above shows this does not change the verdict.
- Binance spot candles, not the broker's CFD prices.

To repeat: `git fetch origin council-data && node research/edge/crypto-weekend/run.mjs`. Tests:
`tests/crypto-weekend.test.mjs`.
