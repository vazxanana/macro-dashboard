# Pre-registration: the smash-day reversal on spot gold, against the same order on every day (14 Nov 2026)

Written, committed and pushed alone before any number of this study was computed. Paper research: nothing here is read by
the council, the mirror or the page, and no live rule changes whatever the verdict. Not an ICT study.

**Item 44 (docs/owner-decisions.md) and what this study is not.** A NEW stand-alone daily rule on gold, traded both ways. It
is not a gate, an exit, an entry or a size of the gold book (Gold trend / Gold daily engulf), reads none of that book's
trades or signals, and its verdict says nothing about that book.

## The idea
The "smash day" of the trading literature: a day that CLOSES beyond the previous day's extreme (a close below yesterday's low,
a "bearish smash") traps the late sellers when the NEXT day trades back above the smash day's high; the trade is a buy-stop
just above that high, stop under the smash day's low. Mirror: a close above yesterday's high, then a sell-stop just under the
smash day's low. Question: does the smash day itself add anything to the plain stop entry through the previous day's range,
net of costs? **The primary test measures exactly that**: the same buy-stop / stop / exit placed after EVERY day (no smash
condition) is the baseline, so gold's drift and the mechanics of a stop entry above a day's high are taken out.

## Dedupe (read before writing this)
- `gold-key-reversal` (branch, FAIL): a new 20-day extreme refused the same day, or an outside day closing against the previous
  close; market entry at the next open. Here: no 20-day extreme, the setup day CLOSES beyond the previous extreme (the
  opposite of a refusal on that day), and the entry needs a stop order through the setup day's other extreme the next day.
- `gold-hikkake` (branch): an inside day, a false break of it, then a stop entry through the other side. Not a close beyond the
  previous extreme.
- `gold-daily-turtle-soup` (branch): a break of the 20-day extreme that fails. `gold-pdhl-break` (branch): a break of the
  previous day's high / low traded WITH the break; this study's baseline is that kind of order on every day, the test is whether
  the smash condition adds to it.
- `gold-ibs`, `gold-streak`, `gold-shock-revert`, `metals-rsi2`: one-day close location, streaks of closes, size of the move, a
  2-day RSI; market entries, no stop-order confirmation.
- topics.txt and `git branch -r`: no "smash" / "Williams" study; `git grep -i smash -- research` finds nothing; the 14 Nov
  untested backlog does not list it.

## Data and the day
- council-data `research/daily/xau.json` (OANDA mid, UTC days), read with `git show origin/council-data:...` into a cache
  outside git. Weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` (imported, unchanged):
  the Sunday stub is not a day.
- ATR(20) at day i = the simple mean of the true ranges of the 20 days ending at day i (needs 21 days).

## Setups (on the close of day i)
- **Bearish smash** (long setup): close(i) < low(i-1).
- **Bullish smash** (short setup): close(i) > high(i-1).

## The trade (rule and baseline alike)
- Long: buy-stop at high(i) + $0.10, valid on day i+1 only. Filled when high(i+1) >= trigger; fill = max(open(i+1), trigger).
  Stop = low(i) - $0.30; if that is closer than 0.5 x ATR(20)(i) to the fill, the stop is put at 0.5 x ATR(20) below the fill.
  Short: mirror (sell-stop at low(i) - $0.10, stop high(i) + $0.30).
- Daily candles cannot tell the order of prices inside the entry day: **if day i+1's range also reaches the stop, the trade is
  a stop-out on that day (worst case)**. On days i+2 and i+3 a day opening through the stop fills at its open, else at the stop.
  Otherwise out at the close of day i+3. 1R = |fill - stop|.
- The rule: one position at a time per test (a setup while a trade is open, or whose order is live, is skipped).
- **The baseline**: the same order after every day i (no smash condition), each its own trade, same side as the test.

## Costs (in price, every trade)
- Spread $0.30 a round trip plus half a spread ($0.15) of slippage per order: **$0.60 a round trip**.
- Financing on longs only: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo
  broker's XAUUSD swap of 11 Nov 2026) x fill price; entry time = the start (00:00 UTC) of the entry day, exit time = the end of
  the exit day; today's rate for every year. Shorts pay and earn nothing.
- **2x costs**: spread, slippage and financing doubled (baseline too).

## Windows (by entry day)
- In sample 2007-01-01 to 2016-12-31; **out of sample (decisive) 2017-01-01 to 2026-10-31**. 2006 is warm-up only.

## Three tests (fixed now), Holm over the three
- **T1 (primary)**: long after a bearish smash; **excess** net R = each trade's net R minus the mean net R of the long
  baseline trades of the same window.
- **T2**: short after a bullish smash; excess net R against the short baseline, the same way.
- **T3**: T1's trades, absolute net R (does the trade pay at all, drift included).

## Statistics
- t on calendar-month sums of the tested quantity (every month of the window, 0 where nothing closed; a trade belongs to its
  exit month); one-sided p from the normal distribution; Holm over the three tests.
- Placebo, 40 seeds (fixed seeded generator): each real out-of-sample trade is replaced by the same order placed after a random
  day of the same calendar year (no smash condition, same side), its excess computed against the same baseline mean. The rule's
  mean excess (T3: mean net) is compared with the 40 seed means.

## Pass bar (per test; all needed)
1. Out of sample n >= 60.
2. Out of sample mean > 0, month-sum t >= 2, Holm-adjusted p < 0.05.
3. In sample mean > 0.
4. Out of sample mean still > 0 at 2x costs (rule and baseline both at 2x).
5. Above at least 38 of the 40 placebo seed means.

**Verdict**: PASS if T1 passes; else FAIL whatever T2 / T3 do (a T2 / T3 that passes alone is named "passes alone, not an edge
until replicated"). Reported besides, deciding nothing: gross R, the baseline's own mean, by year, win rate, stops, the
entry-day stop-outs.

## Deliverables
`run.mjs`, `RESULT.md`, `result.json` in this folder; `tests/gold-smash-day.test.mjs` (offline, hand-made candles); `out/`
rebuilt.
