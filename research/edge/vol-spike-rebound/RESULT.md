# Result: buy US index CFDs after a realised-volatility spike (13 Nov 2026)

**Verdict: PASS** on the pre-registered bar (PREREGISTRATION.md, committed and pushed before any number was computed), by the
**10-day hold variant only**, and **weakly**. Read the caveats before the tables: the pass rests on pooled trades of three
indices that mostly signal in the same weeks; counted by independent weeks or by calendar months it is not apart from luck
(t 1.68 and 1.98), the 2008-15 replication is flat (+0.013R a trade, t 0.18; negative in percent of price), and it beats only
38 of 40 random-entry seeds. The primary 5-day hold fails (t 1.96). Not an edge to trade; at most a paper shadow, which is
the owner's decision (`research/proposals/2026-11-13-vol-spike-rebound.md`). Nothing live changed.

## Pooled, net of spread and financing (decisive window B: 2016-01-01 to 2026-11-06)

| Hold | n B | R a trade B | % a trade B | won | t trades | Holm p | t months | t weeks (post-hoc) | random p95 | n A | R a trade A | bar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 days | 216 | +0.076 | +0.497 | 65.28 % | 1.96 | 0.0253 | 1.79 | 1.35 | +0.110 | 169 | +0.026 | fail |
| 10 days | 165 | +0.151 | +0.899 | 63.64 % | 2.53 | 0.0114 | 1.98 | 1.68 | +0.141 | 122 | +0.013 | PASS |

- Bar per hold: n >= 40, mean > 0, t >= 2, Holm p < 0.05 over the 2 holds, window A mean > 0. The 5-day hold misses on t
  (1.96 < 2) although its Holm p is under 5 %. The 10-day hold meets every check.
- Random entries (same count per market, same hold, stop and costs, 40 seeds): mean +0.039R (5 days) and +0.051R (10 days),
  the index drift. The rule beats 34 and 38 of 40 seeds. The 10-day rule (+0.151R) is just over the 95th percentile (+0.141R).
- Window A (2008-15, replication): positive in R only; in percent of price both holds lose (-0.123 % and -0.539 % a trade),
  because the 2008 losses are large in price but measured against a wide ATR stop.
- Stops hit in B: 26 (5 days), 32 (10 days). Worst run in B: -9.4R and -9.1R; in A -12.6R and -18.0R.

## Per market, window B and A (reported)

| Hold | Market | n B | R a trade B | t B | n A | R a trade A | t A |
|---|---|---|---|---|---|---|---|
| 5 | SPX500 | 73 | +0.114 | 1.77 | 60 | +0.067 | 0.91 |
| 5 | NAS100 | 75 | +0.063 | 0.96 | 53 | -0.021 | -0.26 |
| 5 | US30 | 68 | +0.048 | 0.67 | 56 | +0.026 | 0.32 |
| 10 | SPX500 | 55 | +0.184 | 1.73 | 43 | +0.049 | 0.39 |
| 10 | NAS100 | 57 | +0.159 | 1.57 | 39 | -0.038 | -0.30 |
| 10 | US30 | 53 | +0.108 | 1.04 | 40 | +0.024 | 0.19 |

No single market has t >= 2 in either window.

## By year (10-day hold, all three markets, sum of net R by entry year)
2008 -10.9, 2009 +1.1, 2010 -2.4, 2011 -3.1, 2012 +2.2, 2013 +6.5, 2014 +4.6, 2015 +3.6, 2016 +6.9, 2017 +6.7, 2018 -0.7,
2019 +2.5, 2020 -7.4, 2021 +5.1, 2022 -1.0, 2023 +1.5, 2024 +2.0, 2025 +4.5, 2026 +4.7 (full table in result.json). The
two real crashes (2008, March 2020) are the worst years: buying the first spike of a crash loses.

## Caveats, said plainly
- **Dependence**: the three indices move together, so one sell-off gives up to three trades. The bar's t treats them as
  independent. Summing R by entry week (76 clusters, post-hoc diagnostic) gives t 1.68; by calendar month 1.98.
- **Replication**: 2008-15 is flat. "Same sign" was met by +0.013R.
- **Variant**: the pass is the pre-stated variant, not the primary hold. The Holm correction covers both, but the primary
  did not pass.
- **Close**: OANDA's 00:00 UTC candle close, not the cash close; the VIX itself was not tested.
- No parameter was changed after the first run; no other multiple, median length, SMA or hold was tried.

## To repeat
`node research/edge/vol-spike-rebound/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/vol-spike-rebound/run.mjs full <dir>`. Tests: `tests/vol-spike-rebound.test.mjs`.
