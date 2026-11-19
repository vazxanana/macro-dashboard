# Pre-registration: gold after a weekly close at a 13-week low (14 Nov 2026)

Written and pushed alone, before any week of this study is simulated and before any 13-week low of gold is located.

## Question
When spot gold closes a week below every one of its 12 previous weekly closes (a 13-week closing low), does it bounce over the
next weeks by more than gold's own drift, tradeable after costs and financing? Short-horizon reversal after a multi-week low is a
standard mean-reversion idea (reversal of intermediate losers; buying a pullback inside a long-term rise); this asks it of gold
alone, on the weekly close.

## Dedupe (each RESULT.md read)
- `gold-weekly-momentum` (FAIL): the SIGN of last week's (or four weeks') return, every week, held one week; and fading a week
  over 2 sd. Never a 13-week low; never a 4-week hold.
- `gold-streak` (FAIL): runs of 3+ daily closes one way. Daily, not a multi-week low.
- `gold-shock-revert` (FAIL): the 3 days after a 2 x ATR day. Daily, an event of size, not of level.
- `gold-record-high` (FAIL): 20 days after an all-time / 52-week closing HIGH (long and fade). Highs, 52 weeks; not a 13-week low.
- `gold-month-levels`, `gold-weekly-open`, `gold-week-raid`, `gold-inside-week`, `gold-pdhl-break`: levels as intraday
  breakout / raid triggers. Not a weekly closing low.
- `gold-tsmom`, `tsmom`, `trend-breadth*`, `gold-drd-*`: trend / momentum rules; `fx-weekly-reversal`: cross-section of
  currencies. Not this.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`) does not list it; the scratchpad topic list did not
  either. Not a duplicate.

## Relation to the gold book (owner decision 44)
A stand-alone weekly rule. It reads nothing of the book (Gold trend + Gold daily engulf), its records or `legs.json`, and is not a
gate, exit, entry or size of it. Windows are the common stand-alone windows: in sample 2008-01 to 2016-12, out of sample 2017-01
to 2026-10; the decision rests on the out-of-sample window. Said plainly: the 2008-16 daily gold path has been read by many
earlier studies (the in-sample half is a check of sign), and gold rose strongly in 2017-26, so a long rule earns gold's drift:
the random-timing placebo and the "long every fourth week" comparison exist for that.

## Data
OANDA mid XAU_USD daily candles (UTC days), council-data `research/daily/xau.json` at commit `f6288251e` (March 2006 to
6 Nov 2026), read with `git show` (no network). Weekend stubs folded into the next weekday with `council/fills.mjs` `foldWeekend`.
Market set fixed here: spot gold only.

## Weeks
A week = the folded daily candles whose UTC date falls in the same Monday-Sunday calendar week. Weekly open = first candle's open,
weekly close C = last candle's close. A last week of the file not ending on a Friday is dropped.

## Signals (at the close of week k; read weeks k-12 .. k only)
- **Low event**: k >= 12 and C(k) < min(C(k-12) .. C(k-1)) (strictly below each of the 12 previous weekly closes).
- **High event** (mirror): C(k) > max(C(k-12) .. C(k-1)).

## The three tests
- **T1 (primary)**: long after a low event; hold to the close of the last daily candle of week k+4 (four weeks).
- **T2**: long after a low event; hold to the close of week k+1 (one week).
- **T3**: short after a HIGH event; hold to the close of week k+4 (four weeks) (does a 13-week high fade?).

## Trades (fixed here)
- Entry: market at the OPEN of the first daily candle of week k+1.
- **Stop** (every trade has one): 3 x ATR(20) from the entry for the four-week tests (T1, T3), 2 x ATR(20) for T2; ATR = simple
  mean of the 20 daily true ranges up to and including the last candle of week k. Checked on every daily candle held: a candle
  after the entry candle that OPENS through the stop exits at that open; else a low (long) / high (short) reaching it exits at the
  stop. 1R = the stop distance.
- **Time exit**: at the close of the last daily candle of the last week held.
- **One position at a time per test**: an event in a week before the open trade's exit week is ignored.
- **Costs**: $0.30 spread + $0.15 slippage on each of entry and exit = $0.60 a trade, over the stop distance.
- **Financing** on longs: `council/fills.mjs` `nights(entry day start, exit time)` x `FIN.xau.long` (0.000148 of price a rollover,
  the demo broker's XAUUSD swap of 11 Nov 2026, charged for every year as earlier studies did) x entry / stop distance; exit time =
  the exit candle's day start for a stop, Friday 22:00 UTC for a time exit. Shorts pay and are credited nothing.

## Statistics and windows
- A trade belongs to the calendar month of its exit. Statistic = monthly sums of net R over EVERY calendar month of the window
  (a month without a trade counts 0); t = mean / (sd / sqrt n).
- In sample 2008-01 to 2016-12; out of sample 2017-01 to 2026-10.
- **Holm** over the three tests on the one-sided normal p of the OOS net month t.
- **Placebo**, 40 seeds (mulberry32, seeds 1-40), per test: each real trade's signal week is replaced by a week drawn at random
  among all weeks whose trade (same side, same hold, same stop rule) would exit in the same window; overlap allowed. OOS net month
  t of each seed. This keeps side, hold, count and costs and removes only the 13-week timing.
- **2x costs**: spread, slippage and financing doubled.

## Pass bar (each test on its own; PASS if any test passes, FAIL otherwise)
All of: OOS net month mean > 0 with t >= 2 and Holm p < 0.05; the in-sample net month mean > 0; the OOS net month mean > 0 at 2x
costs; the OOS t above the placebo's 95th percentile (more than 38 of 40 seeds below it).

## Reported, not judged
Gross results, stops hit, year by year; "long every fourth week" (the same 4-week hold, stop and costs from every fourth week,
non-overlapping) as the drift comparison. A PASS leads only to a proposal for a paper shadow, never a live change. Nothing live
reads this study.
