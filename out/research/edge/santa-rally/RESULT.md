# Result: the Santa Claus rally window on index CFDs (14 Nov 2026)

**Verdict: FAIL**, 0 of 3 tests pass: the Santa window does not beat an ordinary 7-day window of the same year.

Pre-registered bar in PREREGISTRATION.md, committed before any code was run. Long over
the last 5 trading days of December plus the first 2 of January, against every other 7-trading-day window of the same year,
decisive years 2010-2025 (n 16): SPX500 −0.13 % a year (t −0.36, 8 of 16 positive), NAS100 −0.48 % (t −1.05, 7 of 16),
DE40 + UK100 pooled +0.51 % (t 1.08, 10 of 16, Holm p 0.45, placebo share 17 %). Not an edge; nothing live changes and no
proposal is written.

**Low power, said plainly**: each year is one observation, so the decisive window holds only 16. With the yearly excess
spread seen here (sd 1.4-1.9 %), a mean excess of about +0.8 % to +1.1 % a year would be needed to clear Holm p < 0.05; a
real effect half that size would fail this test most of the time. A FAIL here means "not shown on 16 years", not "proven
absent". It also cannot be fixed by adding years: the decisive window is all of the out-of-sample history there is.

Price returns only (no dividends), each index in its own currency, OANDA mid daily candles (UTC days; council-data
`research/daily/<key>.json` at `61a60d2fd`). Net of 0.04 % a round trip and long financing at FRED DGS2 + 2.5 % a calendar
night (DGS2 weekly from council-data `macro/cache.json`; a fixed 4 % before its first value, 6 Jan 2006, i.e. for the
2003-2005 replication years; the same US rate is charged on DE40 and UK100, as asked, not their local rates). Every window
carries a 3 x ATR(20) stop; none of the 92 Santa windows (23 years x four indices) was stopped. Entry at the open of the first window day's UTC candle,
exit at the close of the last: for the US indices that is roughly the previous evening's futures session to the evening
after the last cash close.

## How it differs from the related seasonal studies

`sell-in-may` holds half a year (November-April against May-October); `turn-of-month` trades a short window every month;
`pre-holiday` trades the single day before each holiday on H1 candles. This study trades one fixed 7-day window a year
across the year end, in each index's own trading calendar (NYSE rules in code for the US indices, whose CFDs print candles
on exchange holidays; the candles' own weekday-and-volume calendar for DE40 and UK100), judged against every other 7-day
window of the same year under the same stop and costs, plus a placebo of random window positions.

## The three tests (judged)

| Test | Decisive 2010-2025: n, mean excess, t, one-sided p, + years | Holm p | Replication 2003-2009: n, mean, t, + years | Placebo share | Pass |
|---|---|---|---|---|---|
| T1 SPX500 | 16, −0.13 %, −0.36, 0.64, 8 of 16 | 1.00 | 7, +0.89 %, 0.62, 4 of 7 | 57.6 % | no (all three checks missed) |
| T2 NAS100 | 16, −0.48 %, −1.05, 0.84, 7 of 16 | 1.00 | 7, +0.96 %, 0.71, 5 of 7 | 74.1 % | no (all three checks missed) |
| T3 DE40 + UK100 pooled | 16, +0.51 %, 1.08, 0.15, 10 of 16 | 0.45 | 7, +2.12 %, 2.30, 7 of 7 | 17.0 % | no (positive in both windows; Holm and placebo missed) |

Placebo: 1,000 draws of a random start position (the k-th trading day of each year, k 0-239, seed 20261214), the same
excess computation in each decisive year; share = draws whose mean excess is at least the Santa window's. The placebo
means' 5-95 % range is about −1.0 % to +1.0 % on every test; the Santa window sits at its middle on T1 and T2 and inside it
on T3.

At 2x costs (double round trip and double financing; reported, not judged): T1 −0.16 % (t −0.45), T2 −0.51 % (t −1.12),
T3 +0.45 % (t 0.94). Costs barely move the excess, because the comparison windows pay the same costs; the Santa window pays
a little more financing (it spans more calendar days).

## Year by year (excess = Santa window net minus the mean of the year's other 7-day windows; T3 = mean of the two indices)

| Year | SPX500 excess | NAS100 excess | DE40 + UK100 excess | Window |
|---|---|---|---|---|
| 2003 | +1.80 % ▲ | +2.32 % ▲ | +1.79 % ▲ | replication |
| 2004 | −1.90 % ▼ | −2.54 % ▼ | +0.71 % ▲ | replication |
| 2005 | +0.12 % ▲ | +0.44 % ▲ | +1.58 % ▲ | replication |
| 2006 | −0.47 % ▼ | +1.33 % ▲ | +1.14 % ▲ | replication |
| 2007 | −2.64 % ▼ | −2.98 % ▼ | +0.41 % ▲ | replication |
| 2008 | +8.86 % ▲ | +7.76 % ▲ | +7.53 % ▲ | replication |
| 2009 | +0.51 % ▲ | +0.36 % ▲ | +1.69 % ▲ | replication |
| 2010 | +1.11 % ▲ | +0.52 % ▲ | −0.75 % ▼ | decisive |
| 2011 | +1.27 % ▲ | +2.45 % ▲ | +4.46 % ▲ | decisive |
| 2012 | +1.81 % ▲ | +1.99 % ▲ | +0.84 % ▲ | decisive |
| 2013 | −0.47 % ▼ | −1.59 % ▼ | +1.30 % ▲ | decisive |
| 2014 | −3.23 % ▼ | −3.09 % ▼ | −3.93 % ▼ | decisive |
| 2015 | −2.17 % ▼ | −3.06 % ▼ | −1.21 % ▼ | decisive |
| 2016 | +0.02 % ▲ | −0.24 % ▼ | +1.45 % ▲ | decisive |
| 2017 | +0.27 % ▲ | +0.63 % ▲ | +0.68 % ▲ | decisive |
| 2018 | +1.44 % ▲ | +1.83 % ▲ | −1.12 % ▼ | decisive |
| 2019 | −0.50 % ▼ | +0.05 % ▲ | −0.58 % ▼ | decisive |
| 2020 | −0.11 % ▼ | −0.29 % ▼ | +2.15 % ▲ | decisive |
| 2021 | +0.74 % ▲ | −1.12 % ▼ | +2.06 % ▲ | decisive |
| 2022 | +1.16 % ▲ | +0.63 % ▲ | +1.51 % ▲ | decisive |
| 2023 | −1.38 % ▼ | −3.45 % ▼ | −0.63 % ▼ | decisive |
| 2024 | −1.36 % ▼ | −1.65 % ▼ | +0.39 % ▲ | decisive |
| 2025 | −0.62 % ▼ | −1.25 % ▼ | +1.52 % ▲ | decisive |

The 2003 baseline covers March to December only (the candle files start 24 March 2003). The replication years' US
average is carried by 2008 (+8.9 % on SPX500, the post-crash rebound); without it they are negative.

## Post hoc, not judged

- T3's two indices apart: UK100 +1.09 % a year in 2010-2025 (t 2.48, 14 of 16 positive) and +2.40 % in 2003-2009 (t 2.37,
  7 of 7); DE40 −0.07 % (t −0.12, 8 of 16) and +1.84 % (t 2.10). UK100 alone was not a pre-registered test: it is the best
  of four series looked at after the fact (and five with the pooled one), so its t is not evidence. Testing it would need
  its own pre-registration on data not seen here (for example another FTSE price series before 2003, or the windows from
  2026 on).
- The US indices do not show the folklore over 2010-2025: the window lost against an ordinary week in 8 of 16 SPX500
  years and 9 of 16 NAS100 years. The widely quoted average comes from earlier decades.

## Files

`PREREGISTRATION.md` (first commit), `run.mjs` (`node run.mjs fetch <dir>` = `git show` of the four candle files and
`macro/cache.json`, no network; `node run.mjs <dir>` writes `result.json`), `result.json` (every year's windows with dates,
entry / exit, financing, baseline, excess; the stats, Holm, placebo and 2x-cost runs), `tests/santa-rally.test.mjs`.
