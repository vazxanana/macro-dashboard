# Pre-registration: the standard Ichimoku Kinko Hyo signals on gold (14 Nov 2026)

Written and pushed before any number of this study is computed. Nothing else is in the commit that adds this file.

## Why
The owner asked whether the textbook Ichimoku signals work on gold. No study in `research/edge` (or on any branch) has
tested Ichimoku, its cloud, Tenkan or Kijun. The closest studies are trend rules that failed out of sample on gold or
elsewhere: `gold-tsmom` (12-month time-series momentum on gold, 2007-17 t 0.84 / 1.03, FAIL) and `trend-breadth-h1` (the
live Gold trend rule on 13 other markets, 0 of 14, FAIL). Ichimoku is another trend-following rule with its own entry and
exit; this study measures it as published, with no tuning.

**A stand-alone rule.** It is not a gate, exit, entry or size of the live gold book (Gold trend, Gold daily engulf), reads
nothing of it, and none of its results may be proposed as one (CLAUDE.md "Path to live", item 44: no further gate, exit,
entry or size is tested on that book's 2006-17 window). A PASS would be a proposal to the owner for a paper shadow at most.
Paper only; nothing live changes.

## Indicators (fixed, the standard 9 / 26 / 52)
On closed candles of the test's timeframe:
- Tenkan = (highest high + lowest low) / 2 over the last 9 candles, up to and including the current one.
- Kijun = the same over 26 candles.
- Span A = (Tenkan + Kijun) / 2; Span B = (highest high + lowest low) / 2 over 52 candles.
- **The cloud is shifted 26 candles forward**: the cloud at candle i is Span A and Span B as computed on candle i - 26.
  Cloud top = max of the two, bottom = min. Everything used at candle i is known at its close (no look-ahead).
- ATR(14) = Wilder's average of the true range over 14 candles, at the signal candle's close.

## Tests (three, judged with Holm)
Every trade has a stop, placed at the fill. One position at a time per test. Entries and exits at the NEXT candle's open
after the signal or exit close. A stop is checked on every candle from the entry candle on: filled at the stop, or at the
open when the candle opens beyond it. When an exit close and a new signal the other way fall on the same candle, the
position is closed and the new one opened at the same next open.
- **T1 (daily, cloud breakout).** Buy when the close crosses above the cloud (close > cloud top, previous close <= the
  previous cloud top) while Tenkan > Kijun. Sell on the mirror (close crosses below the cloud bottom while Tenkan < Kijun).
  Stop 2 x ATR(14) from the fill. Exit on a close back inside the cloud (a buy: close <= cloud top; a sell: close >= cloud
  bottom; a close through the whole cloud counts too), or the opposite signal.
- **T2 (daily, TK cross with the cloud).** Buy when Tenkan crosses above Kijun (Tenkan > Kijun, previously <=) while the
  close is above the cloud top; sell when Tenkan crosses below Kijun while the close is below the cloud bottom. Stop
  2 x ATR(14). Exit on the opposite TK cross (whatever the cloud); if that cross is also a signal, reverse.
- **T3 (H4, cloud breakout).** T1's rule on H4 candles, stop 2 x ATR(14) of H4, exit on a close back inside the cloud or the
  opposite signal.

## Data
- Daily: council-data `research/daily/xau.json` (OANDA mid XAU_USD, UTC days, from March 2006), read with
  `git show origin/council-data:...`; Saturday / Sunday stubs folded into the next weekday with `council/fills.mjs`
  `foldWeekend` (the trading-day rule of item 52).
- H4: built from the OANDA mid H1 cache of the earlier gold studies (2006-03 to 2026-11, kept out of git). **H4 boundaries
  are anchored to 17:00 New York** (17, 21, 01, 05, 09, 13 New York time, daylight saving followed), so the first H4 of a
  week starts at the Sunday reopen and no candle spans the weekend. H1 candles while spot is shut (`council/fills.mjs`
  `spotClosed`: Friday 17:00 to Sunday 17:00 New York) are dropped. An H4 candle = first open, high / low over its hours,
  last close; time = its first hour.

## Costs
- $0.60 an ounce a round trip on every trade (spread and slippage).
- Financing on buys only: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the
  demo broker's XAUUSD swap of 11 Nov 2026) x the entry price. Sells pay and receive nothing (as the council's cost model).
  Today's rate is charged for every year (the broker's past rates are unknown). Exit time for a stop hit inside a candle =
  that candle's close time (charges the most nights).
- Result per trade in R = (signed move - costs) / initial risk (2 x ATR at the signal). Also reported as % of the entry price.

## Windows and statistics
- In sample 2008-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31; by entry time. 2006-07 is warm-up only.
- t = mean / (sd / sqrt n) of the calendar-month sums of net R by exit month, every calendar month of the window counted
  (zero when nothing closed). One-sided p from Student t; Holm over the three tests' OOS p.
- 2x costs: $1.20 a round trip and twice the financing.
- **Placebo** (40 seeds, per test, OOS): the same number of entries on random candles of the OOS window, the same side mix
  (the real sides shuffled), the same stop (2 x ATR(14) at the random candle, entry at the next open) and the same holding
  times (the real trades' holding times in candles, shuffled; exit at that open unless stopped first). Placebo trades may
  overlap. Compared on OOS net R total (same n).
- Buy-and-hold comparison (reported, not judged): gold held 1x over each window, % before and after the same financing,
  against the rule's summed % of price.
- OOS halves: 2017-01 to 2021-12 and 2022-01 to 2026-10.

## Pass bar (each test on its own)
All of: OOS net R total > 0; OOS month t >= 2 with Holm-adjusted p < 0.05; in-sample net total > 0 (same sign); net > 0 in
both OOS halves; OOS net still > 0 at 2x costs; beats at least 38 of 40 placebos; OOS n >= 30.
Verdict PASS if any test passes (named), else FAIL. Never an edge without n and t; a PASS is a proposal, not a live change.

## Reported, not tested
Year by year, longs against shorts, gross against net, exits by reason.
