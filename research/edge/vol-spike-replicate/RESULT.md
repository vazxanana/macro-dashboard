# Result: frozen replication of the vol-spike rebound on seven other index markets (14 Nov 2026)

**Verdict: PARTLY.** By the pre-registered reading (PREREGISTRATION.md, committed and pushed alone before any number): on the
seven new index markets the frozen 10-day rule is positive in 2016-26 with t 1.20 (+0.056R a trade, n 278), which is the
"PARTLY" line (R1 > 0, t >= 1), but neither R1 nor the week-counted R3 reaches t 2 (Holm p 0.138 for both) and 2005-15 is
negative (-0.022R a trade). Read plainly: #860's result does **not** carry over with any strength; the one market that looks
good (HK33, n 27) is most of the total, the rule sits under the placebo's 95th percentile and at 2x costs it is near zero.
Nothing live changed; this is evidence beside #860's paper-shadow proposal, not for it.

## Gate (before anything was read)
`frozen.mjs` is #860's `run.mjs` byte for byte (sha256 `339077aa…b8c1`, pinned in the test). Its own `study()` on #860's
markets and data reproduces #860's committed `result.json` `holds["10"]` **exactly** (every field, JSON-equal: window B n 165,
+0.151R, t 2.53, Holm p 0.0114; window A n 122, +0.013R; random p95 +0.141R). The published and the reproduced blocks are both
in `result.json` `gate`.

## The three tests (10-day hold, pooled DE40, UK100, EU50, FR40, AU200, JP225, HK33; net of spread and financing)

| Test | Window | n | R a trade | t | one-sided p | Holm p | needed |
|---|---|---|---|---|---|---|---|
| R1 trades | 2016-01-01 to 2026-11-06 | 278 | +0.056 | 1.20 | 0.115 | 0.138 | > 0, t >= 2, Holm < 0.05 |
| R2 trades | 2005-01-01 to 2015-12-31 | 303 | -0.022 | -0.52 | 0.698 | | > 0 |
| R3 by entry week (mean of the week) | 2016 on | 105 weeks | +0.094 | 1.48 | 0.069 | 0.138 | > 0, t >= 2, Holm < 0.05 |

- R1 in % of price: +0.652 % a trade net (+0.827 % before costs), won 61.2 %, 70 stops, worst run -24.7R, t on calendar-month
  sums 0.70.
- R2: -0.185 % a trade net, 73 stops, worst run -24.6R. Before costs it is flat (-0.001 %).

## Placebo and costs (reported, not part of the reading)
- **Random entries** (40 seeds `rng(7001…7040)`, same count per market, same hold, stop and costs, uniform days of 2016 on):
  seeds' mean -0.008R, 95th percentile +0.066R. The rule (+0.056R) beats 36 of 40 seeds and is **under** the 95th percentile.
- **2x costs** (spread and financing doubled): R1 +0.021R (t 0.46), R2 -0.053R (t -1.24), R3 +0.056R (t 0.89).

## Per market (reported)

| Market | data from | n R1 | R a trade R1 | t R1 | n R2 | R a trade R2 | t R2 |
|---|---|---|---|---|---|---|---|
| DE40 | 2003-03-25 | 41 | +0.014 | 0.11 | 47 | +0.112 | 1.06 |
| UK100 | 2003-03-24 | 45 | +0.058 | 0.48 | 48 | +0.102 | 0.96 |
| EU50 | 2003-09-22 | 39 | -0.011 | -0.08 | 45 | -0.113 | -1.13 |
| FR40 | 2003-02-03 | 43 | +0.013 | 0.10 | 48 | -0.030 | -0.28 |
| AU200 | 2004-03-18 | 43 | +0.033 | 0.30 | 39 | -0.101 | -0.85 |
| JP225 | 2003-03-14 | 40 | +0.075 | 0.66 | 44 | -0.029 | -0.23 |
| HK33 | 2003-02-04 | 27 | +0.289 | 2.34 | 32 | -0.162 | -1.13 |

HK33 gives +7.8R of R1's +15.5R; without it R1 is about +0.031R a trade. Its R2 is the most negative of the seven.
A single market's t is not tested (seven looks; it was not pre-registered).

## By year (all seven markets, sum of net R by entry year)
2005 +3.7, 2006 +0.6, 2007 -5.2, 2008 -11.6, 2009 +3.0, 2010 -1.5, 2011 -2.3, 2012 +2.8, 2013 +4.6, 2014 -11.6, 2015 +10.9,
2016 +4.9, 2017 +2.4, 2018 -1.8, 2019 +4.5, 2020 -9.5, 2021 +7.7, 2022 -2.9, 2023 +5.8, 2024 +1.2, 2025 +5.6, 2026 -2.3
(2003-04 are warm-up years outside both windows). As on #860's markets, the real crashes (2008, March 2020) are the worst.

## Said plainly
- **Financing**: #860's method for every market, DGS2 + 2.5 % a year per calendar night (the last DGS2 on or before the
  entry; none before 2006-01-06, so 2.5 % alone then). The frozen `net()` would take another rate series, but council-data has
  no euro, sterling, yen, Australian or Hong Kong dollar rate over 2005-26.
- **Spreads** are stated, not measured (DE40 / UK100 / EU50 / FR40 2.0, AU200 3.0, JP225 10.0, HK33 15.0 points a round trip).
- **Close**: OANDA's 00:00 UTC daily candle, not the cash close (for Asian indices this is late in their next session).
- No parameter was changed; the 5-day hold was not run; no market was added or dropped after the first run.

## To repeat
`node research/edge/vol-spike-replicate/run.mjs fetch <dir>` (git show from `origin/council-data` and `origin/vol-spike-rebound`,
no network), then `node research/edge/vol-spike-replicate/run.mjs full <dir>`. Tests: `tests/vol-spike-replicate.test.mjs`.
