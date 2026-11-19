# Gotobi replication: the fade after the 09:55 Tokyo fix on other yen crosses and on earlier USD/JPY (pre-registration)

Written and pushed on 14 Nov 2026 before any candle of the crosses was fetched and before any trade of this replication was
computed. Nothing below may change after the first result; anything found later is reported as found later, never folded into
the verdict.

## Why

The `gotobi` study (branch `gotobi`, draft PR #878, commit `5f341e069`) passed one of four pre-registered tests: **T2**, sell
USD/JPY at the 09:55 Tokyo fix on gotobi days and buy back at 15:00 Tokyo (2016-now n 771, +0.148R a trade net, month t 2.74;
2010-15 +0.131R, t 2.45; Holm p 0.012). About 60 studies were run in the two days before it, so before anyone acts on it the
same rule is run, unchanged, on data it was never fitted to.

## The frozen rule

`frozen.mjs` in this folder is a byte-for-byte copy of `research/edge/gotobi/run.mjs` at commit `5f341e069` of branch `gotobi`
(sha256 `645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32`, pinned in `tests/gotobi-replicate.test.mjs`).
`run.mjs` imports from it and changes NOTHING of the rule: the Tokyo calendar and the gotobi days, the fade leg's times
(sell 00:55 UTC, buy back 06:00 UTC), the price rule (open of the M5 candle at the time; an exit falls back to the close of a
candle at most 15 minutes earlier), the stop (D = 1.5 x the median absolute move of the same window over the 20 Tokyo business
days strictly before, at least 15 of them with data), the stop-first management with gap fills, R, the cost formula, the month
t, Holm, the seeded mulberry32 draw and the placebo rank (38th of 40). It uses the frozen file's `trade`, `stopDist`,
`windowMove`, `index`, `gotobiSet`, `isTokyoBusinessDay`, `summary`, `monthT`, `draw`, `normCdf` and `costPx` as they are.
The only differences are the market list (and, for R2, the years), as below.

## Costs per cross

The frozen formula, applied unchanged to every cross: cost in price = 0.3 pip spread + 2 x 0.5 pip slippage + 2 x 22.5e-6 x
entry price (USD 22.5 per million of USD notional a side; for a yen cross X/JPY the notional in USD is units x X/USD and
X/USD x USD/JPY = X/JPY, so the commission a side in yen is 22.5e-6 x the cross's price per unit, as in the original). A pip is
0.01 on every yen cross. **The 0.3 pip spread for GBP/JPY, AUD/JPY, CAD/JPY and CHF/JPY is assumed, not measured** (the demo
account's measured raw-spread figure is for the majors; crosses usually quote wider). So every table also reports a **2 x cost
column** (net R at twice the cost in R: gross R - 2 x cost R); it is reported, not a condition.

## R1: the T2 fade on the other yen crosses, same years

- Markets: GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY (OANDA mid M5).
- Window: 2010-01-01 to the last whole day on file (the original's two windows together). Gotobi days only, fade leg only.
- Pooled: the trades of the four crosses together. Net R a trade = mean over all pooled trades. Month t = the frozen `monthT`
  on the pooled trades (calendar-month sums of net R across all four crosses; t = mean / (sd / sqrt n)).
- **R1 passes only if all three hold:**
  1. Pooled net R a trade > 0 **and** pooled month t >= 2.
  2. At least 3 of the 4 crosses have net R a trade > 0 over the window.
  3. Placebo (the original's design, pooled): seeds 1-40; for each seed and each cross, the frozen `draw` takes, from that
     cross's Tokyo business days of the window that are NOT gotobi days and on which the fade leg can be computed, as many days
     as that cross has gotobi trades; the seed's value is the pooled net R a trade of those draws. The pooled gotobi net R a
     trade must be above the 38th of the 40 values sorted from lowest (the 95th percentile).
- Reported, not conditions: per cross n, net R, gross R, cost R, month t, its own 40-seed placebo 95th percentile, the
  2016-now and 2010-15 halves, by year, and the 2 x cost figures.

## R2: earlier USD/JPY history

- Market: USD/JPY, the T2 fade, gotobi days, from the first day on OANDA's M5 history (fetch tried from 2004-12-01, so trades
  can start from about February 2005 once 15 of the 20 prior business days have the window) to 2009-12-31. None of these days
  is in the original study (it started 2010-01-01).
- **R2 passes if net R a trade > 0 and month t >= 1.5.** The lower t bar is chosen here, before any result, because about five
  years give only about 380 trades. A 40-seed placebo is reported, not a condition.

## Verdict

- **"Replicates"** if R1 passes; **"Does not replicate"** if R1 fails.
- R2 is supporting evidence only and does not change that verdict, unless R1 has too few trades: if R1 has fewer than 400
  pooled trades, the verdict is "Inconclusive" and R2's pass or fail is stated beside it as the only out-of-sample check.
- Either way the report gives n, net R, gross R and month t per cross and pooled, the R2 row, the placebo values, the stop-out
  share, the days lost to missing candles and the 2 x cost figures. A "replicates" would still be a proposal for the owner,
  never a live rule; nothing live changes here.

## Data

OANDA mid M5 candles through the site's keyless candle proxy (`/md/bars`), the gotobi branch's `fetch.mjs` pattern (pages of
4,999 candles, paced, progress saved per market): the four crosses from 2009-11-01 (lookback for January 2010) to the end of
the existing USD/JPY file, and USD/JPY from 2004-12-01 to 2009-11-01 (the existing file starts there). The placebo needs every
Tokyo business day, so the fetch is contiguous; to keep the files small only the candles that start between 00:00 and 06:55
UTC are kept (the fade leg and its 20-day lookback read 00:40-06:00 UTC only). Candles stay outside git.
