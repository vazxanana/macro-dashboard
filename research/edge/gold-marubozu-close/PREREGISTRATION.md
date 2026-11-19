# Pre-registration: gold after a day that closes at its extreme (a "full close"), 14 Nov 2026

Written and pushed alone, before any trade was computed. Only the number of setup days was counted (to meet the 100-a-window
floor), never an outcome. Paper research only: a **stand-alone daily rule on gold**, not a gate, exit, entry or size of the live
gold book (docs/owner-decisions.md item 44); none of the book's positions or its 2006-17 records are read. No live rule, file,
cost constant or council member changes.

## The idea

A day that closes at (or very near) its own high, on a range of a normal size or more, is a day whose buyers held the price
into the close: nobody sold the rally back. The hypothesis is that such a "full close" (a marubozu-like close) carries on over
the next days more than an ordinary day does; the mirror (a close at the low) for a short.

Nearest earlier studies, and the difference: `gold-drd-long` (close in the top 30 % of the 17:00 New York day AND a bullish
weekly structure, 3R / 10 days, measured against the bullish-week days), `gold-day-range-used` (intraday, the share of the
average range used by 15:00), `gold-wick-pressure` (ten days of wicks summed), `gold-doji-reversal` (a doji after a stretch),
`gold-smash-day` (a close beyond the previous day's range), `gold-key-reversal` (an outside reversal at a 20-day extreme),
`gold-staircase` (three higher highs and lows). None tests where in its own range one UTC day closes, alone, against every day.

## Data (named before any result)

- council-data `research/daily/xau.json` (OANDA mid, UTC days), read with `git show origin/council-data:…` (no network), the
  cache kept outside git. Saturday / Sunday candles folded into the next weekday with `council/fills.mjs` `foldWeekend`
  (imported, not edited). Gold only; no other market is read.

## Setup (on the close of day i; nothing after that close is read)

- ATR(20) = mean true range of days i-19 … i. Range R = high - low of day i; the day qualifies only when R >= 0.5 x ATR(20).
- **Full close up**: close >= high - 0.10 x R. **Full close down**: close <= low + 0.15 x R (a wider band for the down side
  because a 10 % band gives fewer than 100 setups in 2007-16; set from the count, before any outcome).
- Setup counts with one position at a time, 3-day hold (counted before this file, nothing else looked at): up, R >= 0.5 ATR:
  164 in 2007-16, 232 in 2017-26; up, R >= 1.0 ATR: 110 / 157; down 15 %, R >= 0.5 ATR: 167 / 204.

## Trade

- Entry at the next UTC daily open (day i+1). Long: stop = low of day i - $0.30; short: stop = high of day i + $0.30. If that
  stop is closer than 0.5 x ATR(20) to the entry, or on the wrong side (a gap past it), the stop is put at 0.5 x ATR from the
  entry. 1R = |entry - stop|.
- A stop touched on any day fills at the stop, an open beyond it fills at the open; otherwise out at the close of day i+3
  (three daily candles held). One position at a time per test (a setup while a trade is open is skipped).
- Costs: $0.60 a round trip (spread $0.30 + $0.15 slippage an order), plus financing on buys = `nights(entry, exit)` x
  `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`; today's
  rate for every year, as earlier studies did) x entry / risk. Shorts are charged and credited nothing. Also run at 2x costs.

## Tests (three; Holm over the three on the out-of-sample p)

- **T1 (primary)**: full close up (R >= 0.5 ATR), buy.
- **T2**: full close up on a wide day (R >= 1.0 ATR), buy.
- **T3**: full close down (15 % band, R >= 0.5 ATR), sell.

## Baseline (keeps drift and volatility)

- The same trade (same side, stop rule, hold and costs) entered after **every** day with an ATR, each its own trade, grouped
  by the calendar year of entry. **Excess** of a rule trade = its net R minus the mean net R of the baseline trades of the
  same side entered in the same year (at 2x costs, against the 2x-cost baseline). Gold's drift of that year is so removed.

## Statistics and windows

- Windows by entry day: in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31.
- t on calendar-month sums of excess R (months with no trade count as 0); also reported for net and gross R. One-sided p from
  the OOS excess t (normal), Holm over T1-T3.
- **Placebo (40 seeded draws)**: each real OOS trade is replaced by the same trade after a random day of the same year that
  moved the same way (close above the previous close for T1 / T2, below for T3) and passes the same range filter, but whose
  close is NOT in the full-close band. So the placebo keeps the year's drift, the day's direction and its volatility and removes
  only where the close sat in the range. Reported: how many of the 40 placebo mean excesses the real one beats.
- **Pass (each test)**: OOS mean excess > 0 with month t >= 2 and Holm p < 0.05; in-sample mean excess > 0; OOS excess at
  2x costs > 0 and OOS net at 2x costs > 0; at least 38 of 40 placebos beaten; n >= 100 in each window. The verdict is the
  primary T1; T2 and T3 are reported beside it.

Whatever comes out, it is research only: never a gate or filter of the gold book, and a pass would only earn a forward paper
proposal for the owner.
