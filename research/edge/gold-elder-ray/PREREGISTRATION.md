# Pre-registration: Elder's ray pullback in the 13-day EMA trend, on spot gold daily (14 Nov 2026)

Written and pushed ALONE, before any trade or return of this rule was computed. The only numbers read from the data before
this file: the count of setups (no prices after a setup, no returns), to state the power: 518 setups 2007-16 and 536 from
2017 (about 300 a window once one position is held at a time). Paper research only: nothing live changes, nothing of `ict/`
or `council/` is edited, and no proposal follows from a pass.

## Hypothesis

Elder's "ray" reads the day's extremes against a 13-day exponential average of the close: bear power = low − EMA13, bull
power = high − EMA13. His buy rule: the EMA13 is rising (the trend is up), bear power is below zero (the day traded under the
average: a pullback) but higher than the day before (the sellers are weakening). The sell rule mirrors it (EMA13 falling, bull
power above zero but lower than the day before). The claim tested: the trade taken on that signal earns more than gold's own
drift (the same-side trade on every day of the year) and more than the same-side trade on any day of the same EMA13 trend
(the trend alone, without the ray's pullback-that-fades condition).

**Not a duplicate.** No study folder, branch, `topics.txt` line or the untested backlog names Elder or bull / bear power.
Nearest: `gold-momentum-pullback` (the live book's momentum pullback rule, a different trend and trigger; not read here),
`rsi2-pullback` / `gold-ibs` (oscillator / close-location pullbacks), `gold-h4-pullback-resume` (H4 structure),
`gold-daily-bollinger`, `gold-adx-trend`, `gold-macd`: none conditions on the low (high) against a 13-day EMA and its change
from the day before. Item 44: a new stand-alone rule, not a gate, exit, entry or size of the live gold book, whose positions
are not read.

## Data

Council-data `research/daily/xau.json` (OANDA mid XAU_USD daily candles, UTC days, March 2006 to the last complete day), read
with `git show origin/council-data:…` into a cache kept out of git. Saturday / Sunday candles are folded into the next weekday
with `council/fills.mjs` `foldWeekend` (imported, not edited). EMA13 = exponential average of the close, alpha 2/14, seeded
with the first close, used only from the 27th day on. ATR(20) = mean of the 20 daily true ranges ending at a day. Market set:
spot gold only, named before any result.

## Rule

1. At the close of day i (only candles up to day i): **BUY setup** when EMA13(i) > EMA13(i−1), low(i) − EMA13(i) < 0 and
   low(i) − EMA13(i) > low(i−1) − EMA13(i−1). **SELL setup** when EMA13(i) < EMA13(i−1), high(i) − EMA13(i) > 0 and
   high(i) − EMA13(i) < high(i−1) − EMA13(i−1).
2. Entry at the open of day i+1 (market). **Stop = entry ∓ 1.0 x ATR(20) of day i on every trade** (risk = 1 ATR).
3. Exit at the close of day i+3 (three days held). From day i+2 on, an open beyond the stop exits at that open; otherwise a
   day whose range reaches the stop exits at the stop (the entry day too).
4. One position at a time (a setup whose entry day falls inside an open trade is skipped).

Times for financing: entry = the entry day's start, exit = the exit day's end (a stop exit: the exit day's start + 12 h).

## Costs

$0.60 a round trip on every trade (twice = $1.20), plus financing on buys = `nights(entry, exit)` x `FIN.xau.long` (0.000148 a
night, the demo broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price, in R of the trade's risk. Sells pay
and earn no financing.

## Tests (Holm over three)

- **T1 (primary)**: both sides, net R a trade.
- **T2 (primary, signal vs drift)**: excess R = the trade's net R minus the mean net R of its CONTROL: the same-side trade
  entered at the open of EVERY eligible day (ATR and EMA known) of the same calendar year, same 1-ATR stop, same 3-day hold,
  same costs and financing. Excess at 2x costs uses the control at 2x too.
- **T3 (secondary, the ray vs the trend alone)**: the same excess, but the control days are only the days of that year whose
  previous day had the same-side EMA13 slope (rising for buys, falling for sells) and was NOT a setup.

Windows by entry date: in sample 2007-01-01 to 2016-12-31; out of sample (decisive) 2017-01-01 to 2026-10-31. t = mean / SE of
calendar-month sums (every month of the window, 0 when nothing closed). One-sided p from t (normal), Holm over the three OOS p
values. Placebo for T1: 40 seeds (7601-7640); each OOS trade is replaced by the control trade of a random eligible day of the
same year (same side, stop, hold, costs); the seed's mean net R.

**A test passes** when all hold: OOS value > 0; OOS month t >= 2; Holm p <= 0.05; IS value > 0; OOS value at 2x costs > 0; OOS
n >= 30; for T1 also the real OOS mean beats >= 38 of 40 placebo means. **The study passes only when T1 AND T2 pass.** T3
alone is reported, not a pass. A pass is a lead to replicate on other markets or years, never called an edge.

## Fixed now, never changed after a result

EMA 13, the one-day change of the power, ATR(20), the 1-ATR stop, three-day hold, costs, windows, seeds. No re-fit.
