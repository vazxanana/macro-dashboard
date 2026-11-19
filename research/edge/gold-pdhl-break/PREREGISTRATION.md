# Pre-registration: gold closes beyond the previous UTC day's high or low in London / New York, and the move continues (14 Nov 2026)

Written and pushed alone, before any trade of this rule is computed. The test runs once; nothing below is changed after a
result is seen. Paper research only: nothing live changes, no council member, page, mirror or config reads it.

## What this is, and what it is not
- **A new stand-alone intraday rule on spot gold. It is never a gate, exit, entry or size of the live gold book** (Gold trend,
  Gold daily engulf; owner decision 44). None of the book's records is opened; the book's rules are not read or varied.
- The opposite question to `mmxm-pdhl-raid-gold` (which faded a raid of the previous day's high / low back into the range,
  FAIL on 12 trades). Here a close beyond the level is taken as a breakout and held in its direction.
- Dedupe (read before writing this): `mmxm-pdhl-raid-gold` (fade, previous 17:00 New York day), `gold-daily-turtle-soup`
  (fade of failed 20-day breaks, daily), `gold-london-reversal` (fade of the London move), `gold-asia-break` (Asian range
  breakout), `nr7-breakout` (stop orders at an NR7 day's range), `gold-comex-orb` (08:20-08:50 New York opening range),
  `gold-record-high` (all-time closing high, 20 days), `trend-breadth-h1` (the 20-day high breakout of Gold trend on other
  markets). None tests a continuation entry on an intraday close beyond the previous day's high / low on gold.

## Data
OANDA mid XAU/USD M5 candles read through the keyless candle proxy (a cache file kept out of git: `xau-5m-vol.json.gz`,
rows `[t, o, h, l, c, v]`, from 2015-12-01). M15 and D1 candles are built from those M5 candles; every fill and exit is walked
on M5.
- **D1** = the complete UTC day (00:00-23:55 UTC of M5 candles), open of the first, high / low over all, close of the last.
  Weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` (the Sunday-evening stub joins
  Monday), so the previous day of a Monday is Friday.
- **M15** = M5 candles grouped on UTC quarter hours (00, 15, 30, 45), open of the first present, close of the last present.
- Trading days = UTC Monday to Friday with M5 candles in the 07:00-17:00 window; a day with no previous folded D1 candle, or
  fewer than 20 earlier folded D1 candles (for the ATR and the average), is skipped.

## The rule (a buy; a sell mirrors with PDL)
- **PDH / PDL** = high / low of the previous folded D1 candle (the last complete UTC day before day D). **ATR20** = the
  simple mean of the true range of the 20 folded D1 candles up to and including the previous day. **SMA20** = the simple mean
  of the closes of those same 20 days.
- **Trigger**: the first M15 candle of day D that starts 07:00-16:45 UTC (so it closes by 17:00) and whose close is above PDH
  (buy) / below PDL (sell). At most one trigger per side per day (the first); later closes beyond the level that day are
  ignored. Nothing before 07:00 is a condition.
- **Entry**: market at the open of the next M15 candle (the first M5 candle at or after the trigger candle's end), on day D,
  before 20:00 UTC.
- **Stop** (every trade has one, from the fill): PDH − 0.25 x ATR20 for a buy, PDL + 0.25 x ATR20 for a sell. If the entry is
  not on the right side of that stop (entry ≤ stop for a buy), no trade.
- **One position at a time per test.** A trigger whose entry time falls while that test's position is still open is not
  taken (it is not delayed).
- **Walk on M5** from the entry candle: an M5 candle opening beyond the stop exits at its open; one trading through the stop
  exits at the stop; a target (T2) is filled at the target price; when the stop and the target are both inside one M5 candle
  it is a stop.
- **T1**: no target; out at 20:00 UTC (the close of the last M5 candle that starts before 20:00).
- **T2**: target entry + 1.5R (R = entry − stop), else out at 20:00 UTC.
- **T3**: T1, taken only when the previous day's D1 close is on the trade's side of SMA20 (buy: close > SMA20; sell:
  close < SMA20). Its own one-position stream.

## Costs
- $0.60 a round trip per ounce (spread and slippage), charged on every trade, in R = 0.60 / (entry − stop).
- Financing: a buy pays `council/fills.mjs` `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD swap.long of
  11 Nov 2026) x `nights(entry, exit)` x entry / R. With the exit at 20:00 UTC no trade normally crosses a rollover; it is
  computed anyway. Sells are charged nothing and credited nothing.
- Also reported at 2x costs ($1.20 and twice the financing).

## Windows
In sample 2016-01-01 to 2020-12-31; out of sample 2021-01-01 to the last complete day of the data (13 Nov 2026). A trade
belongs to the window of its entry day.

## Statistics
- R a trade gross and net; t on calendar-month sums of net R, every calendar month of the window counted (0 for a month with
  no trade); one-sided p from that t (normal); **Holm over the three tests** (T1, T2, T3) on the out-of-sample p.
- **Placebo**, 40 seeds per test: for each real out-of-sample trade of the test, a random out-of-sample trading day, a random
  M15 candle starting 07:00-16:45 UTC on it (entry at the next M15 open as above), a random side, the real trade's stop
  distance in dollars, the test's own exit (T1 / T3: 20:00; T2: 1.5R target), the same costs. Each seed gives a mean net R a
  trade; the real out-of-sample mean is compared with the 40.
- Also reported: by year, by side, win rate, exits by kind, worst drawdown, median stop distance.

## Pass bar (per test; all must hold)
1. Out-of-sample net R a trade > 0.
2. Out-of-sample month t ≥ 2 and Holm-adjusted p < 0.05.
3. Positive in both halves: in-sample net R a trade > 0 and out-of-sample net R a trade > 0.
4. Out-of-sample net R a trade still > 0 at 2x costs.
5. Beats at least 38 of the 40 placebo seeds.
6. Out-of-sample n ≥ 30.

The study passes if any test passes; the verdict names which. A pass is still not an edge in the live book, never a gate on
it, and any use would be the owner's decision after a forward record. A FAIL closes the question for this rule; a variant
(another stop, another window, another target) is a different rule and needs its own pre-registration.

## Deliverables
`research/edge/gold-pdhl-break/{PREREGISTRATION.md, run.mjs, RESULT.md, result.json}`, `tests/gold-pdhl-break.test.mjs`,
and `out/` rebuilt. To repeat: `node research/edge/gold-pdhl-break/run.mjs <path to xau-5m-vol.json.gz>`.
