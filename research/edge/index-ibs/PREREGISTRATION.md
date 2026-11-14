# Pre-registration: the "internal bar strength" (IBS) daily reversal on US indices (14 Nov 2026)

Written and pushed alone, before any candle of this study is read and before any number is computed. Research only: no rule,
size, filter, stop, config, mirror setting or council member changes, whatever the verdict. Not an ICT study (nothing under
`ict/` is edited; `ict/calendar.mjs` is only read for its New York clock and holiday dates, as the sister studies do).

## Why
A published and often replicated reversal: when a US equity index closes near the LOW of its day, it tends to rise the next
day. The usual measure is the internal bar strength, IBS = (close - low) / (high - low) of the day (A. Pagonidis, "The IBS
effect: mean reversion in equity ETFs", NAAIM Wagner Award paper, 2014, and many replications on SPY / QQQ / DIA). The
question is whether buying the New York close after a low-IBS day and selling the next day's close makes money after the
desk's CFD costs and overnight financing, out of the sample the idea was published on.

Related studies of the same days (branches, not on `main`), read before this file so it does not repeat them: `turnaround-tuesday`
and `turnaround-replicate` (buy the close of a down first-day-of-week), `gap-fill` (fade the 09:30 opening gap intraday),
`vol-spike-rebound` (buy after a realised-volatility spike, held a week), `index-cycle` (the owner's H4 / H1 cycle as an
entry). None measures where the close sits inside the day's range. I have read their pre-registrations and know that
`turnaround-tuesday` reported one passing cell (NAS100, after a Monday down more than 1 %). Nothing of the IBS rule has been
computed on any candle. The calendar, close candle, ATR and statistics code is copied from `turnaround-tuesday` (not imported).

## Data
- OANDA mid **H1** candles of `spx500` (SPX500_USD), `nas100` (NAS100_USD) and `us30` (US30_USD) through the site's keyless
  candle proxy (`/md/bars`), 1 Jan 2004 to 14 Nov 2026, complete candles only, rows `[t, o, h, l, c]`, `t` = the candle's UTC
  start (`fetch.mjs <dir>`, the `turn-of-month` fetcher with an earlier start; files kept out of git).
- The 2-year Treasury yield, weekly, FRED `DGS2` from council-data `macro/cache.json` `score.fred.DGS2` (it starts 6 Jan 2006),
  copied once into `rates.json` beside this file. Before 6 Jan 2006 the rate is a stated 3.85 % (the approximate mean of the
  2-year yield over 2005; not fetched: one night at 6.35 % a year is 0.017 % of price, so a point of error moves a trade by
  well under 0.01R).

## The day, the calendar and the close
- Trading days = the NYSE calendar of `turnaround-tuesday` (`dayKind`): weekdays that are not NYSE full holidays
  (`ict/calendar.mjs` `cmeYear`, observed dates) and not the unscheduled closures 29-30 Oct 2012, 5 Dec 2018, 9 Jan 2025.
  Half days (4 July eve, the day after Thanksgiving, Christmas Eve) close at 13:00 New York.
- New York time is read with the `America/New_York` zone (`ict/calendar.mjs` `nyParts`), so daylight saving is exact.
- **The close of day d** = the close of the H1 candle that ENDS at 16:00 New York (13:00 on a half day): the candle starting
  20:00 UTC in winter, 19:00 UTC in summer.
- **The session of day d (for IBS)** = the H1 candles of New York date d starting at 09:00, 10:00, ... up to the closing
  candle (7 candles; 4 on a half day). The H1 grid cannot start at 09:30: the 09:00 candle is included because the first
  half hour of the cash session often holds the day's high or low, at the price of 30 minutes of pre-open CFD prints (a
  stated limitation, fixed now, not changed after the results). The 17:00-New-York daily candle is NOT used: it includes
  the overnight session, which is not the bar the published effect is measured on.
- High(d) = the highest high, low(d) = the lowest low of those candles; close(d) as above.
  **IBS(d) = (close(d) - low(d)) / (high(d) - low(d))**. A day is usable only when every one of its session candles is on file
  and high > low; otherwise it has no IBS (skipped and counted). IBS uses only candles that ended by d's close.

## The rule (one, fixed now)
- **Signal**: IBS(d) < 0.2.
- **Entry**: buy at close(d) (the CFD trades through the cash close). **Exit**: close of the next trading day (d+1), unless
  stopped first. A day d+1 without a close: the trade is skipped and counted. Trades cannot overlap (an exit is at a close,
  the next entry at that close or later).
- **Stop** = entry - 1 x ATR(20). ATR(20) = the simple mean of the true ranges of the 20 completed New York days BEFORE d
  (each day = the H1 candles after the previous trading day's close up to its own close; true range against the previous
  close): the `turnaround-tuesday` `atrAt`, past data only. No ATR (a missing close among them) = no trade, counted.
  The stop is checked on every H1 candle after the entry candle up to and including the exit candle: a candle that OPENS at
  or below the stop fills at its open (a gap), otherwise a low at or below it fills at the stop. Every trade has a stop.
- **1R** = entry - stop. Gross R = (exit - entry) / 1R. Net R = (exit - entry - (cost + financing) x entry) / 1R.
- **Costs** (round trip as a share of the entry price, one per trade, the figures earlier index studies stated):
  SPX500 0.04 % and NAS100 0.05 % (`turnaround-tuesday`, `pre-holiday`), US30 0.05 % (`turn-of-month`).
- **Financing** per rollover night: rollovers at 22:00 UTC Monday to Friday strictly after the entry and before the exit
  (the form of `council/fills.mjs` `nights`, copied, not imported), with **Friday counting three** (index CFDs; Wednesday counts
  one). So a Monday-Thursday entry pays 1 night, a Friday entry 3, a trade over a holiday more. Long: (DGS2 + 2.5 %) / 365 a
  night, DGS2 = the last weekly value on or before the entry date (a negative value floored at 0). Short (control below):
  max(0, 2.5 % - DGS2) / 365 a night, never a credit.

## Windows (by entry date)
- **Decisive: 1 Jan 2016 to the last close on file.**
- Replication: 1 Jan 2005 to 31 Dec 2015 (2004 is warm-up for the ATR; a market whose H1 starts later replicates from its first
  usable day, said in RESULT.md).

## Tests
Months: every calendar month of the window, a month with no trade counting 0; a trade belongs to the month of its entry date.
**Month-sum t** = mean of the monthly R sums / (sd / sqrt(months)).
- **T1 SPX500, T2 NAS100, T3 US30**, each on the decisive window, PASSES when all hold:
  (a) n >= 100; (b) mean net R a trade > 0; (c) month-sum t >= 2 AND its one-sided p (normal approximation) Holm-adjusted over
  T1-T3 < 0.05; (d) mean net R a trade on the replication window > 0; (e) placebo: 40 seeds (1 to 40); for each seed and each
  calendar year, draw (uniform, with replacement, mulberry32 `rng(seed)`) as many trading days as the market's rule traded that
  year, from the trading days that are not a rule entry of that market and have a close, a next trading day and an ATR; each is
  bought at its close and traded exactly like the rule (same exit, stop, costs and financing). (e) holds when the rule's mean
  net R is above the seed's mean in at least 38 of the 40 seeds.
- **P, pooled** (one test of its own, not in the Holm family): the three markets' decisive trades together, every trade 1R.
  PASSES when mean net R > 0, month-sum t >= 2 (months of the pooled monthly sums), replication mean net R > 0, and the pooled
  placebo (each seed's draws of the three markets together) is beaten in at least 38 of 40 seeds.
- **Verdict PASS** when P passes or at least one of T1-T3 passes (four chances in all, said in RESULT.md); otherwise **FAIL**.
  A FAIL is a result.

## Reported, not judged
- **Mirror control**: IBS(d) > 0.8 → SELL at close(d), exit at close(d+1), stop entry + 1 x ATR(20) (a candle opening at or
  above it fills at its open, else a high at or above it fills at the stop), the same costs, short financing as above. n, gross
  / net R, month-sum t per market and pooled, both windows. No verdict reads it.
- Per test and window: n, gross and net R a trade, financing in R a trade, cost in R a trade, trade t, month-sum t, win rate,
  stops and gap stops, skipped signals; the placebo's 5th / 50th / 95th percentile of seed means; by year; the mean
  close-to-close return of every day against the rule's days (before costs).

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict first), `tests/index-ibs.test.mjs`. No proposal whatever the verdict: a PASS
would at most be put to the owner as a forward paper shadow, never a live rule.
