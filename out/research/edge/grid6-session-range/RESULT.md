# Grid 6: session ranges inside the Daily structure (result)

**Verdict: FAIL. 0 of 18,636 cells confirmed before costs after Holm (placebo 0); the best, a New York sweep of the previous New York afternoon, made +0.225R a trade in 2015-19 (n 265, month t 3.14, Holm p 0.41).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first, commit 870d1fa). Research only:
nothing live changed, no rule is proposed. Never call any cell below an edge.

## What was run

OANDA mid 5-minute candles 2009-2019 (2009 warm-up; fills 2010-2019) for xau, eurusd, gbpusd, usdjpy, audusd, the
data-quality exclusions applied (44 fills dropped), costs of combo-grid-2. Ranges: Asia (00-07 UTC), the previous trading day,
the previous New York afternoon (17-21 UTC). Events on M15 in London (07-12 UTC) or New York (12-17 UTC): break and hold (two
closes beyond after a close inside) or sweep and reclaim (a wick beyond, a close back inside within 3 candles; traded against
the sweep). Context: a Daily key level of the trade's side (V / A turn, engulf zone, DOM, `combo-grid-3` `buildZones`)
touched today or not; the MSNR call (`council/eg-methods.mjs` `direction()` on H4 with Daily levels) with / against; the H1
box (`boxesHL(H1, 2)`) inside / closed out with / closed out against. Confirmation: none, an M15 engulf, an M15 structure
break. Entry: market at the next 5-minute open, or a trade-through limit at the range edge (fills only when price trades through
it by half the round trip). Stop: past the range's side behind the trade, or past the event's extreme + 0.1 Daily ATR. Exits:
1R, 2R, the other side of the range (a measured move for a break), held to 21:00 UTC, a 1R trail; every exit out at 21:00 UTC.
153,341 signals, 366,973 trades and 366,976 side-flipped placebo trades (one row per entry / stop, five exits each). Every
trade has its stop on the losing side.

Cut test: each market cut at five moments (2011-2019); the signals before every cut are the same as in the full run (0
missing, 0 extra in all 25 cuts).

The MSNR call was never 0 after the 2009 warm-up, so `any` = `with` + `against`.

## The bar (before costs, the pre-registered judgement; after costs beside)

| | Real, before costs | Placebo, before costs | Real, after costs | Placebo, after costs |
|---|---:|---:|---:|---:|
| Cells with n >= 100 in 2010-14 | 18,636 | 18,654 | 18,636 | 18,654 |
| Discovery winners (mean > 0, month t >= 2) | 308 | 552 | 141 | 263 |
| Expected by chance (2.3 %) | 424.9 | 425.3 | 424.9 | 425.3 |
| Raw confirmed in 2015-19 (n >= 100, month t >= 2) | 8 | 0 | 0 | 0 |
| Expected by chance (2.3 % of the winners) | 7 | 12.6 | 3.2 | 6 |
| Confirmed after Holm | 0 | 0 | 0 | 0 |

The real grid found FEWER discovery winners than chance (308 against about 425) and fewer than its own side-flipped placebo
(552): before costs, trading these events the other way did no worse. The 8 raw confirmations are what chance gives (7).

## The raw confirmations (none survives Holm)

Five of the eight are one family: the sweep of a range traded back against it, read with the MSNR call and with the last H1
box closed out AGAINST the trade, market entry, stop past the sweep's extreme.

| Cell (pooled unless named) | 2010-14 n / R / t | 2015-19 n / R / t | 2015-19 after costs | Holm p |
|---|---|---|---|---:|
| NY-afternoon range, sweep in New York, key level yes, call with, box out against, trail | 253 / +0.157 / 2.10 | 265 / +0.225 / 3.14 | +0.163 (t 2.33) | 0.41 |
| Asia range, sweep in London, call with, box out against, 1R | 693 / +0.105 / 2.85 | 667 / +0.100 / 2.61 | +0.037 (t 0.97) | 1 |
| the same, 2R | 693 / +0.180 / 3.17 | 667 / +0.121 / 2.43 | +0.058 (t 1.17) | 1 |
| the same, key level yes, 2R | 403 / +0.142 / 2.30 | 416 / +0.124 / 2.27 | +0.058 (t 1.08) | 1 |
| the same (key any), range target | 681 / +0.183 / 2.87 | 652 / +0.112 / 2.24 | +0.047 (t 0.96) | 1 |
| NY-afternoon range, sweep in New York, key yes, call with, box out against, 2R | 253 / +0.174 / 2.22 | 265 / +0.158 / 2.23 | +0.095 (t 1.38) | 1 |
| xau: NY-afternoon range, sweep in New York, call with, box inside, 1R | 267 / +0.106 / 2.11 | 245 / +0.109 / 2.12 | 0.000 (t 0.00) | 1 |
| Previous day, hold in London, call with, box out with, held to 21:00 | 600 / +0.171 / 2.17 | 573 / +0.163 / 2.10 | +0.116 (t 1.49) | 1 |

That family (sweep against, MSNR call with the trade, H1 box out against) is a hypothesis for its own pre-registered test on
other data (the 2005-2009 holdout, or the holdout markets), not a finding: it was picked from 18,636 cells, its count is at
chance, and after costs the Asia cells keep only about +0.04 to +0.06R a trade.

## Each factor alone (pooled, real trades, 2R exit, R a trade before costs; 2015-19 after costs last)

| Factor | 2010-14 | 2015-19 | 2015-19 after costs |
|---|---|---|---|
| Range: Asia / previous day / NY afternoon | -0.008 / -0.023 / -0.018 | -0.009 / -0.007 / -0.006 | -0.056 / -0.048 / -0.057 |
| Event: hold / sweep | -0.016 / -0.013 | -0.002 / -0.017 | -0.040 / -0.081 |
| Window: London / New York | -0.006 / -0.024 | -0.001 / -0.015 | -0.049 / -0.061 |
| Key level touched today: yes / no | -0.005 / -0.028 | +0.003 / -0.022 | -0.046 / -0.066 |
| MSNR call: with / against | -0.015 / -0.015 | -0.015 / +0.001 | -0.062 / -0.047 |
| H1 box: inside / out with / out against | -0.024 / -0.009 / +0.002 | -0.010 / -0.012 / +0.007 | -0.059 / -0.052 / -0.045 |
| Confirmation: none / engulf / structure break | -0.015 / -0.017 / -0.009 | -0.012 / -0.002 / +0.003 | -0.064 / -0.045 / -0.038 |
| Entry: market / trade-through limit | +0.001 / -0.042 | +0.011 / -0.038 | -0.029 / -0.097 |
| Stop: range / event extreme | -0.005 / -0.019 | +0.004 / -0.013 | -0.025 / -0.069 |

Every factor level sits within a few hundredths of an R of zero before costs and loses after costs. The MSNR call with the
trade was no better than against it. A Daily key level of the trade's side touched today was a little better than none in
both halves (about +0.02R), which is too small to pay the costs. The trade-through limit at the range edge was the worst
entry: when price comes back through the edge, the break or the reclaim has usually failed.

## Reading

Session ranges inside the Daily structure, as written here, give nothing tradable on 2010-2019: no cell survives the bar, the
count of winners is below chance and below the side-flipped placebo, and after costs nothing is left. Nothing live changed.

To repeat (about a minute once the cache is there): `export EDGE_DATA=<dir>`, fill it with
`research/edge/_lib/fetch-cache.mjs <m> 5m 2009 2019`, then `run.mjs market <m> <out>` and `run.mjs cut <m> <out>` for the five
markets, then `run.mjs report <out>`. Test: `tests/grid6-session-range.test.mjs`.
