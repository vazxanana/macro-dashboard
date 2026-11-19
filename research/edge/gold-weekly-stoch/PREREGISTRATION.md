# Weekly stochastic extremes on spot gold, both sides: pre-registration (14 Nov 2026)

Written and pushed alone, before any trade of this rule was simulated. Paper research only: no live rule, size, filter, council
member or page reads it. A stand-alone rule on spot gold, not a gate, exit, entry or size change of the live gold book (Gold
trend / Gold daily engulf), and it does not use that book's 2006-17 positions (owner decision 44). Every trade has a stop.

## Question

When gold's weekly stochastic oscillator is at an extreme, does the next three weeks' move go against the extreme (the
oscillator's textbook reading: oversold → buy, overbought → sell), or with it (momentum: strength stays strong)? Both sides,
long and short, in one test. No study in `research/edge/` reads a stochastic or Williams %R on any timeframe; the closest,
`gold-weekly-momentum` (FAIL, 0 of 3), reads the sign of last week's and last four weeks' return and the size of one week, not
where the close sits in a 14-week range.

## Market and data (named before any result)

- Spot gold XAU/USD only. OANDA mid daily candles, council-data `research/daily/xau.json` at commit `f6288251e`
  (2006-03-20 to 2026-11-06), weekend stubs folded into Monday with `council/fills.mjs` `foldWeekend`.
- Weeks: calendar weeks (Monday UTC), built from the folded daily candles: open = the first day's open, high / low = the
  week's extremes, close = the last day's close. A final week that does not end on a Friday is left out.

## The oscillator (no look-ahead)

- %K(14) at the close of week k = 100 x (close_k − lowest low of weeks k−13..k) / (highest high of weeks k−13..k − that low).
  Raw %K, no smoothing. Undefined (no signal) before 14 weeks of history or when the range is zero.
- Williams %R(14) is the same number minus 100, so "%R below −80" = "%K below 20": one oscillator, not two tests.

## Trades

- Signal read at the close of week k (only weeks 0..k). Entry at the open of the first daily candle of week k+1.
- Stop: 2 x ATR(20) of the daily candles up to the last day of week k, from the entry (long: entry − 2 ATR; short: entry + 2
  ATR). A day that opens through the stop exits at that open; otherwise a touch exits at the stop. Stop checked on daily high
  / low (on the entry day too).
- Exit: the close of the last daily candle of week k+3 (three weeks held), unless stopped first. No target, no trail.
- One position at a time: after a trade (weeks k+1..k+3) the next signal can be read at the close of week k+3 at the earliest.
- 1R = the stop distance (2 x ATR20). Expected size, measured on the ATR alone before any signal or return was computed:
  median stop $37.35 in 2007-16 (smallest $14.59) and $47.88 in 2017-26 (smallest $18.59); both above $10.

## Costs (fixed now)

- $0.60 a round trip a trade (spread $0.30 plus $0.15 slippage at each end): about 1.6 % of the median R in 2007-16 and
  1.25 % in 2017-26.
- Financing on buys: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, Wednesday three; the cTrader demo's
  XAUUSD swap.long of 11 Nov 2026, as `council/fills.mjs` charges it; today's rate for every year, as earlier studies did) x
  entry / R. For a three-week hold (about 21 rollovers) that is about 0.10R in 2007-16 and 0.12R in 2017-26 at the median
  stop. Sells pay and receive nothing.
- 2x costs = both the spread / slippage and the financing doubled.

## The three tests (Holm over three)

- **T1 (primary), fade the extremes, both sides**: %K < 20 → buy, %K > 80 → sell.
- **T2, fade on the turn**: buy when %K crosses back up through 20 (week k−1 below 20, week k at or above 20); sell when it
  crosses back down through 80 (week k−1 above 80, week k at or below 80).
- **T3, follow the extremes (momentum), both sides**: %K > 80 → buy, %K < 20 → sell.
- Comparison only, not a test: always long and always short three weeks from every week-open on the same one-at-a-time
  calendar, same stop, hold and costs (the unconditional same-side baselines).

## Windows and statistics

- In sample: exit months 2007-01 to 2016-12. Out of sample: exit months 2017-01 to 2026-10.
- t on calendar-month sums of net R (every calendar month of the window, a month with no exit counts 0), by exit month.
- One-sided p from the OOS month t (normal approximation), Holm over the three tests.
- Placebo: 40 seeded draws (mulberry32, seeds 1-40) per test: the test's own trades (same weeks, stops, costs) with their sides
  shuffled among them (same long / short share). The real OOS t must beat at least 39 of the 40 (above the 95th percentile).

## Pass bar (each test on its own)

A test passes only if all hold: OOS net month mean > 0 with month t >= 2; Holm p < 0.05; the in-sample net month mean has the
same sign (> 0); the OOS net month mean is still > 0 at 2x costs; the OOS t beats at least 39 of the 40 placebo draws. The
verdict is PASS if T1 passes; "partly" if only T2 or T3 passes; FAIL otherwise. Nothing is called an edge without n and t, and
a PASS would only lead to a written proposal for the owner (rule 3); no live change follows from this study.

## Reported regardless

Per test and window: trades, longs, won, stopped, gross and net R a trade, cost and financing R, month t (gross and net), total,
worst drawdown of the monthly series; long and short legs apart; per year; the placebo distribution.
