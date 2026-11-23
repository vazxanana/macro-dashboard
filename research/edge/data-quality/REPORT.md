# Candle cache quality (23 Nov 2026)

An audit of the research candle cache every study reads (`research/edge/_lib/edgekit.mjs`, OANDA mid 5-minute and daily
candles; 18 markets: xau, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy, xag from 2005 or 2006, and gbpjpy,
eurgbp, audjpy, cadjpy, euraud, nas100, spx500, de40 from 2019). Script `audit.mjs` (about 5 minutes); every figure is in
`quality.json`, which the grids and studies read to drop the listed bad intervals. Test: `tests/data-quality.test.mjs`.

**Verdict: all 18 markets are usable from 2020 on, with the listed exclusions. None is unusable.**

## What was checked, and what was found

| Check | Result (2020 on) |
|---|---|
| Duplicates, unsorted or off-grid times, bad OHLC, non-positive prices | none, in every market and year |
| Saturday candles | none |
| Expected 5-minute slots that hold a candle | 98.3 % or more, every market and year |
| Second feed (HistData M1, 8 markets: gold and the forex majors) | 97-98 % of 5-minute candles in both; best return correlation at lag 0 every year (0.95-0.999), so the clocks agree; close difference after the year's bid / mid offset: gold $0.04 median, $0.58 at the 99th percentile; majors 0.1 pip median, 1.7-4.9 pip at the 99th |
| Daily files | UTC days, equal to the 5-minute candles from 2020 (one eurjpy Sunday stub, 11 Apr 2021); not trading days: use `dailyNY` on 5-minute candles |

## Excluded

- **Holes in the cache** (HistData has prices there, so the fetch lost them): 26 Dec 2022 05:00-21:55 UTC on every forex
  pair; 12 May 2022 05:20-08:05 UTC on all 18; the 4-5 May 2022 FOMC evening (19:25-20:55 and 22:15-03:35 UTC) in gold,
  silver, the indices and some pairs; about 3.5 h at the 8-9 May 2022 Sunday reopen (eurgbp, euraud, the indices); about
  4.5 h at the 12-13 Jan 2020 reopen (gold, silver, the indices).
- **Real index halts**: nas100 and spx500 in March 2020 (limit locks, up to 15.2 h), 9 Jan 2025 (a market closure) and
  28 Nov 2025 (an exchange outage); six unexplained 2-7 h holes in de40 in 2020-2022. Index hours are learned per year from
  the candles, so the daily break and the weekend count as closed, not as gaps.
- **Bad prints**: of 3,432 spikes on the markets with a second feed, 3,260 are confirmed by HistData (news minutes) and kept;
  10 are excluded (lone wicks or jumps that come back, at a reopen, the rollover or a holiday, with no such move in HistData):
  gold 2 Aug 2020 and 18 Feb 2024, and some on usdjpy, audusd, usdcad, usdchf.

## For review, not excluded

- Spikes on the 10 markets with no second feed (nzdusd, eurjpy and the 8 added markets) are listed under `review`.
- Days the two feeds disagree: the majors on thin holidays (10 Apr 2020, 24 Dec 2021, 15 Apr 2022, 2 Jan 2023, 29 Mar 2024,
  18 Apr 2025); silver on 10 Oct 2025 and nine days of March 2026 (a venue dislocation): a silver study over those weeks
  should leave them out.

## 2005-2019

Usable. 2006 coverage is thin (gold 94 %, silver 84 %; silver has 86 gaps over 1 h before 2020); every market has weekend
candles in 2011 and forex has Sunday candles before 2013 (`dailyNY` folds them into Monday).
