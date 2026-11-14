# Pre-registration: gold's first New York cash hour that raids the overnight range and fails back inside (14 Nov 2026)

Written and pushed before any return of this rule was computed. Paper research only. A new stand-alone intraday rule on spot
gold, **never a gate, exit, entry or size of the live gold book**; none of the book's positions (2006-17 or later) are read
(owner decision 44). Nothing live changes whatever the result, and no proposal is written from it alone.

## Hypothesis

Overnight (18:00 New York the evening before to 09:00 New York) gold builds a range. The hour that holds the US cash open
(the H1 candle 09:00-09:59 New York) often trades through one end of that range. When it trades through one end and then
CLOSES back inside the range, the raid failed (stops above / below the overnight extreme were taken and price was rejected),
and gold should move back toward the middle of the overnight range during the rest of the New York session. When it closes
beyond the end (acceptance), gold should carry on that way.

Nearest tested topics, and the difference: `gold-london-reversal` fades the London move at 09:30 NY (no overnight range, no
failure condition); `gold-pdhl-break` and `mmxm-pdhl-raid-gold` use the previous day's high / low; `gold-week-raid` the
previous week's; `gold-daily-turtle-soup` the 20-day range on daily candles; `gold-comex-orb` / `gold-london-orb` break an
opening range; `gold-us-asia` / `gold-late-ny` / `gold-session-drift` read session drifts without any range. No study has
read the 18:00-09:00 New York overnight range against the hour of the US cash open.

## Data (named before any result)

- One market: spot gold, OANDA mid XAU/USD H1 candles through the keyless candle proxy (`/md/bars?sym=xau&tf=1h`), June 2006
  to the end of October 2026, rows `[unixSec, o, h, l, c]`, kept out of git (`run.mjs fetch <file>`).
- New York time by the US daylight rule since 2007 (2nd Sunday of March to 1st Sunday of November); OANDA's H1 candles are
  UTC-hour aligned, so each is one whole New York hour.
- Session day D (Monday to Friday, New York): the overnight = H1 candles from 18:00 New York of the previous calendar day
  (Sunday for Monday) to the candle starting 08:00 New York (so the 08:30 releases are inside it). At least 10 overnight
  candles and the 09:00 candle must exist, else the day is skipped.

## Event counts (counted before pre-registering; no return read)

Weekdays with the data above: 2,585 in 2007-16, 2,537 in 2017 to Oct 2026. The 09:00 candle trades through exactly one end
and closes back inside ("fade" events): **599 in sample, 653 out of sample**. It closes beyond the end ("follow" events):
580 and 593. Both ends traded (skipped): 8 and 9. Every window has well over 100 events.

## The rule and the three tests

Let H / L = overnight high / low, M = (H + L) / 2, C9 = the 09:00 New York H1 candle.

- **T1 (primary): fade the failed raid to the middle.** C9.high > H and C9.close < H (and C9.low >= L): SELL at the open of
  the 10:00 New York candle; stop = C9.high + $0.30; target = M; out at the 16:00 New York candle's open (the close of the
  15:00 candle) if neither is hit. Mirror for a raid of L: BUY, stop C9.low − $0.30, target M. If the entry is already at or
  beyond M (sell entry <= M, buy entry >= M) or on the wrong side of its stop, no trade (counted).
- **T2: fade, no target.** The same events, entry and stop; out at 16:00 New York.
- **T3: follow the accepted break.** C9 closes beyond one end only (close > H with C9.low >= L: BUY; close < L with
  C9.high <= H: SELL) at the 10:00 open; stop $0.30 beyond C9's other extreme; no target; out at 16:00 New York.
- Management on H1 candles from 10:00 New York: a candle opening through the stop fills at its open; a candle touching the
  stop fills at the stop; the stop is checked before the target in the same candle. One trade a day per test.
- R = the move in units of the entry-to-stop distance.

## Costs

$0.60 a round trip per ounce (spread and slippage), and 2x reported. Financing on buys: `council/fills.mjs` `nights(t0, t1)`
x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD `swap.long` of 11 Nov 2026) x entry / R distance.
Every exit is at or before 16:00 New York, before the 17:00 rollover, so financing should be zero; the run checks and says so.

## Baseline (same side, same year)

For each event trade, the same-side trade with the same stop distance, the same target distance (T1) and the same 10:00 to
16:00 New York window is taken on every eligible weekday of the same calendar year; its mean net R is that trade's baseline.
**Lift** = net R minus the baseline, reported per window with its t on calendar-month sums.

## Windows and statistics

- In sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31. Halves of the out-of-sample window reported.
- t on calendar-month sums of net R. p one-sided from t (normal). Holm over the three tests' out-of-sample p.
- Placebo: 40 seeds (fixed PRNG, seeds 1-40); in each, every out-of-sample trade of a test is replaced by the same trade
  (side, stop distance, target distance, 10:00-16:00 window) on a random eligible weekday of the same year.

## Pass bar (a test passes only if all hold)

1. Out of sample net R a trade > 0 with month-sum t >= 2, and Holm-adjusted p < 0.05.
2. In sample net R a trade > 0 (same sign).
3. Out of sample net R a trade > 0 at 2x costs.
4. Out-of-sample lift over the same-year baseline > 0.
5. Out-of-sample mean above at least 38 of the 40 placebo seed means.
6. n >= 100 in each window.

The verdict is PASS if T1 passes; T2 and T3 are read as secondary (a pass of T2 or T3 alone is reported as a lead to
replicate, not a pass of the study). Even a pass is a lead to replicate on other data before anyone calls it more.

## Decided now, so nothing can be chosen after the result

The 09:00 candle is the only raid candle; the overnight starts at 18:00 New York; the entry is the 10:00 open; the exit is
16:00 New York; the buffer is $0.30; no ATR or volatility filter; no other market; no parameter is varied.
