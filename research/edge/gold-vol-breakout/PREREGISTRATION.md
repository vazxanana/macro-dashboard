# Pre-registration: the intraday volatility breakout (open ± k × the previous day's range) on gold (14 Nov 2026)

Written and pushed alone, before any trade of this rule is computed. The test runs once; nothing below is changed after a
result is seen. Paper research only: nothing live changes, no council member, page, mirror or config reads it.

## What this is, and what it is not
- **A new stand-alone intraday rule on spot gold. It is never a gate, exit, entry or size of the live gold book** (Gold trend,
  Gold daily engulf; owner decision 44). None of the book's records is opened; the book's rules are not read or varied.
- The classic volatility breakout of the Larry Williams / "dual thrust" family: a buy stop k × the previous day's range above
  today's open and a sell stop k × that range below it.
- Dedupe (read before writing this): `nr7-breakout` (stop orders at an NR7 day's high / low, FAIL), `gold-squeeze` (Bollinger
  inside Keltner release, FAIL), `gold-asia-break` (Asian range into London, FAIL), `gold-comex-orb` (08:20-08:50 New York
  opening range, FAIL), `gold-pdhl-break` (a close beyond the previous day's high / low), `intraday-momentum` and
  `metals-intraday-momentum` (first half hour → last half hour, FAIL), `orb-nas100`. None places the orders at the day's open
  ± a multiple of the previous day's range on gold.

## Data
OANDA mid XAU/USD M5 candles read through the keyless candle proxy (a cache file kept out of git: `xau-5m-vol.json.gz`, rows
`[t, o, h, l, c, v]`, from 2015-12-01). Every fill and exit is walked on M5.
- **D1** = the complete UTC day built from the M5 candles (00:00-23:55 UTC: open of the first, high / low over all, close of
  the last). Saturday / Sunday candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` (the
  Sunday-evening reopen stub joins Monday), so the previous day of a Monday is Friday.
- **Trading days** = UTC Monday to Friday from 2016-01-01 to the last complete day of the file. A day is skipped when it has no
  previous folded D1 candle, when that candle's range is not above 0, when no M5 candle starts 00:00-00:55 UTC, or when fewer
  than 200 M5 candles start 00:00-20:55 UTC (holidays, thin days).

## Rule
- **Open** O = the open of the day's first M5 candle starting at or after 00:00 UTC (for a Monday, not the Sunday reopen).
- **prevRange** = high − low of the previous folded D1 candle.
- At the open two stop orders are placed: buy at O + k × prevRange, sell at O − k × prevRange. They are live on every M5
  candle starting 00:00-20:55 UTC. The first one a candle reaches fills; the other is cancelled. One trade a day at most.
- **Fill**: a buy fills at max(level, the candle's open) (a gap through the level fills at the open), a sell at
  min(level, open). When one M5 candle reaches both levels, the level nearer the candle's open fills (equal: the buy).
- **Stop** = the open O, i.e. k × prevRange on the other side of the level; every trade has it from the fill. 1R = |fill − O|.
  In the fill candle itself, a reach of the stop after the fill counts as stopped (worst case). Later, stop first: a candle
  whose open is through the stop exits at that open, otherwise a touch exits at the stop.
- **Exit** at 21:00 UTC: the close of the last M5 candle starting before 21:00 UTC, unless stopped first. No target.
- **Tests** (k fixed in advance, nothing chosen afterwards):
  - **T1 (primary)**: k = 0.5, both sides.
  - **T2**: k = 0.7, both sides.
  - **T3**: k = 0.5, buys only (no sell order), and only on days when the previous folded D1 close is above the mean of the
    last 20 folded D1 closes (that close included; nothing of the day itself).

## Costs
- $0.60 a round trip per ounce of gold (spread and slippage together), taken off every trade in R (0.60 / 1R).
- Financing: `FIN.xau.long` (0.000148 of the entry price a night, the cTrader demo's XAUUSD swap of 11 Nov 2026) × `nights`
  (22:00 UTC rollovers between fill and exit, Wednesday three) on buys; sells pay and earn nothing. With the 21:00 exit no
  trade crosses a rollover, so this is expected to be 0; it is counted anyway.
- 2x costs: $1.20 a round trip and twice the financing.

## Windows
- In sample 2016-01-01 to 2020-12-31; out of sample 2021-01-01 to the end of the data (2026-11). (These windows are this
  study's own, fixed here; the out-of-sample window decides.)

## Statistics
- Per test and window: n, win %, gross and net R a trade, total, worst drawdown in R, t on calendar-month sums of net R (and
  of gross R, reported), by year, by side.
- One-sided p from the out-of-sample month-sum t (normal); Holm over the three tests.
- **Placebo**, 40 seeds (seeded generator, seeds 1-40), out of sample: on every day the test could trade (T3: its filtered
  days), one entry at the open of an M5 candle drawn uniformly from 01:00-18:00 UTC (5-minute grid), side drawn by a fair coin
  (T3: buy, its only side), market fill at that open, stop k × prevRange away (the test's k), exit at 21:00 UTC or the stop,
  the same costs. Each seed gives a mean net R a trade.

## Pass bar (per test)
A test passes only when ALL hold, out of sample unless said:
1. net R a trade > 0;
2. month-sum t ≥ 2 and Holm-adjusted p < 0.05;
3. net R a trade > 0 in sample too (positive in both halves);
4. net R a trade > 0 at 2x costs;
5. the real mean net R a trade beats at least 38 of the 40 placebo seed means;
6. n ≥ 30.

**The study's verdict is PASS only if T1 passes.** T2 or T3 passing alone is reported as a hypothesis for its own
pre-registration on other data, never as an edge. Whatever the verdict, nothing live changes; a pass would at most be a
proposal for the owner with its own forward paper record.
