# Pre-registration: the direction of gold's widest H4 candle of the day, followed the next day (14 Nov 2026)

Written and pushed ALONE, before any trade of this rule was simulated or any return computed. Only signal COUNTS per window
were looked at (to check the 100-a-window floor). Paper research only.

## Status of this rule

A **new stand-alone daily rule on spot gold (XAU/USD)**. It is **not a gate, exit, entry or size of the live gold book**
(Gold trend + Gold daily engulf), reads none of the book's positions or its 2006-17 trades (owner item 44 respected), touches
nothing under `ict/` or `council/`, and changes no live rule, config or member. A PASS would only be written up as a
proposal for the owner (absolute rule 3). Paper and demo only.

## The question

Each New York day of gold has one H4 candle that moves the most (the widest high-to-low range). Is that candle where the
day's real business was done, so that its DIRECTION (its own close against its own open) tells the next day's direction
better than the same-side position taken on every day, net of costs, out of sample? And in particular on days when the
day's close went AGAINST the widest candle (the move was given back by the close): does the widest candle or the close win
the next day?

How it differs from studies already done (read before writing this):
- `gold-h4-day-open`: the FIRST H4 of the New York day (a fixed clock slot) for the rest of the SAME day. Here the candle is
  chosen by its range, at any time of day, and the hold is the NEXT day(s).
- `gold-session-agreement`, `gold-overlap-lead`, `gold-session-drift`, `gold-us-asia`, `gold-asia-break`, the London
  studies: fixed sessions or clock windows. Here no session is chosen in advance.
- `gold-wide-day-half`, `gold-extreme-timing`, `gold-driven-day`, `gold-marubozu-close`: the shape or timing of the DAY's
  range. Here the signal is the direction of one H4 inside the day, which can disagree with the day (T2, T3).
- `gold-hour-periodicity`: same clock hour across days. Not this.

## Data (named before any result)

- One market: spot gold, OANDA mid H1 XAU_USD through the site's candle proxy (`/md/bars?sym=xau&tf=1h`, from 2006),
  cached outside git (`run.mjs fetch <dir>`, about 4 MB; deleted after the run).
- New York days: 17:00 to 17:00 New York (`council/histdata.mjs` `nyOffsetH`, US daylight time by year). A day's six H4
  blocks by New York start hour: 17-21, 21-01, 01-05, 05-09, 09-13, 13-17 (built from the H1 candles; OANDA's own H4 is
  UTC-aligned and is not used).
- A signal day is usable when it has 20+ H1 candles in time order, every block has 3+ H1 candles, and the 20 days before
  exist (ATR). A held day must have 15+ H1 candles and follow the previous held day within 4 calendar days.

## The rule

- Widest block = the block with the largest high - low (ties: the earlier block). Its direction d = sign(its last H1 close
  - its first H1 open); d = 0 is no trade.
- Day direction = sign(day's last close - day's first open).
- ATR = mean true range of the 20 New York days ending with the signal day (all known at the signal day's close).
- Entry at the first open of the next New York day (17:00 New York, market). Stop 1 x ATR from the entry on the losing
  side (every trade has a stop). Exit at the last close of the last held day, or at the stop: stop checked on every H1
  candle, a gap through the stop fills at that candle's open. 1R = 1 ATR.

## Tests (three, Holm over the three)

- **T1 (primary)**: follow d, hold one day (the next New York day). Every usable day with d != 0.
- **T2**: follow d only when the day closed against it (day direction = -d), hold one day.
- **T3**: as T2, hold three New York days.

Signal counts before the run (counts only): T1 2,304 in sample / 2,435 out of sample; T2 475 / 513; T3 373 / 504.

## Costs

$0.60 a round trip on every trade ($0.30 spread + half a spread of slippage on entry and on exit, the gold studies'
convention), plus financing on buys only: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo
broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`) x entry price, in R. Today's rate for every year (stated, as in
earlier studies). A 2x-cost column doubles both.

## Baseline, statistics, windows

- **Baseline** = the mean net R of the SAME trade (same entry, stop, hold) on the same side taken on EVERY usable day of the
  same calendar year. Excess (lift) of a trade = its net R - that baseline. This removes gold's upward drift and each year's
  volatility.
- t on calendar-month sums (months with no trade count as 0) of the lift and of net R, by signal-day month.
- In sample: signal days 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.
- Holm over T1-T3 on the one-sided p of the OOS lift month t.
- **Placebo** (40 seeds, seed 20261114 + k): the same signal days, the side drawn by a seeded coin; the real OOS mean lift
  must beat 38 of 40.
- **Control** (40 seeds, seed 20261114 + 1000 + k), keeps drift and volatility and removes the signal's information: each
  real OOS trade moved to a random usable day of the same calendar year, same side and hold; the real OOS mean net must
  beat 38 of 40.

## Pass bar (T1 decides the verdict; T2 and T3 are reported as passing alone or not)

All of: OOS lift > 0 with month t >= 2 and Holm p < 0.05; OOS net > 0 with month t >= 2; in-sample lift > 0 (same sign);
OOS net at 2x costs > 0; placebo beaten 38 of 40; control beaten 38 of 40; n >= 100 in both windows. Anything else is FAIL.
No parameter is tuned after the run; a near miss is reported, never re-tested on the same data.
