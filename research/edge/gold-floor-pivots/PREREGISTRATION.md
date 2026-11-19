# Gold floor pivots as intraday support and resistance: pre-registration (14 Nov 2026)

Written and pushed before any candle of this study was read for a result.

## Question

Do classic daily floor pivots on gold act as intraday support and resistance, or are they broken through?
P = (H + L + C) / 3 of the previous day, R1 = 2P - L, S1 = 2P - H.

## Why this study, and what it is not

- `research/edge/pivot-points` (branch `pivot-points`) tested the same levels on ten markets (five indices, four forex majors,
  silver) and left gold out on purpose. This study fills that gap with the rules fixed here, not copied from it.
- The gold level studies checked first (`gold-round-numbers`, `gold-vwap`, `gold-weekly-open`, `mmxm-pdhl-raid-gold`,
  `gold-daily-turtle-soup`) test other levels; none tests P / R1 / S1.
- **A stand-alone rule.** It is never a gate, exit, entry or size of the live gold book (Gold trend, Gold daily engulf), and
  it does not read the book's 2006-17 window (item 44). Paper research only: nothing live changes, whatever the verdict.

## Data

- OANDA mid M5 XAU/USD, December 2015 to the cache's last complete day (study cache, kept out of git).
- Daily candles = UTC days built from those M5 candles, then weekends folded into the next weekday with `council/fills.mjs`
  `foldWeekend` (a Sunday stub joins Monday). The previous day of a Monday is the Friday.
- ATR20 = the simple mean of the true range of the 20 folded days up to and including the previous day (nothing of the
  trading day).

## The trading day and the levels

- Weekdays only. Window 07:00 to 20:00 UTC. The "07:00 open" = the open of the first M5 candle at or after 07:00 UTC.
- A level is used that day only if it is at least 0.1 x ATR20 from the 07:00 open, on the side the test needs (below:
  price must come up to it; above: price must come down to it).
- Every trade has a stop on the losing side of its entry; a trade whose stop would not be on the losing side is not taken.
- Exit at the target or stop, else at the close of the last M5 candle that ends by 20:00 UTC.
- One trade per test per day (the first trigger of the day, either side).
- Stop and target inside one M5 candle: stop first. A candle that opens past the stop fills at its open. A limit entry fills at
  the level (or at the candle's open when it opens past the level, the better price). On the entry candle of a limit, only the
  stop can be hit (the target is counted from the next candle).

## The three tests

- **T1, fade R1 / S1**: R1 above the 07:00 open by >= 0.1 ATR: sell limit at the first touch of R1. S1 below by >= 0.1 ATR:
  buy limit at the first touch of S1. Stop 0.25 x ATR20 beyond the level. Target P.
- **T2, breakout**: the first M5 close above R1 (R1 qualified as in T1): buy at the next candle's open; the first close below
  S1: sell at the next open. Stop 0.25 x ATR20 back inside (R1 - 0.25 ATR for buys, S1 + 0.25 ATR for sells). No target: held
  to 20:00 UTC.
- **T3, P bounce**: 07:00 open above P by >= 0.1 ATR: buy limit at the first touch of P; open below P by >= 0.1 ATR: sell
  limit at the first touch of P. Stop 0.2 x ATR20 beyond P. Target R1 for buys, S1 for sells.

## Costs

- $0.60 a round trip, in R of each trade's own risk (|entry - stop|).
- Financing: `FIN.xau.long` (council/fills.mjs, the demo broker's swap) on a buy for each rollover it is held over, counted
  with `nights` (22:00 UTC). Every trade is flat by 20:00 UTC, so no trade crosses a rollover and this charge is 0; it is
  computed anyway and reported.
- 2x costs = $1.20 a round trip.

## Windows and statistics

- In sample 2016-01-01 to 2020-12-31; out of sample 2021-01-01 to the cache end.
- t = one-sample t of net R summed by calendar month (every calendar month of the window, 0 where no trade), one-sided p from
  the t distribution; Holm over the three tests.
- Placebo: 40 seeds. Each day the whole ladder (P, R1, S1) is shifted by one random offset of 0.3 to 0.7 x ATR20 with a random
  sign; the rules are otherwise identical. The real OOS net R a trade is compared with the 40 placebo values.

## Pass bar (each test; the study passes if any test passes, and says which)

1. OOS net R a trade > 0;
2. OOS month t >= 2 and Holm-adjusted p < 0.05;
3. in-sample net R a trade > 0 (positive in both halves);
4. OOS net R a trade > 0 at 2x costs;
5. real OOS net R a trade above at least 38 of the 40 placebos;
6. OOS n >= 30.

All six are required. Otherwise FAIL. Reported regardless: gross and net R a trade, n and t, in and out of sample, by side.
