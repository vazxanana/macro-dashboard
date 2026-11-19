# Classic daily candlestick reversal patterns across CFD markets: pre-registration

Written 14 Nov 2026 and pushed alone, before `run.mjs` exists and before any pattern, trade or return was computed. Paper
research only: nothing here is read by the council, the mirror or the page, and no live rule changes.

## The question

Do the six textbook candlestick reversal patterns (bullish and bearish engulfing, hammer and shooting star, morning and
evening star) make money as daily trades on CFD markets after costs, when taken only where retail lore says they work, at
the edge of a range (a bullish pattern at a 10-day low, a bearish one at a 10-day high)?

**Prior.** Marshall, Young and Rose, "Candlestick technical trading strategies: can they create value for investors?",
Journal of Banking & Finance 30 (2006): on the Dow Jones Industrial Average stocks, 1992-2002, none of the single and
multiple candle patterns tested beat a bootstrap of random returns. The prior is therefore "no value"; this study tests it
on index, metal, energy and currency CFDs, net of CFD costs.

**Duplicate check (14 Nov 2026).** No study in `research/edge/` or on any remote branch defines a hammer, shooting star or
morning / evening star (searched every branch's history for those words and "candlestick"). Every engulfing study is on gold
(`geg-variants`, `engulf-ladder`, `gold-systems`, `msnr-entry`, all FAIL / NOT BETTER, and the live Gold daily engulf,
which uses the repository's own zone rules). `gold-drd-silver` tested a daily rejection candle on silver inside a weekly
bullish structure, a different rule (weekly filter, top-30 % close, 3R / 10 days). **Gold (xau) and gold crosses are
excluded** here: item 44 freezes the gold book's 2006-17 window and the gold studies above cover it.

## Markets (fixed now)

Every council-data daily candle key (`origin/council-data:research/daily/<key>.json`, OANDA mid, UTC days) in the four
groups with data from 2008 or earlier, gold and gold crosses excluded:

- **Equity indices (14):** au200, ch20, de40, eu50, fr40, hk33, jp225, nas100, nl25, sg30, spx500, uk100, us2000, us30.
  (cn50, es35, in50 start after 2008 and are left out.)
- **Metals other than gold (4):** xag, xcu, xpd, xpt. (xau, xaueur, xaugbp, xauxag left out: gold.)
- **Energies (3):** bco, wtico, natgas.
- **Currency majors (7):** eurusd, gbpusd, audusd, nzdusd, usdjpy, usdcad, usdchf.

28 markets. Candle cache kept outside git (`node run.mjs fetch <dir>` copies the files with `git show`, no network).

## Candles

- Rows before **2005-01-01** are dropped for every market (the OANDA currency files before 2005 are single-tick prints with
  high = low on most days; seen in a count of zero-range days per year, no return looked at). The first usable signal needs
  21 candles after that (ATR(20) and the 10-day window).
- Saturday and Sunday candles are folded into the next weekday (`council/fills.mjs` `foldWeekend`, imported): its open
  becomes the first weekend open, high / low cover both.
- A pattern any of whose candles has high = low is not a signal.

## Pattern definitions (exact; candle i = the pattern's last candle)

For a candle: body = |close − open|, range = high − low, upper shadow = high − max(open, close), lower shadow =
min(open, close) − low. Bullish candle: close > open; bearish: close < open.

1. **Bullish engulfing** (2 candles): i−1 bearish, i bullish, open_i <= close_{i−1}, close_i >= open_{i−1}, body_i >
   body_{i−1}. (Textbook: the second real body engulfs the first; no zone, no wick rule.)
2. **Bearish engulfing:** the mirror: i−1 bullish, i bearish, open_i >= close_{i−1}, close_i <= open_{i−1}, body_i >
   body_{i−1}.
3. **Hammer** (1 candle, either colour): body <= range / 3, lower shadow >= 2 × body, upper shadow <= 0.1 × range.
4. **Shooting star:** body <= range / 3, upper shadow >= 2 × body, lower shadow <= 0.1 × range.
5. **Morning star** (3 candles): i−2 bearish with body >= 0.6 × its range; i−1 body <= 0.3 × body_{i−2} and
   max(open, close)_{i−1} <= close_{i−2} (the star's body at or below the first close; no gap is required, daily CFD candles
   rarely gap); i bullish with close_i > (open_{i−2} + close_{i−2}) / 2.
6. **Evening star:** the mirror: i−2 bullish with body >= 0.6 × range; i−1 body <= 0.3 × body_{i−2} and
   min(open, close)_{i−1} >= close_{i−2}; i bearish with close_i < (open_{i−2} + close_{i−2}) / 2.

Bullish = 1, 3, 5 (trade long); bearish = 2, 4, 6 (trade short).

**Context filter.** A bullish pattern counts only when its lowest low (over its own candles) is the lowest low of the 10
candles ending at i (i−9 … i): the pattern made a 10-day low. A bearish pattern counts only when its highest high is the
highest high of those 10 candles. Nothing after candle i is read.

## Trade

- **Entry:** the open of candle i+1 (the next folded candle), in the pattern's direction.
- **Stop:** beyond the pattern's extreme by 0.1 × ATR(20) at candle i (ATR = the mean true range of candles i−19 … i):
  long stop = pattern low − 0.1 ATR, short stop = pattern high + 0.1 ATR. Risk r0 = |entry − stop|. If the entry opens
  at or beyond the stop (r0 <= 0) there is no trade.
- **Target:** 2R (entry ± 2 r0).
- **Exit**, checked on candles i+1 … i+5 in order: an open at or past the stop or target exits at that open; else a candle
  that reaches the stop exits at the stop; else one that reaches the target exits at the target; stop and target in one
  candle = the stop (worst case); else out at the close of candle i+5 (five candles held, the entry candle the first).
  A market whose file ends earlier closes at the last close (counted as open at the end, at most a handful).
- **One position at a time per market per stream:** a signal while that stream already holds that market is skipped. In a
  pooled stream two patterns of the same direction on one candle are one trade; opposite directions on one candle = no
  trade.

## Costs (per trade, round trip, charged as cost ÷ r0) and financing

From `research/edge/trend-breadth` (its table) and the brief's index rate:

| group | x1 round trip, % of entry price |
|---|---|
| currency majors | 0.015 |
| equity indices | 0.04 |
| silver, copper, energies | 0.10 |
| platinum, palladium | 0.20 |

x2 doubles the table. **Financing** as `trend-breadth` (its sourced assumption, 5.5 % a year on a long): a long index /
metal / energy position pays 0.015 % of its entry price per rollover, a short is credited nothing; a currency position
pays 0.004 % per rollover on either side. Rollovers = `trend-breadth` `nights` (Monday-Friday 22:00 UTC, Wednesday
three) between entry (the entry candle's 00:00 UTC) and exit (the exit candle's end for a time exit, its middle, 12:00
UTC, for a stop or target exit). Net R = gross R − cost R − financing R.

## Windows and statistics

- In sample: trades entered 2005-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.
- t = mean ÷ (sd / √months) of **calendar-month sums** of net R over every month of the window (months with no trade = 0),
  all markets of the stream added together. Two-sided p from the normal; **Holm over all 14 tests** below (on the OOS net p).

## Tests (14, all fixed now)

- **T1, primary:** all six patterns pooled over all 28 markets, with the context filter.
- **T2-T7:** each pattern pooled over all 28 markets, with the context filter.
- **T8:** all six pooled, no context filter.
- **T9-T14:** each pattern, no context filter.

## Placebo

40 seeded draws (a fixed seed, written in result.json). Each draw takes every T1 trade's market and signal candle, enters
at the same next open with the **same r0** and the same 2R / 5-day exit, in a **random direction** (fair coin), one at a
time per market as T1. Reported: the draws' OOS net mean and t (median, 5th / 95th percentile) and the share of draws whose
OOS net t is at or above T1's.

## Pass bar (T1 decides the verdict)

PASS only if all hold: (1) T1's OOS net t >= 2 and its Holm-adjusted p < 0.05; (2) T1's in-sample net mean > 0; (3) T1's
OOS net mean is still > 0 at x2 costs. Otherwise FAIL. The secondary tests are reported with the same numbers, gross and
net, IS and OOS, and a secondary one that clears the bar is a hypothesis for its own pre-registration, not a finding.

## What is reported

Per test: n, mean R gross and net, win rate, t (monthly) for IS and OOS, OOS at x2 costs, Holm p. T1 by market group and by
year (OOS). The placebo. No parameter (10 days, 0.1 ATR, 2R, 5 days, the shape ratios) is changed after a result is seen.
